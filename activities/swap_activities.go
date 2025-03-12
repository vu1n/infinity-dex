package activities

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/infinity-dex/services"
	"github.com/infinity-dex/universalsdk"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
)

// SwapActivities holds implementation of swap-related activities
type SwapActivities struct {
	universalSDK universalsdk.SDK
}

// NewSwapActivities creates a new instance of swap activities
func NewSwapActivities(sdk universalsdk.SDK) *SwapActivities {
	return &SwapActivities{
		universalSDK: sdk,
	}
}

// CalculateFeeActivity estimates the fees for a swap operation
func (a *SwapActivities) CalculateFeeActivity(ctx context.Context, request services.SwapRequest) (*services.Fee, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Calculating fees for swap", "requestID", request.RequestID)

	// Validate inputs
	if request.Amount == nil || request.Amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	// Create fee estimate request
	feeRequest := universalsdk.FeeEstimateRequest{
		SourceToken:      request.SourceToken,
		DestinationToken: request.DestinationToken,
		Amount:           request.Amount,
	}

	// Get fee estimate from Universal SDK
	fee, err := a.universalSDK.GetFeeEstimate(ctx, feeRequest)
	if err != nil {
		logger.Error("Failed to get fee estimate", "error", err)
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to get fee estimate: %v", err),
			"FEE_ESTIMATE_FAILED")
	}

	// Check if the amount after fees would be positive
	totalFees := new(big.Int).Add(
		new(big.Int).Add(fee.GasFee, fee.ProtocolFee),
		new(big.Int).Add(fee.NetworkFee, fee.BridgeFee),
	)

	amountAfterFees := new(big.Int).Sub(request.Amount, totalFees)
	if amountAfterFees.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Amount too small to cover fees",
			"INSUFFICIENT_AMOUNT",
			errors.New("amount after fees would be zero or negative"))
	}

	return fee, nil
}

// WrapTokenActivity wraps a native token into a Universal token
func (a *SwapActivities) WrapTokenActivity(ctx context.Context, request services.SwapRequest) (*services.Transaction, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Wrapping token", "requestID", request.RequestID, "token", request.SourceToken.Symbol)

	// Validate inputs
	if request.Amount == nil || request.Amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	if request.SourceAddress == "" {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid source address",
			"INVALID_ADDRESS",
			errors.New("source address cannot be empty"))
	}

	// Create wrap request
	wrapRequest := universalsdk.WrapRequest{
		SourceToken:   request.SourceToken,
		Amount:        request.Amount,
		SourceAddress: request.SourceAddress,
		RefundAddress: request.RefundAddress,
	}

	// Attempt to wrap the token
	result, err := a.universalSDK.WrapToken(ctx, wrapRequest)
	if err != nil {
		logger.Error("Failed to wrap token", "error", err)
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to wrap token: %v", err),
			"WRAP_FAILED")
	}

	// Create transaction record
	tx := &services.Transaction{
		ID:          uuid.New().String(),
		Type:        "wrap",
		Hash:        result.TransactionHash,
		Status:      result.Status,
		FromAddress: request.SourceAddress,
		ToAddress:   request.SourceAddress, // Same address for wrap
		SourceChain: request.SourceToken.ChainName,
		DestChain:   request.SourceToken.ChainName, // Same chain for wrap
		SourceToken: request.SourceToken,
		DestToken:   result.WrappedToken,
		Amount:      request.Amount,
		Value:       result.Amount, // Amount after fees
		Timestamp:   time.Now(),
		WorkflowID:  activity.GetInfo(ctx).WorkflowExecution.ID,
	}

	// Set default values for fields that the mock doesn't provide
	tx.Gas = big.NewInt(21000)           // Default gas limit
	tx.GasPrice = big.NewInt(2000000000) // 2 Gwei default
	tx.BlockNumber = 0                   // Will be set when confirmed

	return tx, nil
}

