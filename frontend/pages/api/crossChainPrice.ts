import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TokenPrice } from './tokenPrices';

// Define the cross-chain price response type
export type CrossChainPriceResponse = {
  sourceToken: string;
  sourceChain: string;
  destinationToken: string;
  destinationChain: string;
  exchangeRate: string;
  priceImpactPct: number;
  route: RouteStep[];
};

// Define a route step for multi-hop routes
export type RouteStep = {
  fromToken: string;
  fromChain: string;
  toToken: string;
  toChain: string;
  exchangeRate: string;
  type: 'swap' | 'bridge';
};

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), '.cross-chain-price-cache.json');
const CACHE_DURATION = 60 * 1000; // 1 minute

// Read cache from file
const readCache = (): { prices: Record<string, CrossChainPriceResponse>, timestamp: number } | null => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error('Error reading cross-chain price cache:', error);
  }
  return null;
};

// Write cache to file
const writeCache = (prices: Record<string, CrossChainPriceResponse>) => {
  try {
    const cacheData = JSON.stringify({
      prices,
      timestamp: Date.now()
    });
    fs.writeFileSync(CACHE_FILE_PATH, cacheData, 'utf8');
  } catch (error) {
    console.error('Error writing cross-chain price cache:', error);
  }
};

// Mock token prices for common tokens
const MOCK_PRICES: Record<string, number> = {
  'eth': 3000,
  'ethereum': 3000,
  'usdc': 1,
  'usd-coin': 1,
  'matic': 0.75,
  'matic-network': 0.75,
  'avax': 30,
  'avalanche-2': 30,
  'sol': 150,
  'solana': 150,
  'btc': 60000,
  'bitcoin': 60000,
  'usdt': 1,
  'tether': 1,
  'dai': 1,
  'bonk': 0.00001,
  'jup': 0.5,
  'jupiter': 0.5,
  'ray': 0.8,
  'raydium': 0.8
};

// Get token prices - using mock data instead of API call to avoid URL issues
const getTokenPrices = async (symbols: string[]): Promise<Map<string, number>> => {
  try {
    const priceMap = new Map<string, number>();
    
    // Use mock prices for common tokens
    symbols.forEach(symbol => {
      const lowerSymbol = symbol.toLowerCase();
      if (MOCK_PRICES[lowerSymbol]) {
        priceMap.set(lowerSymbol, MOCK_PRICES[lowerSymbol]);
      } else {
        // Default price for unknown tokens
        priceMap.set(lowerSymbol, 1);
      }
    });
    
    return priceMap;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    return new Map();
  }
};

