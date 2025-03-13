package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/infinity-dex/activities"
	"github.com/infinity-dex/config"
	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
	"github.com/infinity-dex/workflows"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

const (
	// TaskQueue is the name of the task queue used for price oracle workflows
	TaskQueue = "price-oracle-queue"
)

func main() {
	log.Println("Starting Price Oracle Worker...")

	// Create a Temporal client
	c, err := client.Dial(client.Options{
		HostPort: "localhost:7233", // Local Temporal server
	})
	if err != nil {
		log.Fatalf("Failed to create Temporal client: %v", err)
	}
	defer c.Close()

	// Create a worker
	w := worker.New(c, TaskQueue, worker.Options{})

	// Initialize Universal SDK with mock configuration
	sdkConfig := universalsdk.MockSDKConfig{
		WrappedTokens: make(map[int64][]types.Token),
		Latency:       100 * time.Millisecond,
		FailureRate:   0.05, // 5% failure rate for testing
	}
	sdk := universalsdk.NewMockSDK(sdkConfig)

	// Set up cache directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Failed to get user home directory: %v", err)
	}
	cacheDir := filepath.Join(homeDir, ".infinity-dex", "price-cache")

	// Initialize database connection
	dbConfig := config.DefaultDBConfig()
	dbPool, err := config.NewDBPool(dbConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Initialize database schema
	schemaPath := filepath.Join("db", "schema.sql")
	if err := config.InitDatabase(dbPool, schemaPath); err != nil {
		log.Fatalf("Failed to initialize database schema: %v", err)
	}

	// Initialize activities
	priceActivities := activities.NewPriceActivities(sdk, cacheDir)
	dbActivities := activities.NewDBActivities(dbPool)

	// Register workflows
	w.RegisterWorkflow(workflows.PriceOracleWorkflow)
	w.RegisterWorkflow(workflows.ScheduledPriceUpdateWorkflow)

	// Register activities
	w.RegisterActivity(priceActivities.FetchUniversalPricesActivity)
	w.RegisterActivity(priceActivities.FetchCoinGeckoPricesActivity)
	w.RegisterActivity(priceActivities.FetchJupiterPricesActivity)
	w.RegisterActivity(priceActivities.SavePricesToCacheActivity)
	w.RegisterActivity(priceActivities.LoadPricesFromCacheActivity)
	w.RegisterActivity(priceActivities.MergePricesActivity)

	// Register database activities
	w.RegisterActivity(dbActivities.SavePricesToDatabaseActivity)
	w.RegisterActivity(dbActivities.GetLatestTokenPricesActivity)
	w.RegisterActivity(dbActivities.GetTokenPriceHistoryActivity)

	// Start the worker
	err = w.Start()
	if err != nil {
		log.Fatalf("Failed to start worker: %v", err)
	}

	// Start the scheduled workflow with a new ID to avoid nondeterminism issues
	workflowOptions := client.StartWorkflowOptions{
		ID:        "scheduled-price-update-v2", // New workflow ID
		TaskQueue: TaskQueue,
	}

	we, err := c.ExecuteWorkflow(
		context.Background(),
		workflowOptions,
		workflows.ScheduledPriceUpdateWorkflow,
	)
	if err != nil {
		log.Fatalf("Failed to start scheduled workflow: %v", err)
	}

	log.Printf("Started scheduled workflow with ID: %s and Run ID: %s", we.GetID(), we.GetRunID())

	// Wait for termination signal
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)
	<-signalChan

	log.Println("Shutting down worker...")
}
