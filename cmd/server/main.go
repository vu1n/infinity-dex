package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/infinity-dex/config"
	"github.com/infinity-dex/services/types"
	"github.com/infinity-dex/universalsdk"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/temporal"
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

// Server is the API server for the DEX
type Server struct {
	config         config.Config
	logger         *zap.SugaredLogger
	temporalClient client.Client
	router         *mux.Router
	httpServer     *http.Server
	universalSDK   universalsdk.SDK
}

// SwapRequest is the API request model for initiating a swap
type SwapRequest struct {
	SourceTokenSymbol       string  `json:"sourceTokenSymbol"`
	SourceTokenChainID      int64   `json:"sourceTokenChainId"`
	DestinationTokenSymbol  string  `json:"destinationTokenSymbol"`
	DestinationTokenChainID int64   `json:"destinationTokenChainId"`
	Amount                  string  `json:"amount"` // Decimal string representation
	SourceAddress           string  `json:"sourceAddress"`
	DestinationAddress      string  `json:"destinationAddress"`
	Slippage                float64 `json:"slippage"` // In percentage, e.g., 0.5 for 0.5%
	RefundAddress           string  `json:"refundAddress,omitempty"`
}

// SwapResponse is the API response model for a swap
type SwapResponse struct {
	RequestID string `json:"requestId"`
	Message   string `json:"message"`
}

// ErrorResponse is a standard error response
type ErrorResponse struct {
	Error string `json:"error"`
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

	logger.Info("Starting Infinity DEX API server")

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

	// Initialize Universal SDK with mock implementation
	mockSDKConfig := universalsdk.MockSDKConfig{
		WrappedTokens: createMockWrappedTokens(cfg),
		Latency:       200 * time.Millisecond,
		FailureRate:   0.05,
	}
	universalSDK := universalsdk.NewMockSDK(mockSDKConfig)

	// Initialize server
	server := &Server{
		config:         cfg,
		logger:         logger,
		temporalClient: c,
		router:         mux.NewRouter(),
		universalSDK:   universalSDK,
	}

	// Set up routes
	server.setupRoutes()

	// Start HTTP server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	server.httpServer = &http.Server{
		Addr:         addr,
		Handler:      server.router,
		ReadTimeout:  cfg.Server.Timeout,
		WriteTimeout: cfg.Server.Timeout,
		IdleTimeout:  2 * cfg.Server.Timeout,
	}

	// Run server in a goroutine
	go func() {
		logger.Infof("Server listening on %s", addr)
		if err := server.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for termination signal
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	logger.Info("Shutdown signal received, stopping server")

	// Create a deadline for server shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.httpServer.Shutdown(ctx); err != nil {
		logger.Errorf("Server shutdown error: %v", err)
	}

	logger.Info("Server stopped")
}

// setupRoutes configures the API routes
func (s *Server) setupRoutes() {
	// Health check
	s.router.HandleFunc("/health", s.healthHandler).Methods("GET")

	// API endpoints
	api := s.router.PathPrefix("/api/v1").Subrouter()
	api.HandleFunc("/swap", s.initiateSwapHandler).Methods("POST")
	api.HandleFunc("/swap/{requestId}", s.getSwapStatusHandler).Methods("GET")
	api.HandleFunc("/tokens", s.getTokensHandler).Methods("GET")
	api.HandleFunc("/tokens/{chainId}", s.getTokensByChainHandler).Methods("GET")

	// Global middleware
	s.router.Use(s.loggingMiddleware)
	s.router.Use(s.corsMiddleware)
}

// loggingMiddleware logs all requests
func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		s.logger.Infow("Request",
			"method", r.Method,
			"path", r.URL.Path,
			"duration", time.Since(start),
			"remote_addr", r.RemoteAddr,
		)
	})
}

// corsMiddleware handles CORS
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.config.Server.CORSAllowOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// healthHandler returns the server status
func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

