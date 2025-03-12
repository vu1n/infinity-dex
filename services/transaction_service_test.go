package services

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/infinity-dex/services/types"
)

func TestTransactionService(t *testing.T) {
	// Create a new transaction service
	service := NewTransactionService()
	if service == nil {
		t.Fatal("Failed to create transaction service")
	}

	// Create test tokens
	ethToken := types.Token{
		Symbol:    "ETH",
		Name:      "Ethereum",
		Decimals:  18,
		ChainID:   1,
		ChainName: "Ethereum",
	}

	usdcToken := types.Token{
		Symbol:    "USDC",
		Name:      "USD Coin",
		Decimals:  6,
		ChainID:   1,
		ChainName: "Ethereum",
	}

	// Create test transactions
	tx1 := types.Transaction{
		ID:          "tx1",
		Type:        "swap",
		Hash:        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		Status:      "completed",
		FromAddress: "0x1234567890abcdef1234567890abcdef12345678",
		ToAddress:   "0x9876543210abcdef1234567890abcdef12345678",
		SourceChain: "Ethereum",
		DestChain:   "Ethereum",
		SourceToken: ethToken,
		DestToken:   usdcToken,
		Amount:      big.NewInt(1000000000000000000), // 1 ETH
		Value:       big.NewInt(1000000000000000000),
		Gas:         big.NewInt(21000),
		GasPrice:    big.NewInt(20000000000),
		Timestamp:   time.Now(),
		BlockNumber: 12345678,
		WorkflowID:  "workflow1",
	}

	tx2 := types.Transaction{
		ID:          "tx2",
		Type:        "add_liquidity",
		Hash:        "0x9876543210abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		Status:      "pending",
		FromAddress: "0x1234567890abcdef1234567890abcdef12345678",
		ToAddress:   "0x3333333333333333333333333333333333333333",
		SourceChain: "Ethereum",
		DestChain:   "Ethereum",
		SourceToken: ethToken,
		DestToken:   ethToken,
		Amount:      big.NewInt(5000000000000000000), // 5 ETH
		Value:       big.NewInt(5000000000000000000),
		Gas:         big.NewInt(50000),
		GasPrice:    big.NewInt(20000000000),
		Timestamp:   time.Now(),
		BlockNumber: 12345679,
		WorkflowID:  "workflow2",
	}

	// Test CreateTransaction
	t.Run("CreateTransaction", func(t *testing.T) {
		ctx := context.Background()

		// Create first transaction
		txID, err := service.CreateTransaction(ctx, tx1)
		if err != nil {
			t.Errorf("Failed to create transaction: %v", err)
		}
		if txID != "tx1" {
			t.Errorf("Expected transaction ID to be 'tx1', got '%s'", txID)
		}

		// Create second transaction
		txID, err = service.CreateTransaction(ctx, tx2)
		if err != nil {
			t.Errorf("Failed to create transaction: %v", err)
		}
		if txID != "tx2" {
			t.Errorf("Expected transaction ID to be 'tx2', got '%s'", txID)
		}

		// Try to create a duplicate transaction
		_, err = service.CreateTransaction(ctx, tx1)
		if err == nil {
			t.Error("Expected error when creating duplicate transaction, got nil")
		}

		// Try to create a transaction with no ID
		noIDTx := tx1
		noIDTx.ID = ""
		_, err = service.CreateTransaction(ctx, noIDTx)
		if err == nil {
			t.Error("Expected error when creating transaction with no ID, got nil")
		}
	})

	// Test GetTransaction
	t.Run("GetTransaction", func(t *testing.T) {
		ctx := context.Background()

		// Get existing transaction
		tx, err := service.GetTransaction(ctx, "tx1")
		if err != nil {
			t.Errorf("Failed to get transaction: %v", err)
		}
		if tx.ID != "tx1" {
			t.Errorf("Expected transaction ID to be 'tx1', got '%s'", tx.ID)
		}
		if tx.Type != "swap" {
			t.Errorf("Expected transaction type to be 'swap', got '%s'", tx.Type)
		}

		// Try to get non-existent transaction
		_, err = service.GetTransaction(ctx, "tx3")
		if err == nil {
			t.Error("Expected error when getting non-existent transaction, got nil")
		}
	})

	// Test GetTransactionsByWorkflowID
	t.Run("GetTransactionsByWorkflowID", func(t *testing.T) {
		ctx := context.Background()

		// Get transactions for workflow1
		txs, err := service.GetTransactionsByWorkflowID(ctx, "workflow1")
		if err != nil {
			t.Errorf("Failed to get transactions by workflow ID: %v", err)
		}
		if len(txs) != 1 {
			t.Errorf("Expected 1 transaction for workflow1, got %d", len(txs))
		}
		if txs[0].ID != "tx1" {
			t.Errorf("Expected transaction ID to be 'tx1', got '%s'", txs[0].ID)
		}

		// Try to get transactions for non-existent workflow
		_, err = service.GetTransactionsByWorkflowID(ctx, "workflow3")
		if err == nil {
			t.Error("Expected error when getting transactions for non-existent workflow, got nil")
		}
	})

	// Test GetTransactionsByAddress
	t.Run("GetTransactionsByAddress", func(t *testing.T) {
		ctx := context.Background()

		// Get transactions for address
		txs := service.GetTransactionsByAddress(ctx, "0x1234567890abcdef1234567890abcdef12345678")
		if len(txs) != 2 {
			t.Errorf("Expected 2 transactions for address, got %d", len(txs))
		}

		// Get transactions for another address
		txs = service.GetTransactionsByAddress(ctx, "0x9876543210abcdef1234567890abcdef12345678")
		if len(txs) != 1 {
			t.Errorf("Expected 1 transaction for address, got %d", len(txs))
		}
		if txs[0].ID != "tx1" {
			t.Errorf("Expected transaction ID to be 'tx1', got '%s'", txs[0].ID)
		}

		// Get transactions for non-existent address
		txs = service.GetTransactionsByAddress(ctx, "0x0000000000000000000000000000000000000000")
		if len(txs) != 0 {
			t.Errorf("Expected 0 transactions for non-existent address, got %d", len(txs))
		}
	})

	// Test GetTransactionsByType
	t.Run("GetTransactionsByType", func(t *testing.T) {
		ctx := context.Background()

		// Get swap transactions
		txs := service.GetTransactionsByType(ctx, "swap")
		if len(txs) != 1 {
			t.Errorf("Expected 1 swap transaction, got %d", len(txs))
		}
		if txs[0].ID != "tx1" {
			t.Errorf("Expected transaction ID to be 'tx1', got '%s'", txs[0].ID)
		}

		// Get add_liquidity transactions
		txs = service.GetTransactionsByType(ctx, "add_liquidity")
		if len(txs) != 1 {
			t.Errorf("Expected 1 add_liquidity transaction, got %d", len(txs))
		}
		if txs[0].ID != "tx2" {
			t.Errorf("Expected transaction ID to be 'tx2', got '%s'", txs[0].ID)
		}

		// Get non-existent type transactions
		txs = service.GetTransactionsByType(ctx, "remove_liquidity")
		if len(txs) != 0 {
			t.Errorf("Expected 0 remove_liquidity transactions, got %d", len(txs))
		}
	})

	// Test UpdateTransactionStatus
	t.Run("UpdateTransactionStatus", func(t *testing.T) {
		ctx := context.Background()

		// Update transaction status
		err := service.UpdateTransactionStatus(ctx, "tx2", "completed")
		if err != nil {
			t.Errorf("Failed to update transaction status: %v", err)
		}

		// Verify status was updated
		tx, err := service.GetTransaction(ctx, "tx2")
		if err != nil {
			t.Errorf("Failed to get transaction: %v", err)
		}
		if tx.Status != "completed" {
			t.Errorf("Expected transaction status to be 'completed', got '%s'", tx.Status)
		}

		// Try to update non-existent transaction
		err = service.UpdateTransactionStatus(ctx, "tx3", "completed")
		if err == nil {
			t.Error("Expected error when updating non-existent transaction, got nil")
		}
	})

	// Test UpdateTransactionBlockInfo
	t.Run("UpdateTransactionBlockInfo", func(t *testing.T) {
		ctx := context.Background()

		// Update transaction block info
		err := service.UpdateTransactionBlockInfo(ctx, "tx1", 12345680)
		if err != nil {
			t.Errorf("Failed to update transaction block info: %v", err)
		}

		// Verify block info was updated
		tx, err := service.GetTransaction(ctx, "tx1")
		if err != nil {
			t.Errorf("Failed to get transaction: %v", err)
		}
		if tx.BlockNumber != 12345680 {
			t.Errorf("Expected transaction block number to be 12345680, got %d", tx.BlockNumber)
		}

		// Try to update non-existent transaction
		err = service.UpdateTransactionBlockInfo(ctx, "tx3", 12345680)
		if err == nil {
			t.Error("Expected error when updating non-existent transaction, got nil")
		}
	})

	// Test GetRecentTransactions
	t.Run("GetRecentTransactions", func(t *testing.T) {
		ctx := context.Background()

		// Get all recent transactions
		txs := service.GetRecentTransactions(ctx, 10)
		if len(txs) != 2 {
			t.Errorf("Expected 2 recent transactions, got %d", len(txs))
		}

		// Get limited recent transactions
		txs = service.GetRecentTransactions(ctx, 1)
		if len(txs) != 1 {
			t.Errorf("Expected 1 recent transaction, got %d", len(txs))
		}
	})
}
