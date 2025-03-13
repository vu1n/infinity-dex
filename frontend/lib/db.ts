import { Pool } from 'pg';

// Create a PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'infinity_dex',
  ssl: process.env.DB_SSLMODE === 'enable' ? true : false,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Helper function to execute a query
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query', { text, error });
    throw error;
  }
}

// Get latest token prices
export async function getLatestTokenPrices() {
  const result = await query('SELECT * FROM latest_token_prices');
  return result.rows;
}

// Get token price history
export async function getTokenPriceHistory(symbol: string, chainId: number, days: number = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const result = await query(
    `SELECT tph.price_usd, tph.change_24h, tph.volume_24h, tph.market_cap_usd, tph.source, tph.timestamp
     FROM token_price_history tph
     JOIN tokens t ON tph.token_id = t.id
     WHERE t.symbol = $1 AND t.chain_id = $2 AND tph.timestamp BETWEEN $3 AND $4
     ORDER BY tph.timestamp DESC`,
    [symbol, chainId, startDate, endDate]
  );
  
  return {
    symbol,
    chainId,
    chainName: getChainName(chainId),
    history: result.rows
  };
}

// Get all tokens
export async function getAllTokens() {
  const result = await query('SELECT * FROM tokens');
  return result.rows;
}

// Helper function to get chain name from chain ID
function getChainName(chainId: number): string {
  const chainMap: Record<number, string> = {
    1: "ethereum",
    56: "binance",
    137: "polygon",
    43114: "avalanche",
    42161: "arbitrum",
    10: "optimism",
    8453: "base",
    534352: "scroll",
    59144: "linea",
    324: "zksync",
    1101: "polygon-zkevm",
    100: "gnosis",
    250: "fantom",
    42220: "celo",
    1284: "moonbeam",
    1285: "moonriver",
    30: "rootstock",
    1313161554: "aurora",
    128: "heco",
    66: "okex",
    288: "boba",
    25: "cronos",
    122: "fuse",
    1666600000: "harmony",
    2222: "kava",
    1088: "metis",
    106: "velas",
    40: "telos",
    592: "astar",
    1399811149: "solana",
    999: "solana", // Custom mapping for Solana
  };

  return chainMap[chainId] || `chain-${chainId}`;
} 