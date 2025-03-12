package services

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
)

// SwapService provides functionality for swapping tokens
type SwapService struct {
	tokenService       *TokenService
	transactionService *TransactionService
	universalSDK       universalsdk.SDK
}

// NewSwapService creates a new swap service instance
func NewSwapService(tokenService *TokenService, transactionService *TransactionService, universalSDK universalsdk.SDK) *SwapService {
	return &SwapService{
		tokenService:       tokenService,
		transactionService: transactionService,
		universalSDK:       universalSDK,
	}
}

// GetSwapQuote returns a quote for a swap
func (s *SwapService) GetSwapQuote(ctx context.Context, request types.SwapRequest) (*types.SwapQuote, error) {
	// Validate request
	if request.Amount == nil || request.Amount.Cmp(big.NewInt(0)) <= 0 {
		return nil, errors.New("invalid amount")
	}

	// Get fee estimate
	feeEstimateRequest := universalsdk.FeeEstimateRequest{
		SourceToken:      request.SourceToken,
		DestinationToken: request.DestinationToken,
		Amount:           request.Amount,
	}
	fee, err := s.universalSDK.GetFeeEstimate(ctx, feeEstimateRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to get fee estimate: %w", err)
	}

	// Calculate output amount (simplified for demo)
	// In a real implementation, this would use price oracles, liquidity pools, etc.
	outputAmount := big.NewInt(0)
	if request.SourceToken.Symbol == "ETH" && request.DestinationToken.Symbol == "USDC" {
		// 1 ETH = 2000 USDC (simplified)
		ethValue := new(big.Float).SetInt(request.Amount)
		usdcValue := new(big.Float).Mul(ethValue, big.NewFloat(2000.0))
		outputAmount, _ = usdcValue.Int(nil)
	} else if request.SourceToken.Symbol == "USDC" && request.DestinationToken.Symbol == "ETH" {
		// 2000 USDC = 1 ETH (simplified)
		usdcValue := new(big.Float).SetInt(request.Amount)
		ethValue := new(big.Float).Quo(usdcValue, big.NewFloat(2000.0))
		outputAmount, _ = ethValue.Int(nil)
	} else {
		// Default 1:1 for demo
		outputAmount = big.NewInt(0).Set(request.Amount)
	}

	// Subtract fees from output amount
	outputAmount = big.NewInt(0).Sub(outputAmount, fee.GasFee)
	outputAmount = big.NewInt(0).Sub(outputAmount, fee.ProtocolFee)
	outputAmount = big.NewInt(0).Sub(outputAmount, fee.NetworkFee)
	if outputAmount.Cmp(big.NewInt(0)) <= 0 {
		return nil, errors.New("output amount too small")
	}

	// Create swap path
	path := []string{request.SourceToken.Symbol, request.DestinationToken.Symbol}

	// Calculate price impact (simplified)
	priceImpact := 0.1 // 0.1%

	// Calculate exchange rate
	sourceFloat := new(big.Float).SetInt(request.Amount)
	destFloat := new(big.Float).SetInt(outputAmount)
	exchangeRate, _ := new(big.Float).Quo(destFloat, sourceFloat).Float64()

	// Create quote
	quote := &types.SwapQuote{
		SourceToken:      request.SourceToken,
		DestinationToken: request.DestinationToken,
		InputAmount:      request.Amount,
		OutputAmount:     outputAmount,
		Fee:              *fee,
		Path:             path,
		PriceImpact:      priceImpact,
		ExchangeRate:     exchangeRate,
	}

	return quote, nil
}

