# Infinity DEX Frontend

This is the frontend for Infinity DEX, a multichain decentralized exchange (DEX) leveraging Universal.xyz for cross-chain swaps.

## Features

- Clean, modern UI built with Next.js and Tailwind CSS
- Multichain token swapping interface
- Wallet integration
- Liquidity pool management
- Transaction history

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
├── pages/          # Next.js pages and API routes
├── public/         # Static assets
├── styles/         # Global CSS and Tailwind configuration
├── next.config.js  # Next.js configuration
└── package.json    # Project dependencies and scripts
```

## Features to Implement Next

- [ ] Add transaction history page
- [ ] Implement advanced swap options (limit orders, etc.)
- [ ] Add multi-language support
- [ ] Implement dark/light theme toggle
- [ ] Add analytics dashboard for admin users 