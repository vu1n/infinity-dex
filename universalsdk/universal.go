package universalsdk

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/infinity-dex/services"
)

// SDK defines the interface for interaction with Universal.xyz
type SDK interface {
	// WrapToken wraps a native token into a Universal token
	WrapToken(ctx context.Context, req WrapRequest) (*WrapResult, error)

	// UnwrapToken unwraps a Universal token back to a native token
	UnwrapToken(ctx context.Context, req UnwrapRequest) (*UnwrapResult, error)

	// TransferToken transfers a Universal token across chains
	TransferToken(ctx context.Context, req TransferRequest) (*TransferResult, error)

	// GetWrappedTokens returns the list of available wrapped tokens
	GetWrappedTokens(ctx context.Context, chainID int64) ([]services.Token, error)

	// GetFeeEstimate returns an estimate of the fees for a swap operation
	GetFeeEstimate(ctx context.Context, req FeeEstimateRequest) (*services.Fee, error)

	// GetTransactionStatus returns the status of a transaction
	GetTransactionStatus(ctx context.Context, transactionID string) (*TransactionStatus, error)
}

// WrapRequest represents a request to wrap a native token
type WrapRequest struct {
	SourceToken   services.Token `json:"sourceToken"`
	Amount        *big.Int       `json:"amount"`
	SourceAddress string         `json:"sourceAddress"`
	RefundAddress string         `json:"refundAddress,omitempty"`
}

// WrapResult represents the result of a wrap operation
type WrapResult struct {
	TransactionID   string         `json:"transactionId"`
	WrappedToken    services.Token `json:"wrappedToken"`
	Amount          *big.Int       `json:"amount"`
	Fee             services.Fee   `json:"fee"`
	Status          string         `json:"status"`
	TransactionHash string         `json:"transactionHash"`
}

// UnwrapRequest represents a request to unwrap a Universal token
type UnwrapRequest struct {
	WrappedToken       services.Token `json:"wrappedToken"`
	DestinationToken   services.Token `json:"destinationToken"`
	Amount             *big.Int       `json:"amount"`
	DestinationAddress string         `json:"destinationAddress"`
	RefundAddress      string         `json:"refundAddress,omitempty"`
}

// UnwrapResult represents the result of an unwrap operation
type UnwrapResult struct {
	TransactionID   string         `json:"transactionId"`
	NativeToken     services.Token `json:"nativeToken"`
	Amount          *big.Int       `json:"amount"`
	Fee             services.Fee   `json:"fee"`
	Status          string         `json:"status"`
	TransactionHash string         `json:"transactionHash"`
}

// TransferRequest represents a request to transfer a Universal token across chains
type TransferRequest struct {
	WrappedToken  services.Token `json:"wrappedToken"`
	SourceChainID int64          `json:"sourceChainId"`
	DestChainID   int64          `json:"destChainId"`
	Amount        *big.Int       `json:"amount"`
	SourceAddress string         `json:"sourceAddress"`
	DestAddress   string         `json:"destAddress"`
	RefundAddress string         `json:"refundAddress,omitempty"`
}

// TransferResult represents the result of a transfer operation
type TransferResult struct {
	TransactionID             string        `json:"transactionId"`
	SourceTxHash              string        `json:"sourceTxHash"`
	DestTxHash                string        `json:"destTxHash,omitempty"`
	Amount                    *big.Int      `json:"amount"`
	Fee                       services.Fee  `json:"fee"`
	Status                    string        `json:"status"`
	EstimatedTimeToCompletion time.Duration `json:"estimatedTimeToCompletion"`
}

// FeeEstimateRequest represents a request for fee estimation
type FeeEstimateRequest struct {
	SourceToken      services.Token `json:"sourceToken"`
	DestinationToken services.Token `json:"destinationToken"`
	Amount           *big.Int       `json:"amount"`
}

// TransactionStatus represents the status of a transaction
type TransactionStatus struct {
	TransactionID  string    `json:"transactionId"`
	Status         string    `json:"status"` // pending, completed, failed
	SourceTxHash   string    `json:"sourceTxHash"`
	DestTxHash     string    `json:"destTxHash,omitempty"`
	BridgeTxHash   string    `json:"bridgeTxHash,omitempty"`
	CompletionTime time.Time `json:"completionTime,omitempty"`
	ErrorMessage   string    `json:"errorMessage,omitempty"`
}

// MockUniversalSDK provides a mock implementation of the SDK interface for testing
type MockUniversalSDK struct {
	// Configuration
	config MockSDKConfig
}

// MockSDKConfig holds configuration for the mock SDK
type MockSDKConfig struct {
	WrappedTokens map[int64][]services.Token
	Latency       time.Duration
	FailureRate   float64 // 0.0 to 1.0, probability of transaction failure
}

