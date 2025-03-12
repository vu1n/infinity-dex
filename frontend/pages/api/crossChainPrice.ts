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

// Fallback prices for when API calls fail
const FALLBACK_PRICES: Record<string, number> = {
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

// Get token prices from CoinGecko or our API
const getTokenPrices = async (symbols: string[]): Promise<Map<string, number>> => {
  try {
    // Use absolute URL to call the tokenPrices API
    // This will work in both development and production environments
    const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    console.log(`Fetching prices for symbols: ${symbols.join(', ')}`);
    
    const response = await axios.get(`${baseUrl}/api/tokenPrices`, {
      params: { symbols: symbols.join(',') }
    });
    
    const priceMap = new Map<string, number>();
    const prices: TokenPrice[] = response.data;
    
    console.log('Received prices:', JSON.stringify(prices, null, 2));
    
    prices.forEach(price => {
      priceMap.set(price.symbol.toLowerCase(), price.current_price);
    });
    
    console.log('Price map:', Object.fromEntries(priceMap));
    
    return priceMap;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    
    // Fallback to mock prices if API call fails
    const priceMap = new Map<string, number>();
    
    symbols.forEach(symbol => {
      const lowerSymbol = symbol.toLowerCase();
      if (FALLBACK_PRICES[lowerSymbol]) {
        priceMap.set(lowerSymbol, FALLBACK_PRICES[lowerSymbol]);
      } else {
        // Default price for unknown tokens
        priceMap.set(lowerSymbol, 1);
      }
    });
    
    console.log('Using fallback prices:', Object.fromEntries(priceMap));
    
    return priceMap;
  }
};

// Calculate cross-chain price
const calculateCrossChainPrice = async (
  sourceToken: string,
  sourceChain: string,
  destinationToken: string,
  destinationChain: string
): Promise<CrossChainPriceResponse> => {
  console.log(`Calculating price from ${sourceToken} (${sourceChain}) to ${destinationToken} (${destinationChain})`);
  
  // Check if it's a direct swap on the same chain
  if (sourceChain === destinationChain) {
    // Get token prices
    const priceMap = await getTokenPrices([sourceToken, destinationToken]);
    const sourcePrice = priceMap.get(sourceToken.toLowerCase());
    const destPrice = priceMap.get(destinationToken.toLowerCase());
    
    console.log(`Direct swap - Source price: ${sourcePrice}, Destination price: ${destPrice}`);
    
    if (sourcePrice && destPrice) {
      const exchangeRate = (destPrice / sourcePrice).toString();
      console.log(`Exchange rate: ${exchangeRate}`);
      
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
  
  console.log(`Cross-chain swap - Source wrapped: ${isSourceWrapped}, Destination wrapped: ${isDestWrapped}`);
  
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
    console.log(`Step 1: Wrapped ${sourceToken} to ${currentToken}`);
  }
  
  // Step 2: If we need to go through a common denominator (USDC)
  if (currentToken !== 'uUSDC' && !isDestWrapped) {
    // Get token prices for rate calculation
    const tokenToPrice = currentToken.replace('u', '');
    console.log(`Step 2: Getting prices for ${tokenToPrice} and USDC`);
    
    const priceMap = await getTokenPrices([tokenToPrice, 'USDC']);
    const sourcePrice = priceMap.get(tokenToPrice.toLowerCase());
    const usdcPrice = priceMap.get('usdc');
    
    console.log(`Step 2: ${tokenToPrice} price: ${sourcePrice}, USDC price: ${usdcPrice}`);
    
    if (sourcePrice && usdcPrice) {
      const exchangeRate = (usdcPrice / sourcePrice).toString();
      cumulativeRate *= (usdcPrice / sourcePrice);
      
      console.log(`Step 2: Exchange rate ${currentToken} to uUSDC: ${exchangeRate}`);
      
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
      
      console.log(`Step 3a: Getting prices for USDC and ${destinationToken}`);
      
      // Get token prices for rate calculation
      const priceMap = await getTokenPrices(['USDC', destinationToken]);
      const usdcPrice = priceMap.get('usdc');
      const destPrice = priceMap.get(destinationToken.toLowerCase());
      
      console.log(`Step 3a: USDC price: ${usdcPrice}, ${destinationToken} price: ${destPrice}`);
      
      if (usdcPrice && destPrice) {
        const exchangeRate = (destPrice / usdcPrice).toString();
        cumulativeRate *= (destPrice / usdcPrice);
        
        console.log(`Step 3a: Exchange rate uUSDC to ${wrappedDestToken}: ${exchangeRate}`);
        
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
    console.log(`Step 3b: Unwrapping ${currentToken} to ${destinationToken}`);
    
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
    const sourceTokenUnwrapped = currentToken.replace('u', '');
    const destTokenUnwrapped = destinationToken.replace('u', '');
    
    console.log(`Step 3 (direct): Getting prices for ${sourceTokenUnwrapped} and ${destTokenUnwrapped}`);
    
    const priceMap = await getTokenPrices([sourceTokenUnwrapped, destTokenUnwrapped]);
    const sourcePrice = priceMap.get(sourceTokenUnwrapped.toLowerCase());
    const destPrice = priceMap.get(destTokenUnwrapped.toLowerCase());
    
    console.log(`Step 3 (direct): ${sourceTokenUnwrapped} price: ${sourcePrice}, ${destTokenUnwrapped} price: ${destPrice}`);
    
    if (sourcePrice && destPrice) {
      const exchangeRate = (destPrice / sourcePrice).toString();
      cumulativeRate *= (destPrice / sourcePrice);
      
      console.log(`Step 3 (direct): Exchange rate ${currentToken} to ${destinationToken}: ${exchangeRate}`);
      
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
  console.log(`Overall exchange rate: ${overallExchangeRate}`);
  
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
      console.log(`Using cached price for ${sourceToken} to ${destinationToken}`);
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