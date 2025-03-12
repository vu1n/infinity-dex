package types

import (
	"math/big"
	"time"
)

// Token represents a cryptocurrency token
type Token struct {
	Symbol    string `json:"symbol"`
	Name      string `json:"name"`
	Decimals  int    `json:"decimals"`
	Address   string `json:"address"`
	ChainID   int64  `json:"chainId"`
	ChainName string `json:"chainName"`
	LogoURI   string `json:"logoUri,omitempty"`
	IsWrapped bool   `json:"isWrapped"`
}

// TokenPair represents a trading pair
type TokenPair struct {
	BaseToken  Token `json:"baseToken"`
	QuoteToken Token `json:"quoteToken"`
}

// SwapRequest represents a user request to swap tokens
type SwapRequest struct {
	SourceToken        Token     `json:"sourceToken"`
	DestinationToken   Token     `json:"destinationToken"`
	Amount             *big.Int  `json:"amount"`
	SourceAddress      string    `json:"sourceAddress"`
	DestinationAddress string    `json:"destinationAddress"`
	Slippage           float64   `json:"slippage"`
	Deadline           time.Time `json:"deadline"`
	RefundAddress      string    `json:"refundAddress,omitempty"`
	RequestID          string    `json:"requestId"`
}

// SwapQuote represents a quote for a swap
type SwapQuote struct {
	SourceToken      Token    `json:"sourceToken"`
	DestinationToken Token    `json:"destinationToken"`
	InputAmount      *big.Int `json:"inputAmount"`
	OutputAmount     *big.Int `json:"outputAmount"`
	Fee              Fee      `json:"fee"`
	Path             []string `json:"path"`
	PriceImpact      float64  `json:"priceImpact"`
	ExchangeRate     float64  `json:"exchangeRate"`
}

// Fee represents the fees for a swap
type Fee struct {
	GasFee      *big.Int `json:"gasFee"`
	ProtocolFee *big.Int `json:"protocolFee"`
	NetworkFee  *big.Int `json:"networkFee"`
	BridgeFee   *big.Int `json:"bridgeFee"`
	TotalFeeUSD float64  `json:"totalFeeUSD"`
}

// LiquidityPool represents a liquidity pool
type LiquidityPool struct {
	ID             string    `json:"id"`
	Pair           TokenPair `json:"pair"`
	TotalLiquidity *big.Int  `json:"totalLiquidity"`
	TVL            float64   `json:"tvl"`
	APR            float64   `json:"apr"`
	FeeTier        int       `json:"feeTier"`
	Address        string    `json:"address"`
}

// LiquidityPosition represents a user's position in a liquidity pool
type LiquidityPosition struct {
	PoolID      string   `json:"poolId"`
	UserAddress string   `json:"userAddress"`
	TokensOwned *big.Int `json:"tokensOwned"`
	Share       float64  `json:"share"` // Percentage of pool owned
	Value       float64  `json:"value"` // USD value of position
}

// Transaction represents a blockchain transaction
type Transaction struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // swap, add, remove
	Hash        string    `json:"hash"`
	Status      string    `json:"status"` // pending, completed, failed
	FromAddress string    `json:"fromAddress"`
	ToAddress   string    `json:"toAddress"`
	SourceChain string    `json:"sourceChain"`
	DestChain   string    `json:"destChain"`
	SourceToken Token     `json:"sourceToken"`
	DestToken   Token     `json:"destToken"`
	Amount      *big.Int  `json:"amount"`
	Value       *big.Int  `json:"value"`
	Gas         *big.Int  `json:"gas"`
	GasPrice    *big.Int  `json:"gasPrice"`
	Timestamp   time.Time `json:"timestamp"`
	BlockNumber uint64    `json:"blockNumber"`
	WorkflowID  string    `json:"workflowId"`
}

// ChainStatus represents the status of a blockchain
type ChainStatus struct {
	Name      string   `json:"name"`
	ChainID   int64    `json:"chainId"`
	IsActive  bool     `json:"isActive"`
	GasPrice  *big.Int `json:"gasPrice"`
	BlockTime int      `json:"blockTime"` // Average time between blocks in seconds
}

// SwapResult represents the result of a swap operation
type SwapResult struct {
	RequestID      string      `json:"requestId"`
	Success        bool        `json:"success"`
	SourceTx       Transaction `json:"sourceTx"`
	DestinationTx  Transaction `json:"destinationTx"`
	BridgeTx       Transaction `json:"bridgeTx,omitempty"`
	InputAmount    *big.Int    `json:"inputAmount"`
	OutputAmount   *big.Int    `json:"outputAmount"`
	Fee            Fee         `json:"fee"`
	CompletionTime time.Time   `json:"completionTime"`
	ErrorMessage   string      `json:"errorMessage,omitempty"`
}
