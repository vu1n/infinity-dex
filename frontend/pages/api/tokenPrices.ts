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
    
    // Fetch prices from CoinGecko API
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: symbolList.join(','),
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
    
    res.status(500).json({ error: 'Failed to fetch token prices' });
  }
} 