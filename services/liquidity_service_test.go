package services

import (
	"context"
	"math/big"
	"testing"
)

func TestLiquidityService(t *testing.T) {
	// Create dependencies
	service := NewLiquidityService()
	if service == nil {
		t.Fatal("Failed to create liquidity service")
	}

	// Create token pair for the services package
	servicesPair := TokenPair{
		BaseToken: Token{
			Symbol:    "ETH",
			Name:      "Ethereum",
			Decimals:  18,
			Address:   "0x0000000000000000000000000000000000000000",
			ChainID:   1,
			ChainName: "Ethereum",
			LogoURI:   "https://ethereum.org/eth-logo.svg",
			IsWrapped: false,
		},
		QuoteToken: Token{
			Symbol:    "USDC",
			Name:      "USD Coin",
			Decimals:  6,
			Address:   "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
			ChainID:   1,
			ChainName: "Ethereum",
			LogoURI:   "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
			IsWrapped: false,
		},
	}

	// Test CreatePool
	t.Run("CreatePool", func(t *testing.T) {
		ctx := context.Background()
		pool, err := service.CreatePool(ctx, servicesPair, 3000, "0x1234567890abcdef1234567890abcdef12345678")
		if err != nil {
			t.Errorf("Failed to create pool: %v", err)
		}
		if pool == nil {
			t.Fatal("Expected pool to be non-nil, got nil")
		}
		if pool.Pair.BaseToken.Symbol != "ETH" {
			t.Errorf("Expected Pair.BaseToken.Symbol to be 'ETH', got '%s'", pool.Pair.BaseToken.Symbol)
		}
		if pool.Pair.QuoteToken.Symbol != "USDC" {
			t.Errorf("Expected Pair.QuoteToken.Symbol to be 'USDC', got '%s'", pool.Pair.QuoteToken.Symbol)
		}
		if pool.FeeTier != 3000 {
			t.Errorf("Expected FeeTier to be 3000, got %d", pool.FeeTier)
		}
		if pool.Address != "0x1234567890abcdef1234567890abcdef12345678" {
			t.Errorf("Expected Address to be '0x1234567890abcdef1234567890abcdef12345678', got '%s'", pool.Address)
		}
	})

	// Test GetAllPools
	t.Run("GetAllPools", func(t *testing.T) {
		ctx := context.Background()
		pools := service.GetAllPools(ctx)
		if len(pools) != 1 {
			t.Errorf("Expected 1 pool, got %d", len(pools))
		}
	})

	// Test GetPoolByTokens
	t.Run("GetPoolByTokens", func(t *testing.T) {
		ctx := context.Background()
		pool, err := service.GetPoolByTokens(ctx, "ETH", "USDC")
		if err != nil {
			t.Errorf("Failed to get pool by tokens: %v", err)
		}
		if pool == nil {
			t.Fatal("Expected pool to be non-nil, got nil")
		}
		if pool.Pair.BaseToken.Symbol != "ETH" {
			t.Errorf("Expected Pair.BaseToken.Symbol to be 'ETH', got '%s'", pool.Pair.BaseToken.Symbol)
		}
		if pool.Pair.QuoteToken.Symbol != "USDC" {
			t.Errorf("Expected Pair.QuoteToken.Symbol to be 'USDC', got '%s'", pool.Pair.QuoteToken.Symbol)
		}
	})

	// Test AddLiquidity
	t.Run("AddLiquidity", func(t *testing.T) {
		ctx := context.Background()
		// Get the pool ID
		pools := service.GetAllPools(ctx)
		if len(pools) == 0 {
			t.Fatal("No pools found")
		}
		poolID := pools[0].ID

		// Add liquidity
		amount := big.NewInt(1000000000000000000) // 1 ETH
		position, err := service.AddLiquidity(ctx, poolID, "0x1234567890abcdef1234567890abcdef12345678", amount)
		if err != nil {
			t.Errorf("Failed to add liquidity: %v", err)
		}
		if position == nil {
			t.Fatal("Expected position to be non-nil, got nil")
		}
		if position.PoolID != poolID {
			t.Errorf("Expected PoolID to be '%s', got '%s'", poolID, position.PoolID)
		}
		if position.UserAddress != "0x1234567890abcdef1234567890abcdef12345678" {
			t.Errorf("Expected UserAddress to be '0x1234567890abcdef1234567890abcdef12345678', got '%s'", position.UserAddress)
		}
		if position.TokensOwned.Cmp(amount) != 0 {
			t.Errorf("Expected TokensOwned to be %s, got %s", amount.String(), position.TokensOwned.String())
		}
		if position.Share != 100.0 {
			t.Errorf("Expected Share to be 100.0, got %f", position.Share)
		}

		// Verify pool was updated
		pool, err := service.GetPool(ctx, poolID)
		if err != nil {
			t.Errorf("Failed to get pool: %v", err)
		}
		if pool.TotalLiquidity.Cmp(amount) != 0 {
			t.Errorf("Expected TotalLiquidity to be %s, got %s", amount.String(), pool.TotalLiquidity.String())
		}
	})

	// Test GetUserPositions
	t.Run("GetUserPositions", func(t *testing.T) {
		ctx := context.Background()
		positions := service.GetUserPositions(ctx, "0x1234567890abcdef1234567890abcdef12345678")
		if len(positions) != 1 {
			t.Errorf("Expected 1 position, got %d", len(positions))
		}
		if positions[0].UserAddress != "0x1234567890abcdef1234567890abcdef12345678" {
			t.Errorf("Expected UserAddress to be '0x1234567890abcdef1234567890abcdef12345678', got '%s'", positions[0].UserAddress)
		}
	})

	// Test GetPoolPositions
	t.Run("GetPoolPositions", func(t *testing.T) {
		ctx := context.Background()
		// Get the pool ID
		pools := service.GetAllPools(ctx)
		if len(pools) == 0 {
			t.Fatal("No pools found")
		}
		poolID := pools[0].ID

		positions, err := service.GetPoolPositions(ctx, poolID)
		if err != nil {
			t.Errorf("Failed to get pool positions: %v", err)
		}
		if len(positions) != 1 {
			t.Errorf("Expected 1 position, got %d", len(positions))
		}
		if positions[0].PoolID != poolID {
			t.Errorf("Expected PoolID to be '%s', got '%s'", poolID, positions[0].PoolID)
		}
	})

	// Test RemoveLiquidity
	t.Run("RemoveLiquidity", func(t *testing.T) {
		ctx := context.Background()
		// Get the pool ID
		pools := service.GetAllPools(ctx)
		if len(pools) == 0 {
			t.Fatal("No pools found")
		}
		poolID := pools[0].ID

		// Remove half of the liquidity
		amount := big.NewInt(500000000000000000) // 0.5 ETH
		err := service.RemoveLiquidity(ctx, poolID, "0x1234567890abcdef1234567890abcdef12345678", amount)
		if err != nil {
			t.Errorf("Failed to remove liquidity: %v", err)
		}

		// Verify pool was updated
		pool, err := service.GetPool(ctx, poolID)
		if err != nil {
			t.Errorf("Failed to get pool: %v", err)
		}
		expectedAmount := big.NewInt(500000000000000000) // 0.5 ETH remaining
		if pool.TotalLiquidity.Cmp(expectedAmount) != 0 {
			t.Errorf("Expected TotalLiquidity to be %s, got %s", expectedAmount.String(), pool.TotalLiquidity.String())
		}

		// Verify position was updated
		positions := service.GetUserPositions(ctx, "0x1234567890abcdef1234567890abcdef12345678")
		if len(positions) != 1 {
			t.Errorf("Expected 1 position, got %d", len(positions))
		}
		if positions[0].TokensOwned.Cmp(expectedAmount) != 0 {
			t.Errorf("Expected TokensOwned to be %s, got %s", expectedAmount.String(), positions[0].TokensOwned.String())
		}
		if positions[0].Share != 50.0 {
			t.Errorf("Expected Share to be 50.0, got %f", positions[0].Share)
		}
	})

	// Test UpdatePoolStats
	t.Run("UpdatePoolStats", func(t *testing.T) {
		ctx := context.Background()
		// Get the pool ID
		pools := service.GetAllPools(ctx)
		if len(pools) == 0 {
			t.Fatal("No pools found")
		}
		poolID := pools[0].ID

		// Update pool stats
		err := service.UpdatePoolStats(ctx, poolID, 1000000.0, 5.2)
		if err != nil {
			t.Errorf("Failed to update pool stats: %v", err)
		}

		// Verify pool was updated
		pool, err := service.GetPool(ctx, poolID)
		if err != nil {
			t.Errorf("Failed to get pool: %v", err)
		}
		if pool.TVL != 1000000.0 {
			t.Errorf("Expected TVL to be 1000000.0, got %f", pool.TVL)
		}
		if pool.APR != 5.2 {
			t.Errorf("Expected APR to be 5.2, got %f", pool.APR)
		}
	})
}
