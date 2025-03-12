package services

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
)

// MockUniversalSDK is a mock implementation of the universalsdk.SDK interface for testing
type MockUniversalSDK struct{}

func (m *MockUniversalSDK) WrapToken(ctx context.Context, req universalsdk.WrapRequest) (*universalsdk.WrapResult, error) {
	return nil, nil
}

func (m *MockUniversalSDK) UnwrapToken(ctx context.Context, req universalsdk.UnwrapRequest) (*universalsdk.UnwrapResult, error) {
	return nil, nil
}

func (m *MockUniversalSDK) TransferToken(ctx context.Context, req universalsdk.TransferRequest) (*universalsdk.TransferResult, error) {
	return nil, nil
}

func (m *MockUniversalSDK) GetWrappedTokens(ctx context.Context, chainID int64) ([]types.Token, error) {
	return nil, nil
}

func (m *MockUniversalSDK) GetFeeEstimate(ctx context.Context, req universalsdk.FeeEstimateRequest) (*types.Fee, error) {
	// Return a mock fee
	return &types.Fee{
		GasFee:      big.NewInt(1000000000000000), // 0.001 ETH
		ProtocolFee: big.NewInt(500000000000000),  // 0.0005 ETH
		NetworkFee:  big.NewInt(200000000000000),  // 0.0002 ETH
		BridgeFee:   big.NewInt(0),
		TotalFeeUSD: 2.5,
	}, nil
}

func (m *MockUniversalSDK) GetTransactionStatus(ctx context.Context, transactionID string) (*universalsdk.TransactionStatus, error) {
	return nil, nil
}

