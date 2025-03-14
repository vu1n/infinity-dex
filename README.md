# Infinity DEX - Multichain DEX with Universal.xyz

Infinity DEX is a high-performance multichain decentralized exchange leveraging Universal.xyz's wrapped asset protocol to enable seamless trading of any token across any blockchain. The platform aims to reduce swap fees and enhance transaction speed through standardized wrapped assets like uETH and uUSDC.

## Features

- **Cross-Chain Token Swaps**: Trade tokens across multiple chains with minimal fees and fast execution
- **Universal.xyz Integration**: Leverage wrapped assets for interoperability between blockchains
- **Liquidity Pool Management**: Provide and withdraw liquidity to earn fees
- **Temporal Orchestration**: High-performance event-driven workflow engine for reliable transaction processing
- **Fee Optimization**: Get the cheapest swap path automatically
- **Analytics Dashboard**: Track your transactions and pool performance
- **Mock Implementation**: Development mode with simulated swaps for testing without blockchain interactions
- **Enhanced Swap Status Display**: Real-time updates on swap progress with detailed result information

## Architecture

The Infinity DEX architecture combines:

1. **Smart Contracts**: On-chain contracts for token wrapping and swaps
2. **Temporal Workflows**: Off-chain orchestration layer for reliable transaction processing
3. **Universal.xyz SDK**: Integration with wrapped asset protocol
4. **Frontend UI**: User interface for trading and liquidity provision
5. **Mock Services**: Development environment with simulated blockchain interactions

## Directory Structure

- `cmd/`: Command-line applications
  - `server/`: API server
- `db/`: Database schema and migrations
- `frontend/`: Next.js frontend application
  - `components/`: UI components including the enhanced SwapForm
  - `pages/api/`: API routes with mock implementation support
  - `services/`: Core frontend services including mockWorkflowState
- `services/`: Core business logic services
- `temporal/`: Temporal workflows, activities, and workers
  - `activities/`: Temporal activity implementations
  - `config/`: Configuration for Temporal components
  - `workflows/`: Temporal workflow definitions
  - `workers/`: Temporal worker implementations
- `universalsdk/`: Universal.xyz SDK integration

## Core Services

Infinity DEX is built on a modular service architecture:

- **TokenService**: Manages tokens and token pairs across multiple chains
- **SwapService**: Handles token swap operations with quotes, execution, and status tracking
- **LiquidityService**: Manages liquidity pools, positions, and statistics
- **TransactionService**: Tracks and queries transactions with workflow support
- **ChainService**: Handles blockchain operations and status monitoring
- **ServiceFactory**: Centralizes management of all services
- **MockWorkflowState**: Simulates workflow states for development and testing

## Project Structure

```
infinity-dex/
├── cmd/                # Command line applications
│   └── server/         # API server
├── temporal/           # Temporal-related code
│   ├── activities/     # Temporal activity implementations
│   ├── config/         # Configuration for Temporal components
│   ├── workflows/      # Temporal workflow definitions
│   └── workers/        # Temporal worker implementations
├── universalsdk/       # Integration with Universal.xyz
├── db/                 # Database schema and migrations
├── services/           # Core business logic services
│   ├── types/          # Common type definitions
│   └── interfaces/     # Service interfaces
└── frontend/           # Web UI
    ├── components/     # UI components
    ├── pages/          # Next.js pages
    │   └── api/        # API routes with mock support
    └── services/       # Frontend services
        └── mockWorkflowState.ts  # Mock implementation for development
```

## Getting Started

### Prerequisites

- Go 1.18 or later
- Node.js 16 or later
- PostgreSQL 13 or later
- Docker (optional, for containerized deployment)

### Quickstart Guide

Follow these steps to get Infinity DEX up and running:

1. **Clone the repository**
   ```bash
   git clone https://github.com/vu1n/infinity-dex.git
   cd infinity-dex
   ```

2. **Initialize the development environment**
   ```bash
   make init-dev
   ```
   This will install all Go and Node.js dependencies.

3. **Set up the database**
   ```bash
   make init-db
   ```
   This creates the `infinity_dex` database and initializes the schema.

4. **Build the binaries**
   ```bash
   make build
   ```
   This builds the server, worker, and price worker binaries.

5. **Start the services**
   
   You can start all services at once:
   ```bash
   make start-dev
   ```
   
   Or start individual services:
   ```bash
   # Start the API server
   make run-server
   
   # Start the price worker
   make run-price-worker
   
   # Start the frontend development server
   make run-frontend
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:8080

### Frontend-Only Development Mode

For frontend-only development without requiring the backend services:

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server with mock mode enabled**
   ```bash
   USE_MOCK_SWAP=true npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000

This mode uses an in-memory mock implementation that simulates the swap workflow, allowing you to test the UI without connecting to actual blockchain networks or Temporal services.

### Configuration

The application uses environment variables for configuration. Create a `.env` file in the project root:

```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=infinity_dex

# API Server
API_PORT=8080

# Price Worker
PRICE_UPDATE_INTERVAL=60 # seconds

# Frontend Mock Mode
USE_MOCK_SWAP=true # Enable mock swap implementation for development
```

### Running Tests

Run the service tests:

```bash
make test
```

### Common Issues

- **Database connection errors**: Ensure PostgreSQL is running and the credentials in your `.env` file are correct.
- **Missing dependencies**: Run `make init-dev` to install all required dependencies.
- **Port conflicts**: If ports 3000 or 8080 are already in use, modify the configuration to use different ports.
- **Temporal connection errors**: When not using mock mode, ensure Temporal server is running and accessible.

### Development Workflow

1. Make changes to the code
2. Run tests: `make test`
3. Format code: `make fmt`
4. Run linter: `make lint`
5. Build and run the application: `make start-dev`

## Development Progress

This project is in active development according to the phases outlined in the PRD:

- **Phase 1**: Core swap functionality ✅
  - Core service architecture implemented
  - Token, Transaction, Liquidity, Swap, and Chain services completed
  - Universal SDK integration with mock implementation
  - Comprehensive test coverage
- **Phase 2**: Multichain expansion & liquidity pools ✅
  - API endpoints for frontend integration
  - Mock implementation for development without blockchain dependencies
  - Enhanced swap status display with real-time updates
- **Phase 3**: Optimization & analytics (in progress)
  - Implementing detailed transaction history
  - Building analytics dashboard

## Mock Implementation Details

The mock implementation provides a development-friendly way to test the application without requiring actual blockchain interactions or Temporal services. Key components include:

- **mockWorkflowState.ts**: Manages workflow states in memory, simulating the progression of swap transactions
- **API Endpoints**: Modified to detect development mode and use mock data
- **Environment Variables**: `USE_MOCK_SWAP=true` enables mock mode regardless of environment

The mock implementation simulates:
- Swap initiation
- Quote generation
- Swap confirmation
- Transaction processing
- Success/failure outcomes

This allows developers to test the complete user flow without deploying to testnet or mainnet environments.

## Enhanced Swap Status Display

The SwapForm component now includes a comprehensive status display that shows:

- **Pending Status**: Visual indicator when a swap is being processed
- **Quoting Status**: Shows when the system is calculating the best exchange rate
- **Confirmation Status**: Displays the quote details and allows user confirmation
- **Processing Status**: Shows that the swap is being executed on-chain
- **Completed Status**: Displays detailed results including:
  - Amount of tokens swapped
  - Amount of tokens received
  - Exchange rate
  - Transaction hash with explorer link
- **Failed Status**: Shows error details with retry option

This enhanced display provides users with clear visibility into the swap process and results.

## Release Notes

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for detailed information about each release.

## License

[MIT License](LICENSE) 