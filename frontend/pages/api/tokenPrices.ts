import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Define the price data type
export type TokenPrice = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  last_updated: string;
};

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), '.price-cache.json');
const CACHE_DURATION = 60 * 1000; // 1 minute

// Map of common symbols to CoinGecko IDs
const SYMBOL_TO_ID_MAP: Record<string, string> = {
  'eth': 'ethereum',
  'btc': 'bitcoin',
  'sol': 'solana',
  'usdc': 'usd-coin',
  'usdt': 'tether',
  'dai': 'dai',
  'matic': 'matic-network',
  'avax': 'avalanche-2',
  'bonk': 'bonk',
  'jup': 'jupiter',
  'ray': 'raydium',
};

// Fallback prices for when API calls fail
const FALLBACK_PRICES: TokenPrice[] = [
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    current_price: 3000,
    price_change_percentage_24h: 2.5,
    last_updated: new Date().toISOString()
  },
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    current_price: 60000,
    price_change_percentage_24h: 1.8,
    last_updated: new Date().toISOString()
  },
  {
    id: 'solana',
    symbol: 'sol',
    name: 'Solana',
    current_price: 150,
    price_change_percentage_24h: 3.2,
    last_updated: new Date().toISOString()
  },
  {
    id: 'usd-coin',
    symbol: 'usdc',
    name: 'USD Coin',
    current_price: 1,
    price_change_percentage_24h: 0.01,
    last_updated: new Date().toISOString()
  },
  {
    id: 'tether',
    symbol: 'usdt',
    name: 'Tether',
    current_price: 1,
    price_change_percentage_24h: 0.02,
    last_updated: new Date().toISOString()
  },
  {
    id: 'dai',
    symbol: 'dai',
    name: 'Dai',
    current_price: 1,
    price_change_percentage_24h: 0.01,
    last_updated: new Date().toISOString()
  },
  {
    id: 'matic-network',
    symbol: 'matic',
    name: 'Polygon',
    current_price: 0.75,
    price_change_percentage_24h: 1.5,
    last_updated: new Date().toISOString()
  },
  {
    id: 'avalanche-2',
    symbol: 'avax',
    name: 'Avalanche',
    current_price: 30,
    price_change_percentage_24h: 2.1,
    last_updated: new Date().toISOString()
  },
  {
    id: 'bonk',
    symbol: 'bonk',
    name: 'Bonk',
    current_price: 0.00001,
    price_change_percentage_24h: 5.0,
    last_updated: new Date().toISOString()
  },
  {
    id: 'jupiter',
    symbol: 'jup',
    name: 'Jupiter',
    current_price: 0.5,
    price_change_percentage_24h: 3.5,
    last_updated: new Date().toISOString()
  },
  {
    id: 'raydium',
    symbol: 'ray',
    name: 'Raydium',
    current_price: 0.8,
    price_change_percentage_24h: 2.8,
    last_updated: new Date().toISOString()
  }
];

// Read cache from file
const readCache = (): { prices: TokenPrice[], timestamp: number } | null => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error('Error reading price cache:', error);
  }
  return null;
};

// Write cache to file
const writeCache = (prices: TokenPrice[]) => {
  try {
    const cacheData = JSON.stringify({
      prices,
      timestamp: Date.now()
    });
    fs.writeFileSync(CACHE_FILE_PATH, cacheData, 'utf8');
  } catch (error) {
    console.error('Error writing price cache:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get symbols from query params
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ error: 'Symbols parameter is required' });
    }
    
    // Parse symbols
    const symbolList = (symbols as string).toLowerCase().split(',');
    
    // Try to read from cache first
    const cache = readCache();
    const now = Date.now();
    
    // Use cached prices if available and not expired
    if (cache && now - cache.timestamp < CACHE_DURATION) {
      // Filter cached prices by requested symbols
      const filteredPrices = cache.prices.filter(price => 
        symbolList.includes(price.symbol.toLowerCase())
      );
      
      // If we have all requested symbols in cache, return them
      if (filteredPrices.length === symbolList.length) {
        return res.status(200).json(filteredPrices);
      }
    }
    
    // Convert symbols to CoinGecko IDs
    const coinGeckoIds = symbolList.map(symbol => SYMBOL_TO_ID_MAP[symbol] || symbol);
    
    // Fetch prices from CoinGecko API
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: coinGeckoIds.join(','),
          order: 'market_cap_desc',
          per_page: 100,
          page: 1,
          sparkline: false,
          price_change_percentage: '24h'
        }
      }
    );
    
    const prices: TokenPrice[] = response.data.map((item: any) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      current_price: item.current_price,
      price_change_percentage_24h: item.price_change_percentage_24h,
      last_updated: item.last_updated
    }));
    
    // Update cache with all prices
    if (cache) {
      // Merge new prices with existing cache, replacing duplicates
      const existingSymbols = new Set(prices.map(p => p.symbol.toLowerCase()));
      const nonDuplicatePrices = cache.prices.filter(p => !existingSymbols.has(p.symbol.toLowerCase()));
      writeCache([...prices, ...nonDuplicatePrices]);
    } else {
      writeCache(prices);
    }
    
    // Return prices
    res.status(200).json(prices);
  } catch (error) {
    console.error('Error fetching token prices:', error);
    
    // Try to use cache even if expired in case of error
    const cache = readCache();
    if (cache) {
      const symbolList = ((req.query.symbols as string) || '').toLowerCase().split(',');
      const filteredPrices = cache.prices.filter(price => 
        symbolList.includes(price.symbol.toLowerCase())
      );
      
      if (filteredPrices.length > 0) {
        console.log('Returning cached prices due to API error');
        return res.status(200).json(filteredPrices);
      }
    }
    
    // If no cache or no matching symbols in cache, use fallback prices
    const symbolList = ((req.query.symbols as string) || '').toLowerCase().split(',');
    const fallbackPricesForSymbols = FALLBACK_PRICES.filter(price => 
      symbolList.includes(price.symbol.toLowerCase())
    );
    
    if (fallbackPricesForSymbols.length > 0) {
      console.log('Returning fallback prices due to API error');
      return res.status(200).json(fallbackPricesForSymbols);
    }
    
    res.status(500).json({ error: 'Failed to fetch token prices' });
  }
} 