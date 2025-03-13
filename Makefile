.PHONY: build test clean run run-worker run-server lint fmt run-frontend init-db

# Build server and worker binaries
build:
	@echo "Building Infinity DEX binaries..."
	go build -o bin/worker cmd/worker/main.go
	go build -o bin/server cmd/server/main.go
	go build -o bin/price-worker cmd/price_worker/main.go
	@echo "Done."

# Run tests with coverage
test:
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Done. See coverage.html for details."

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
	cd frontend && npm install
	@echo "Done."

# Initialize database
init-db:
	@echo "Initializing database..."
	@if [ -z "$$(psql -lqt | cut -d \| -f 1 | grep -w infinity_dex)" ]; then \
		createdb infinity_dex; \
		echo "Database 'infinity_dex' created."; \
	else \
		echo "Database 'infinity_dex' already exists."; \
	fi
	psql -d infinity_dex -f db/schema.sql
	@echo "Database schema initialized."

# Start all services for development
start-dev: run-server run-price-worker run-frontend
	@echo "Starting all development services..."

# Help output
help:
	@echo "Available commands:"
	@echo "  make build         - Build all binaries"
	@echo "  make test          - Run all tests with coverage"
	@echo "  make clean         - Clean up artifacts"
	@echo "  make lint          - Run linter"
	@echo "  make fmt           - Format code"
	@echo "  make run-worker    - Run the Temporal worker"
	@echo "  make run-price-worker - Run the Price Oracle worker"
	@echo "  make run-server    - Run the API server"
	@echo "  make run-frontend  - Run the frontend development server"
	@echo "  make init-dev      - Initialize development environment"
	@echo "  make init-db       - Initialize database"
	@echo "  make start-dev     - Start all development services"
	@echo "  make help          - Show this help" 