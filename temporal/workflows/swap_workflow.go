package temporal_workflows

import (
	"time"

	"github.com/infinity-dex/services/types"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// SwapWorkflow is the workflow definition for processing token swaps
// It orchestrates the following steps:
// 1. Wrap source token to Universal asset if needed
// 2. Transfer Universal asset to destination chain if cross-chain
// 3. Swap Universal asset to destination token if needed
// 4. Unwrap Universal asset to native token if needed
func SwapWorkflow(ctx workflow.Context, request types.SwapRequest) (*types.SwapResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("SwapWorkflow started", "requestID", request.RequestID)

	// Initialize result object
	result := &types.SwapResult{
		RequestID:   request.RequestID,
		Success:     false,
		InputAmount: request.Amount,
	}

	// Define retry policy for activities
	options := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, options)

	// 1. Calculate fee estimate and check if swap is viable
	var feeResult *types.Fee
	err := workflow.ExecuteActivity(ctx, "CalculateFeeActivity", request).Get(ctx, &feeResult)
	if err != nil {
		logger.Error("Failed to calculate fees", "error", err)
		result.ErrorMessage = "Failed to calculate fees: " + err.Error()
		return result, err
	}

	// 2. Check if source token needs to be wrapped
	var sourceWrapped bool
	var wrappedSourceToken types.Token

	if !request.SourceToken.IsWrapped {
		logger.Info("Wrapping source token", "token", request.SourceToken.Symbol)

		var wrapResult *types.Transaction
		err = workflow.ExecuteActivity(ctx, "WrapTokenActivity", request).Get(ctx, &wrapResult)
		if err != nil {
			logger.Error("Failed to wrap source token", "error", err)
			result.ErrorMessage = "Failed to wrap source token: " + err.Error()
			return result, err
		}

		sourceWrapped = true
		result.SourceTx = *wrapResult
		wrappedSourceToken = wrapResult.DestToken
	} else {
		sourceWrapped = false
		wrappedSourceToken = request.SourceToken
	}

	// 3. Transfer token across chains if cross-chain swap
	isCrossChain := request.SourceToken.ChainID != request.DestinationToken.ChainID

	if isCrossChain {
		logger.Info("Executing cross-chain transfer",
			"sourceChain", request.SourceToken.ChainName,
			"destChain", request.DestinationToken.ChainName)

		var transferResult *types.Transaction
		err = workflow.ExecuteActivity(ctx, "TransferTokenActivity",
			wrappedSourceToken,
			request.SourceToken.ChainID,
			request.DestinationToken.ChainID,
			request.Amount,
			request.SourceAddress,
			request.DestinationAddress).Get(ctx, &transferResult)

		if err != nil {
			logger.Error("Failed to transfer token across chains", "error", err)

			// If source was wrapped, we need to try to unwrap it back
			if sourceWrapped {
				var unwrapResult *types.Transaction
				// Best effort unwrap to return funds to user, ignore errors
				_ = workflow.ExecuteActivity(ctx, "UnwrapTokenActivity",
					wrappedSourceToken,
					request.SourceToken,
					result.SourceTx.Value, // Use value from wrap tx
					request.RefundAddress).Get(ctx, &unwrapResult)
			}

			result.ErrorMessage = "Failed to transfer token across chains: " + err.Error()
			return result, err
		}

		result.BridgeTx = *transferResult
	}

	// 4. Swap tokens if needed
	var swapNeeded = wrappedSourceToken.Symbol != request.DestinationToken.Symbol

	if swapNeeded {
		logger.Info("Swapping tokens",
			"sourceToken", wrappedSourceToken.Symbol,
			"destToken", request.DestinationToken.Symbol)

		var swapResult *types.Transaction

		// Determine the amount to use based on whether this is a cross-chain swap
		var amountToSwap = request.Amount
		if isCrossChain {
			amountToSwap = result.BridgeTx.Value
		}

		err = workflow.ExecuteActivity(ctx, "SwapTokensActivity",
			wrappedSourceToken,
			request.DestinationToken,
			amountToSwap, // Use amount from bridge tx if cross-chain
			request.DestinationAddress,
			request.Slippage).Get(ctx, &swapResult)

		if err != nil {
			logger.Error("Failed to swap tokens", "error", err)
			result.ErrorMessage = "Failed to swap tokens: " + err.Error()
			return result, err
		}

		result.DestinationTx = *swapResult
		result.OutputAmount = swapResult.Value
	} else if isCrossChain {
		// No swap needed, but we did a cross-chain transfer
		result.DestinationTx = result.BridgeTx
		result.OutputAmount = result.BridgeTx.Value
	} else {
		// No swap or transfer needed (same token on same chain)
		result.DestinationTx = result.SourceTx
		result.OutputAmount = result.SourceTx.Value
	}

	// 5. Unwrap token if needed
	if request.DestinationToken.IsWrapped == false && result.DestinationTx.DestToken.IsWrapped {
		logger.Info("Unwrapping destination token", "token", result.DestinationTx.DestToken.Symbol)

		var unwrapResult *types.Transaction
		err = workflow.ExecuteActivity(ctx, "UnwrapTokenActivity",
			result.DestinationTx.DestToken,
			request.DestinationToken,
			result.DestinationTx.Value,
			request.DestinationAddress).Get(ctx, &unwrapResult)

		if err != nil {
			logger.Error("Failed to unwrap destination token", "error", err)
			result.ErrorMessage = "Failed to unwrap destination token: " + err.Error()
			return result, err
		}

		// Update destination transaction and output amount
		result.DestinationTx = *unwrapResult
		result.OutputAmount = unwrapResult.Value
	}

	// 6. Mark workflow as successful
	result.Success = true
	result.CompletionTime = time.Now()
	result.Fee = *feeResult

	logger.Info("SwapWorkflow completed successfully",
		"requestID", request.RequestID,
		"inputAmount", request.Amount.String(),
		"outputAmount", result.OutputAmount.String())

	return result, nil
}