func TestSwapService(t *testing.T) {
	// Create dependencies
	tokenService := NewTokenService()
	transactionService := NewTransactionService()
	mockSDK := &MockUniversalSDK{}

	// Create swap service
	service := NewSwapService(tokenService, transactionService, mockSDK)
	if service == nil {
		t.Fatal("Failed to create swap service")
	}

	// Create test tokens
	ethToken := types.Token{
		Symbol:    "ETH",
		Name:      "Ethereum",
		Decimals:  18,
		Address:   "0x0000000000000000000000000000000000000000",
		ChainID:   1,
		ChainName: "Ethereum",
		LogoURI:   "https://ethereum.org/eth-logo.svg",
		IsWrapped: false,
	}

	usdcToken := types.Token{
		Symbol:    "USDC",
		Name:      "USD Coin",
		Decimals:  6,
		Address:   "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
		ChainID:   1,
		ChainName: "Ethereum",
		LogoURI:   "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
		IsWrapped: false,
	}

	// Add tokens to token service
	tokenService.AddToken(ethToken)
	tokenService.AddToken(usdcToken)

	// Create swap request
	amount := big.NewInt(1000000000000000000) // 1 ETH
	deadline := time.Now().Add(15 * time.Minute)
	request := types.SwapRequest{
		SourceToken:        ethToken,
		DestinationToken:   usdcToken,
		Amount:             amount,
		SourceAddress:      "0x1234567890abcdef1234567890abcdef12345678",
		DestinationAddress: "0x9876543210abcdef1234567890abcdef12345678",
		Slippage:           0.5,
		Deadline:           deadline,
		RefundAddress:      "0x1234567890abcdef1234567890abcdef12345678",
		RequestID:          "req-123",
	}

	// Test GetSwapQuote
	t.Run("GetSwapQuote", func(t *testing.T) {
		ctx := context.Background()
		quote, err := service.GetSwapQuote(ctx, request)
		if err != nil {
			t.Errorf("Failed to get swap quote: %v", err)
		}
		if quote == nil {
			t.Fatal("Expected quote to be non-nil, got nil")
		}
		if quote.SourceToken.Symbol != "ETH" {
			t.Errorf("Expected SourceToken.Symbol to be 'ETH', got '%s'", quote.SourceToken.Symbol)
		}
		if quote.DestinationToken.Symbol != "USDC" {
			t.Errorf("Expected DestinationToken.Symbol to be 'USDC', got '%s'", quote.DestinationToken.Symbol)
		}
		if quote.InputAmount.Cmp(amount) != 0 {
			t.Errorf("Expected InputAmount to be %s, got %s", amount.String(), quote.InputAmount.String())
		}
		if quote.OutputAmount == nil {
			t.Error("Expected OutputAmount to be non-nil, got nil")
		}
		if quote.Fee.GasFee.Cmp(big.NewInt(1000000000000000)) != 0 {
			t.Errorf("Expected Fee.GasFee to be 1000000000000000, got %s", quote.Fee.GasFee.String())
		}
		if len(quote.Path) != 2 {
			t.Errorf("Expected Path to have 2 elements, got %d", len(quote.Path))
		}
		if quote.Path[0] != "ETH" {
			t.Errorf("Expected Path[0] to be 'ETH', got '%s'", quote.Path[0])
		}
		if quote.Path[1] != "USDC" {
			t.Errorf("Expected Path[1] to be 'USDC', got '%s'", quote.Path[1])
		}
	})

	// Test ExecuteSwap
	t.Run("ExecuteSwap", func(t *testing.T) {
		ctx := context.Background()
		requestID, err := service.ExecuteSwap(ctx, request)
		if err != nil {
			t.Errorf("Failed to execute swap: %v", err)
		}
		if requestID != "req-123" {
			t.Errorf("Expected requestID to be 'req-123', got '%s'", requestID)
		}

		// Verify transactions were created
		txs, err := transactionService.GetTransactionsByWorkflowID(ctx, requestID)
		if err != nil {
			t.Errorf("Failed to get transactions by workflow ID: %v", err)
		}
		if len(txs) != 2 {
			t.Errorf("Expected 2 transactions, got %d", len(txs))
		}

		// Verify source transaction
		var sourceTx *types.Transaction
		var destTx *types.Transaction
		for i, tx := range txs {
			if tx.Type == "swap_source" {
				sourceTx = &txs[i]
			} else if tx.Type == "swap_dest" {
				destTx = &txs[i]
			}
		}
		if sourceTx == nil {
			t.Fatal("Expected source transaction to be non-nil, got nil")
		}
		if sourceTx.SourceToken.Symbol != "ETH" {
			t.Errorf("Expected SourceToken.Symbol to be 'ETH', got '%s'", sourceTx.SourceToken.Symbol)
		}
		if sourceTx.Amount.Cmp(amount) != 0 {
			t.Errorf("Expected Amount to be %s, got %s", amount.String(), sourceTx.Amount.String())
		}
		if sourceTx.FromAddress != "0x1234567890abcdef1234567890abcdef12345678" {
			t.Errorf("Expected FromAddress to be '0x1234567890abcdef1234567890abcdef12345678', got '%s'", sourceTx.FromAddress)
		}
		if sourceTx.Status != "pending" {
			t.Errorf("Expected Status to be 'pending', got '%s'", sourceTx.Status)
		}

		// Verify destination transaction
		if destTx == nil {
			t.Fatal("Expected destination transaction to be non-nil, got nil")
		}
		if destTx.DestToken.Symbol != "USDC" {
			t.Errorf("Expected DestToken.Symbol to be 'USDC', got '%s'", destTx.DestToken.Symbol)
		}
		if destTx.ToAddress != "0x9876543210abcdef1234567890abcdef12345678" {
			t.Errorf("Expected ToAddress to be '0x9876543210abcdef1234567890abcdef12345678', got '%s'", destTx.ToAddress)
		}
		if destTx.Status != "pending" {
			t.Errorf("Expected Status to be 'pending', got '%s'", destTx.Status)
		}
	})

	// Test GetSwapStatus
	t.Run("GetSwapStatus", func(t *testing.T) {
		ctx := context.Background()
		result, err := service.GetSwapStatus(ctx, "req-123")
		if err != nil {
			t.Errorf("Failed to get swap status: %v", err)
		}
		if result == nil {
			t.Fatal("Expected result to be non-nil, got nil")
		}
		if result.RequestID != "req-123" {
			t.Errorf("Expected RequestID to be 'req-123', got '%s'", result.RequestID)
		}
		if result.Success {
			t.Error("Expected Success to be false, got true")
		}
		if result.SourceTx.Type != "swap_source" {
			t.Errorf("Expected SourceTx.Type to be 'swap_source', got '%s'", result.SourceTx.Type)
		}
		if result.DestinationTx.Type != "swap_dest" {
			t.Errorf("Expected DestinationTx.Type to be 'swap_dest', got '%s'", result.DestinationTx.Type)
		}
		if result.InputAmount.Cmp(amount) != 0 {
			t.Errorf("Expected InputAmount to be %s, got %s", amount.String(), result.InputAmount.String())
		}
		if result.OutputAmount == nil {
			t.Error("Expected OutputAmount to be non-nil, got nil")
		}
		if result.Fee.GasFee == nil {
			t.Error("Expected Fee.GasFee to be non-nil, got nil")
		}
		if result.Fee.ProtocolFee == nil {
			t.Error("Expected Fee.ProtocolFee to be non-nil, got nil")
		}
	})

	// Test CancelSwap
	t.Run("CancelSwap", func(t *testing.T) {
		ctx := context.Background()
		err := service.CancelSwap(ctx, "req-123")
		if err != nil {
			t.Errorf("Failed to cancel swap: %v", err)
		}

		// Verify transactions were updated
		txs, err := transactionService.GetTransactionsByWorkflowID(ctx, "req-123")
		if err != nil {
			t.Errorf("Failed to get transactions by workflow ID: %v", err)
		}
		for _, tx := range txs {
			if tx.Status != "cancelled" {
				t.Errorf("Expected Status to be 'cancelled', got '%s'", tx.Status)
			}
		}

		// Try to cancel a non-existent swap
		err = service.CancelSwap(ctx, "req-456")
		if err == nil {
			t.Error("Expected error when cancelling non-existent swap, got nil")
		}
	})
}
