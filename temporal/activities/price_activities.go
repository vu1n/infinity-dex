package temporal_activities

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
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
func (a *PriceActivities) FetchJupiterPricesActivity(ctx context.Context, request types.PriceFetchRequest) (
	[]types.TokenPrice, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Fetching Jupiter token prices")

	// Step 1: Get the list of verified tokens from Jupiter
	tokensURL := "https://api.jup.ag/tokens/v1/tagged/verified"
	logger.Info("Fetching verified tokens from Jupiter API", "url", tokensURL)

	// Make request to Jupiter tokens API
	tokensResp, err := a.httpClient.Get(tokensURL)
	if err != nil {
		return nil, temporal.NewNonRetryableApplicationError(
			"Failed to fetch Jupiter tokens",
			"JUPITER_API_ERROR",
			err)
	}
	defer tokensResp.Body.Close()

	// Check response status
	if tokensResp.StatusCode != http.StatusOK {
		return nil, temporal.NewNonRetryableApplicationError(
			fmt.Sprintf("Jupiter tokens API returned status %d", tokensResp.StatusCode),
			"JUPITER_API_ERROR",
			errors.New("non-200 status code"))
	}

	// Parse tokens response
	var jupiterTokens []map[string]interface{}
	tokensBody, err := ioutil.ReadAll(tokensResp.Body)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(tokensBody, &jupiterTokens); err != nil {
		logger.Error("Failed to parse Jupiter tokens response", "error", err)
		if len(tokensBody) > 200 {
			logger.Info("Jupiter tokens response sample", "body", string(tokensBody[:200])+"...")
		} else {
			logger.Info("Jupiter tokens response", "body", string(tokensBody))
		}
		return nil, err
	}

	logger.Info("Received Jupiter verified tokens", "count", len(jupiterTokens))

	// Create a slice to store token information for sorting
	type TokenInfo struct {
		Address string
		Symbol  string
		Name    string
		Volume  float64
	}
	var tokenInfoList []TokenInfo

	// Extract token information
	for _, token := range jupiterTokens {
		symbol := token["symbol"].(string)
		name := token["name"].(string)
		address := token["address"].(string)

		// Extract daily volume if available
		var volume float64
		if dailyVolume, ok := token["daily_volume"].(float64); ok {
			volume = dailyVolume
		}

		// Add to the list
		tokenInfoList = append(tokenInfoList, TokenInfo{
			Address: address,
			Symbol:  symbol,
			Name:    name,
			Volume:  volume,
		})
	}

	logger.Info("Extracted token information", "count", len(tokenInfoList))

	// TODO: Cache or store these tokens in the database for future use
	// This would reduce external IO in later calls

	// Step 2: Sort tokens by daily volume (descending) and get top 50
	sort.Slice(tokenInfoList, func(i, j int) bool {
		return tokenInfoList[i].Volume > tokenInfoList[j].Volume
	})

	// Get top 50 tokens or all if less than 50
	topTokenCount := 50
	if len(tokenInfoList) < topTokenCount {
		topTokenCount = len(tokenInfoList)
	}
	topTokens := tokenInfoList[:topTokenCount]

	// Create a map for quick lookup of token info
	tokenInfoMap := make(map[string]TokenInfo)
	var tokenIds []string
	for _, token := range topTokens {
		tokenIds = append(tokenIds, token.Address)
		tokenInfoMap[token.Address] = token
	}

	logger.Info("Selected top tokens by volume", "count", len(tokenIds))

	// Log a few top tokens for debugging
	for i, token := range topTokens {
		if i < 5 {
			logger.Info("Top token",
				"rank", i+1,
				"symbol", token.Symbol,
				"name", token.Name,
				"address", token.Address,
				"volume", token.Volume)
		} else {
			break
		}
	}

	// Step 3: Fetch prices for the top tokens using the Jupiter price API
	// The API supports up to 100 IDs, but we're using 50 as specified
	priceURL := fmt.Sprintf("https://api.jup.ag/price/v2?ids=%s", strings.Join(tokenIds, ","))
	logger.Info("Fetching Jupiter prices from API", "url", priceURL, "token_count", len(tokenIds))

	// Make request to Jupiter Price API
	priceResp, err := a.httpClient.Get(priceURL)
	if err != nil {
		return nil, temporal.NewNonRetryableApplicationError(
			"Failed to fetch Jupiter prices",
			"JUPITER_API_ERROR",
			err)
	}
	defer priceResp.Body.Close()

	// Check response status
	if priceResp.StatusCode != http.StatusOK {
		return nil, temporal.NewNonRetryableApplicationError(
			fmt.Sprintf("Jupiter Price API returned status %d", priceResp.StatusCode),
			"JUPITER_API_ERROR",
			errors.New("non-200 status code"))
	}

	// Parse price response
	var jupiterPriceResp map[string]float64
	priceBody, err := ioutil.ReadAll(priceResp.Body)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(priceBody, &jupiterPriceResp); err != nil {
		logger.Error("Failed to parse Jupiter price response", "error", err)

		// The API response format has changed, try parsing the new format
		var newFormatResp struct {
			Data map[string]struct {
				ID    string `json:"id"`
				Type  string `json:"type"`
				Price string `json:"price"`
			} `json:"data"`
		}

		if err := json.Unmarshal(priceBody, &newFormatResp); err != nil {
			// Log a sample of the response body for debugging
			if len(priceBody) > 200 {
				logger.Info("Jupiter price response sample", "body", string(priceBody[:200])+"...")
			} else {
				logger.Info("Jupiter price response", "body", string(priceBody))
			}
			return nil, err
		}

		// Convert the new format to our expected map
		jupiterPriceResp = make(map[string]float64)
		for mint, priceData := range newFormatResp.Data {
			// Convert string price to float64
			price, err := strconv.ParseFloat(priceData.Price, 64)
			if err != nil {
				logger.Warn("Failed to parse price as float", "mint", mint, "price_str", priceData.Price)
				continue
			}
			jupiterPriceResp[mint] = price
		}

		logger.Info("Successfully parsed Jupiter price data using new format", "count", len(jupiterPriceResp))
	}

	logger.Info("Received Jupiter price data", "count", len(jupiterPriceResp))

	// Convert to our token price format
	var prices []types.TokenPrice
	var matchedCount, skippedCount int

	for mint, price := range jupiterPriceResp {
		// Skip if we don't have token info for this mint
		info, exists := tokenInfoMap[mint]
		if !exists {
			skippedCount++
			continue
		}

		matchedCount++

		// Add to prices list
		prices = append(prices, types.TokenPrice{
			Symbol:        info.Symbol,
			Name:          info.Name,
			Address:       mint,
			ChainID:       1399811149, // Solana chain ID
			ChainName:     "solana",
			PriceUSD:      price,
			Change24h:     0, // Change data not available in this API response
			LastUpdated:   time.Now(),
			Source:        types.PriceSourceJupiter,
			IsVerified:    true,
			JupiterVolume: info.Volume,
		})
	}

	logger.Info("Processed Jupiter token prices",
		"total_prices", len(jupiterPriceResp),
		"matched", matchedCount,
		"skipped", skippedCount,
		"final_count", len(prices))

	// Log a few price entries for debugging
	for i, price := range prices {
		if i < 5 {
			logger.Info("Price entry",
				"symbol", price.Symbol,
				"price_usd", price.PriceUSD,
				"volume", price.JupiterVolume)
		} else {
			break
		}
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
