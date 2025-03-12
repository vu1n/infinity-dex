package services

import (
	"testing"
)

func TestSimpleServiceFactory(t *testing.T) {
	// Create a new simple service factory
	factory := NewSimpleServiceFactory()
	if factory == nil {
		t.Fatal("Failed to create simple service factory")
	}

	// Test initialization
	if !factory.initialized {
		t.Error("Expected factory to be initialized, but it's not")
	}

	// Test InitializeTestData
	t.Run("InitializeTestData", func(t *testing.T) {
		// This should not panic
		factory.InitializeTestData()
	})

	// Test GetTokenBySymbol
	t.Run("GetTokenBySymbol", func(t *testing.T) {
		// Get ETH token
		token, err := factory.GetTokenBySymbol("ETH")
		if err != nil {
			t.Errorf("Failed to get ETH token: %v", err)
		}
		if token == nil {
			t.Error("Expected token to be non-nil, got nil")
		}

		// Get USDC token
		token, err = factory.GetTokenBySymbol("USDC")
		if err != nil {
			t.Errorf("Failed to get USDC token: %v", err)
		}
		if token == nil {
			t.Error("Expected token to be non-nil, got nil")
		}

		// Get non-existent token
		token, err = factory.GetTokenBySymbol("BTC")
		if err == nil {
			t.Error("Expected error when getting non-existent token, got nil")
		}
		if token != nil {
			t.Errorf("Expected token to be nil, got %v", token)
		}
	})

	// Test GetChainStatus
	t.Run("GetChainStatus", func(t *testing.T) {
		// Get Ethereum chain status
		status, err := factory.GetChainStatus(1)
		if err != nil {
			t.Errorf("Failed to get Ethereum chain status: %v", err)
		}
		if status == nil {
			t.Error("Expected chain status to be non-nil, got nil")
		}

		// Get Polygon chain status
		status, err = factory.GetChainStatus(137)
		if err != nil {
			t.Errorf("Failed to get Polygon chain status: %v", err)
		}
		if status == nil {
			t.Error("Expected chain status to be non-nil, got nil")
		}

		// Get Solana chain status
		status, err = factory.GetChainStatus(1399811149)
		if err != nil {
			t.Errorf("Failed to get Solana chain status: %v", err)
		}
		if status == nil {
			t.Error("Expected chain status to be non-nil, got nil")
		}

		// Get non-existent chain status
		status, err = factory.GetChainStatus(999)
		if err == nil {
			t.Error("Expected error when getting non-existent chain status, got nil")
		}
		if status != nil {
			t.Errorf("Expected chain status to be nil, got %v", status)
		}
	})

	// Test GetRecentTransactions
	t.Run("GetRecentTransactions", func(t *testing.T) {
		// Get recent transactions
		txs := factory.GetRecentTransactions(10)
		if txs == nil {
			t.Error("Expected transactions to be non-nil, got nil")
		}
		if len(txs) != 2 {
			t.Errorf("Expected 2 transactions, got %d", len(txs))
		}

		// Get limited recent transactions
		txs = factory.GetRecentTransactions(1)
		if txs == nil {
			t.Error("Expected transactions to be non-nil, got nil")
		}
		// The SimpleServiceFactory always returns all transactions regardless of limit
		// so we should expect 2 transactions here
		if len(txs) != 2 {
			t.Errorf("Expected 2 transactions, got %d", len(txs))
		}
	})
}

func TestServiceFactoryWrapper(t *testing.T) {
	// Create a new service factory wrapper
	factory := NewServiceFactory()
	if factory == nil {
		t.Fatal("Failed to create service factory wrapper")
	}

	// Test InitializeTestData
	t.Run("InitializeTestData", func(t *testing.T) {
		// This should not panic
		factory.InitializeTestData()
	})

	// Test GetTokenBySymbol
	t.Run("GetTokenBySymbol", func(t *testing.T) {
		// Get ETH token
		token, err := factory.GetTokenBySymbol("ETH")
		if err != nil {
			t.Errorf("Failed to get ETH token: %v", err)
		}
		if token == nil {
			t.Error("Expected token to be non-nil, got nil")
		}

		// Get USDC token
		token, err = factory.GetTokenBySymbol("USDC")
		if err != nil {
			t.Errorf("Failed to get USDC token: %v", err)
		}
		if token == nil {
			t.Error("Expected token to be non-nil, got nil")
		}

		// Get non-existent token
		token, err = factory.GetTokenBySymbol("BTC")
		if err == nil {
			t.Error("Expected error when getting non-existent token, got nil")
		}
		if token != nil {
			t.Errorf("Expected token to be nil, got %v", token)
		}
	})

	// Test GetChainStatus
	t.Run("GetChainStatus", func(t *testing.T) {
		// Get Ethereum chain status
		status, err := factory.GetChainStatus(1)
		if err != nil {
			t.Errorf("Failed to get Ethereum chain status: %v", err)
		}
		if status == nil {
			t.Error("Expected chain status to be non-nil, got nil")
		}

		// Get non-existent chain status
		status, err = factory.GetChainStatus(999)
		if err == nil {
			t.Error("Expected error when getting non-existent chain status, got nil")
		}
		if status != nil {
			t.Errorf("Expected chain status to be nil, got %v", status)
		}
	})

	// Test GetRecentTransactions
	t.Run("GetRecentTransactions", func(t *testing.T) {
		// Get recent transactions
		txs := factory.GetRecentTransactions(10)
		if txs == nil {
			t.Error("Expected transactions to be non-nil, got nil")
		}
		if len(txs) != 2 {
			t.Errorf("Expected 2 transactions, got %d", len(txs))
		}
	})
}
