package main

import (
	"testing"

	"github.com/infinity-dex/config"
	"github.com/infinity-dex/services/types"
)

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

	// Verify token fields
	for _, token := range ethTokens {
		if token.Symbol == "" {
			t.Error("token symbol is empty")
		}
		if token.ChainID == 0 {
			t.Error("token chain ID is 0")
		}
		if token.ChainName == "" {
			t.Error("token chain name is empty")
		}
	}
}
