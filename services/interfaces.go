package services

import (
	"context"
	"math/big"
)

// TokenServiceInterface defines the interface for token-related operations
type TokenServiceInterface interface {
	AddToken(token Token) error
	GetToken(symbol string) (Token, error)
	GetTokensByChain(chainID int64) []Token
	GetAllTokens() []Token
	AddTokenPair(pair TokenPair) error
	GetTokenPair(baseSymbol, quoteSymbol string) (TokenPair, error)
	GetAllTokenPairs() []TokenPair
	GetWrappedToken(ctx context.Context, token Token) (Token, error)
	GetNativeToken(ctx context.Context, wrappedToken Token) (Token, error)
}

// TransactionServiceInterface defines the interface for transaction-related operations
type TransactionServiceInterface interface {
	CreateTransaction(ctx context.Context, tx Transaction) (string, error)
	GetTransaction(ctx context.Context, txID string) (*Transaction, error)
	GetTransactionsByWorkflowID(ctx context.Context, workflowID string) ([]Transaction, error)
	GetTransactionsByAddress(ctx context.Context, address string) []Transaction
	GetTransactionsByType(ctx context.Context, txType string) []Transaction
	UpdateTransactionStatus(ctx context.Context, txID string, status string) error
	UpdateTransactionBlockInfo(ctx context.Context, txID string, blockNumber uint64) error
	GetRecentTransactions(ctx context.Context, limit int) []Transaction
}

// LiquidityServiceInterface defines the interface for liquidity-related operations
type LiquidityServiceInterface interface {
	CreatePool(ctx context.Context, pair TokenPair, feeTier int, address string) (*LiquidityPool, error)
	GetPool(ctx context.Context, poolID string) (*LiquidityPool, error)
	GetPoolByTokens(ctx context.Context, token1Symbol, token2Symbol string) (*LiquidityPool, error)
	GetAllPools(ctx context.Context) []LiquidityPool
	AddLiquidity(ctx context.Context, poolID string, userAddress string, amount *big.Int) (*LiquidityPosition, error)
	RemoveLiquidity(ctx context.Context, poolID string, userAddress string, amount *big.Int) error
	GetUserPositions(ctx context.Context, userAddress string) []LiquidityPosition
	GetPoolPositions(ctx context.Context, poolID string) ([]LiquidityPosition, error)
	UpdatePoolStats(ctx context.Context, poolID string, tvl float64, apr float64) error
}

// SwapServiceInterface defines the interface for swap-related operations
type SwapServiceInterface interface {
	GetSwapQuote(ctx context.Context, request SwapRequest) (*SwapQuote, error)
	ExecuteSwap(ctx context.Context, request SwapRequest) (string, error)
	GetSwapStatus(ctx context.Context, requestID string) (*SwapResult, error)
	CancelSwap(ctx context.Context, requestID string) error
}
