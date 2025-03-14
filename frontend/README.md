# Infinity DEX Frontend

This is the frontend for Infinity DEX, a multichain decentralized exchange (DEX) leveraging Universal.xyz for cross-chain swaps.

## Features

- Clean, modern UI built with Next.js and Tailwind CSS
- Multichain token swapping interface
- Wallet integration
- Liquidity pool management
- Transaction history
- Mock implementation for development without blockchain dependencies
- Enhanced swap status display with real-time updates

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd infinity-dex/frontend
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Development with Mock Implementation

For development without requiring actual blockchain interactions or Temporal services:

1. Create a `.env.local` file in the frontend directory with:
```
USE_MOCK_SWAP=true
```

2. Run the development server:
```bash
npm run dev
```

This enables the mock implementation which simulates the entire swap workflow in memory, allowing you to test the UI without connecting to actual blockchain networks.

## Deployment to Vercel

The frontend is designed to be easily deployed to Vercel. Follow these steps:

1. Create a Vercel account if you don't have one: [https://vercel.com/signup](https://vercel.com/signup)

2. Install the Vercel CLI:
```bash
npm install -g vercel
```

3. Deploy from the project directory:
```bash
vercel
```

4. Follow the on-screen instructions to complete the deployment.

5. For production deployment:
```bash
vercel --prod
```

## Environment Variables

The following environment variables can be configured in your Vercel project or in a `.env.local` file for local development:

```
NEXT_PUBLIC_API_URL=https://api.infinity-dex.com # API endpoint for the backend
NEXT_PUBLIC_SUPPORTED_CHAINS=1,137,43114 # Comma-separated chain IDs
USE_MOCK_SWAP=true # Enable mock swap implementation for development
```

## Architecture

The frontend is built using:

- **Next.js**: React framework for server-rendered applications
- **Tailwind CSS**: Utility-first CSS framework
- **ethers.js**: Library for interacting with Ethereum and EVM-compatible blockchains
- **Axios**: HTTP client for API calls

## Project Structure

```
frontend/
├── components/     # Reusable UI components
│   └── SwapForm.tsx  # Enhanced swap form with status display
├── pages/          # Next.js pages and API routes
│   └── api/        # API routes with mock implementation support
├── public/         # Static assets
├── services/       # Frontend services
│   └── mockWorkflowState.ts  # Mock implementation for development
├── styles/         # Global CSS and Tailwind configuration
├── next.config.js  # Next.js configuration
└── package.json    # Project dependencies and scripts
```

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

## Features to Implement Next

- [ ] Add transaction history page
- [ ] Implement advanced swap options (limit orders, etc.)
- [ ] Add multi-language support
- [ ] Implement dark/light theme toggle
- [ ] Add analytics dashboard for admin users 