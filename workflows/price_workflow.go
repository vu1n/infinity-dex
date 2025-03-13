package workflows

import (
	"fmt"
	"time"

	"github.com/infinity-dex/services/types"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// PriceOracleWorkflow is the workflow definition for fetching and caching token prices
// It orchestrates the following steps:
// 1. Try to load prices from cache
// 2. If cache is expired or missing, fetch prices from all sources
// 3. Merge prices from different sources
// 4. Save merged prices to cache
// 5. Return the prices
func PriceOracleWorkflow(ctx workflow.Context, request types.PriceFetchRequest) (*types.PriceFetchResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("PriceOracleWorkflow started", "requestID", request.RequestID)

	// If no request ID provided, generate one (deterministic based on workflow ID)
	if request.RequestID == "" {
		info := workflow.GetInfo(ctx)
		request.RequestID = fmt.Sprintf("req-%s", info.WorkflowExecution.ID)
	}

	// Set timestamp if not provided
	if request.Timestamp.IsZero() {
		request.Timestamp = workflow.Now(ctx)
	}

	// Initialize result object
	result := &types.PriceFetchResult{
		RequestID: request.RequestID,
		Timestamp: request.Timestamp,
		CacheHit:  false,
		Prices:    []types.TokenPrice{},
	}

	// Define retry policy for activities
	options := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, options)

	// 1. Try to load prices from cache if not forcing sync
	if !request.ForceSync {
		var cachedPrices []types.TokenPrice
		err := workflow.ExecuteActivity(ctx, "LoadPricesFromCacheActivity", request).Get(ctx, &cachedPrices)

		// If cache is valid, return cached prices
		if err == nil && len(cachedPrices) > 0 {
			logger.Info("Using cached prices", "count", len(cachedPrices))
			result.Prices = cachedPrices
			result.CacheHit = true
			result.SuccessSources = []string{"cache"}
			return result, nil
		}

		// Log cache miss reason
		if err != nil {
			logger.Info("Cache miss", "reason", err.Error())
		} else {
			logger.Info("Cache miss", "reason", "empty cache")
		}
	}

	// 2. Fetch prices from all sources in parallel
	// Define sources to fetch from
	sources := []string{
		string(types.PriceSourceCoinGecko),
		string(types.PriceSourceJupiter),
	}

	// If Universal SDK is available, add it to sources
	if request.Sources == nil || len(request.Sources) == 0 {
		request.Sources = sources
	}

	// Create futures for each source
	futures := make(map[string]workflow.Future)
	for _, source := range request.Sources {
		switch source {
		case string(types.PriceSourceUniversal):
			futures[source] = workflow.ExecuteActivity(ctx, "FetchUniversalPricesActivity", request)
		case string(types.PriceSourceCoinGecko):
			futures[source] = workflow.ExecuteActivity(ctx, "FetchCoinGeckoPricesActivity", request)
		case string(types.PriceSourceJupiter):
			futures[source] = workflow.ExecuteActivity(ctx, "FetchJupiterPricesActivity", request)
		}
	}

	// Wait for all futures to complete
	var successSources []string
	var failedSources []string
	var pricesList [][]types.TokenPrice

	for source, future := range futures {
		var prices []types.TokenPrice
		err := future.Get(ctx, &prices)
		if err != nil {
			logger.Error("Failed to fetch prices from source", "source", source, "error", err)
			failedSources = append(failedSources, source)
			continue
		}

		logger.Info("Fetched prices from source", "source", source, "count", len(prices))
		successSources = append(successSources, source)
		pricesList = append(pricesList, prices)
	}

	// 3. Merge prices from different sources
	if len(pricesList) == 0 {
		result.ErrorMessage = "Failed to fetch prices from any source"
		result.FailedSources = failedSources
		return result, workflow.NewContinueAsNewError(ctx, "PriceOracleWorkflow", request)
	}

	var mergedPrices []types.TokenPrice
	err := workflow.ExecuteActivity(ctx, "MergePricesActivity", pricesList).Get(ctx, &mergedPrices)
	if err != nil {
		logger.Error("Failed to merge prices", "error", err)
		result.ErrorMessage = "Failed to merge prices: " + err.Error()
		result.FailedSources = append(failedSources, "merge")
		return result, err
	}

	// 4. Save merged prices to cache
	err = workflow.ExecuteActivity(ctx, "SavePricesToCacheActivity", mergedPrices).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to save prices to cache", "error", err)
		// Continue anyway, just log the error
	}

	// 5. Return the prices
	result.Prices = mergedPrices
	result.SuccessSources = successSources
	result.FailedSources = failedSources

	logger.Info("PriceOracleWorkflow completed successfully",
		"requestID", request.RequestID,
		"priceCount", len(mergedPrices),
		"successSources", successSources,
		"failedSources", failedSources)

	return result, nil
}

// ScheduledPriceUpdateWorkflow is a workflow that runs on a schedule to update the price cache
func ScheduledPriceUpdateWorkflow(ctx workflow.Context) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("ScheduledPriceUpdateWorkflow started")

	// No need to define cronSchedule here since we're using a fixed interval

	// Counter for deterministic child workflow IDs
	var runCounter int

	for {
		// Create a request to fetch all prices
		request := types.PriceFetchRequest{
			RequestID: fmt.Sprintf("req-%d", runCounter), // Deterministic ID based on counter
			Timestamp: workflow.Now(ctx),                 // Use workflow.Now instead of time.Now
			ForceSync: true,
			Sources:   []string{string(types.PriceSourceCoinGecko), string(types.PriceSourceJupiter)},
		}

		// Create a deterministic child workflow ID
		childWorkflowID := fmt.Sprintf("price-oracle-run-%d", runCounter)

		// Execute the price oracle workflow
		childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
			WorkflowID:         childWorkflowID,
			WorkflowRunTimeout: 2 * time.Minute,
		})

		var result types.PriceFetchResult
		err := workflow.ExecuteChildWorkflow(childCtx, "PriceOracleWorkflow", request).Get(ctx, &result)
		if err != nil {
			logger.Error("Failed to execute price oracle workflow", "error", err)
		} else {
			logger.Info("Price oracle workflow completed successfully",
				"priceCount", len(result.Prices),
				"successSources", result.SuccessSources,
				"failedSources", result.FailedSources)
		}

		// Increment counter for next run
		runCounter++

		// Sleep for 15 seconds before the next run
		sleepDuration := 15 * time.Second
		logger.Info("Sleeping until next scheduled run", "duration", sleepDuration)

		if err := workflow.Sleep(ctx, sleepDuration); err != nil {
			return err
		}
	}
}
