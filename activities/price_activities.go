package activities

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
)

// PriceActivities holds implementation of price-related activities
type PriceActivities struct {
	universalSDK universalsdk.SDK
	httpClient   *http.Client
	cacheDir     string
}

// NewPriceActivities creates a new instance of price activities
func NewPriceActivities(sdk universalsdk.SDK, cacheDir string) *PriceActivities {
	// Create cache directory if it doesn't exist
	if _, err := os.Stat(cacheDir); os.IsNotExist(err) {
		os.MkdirAll(cacheDir, 0755)
	}

	return &PriceActivities{
		universalSDK: sdk,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		cacheDir: cacheDir,
	}
}

// FetchUniversalPricesActivity fetches token prices from Universal SDK
func (a *PriceActivities) FetchUniversalPricesActivity(ctx context.Context, request types.PriceFetchRequest) ([]types.TokenPrice, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Fetching Universal token prices", "symbols", request.Symbols)

	// Since the SDK doesn't have GetTokens and GetTokenPrice methods,
	// we'll use a simplified implementation that returns a mock list of tokens
	// This is a placeholder until the actual SDK methods are implemented

	// Create a list of common tokens with mock prices
	mockTokens := []struct {
		Symbol    string
		Name      string
		ChainID   int64
		ChainName string
		PriceUSD  float64
		Address   string
	}{
		{"ETH", "Ethereum", 1, "Ethereum", 1888.15, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"},
		{"BTC", "Bitcoin", 1, "Ethereum", 52000.00, "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"},
		{"SOL", "Solana", 999, "Solana", 125.02, "So11111111111111111111111111111111111111112"},
		{"AVAX", "Avalanche", 43114, "Avalanche", 18.93, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"},
		{"MATIC", "Polygon", 137, "Polygon", 0.58, "0x0000000000000000000000000000000000001010"},
		{"USDC", "USD Coin", 1, "Ethereum", 1.00, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"},
		{"USDT", "Tether", 1, "Ethereum", 1.00, "0xdAC17F958D2ee523a2206206994597C13D831ec7"},
	}

	// Convert to our token price format
	var prices []types.TokenPrice
	for _, token := range mockTokens {
		// Skip if not in requested symbols (if any specified)
		if len(request.Symbols) > 0 {
			found := false
			for _, symbol := range request.Symbols {
				if strings.EqualFold(token.Symbol, symbol) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Skip if not in requested chains (if any specified)
		if len(request.ChainIDs) > 0 {
			found := false
			for _, chainID := range request.ChainIDs {
				if token.ChainID == chainID {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Add to prices list
		prices = append(prices, types.TokenPrice{
			Symbol:      token.Symbol,
			Name:        token.Name,
			Address:     token.Address,
			ChainID:     token.ChainID,
			ChainName:   token.ChainName,
			PriceUSD:    token.PriceUSD,
			LastUpdated: time.Now(),
			Source:      types.PriceSourceUniversal,
			IsVerified:  true,
		})
	}

	logger.Info("Fetched Universal token prices", "count", len(prices))
	return prices, nil
}

// FetchCoinGeckoPricesActivity fetches token prices from CoinGecko
func (a *PriceActivities) FetchCoinGeckoPricesActivity(ctx context.Context, request types.PriceFetchRequest) ([]types.TokenPrice, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Fetching CoinGecko token prices", "symbols", request.Symbols)

	// Map of common symbols to CoinGecko IDs
	symbolToID := map[string]string{
		"eth":   "ethereum",
		"btc":   "bitcoin",
		"sol":   "solana",
		"usdc":  "usd-coin",
		"usdt":  "tether",
		"dai":   "dai",
		"matic": "matic-network",
		"avax":  "avalanche-2",
		"bonk":  "bonk",
		"jup":   "jupiter",
		"ray":   "raydium",
	}

	// Convert symbols to CoinGecko IDs
	var coinGeckoIds []string
	for _, symbol := range request.Symbols {
		symbol = strings.ToLower(symbol)
		if id, ok := symbolToID[symbol]; ok {
			coinGeckoIds = append(coinGeckoIds, id)
		} else {
			coinGeckoIds = append(coinGeckoIds, symbol)
		}
	}

	// If no symbols specified, use a default list
	if len(coinGeckoIds) == 0 {
		coinGeckoIds = []string{
			"ethereum", "bitcoin", "solana", "usd-coin", "tether",
			"dai", "matic-network", "avalanche-2", "bonk", "jupiter",
		}
	}

	// Build CoinGecko API URL
	url := fmt.Sprintf(
		"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=%s&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h",
		strings.Join(coinGeckoIds, ","),
	)

	// Make request to CoinGecko API
	resp, err := a.httpClient.Get(url)
	if err != nil {
		return nil, temporal.NewNonRetryableApplicationError(
			"Failed to fetch CoinGecko prices",
			"COINGECKO_API_ERROR",
			err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return nil, temporal.NewNonRetryableApplicationError(
			fmt.Sprintf("CoinGecko API returned status %d", resp.StatusCode),
			"COINGECKO_API_ERROR",
			errors.New("non-200 status code"))
	}

	// Parse response
	var coinGeckoResp []map[string]interface{}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(body, &coinGeckoResp); err != nil {
		return nil, err
	}

	// Convert to our token price format
	var prices []types.TokenPrice
	for _, coin := range coinGeckoResp {
		symbol := coin["symbol"].(string)
		name := coin["name"].(string)
		priceUSD := coin["current_price"].(float64)
		marketCap := coin["market_cap"].(float64)
		volume := coin["total_volume"].(float64)
		change24h := coin["price_change_percentage_24h"].(float64)

		// Determine chain ID based on symbol (simplified)
		var chainID int64
		var chainName string
		switch strings.ToLower(symbol) {
		case "eth":
			chainID = 1
			chainName = "Ethereum"
		case "matic":
			chainID = 137
			chainName = "Polygon"
		case "avax":
			chainID = 43114
			chainName = "Avalanche"
		case "sol", "bonk", "jup", "ray":
			chainID = 999
			chainName = "Solana"
		default:
			chainID = 1 // Default to Ethereum
			chainName = "Ethereum"
		}

		// Add to prices list
		prices = append(prices, types.TokenPrice{
			Symbol:       symbol,
			Name:         name,
			ChainID:      chainID,
			ChainName:    chainName,
			PriceUSD:     priceUSD,
			Change24h:    change24h,
			Volume24h:    volume,
			MarketCapUSD: marketCap,
			LastUpdated:  time.Now(),
			Source:       types.PriceSourceCoinGecko,
			IsVerified:   true,
		})
	}

	logger.Info("Fetched CoinGecko token prices", "count", len(prices))
	return prices, nil
}

// FetchJupiterPricesActivity fetches token prices from Jupiter API
func (a *PriceActivities) FetchJupiterPricesActivity(ctx context.Context, request types.PriceFetchRequest) ([]types.TokenPrice, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Fetching Jupiter token prices")

	// Jupiter API URL for verified tokens
	url := "https://api.jup.ag/tokens/v1/tagged/verified"

	// Make request to Jupiter API
	resp, err := a.httpClient.Get(url)
	if err != nil {
		return nil, temporal.NewNonRetryableApplicationError(
			"Failed to fetch Jupiter prices",
			"JUPITER_API_ERROR",
			err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return nil, temporal.NewNonRetryableApplicationError(
			fmt.Sprintf("Jupiter API returned status %d", resp.StatusCode),
			"JUPITER_API_ERROR",
			errors.New("non-200 status code"))
	}

	// Parse response
	var jupiterResp []map[string]interface{}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(body, &jupiterResp); err != nil {
		return nil, err
	}

	// Known memecoin symbols (case insensitive)
	knownMemecoins := map[string]bool{
		"bonk": true, "wif": true, "dogwif": true, "bome": true, "book of meme": true,
		"popcat": true, "cat": true, "mog": true, "slerf": true, "sloth": true,
		"nope": true, "wen": true, "samo": true, "doge": true, "shib": true,
		"pepe": true, "cope": true, "ape": true, "monkey": true, "frog": true,
		"moon": true, "rocket": true, "wojak": true, "jup": true, "jupiter": true,
		"pyth": true, "ray": true, "raydium": true,
	}

	// Convert to our token price format
	var prices []types.TokenPrice
	for _, token := range jupiterResp {
		symbol := token["symbol"].(string)
		name := token["name"].(string)
		address := token["address"].(string)

		// Check if it's a memecoin (if we're only interested in memecoins)
		symbolLower := strings.ToLower(symbol)
		nameLower := strings.ToLower(name)
		isMemecoin := knownMemecoins[symbolLower] || knownMemecoins[nameLower]

		// Skip if not a memecoin and we're only interested in memecoins
		if !isMemecoin {
			continue
		}

		// Extract daily volume if available
		var volume float64
		if dailyVolume, ok := token["daily_volume"].(float64); ok {
			volume = dailyVolume
		}

		// Add to prices list
		prices = append(prices, types.TokenPrice{
			Symbol:        symbol,
			Name:          name,
			Address:       address,
			ChainID:       1399811149, // Solana chain ID
			ChainName:     "solana",
			PriceUSD:      volume,
			LastUpdated:   time.Now(),
			Source:        types.PriceSourceJupiter,
			IsVerified:    true,
			JupiterVolume: volume,
		})
	}

	logger.Info("Fetched Jupiter token prices", "count", len(prices))
	return prices, nil
}

// SavePricesToCacheActivity saves token prices to the cache
func (a *PriceActivities) SavePricesToCacheActivity(ctx context.Context, prices []types.TokenPrice) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Saving token prices to cache", "count", len(prices))

	// Create a map of prices by symbol-chainId
	priceMap := make(map[string]types.TokenPrice)
	for _, price := range prices {
		key := types.GetPriceKey(price.Symbol, price.ChainID)
		priceMap[key] = price
	}

	// Create cache object
	cache := types.PriceCache{
		Prices:      priceMap,
		LastUpdated: time.Now(),
		ExpiresAt:   time.Now().Add(1 * time.Hour), // Cache expires after 1 hour
	}

	// Marshal to JSON
	data, err := json.Marshal(cache)
	if err != nil {
		return err
	}

	// Write to cache file
	cacheFile := filepath.Join(a.cacheDir, "price_cache.json")
	if err := ioutil.WriteFile(cacheFile, data, 0644); err != nil {
		return err
	}

	logger.Info("Saved token prices to cache", "file", cacheFile)
	return nil
}

// LoadPricesFromCacheActivity loads token prices from the cache
func (a *PriceActivities) LoadPricesFromCacheActivity(ctx context.Context, request types.PriceFetchRequest) ([]types.TokenPrice, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Loading token prices from cache")

	// Check if cache file exists
	cacheFile := filepath.Join(a.cacheDir, "price_cache.json")
	if _, err := os.Stat(cacheFile); os.IsNotExist(err) {
		return nil, temporal.NewNonRetryableApplicationError(
			"Cache file does not exist",
			"CACHE_NOT_FOUND",
			err)
	}

	// Read cache file
	data, err := ioutil.ReadFile(cacheFile)
	if err != nil {
		return nil, err
	}

	// Unmarshal from JSON
	var cache types.PriceCache
	if err := json.Unmarshal(data, &cache); err != nil {
		return nil, err
	}

	// Check if cache is expired
	if time.Now().After(cache.ExpiresAt) && !request.ForceSync {
		return nil, temporal.NewNonRetryableApplicationError(
			"Cache is expired",
			"CACHE_EXPIRED",
			errors.New("cache expired"))
	}

	// Convert map to slice
	var prices []types.TokenPrice
	for _, price := range cache.Prices {
		// Filter by symbols if specified
		if len(request.Symbols) > 0 {
			found := false
			for _, symbol := range request.Symbols {
				if strings.EqualFold(price.Symbol, symbol) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Filter by chain IDs if specified
		if len(request.ChainIDs) > 0 {
			found := false
			for _, chainID := range request.ChainIDs {
				if price.ChainID == chainID {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		prices = append(prices, price)
	}

	logger.Info("Loaded token prices from cache", "count", len(prices))
	return prices, nil
}

// MergePricesActivity merges token prices from different sources
func (a *PriceActivities) MergePricesActivity(ctx context.Context, pricesList [][]types.TokenPrice) ([]types.TokenPrice, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Merging token prices from different sources")

	// Create a map to store merged prices
	mergedPrices := make(map[string]types.TokenPrice)

	// Process each price list
	for _, prices := range pricesList {
		for _, price := range prices {
			key := types.GetPriceKey(price.Symbol, price.ChainID)

			// Determine source priority (lower is better)
			sourcePriority := map[types.PriceSource]int{
				types.PriceSourceCoinGecko: 1,
				types.PriceSourceUniversal: 2,
				types.PriceSourceJupiter:   3,
				types.PriceSourceFallback:  4,
			}

			// If price already exists, update it based on source priority
			if existing, ok := mergedPrices[key]; ok {
				existingPriority := sourcePriority[existing.Source]
				newPriority := sourcePriority[price.Source]

				// Keep existing price if it has higher priority
				if existingPriority <= newPriority {
					// But still merge some fields from Jupiter
					if price.Source == types.PriceSourceJupiter {
						existing.JupiterVolume = price.JupiterVolume
						existing.IsVerified = true
						mergedPrices[key] = existing
					}
					continue
				}
			}

			// Add new price or replace existing with higher priority
			mergedPrices[key] = price
		}
	}

	// Convert map to slice
	var result []types.TokenPrice
	for _, price := range mergedPrices {
		result = append(result, price)
	}

	logger.Info("Merged token prices", "count", len(result))
	return result, nil
}
