import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TokenPrice } from './tokenPrices';

// Define the cross-chain price response type
export type CrossChainPriceResponse = {
  success: boolean;
  error?: string;
  sourceToken: string;
  sourceChain: string;
  destinationToken: string;
  destinationChain: string;
  exchangeRate: string;
  estimatedOutput: string;
  priceImpactPct: number;
  route: {
    steps: RouteStep[];
  };
  totalFee?: {
    amount: string;
    token: string;
    usdValue: string;
  };
};

// Define a route step for multi-hop routes
export type RouteStep = {
  type: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  exchangeRate?: string;
  fee?: {
    amount: string;
    token: string;
    usdValue: string;
  };
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

// Get token prices from external API
const getTokenPrices = async (symbols: string[]): Promise<Map<string, number>> => {
  try {
    // Normalize symbols
    const normalizedSymbols = symbols.map(s => s.toLowerCase());
    
    // Create a map to store prices
    const priceMap = new Map<string, number>();
    
    // Fetch prices from tokenPrices API
    const response = await axios.get('/api/tokenPrices');
    const prices: TokenPrice[] = response.data;
    
    // Map prices to symbols
    for (const price of prices) {
      if (normalizedSymbols.includes(price.symbol.toLowerCase())) {
        priceMap.set(price.symbol.toLowerCase(), price.current_price);
      }
    }
    
    console.log('Received prices:', prices);
    
    return priceMap;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    
    // Return fallback prices for common tokens
    const fallbackPrices = new Map<string, number>();
    fallbackPrices.set('eth', 3000);
    fallbackPrices.set('sol', 125);
    fallbackPrices.set('usdc', 1);
    fallbackPrices.set('usdt', 1);
    fallbackPrices.set('matic', 0.7);
    fallbackPrices.set('avax', 28);
    fallbackPrices.set('jup', 0.65);
    fallbackPrices.set('bonk', 0.00002);
    fallbackPrices.set('wif', 1.85);
    fallbackPrices.set('bome', 0.02);
    fallbackPrices.set('pyth', 0.45);
    fallbackPrices.set('ray', 0.35);
    
    // Filter to only return requested symbols
    const filteredPrices = new Map<string, number>();
    const normalizedRequestedSymbols = symbols.map(s => s.toLowerCase());
    for (const symbol of normalizedRequestedSymbols) {
      if (fallbackPrices.has(symbol)) {
        filteredPrices.set(symbol, fallbackPrices.get(symbol)!);
      }
    }
    
    return filteredPrices;
  }
};

// Get token price in terms of USDC
const getTokenUsdcPrice = async (symbol: string): Promise<number | null> => {
  try {
    const priceMap = await getTokenPrices([symbol, 'usdc']);
    const tokenPrice = priceMap.get(symbol.toLowerCase());
    const usdcPrice = priceMap.get('usdc');
    
    if (tokenPrice && usdcPrice) {
      // For most tokens, USDC price is 1, so this will just return the token price
      return tokenPrice / usdcPrice;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting USDC price for ${symbol}:`, error);
    return null;
  }
};

// Calculate the cross-chain price
const calculateCrossChainPrice = async (
  sourceToken: string,
  sourceChain: string,
  destinationToken: string,
  destinationChain: string,
  amount: string
): Promise<CrossChainPriceResponse> => {
  console.log(`Calculating price from ${sourceToken} (${sourceChain}) to ${destinationToken} (${destinationChain})`);
  
  try {
    // Normalize chain names
    const normalizedSourceChain = sourceChain.toLowerCase();
    const normalizedDestChain = destinationChain.toLowerCase();
    
    // Check if source and destination are the same
    if (sourceToken === destinationToken && normalizedSourceChain === normalizedDestChain) {
      return {
        success: true,
        sourceToken,
        sourceChain: normalizedSourceChain,
        destinationToken,
        destinationChain: normalizedDestChain,
        exchangeRate: "1",
        estimatedOutput: amount,
        priceImpactPct: 0,
        route: {
          steps: [
            {
              type: 'swap',
              fromToken: sourceToken,
              toToken: destinationToken,
              fromChain: normalizedSourceChain,
              toChain: normalizedDestChain,
              exchangeRate: "1"
            }
          ]
        }
      };
    }
    
    // Determine if tokens are wrapped
    const isSourceWrapped = sourceToken.startsWith('u');
    const isDestWrapped = destinationToken.startsWith('u');
    
    console.log(`Cross-chain swap - Source wrapped: ${isSourceWrapped}, Destination wrapped: ${isDestWrapped}`);
    
    // Get the unwrapped versions of the tokens if they are wrapped
    const sourceTokenUnwrapped = isSourceWrapped ? sourceToken.substring(1) : sourceToken;
    const destTokenUnwrapped = isDestWrapped ? destinationToken.substring(1) : destinationToken;
    
    // Get the wrapped versions of the tokens if they are not wrapped
    const sourceTokenWrapped = isSourceWrapped ? sourceToken : `u${sourceToken}`;
    const destTokenWrapped = isDestWrapped ? destinationToken : `u${destinationToken}`;
    
    // Try direct price comparison first (for major tokens)
    console.log(`Trying direct price comparison between ${sourceTokenUnwrapped} and ${destTokenUnwrapped}`);
    
    // Fetch prices for both tokens
    const symbols = [sourceTokenUnwrapped, destTokenUnwrapped].map(s => s.toLowerCase());
    console.log(`Fetching prices for symbols: ${symbols.join(', ')}`);
    
    const priceMap = await getTokenPrices(symbols);
    console.log(`Price map:`, priceMap);
    
    // Check if we have prices for both tokens
    if (priceMap.has(sourceTokenUnwrapped.toLowerCase()) && priceMap.has(destTokenUnwrapped.toLowerCase())) {
      const sourcePrice = priceMap.get(sourceTokenUnwrapped.toLowerCase())!;
      const destPrice = priceMap.get(destTokenUnwrapped.toLowerCase())!;
      
      console.log(`Direct comparison - Source price: ${sourcePrice}, Destination price: ${destPrice}`);
      
      // Calculate exchange rate (how many destination tokens per source token)
      const exchangeRate = sourcePrice / destPrice;
      console.log(`Direct exchange rate (source price / dest price): ${exchangeRate}`);
      
      // Calculate estimated output
      const inputAmount = parseFloat(amount);
      const outputAmount = inputAmount * exchangeRate;
      
      // Build the route
      const route: RouteStep[] = [];
      const fees: Array<{amount: string, token: string, usdValue: string}> = [];
      
      // If source is not on Universal, wrap it
      if (!isSourceWrapped && normalizedSourceChain !== 'universal') {
        route.push({
          type: 'wrap',
          fromToken: sourceToken,
          toToken: sourceTokenWrapped,
          fromChain: normalizedSourceChain,
          toChain: 'universal',
          fee: {
            amount: (inputAmount * 0.001).toFixed(6), // 0.1% fee
            token: sourceToken,
            usdValue: (inputAmount * 0.001 * sourcePrice).toFixed(2)
          }
        });
        fees.push({
          amount: (inputAmount * 0.001).toFixed(6),
          token: sourceToken,
          usdValue: (inputAmount * 0.001 * sourcePrice).toFixed(2)
        });
      }
      
      // Direct swap on Universal
      if (normalizedSourceChain !== normalizedDestChain || sourceTokenUnwrapped !== destTokenUnwrapped) {
        const swapFeePercent = 0.003; // 0.3% fee
        const swapFeeAmount = inputAmount * swapFeePercent;
        const swapFeeUsdValue = swapFeeAmount * sourcePrice;
        
        route.push({
          type: 'swap',
          fromToken: isSourceWrapped ? sourceToken : sourceTokenWrapped,
          toToken: isDestWrapped ? destinationToken : destTokenWrapped,
          fromChain: isSourceWrapped ? normalizedSourceChain : 'universal',
          toChain: isDestWrapped ? normalizedDestChain : 'universal',
          exchangeRate: exchangeRate.toString(),
          fee: {
            amount: swapFeeAmount.toFixed(6),
            token: isSourceWrapped ? sourceToken : sourceTokenWrapped,
            usdValue: swapFeeUsdValue.toFixed(2)
          }
        });
        fees.push({
          amount: swapFeeAmount.toFixed(6),
          token: isSourceWrapped ? sourceToken : sourceTokenWrapped,
          usdValue: swapFeeUsdValue.toFixed(2)
        });
      }
      
      // If destination is not on Universal, unwrap it
      if (!isDestWrapped && normalizedDestChain !== 'universal') {
        const unwrapFeePercent = 0.001; // 0.1% fee
        const unwrapFeeAmount = outputAmount * unwrapFeePercent;
        const unwrapFeeUsdValue = unwrapFeeAmount * destPrice;
        
        route.push({
          type: 'unwrap',
          fromToken: destTokenWrapped,
          toToken: destinationToken,
          fromChain: 'universal',
          toChain: normalizedDestChain,
          fee: {
            amount: unwrapFeeAmount.toFixed(6),
            token: destinationToken,
            usdValue: unwrapFeeUsdValue.toFixed(2)
          }
        });
        fees.push({
          amount: unwrapFeeAmount.toFixed(6),
          token: destinationToken,
          usdValue: unwrapFeeUsdValue.toFixed(2)
        });
      }
      
      // Calculate total fees in USD
      const totalFeeUsd = fees.reduce((sum, fee) => sum + parseFloat(fee.usdValue), 0);
      
      // Return the result
      return {
        success: true,
        sourceToken,
        sourceChain: normalizedSourceChain,
        destinationToken,
        destinationChain: normalizedDestChain,
        exchangeRate: exchangeRate.toString(),
        estimatedOutput: outputAmount.toFixed(6),
        priceImpactPct: 0.5, // Mock price impact
        route: { steps: route },
        totalFee: {
          amount: fees.reduce((sum, fee) => sum + parseFloat(fee.amount), 0).toFixed(6),
          token: fees[0]?.token || sourceToken,
          usdValue: totalFeeUsd.toFixed(2)
        }
      };
    }
    
    // If direct comparison fails, try routing through USDC
    console.log('Direct comparison failed, routing through USDC');
    
    // Get prices in terms of USDC
    const sourceUsdcPrice = await getTokenUsdcPrice(sourceTokenUnwrapped);
    const destUsdcPrice = await getTokenUsdcPrice(destTokenUnwrapped);
    
    console.log(`USDC prices - Source: ${sourceUsdcPrice}, Destination: ${destUsdcPrice}`);
    
    if (sourceUsdcPrice && destUsdcPrice) {
      // Calculate exchange rate (how many destination tokens per source token)
      const exchangeRate = sourceUsdcPrice / destUsdcPrice;
      console.log(`Exchange rate via USDC: ${exchangeRate}`);
      
      // Calculate estimated output
      const inputAmount = parseFloat(amount);
      const outputAmount = inputAmount * exchangeRate;
      
      // Build the route
      const route: RouteStep[] = [];
      const fees: Array<{amount: string, token: string, usdValue: string}> = [];
      
      // If source is not on Universal, wrap it
      if (!isSourceWrapped && normalizedSourceChain !== 'universal') {
        const wrapFeePercent = 0.001; // 0.1% fee
        const wrapFeeAmount = inputAmount * wrapFeePercent;
        const wrapFeeUsdValue = wrapFeeAmount * sourceUsdcPrice;
        
        route.push({
          type: 'wrap',
          fromToken: sourceToken,
          toToken: sourceTokenWrapped,
          fromChain: normalizedSourceChain,
          toChain: 'universal',
          fee: {
            amount: wrapFeeAmount.toFixed(6),
            token: sourceToken,
            usdValue: wrapFeeUsdValue.toFixed(2)
          }
        });
        fees.push({
          amount: wrapFeeAmount.toFixed(6),
          token: sourceToken,
          usdValue: wrapFeeUsdValue.toFixed(2)
        });
      }
      
      // Swap to USDC on Universal
      if (sourceTokenUnwrapped !== 'USDC') {
        const swapFeePercent = 0.003; // 0.3% fee
        const swapFeeAmount = inputAmount * swapFeePercent;
        const swapFeeUsdValue = swapFeeAmount * sourceUsdcPrice;
        
        route.push({
          type: 'swap',
          fromToken: isSourceWrapped ? sourceToken : sourceTokenWrapped,
          toToken: 'uUSDC',
          fromChain: isSourceWrapped ? normalizedSourceChain : 'universal',
          toChain: 'universal',
          exchangeRate: sourceUsdcPrice.toString(),
          fee: {
            amount: swapFeeAmount.toFixed(6),
            token: isSourceWrapped ? sourceToken : sourceTokenWrapped,
            usdValue: swapFeeUsdValue.toFixed(2)
          }
        });
        fees.push({
          amount: swapFeeAmount.toFixed(6),
          token: isSourceWrapped ? sourceToken : sourceTokenWrapped,
          usdValue: swapFeeUsdValue.toFixed(2)
        });
      }
      
      // Swap from USDC to destination token on Universal
      if (destTokenUnwrapped !== 'USDC') {
        const swapFeePercent = 0.003; // 0.3% fee
        const intermediateAmount = inputAmount * sourceUsdcPrice;
        const swapFeeAmount = intermediateAmount * swapFeePercent;
        const swapFeeUsdValue = swapFeeAmount; // USDC is 1:1 with USD
        
        route.push({
          type: 'swap',
          fromToken: 'uUSDC',
          toToken: isDestWrapped ? destinationToken : destTokenWrapped,
          fromChain: 'universal',
          toChain: isDestWrapped ? normalizedDestChain : 'universal',
          exchangeRate: (1 / destUsdcPrice).toString(),
          fee: {
            amount: swapFeeAmount.toFixed(6),
            token: 'uUSDC',
            usdValue: swapFeeUsdValue.toFixed(2)
          }
        });
        fees.push({
          amount: swapFeeAmount.toFixed(6),
          token: 'uUSDC',
          usdValue: swapFeeUsdValue.toFixed(2)
        });
      }
      
      // If destination is not on Universal, unwrap it
      if (!isDestWrapped && normalizedDestChain !== 'universal') {
        const unwrapFeePercent = 0.001; // 0.1% fee
        const unwrapFeeAmount = outputAmount * unwrapFeePercent;
        const unwrapFeeUsdValue = unwrapFeeAmount * destUsdcPrice;
        
        route.push({
          type: 'unwrap',
          fromToken: destTokenWrapped,
          toToken: destinationToken,
          fromChain: 'universal',
          toChain: normalizedDestChain,
          fee: {
            amount: unwrapFeeAmount.toFixed(6),
            token: destinationToken,
            usdValue: unwrapFeeUsdValue.toFixed(2)
          }
        });
        fees.push({
          amount: unwrapFeeAmount.toFixed(6),
          token: destinationToken,
          usdValue: unwrapFeeUsdValue.toFixed(2)
        });
      }
      
      // Calculate total fees in USD
      const totalFeeUsd = fees.reduce((sum, fee) => sum + parseFloat(fee.usdValue), 0);
      
      // Return the result
      return {
        success: true,
        sourceToken,
        sourceChain: normalizedSourceChain,
        destinationToken,
        destinationChain: normalizedDestChain,
        exchangeRate: exchangeRate.toString(),
        estimatedOutput: outputAmount.toFixed(6),
        priceImpactPct: 1.0, // Higher price impact for USDC routing
        route: { steps: route },
        totalFee: {
          amount: fees.reduce((sum, fee) => sum + parseFloat(fee.amount), 0).toFixed(6),
          token: fees[0]?.token || sourceToken,
          usdValue: totalFeeUsd.toFixed(2)
        }
      };
    }
    
    // If all else fails, return an error
    return {
      success: false,
      error: 'Could not calculate price',
      sourceToken,
      sourceChain: normalizedSourceChain,
      destinationToken,
      destinationChain: normalizedDestChain,
      exchangeRate: '0',
      estimatedOutput: '0',
      priceImpactPct: 0,
      route: { steps: [] }
    };
  } catch (error) {
    console.error('Error calculating cross-chain price:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceToken,
      sourceChain,
      destinationToken,
      destinationChain,
      exchangeRate: '0',
      estimatedOutput: '0',
      priceImpactPct: 0,
      route: { steps: [] }
    };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sourceToken, sourceChain, destinationToken, destinationChain, amount } = req.body;

    if (!sourceToken || !sourceChain || !destinationToken || !destinationChain || !amount) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameters' 
      });
    }

    // Calculate the cross-chain price
    const priceResponse = await calculateCrossChainPrice(
      sourceToken,
      sourceChain,
      destinationToken,
      destinationChain,
      amount
    );

    // Return the price response
    res.status(200).json(priceResponse);
  } catch (error) {
    console.error('Error handling cross-chain price request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to calculate cross-chain price' 
    });
  }
} 