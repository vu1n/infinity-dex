package temporal_activities

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/infinity-dex/services/types"
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
func (a *SwapActivities) CalculateFeeActivity(ctx context.Context, request types.SwapRequest) (*types.Fee, error) {
	// Log activity start
	activity.GetLogger(ctx).Info("Calculating fee for swap",
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

	// Create fee estimate request
	feeRequest := universalsdk.FeeEstimateRequest{
		SourceToken:      request.SourceToken,
		DestinationToken: request.DestinationToken,
		Amount:           request.Amount,
	}

	// Get fee estimate from Universal SDK
	fee, err := a.universalSDK.GetFeeEstimate(ctx, feeRequest)
	if err != nil {
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to get fee estimate: %v", err),
			"FEE_ESTIMATE_FAILED")
	}

	// Log fee details
	activity.GetLogger(ctx).Info("Fee calculated successfully",
		"gasFee", fee.GasFee.String(),
		"protocolFee", fee.ProtocolFee.String(),
		"networkFee", fee.NetworkFee.String(),
		"totalFeeUSD", fee.TotalFeeUSD,
	)

	return fee, nil
}

// WrapTokenActivity wraps a native token into a Universal token
func (a *SwapActivities) WrapTokenActivity(ctx context.Context, request types.SwapRequest) (*types.Transaction, error) {
	// Log activity start
	activity.GetLogger(ctx).Info("Wrapping token",
		"token", request.SourceToken.Symbol,
		"amount", request.Amount.String(),
		"sourceAddress", request.SourceAddress,
	)

	// Validate request
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
		Token:         request.SourceToken,
		Amount:        request.Amount,
		SourceAddress: request.SourceAddress,
		TargetAddress: request.SourceAddress, // Use source address as target for wrapped tokens
	}

	// Attempt to wrap the token
	result, err := a.universalSDK.WrapToken(ctx, wrapRequest)
	if err != nil {
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to wrap token: %v", err),
			"WRAP_FAILED")
	}

	// Create transaction record
	tx := &types.Transaction{
		ID:          uuid.New().String(),
		Type:        "wrap",
		Hash:        result.TransactionHash,
		Status:      result.Status,
		FromAddress: request.SourceAddress,
		ToAddress:   request.SourceAddress, // Wrapped tokens go back to source address
		SourceChain: request.SourceToken.ChainName,
		DestChain:   request.SourceToken.ChainName, // Same chain for wrapping
		SourceToken: request.SourceToken,
		DestToken:   result.WrappedToken,
		Amount:      request.Amount,
		Value:       result.Amount,
		Gas:         big.NewInt(0), // Will be updated when transaction is mined
		GasPrice:    big.NewInt(0), // Will be updated when transaction is mined
		Timestamp:   time.Now(),
		BlockNumber: 0, // Will be updated when transaction is mined
		WorkflowID:  request.RequestID,
	}

	// Log transaction details
	activity.GetLogger(ctx).Info("Token wrapped successfully",
		"transactionHash", result.TransactionHash,
		"status", result.Status,
	)

	return tx, nil
}

// TransferTokenActivity transfers a Universal token across chains
func (a *SwapActivities) TransferTokenActivity(ctx context.Context,
	token types.Token,
	sourceChainID int64,
	destChainID int64,
	amount *big.Int,
	sourceAddress string,
	destAddress string) (*types.Transaction, error) {

	// Log activity start
	activity.GetLogger(ctx).Info("Transferring token across chains",
		"token", token.Symbol,
		"sourceChainID", sourceChainID,
		"destChainID", destChainID,
		"amount", amount.String(),
	)

	// Validate inputs
	if amount == nil || amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid amount",
			"INVALID_AMOUNT",
			errors.New("amount must be greater than zero"))
	}

	if sourceAddress == "" || destAddress == "" {
		return nil, temporal.NewNonRetryableApplicationError(
			"Invalid addresses",
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
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to transfer token: %v", err),
			"TRANSFER_FAILED")
	}

	// Create transaction record
	tx := &types.Transaction{
		ID:          uuid.New().String(),
		Type:        "transfer",
		Hash:        result.SourceTxHash,
		Status:      result.Status,
		FromAddress: sourceAddress,
		ToAddress:   destAddress,
		SourceChain: token.ChainName,
		DestChain:   getChainNameByID(destChainID),
		SourceToken: token,
		DestToken:   token, // Same token, different chain
		Amount:      amount,
		Value:       amount,
		Gas:         big.NewInt(0), // Will be updated when transaction is mined
		GasPrice:    big.NewInt(0), // Will be updated when transaction is mined
		Timestamp:   time.Now(),
		BlockNumber: 0, // Will be updated when transaction is mined
		WorkflowID:  activity.GetInfo(ctx).WorkflowExecution.ID,
	}

	// Log transaction details
	activity.GetLogger(ctx).Info("Token transferred successfully",
		"sourceTxHash", result.SourceTxHash,
		"destTxHash", result.DestTxHash,
		"status", result.Status,
	)

	return tx, nil
}