// Calculate cross-chain price
const calculateCrossChainPrice = async (
  sourceToken: string,
  sourceChain: string,
  destinationToken: string,
  destinationChain: string
): Promise<CrossChainPriceResponse> => {
  // Check if it's a direct swap on the same chain
  if (sourceChain === destinationChain) {
    // Get token prices
    const priceMap = await getTokenPrices([sourceToken, destinationToken]);
    const sourcePrice = priceMap.get(sourceToken.toLowerCase());
    const destPrice = priceMap.get(destinationToken.toLowerCase());
    
    if (sourcePrice && destPrice) {
      const exchangeRate = (destPrice / sourcePrice).toString();
      
      return {
        sourceToken,
        sourceChain,
        destinationToken,
        destinationChain,
        exchangeRate,
        priceImpactPct: 0.1, // Mock value
        route: [
          {
            fromToken: sourceToken,
            fromChain: sourceChain,
            toToken: destinationToken,
            toChain: destinationChain,
            exchangeRate,
            type: 'swap'
          }
        ]
      };
    }
  }
  
  // For cross-chain swaps, we need to use Universal.xyz wrapped assets
  // First, check if we're dealing with wrapped tokens already
  const isSourceWrapped = sourceToken.startsWith('u');
  const isDestWrapped = destinationToken.startsWith('u');
  
  // Define the route steps
  const route: RouteStep[] = [];
  let currentToken = sourceToken;
  let currentChain = sourceChain;
  let cumulativeRate = 1;
  
  // Step 1: If source is not wrapped, wrap it
  if (!isSourceWrapped && sourceToken !== 'USDC') {
    const wrappedToken = `u${sourceToken}`;
    route.push({
      fromToken: sourceToken,
      fromChain: sourceChain,
      toToken: wrappedToken,
      toChain: 'Universal',
      exchangeRate: '1', // 1:1 wrapping
      type: 'bridge'
    });
    currentToken = wrappedToken;
    currentChain = 'Universal';
  }
  
  // Step 2: If we need to go through a common denominator (USDC)
  if (currentToken !== 'uUSDC' && !isDestWrapped) {
    // Get token prices for rate calculation
    const priceMap = await getTokenPrices([currentToken.replace('u', ''), 'USDC']);
    const sourcePrice = priceMap.get(currentToken.replace('u', '').toLowerCase());
    const usdcPrice = priceMap.get('usdc');
    
    if (sourcePrice && usdcPrice) {
      const exchangeRate = (usdcPrice / sourcePrice).toString();
      cumulativeRate *= (usdcPrice / sourcePrice);
      
      route.push({
        fromToken: currentToken,
        fromChain: currentChain,
        toToken: 'uUSDC',
        toChain: 'Universal',
        exchangeRate,
        type: 'swap'
      });
      currentToken = 'uUSDC';
    }
  }
  
  // Step 3: If destination is not wrapped, unwrap to destination
  if (!isDestWrapped && destinationToken !== 'USDC') {
    // If we're at uUSDC, swap to the wrapped destination token first
    if (currentToken === 'uUSDC') {
      const wrappedDestToken = `u${destinationToken}`;
      
      // Get token prices for rate calculation
      const priceMap = await getTokenPrices(['USDC', destinationToken]);
      const usdcPrice = priceMap.get('usdc');
      const destPrice = priceMap.get(destinationToken.toLowerCase());
      
      if (usdcPrice && destPrice) {
        const exchangeRate = (destPrice / usdcPrice).toString();
        cumulativeRate *= (destPrice / usdcPrice);
        
        route.push({
          fromToken: 'uUSDC',
          fromChain: 'Universal',
          toToken: wrappedDestToken,
          toChain: 'Universal',
          exchangeRate,
          type: 'swap'
        });
        currentToken = wrappedDestToken;
      }
    }
    
    // Unwrap to destination token
    route.push({
      fromToken: currentToken,
      fromChain: 'Universal',
      toToken: destinationToken,
      toChain: destinationChain,
      exchangeRate: '1', // 1:1 unwrapping
      type: 'bridge'
    });
  } else if (isDestWrapped) {
    // Direct swap to wrapped destination token
    const priceMap = await getTokenPrices([currentToken.replace('u', ''), destinationToken.replace('u', '')]);
    const sourcePrice = priceMap.get(currentToken.replace('u', '').toLowerCase());
    const destPrice = priceMap.get(destinationToken.replace('u', '').toLowerCase());
    
    if (sourcePrice && destPrice) {
      const exchangeRate = (destPrice / sourcePrice).toString();
      cumulativeRate *= (destPrice / sourcePrice);
      
      route.push({
        fromToken: currentToken,
        fromChain: currentChain,
        toToken: destinationToken,
        toChain: destinationChain,
        exchangeRate,
        type: 'swap'
      });
    }
  }
  
  // Calculate the overall exchange rate
  const overallExchangeRate = cumulativeRate.toString();
  
  return {
    sourceToken,
    sourceChain,
    destinationToken,
    destinationChain,
    exchangeRate: overallExchangeRate,
    priceImpactPct: 0.5, // Mock value
    route
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sourceToken, sourceChain, destinationToken, destinationChain } = req.query;
    
    if (!sourceToken || !sourceChain || !destinationToken || !destinationChain) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Create a cache key
    const cacheKey = `${sourceToken}-${sourceChain}-${destinationToken}-${destinationChain}`.toLowerCase();
    
    // Try to read from cache first
    const cache = readCache();
    const now = Date.now();
    
    // Use cached price if available and not expired
    if (cache && now - cache.timestamp < CACHE_DURATION && cache.prices[cacheKey]) {
      return res.status(200).json(cache.prices[cacheKey]);
    }
    
    // Calculate cross-chain price
    const priceResponse = await calculateCrossChainPrice(
      sourceToken as string,
      sourceChain as string,
      destinationToken as string,
      destinationChain as string
    );
    
    // Update cache
    const prices = cache?.prices || {};
    prices[cacheKey] = priceResponse;
    writeCache(prices);
    
    // Return price response
    res.status(200).json(priceResponse);
  } catch (error) {
    console.error('Error calculating cross-chain price:', error);
    res.status(500).json({ error: 'Failed to calculate cross-chain price' });
  }
} 