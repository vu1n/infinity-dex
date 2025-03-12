package main

import (
	"context"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/infinity-dex/config"
	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
	"go.uber.org/zap"
)

// MockUniversalSDK is a mock implementation of the Universal SDK for testing
type MockUniversalSDK struct {
	tokens map[int64][]types.Token
}

func (m *MockUniversalSDK) WrapToken(ctx context.Context, req universalsdk.WrapRequest) (*universalsdk.WrapResult, error) {
	return &universalsdk.WrapResult{
		TransactionID:   "mock-tx-id",
		WrappedToken:    req.Token,
		Amount:          req.Amount,
		Fee:             types.Fee{},
		Status:          "completed",
		TransactionHash: "0x1234567890",
	}, nil
}

func (m *MockUniversalSDK) UnwrapToken(ctx context.Context, req universalsdk.UnwrapRequest) (*universalsdk.UnwrapResult, error) {
	return &universalsdk.UnwrapResult{
		TransactionID:   "mock-tx-id",
		NativeToken:     req.DestinationToken,
		Amount:          req.Amount,
		Fee:             types.Fee{},
		Status:          "completed",
		TransactionHash: "0x1234567890",
	}, nil
}

func (m *MockUniversalSDK) TransferToken(ctx context.Context, req universalsdk.TransferRequest) (*universalsdk.TransferResult, error) {
	return &universalsdk.TransferResult{
		TransactionID:             "mock-tx-id",
		SourceTxHash:              "0x1234567890",
		DestTxHash:                "0x0987654321",
		Amount:                    req.Amount,
		Fee:                       types.Fee{},
		Status:                    "completed",
		EstimatedTimeToCompletion: 5 * time.Second,
	}, nil
}

func (m *MockUniversalSDK) GetWrappedTokens(ctx context.Context, chainID int64) ([]types.Token, error) {
	return m.tokens[chainID], nil
}

func (m *MockUniversalSDK) GetFeeEstimate(ctx context.Context, req universalsdk.FeeEstimateRequest) (*types.Fee, error) {
	return &types.Fee{
		GasFee:      big.NewInt(1000000),
		ProtocolFee: big.NewInt(500000),
		NetworkFee:  big.NewInt(200000),
		BridgeFee:   big.NewInt(100000),
		TotalFeeUSD: 0.5,
	}, nil
}

func (m *MockUniversalSDK) GetTransactionStatus(ctx context.Context, transactionID string) (*universalsdk.TransactionStatus, error) {
	return &universalsdk.TransactionStatus{
		TransactionID: transactionID,
		Status:        "completed",
	}, nil
}

// TestGetTokensHandler tests the getTokensHandler function
func TestGetTokensHandler(t *testing.T) {
	// Create mock tokens
	mockTokens := map[int64][]types.Token{
		1: {
			{
				Symbol:    "uETH",
				Name:      "Universal Ethereum",
				Decimals:  18,
				Address:   "0x1111111111111111111111111111111111111111",
				ChainID:   1,
				ChainName: "Ethereum",
				IsWrapped: true,
			},
		},
		137: {
			{
				Symbol:    "uMATIC",
				Name:      "Universal Matic",
				Decimals:  18,
				Address:   "0x5555555555555555555555555555555555555555",
				ChainID:   137,
				ChainName: "Polygon",
				IsWrapped: true,
			},
		},
	}

	// Create mock SDK
	mockSDK := &MockUniversalSDK{
		tokens: mockTokens,
	}

	// Create logger
	logger, _ := zap.NewDevelopment()
	sugar := logger.Sugar()

	// Create config
	cfg := config.Config{
		Chains: map[string]config.ChainConfig{
			"ethereum": {
				ChainID: 1,
			},
			"polygon": {
				ChainID: 137,
			},
		},
	}

	// Create server
	server := &Server{
		config:       cfg,
		logger:       sugar,
		router:       mux.NewRouter(),
		universalSDK: mockSDK,
	}

	// Create request
	req, err := http.NewRequest("GET", "/api/v1/tokens", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create response recorder
	rr := httptest.NewRecorder()

	// Call handler
	server.getTokensHandler(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check response body
	var tokens []types.Token
	err = json.Unmarshal(rr.Body.Bytes(), &tokens)
	if err != nil {
		t.Fatal(err)
	}

	// Verify we got tokens from both chains
	if len(tokens) != 2 {
		t.Errorf("expected 2 tokens, got %d", len(tokens))
	}

	// Verify token types
	for _, token := range tokens {
		// Check that Symbol is a string
		if token.Symbol == "" {
			t.Errorf("token.Symbol is empty")
		}
	}
}

// TestFindToken tests the findToken function
func TestFindToken(t *testing.T) {
	// Create mock tokens
	mockTokens := map[int64][]types.Token{
		1: {
			{
				Symbol:    "uETH",
				Name:      "Universal Ethereum",
				Decimals:  18,
				Address:   "0x1111111111111111111111111111111111111111",
				ChainID:   1,
				ChainName: "Ethereum",
				IsWrapped: true,
			},
		},
	}

	// Create mock SDK
	mockSDK := &MockUniversalSDK{
		tokens: mockTokens,
	}

	// Create logger
	logger, _ := zap.NewDevelopment()
	sugar := logger.Sugar()

	// Create server
	server := &Server{
		logger:       sugar,
		universalSDK: mockSDK,
	}

	// Test finding an existing token
	token, err := server.findToken("uETH", 1)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if token.Symbol != "uETH" {
		t.Errorf("expected token symbol 'uETH', got '%s'", token.Symbol)
	}

	// Test finding a non-existent token
	_, err = server.findToken("nonexistent", 1)
	if err == nil {
		t.Error("expected error, got nil")
	}
}

// TestCreateMockWrappedTokens tests the createMockWrappedTokens function
func TestCreateMockWrappedTokens(t *testing.T) {
	// Create config
	cfg := config.Config{}

	// Call function
	tokens := createMockWrappedTokens(cfg)

	// Verify Ethereum tokens
	ethTokens, ok := tokens[1]
	if !ok {
		t.Fatal("no Ethereum tokens found")
	}
	if len(ethTokens) == 0 {
		t.Fatal("empty Ethereum tokens")
	}

	// Verify token types
	for _, token := range ethTokens {
		// Verify token is of type types.Token
		if _, ok := interface{}(token).(types.Token); !ok {
			t.Errorf("token is not of type types.Token: %T", token)
		}
	}

	// Verify Polygon tokens
	polygonTokens, ok := tokens[137]
	if !ok {
		t.Fatal("no Polygon tokens found")
	}
	if len(polygonTokens) == 0 {
		t.Fatal("empty Polygon tokens")
	}
}