// initiateSwapHandler starts a new swap workflow
func (s *Server) initiateSwapHandler(w http.ResponseWriter, r *http.Request) {
	var req SwapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.errorResponse(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	// Validate request fields
	if req.SourceTokenSymbol == "" || req.DestinationTokenSymbol == "" {
		s.errorResponse(w, "Missing token symbols", http.StatusBadRequest)
		return
	}

	if req.SourceAddress == "" || req.DestinationAddress == "" {
		s.errorResponse(w, "Missing addresses", http.StatusBadRequest)
		return
	}

	if req.Amount == "" {
		s.errorResponse(w, "Missing amount", http.StatusBadRequest)
		return
	}

	// Parse amount as big.Int
	amount, ok := new(big.Int).SetString(req.Amount, 10)
	if !ok {
		s.errorResponse(w, "Invalid amount format", http.StatusBadRequest)
		return
	}

	// Default slippage if not provided
	if req.Slippage == 0 {
		req.Slippage = s.config.Swap.DefaultSlippage
	}

	// Generate request ID
	requestID := uuid.New().String()

	// Create source token
	sourceToken, err := s.findToken(req.SourceTokenSymbol, req.SourceTokenChainID)
	if err != nil {
		s.errorResponse(w, fmt.Sprintf("Source token not found: %v", err), http.StatusBadRequest)
		return
	}

	// Create destination token
	destToken, err := s.findToken(req.DestinationTokenSymbol, req.DestinationTokenChainID)
	if err != nil {
		s.errorResponse(w, fmt.Sprintf("Destination token not found: %v", err), http.StatusBadRequest)
		return
	}

	// Create swap request for workflow
	swapRequest := types.SwapRequest{
		SourceToken:        sourceToken,
		DestinationToken:   destToken,
		Amount:             amount,
		SourceAddress:      req.SourceAddress,
		DestinationAddress: req.DestinationAddress,
		Slippage:           req.Slippage,
		Deadline:           time.Now().Add(s.config.Swap.MaxSwapTime),
		RefundAddress:      req.RefundAddress,
		RequestID:          requestID,
	}

	// Start swap workflow
	workflowOptions := client.StartWorkflowOptions{
		ID:                  fmt.Sprintf("swap-%s", requestID),
		TaskQueue:           s.config.Temporal.TaskQueue,
		WorkflowRunTimeout:  s.config.Swap.MaxSwapTime,
		WorkflowTaskTimeout: 10 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}

	we, err := s.temporalClient.ExecuteWorkflow(r.Context(), workflowOptions, "SwapWorkflow", swapRequest)
	if err != nil {
		s.logger.Errorw("Failed to start swap workflow", "error", err)
		s.errorResponse(w, "Failed to start swap", http.StatusInternalServerError)
		return
	}

	s.logger.Infow("Swap workflow started",
		"requestID", requestID,
		"workflowID", we.GetID(),
		"runID", we.GetRunID(),
	)

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(SwapResponse{
		RequestID: requestID,
		Message:   "Swap initiated successfully",
	})
}

// getSwapStatusHandler gets the status of a swap
func (s *Server) getSwapStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID := vars["requestId"]

	if requestID == "" {
		s.errorResponse(w, "Missing request ID", http.StatusBadRequest)
		return
	}

	// Get workflow execution
	workflowID := fmt.Sprintf("swap-%s", requestID)
	we, err := s.temporalClient.DescribeWorkflowExecution(r.Context(), workflowID, "")
	if err != nil {
		s.logger.Errorw("Failed to get workflow execution", "error", err)
		s.errorResponse(w, "Failed to get swap status", http.StatusInternalServerError)
		return
	}

	status := we.WorkflowExecutionInfo.Status.String()

	// If workflow is completed, get the result
	var result *types.SwapResult
	if status == "COMPLETED" {
		resp := s.temporalClient.GetWorkflow(r.Context(), workflowID, "")
		if err := resp.Get(r.Context(), &result); err != nil {
			s.logger.Errorw("Failed to decode workflow result", "error", err)
			s.errorResponse(w, "Failed to decode swap result", http.StatusInternalServerError)
			return
		}
	}

	// Return response based on status
	w.Header().Set("Content-Type", "application/json")

	if status == "COMPLETED" && result != nil {
		// Return full result for completed workflows
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(result)
	} else {
		// Return simplified status for non-completed workflows
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"requestId": requestID,
			"status":    status,
		})
	}
}

