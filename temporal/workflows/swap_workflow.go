package temporal_workflows

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/infinity-dex/services/types"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// SwapWorkflowInput represents the input for the swap workflow
type SwapWorkflowInput struct {
	Request types.SwapRequest
}

// SwapWorkflowState represents the current state of the swap workflow
type SwapWorkflowState struct {
	RequestID    string
	Quote        *types.SwapQuote
	Status       string
	ErrorMessage string
	Timestamp    time.Time
}

// SwapWorkflow is the workflow definition for executing token swaps
// It orchestrates the following steps:
// 1. Calculate and return a quote for the swap
// 2. Wait for user confirmation
// 3. Execute the swap with a timeout
// 4. Return the result
func SwapWorkflow(ctx workflow.Context, input SwapWorkflowInput) (*types.SwapResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("SwapWorkflow started", "sourceToken", input.Request.SourceToken.Symbol, "destToken", input.Request.DestinationToken.Symbol)

	// Initialize workflow state
	state := SwapWorkflowState{
		RequestID: input.Request.RequestID,
		Status:    "initiated",
		Timestamp: workflow.Now(ctx),
	}

	// If no request ID provided, generate one
	if state.RequestID == "" {
		state.RequestID = fmt.Sprintf("swap-%s", uuid.New().String())
		input.Request.RequestID = state.RequestID
	}

	// Define retry policy for activities
	options := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, options)

	// Step 1: Calculate swap quote
	var quote types.SwapQuote
	err := workflow.ExecuteActivity(ctx, "CalculateFeeActivity", input.Request).Get(ctx, &quote.Fee)
	if err != nil {
		logger.Error("Failed to calculate fee", "error", err)
		state.Status = "failed"
		state.ErrorMessage = fmt.Sprintf("Failed to calculate fee: %v", err)
		return createFailedResult(state), err
	}

	// Calculate output amount and other quote details
	err = workflow.ExecuteActivity(ctx, "CalculateSwapQuoteActivity", input.Request).Get(ctx, &quote)
	if err != nil {
		logger.Error("Failed to calculate swap quote", "error", err)
		state.Status = "failed"
		state.ErrorMessage = fmt.Sprintf("Failed to calculate swap quote: %v", err)
		return createFailedResult(state), err
	}

	// Update state with quote
	state.Quote = &quote
	state.Status = "quote_ready"

	// Create a channel to receive the confirmation signal
	confirmationSignal := workflow.GetSignalChannel(ctx, "confirm_swap")
	cancelSignal := workflow.GetSignalChannel(ctx, "cancel_swap")

	// Create a selector to wait for signals
	selector := workflow.NewSelector(ctx)

	// Add confirmation signal handler
	selector.AddReceive(confirmationSignal, func(c workflow.ReceiveChannel, more bool) {
		var confirmed bool
		c.Receive(ctx, &confirmed)
		if confirmed {
			state.Status = "confirmed"
		}
	})

	// Add cancel signal handler
	selector.AddReceive(cancelSignal, func(c workflow.ReceiveChannel, more bool) {
		var cancelled bool
		c.Receive(ctx, &cancelled)
		if cancelled {
			state.Status = "cancelled"
			state.ErrorMessage = "Swap cancelled by user"
		}
	})

	// Add timeout handler (30 seconds)
	timerFuture := workflow.NewTimer(ctx, 30*time.Second)
	selector.AddFuture(timerFuture, func(f workflow.Future) {
		state.Status = "timeout"
		state.ErrorMessage = "Quote confirmation timed out"
	})

	// Wait for confirmation, cancellation, or timeout
	selector.Select(ctx)

	// If not confirmed, return with appropriate status
	if state.Status != "confirmed" {
		logger.Info("Swap not confirmed", "status", state.Status)
		return createFailedResult(state), nil
	}

	// Step 3: Execute the swap with a timeout
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    3,
		},
	}
	swapCtx := workflow.WithActivityOptions(ctx, activityOptions)

	// Execute the swap
	var result types.SwapResult
	err = workflow.ExecuteActivity(swapCtx, "ExecuteSwapActivity", input.Request).Get(ctx, &result)
	if err != nil {
		logger.Error("Failed to execute swap", "error", err)
		state.Status = "failed"
		state.ErrorMessage = fmt.Sprintf("Failed to execute swap: %v", err)
		return createFailedResult(state), err
	}

	// Update result with request ID
	result.RequestID = state.RequestID

	logger.Info("SwapWorkflow completed successfully",
		"requestID", state.RequestID,
		"sourceToken", input.Request.SourceToken.Symbol,
		"destToken", input.Request.DestinationToken.Symbol,
		"inputAmount", input.Request.Amount.String(),
		"outputAmount", result.OutputAmount.String())

	return &result, nil
}

// Helper function to create a failed result
func createFailedResult(state SwapWorkflowState) *types.SwapResult {
	return &types.SwapResult{
		RequestID:      state.RequestID,
		Success:        false,
		ErrorMessage:   state.ErrorMessage,
		CompletionTime: state.Timestamp,
	}
}