// NewMockSDK creates a new mock Universal SDK for testing
func NewMockSDK(config MockSDKConfig) SDK {
	return &MockUniversalSDK{
		config: config,
	}
}

// WrapToken implements the SDK interface for mocking token wrapping
func (m *MockUniversalSDK) WrapToken(ctx context.Context, req WrapRequest) (*WrapResult, error) {
	// Simulate network latency
	time.Sleep(m.config.Latency)

	// Simulate potential failures
	if rand.Float64() < m.config.FailureRate {
		return nil, errors.New("wrap transaction failed: network error")
	}

	// Mock successful wrap
	txID := uuid.New().String()
	txHash := fmt.Sprintf("0x%s", uuid.New().String()[:32])

	// Create a wrapped token based on the source token
	wrappedToken := req.SourceToken
	wrappedToken.Symbol = "u" + req.SourceToken.Symbol
	wrappedToken.Name = "Universal " + req.SourceToken.Name
	wrappedToken.IsWrapped = true

	// Mock fee calculation
	fee := services.Fee{
		GasFee:      big.NewInt(1000000000000000),
		ProtocolFee: big.NewInt(500000000000000),
		NetworkFee:  big.NewInt(200000000000000),
		BridgeFee:   big.NewInt(0),
		TotalFeeUSD: 2.5,
	}

	// Calculate amount after fees
	amount := new(big.Int).Set(req.Amount)
	amount.Sub(amount, new(big.Int).Add(fee.GasFee, fee.ProtocolFee))
	if amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, errors.New("amount too small to cover fees")
	}

	return &WrapResult{
		TransactionID:   txID,
		WrappedToken:    wrappedToken,
		Amount:          amount,
		Fee:             fee,
		Status:          "completed",
		TransactionHash: txHash,
	}, nil
}

// UnwrapToken implements the SDK interface for mocking token unwrapping
func (m *MockUniversalSDK) UnwrapToken(ctx context.Context, req UnwrapRequest) (*UnwrapResult, error) {
	// Simulate network latency
	time.Sleep(m.config.Latency)

	// Simulate potential failures
	if rand.Float64() < m.config.FailureRate {
		return nil, errors.New("unwrap transaction failed: network error")
	}

	// Mock successful unwrap
	txID := uuid.New().String()
	txHash := fmt.Sprintf("0x%s", uuid.New().String()[:32])

	// Mock fee calculation
	fee := services.Fee{
		GasFee:      big.NewInt(1200000000000000),
		ProtocolFee: big.NewInt(600000000000000),
		NetworkFee:  big.NewInt(300000000000000),
		BridgeFee:   big.NewInt(0),
		TotalFeeUSD: 3.0,
	}

	// Calculate amount after fees
	amount := new(big.Int).Set(req.Amount)
	amount.Sub(amount, new(big.Int).Add(fee.GasFee, fee.ProtocolFee))
	if amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, errors.New("amount too small to cover fees")
	}

	return &UnwrapResult{
		TransactionID:   txID,
		NativeToken:     req.DestinationToken,
		Amount:          amount,
		Fee:             fee,
		Status:          "completed",
		TransactionHash: txHash,
	}, nil
}

// TransferToken implements the SDK interface for mocking cross-chain token transfers
func (m *MockUniversalSDK) TransferToken(ctx context.Context, req TransferRequest) (*TransferResult, error) {
	// Simulate network latency
	time.Sleep(m.config.Latency)

	// Simulate potential failures
	if rand.Float64() < m.config.FailureRate {
		return nil, errors.New("transfer transaction failed: network error")
	}

	// Mock successful transfer
	txID := uuid.New().String()
	sourceTxHash := fmt.Sprintf("0x%s", uuid.New().String()[:32])

	// Dest tx might not be available immediately
	var destTxHash string
	if rand.Float64() > 0.3 {
		destTxHash = fmt.Sprintf("0x%s", uuid.New().String()[:32])
	}

	// Mock fee calculation
	fee := services.Fee{
		GasFee:      big.NewInt(1500000000000000),
		ProtocolFee: big.NewInt(750000000000000),
		NetworkFee:  big.NewInt(350000000000000),
		BridgeFee:   big.NewInt(2000000000000000),
		TotalFeeUSD: 6.5,
	}

	// Calculate amount after fees
	amount := new(big.Int).Set(req.Amount)
	amount.Sub(amount, new(big.Int).Add(
		new(big.Int).Add(fee.GasFee, fee.ProtocolFee),
		new(big.Int).Add(fee.NetworkFee, fee.BridgeFee),
	))
	if amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, errors.New("amount too small to cover fees")
	}

	// Estimate completion time based on chains
	estimatedTime := 15 * time.Second
	if req.DestChainID == 1 { // If Ethereum is involved, it takes longer
		estimatedTime = 30 * time.Second
	}

	return &TransferResult{
		TransactionID:             txID,
		SourceTxHash:              sourceTxHash,
		DestTxHash:                destTxHash,
		Amount:                    amount,
		Fee:                       fee,
		Status:                    "pending",
		EstimatedTimeToCompletion: estimatedTime,
	}, nil
}