// TransferTokenActivity transfers a Universal token across chains
func (a *SwapActivities) TransferTokenActivity(ctx context.Context,
	token services.Token,
	sourceChainID int64,
	destChainID int64,
	amount *big.Int,
	sourceAddress string,
	destAddress string) (*services.Transaction, error) {

	logger := activity.GetLogger(ctx)
	logger.Info("Transferring token across chains",
		"token", token.Symbol,
		"sourceChain", sourceChainID,
		"destChain", destChainID)

	// Validate inputs
	if amount == nil || amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	if sourceAddress == "" || destAddress == "" {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid address",
			"INVALID_ADDRESS",
			errors.New("source and destination addresses cannot be empty"))
	}

	// Ensure token is wrapped
	if !token.IsWrapped {
		return nil, temporal.NewNonRetryableApplicationError(
			"Token is not wrapped",
			"INVALID_TOKEN",
			errors.New("token must be wrapped for cross-chain transfer"))
	}

	// Create transfer request
	transferRequest := universalsdk.TransferRequest{
		WrappedToken:  token,
		SourceChainID: sourceChainID,
		DestChainID:   destChainID,
		Amount:        amount,
		SourceAddress: sourceAddress,
		DestAddress:   destAddress,
	}

	// Attempt to transfer the token
	result, err := a.universalSDK.TransferToken(ctx, transferRequest)
	if err != nil {
		logger.Error("Failed to transfer token", "error", err)
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to transfer token: %v", err),
			"TRANSFER_FAILED")
	}

	// Create transaction record
	tx := &services.Transaction{
		ID:          uuid.New().String(),
		Type:        "transfer",
		Hash:        result.SourceTxHash,
		Status:      result.Status,
		FromAddress: sourceAddress,
		ToAddress:   destAddress,
		SourceChain: token.ChainName,
		DestChain:   fmt.Sprintf("Chain %d", destChainID), // We'll need to get the proper name in a real implementation
		SourceToken: token,
		DestToken:   token, // Same token, different chain
		Amount:      amount,
		Value:       result.Amount, // Amount after fees
		Timestamp:   time.Now(),
		WorkflowID:  activity.GetInfo(ctx).WorkflowExecution.ID,
	}

	// Set default values for fields that the mock doesn't provide
	tx.Gas = big.NewInt(100000)          // Higher gas for cross-chain
	tx.GasPrice = big.NewInt(2000000000) // 2 Gwei default
	tx.BlockNumber = 0                   // Will be set when confirmed

	return tx, nil
}

// SwapTokensActivity swaps one token for another on the same chain
func (a *SwapActivities) SwapTokensActivity(ctx context.Context,
	sourceToken services.Token,
	destToken services.Token,
	amount *big.Int,
	destAddress string,
	slippage float64) (*services.Transaction, error) {

	logger := activity.GetLogger(ctx)
	logger.Info("Swapping tokens",
		"sourceToken", sourceToken.Symbol,
		"destToken", destToken.Symbol,
		"amount", amount.String())

	// Validate inputs
	if amount == nil || amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	if destAddress == "" {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid destination address",
			"INVALID_ADDRESS",
			errors.New("destination address cannot be empty"))
	}

	// In a real implementation, this would call the DEX contract
	// For our mock, we'll simulate a swap with a fixed exchange rate

	// Mock exchange rate calculation (simplified)
	// In reality, this would come from AMM calculations
	exchangeRate := 1.0
	if sourceToken.Symbol == "uETH" && destToken.Symbol == "uUSDC" {
		exchangeRate = 2000.0 // 1 ETH = 2000 USDC
	} else if sourceToken.Symbol == "uUSDC" && destToken.Symbol == "uETH" {
		exchangeRate = 0.0005 // 2000 USDC = 1 ETH
	}

	// Calculate output amount based on exchange rate and token decimals
	// This is a simplified calculation
	sourceDecimals := sourceToken.Decimals
	if sourceDecimals == 0 {
		sourceDecimals = 18 // Default for most tokens
	}

	destDecimals := destToken.Decimals
	if destDecimals == 0 {
		destDecimals = 18 // Default for most tokens
	}

	// Convert to float for calculation
	amountFloat := new(big.Float).SetInt(amount)
	divisor := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(sourceDecimals)), nil))
	amountFloat.Quo(amountFloat, divisor)

	// Apply exchange rate
	outputAmountFloat := new(big.Float).Mul(amountFloat, big.NewFloat(exchangeRate))

	// Convert back to destination token's decimals
	outputMultiplier := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(destDecimals)), nil))
	outputAmountFloat.Mul(outputAmountFloat, outputMultiplier)

	// Apply slippage (reduce output by slippage percentage)
	slippageMultiplier := big.NewFloat(1.0 - slippage/100.0)
	outputAmountFloat.Mul(outputAmountFloat, slippageMultiplier)

	// Convert to big.Int for the final amount
	outputAmountInt, _ := outputAmountFloat.Int(nil)

	// Simulate a 0.3% swap fee
	feePercent := big.NewFloat(0.003)
	feeAmount := new(big.Float).Mul(outputAmountFloat, feePercent)
	feeAmountInt, _ := feeAmount.Int(nil)

	// Subtract fee from output
	outputAmountInt.Sub(outputAmountInt, feeAmountInt)

	// Create transaction record
	tx := &services.Transaction{
		ID:          uuid.New().String(),
		Type:        "swap",
		Hash:        fmt.Sprintf("0x%s", uuid.New().String()[:32]), // Mock hash
		Status:      "completed",
		FromAddress: destAddress, // For swaps, the user is both sender and receiver
		ToAddress:   destAddress,
		SourceChain: sourceToken.ChainName,
		DestChain:   destToken.ChainName,
		SourceToken: sourceToken,
		DestToken:   destToken,
		Amount:      amount,
		Value:       outputAmountInt,
		Timestamp:   time.Now(),
		WorkflowID:  activity.GetInfo(ctx).WorkflowExecution.ID,
	}

	// Set default values
	tx.Gas = big.NewInt(150000)          // Higher gas for swaps
	tx.GasPrice = big.NewInt(2000000000) // 2 Gwei default
	tx.BlockNumber = 0                   // Will be set when confirmed

	return tx, nil
}

