import { NextApiRequest, NextApiResponse } from 'next';
import { getLatestTokenPrices } from '../../lib/db';

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

// Get token prices from database
const getTokenPrices = async (symbols: string[]): Promise<Map<string, number>> => {
  try {
    // Normalize symbols
    const normalizedSymbols = symbols.map(s => s.toLowerCase());
    
    // Create a map to store prices
    const priceMap = new Map<string, number>();
    
    // Fetch prices from database
    const dbPrices = await getLatestTokenPrices();
    
    // Map prices to symbols
    for (const price of dbPrices) {
      const symbol = price.symbol.toLowerCase();
      
      if (normalizedSymbols.includes(symbol)) {
        priceMap.set(symbol, price.price_usd);
      }
    }
    
    console.log('Price map:', priceMap);
    
    return priceMap;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    
    // Return fallback prices for common tokens
    const fallbackPrices = new Map<string, number>();
    fallbackPrices.set('eth', 1800);
    fallbackPrices.set('sol', 120);
    fallbackPrices.set('usdc', 1);
    fallbackPrices.set('usdt', 1);
    fallbackPrices.set('matic', 0.7);
    fallbackPrices.set('avax', 28);
    fallbackPrices.set('jup', 0.65);
    fallbackPrices.set('bonk', 0.00001);
    fallbackPrices.set('wif', 1.85);
    fallbackPrices.set('bome', 0.02);
    fallbackPrices.set('pyth', 0.45);
    fallbackPrices.set('ray', 0.35);
    fallbackPrices.set('btc', 83000);
    fallbackPrices.set('pepe', 0.0000012);
    
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
      let exchangeRate = sourcePrice / destPrice;
      
      // Basic validation for NaN or infinite values
      if (!isFinite(exchangeRate) || isNaN(exchangeRate)) {
        console.warn(`Invalid exchange rate calculated: ${exchangeRate}, using fallback`);
        exchangeRate = 1; // Fallback to 1:1 if calculation fails
      }
      
      console.log(`Exchange rate (source price / dest price): ${exchangeRate}`);
      
      // Calculate estimated output
      const amountNum = parseFloat(amount);
      const estimatedOutput = (amountNum * exchangeRate).toFixed(6);
      
      // Create route steps
      const steps: RouteStep[] = [];
      
      // If cross-chain, we need to add wrap/unwrap steps
      if (normalizedSourceChain !== normalizedDestChain) {
        // If source is not wrapped, add wrap step
        if (!isSourceWrapped) {
          steps.push({
            type: 'wrap',
            fromToken: sourceToken,
            toToken: sourceTokenWrapped,
            fromChain: normalizedSourceChain,
            toChain: 'universal',
            exchangeRate: '1'
          });
        }
        
        // Add bridge step
        steps.push({
          type: 'bridge',
          fromToken: isSourceWrapped ? sourceToken : sourceTokenWrapped,
          toToken: isDestWrapped ? destinationToken : destTokenWrapped,
          fromChain: isSourceWrapped ? normalizedSourceChain : 'universal',
          toChain: isDestWrapped ? normalizedDestChain : 'universal',
          exchangeRate: exchangeRate.toString(),
          fee: {
            amount: '0.001',
            token: isSourceWrapped ? sourceToken : sourceTokenWrapped,
            usdValue: (0.001 * sourcePrice).toFixed(2)
          }
        });
        
        // If destination is not wrapped, add unwrap step
        if (!isDestWrapped) {
          steps.push({
            type: 'unwrap',
            fromToken: destTokenWrapped,
            toToken: destinationToken,
            fromChain: 'universal',
            toChain: normalizedDestChain,
            exchangeRate: '1'
          });
        }
      } else {
        // Same chain, just add a swap step
        steps.push({
          type: 'swap',
          fromToken: sourceToken,
          toToken: destinationToken,
          fromChain: normalizedSourceChain,
          toChain: normalizedDestChain,
          exchangeRate: exchangeRate.toString()
        });
      }
      
      // Return the response
      return {
        success: true,
        sourceToken,
        sourceChain: normalizedSourceChain,
        destinationToken,
        destinationChain: normalizedDestChain,
        exchangeRate: exchangeRate.toString(),
        estimatedOutput,
        priceImpactPct: 0.1, // Mock price impact
        route: {
          steps
        }
      };
    }
    
    // If we don't have prices for both tokens, return an error
    return {
      success: false,
      error: 'Could not find prices for both tokens',
      sourceToken,
      sourceChain: normalizedSourceChain,
      destinationToken,
      destinationChain: normalizedDestChain,
      exchangeRate: '0',
      estimatedOutput: '0',
      priceImpactPct: 0,
      route: {
        steps: []
      }
    };
  } catch (error) {
    console.error('Error calculating cross-chain price:', error);
    return {
      success: false,
      error: 'Failed to calculate cross-chain price',
      sourceToken,
      sourceChain,
      destinationToken,
      destinationChain,
      exchangeRate: '0',
      estimatedOutput: '0',
      priceImpactPct: 0,
      route: {
        steps: []
      }
    };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get parameters from request body
    const { sourceChain, destinationChain, sourceToken, destinationToken, amount } = req.body;
    
    // Validate required parameters
    if (!sourceChain || !destinationChain || !sourceToken || !destinationToken || !amount) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameters: sourceChain, destinationChain, sourceToken, destinationToken, amount' 
      });
    }
    
    // Calculate cross-chain price
    const result = await calculateCrossChainPrice(
      sourceToken,
      sourceChain,
      destinationToken,
      destinationChain,
      amount
    );
    
    // Return the result
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error handling cross-chain price request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to calculate cross-chain price',
      sourceToken: req.body.sourceToken || '',
      sourceChain: req.body.sourceChain || '',
      destinationToken: req.body.destinationToken || '',
      destinationChain: req.body.destinationChain || '',
      exchangeRate: '0',
      estimatedOutput: '0',
      priceImpactPct: 0,
      route: {
        steps: []
      }
    });
  }
} 