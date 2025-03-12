package services

import (
	"context"
	"errors"
	"math/big"
	"sync"
)

// ChainService provides functionality for blockchain-related operations
type ChainService struct {
	chains map[int64]ChainStatus // map[chainID]ChainStatus
	mu     sync.RWMutex
}

// NewChainService creates a new chain service instance
func NewChainService() *ChainService {
	return &ChainService{
		chains: make(map[int64]ChainStatus),
	}
}

// AddChain adds a new blockchain to the service
func (s *ChainService) AddChain(chain ChainStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.chains[chain.ChainID]; exists {
		return errors.New("chain already exists")
	}

	s.chains[chain.ChainID] = chain
	return nil
}

// GetChain retrieves a blockchain by its ID
func (s *ChainService) GetChain(chainID int64) (ChainStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	chain, exists := s.chains[chainID]
	if !exists {
		return ChainStatus{}, errors.New("chain not found")
	}

	return chain, nil
}

// GetAllChains retrieves all blockchains
func (s *ChainService) GetAllChains() []ChainStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]ChainStatus, 0, len(s.chains))
	for _, chain := range s.chains {
		result = append(result, chain)
	}

	return result
}

// GetActiveChains retrieves all active blockchains
func (s *ChainService) GetActiveChains() []ChainStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []ChainStatus
	for _, chain := range s.chains {
		if chain.IsActive {
			result = append(result, chain)
		}
	}

	return result
}

// UpdateChainStatus updates the status of a blockchain
func (s *ChainService) UpdateChainStatus(chainID int64, isActive bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	chain, exists := s.chains[chainID]
	if !exists {
		return errors.New("chain not found")
	}

	chain.IsActive = isActive
	s.chains[chainID] = chain

	return nil
}

// UpdateGasPrice updates the gas price for a blockchain
func (s *ChainService) UpdateGasPrice(chainID int64, gasPrice *big.Int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	chain, exists := s.chains[chainID]
	if !exists {
		return errors.New("chain not found")
	}

	chain.GasPrice = gasPrice
	s.chains[chainID] = chain

	return nil
}

// GetChainByName retrieves a blockchain by its name
func (s *ChainService) GetChainByName(name string) (ChainStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, chain := range s.chains {
		if chain.Name == name {
			return chain, nil
		}
	}

	return ChainStatus{}, errors.New("chain not found")
}

// EstimateTransactionTime estimates the time for a transaction to be confirmed
func (s *ChainService) EstimateTransactionTime(ctx context.Context, chainID int64) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	chain, exists := s.chains[chainID]
	if !exists {
		return 0, errors.New("chain not found")
	}

	// Return the block time as an estimate (in seconds)
	return chain.BlockTime, nil
}
