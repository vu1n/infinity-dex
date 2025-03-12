package services

import (
	"context"
	"errors"
	"math/big"
	"sync"

	"github.com/google/uuid"
)

// LiquidityService provides functionality for managing liquidity pools
type LiquidityService struct {
	pools     map[string]LiquidityPool       // map[poolID]LiquidityPool
	positions map[string][]LiquidityPosition // map[poolID][]LiquidityPosition
	mu        sync.RWMutex
}

// NewLiquidityService creates a new liquidity service instance
func NewLiquidityService() *LiquidityService {
	return &LiquidityService{
		pools:     make(map[string]LiquidityPool),
		positions: make(map[string][]LiquidityPosition),
	}
}

// CreatePool creates a new liquidity pool
func (s *LiquidityService) CreatePool(ctx context.Context, pair TokenPair, feeTier int, address string) (*LiquidityPool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Generate a unique pool ID
	poolID := uuid.New().String()

	// Create the pool
	pool := LiquidityPool{
		ID:             poolID,
		Pair:           pair,
		TotalLiquidity: big.NewInt(0),
		TVL:            0,
		APR:            0,
		FeeTier:        feeTier,
		Address:        address,
	}

	// Store the pool
	s.pools[poolID] = pool
	s.positions[poolID] = []LiquidityPosition{}

	return &pool, nil
}

// GetPool retrieves a liquidity pool by ID
func (s *LiquidityService) GetPool(ctx context.Context, poolID string) (*LiquidityPool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	pool, exists := s.pools[poolID]
	if !exists {
		return nil, errors.New("pool not found")
	}

	return &pool, nil
}

// GetPoolByTokens retrieves a liquidity pool by token pair
func (s *LiquidityService) GetPoolByTokens(ctx context.Context, token1Symbol, token2Symbol string) (*LiquidityPool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, pool := range s.pools {
		if (pool.Pair.BaseToken.Symbol == token1Symbol && pool.Pair.QuoteToken.Symbol == token2Symbol) ||
			(pool.Pair.BaseToken.Symbol == token2Symbol && pool.Pair.QuoteToken.Symbol == token1Symbol) {
			return &pool, nil
		}
	}

	return nil, errors.New("pool not found")
}

// GetAllPools retrieves all liquidity pools
func (s *LiquidityService) GetAllPools(ctx context.Context) []LiquidityPool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]LiquidityPool, 0, len(s.pools))
	for _, pool := range s.pools {
		result = append(result, pool)
	}

	return result
}

// AddLiquidity adds liquidity to a pool
func (s *LiquidityService) AddLiquidity(ctx context.Context, poolID string, userAddress string, amount *big.Int) (*LiquidityPosition, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if pool exists
	pool, exists := s.pools[poolID]
	if !exists {
		return nil, errors.New("pool not found")
	}

	// Update pool liquidity
	pool.TotalLiquidity = new(big.Int).Add(pool.TotalLiquidity, amount)
	s.pools[poolID] = pool

	// Calculate share percentage
	share := 0.0
	if pool.TotalLiquidity.Cmp(big.NewInt(0)) > 0 {
		shareFloat := new(big.Float).SetInt(amount)
		totalFloat := new(big.Float).SetInt(pool.TotalLiquidity)
		shareFloat.Quo(shareFloat, totalFloat)
		shareFloat.Mul(shareFloat, big.NewFloat(100.0))
		share, _ = shareFloat.Float64()
	}

	// Create or update position
	positions := s.positions[poolID]
	var position *LiquidityPosition

	// Check if user already has a position
	for i, pos := range positions {
		if pos.UserAddress == userAddress {
			// Update existing position
			positions[i].TokensOwned = new(big.Int).Add(pos.TokensOwned, amount)
			positions[i].Share = share
			positions[i].Value = 0.0 // Would calculate based on token prices
			position = &positions[i]
			s.positions[poolID] = positions
			return position, nil
		}
	}

	// Create new position
	newPosition := LiquidityPosition{
		PoolID:      poolID,
		UserAddress: userAddress,
		TokensOwned: amount,
		Share:       share,
		Value:       0.0, // Would calculate based on token prices
	}

	// Add to positions
	s.positions[poolID] = append(s.positions[poolID], newPosition)
	return &newPosition, nil
}

// RemoveLiquidity removes liquidity from a pool
func (s *LiquidityService) RemoveLiquidity(ctx context.Context, poolID string, userAddress string, amount *big.Int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if pool exists
	pool, exists := s.pools[poolID]
	if !exists {
		return errors.New("pool not found")
	}

	// Find user position
	positions := s.positions[poolID]
	for i, pos := range positions {
		if pos.UserAddress == userAddress {
			// Check if user has enough liquidity
			if pos.TokensOwned.Cmp(amount) < 0 {
				return errors.New("insufficient liquidity")
			}

			// Update position
			positions[i].TokensOwned = new(big.Int).Sub(pos.TokensOwned, amount)

			// Remove position if tokens owned is zero
			if positions[i].TokensOwned.Cmp(big.NewInt(0)) == 0 {
				// Remove position
				s.positions[poolID] = append(positions[:i], positions[i+1:]...)
			} else {
				// Update share percentage
				shareFloat := new(big.Float).SetInt(positions[i].TokensOwned)
				totalFloat := new(big.Float).SetInt(pool.TotalLiquidity)
				shareFloat.Quo(shareFloat, totalFloat)
				shareFloat.Mul(shareFloat, big.NewFloat(100.0))
				positions[i].Share, _ = shareFloat.Float64()
				s.positions[poolID] = positions
			}

			// Update pool liquidity
			pool.TotalLiquidity = new(big.Int).Sub(pool.TotalLiquidity, amount)
			s.pools[poolID] = pool

			return nil
		}
	}

	return errors.New("position not found")
}

// GetUserPositions retrieves all liquidity positions for a user
func (s *LiquidityService) GetUserPositions(ctx context.Context, userAddress string) []LiquidityPosition {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []LiquidityPosition
	for _, positions := range s.positions {
		for _, pos := range positions {
			if pos.UserAddress == userAddress {
				result = append(result, pos)
			}
		}
	}

	return result
}

// GetPoolPositions retrieves all liquidity positions for a pool
func (s *LiquidityService) GetPoolPositions(ctx context.Context, poolID string) ([]LiquidityPosition, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	positions, exists := s.positions[poolID]
	if !exists {
		return nil, errors.New("pool not found")
	}

	return positions, nil
}

// UpdatePoolStats updates the TVL and APR for a pool
func (s *LiquidityService) UpdatePoolStats(ctx context.Context, poolID string, tvl float64, apr float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pool, exists := s.pools[poolID]
	if !exists {
		return errors.New("pool not found")
	}

	pool.TVL = tvl
	pool.APR = apr
	s.pools[poolID] = pool

	return nil
}
