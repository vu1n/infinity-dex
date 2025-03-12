package workflows

import (
	"errors"
	"math/big"
	"testing"
	"time"

	"github.com/infinity-dex/activities"
	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/testsuite"
)

// TestSwapWorkflow_Success tests the successful path of the swap workflow
func TestSwapWorkflow_Success(t *testing.T) {
	testSuite := &testsuite.WorkflowTestSuite{}
	env := testSuite.NewTestWorkflowEnvironment()

	// Create mock SDK and register activities
	mockSDK := universalsdk.NewMockSDK(universalsdk.MockSDKConfig{
		WrappedTokens: make(map[int64][]types.Token),
		Latency:       0, // No latency for tests
		FailureRate:   0, // No failures for happy path test
	})
	swapActivities := activities.NewSwapActivities(mockSDK)

	// Register all activities
	env.RegisterActivity(swapActivities.CalculateFeeActivity)
	env.RegisterActivity(swapActivities.WrapTokenActivity)
	env.RegisterActivity(swapActivities.TransferTokenActivity)
	env.RegisterActivity(swapActivities.SwapTokensActivity)
	env.RegisterActivity(swapActivities.UnwrapTokenActivity)

	// Source token is not wrapped, so should call wrap activity
	sourceToken := types.Token{
		Symbol:    "ETH",
		Name:      "Ethereum",
		Decimals:  18,
		ChainID:   1,
		ChainName: "Ethereum",
		IsWrapped: false,
	}

	wrappedSourceToken := types.Token{
		Symbol:    "uETH",
		Name:      "Universal Ethereum",
		Decimals:  18,
		ChainID:   1,
		ChainName: "Ethereum",
		IsWrapped: true,
	}

	destToken := types.Token{
		Symbol:    "USDC",
		Name:      "USD Coin",
		Decimals:  6,
		ChainID:   137, // Different chain ID to test cross-chain
		ChainName: "Polygon",
		IsWrapped: false,
	}

	wrappedDestToken := types.Token{
		Symbol:    "uUSDC",
		Name:      "Universal USD Coin",
		Decimals:  6,
		ChainID:   137,
		ChainName: "Polygon",
		IsWrapped: true,
	}

	// Create test request
	request := types.SwapRequest{
		SourceToken:        sourceToken,
		DestinationToken:   destToken,
		Amount:             big.NewInt(1000000000000000000), // 1 ETH
		SourceAddress:      "0xuser1",
		DestinationAddress: "0xuser1",
		Slippage:           0.5,
		Deadline:           time.Now().Add(5 * time.Minute),
		RequestID:          "test-workflow-1",
	}

	// Define the transactions that will be returned by the mocked activities
	sourceTx := types.Transaction{
		ID:          "tx-wrap-1",
		Type:        "wrap",
		Hash:        "0xwrap1",
		Status:      "completed",
		FromAddress: request.SourceAddress,
		ToAddress:   request.SourceAddress,
		SourceChain: sourceToken.ChainName,
		DestChain:   sourceToken.ChainName,
		SourceToken: sourceToken,
		DestToken:   wrappedSourceToken,
		Amount:      request.Amount,
		Value:       big.NewInt(990000000000000000), // 0.99 ETH after fees
		Timestamp:   time.Now(),
	}

	bridgeTx := types.Transaction{
		ID:          "tx-bridge-1",
		Type:        "transfer",
		Hash:        "0xbridge1",
		Status:      "completed",
		FromAddress: request.SourceAddress,
		ToAddress:   request.DestinationAddress,
		SourceChain: sourceToken.ChainName,
		DestChain:   destToken.ChainName,
		SourceToken: wrappedSourceToken,
		DestToken:   wrappedSourceToken, // Same token, different chain
		Amount:      sourceTx.Value,
		Value:       big.NewInt(980000000000000000), // 0.98 ETH after more fees
		Timestamp:   time.Now(),
	}

	swapTx := types.Transaction{
		ID:          "tx-swap-1",
		Type:        "swap",
		Hash:        "0xswap1",
		Status:      "completed",
		FromAddress: request.DestinationAddress,
		ToAddress:   request.DestinationAddress,
		SourceChain: destToken.ChainName,
		DestChain:   destToken.ChainName,
		SourceToken: wrappedSourceToken,
		DestToken:   wrappedDestToken,
		Amount:      bridgeTx.Value,
		Value:       big.NewInt(1960000000), // ~1960 USDC (at roughly $2000/ETH)
		Timestamp:   time.Now(),
	}

	unwrapTx := types.Transaction{
		ID:          "tx-unwrap-1",
		Type:        "unwrap",
		Hash:        "0xunwrap1",
		Status:      "completed",
		FromAddress: request.DestinationAddress,
		ToAddress:   request.DestinationAddress,
		SourceChain: destToken.ChainName,
		DestChain:   destToken.ChainName,
		SourceToken: wrappedDestToken,
		DestToken:   destToken,
		Amount:      swapTx.Value,
		Value:       big.NewInt(1950000000), // ~1950 USDC after fees
		Timestamp:   time.Now(),
	}

	// Mock activities by name (the way the workflow calls them)
	env.OnActivity(swapActivities.CalculateFeeActivity, mock.Anything, mock.Anything).Return(&types.Fee{
		GasFee:      big.NewInt(1000000000000000),
		ProtocolFee: big.NewInt(500000000000000),
		NetworkFee:  big.NewInt(200000000000000),
		BridgeFee:   big.NewInt(0),
		TotalFeeUSD: 2.5,
	}, nil)

	env.OnActivity(swapActivities.WrapTokenActivity, mock.Anything, mock.Anything).Return(&sourceTx, nil)
	env.OnActivity(swapActivities.TransferTokenActivity, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&bridgeTx, nil)
	env.OnActivity(swapActivities.SwapTokensActivity, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&swapTx, nil)
	env.OnActivity(swapActivities.UnwrapTokenActivity, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&unwrapTx, nil)

	// Execute workflow
	env.ExecuteWorkflow(SwapWorkflow, request)

	require.True(t, env.IsWorkflowCompleted())
	require.NoError(t, env.GetWorkflowError())

	// Get and verify result
	var result types.SwapResult
	require.NoError(t, env.GetWorkflowResult(&result))

	require.True(t, result.Success)
	require.Equal(t, request.RequestID, result.RequestID)
	require.Equal(t, request.Amount, result.InputAmount)
	require.Equal(t, unwrapTx.Value, result.OutputAmount)

	// Compare only important fields of transactions, not timestamps which can differ
	require.Equal(t, sourceTx.ID, result.SourceTx.ID)
	require.Equal(t, sourceTx.Type, result.SourceTx.Type)
	require.Equal(t, sourceTx.Hash, result.SourceTx.Hash)
	require.Equal(t, sourceTx.Status, result.SourceTx.Status)
	require.Equal(t, sourceTx.Amount, result.SourceTx.Amount)
	require.Equal(t, sourceTx.Value, result.SourceTx.Value)

	require.Equal(t, bridgeTx.ID, result.BridgeTx.ID)
	require.Equal(t, bridgeTx.Hash, result.BridgeTx.Hash)

	require.Equal(t, unwrapTx.ID, result.DestinationTx.ID)
	require.Equal(t, unwrapTx.Hash, result.DestinationTx.Hash)
}