// SwapTokensActivity swaps one token for another on the same chain
func (a *SwapActivities) SwapTokensActivity(ctx context.Context,
	sourceToken types.Token,
	destToken types.Token,
	amount *big.Int,
	destAddress string,
	slippage float64) (*types.Transaction, error) {

	// Log activity start
	activity.GetLogger(ctx).Info("Swapping tokens",
		"sourceToken", sourceToken.Symbol,
		"destToken", destToken.Symbol,
		"amount", amount.String(),
	)

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

	// Ensure tokens are on the same chain
	if sourceToken.ChainID != destToken.ChainID {
		return nil, temporal.NewNonRetryableApplicationError(
			"Tokens on different chains",
			"INVALID_TOKENS",
			errors.New("source and destination tokens must be on the same chain"))
	}

	// Mock swap logic (in a real implementation, this would call a DEX)
	// For demo purposes, we'll just simulate a swap with a fixed rate
	outputAmount := big.NewInt(0)
	if sourceToken.Symbol == "uETH" && destToken.Symbol == "uUSDC" {
		// 1 ETH = 2000 USDC (simplified)
		ethValue := new(big.Float).SetInt(amount)
		usdcValue := new(big.Float).Mul(ethValue, big.NewFloat(2000.0))
		outputAmount, _ = usdcValue.Int(nil)
	} else if sourceToken.Symbol == "uUSDC" && destToken.Symbol == "uETH" {
		// 2000 USDC = 1 ETH (simplified)
		usdcValue := new(big.Float).SetInt(amount)
		ethValue := new(big.Float).Quo(usdcValue, big.NewFloat(2000.0))
		outputAmount, _ = ethValue.Int(nil)
	} else {
		// Default 1:1 for demo
		outputAmount = big.NewInt(0).Set(amount)
	}

	// Apply slippage (reduce output by slippage percentage)
	slippageMultiplier := new(big.Float).Sub(big.NewFloat(1.0), big.NewFloat(slippage/100.0))
	outputWithSlippage := new(big.Float).Mul(new(big.Float).SetInt(outputAmount), slippageMultiplier)
	outputAmount, _ = outputWithSlippage.Int(nil)

	// Create transaction record
	tx := &types.Transaction{
		ID:          uuid.New().String(),
		Type:        "swap",
		Hash:        fmt.Sprintf("0x%s", uuid.New().String()[:32]), // Mock hash
		Status:      "completed",
		FromAddress: destAddress, // Use dest address as source for simplicity
		ToAddress:   destAddress,
		SourceChain: sourceToken.ChainName,
		DestChain:   destToken.ChainName,
		SourceToken: sourceToken,
		DestToken:   destToken,
		Amount:      amount,
		Value:       outputAmount,
		Gas:         big.NewInt(150000),
		GasPrice:    big.NewInt(20000000000), // 20 Gwei
		Timestamp:   time.Now(),
		BlockNumber: 12345678, // Mock block number
		WorkflowID:  activity.GetInfo(ctx).WorkflowExecution.ID,
	}

	// Log transaction details
	activity.GetLogger(ctx).Info("Tokens swapped successfully",
		"inputAmount", amount.String(),
		"outputAmount", outputAmount.String(),
		"txHash", tx.Hash,
	)

	return tx, nil
}

// UnwrapTokenActivity unwraps a Universal token back to a native token
func (a *SwapActivities) UnwrapTokenActivity(ctx context.Context,
	wrappedToken types.Token,
	nativeToken types.Token,
	amount *big.Int,
	destAddress string) (*types.Transaction, error) {

	// Log activity start
	activity.GetLogger(ctx).Info("Unwrapping token",
		"wrappedToken", wrappedToken.Symbol,
		"nativeToken", nativeToken.Symbol,
		"amount", amount.String(),
	)

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
		return nil, temporal.NewApplicationError(
			fmt.Sprintf("Failed to unwrap token: %v", err),
			"UNWRAP_FAILED")
	}

	// Create transaction record
	tx := &types.Transaction{
		ID:          uuid.New().String(),
		Type:        "unwrap",
		Hash:        result.TransactionHash,
		Status:      result.Status,
		FromAddress: destAddress, // Use dest address as source for simplicity
		ToAddress:   destAddress,
		SourceChain: wrappedToken.ChainName,
		DestChain:   nativeToken.ChainName,
		SourceToken: wrappedToken,
		DestToken:   nativeToken,
		Amount:      amount,
		Value:       result.Amount,
		Gas:         big.NewInt(100000),
		GasPrice:    big.NewInt(20000000000), // 20 Gwei
		Timestamp:   time.Now(),
		BlockNumber: 0, // Will be updated when transaction is mined
		WorkflowID:  activity.GetInfo(ctx).WorkflowExecution.ID,
	}

	// Log transaction details
	activity.GetLogger(ctx).Info("Token unwrapped successfully",
		"transactionHash", result.TransactionHash,
		"status", result.Status,
	)

	return tx, nil
}

// Helper function to get chain name by ID
func getChainNameByID(chainID int64) string {
	switch chainID {
	case 1:
		return "Ethereum"
	case 137:
		return "Polygon"
	case 56:
		return "BSC"
	case 43114:
		return "Avalanche"
	default:
		return fmt.Sprintf("Chain-%d", chainID)
	}
}
