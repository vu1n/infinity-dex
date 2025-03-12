package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultConfig(t *testing.T) {
	// Get default config
	cfg := DefaultConfig()

	// Verify default values
	assert.Equal(t, "development", cfg.Environment)
	assert.Equal(t, "info", cfg.LogLevel)

	// Verify temporal config
	assert.Equal(t, "localhost:7233", cfg.Temporal.HostPort)
	assert.Equal(t, "infinity-dex", cfg.Temporal.Namespace)
	assert.Equal(t, "dex-tasks", cfg.Temporal.TaskQueue)
	assert.Equal(t, 24*time.Hour, cfg.Temporal.WorkflowTTL)

	// Verify universal config
	assert.Equal(t, "https://api.universal.xyz", cfg.Universal.APIURL)
	assert.Equal(t, "", cfg.Universal.APIKey) // Empty by default
	assert.Equal(t, "0.01", cfg.Universal.MinTokenWrap)

	// Verify chain config
	assert.Len(t, cfg.Chains, 5) // 5 chains configured by default
	assert.Contains(t, cfg.Chains, "ethereum")
	assert.Contains(t, cfg.Chains, "polygon")
	assert.Contains(t, cfg.Chains, "solana")
	assert.Contains(t, cfg.Chains, "avalanche")
	assert.Contains(t, cfg.Chains, "binance")

	// Verify ethereum chain config
	eth := cfg.Chains["ethereum"]
	assert.Equal(t, "Ethereum", eth.Name)
	assert.Equal(t, int64(1), eth.ChainID)
	assert.Contains(t, eth.WrappedTokens, "uETH")
	assert.Contains(t, eth.WrappedTokens, "uUSDC")

	// Verify server config
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, "*", cfg.Server.CORSAllowOrigin)
	assert.Equal(t, 30*time.Second, cfg.Server.Timeout)

	// Verify swap config
	assert.Equal(t, 0.5, cfg.Swap.DefaultSlippage)
	assert.Equal(t, "100000", cfg.Swap.MaxSwapAmount)
	assert.Equal(t, 30*time.Second, cfg.Swap.MaxSwapTime)
}

func TestLoadConfig(t *testing.T) {
	// Create a temporary test file
	tempDir, err := os.MkdirTemp("", "config-test")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	configPath := filepath.Join(tempDir, "config.yaml")
	configContent := `
ENVIRONMENT: "production"
LOG_LEVEL: "error"

TEMPORAL:
  HOST_PORT: "temporal.example.com:7233"
  NAMESPACE: "prod-dex"
  TASK_QUEUE: "prod-tasks"
  WORKFLOW_TTL: "48h"

UNIVERSAL:
  API_URL: "https://prod.universal.xyz"
  API_KEY: "test-api-key"
  MIN_TOKEN_WRAP: "0.1"

SERVER:
  PORT: 9090
  CORS_ALLOW_ORIGIN: "https://app.example.com"
  TIMEOUT: "60s"

SWAP:
  DEFAULT_SLIPPAGE: 1.0
  MAX_SWAP_AMOUNT: "500000"
  MAX_SWAP_TIME: "60s"
`
	err = os.WriteFile(configPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Load the config from the test file
	cfg, err := LoadConfig(configPath)
	require.NoError(t, err)

	// Verify loaded values
	assert.Equal(t, "production", cfg.Environment)
	assert.Equal(t, "error", cfg.LogLevel)

	// Verify temporal config
	assert.Equal(t, "temporal.example.com:7233", cfg.Temporal.HostPort)
	assert.Equal(t, "prod-dex", cfg.Temporal.Namespace)
	assert.Equal(t, "prod-tasks", cfg.Temporal.TaskQueue)
	assert.Equal(t, 48*time.Hour, cfg.Temporal.WorkflowTTL)

	// Verify universal config
	assert.Equal(t, "https://prod.universal.xyz", cfg.Universal.APIURL)
	assert.Equal(t, "test-api-key", cfg.Universal.APIKey)
	assert.Equal(t, "0.1", cfg.Universal.MinTokenWrap)

	// Verify server config
	assert.Equal(t, 9090, cfg.Server.Port)
	assert.Equal(t, "https://app.example.com", cfg.Server.CORSAllowOrigin)
	assert.Equal(t, 60*time.Second, cfg.Server.Timeout)

	// Verify swap config
	assert.Equal(t, 1.0, cfg.Swap.DefaultSlippage)
	assert.Equal(t, "500000", cfg.Swap.MaxSwapAmount)
	assert.Equal(t, 60*time.Second, cfg.Swap.MaxSwapTime)
}

func TestLoadConfigFromEnvironment(t *testing.T) {
	// Save the original environment variables
	originalAPIKey := os.Getenv("UNIVERSAL_API_KEY")
	defer os.Setenv("UNIVERSAL_API_KEY", originalAPIKey)

	// Set environment variable
	os.Setenv("UNIVERSAL_API_KEY", "env-api-key")

	// Load default config (no file)
	cfg, err := LoadConfig("")
	require.NoError(t, err)

	// Verify environment variable was loaded
	assert.Equal(t, "env-api-key", cfg.Universal.APIKey)
}

func TestLoadConfigInvalidFile(t *testing.T) {
	// Try to load config from a non-existent file
	cfg, err := LoadConfig("non-existent-file.yaml")

	// The error is ignored and defaults are used
	require.NoError(t, err)
	assert.Equal(t, "development", cfg.Environment)
	assert.Equal(t, "info", cfg.LogLevel)
}
