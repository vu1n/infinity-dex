package types

import (
	"time"
)

// TokenPrice represents a token's price information
type TokenPrice struct {
	Symbol        string      `json:"symbol"`
	Name          string      `json:"name"`
	Address       string      `json:"address"`
	ChainID       int64       `json:"chainId"`
	ChainName     string      `json:"chainName"`
	PriceUSD      float64     `json:"priceUSD"`
	Change24h     float64     `json:"change24h"`
	Volume24h     float64     `json:"volume24h"`
	MarketCapUSD  float64     `json:"marketCapUSD"`
	LastUpdated   time.Time   `json:"lastUpdated"`
	Source        PriceSource `json:"source"`
	IsVerified    bool        `json:"isVerified"`
	JupiterVolume float64     `json:"jupiterVolume,omitempty"`
}

// TokenPriceHistory represents a historical token price record
type TokenPriceHistory struct {
	Symbol       string      `json:"symbol"`
	ChainID      int64       `json:"chainId"`
	PriceUSD     float64     `json:"priceUSD"`
	Change24h    float64     `json:"change24h"`
	Volume24h    float64     `json:"volume24h"`
	MarketCapUSD float64     `json:"marketCapUSD"`
	Source       PriceSource `json:"source"`
	Timestamp    time.Time   `json:"timestamp"`
}

// PriceSource represents a source of token price data
type PriceSource string

const (
	// PriceSourceUniversal represents prices from Universal SDK
	PriceSourceUniversal PriceSource = "universal"
	// PriceSourceCoinGecko represents prices from CoinGecko
	PriceSourceCoinGecko PriceSource = "coingecko"
	// PriceSourceJupiter represents prices from Jupiter
	PriceSourceJupiter PriceSource = "jupiter"
	// PriceSourceFallback represents fallback hardcoded prices
	PriceSourceFallback PriceSource = "fallback"
)

// PriceFetchRequest represents a request to fetch token prices
type PriceFetchRequest struct {
	Symbols   []string  `json:"symbols"`
	ChainIDs  []int64   `json:"chainIds"`
	Sources   []string  `json:"sources"`
	ForceSync bool      `json:"forceSync"`
	Timestamp time.Time `json:"timestamp"`
	RequestID string    `json:"requestId"`
}

// PriceFetchResult represents the result of a price fetch operation
type PriceFetchResult struct {
	Prices         []TokenPrice `json:"prices"`
	SuccessSources []string     `json:"successSources"`
	FailedSources  []string     `json:"failedSources"`
	Timestamp      time.Time    `json:"timestamp"`
	CacheHit       bool         `json:"cacheHit"`
	RequestID      string       `json:"requestId"`
	ErrorMessage   string       `json:"errorMessage,omitempty"`
}

// PriceCache represents the cached token prices
type PriceCache struct {
	Prices      map[string]TokenPrice `json:"prices"` // Map of symbol-chainId to price
	LastUpdated time.Time             `json:"lastUpdated"`
	ExpiresAt   time.Time             `json:"expiresAt"`
}

// PriceUpdateEvent represents an event when prices are updated
type PriceUpdateEvent struct {
	UpdatedPrices []TokenPrice `json:"updatedPrices"`
	Source        string       `json:"source"`
	Timestamp     time.Time    `json:"timestamp"`
}

// GetPriceKey returns a unique key for a token price based on symbol and chain
func GetPriceKey(symbol string, chainID int64) string {
	return symbol + "-" + string(chainID)
}
