# Token Price Database

This directory contains the database schema and related files for the token price database used by Infinity DEX.

## Overview

The token price database stores current and historical token prices from various sources. It is used by the price oracle workflow to persist price data and provide historical price information for the frontend.

## Schema

The database schema consists of the following tables:

- `tokens`: Stores token information such as symbol, name, address, chain ID, etc.
- `token_prices`: Stores current token prices with references to tokens.
- `token_price_history`: Stores historical token prices for time-series analysis.

## Views

- `latest_token_prices`: A view that provides the latest price for each token.

## Functions

- `update_token_price`: A function that updates token prices and automatically adds entries to the history table when prices change.

## Setup

### Prerequisites

- PostgreSQL 12 or higher
- psql command-line tool

### Initialization

To initialize the database:

```bash
make init-db
```

This will:
1. Create the `infinity_dex` database if it doesn't exist
2. Run the schema.sql script to create tables, views, and functions

## API Endpoints

The token price API provides the following endpoints:

### Get Latest Prices

```
GET /api/v1/prices/latest
```

Returns the latest prices for all tokens.

### Get Price History

```
GET /api/v1/prices/history?symbol=eth&chainId=1&days=7
```

Parameters:
- `symbol`: Token symbol (required)
- `chainId`: Chain ID (required)
- `days`: Number of days of history to retrieve (default: 7)

Returns historical price data for the specified token.

## Frontend Integration

The frontend can access token price history through the Next.js API route:

```
GET /api/tokenPriceHistory?symbol=eth&chainId=1&days=7
```

This endpoint proxies requests to the backend API and formats the response for the frontend.

## Components

The `PriceChart` component can be used to display token price history:

```tsx
import PriceChart from '@/components/PriceChart';

// In your component:
<PriceChart symbol="eth" chainId={1} days={7} />
```

## Workflow Integration

The price oracle workflow has been updated to save prices to the database. The workflow:

1. Fetches prices from various sources (CoinGecko, Jupiter, etc.)
2. Merges prices from different sources
3. Saves prices to both the cache and the database
4. Returns the merged prices

The workflow runs every 15 seconds to keep prices up-to-date. 