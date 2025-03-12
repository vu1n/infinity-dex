package types

import (
	"math/big"
	"testing"
	"time"
)

func TestTokenStruct(t *testing.T) {
	// Create a token
	token := Token{
		Symbol:    "ETH",
		Name:      "Ethereum",
		Decimals:  18,
		Address:   "0x0000000000000000000000000000000000000000",
		ChainID:   1,
		ChainName: "Ethereum",
		LogoURI:   "https://ethereum.org/eth-logo.svg",
		IsWrapped: false,
	}

	// Verify token fields
	if token.Symbol != "ETH" {
		t.Errorf("Expected Symbol to be 'ETH', got '%s'", token.Symbol)
	}
	if token.Name != "Ethereum" {
		t.Errorf("Expected Name to be 'Ethereum', got '%s'", token.Name)
	}
	if token.Decimals != 18 {
		t.Errorf("Expected Decimals to be 18, got %d", token.Decimals)
	}
	if token.Address != "0x0000000000000000000000000000000000000000" {
		t.Errorf("Expected Address to be '0x0000000000000000000000000000000000000000', got '%s'", token.Address)
	}
	if token.ChainID != 1 {
		t.Errorf("Expected ChainID to be 1, got %d", token.ChainID)
	}
	if token.ChainName != "Ethereum" {
		t.Errorf("Expected ChainName to be 'Ethereum', got '%s'", token.ChainName)
	}
	if token.IsWrapped {
		t.Errorf("Expected IsWrapped to be false, got %t", token.IsWrapped)
	}
}

func TestTokenPairStruct(t *testing.T) {
	// Create tokens
	baseToken := Token{
		Symbol:    "ETH",
		Name:      "Ethereum",
		Decimals:  18,
		ChainID:   1,
		ChainName: "Ethereum",
	}
	quoteToken := Token{
		Symbol:    "USDC",
		Name:      "USD Coin",
		Decimals:  6,
		ChainID:   1,
		ChainName: "Ethereum",
	}

	// Create token pair
	pair := TokenPair{
		BaseToken:  baseToken,
		QuoteToken: quoteToken,
	}

	// Verify token pair fields
	if pair.BaseToken.Symbol != "ETH" {
		t.Errorf("Expected BaseToken.Symbol to be 'ETH', got '%s'", pair.BaseToken.Symbol)
	}
	if pair.QuoteToken.Symbol != "USDC" {
		t.Errorf("Expected QuoteToken.Symbol to be 'USDC', got '%s'", pair.QuoteToken.Symbol)
	}
}

func TestSwapRequestStruct(t *testing.T) {
	// Create tokens
	sourceToken := Token{
		Symbol:    "ETH",
		Name:      "Ethereum",
		Decimals:  18,
		ChainID:   1,
		ChainName: "Ethereum",
	}
	destToken := Token{
		Symbol:    "USDC",
		Name:      "USD Coin",
		Decimals:  6,
		ChainID:   1,
		ChainName: "Ethereum",
	}

	// Create swap request
	amount := big.NewInt(1000000000000000000) // 1 ETH
	deadline := time.Now().Add(15 * time.Minute)
	request := SwapRequest{
		SourceToken:        sourceToken,
		DestinationToken:   destToken,
		Amount:             amount,
		SourceAddress:      "0x1234567890abcdef1234567890abcdef12345678",
		DestinationAddress: "0x9876543210abcdef1234567890abcdef12345678",
		Slippage:           0.5,
		Deadline:           deadline,
		RefundAddress:      "0x1234567890abcdef1234567890abcdef12345678",
		RequestID:          "req-123",
	}

	// Verify swap request fields
	if request.SourceToken.Symbol != "ETH" {
		t.Errorf("Expected SourceToken.Symbol to be 'ETH', got '%s'", request.SourceToken.Symbol)
	}
	if request.DestinationToken.Symbol != "USDC" {
		t.Errorf("Expected DestinationToken.Symbol to be 'USDC', got '%s'", request.DestinationToken.Symbol)
	}
	if request.Amount.Cmp(amount) != 0 {
		t.Errorf("Expected Amount to be %s, got %s", amount.String(), request.Amount.String())
	}
	if request.Slippage != 0.5 {
		t.Errorf("Expected Slippage to be 0.5, got %f", request.Slippage)
	}
	if !request.Deadline.Equal(deadline) {
		t.Errorf("Expected Deadline to be %v, got %v", deadline, request.Deadline)
	}
	if request.RequestID != "req-123" {
		t.Errorf("Expected RequestID to be 'req-123', got '%s'", request.RequestID)
	}
}

func TestFeeStruct(t *testing.T) {
	// Create fee
	fee := Fee{
		GasFee:      big.NewInt(1000000000000000), // 0.001 ETH
		ProtocolFee: big.NewInt(500000000000000),  // 0.0005 ETH
		NetworkFee:  big.NewInt(200000000000000),  // 0.0002 ETH
		BridgeFee:   big.NewInt(2000000000000000), // 0.002 ETH
		TotalFeeUSD: 5.0,
	}

	// Verify fee fields
	if fee.GasFee.Cmp(big.NewInt(1000000000000000)) != 0 {
		t.Errorf("Expected GasFee to be 1000000000000000, got %s", fee.GasFee.String())
	}
	if fee.ProtocolFee.Cmp(big.NewInt(500000000000000)) != 0 {
		t.Errorf("Expected ProtocolFee to be 500000000000000, got %s", fee.ProtocolFee.String())
	}
	if fee.NetworkFee.Cmp(big.NewInt(200000000000000)) != 0 {
		t.Errorf("Expected NetworkFee to be 200000000000000, got %s", fee.NetworkFee.String())
	}
	if fee.BridgeFee.Cmp(big.NewInt(2000000000000000)) != 0 {
		t.Errorf("Expected BridgeFee to be 2000000000000000, got %s", fee.BridgeFee.String())
	}
	if fee.TotalFeeUSD != 5.0 {
		t.Errorf("Expected TotalFeeUSD to be 5.0, got %f", fee.TotalFeeUSD)
	}
}