// ExecuteSwap executes a swap
func (s *SwapService) ExecuteSwap(ctx context.Context, request types.SwapRequest) (string, error) {
	// Validate request
	if request.Amount == nil || request.Amount.Cmp(big.NewInt(0)) <= 0 {
		return "", errors.New("invalid amount")
	}

	// Use provided request ID or generate a new one
	requestID := request.RequestID
	if requestID == "" {
		requestID = uuid.New().String()
	}

	// Create source transaction
	// Generate a hash that's at least 40 characters long
	txHash := uuid.New().String()
	// Ensure the hash is long enough by padding if necessary
	if len(txHash) < 40 {
		txHash = txHash + strings.Repeat("0", 40-len(txHash))
	}

	// Create a safe address string that's at least 40 chars
	addressStr := txHash
	if len(addressStr) > 40 {
		addressStr = addressStr[:40]
	} else {
		addressStr = addressStr + strings.Repeat("0", 40-len(addressStr))
	}

	// Create a safe hash string that's at least 32 chars
	hashStr := txHash
	if len(hashStr) > 32 {
		hashStr = hashStr[:32]
	} else {
		hashStr = hashStr + strings.Repeat("0", 32-len(hashStr))
	}

	sourceTx := types.Transaction{
		ID:          uuid.New().String(),
		Type:        "swap_source",
		Hash:        fmt.Sprintf("0x%s", hashStr),
		Status:      "pending",
		FromAddress: request.SourceAddress,
		ToAddress:   "0x" + addressStr, // Contract address
		SourceChain: request.SourceToken.ChainName,
		DestChain:   request.SourceToken.ChainName,
		SourceToken: request.SourceToken,
		DestToken:   request.SourceToken,
		Amount:      request.Amount,
		Value:       request.Amount,
		Gas:         big.NewInt(250000),
		GasPrice:    big.NewInt(20000000000),
		Timestamp:   time.Now(),
		BlockNumber: 0,
		WorkflowID:  requestID,
	}

	// Create destination transaction
	// Generate new UUIDs for destination transaction
	destTxHash := uuid.New().String()
	if len(destTxHash) < 32 {
		destTxHash = destTxHash + strings.Repeat("0", 32-len(destTxHash))
	}

	destAddressStr := uuid.New().String()
	if len(destAddressStr) < 40 {
		destAddressStr = destAddressStr + strings.Repeat("0", 40-len(destAddressStr))
	} else {
		destAddressStr = destAddressStr[:40]
	}

	destTx := types.Transaction{
		ID:          uuid.New().String(),
		Type:        "swap_dest",
		Hash:        fmt.Sprintf("0x%s", destTxHash[:32]),
		Status:      "pending",
		FromAddress: "0x" + destAddressStr[:40], // Contract address
		ToAddress:   request.DestinationAddress,
		SourceChain: request.DestinationToken.ChainName,
		DestChain:   request.DestinationToken.ChainName,
		SourceToken: request.DestinationToken,
		DestToken:   request.DestinationToken,
		Amount:      big.NewInt(0), // Will be set after quote
		Value:       big.NewInt(0), // Will be set after quote
		Gas:         big.NewInt(250000),
		GasPrice:    big.NewInt(20000000000),
		Timestamp:   time.Now(),
		BlockNumber: 0,
		WorkflowID:  requestID,
	}

	// Get quote to determine output amount
	quote, err := s.GetSwapQuote(ctx, request)
	if err != nil {
		return "", fmt.Errorf("failed to get swap quote: %w", err)
	}

	// Set destination amount
	destTx.Amount = quote.OutputAmount
	destTx.Value = quote.OutputAmount

	// Create transactions
	_, err = s.transactionService.CreateTransaction(ctx, sourceTx)
	if err != nil {
		return "", fmt.Errorf("failed to create source transaction: %w", err)
	}

	_, err = s.transactionService.CreateTransaction(ctx, destTx)
	if err != nil {
		return "", fmt.Errorf("failed to create destination transaction: %w", err)
	}

	return requestID, nil
}

// GetSwapStatus returns the status of a swap
func (s *SwapService) GetSwapStatus(ctx context.Context, requestID string) (*types.SwapResult, error) {
	// Get transactions for this swap
	txs, err := s.transactionService.GetTransactionsByWorkflowID(ctx, requestID)
	if err != nil {
		return nil, fmt.Errorf("failed to get transactions: %w", err)
	}

	if len(txs) < 2 {
		return nil, errors.New("incomplete swap transactions")
	}

	// Find source and destination transactions
	var sourceTx, destTx types.Transaction
	for _, tx := range txs {
		if tx.Type == "swap_source" {
			sourceTx = tx
		} else if tx.Type == "swap_dest" {
			destTx = tx
		}
	}

	// Check if both transactions were found
	if sourceTx.ID == "" || destTx.ID == "" {
		return nil, errors.New("missing swap transactions")
	}

	// Determine if swap is complete
	success := sourceTx.Status == "completed" && destTx.Status == "completed"

	// Get fee estimate
	feeEstimateRequest := universalsdk.FeeEstimateRequest{
		SourceToken:      sourceTx.SourceToken,
		DestinationToken: destTx.DestToken,
		Amount:           sourceTx.Amount,
	}
	fee, err := s.universalSDK.GetFeeEstimate(ctx, feeEstimateRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to get fee estimate: %w", err)
	}

	// Create result
	result := &types.SwapResult{
		RequestID:      requestID,
		Success:        success,
		SourceTx:       sourceTx,
		DestinationTx:  destTx,
		InputAmount:    sourceTx.Amount,
		OutputAmount:   destTx.Amount,
		Fee:            *fee,
		CompletionTime: time.Now(),
	}

	if !success {
		result.ErrorMessage = "Swap in progress"
	}

	return result, nil
}

// CancelSwap cancels a swap
func (s *SwapService) CancelSwap(ctx context.Context, requestID string) error {
	// Get transactions for this swap
	txs, err := s.transactionService.GetTransactionsByWorkflowID(ctx, requestID)
	if err != nil {
		return fmt.Errorf("failed to get transactions: %w", err)
	}

	if len(txs) == 0 {
		return errors.New("no transactions found for swap")
	}

	// Update status of all transactions to cancelled
	for _, tx := range txs {
		err = s.transactionService.UpdateTransactionStatus(ctx, tx.ID, "cancelled")
		if err != nil {
			return fmt.Errorf("failed to update transaction status: %w", err)
		}
	}

	return nil
}
