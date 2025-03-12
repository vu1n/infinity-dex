# Infinity DEX - Multichain DEX with Universal.xyz

Infinity DEX is a high-performance multichain decentralized exchange leveraging Universal.xyz's wrapped asset protocol to enable seamless trading of any token across any blockchain. The platform aims to reduce swap fees and enhance transaction speed through standardized wrapped assets like uETH and uUSDC.

## Features

- **Cross-Chain Token Swaps**: Trade tokens across multiple chains with minimal fees and fast execution
- **Universal.xyz Integration**: Leverage wrapped assets for interoperability between blockchains
- **Liquidity Pool Management**: Provide and withdraw liquidity to earn fees
- **Temporal Orchestration**: High-performance event-driven workflow engine for reliable transaction processing
- **Fee Optimization**: Get the cheapest swap path automatically
- **Analytics Dashboard**: Track your transactions and pool performance

## Architecture

The Infinity DEX architecture combines:

1. **Smart Contracts**: On-chain contracts for token wrapping and swaps
2. **Temporal Workflows**: Off-chain orchestration layer for reliable transaction processing
3. **Universal.xyz SDK**: Integration with wrapped asset protocol
4. **Frontend UI**: User interface for trading and liquidity provision

## Core Services

Infinity DEX is built on a modular service architecture:

- **TokenService**: Manages tokens and token pairs across multiple chains
- **SwapService**: Handles token swap operations with quotes, execution, and status tracking
- **LiquidityService**: Manages liquidity pools, positions, and statistics
- **TransactionService**: Tracks and queries transactions with workflow support
- **ChainService**: Handles blockchain operations and status monitoring
- **ServiceFactory**: Centralizes management of all services

## Project Structure

```
infinity-dex/
├── cmd/                # Command line applications
│   ├── worker/         # Temporal worker
│   └── server/         # API server
├── workflows/          # Temporal workflow definitions
├── activities/         # Temporal activity implementations
├── universalsdk/       # Integration with Universal.xyz
├── config/             # Configuration files
├── services/           # Core business logic services
│   ├── types/          # Common type definitions
│   └── interfaces/     # Service interfaces
└── frontend/           # Web UI
```

## Getting Started

### Prerequisites

- Go 1.18 or later
- Temporal server running locally or accessible remotely
- Access to Universal.xyz SDK

### Installation

1. Clone the repository
2. Install dependencies: `go mod tidy`
3. Configure environment variables
4. Run the Temporal worker: `go run cmd/worker/main.go`
5. Run the API server: `go run cmd/server/main.go`

### Running Tests

Run the service tests:

```bash
go test -v ./services/...
```

## Development Progress

This project is in active development according to the phases outlined in the PRD:

- **Phase 1**: Core swap functionality ✅
  - Core service architecture implemented
  - Token, Transaction, Liquidity, Swap, and Chain services completed
  - Universal SDK integration with mock implementation
  - Comprehensive test coverage
- **Phase 2**: Multichain expansion & liquidity pools (in progress)
  - Implementing API endpoints for frontend integration
  - Connecting services to Temporal workflows
- **Phase 3**: Optimization & analytics (planned)

## Release Notes

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for detailed information about each release.

## License

[MIT License](LICENSE) 