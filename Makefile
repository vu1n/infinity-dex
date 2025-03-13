.PHONY: build test clean run run-worker run-server lint fmt run-frontend run-price-worker build-price-worker

# Build both worker and server binaries
build:
	@echo "Building Infinity DEX binaries..."
	go build -o bin/worker cmd/worker/main.go
	go build -o bin/server cmd/server/main.go
	@echo "Done."

# Build the price worker binary
build-price-worker:
	@echo "Building Price Oracle Worker binary..."
	go build -o bin/price-worker cmd/price_worker/main.go
	@echo "Done."

# Run all tests with coverage
test:
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Done. See coverage.html for details."

# Run unit tests only (no integration tests)
test-unit:
	@echo "Running unit tests..."
	go test -v -short ./...
	@echo "Done."

# Clean up artifacts
clean:
	@echo "Cleaning up..."
	rm -rf bin/
	rm -f coverage.out
	rm -f coverage.html
	@echo "Done."

# Run linter
lint:
	@echo "Running linter..."
	go vet ./...
	@echo "Done."

# Format code
fmt:
	@echo "Formatting code..."
	go fmt ./...
	@echo "Done."

# Run the Temporal worker
run-worker:
	@echo "Starting Temporal worker..."
	go run cmd/worker/main.go

# Run the Price Oracle worker
run-price-worker:
	@echo "Starting Price Oracle worker..."
	go run cmd/price_worker/main.go

# Run the API server
run-server:
	@echo "Starting API server..."
	go run cmd/server/main.go

# Run the frontend development server
run-frontend:
	@echo "Starting frontend development server..."
	cd frontend && npm run dev

# Initialize development environment
init-dev:
	@echo "Initializing development environment..."
	go mod tidy
	@echo "Done."

# Install Temporal CLI 
install-temporal-cli:
	@echo "Installing Temporal CLI..."
	curl -sSf https://temporal.download/cli.sh | sh
	@echo "Done. Now you can run 'temporal server start-dev' to start a local Temporal server."

# Start local Temporal server
start-temporal:
	@echo "Starting local Temporal server..."
	temporal server start-dev
	@echo "Temporal server stopped."

# Help output
help:
	@echo "Available commands:"
	@echo "  make build         - Build worker and server binaries"
	@echo "  make build-price-worker - Build price worker binary"
	@echo "  make test          - Run all tests with coverage"
	@echo "  make test-unit     - Run unit tests only"
	@echo "  make clean         - Clean up artifacts"
	@echo "  make lint          - Run linter"
	@echo "  make fmt           - Format code"
	@echo "  make run-worker    - Run the Temporal worker"
	@echo "  make run-price-worker - Run the Price Oracle worker"
	@echo "  make run-server    - Run the API server"
	@echo "  make run-frontend  - Run the frontend development server"
	@echo "  make init-dev      - Initialize development environment"
	@echo "  make install-temporal-cli - Install Temporal CLI"
	@echo "  make start-temporal - Start local Temporal server"
	@echo "  make help          - Show this help" 