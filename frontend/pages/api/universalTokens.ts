import { NextApiRequest, NextApiResponse } from 'next';
import { getAllTokens, getLatestTokenPrices } from '../../lib/db';

// Define the Universal token type
export type UniversalToken = {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  chainId: number;
  chainName: string;
  isWrapped: boolean;
  logoURI: string;
  wrappedVersion?: string; // Symbol of the wrapped version (e.g., "uETH" for "ETH")
  unwrappedVersion?: string; // Symbol of the unwrapped version (e.g., "ETH" for "uETH")
  price?: number; // Current price in USD
  jupiterVerified?: boolean; // Whether the token is verified by Jupiter
  jupiterVolume?: number; // Daily volume on Jupiter
};

// Define a route step for multi-hop routes
export type RouteStep = {
  fromToken: string;
  fromChain: string;
  toToken: string;
  toChain: string;
  exchangeRate: string;
  type: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  fee?: {
    amount: string;
    token: string;
    usdValue?: string;
  };
};

// Default decimals for tokens
const DEFAULT_DECIMALS: Record<string, number> = {
  'ETH': 18,
  'MATIC': 18,
  'AVAX': 18,
  'SOL': 9,
  'USDC': 6,
  'USDT': 6,
  'DAI': 18,
  'WBTC': 8,
  'BTC': 8,
  'BONK': 5,
  'JUP': 6,
  'RAY': 6,
  'WIF': 6,
  'BOME': 6,
  'PYTH': 6,
};

// Default logo URIs for tokens
const DEFAULT_LOGO_URI: Record<string, string> = {
  'ETH': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  'MATIC': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0/logo.png',
  'AVAX': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png',
  'SOL': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  'USDC': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  'USDT': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
  'DAI': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
  'WBTC': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  'BTC': 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  'BONK': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
  'JUP': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png',
  'RAY': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  'WIF': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm/logo.png',
  'BOME': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/BVg3AJHdNaQjyHfbqR4D4RhV67AjMfYeRQHY7cLMcedt/logo.png',
  'PYTH': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.png',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get query parameters
    const { includeJupiter } = req.query;
    const includeJupiterTokens = includeJupiter === 'true';
    
    // Get tokens from database
    const dbTokens = await getAllTokens();
    const latestPrices = await getLatestTokenPrices();
    
    // Create a price map for quick lookup
    const priceMap = new Map();
    latestPrices.forEach(price => {
      priceMap.set(`${price.symbol.toLowerCase()}-${price.chain_id}`, price.price_usd);
    });
    
    // Log price map for debugging
    console.log('Price map entries:', Array.from(priceMap.entries()).slice(0, 5));
    
    // Convert database tokens to universal tokens
    const universalTokens: UniversalToken[] = dbTokens.map(token => {
      const priceKey = `${token.symbol.toLowerCase()}-${token.chain_id}`;
      const price = priceMap.get(priceKey);
      
      // Log price lookup for debugging
      if (token.symbol === 'ETH' || token.symbol === 'SOL') {
        console.log(`Price lookup for ${token.symbol}: key=${priceKey}, price=${price}`);
      }
      
      // Create wrapped version symbol if not already wrapped
      const isWrapped = token.symbol.startsWith('u');
      const wrappedVersion = isWrapped ? undefined : `u${token.symbol}`;
      const unwrappedVersion = isWrapped ? token.symbol.substring(1) : undefined;
      
      return {
        symbol: token.symbol,
        name: token.name,
        decimals: DEFAULT_DECIMALS[token.symbol.toUpperCase()] || 18,
        address: token.address || '',
        chainId: token.chain_id,
        chainName: token.chain_name,
        isWrapped: isWrapped,
        logoURI: DEFAULT_LOGO_URI[token.symbol.toUpperCase()] || 
                 `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`,
        wrappedVersion: wrappedVersion,
        unwrappedVersion: unwrappedVersion,
        price: price ? parseFloat(price) : undefined,
        jupiterVerified: token.is_verified,
        jupiterVolume: 0 // Default to 0 as we don't have this data
      };
    });
    
    // Add wrapped versions of tokens if they don't exist
    const existingSymbols = new Set(universalTokens.map(t => `${t.symbol}-${t.chainId}`));
    const wrappedTokensToAdd: UniversalToken[] = [];
    
    universalTokens.forEach(token => {
      if (!token.isWrapped && token.wrappedVersion) {
        const wrappedKey = `${token.wrappedVersion}-${token.chainId}`;
        if (!existingSymbols.has(wrappedKey)) {
          wrappedTokensToAdd.push({
            symbol: token.wrappedVersion,
            name: `Universal ${token.name}`,
            decimals: token.decimals,
            address: `0xUniversal${token.symbol}Address`, // Placeholder
            chainId: token.chainId,
            chainName: 'Universal',
            isWrapped: true,
            logoURI: token.logoURI,
            unwrappedVersion: token.symbol,
            price: token.price, // Inherit price from unwrapped token
            jupiterVerified: false
          });
        }
      }
    });
    
    // Combine all tokens
    const allTokens = [...universalTokens, ...wrappedTokensToAdd];
    
    // Return tokens
    res.status(200).json(allTokens);
  } catch (error) {
    console.error('Error fetching universal tokens:', error);
    res.status(500).json({ error: 'Failed to fetch universal tokens' });
  }
} 