// UnwrapTokenActivity unwraps a Universal token back to a native token
func (a *SwapActivities) UnwrapTokenActivity(ctx context.Context,
	wrappedToken services.Token,
	nativeToken services.Token,
	amount *big.Int,
	destAddress string) (*services.Transaction, error) {

	logger := activity.GetLogger(ctx)
	logger.Info("Unwrapping token",
		"wrappedToken", wrappedToken.Symbol,
		"nativeToken", nativeToken.Symbol,
		"amount", amount.String())

	// Validate inputs
	if amount == nil || amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	if destAddress == "" {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid destination address",
			"INVALID_ADDRESS",
			errors.New("destination address cannot be empty"))
	}

	// Ensure token is wrapped
	if !wrappedToken.IsWrapped {
		return nil, temporal.NewNonRetryableApplicationError(
			"Token is not wrapped",
			"INVALID_TOKEN",
			errors.New("source token must be wrapped for unwrapping"))
	}

	// Create unwrap request
	unwrapRequest := universalsdk.UnwrapRequest{
		WrappedToken:       wrappedToken,
		DestinationToken:   nativeToken,
		Amount:             amount,
		DestinationAddress: destAddress,
	}

	// Attempt to unwrap the token
	result, err := a.universalSDK.UnwrapToken(ctx, unwrapRequest)
	if err != nil {
		logger.Error("Failed to unwrap token", "error", err)
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to unwrap token: %v", err),
			"UNWRAP_FAILED")
	}

	// Create transaction record
	tx := &services.Transaction{
		ID:          uuid.New().String(),
		Type:        "unwrap",
		Hash:        result.TransactionHash,
		Status:      result.Status,
		FromAddress: destAddress,
		ToAddress:   destAddress, // Same address for unwrap
		SourceChain: wrappedToken.ChainName,
		DestChain:   nativeToken.ChainName,
		SourceToken: wrappedToken,
		DestToken:   nativeToken,
		Amount:      amount,
		Value:       result.Amount, // Amount after fees
		Timestamp:   time.Now(),
		WorkflowID:  activity.GetInfo(ctx).WorkflowExecution.ID,
	}

	// Set default values for fields that the mock doesn't provide
	tx.Gas = big.NewInt(50000)           // Unwrap generally costs less gas than wrap
	tx.GasPrice = big.NewInt(2000000000) // 2 Gwei default
	tx.BlockNumber = 0                   // Will be set when confirmed

	return tx, nil
}