// TestSwapWorkflow_ErrorHandling tests how the workflow handles activity errors
func TestSwapWorkflow_ErrorHandling(t *testing.T) {
	testSuite := &testsuite.WorkflowTestSuite{}
	env := testSuite.NewTestWorkflowEnvironment()

	// Create mock SDK and register activities
	mockSDK := universalsdk.NewMockSDK(universalsdk.MockSDKConfig{
		WrappedTokens: make(map[int64][]types.Token),
		Latency:       0,
		FailureRate:   0,
	})
	swapActivities := activities.NewSwapActivities(mockSDK)

	// Register all activities
	env.RegisterActivity(swapActivities.CalculateFeeActivity)
	env.RegisterActivity(swapActivities.WrapTokenActivity)
	env.RegisterActivity(swapActivities.TransferTokenActivity)
	env.RegisterActivity(swapActivities.SwapTokensActivity)
	env.RegisterActivity(swapActivities.UnwrapTokenActivity)

	// Create test request
	request := types.SwapRequest{
		SourceToken: types.Token{
			Symbol:    "ETH",
			Name:      "Ethereum",
			Decimals:  18,
			ChainID:   1,
			ChainName: "Ethereum",
			IsWrapped: false,
		},
		DestinationToken: types.Token{
			Symbol:    "USDC",
			Name:      "USD Coin",
			Decimals:  6,
			ChainID:   137,
			ChainName: "Polygon",
			IsWrapped: false,
		},
		Amount:             big.NewInt(1000000000000000000), // 1 ETH
		SourceAddress:      "0xuser1",
		DestinationAddress: "0xuser1",
		Slippage:           0.5,
		Deadline:           time.Now().Add(5 * time.Minute),
		RequestID:          "test-workflow-error-1",
	}

	// Simulate an error in the initial fee calculation
	feeError := temporal.NewApplicationError("Fee calculation failed", "FEE_ERROR", errors.New("fee calculation service unavailable"))
	env.OnActivity("CalculateFeeActivity", mock.Anything, mock.Anything).Return(nil, feeError)

	// Register the other activities to avoid "not registered" errors
	env.OnActivity("WrapTokenActivity", mock.Anything, mock.Anything).Return(nil, nil)
	env.OnActivity("TransferTokenActivity", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)
	env.OnActivity("SwapTokensActivity", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)
	env.OnActivity("UnwrapTokenActivity", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

	// Execute workflow
	env.ExecuteWorkflow(SwapWorkflow, request)

	require.True(t, env.IsWorkflowCompleted())

	// Verify workflow errors out with the expected message
	err := env.GetWorkflowError()
	require.Error(t, err)
	require.Contains(t, err.Error(), "Fee calculation failed")

	// Ensure other activities were not called
	env.AssertNotCalled(t, "WrapTokenActivity", mock.Anything, mock.Anything)
	env.AssertNotCalled(t, "TransferTokenActivity", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	env.AssertNotCalled(t, "SwapTokensActivity", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	env.AssertNotCalled(t, "UnwrapTokenActivity", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

// Additional tests can be added for different failure scenarios at each step:
// - TestSwapWorkflow_WrapError
// - TestSwapWorkflow_TransferError
// - TestSwapWorkflow_SwapError
// - TestSwapWorkflow_UnwrapError
