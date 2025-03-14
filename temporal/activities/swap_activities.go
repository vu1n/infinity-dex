package temporal_activities

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
)

// SwapActivities holds implementation of swap-related activities
type SwapActivities struct {
	universalSDK universalsdk.SDK
	swapService  SwapServiceInterface
}

// SwapServiceInterface defines the interface for swap service
type SwapServiceInterface interface {
	GetSwapQuote(ctx context.Context, request types.SwapRequest) (*types.SwapQuote, error)
	ExecuteSwap(ctx context.Context, request types.SwapRequest) (string, error)
	GetSwapStatus(ctx context.Context, requestID string) (*types.SwapResult, error)
	CancelSwap(ctx context.Context, requestID string) error
}

// NewSwapActivities creates a new instance of swap activities
func NewSwapActivities(sdk universalsdk.SDK, swapService SwapServiceInterface) *SwapActivities {
	return &SwapActivities{
		universalSDK: sdk,
		swapService:  swapService,
	}
}

// CalculateSwapQuoteActivity calculates a quote for a swap
func (a *SwapActivities) CalculateSwapQuoteActivity(ctx context.Context, request types.SwapRequest) (*types.SwapQuote, error) {
	// Log activity start
	activity.GetLogger(ctx).Info("Calculating swap quote",
		"sourceToken", request.SourceToken.Symbol,
		"destToken", request.DestinationToken.Symbol,
		"amount", request.Amount.String(),
	)

	// Validate request
	if request.Amount == nil || request.Amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	// Get quote from swap service
	quote, err := a.swapService.GetSwapQuote(ctx, request)
	if err != nil {
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to get swap quote: %v", err),
			"QUOTE_FAILED")
	}

	// Log quote details
	activity.GetLogger(ctx).Info("Swap quote calculated successfully",
		"inputAmount", quote.InputAmount.String(),
		"outputAmount", quote.OutputAmount.String(),
		"exchangeRate", quote.ExchangeRate,
		"priceImpact", quote.PriceImpact,
	)

	return quote, nil
}

// ExecuteSwapActivity executes a swap
func (a *SwapActivities) ExecuteSwapActivity(ctx context.Context, request types.SwapRequest) (*types.SwapResult, error) {
	// Log activity start
	activity.GetLogger(ctx).Info("Executing swap",
		"sourceToken", request.SourceToken.Symbol,
		"destToken", request.DestinationToken.Symbol,
		"amount", request.Amount.String(),
		"requestID", request.RequestID,
	)

	// Validate request
	if request.Amount == nil || request.Amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	// Execute swap
	requestID, err := a.swapService.ExecuteSwap(ctx, request)
	if err != nil {
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to execute swap: %v", err),
			"SWAP_FAILED")
	}

	// Poll for swap completion (with timeout)
	startTime := time.Now()
	timeout := 25 * time.Second // Slightly less than activity timeout to allow for clean return

	for {
		// Check if we've exceeded the timeout
		if time.Since(startTime) > timeout {
			return nil, temporal.NewApplicationError(
				"Swap execution timed out",
				"SWAP_TIMEOUT")
		}

		// Get swap status
		result, err := a.swapService.GetSwapStatus(ctx, requestID)
		if err != nil {
			activity.GetLogger(ctx).Error("Failed to get swap status", "error", err)
			// Continue polling, don't fail the activity yet
		} else {
			if result.Success {
				// Swap completed successfully
				activity.GetLogger(ctx).Info("Swap executed successfully",
					"requestID", requestID,
					"inputAmount", result.InputAmount.String(),
					"outputAmount", result.OutputAmount.String(),
				)
				return result, nil
			} else if result.ErrorMessage != "Swap in progress" {
				// Swap failed with a specific error
				return nil, temporal.NewApplicationError(
					fmt.Sprintf("Swap failed: %s", result.ErrorMessage),
					"SWAP_FAILED")
			}
		}

		// Sleep before polling again
		time.Sleep(2 * time.Second)
	}
}

// CancelSwapActivity cancels a swap
func (a *SwapActivities) CancelSwapActivity(ctx context.Context, requestID string) error {
	// Log activity start
	activity.GetLogger(ctx).Info("Cancelling swap", "requestID", requestID)

	// Validate request ID
	if requestID == "" {
		return temporal.NewNonRetryableApplicationError(
			"Invalid request ID",
			"INVALID_REQUEST_ID",
			errors.New("request ID cannot be empty"))
	}

	// Cancel swap
	err := a.swapService.CancelSwap(ctx, requestID)
	if err != nil {
		return temporal.NewApplicationError(
			fmt.Sprintf("Failed to cancel swap: %v", err),
			"CANCEL_FAILED")
	}

	activity.GetLogger(ctx).Info("Swap cancelled successfully", "requestID", requestID)
	return nil
}
