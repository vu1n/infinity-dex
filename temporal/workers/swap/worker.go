package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/infinity-dex/services"
	"github.com/infinity-dex/services/types"
	temporal_activities "github.com/infinity-dex/temporal/activities"
	temporal_config "github.com/infinity-dex/temporal/config"
	temporal_workflows "github.com/infinity-dex/temporal/workflows"
	"github.com/infinity-dex/universalsdk"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

const (
	// SwapTaskQueue is the name of the task queue used for swap workflows
	SwapTaskQueue = "swap-queue"
)

// RunSwapWorker starts the swap worker
func RunSwapWorker() {
	log.Println("Starting Swap Worker...")

	// Create a Temporal client
	c, err := client.Dial(client.Options{
		HostPort: "localhost:7233", // Local Temporal server
	})
	if err != nil {
		log.Fatalf("Failed to create Temporal client: %v", err)
	}
	defer c.Close()

	// Create a worker
	w := worker.New(c, SwapTaskQueue, worker.Options{})

	// Initialize Universal SDK with mock configuration
	sdkConfig := universalsdk.MockSDKConfig{
		WrappedTokens: make(map[int64][]types.Token),
		Latency:       100,
		FailureRate:   0.05, // 5% failure rate for testing
	}
	sdk := universalsdk.NewMockSDK(sdkConfig)

	// Initialize database connection
	dbConfig := temporal_config.DefaultDBConfig()
	dbPool, err := temporal_config.NewDBPool(dbConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Initialize services
	tokenService := services.NewTokenService()
	transactionService := services.NewTransactionService()
	swapService := services.NewSwapService(tokenService, transactionService, sdk)

	// Initialize activities
	swapActivities := temporal_activities.NewSwapActivities(sdk, swapService)

	// Register workflows
	w.RegisterWorkflow(temporal_workflows.SwapWorkflow)

	// Register activities
	w.RegisterActivity(swapActivities.CalculateSwapQuoteActivity)
	w.RegisterActivity(swapActivities.ExecuteSwapActivity)
	w.RegisterActivity(swapActivities.CancelSwapActivity)

	// Start the worker
	err = w.Start()
	if err != nil {
		log.Fatalf("Failed to start worker: %v", err)
	}

	// Wait for termination signal
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)
	<-signalChan

	log.Println("Shutting down worker...")
}

// Main function to be called from other packages
func main() {
	RunSwapWorker()
}
