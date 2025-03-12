package config

import (
	"os"
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the application
type Config struct {
	Environment string `mapstructure:"ENVIRONMENT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`

	// Temporal configuration
	Temporal TemporalConfig `mapstructure:"TEMPORAL"`

	// Universal.xyz configuration
	Universal UniversalConfig `mapstructure:"UNIVERSAL"`

	// Blockchain configurations
	Chains map[string]ChainConfig `mapstructure:"CHAINS"`

	// Server configuration
	Server ServerConfig `mapstructure:"SERVER"`

	// Swap configuration
	Swap SwapConfig `mapstructure:"SWAP"`
}

// TemporalConfig contains Temporal-specific configuration
type TemporalConfig struct {
	HostPort    string        `mapstructure:"HOST_PORT"`
	Namespace   string        `mapstructure:"NAMESPACE"`
	TaskQueue   string        `mapstructure:"TASK_QUEUE"`
	WorkflowTTL time.Duration `mapstructure:"WORKFLOW_TTL"`
}

// UniversalConfig contains Universal.xyz-specific configuration
type UniversalConfig struct {
	APIURL       string `mapstructure:"API_URL"`
	APIKey       string `mapstructure:"API_KEY"`
	MinTokenWrap string `mapstructure:"MIN_TOKEN_WRAP"`
}

// ChainConfig holds blockchain-specific configuration
type ChainConfig struct {
	Name             string   `mapstructure:"NAME"`
	RPC              []string `mapstructure:"RPC"`
	ChainID          int64    `mapstructure:"CHAIN_ID"`
	ExplorerURL      string   `mapstructure:"EXPLORER_URL"`
	UniversalAddress string   `mapstructure:"UNIVERSAL_ADDRESS"`
	DEXAddress       string   `mapstructure:"DEX_ADDRESS"`
	WrappedTokens    []string `mapstructure:"WRAPPED_TOKENS"`
}

// ServerConfig holds API server configuration
type ServerConfig struct {
	Port            int           `mapstructure:"PORT"`
	CORSAllowOrigin string        `mapstructure:"CORS_ALLOW_ORIGIN"`
	Timeout         time.Duration `mapstructure:"TIMEOUT"`
}

// SwapConfig holds swap-related configuration
type SwapConfig struct {
	DefaultSlippage float64       `mapstructure:"DEFAULT_SLIPPAGE"`
	MaxSwapAmount   string        `mapstructure:"MAX_SWAP_AMOUNT"`
	MaxSwapTime     time.Duration `mapstructure:"MAX_SWAP_TIME"`
}

// DefaultConfig returns the default configuration
func DefaultConfig() Config {
	return Config{
		Environment: "development",
		LogLevel:    "info",
		Temporal: TemporalConfig{
			HostPort:    "localhost:7233",
			Namespace:   "infinity-dex",
			TaskQueue:   "dex-tasks",
			WorkflowTTL: 24 * time.Hour,
		},
		Universal: UniversalConfig{
			APIURL:       "https://api.universal.xyz",
			APIKey:       "",
			MinTokenWrap: "0.01",
		},
		Chains: map[string]ChainConfig{
			"ethereum": {
				Name:             "Ethereum",
				RPC:              []string{"https://mainnet.infura.io/v3/${INFURA_KEY}"},
				ChainID:          1,
				ExplorerURL:      "https://etherscan.io",
				UniversalAddress: "",
				DEXAddress:       "",
				WrappedTokens:    []string{"uETH", "uUSDC", "uUSDT", "uDAI"},
			},
			"polygon": {
				Name:             "Polygon",
				RPC:              []string{"https://polygon-rpc.com"},
				ChainID:          137,
				ExplorerURL:      "https://polygonscan.com",
				UniversalAddress: "",
				DEXAddress:       "",
				WrappedTokens:    []string{"uMATIC", "uUSDC", "uUSDT", "uDAI"},
			},
			"solana": {
				Name:             "Solana",
				RPC:              []string{"https://api.mainnet-beta.solana.com"},
				ChainID:          0, // Not applicable for Solana
				ExplorerURL:      "https://explorer.solana.com",
				UniversalAddress: "",
				DEXAddress:       "",
				WrappedTokens:    []string{"uSOL", "uUSDC", "uUSDT"},
			},
			"avalanche": {
				Name:             "Avalanche",
				RPC:              []string{"https://api.avax.network/ext/bc/C/rpc"},
				ChainID:          43114,
				ExplorerURL:      "https://snowtrace.io",
				UniversalAddress: "",
				DEXAddress:       "",
				WrappedTokens:    []string{"uAVAX", "uUSDC", "uUSDT", "uDAI"},
			},
			"binance": {
				Name:             "Binance Smart Chain",
				RPC:              []string{"https://bsc-dataseed.binance.org"},
				ChainID:          56,
				ExplorerURL:      "https://bscscan.com",
				UniversalAddress: "",
				DEXAddress:       "",
				WrappedTokens:    []string{"uBNB", "uUSDC", "uUSDT", "uBUSD"},
			},
		},
		Server: ServerConfig{
			Port:            8080,
			CORSAllowOrigin: "*",
			Timeout:         30 * time.Second,
		},
		Swap: SwapConfig{
			DefaultSlippage: 0.5,
			MaxSwapAmount:   "100000",
			MaxSwapTime:     30 * time.Second,
		},
	}
}

// LoadConfig loads configuration from file and environment variables
func LoadConfig(configPath string) (Config, error) {
	config := DefaultConfig()

	if configPath != "" {
		viper.SetConfigFile(configPath)
	} else {
		viper.AddConfigPath(".")
		viper.AddConfigPath("./config")
		viper.SetConfigName("config")
		viper.SetConfigType("yaml")
	}

	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err == nil {
		if err := viper.Unmarshal(&config); err != nil {
			return config, err
		}
	}

	// Check for required environment variables
	if config.Universal.APIKey == "" {
		config.Universal.APIKey = os.Getenv("UNIVERSAL_API_KEY")
	}

	return config, nil
}
