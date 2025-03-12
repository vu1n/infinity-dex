package services

import (
	"context"
	"errors"
	"sync"

	"github.com/infinity-dex/services/types"
)

// TokenService provides functionality for managing tokens and token pairs
type TokenService struct {
	tokens     map[string]types.Token     // map[symbol]Token
	tokenPairs map[string]types.TokenPair // map[baseSymbol-quoteSymbol]TokenPair
	mu         sync.RWMutex
}

// NewTokenService creates a new token service instance
func NewTokenService() *TokenService {
	return &TokenService{
		tokens:     make(map[string]types.Token),
		tokenPairs: make(map[string]types.TokenPair),
	}
}

// AddToken adds a new token to the service
func (s *TokenService) AddToken(token types.Token) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.tokens[token.Symbol]; exists {
		return errors.New("token already exists")
	}

	s.tokens[token.Symbol] = token
	return nil
}

// GetToken retrieves a token by its symbol
func (s *TokenService) GetToken(symbol string) (types.Token, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	token, exists := s.tokens[symbol]
	if !exists {
		return types.Token{}, errors.New("token not found")
	}

	return token, nil
}

// GetTokensByChain retrieves all tokens for a specific chain
func (s *TokenService) GetTokensByChain(chainID int64) []types.Token {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []types.Token
	for _, token := range s.tokens {
		if token.ChainID == chainID {
			result = append(result, token)
		}
	}

	return result
}

// GetAllTokens retrieves all tokens
func (s *TokenService) GetAllTokens() []types.Token {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]types.Token, 0, len(s.tokens))
	for _, token := range s.tokens {
		result = append(result, token)
	}

	return result
}

// AddTokenPair adds a new token pair to the service
func (s *TokenService) AddTokenPair(pair types.TokenPair) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := pair.BaseToken.Symbol + "-" + pair.QuoteToken.Symbol
	if _, exists := s.tokenPairs[key]; exists {
		return errors.New("token pair already exists")
	}

	s.tokenPairs[key] = pair
	return nil
}

// GetTokenPair retrieves a token pair by base and quote symbols
func (s *TokenService) GetTokenPair(baseSymbol, quoteSymbol string) (types.TokenPair, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := baseSymbol + "-" + quoteSymbol
	pair, exists := s.tokenPairs[key]
	if !exists {
		return types.TokenPair{}, errors.New("token pair not found")
	}

	return pair, nil
}

// GetAllTokenPairs retrieves all token pairs
func (s *TokenService) GetAllTokenPairs() []types.TokenPair {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]types.TokenPair, 0, len(s.tokenPairs))
	for _, pair := range s.tokenPairs {
		result = append(result, pair)
	}

	return result
}

// GetWrappedToken returns the wrapped version of a token if available
func (s *TokenService) GetWrappedToken(ctx context.Context, token types.Token) (types.Token, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	wrappedSymbol := "u" + token.Symbol
	wrappedToken, exists := s.tokens[wrappedSymbol]
	if !exists {
		return types.Token{}, errors.New("wrapped token not found")
	}

	return wrappedToken, nil
}

// GetNativeToken returns the native version of a wrapped token if available
func (s *TokenService) GetNativeToken(ctx context.Context, wrappedToken types.Token) (types.Token, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !wrappedToken.IsWrapped {
		return types.Token{}, errors.New("token is not wrapped")
	}

	// Remove the 'u' prefix to get the native token symbol
	nativeSymbol := wrappedToken.Symbol[1:]
	nativeToken, exists := s.tokens[nativeSymbol]
	if !exists {
		return types.Token{}, errors.New("native token not found")
	}

	return nativeToken, nil
}