// getTokensHandler returns all available tokens
func (s *Server) getTokensHandler(w http.ResponseWriter, r *http.Request) {
	// Get chain IDs from query parameters
	chainIDs := r.URL.Query()["chainId"]

	var allTokens []types.Token

	if len(chainIDs) == 0 {
		// If no chain IDs specified, get tokens for all supported chains
		for chainName, chainConfig := range s.config.Chains {
			chainIDInt := chainConfig.ChainID
			tokens, err := s.universalSDK.GetWrappedTokens(r.Context(), chainIDInt)
			if err != nil {
				s.logger.Warnw("Failed to get tokens for chain", "chainName", chainName, "error", err)
				continue
			}

			allTokens = append(allTokens, tokens...)
		}
	} else {
		// Get tokens for specified chains
		for _, chainIDStr := range chainIDs {
			chainIDInt, err := parseChainID(chainIDStr)
			if err != nil {
				s.logger.Warnw("Invalid chain ID", "chainID", chainIDStr, "error", err)
				continue
			}

			tokens, err := s.universalSDK.GetWrappedTokens(r.Context(), chainIDInt)
			if err != nil {
				s.logger.Warnw("Failed to get tokens for chain", "chainID", chainIDStr, "error", err)
				continue
			}

			allTokens = append(allTokens, tokens...)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(allTokens)
}

// parseChainID converts a string chain ID to int64
func parseChainID(chainID string) (int64, error) {
	var chainIDInt int64
	_, err := fmt.Sscanf(chainID, "%d", &chainIDInt)
	if err != nil {
		return 0, fmt.Errorf("invalid chain ID format: %s", chainID)
	}
	return chainIDInt, nil
}

// getTokensByChainHandler returns tokens for a specific chain
func (s *Server) getTokensByChainHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chainIDStr := vars["chainId"]

	// Parse chain ID
	var chainID int64
	_, err := fmt.Sscanf(chainIDStr, "%d", &chainID)
	if err != nil {
		s.errorResponse(w, "Invalid chain ID format", http.StatusBadRequest)
		return
	}

	// Get tokens for the specified chain
	tokens, err := s.universalSDK.GetWrappedTokens(r.Context(), chainID)
	if err != nil {
		s.logger.Errorw("Failed to get tokens", "chainID", chainID, "error", err)
		s.errorResponse(w, fmt.Sprintf("Failed to get tokens for chain %d", chainID), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokens)
}

// errorResponse sends a standardized error response
func (s *Server) errorResponse(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error: message,
	})
}

// findToken finds a token by symbol and chain ID
func (s *Server) findToken(symbol string, chainID int64) (types.Token, error) {
	tokens, err := s.universalSDK.GetWrappedTokens(context.Background(), chainID)
	if err != nil {
		return types.Token{}, err
	}

	for _, token := range tokens {
		if token.Symbol == symbol {
			return token, nil
		}
	}

	return types.Token{}, fmt.Errorf("token %s not found on chain %d", symbol, chainID)
}

// createMockWrappedTokens creates mock wrapped tokens for testing
func createMockWrappedTokens(cfg config.Config) map[int64][]types.Token {
	tokens := make(map[int64][]types.Token)

	// Ethereum tokens (Chain ID: 1)
	tokens[1] = []types.Token{
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
	tokens[137] = []types.Token{
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
