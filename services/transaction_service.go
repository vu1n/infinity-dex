package services

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/infinity-dex/services/types"
)

// TransactionService provides functionality for managing blockchain transactions
type TransactionService struct {
	transactions map[string]types.Transaction // map[txID]Transaction
	mu           sync.RWMutex
}

// NewTransactionService creates a new transaction service instance
func NewTransactionService() *TransactionService {
	return &TransactionService{
		transactions: make(map[string]types.Transaction),
	}
}

// CreateTransaction creates a new transaction record
func (s *TransactionService) CreateTransaction(ctx context.Context, tx types.Transaction) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if tx.ID == "" {
		return "", errors.New("transaction ID is required")
	}

	if _, exists := s.transactions[tx.ID]; exists {
		return "", errors.New("transaction already exists")
	}

	// Set default values if not provided
	if tx.Status == "" {
		tx.Status = "pending"
	}

	if tx.Timestamp.IsZero() {
		tx.Timestamp = time.Now()
	}

	s.transactions[tx.ID] = tx
	return tx.ID, nil
}

// GetTransaction retrieves a transaction by ID
func (s *TransactionService) GetTransaction(ctx context.Context, txID string) (*types.Transaction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tx, exists := s.transactions[txID]
	if !exists {
		return nil, errors.New("transaction not found")
	}

	return &tx, nil
}

// GetTransactionsByWorkflowID retrieves all transactions for a specific workflow
func (s *TransactionService) GetTransactionsByWorkflowID(ctx context.Context, workflowID string) ([]types.Transaction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []types.Transaction
	for _, tx := range s.transactions {
		if tx.WorkflowID == workflowID {
			result = append(result, tx)
		}
	}

	if len(result) == 0 {
		return nil, errors.New("no transactions found for workflow")
	}

	return result, nil
}

// GetTransactionsByAddress retrieves all transactions for a specific address
func (s *TransactionService) GetTransactionsByAddress(ctx context.Context, address string) []types.Transaction {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []types.Transaction
	for _, tx := range s.transactions {
		if tx.FromAddress == address || tx.ToAddress == address {
			result = append(result, tx)
		}
	}

	return result
}

// GetTransactionsByType retrieves all transactions of a specific type
func (s *TransactionService) GetTransactionsByType(ctx context.Context, txType string) []types.Transaction {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []types.Transaction
	for _, tx := range s.transactions {
		if tx.Type == txType {
			result = append(result, tx)
		}
	}

	return result
}

// UpdateTransactionStatus updates the status of a transaction
func (s *TransactionService) UpdateTransactionStatus(ctx context.Context, txID string, status string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, exists := s.transactions[txID]
	if !exists {
		return errors.New("transaction not found")
	}

	tx.Status = status
	s.transactions[txID] = tx
	return nil
}

// UpdateTransactionBlockInfo updates the block information of a transaction
func (s *TransactionService) UpdateTransactionBlockInfo(ctx context.Context, txID string, blockNumber uint64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, exists := s.transactions[txID]
	if !exists {
		return errors.New("transaction not found")
	}

	tx.BlockNumber = blockNumber
	s.transactions[txID] = tx
	return nil
}

// GetRecentTransactions retrieves the most recent transactions
func (s *TransactionService) GetRecentTransactions(ctx context.Context, limit int) []types.Transaction {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Convert map to slice
	txs := make([]types.Transaction, 0, len(s.transactions))
	for _, tx := range s.transactions {
		txs = append(txs, tx)
	}

	// Sort by timestamp (newest first)
	// In a real implementation, this would use a proper sorting algorithm
	// For simplicity, we'll just return the first 'limit' transactions
	if len(txs) > limit {
		txs = txs[:limit]
	}

	return txs
}
