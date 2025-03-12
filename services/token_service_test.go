package services

import (
	"context"
	"testing"

	"github.com/infinity-dex/services/types"
)

func TestTokenService(t *testing.T) {
	// Create a new token service
	service := NewTokenService()
	if service == nil {
		t.Fatal("Failed to create token service")
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

	wrappedEthToken := types.Token{
		Symbol:    "uETH",
		Name:      "Universal Ethereum",
		Decimals:  18,
		Address:   "0x1111111111111111111111111111111111111111",
		ChainID:   1,
		ChainName: "Ethereum",
		LogoURI:   "https://ethereum.org/eth-logo.svg",
		IsWrapped: true,
	}

	// Test AddToken
	t.Run("AddToken", func(t *testing.T) {
		err := service.AddToken(ethToken)
		if err != nil {
			t.Errorf("Failed to add ETH token: %v", err)
		}

		err = service.AddToken(usdcToken)
		if err != nil {
			t.Errorf("Failed to add USDC token: %v", err)
		}

		err = service.AddToken(wrappedEthToken)
		if err != nil {
			t.Errorf("Failed to add uETH token: %v", err)
		}

		// Try to add a duplicate token
		err = service.AddToken(ethToken)
		if err == nil {
			t.Error("Expected error when adding duplicate token, got nil")
		}
	})

	// Test GetToken
	t.Run("GetToken", func(t *testing.T) {
		token, err := service.GetToken("ETH")
		if err != nil {
			t.Errorf("Failed to get ETH token: %v", err)
		}
		if token.Symbol != "ETH" {
			t.Errorf("Expected Symbol to be 'ETH', got '%s'", token.Symbol)
		}

		token, err = service.GetToken("USDC")
		if err != nil {
			t.Errorf("Failed to get USDC token: %v", err)
		}
		if token.Symbol != "USDC" {
			t.Errorf("Expected Symbol to be 'USDC', got '%s'", token.Symbol)
		}

		// Try to get a non-existent token
		_, err = service.GetToken("BTC")
		if err == nil {
			t.Error("Expected error when getting non-existent token, got nil")
		}
	})

	// Test GetTokensByChain
	t.Run("GetTokensByChain", func(t *testing.T) {
		tokens := service.GetTokensByChain(1)
		if len(tokens) != 3 {
			t.Errorf("Expected 3 tokens for chain ID 1, got %d", len(tokens))
		}

		tokens = service.GetTokensByChain(2)
		if len(tokens) != 0 {
			t.Errorf("Expected 0 tokens for chain ID 2, got %d", len(tokens))
		}
	})

	// Test GetAllTokens
	t.Run("GetAllTokens", func(t *testing.T) {
		tokens := service.GetAllTokens()
		if len(tokens) != 3 {
			t.Errorf("Expected 3 tokens, got %d", len(tokens))
		}
	})

	// Test AddTokenPair
	t.Run("AddTokenPair", func(t *testing.T) {
		pair := types.TokenPair{
			BaseToken:  ethToken,
			QuoteToken: usdcToken,
		}

		err := service.AddTokenPair(pair)
		if err != nil {
			t.Errorf("Failed to add token pair: %v", err)
		}

		// Try to add a duplicate pair
		err = service.AddTokenPair(pair)
		if err == nil {
			t.Error("Expected error when adding duplicate token pair, got nil")
		}
	})

	// Test GetTokenPair
	t.Run("GetTokenPair", func(t *testing.T) {
		pair, err := service.GetTokenPair("ETH", "USDC")
		if err != nil {
			t.Errorf("Failed to get token pair: %v", err)
		}
		if pair.BaseToken.Symbol != "ETH" {
			t.Errorf("Expected BaseToken.Symbol to be 'ETH', got '%s'", pair.BaseToken.Symbol)
		}
		if pair.QuoteToken.Symbol != "USDC" {
			t.Errorf("Expected QuoteToken.Symbol to be 'USDC', got '%s'", pair.QuoteToken.Symbol)
		}

		// Try to get a non-existent pair
		_, err = service.GetTokenPair("ETH", "BTC")
		if err == nil {
			t.Error("Expected error when getting non-existent token pair, got nil")
		}
	})

	// Test GetAllTokenPairs
	t.Run("GetAllTokenPairs", func(t *testing.T) {
		pairs := service.GetAllTokenPairs()
		if len(pairs) != 1 {
			t.Errorf("Expected 1 token pair, got %d", len(pairs))
		}
	})

	// Test GetWrappedToken
	t.Run("GetWrappedToken", func(t *testing.T) {
		ctx := context.Background()
		wrapped, err := service.GetWrappedToken(ctx, ethToken)
		if err != nil {
			t.Errorf("Failed to get wrapped token: %v", err)
		}
		if wrapped.Symbol != "uETH" {
			t.Errorf("Expected Symbol to be 'uETH', got '%s'", wrapped.Symbol)
		}
		if !wrapped.IsWrapped {
			t.Error("Expected IsWrapped to be true, got false")
		}

		// Try to get a wrapped token for a token that doesn't have one
		_, err = service.GetWrappedToken(ctx, usdcToken)
		if err == nil {
			t.Error("Expected error when getting wrapped token for USDC, got nil")
		}
	})

	// Test GetNativeToken
	t.Run("GetNativeToken", func(t *testing.T) {
		ctx := context.Background()
		native, err := service.GetNativeToken(ctx, wrappedEthToken)
		if err != nil {
			t.Errorf("Failed to get native token: %v", err)
		}
		if native.Symbol != "ETH" {
			t.Errorf("Expected Symbol to be 'ETH', got '%s'", native.Symbol)
		}
		if native.IsWrapped {
			t.Error("Expected IsWrapped to be false, got true")
		}

		// Try to get a native token for a token that isn't wrapped
		_, err = service.GetNativeToken(ctx, ethToken)
		if err == nil {
			t.Error("Expected error when getting native token for ETH, got nil")
		}
	})
}
