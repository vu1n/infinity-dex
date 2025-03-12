package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/infinity-dex/activities"
	"github.com/infinity-dex/config"
	"github.com/infinity-dex/services"
	"github.com/infinity-dex/universalsdk"
	"github.com/infinity-dex/workflows"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"go.uber.org/zap"
)

// temporalLogger adapts a zap.SugaredLogger to the temporal logger interface
type temporalLogger struct {
	logger *zap.SugaredLogger
}

// Debug logs a debug message.
func (l *temporalLogger) Debug(msg string, keyvals ...interface{}) {
	l.logger.Debugw(msg, keyvals...)
}

// Info logs an info message.
func (l *temporalLogger) Info(msg string, keyvals ...interface{}) {
	l.logger.Infow(msg, keyvals...)
}

// Warn logs a warning message.
func (l *temporalLogger) Warn(msg string, keyvals ...interface{}) {
	l.logger.Warnw(msg, keyvals...)
}

// Error logs an error message.
func (l *temporalLogger) Error(msg string, keyvals ...interface{}) {
	l.logger.Errorw(msg, keyvals...)
}

func main() {
	// Load configuration
	cfg, err := config.LoadConfig("")
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	zapLogger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer zapLogger.Sync()
	logger := zapLogger.Sugar()
	temporalLogAdapter := &temporalLogger{logger: logger}

	logger.Info("Starting Infinity DEX worker")
	logger.Infof("Connecting to Temporal server at %s", cfg.Temporal.HostPort)

	// Create Temporal client
	c, err := client.Dial(client.Options{
		HostPort:  cfg.Temporal.HostPort,
		Namespace: cfg.Temporal.Namespace,
		Logger:    temporalLogAdapter,
	})
	if err != nil {
		logger.Fatalf("Failed to create Temporal client: %v", err)
	}
	defer c.Close()
	logger.Info("Connected to Temporal server")

	// Initialize Universal SDK with mock implementation for now
	// In production, this would use the real Universal SDK
	mockSDKConfig := universalsdk.MockSDKConfig{
		WrappedTokens: createMockWrappedTokens(cfg),
		Latency:       200 * time.Millisecond, // Simulate API latency
		FailureRate:   0.05,                   // 5% chance of transaction failure
	}
	universalSDK := universalsdk.NewMockSDK(mockSDKConfig)

	// Create activities
	swapActivities := activities.NewSwapActivities(universalSDK)

	// Create worker
	w := worker.New(c, cfg.Temporal.TaskQueue, worker.Options{})

	// Register workflow and activities
	w.RegisterWorkflow(workflows.SwapWorkflow)
	w.RegisterActivity(swapActivities.CalculateFeeActivity)
	w.RegisterActivity(swapActivities.WrapTokenActivity)
	w.RegisterActivity(swapActivities.TransferTokenActivity)
	w.RegisterActivity(swapActivities.SwapTokensActivity)
	w.RegisterActivity(swapActivities.UnwrapTokenActivity)

	// Start worker
	err = w.Start()
	if err != nil {
		logger.Fatalf("Failed to start worker: %v", err)
	}

	logger.Info("Worker started")
	logger.Infof("Worker namespace: %s", cfg.Temporal.Namespace)
	logger.Infof("Worker task queue: %s", cfg.Temporal.TaskQueue)

	// Wait for termination signal
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	logger.Info("Shutdown signal received, stopping worker")
	w.Stop()
	logger.Info("Worker stopped")
}

// createMockWrappedTokens creates mock wrapped tokens for testing
func createMockWrappedTokens(cfg config.Config) map[int64][]services.Token {
	tokens := make(map[int64][]services.Token)

	// Ethereum tokens (Chain ID: 1)
	tokens[1] = []services.Token{
		{
			Symbol:    "uETH",
			Name:      "Universal Ethereum",
			Decimals:  18,
			Address:   "0x1111111111111111111111111111111111111111",
			ChainID:   1,
			ChainName: "Ethereum",
			IsWrapped: true,
		},
		{
			Symbol:    "uUSDC",
			Name:      "Universal USD Coin",
			Decimals:  6,
			Address:   "0x2222222222222222222222222222222222222222",
			ChainID:   1,
			ChainName: "Ethereum",
			IsWrapped: true,
		},
		{
			Symbol:    "uUSDT",
			Name:      "Universal Tether",
			Decimals:  6,
			Address:   "0x3333333333333333333333333333333333333333",
			ChainID:   1,
			ChainName: "Ethereum",
			IsWrapped: true,
		},
		{
			Symbol:    "uDAI",
			Name:      "Universal Dai",
			Decimals:  18,
			Address:   "0x4444444444444444444444444444444444444444",
			ChainID:   1,
			ChainName: "Ethereum",
			IsWrapped: true,
		},
	}

	// Polygon tokens (Chain ID: 137)
	tokens[137] = []services.Token{
		{
			Symbol:    "uMATIC",
			Name:      "Universal Matic",
			Decimals:  18,
			Address:   "0x5555555555555555555555555555555555555555",
			ChainID:   137,
			ChainName: "Polygon",
			IsWrapped: true,
		},
		{
			Symbol:    "uUSDC",
			Name:      "Universal USD Coin",
			Decimals:  6,
			Address:   "0x6666666666666666666666666666666666666666",
			ChainID:   137,
			ChainName: "Polygon",
			IsWrapped: true,
		},
		{
			Symbol:    "uUSDT",
			Name:      "Universal Tether",
			Decimals:  6,
			Address:   "0x7777777777777777777777777777777777777777",
			ChainID:   137,
			ChainName: "Polygon",
			IsWrapped: true,
		},
		{
			Symbol:    "uDAI",
			Name:      "Universal Dai",
			Decimals:  18,
			Address:   "0x8888888888888888888888888888888888888888",
			ChainID:   137,
			ChainName: "Polygon",
			IsWrapped: true,
		},
	}

	// Add more chains as needed

	return tokens
}
