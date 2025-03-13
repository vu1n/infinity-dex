# Frontend Database Integration

This document describes how the frontend directly connects to the PostgreSQL database for serving token prices and other data, eliminating the need for the separate price-api server.

## Overview

The frontend now directly connects to the PostgreSQL database to fetch token prices and token information. This approach:

1. Reduces the number of services needed to run the application
2. Simplifies the architecture
3. Improves performance by eliminating an extra API layer

## Implementation Details

### Database Connection

The database connection is managed in `/lib/db.ts`, which provides:

- A connection pool to the PostgreSQL database
- Helper functions for executing queries
- Specific functions for fetching token prices and token information

### API Endpoints

The following API endpoints have been updated to use the database directly:

1. `/api/tokenPrices.ts` - Fetches token prices from the database
2. `/api/universalTokens.ts` - Fetches token information from the database
3. `/api/crossChainPrice.ts` - Calculates cross-chain prices using data from the database

### Configuration

The database connection uses the following environment variables (with defaults):

- `DB_HOST` (default: "localhost")
- `DB_PORT` (default: 5432)
- `DB_USER` (default: "postgres")
- `DB_PASSWORD` (default: "postgres")
- `DB_NAME` (default: "infinity_dex")
- `DB_SSLMODE` (default: "disable")

## Setup

1. Make sure PostgreSQL is installed and running
2. Create the database: `createdb infinity_dex`
3. Initialize the schema: `psql -d infinity_dex -f db/schema.sql`
4. Install the PostgreSQL client for Node.js: `cd frontend && npm install pg @types/pg`
5. Start the price worker to populate the database: `make run-price-worker`
6. Start the frontend: `make run-frontend`

## Removed Components

The following components have been removed:

- `/cmd/price_api` - The price API server
- Makefile targets: `build-price-api` and `run-price-api`

## Database Schema

The frontend interacts with the following database tables:

- `tokens` - Stores token information
- `token_prices` - Stores current token prices
- `token_price_history` - Stores historical token prices

And the following view:

- `latest_token_prices` - A view that joins tokens and their latest prices

## Troubleshooting

If you encounter issues with the database connection:

1. Check that PostgreSQL is running
2. Verify the database credentials
3. Make sure the database schema has been initialized
4. Check the console logs for specific error messages