// GetWrappedTokens implements the SDK interface for retrieving supported wrapped tokens
func (m *MockUniversalSDK) GetWrappedTokens(ctx context.Context, chainID int64) ([]services.Token, error) {
	// Simulate network latency
	time.Sleep(m.config.Latency / 2) // Faster lookup operation

	tokens, exists := m.config.WrappedTokens[chainID]
	if !exists {
		return nil, fmt.Errorf("chain ID %d not supported", chainID)
	}

	return tokens, nil
}

// GetFeeEstimate implements the SDK interface for fee estimation
func (m *MockUniversalSDK) GetFeeEstimate(ctx context.Context, req FeeEstimateRequest) (*services.Fee, error) {
	// Simulate network latency
	time.Sleep(m.config.Latency / 2) // Faster lookup operation

	// Check if tokens are on different chains
	isCrossChain := req.SourceToken.ChainID != req.DestinationToken.ChainID

	// Base fees
	gasFee := big.NewInt(1000000000000000)     // 0.001 ETH equivalent
	protocolFee := big.NewInt(500000000000000) // 0.0005 ETH equivalent
	networkFee := big.NewInt(200000000000000)  // 0.0002 ETH equivalent
	bridgeFee := big.NewInt(0)

	// Add bridge fee for cross-chain transactions
	if isCrossChain {
		bridgeFee = big.NewInt(2000000000000000) // 0.002 ETH equivalent
	}

	// Scale fees based on amount (simplified)
	amount := req.Amount
	if amount.Cmp(big.NewInt(1000000000000000000)) > 0 { // If > 1 ETH equivalent
		factor := new(big.Int).Div(amount, big.NewInt(1000000000000000000))
		gasFee.Mul(gasFee, new(big.Int).Add(factor, big.NewInt(1)))
		protocolFee.Mul(protocolFee, new(big.Int).Add(factor, big.NewInt(1)))
	}

	// Calculate total USD fee (simplified conversion)
	totalFeeUSD := 0.0
	totalFeeWei := new(big.Int).Add(
		new(big.Int).Add(gasFee, protocolFee),
		new(big.Int).Add(networkFee, bridgeFee),
	)

	// Simplified conversion: 1 ETH = $2000
	ethToUSD := 2000.0
	totalFeeETH := new(big.Float).Quo(
		new(big.Float).SetInt(totalFeeWei),
		new(big.Float).SetInt(big.NewInt(1000000000000000000)),
	)
	totalFeeETHFloat, _ := totalFeeETH.Float64()
	totalFeeUSD = totalFeeETHFloat * ethToUSD

	return &services.Fee{
		GasFee:      gasFee,
		ProtocolFee: protocolFee,
		NetworkFee:  networkFee,
		BridgeFee:   bridgeFee,
		TotalFeeUSD: totalFeeUSD,
	}, nil
}

// GetTransactionStatus implements the SDK interface for checking transaction status
func (m *MockUniversalSDK) GetTransactionStatus(ctx context.Context, transactionID string) (*TransactionStatus, error) {
	// Simulate network latency
	time.Sleep(m.config.Latency / 2) // Faster lookup operation

	// Simulate random transaction state
	statuses := []string{"pending", "completed", "failed"}
	statusIndex := rand.Intn(len(statuses))
	status := statuses[statusIndex]

	// Generate mock transaction hashes
	sourceTxHash := fmt.Sprintf("0x%s", uuid.New().String()[:32])

	var destTxHash, bridgeTxHash string
	var completionTime time.Time
	var errorMessage string

	if status == "completed" {
		destTxHash = fmt.Sprintf("0x%s", uuid.New().String()[:32])
		bridgeTxHash = fmt.Sprintf("0x%s", uuid.New().String()[:32])
		completionTime = time.Now()
	} else if status == "failed" {
		errorMessage = "Transaction failed due to network congestion"
	}

	return &TransactionStatus{
		TransactionID:  transactionID,
		Status:         status,
		SourceTxHash:   sourceTxHash,
		DestTxHash:     destTxHash,
		BridgeTxHash:   bridgeTxHash,
		CompletionTime: completionTime,
		ErrorMessage:   errorMessage,
	}, nil
}
