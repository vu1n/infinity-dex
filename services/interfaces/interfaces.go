package interfaces

import (
	"context"
	"math/big"
	"time"

	"github.com/infinity-dex/services/types"
)

// TokenServiceInterface defines the interface for token-related operations
type TokenServiceInterface interface {
	AddToken(token types.Token) error
	GetToken(symbol string) (types.Token, error)
	GetTokensByChain(chainID int64) []types.Token
	GetAllTokens() []types.Token
	AddTokenPair(pair types.TokenPair) error
	GetTokenPair(baseSymbol, quoteSymbol string) (types.TokenPair, error)
	GetAllTokenPairs() []types.TokenPair
	GetWrappedToken(ctx context.Context, token types.Token) (types.Token, error)
	GetNativeToken(ctx context.Context, wrappedToken types.Token) (types.Token, error)
}

// TransactionServiceInterface defines the interface for transaction-related operations
type TransactionServiceInterface interface {
	CreateTransaction(ctx context.Context, tx types.Transaction) (string, error)
	GetTransaction(ctx context.Context, txID string) (*types.Transaction, error)
	GetTransactionsByWorkflowID(ctx context.Context, workflowID string) ([]types.Transaction, error)
	GetTransactionsByAddress(ctx context.Context, address string) []types.Transaction
	GetTransactionsByType(ctx context.Context, txType string) []types.Transaction
	UpdateTransactionStatus(ctx context.Context, txID string, status string) error
	UpdateTransactionBlockInfo(ctx context.Context, txID string, blockNumber uint64) error
	GetRecentTransactions(ctx context.Context, limit int) []types.Transaction
}

// LiquidityServiceInterface defines the interface for liquidity-related operations
type LiquidityServiceInterface interface {
	CreatePool(ctx context.Context, pair types.TokenPair, feeTier int, address string) (*types.LiquidityPool, error)
	GetPool(ctx context.Context, poolID string) (*types.LiquidityPool, error)
	GetPoolByTokens(ctx context.Context, token1Symbol, token2Symbol string) (*types.LiquidityPool, error)
	GetAllPools(ctx context.Context) []types.LiquidityPool
	AddLiquidity(ctx context.Context, poolID string, userAddress string, amount *big.Int) (*types.LiquidityPosition, error)
	RemoveLiquidity(ctx context.Context, poolID string, userAddress string, amount *big.Int) error
	GetUserPositions(ctx context.Context, userAddress string) []types.LiquidityPosition
	GetPoolPositions(ctx context.Context, poolID string) ([]types.LiquidityPosition, error)
	UpdatePoolStats(ctx context.Context, poolID string, tvl float64, apr float64) error
}

// SwapServiceInterface defines the interface for swap-related operations
type SwapServiceInterface interface {
	GetSwapQuote(ctx context.Context, request types.SwapRequest) (*types.SwapQuote, error)
	ExecuteSwap(ctx context.Context, request types.SwapRequest) (string, error)
	GetSwapStatus(ctx context.Context, requestID string) (*types.SwapResult, error)
	CancelSwap(ctx context.Context, requestID string) error
}

// ChainServiceInterface defines the interface for chain-related operations
type ChainServiceInterface interface {
	GetChainStatus(ctx context.Context, chainID int64) (*types.ChainStatus, error)
	GetAllChainStatuses(ctx context.Context) []types.ChainStatus
	UpdateChainStatus(ctx context.Context, chainID int64, isActive bool, gasPrice *big.Int) error
	GetGasPrice(ctx context.Context, chainID int64) (*big.Int, error)
	EstimateGas(ctx context.Context, chainID int64, fromAddress, toAddress string, data []byte) (*big.Int, error)
}

// SwapRequest represents a user request to swap tokens
type SwapRequest struct {
	SourceToken        types.Token `json:"sourceToken"`
	DestinationToken   types.Token `json:"destinationToken"`
	Amount             *big.Int    `json:"amount"`
	SourceAddress      string      `json:"sourceAddress"`
	DestinationAddress string      `json:"destinationAddress"`
	Slippage           float64     `json:"slippage"`
	Deadline           time.Time   `json:"deadline"`
	RefundAddress      string      `json:"refundAddress,omitempty"`
	RequestID          string      `json:"requestId"`
}
