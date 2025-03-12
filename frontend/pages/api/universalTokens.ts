import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

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
};

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), '.universal-token-cache.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Mock Universal.xyz wrapped tokens (in a real implementation, this would come from Universal.xyz API)
const UNIVERSAL_TOKENS: UniversalToken[] = [
  // Ethereum tokens and their wrapped versions
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH address
    chainId: 1,
    chainName: 'Ethereum',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    wrappedVersion: 'uETH',
  },
  {
    symbol: 'uETH',
    name: 'Universal Ethereum',
    decimals: 18,
    address: '0xUniversalETHAddress', // Placeholder
    chainId: 1,
    chainName: 'Universal',
    isWrapped: true,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    unwrappedVersion: 'ETH',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    chainName: 'Ethereum',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    wrappedVersion: 'uUSDC',
  },
  {
    symbol: 'uUSDC',
    name: 'Universal USD Coin',
    decimals: 6,
    address: '0xUniversalUSDCAddress', // Placeholder
    chainId: 1,
    chainName: 'Universal',
    isWrapped: true,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    unwrappedVersion: 'USDC',
  },
  
  // Polygon tokens and their wrapped versions
  {
    symbol: 'MATIC',
    name: 'Polygon',
    decimals: 18,
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC address
    chainId: 137,
    chainName: 'Polygon',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0/logo.png',
    wrappedVersion: 'uMATIC',
  },
  {
    symbol: 'uMATIC',
    name: 'Universal Polygon',
    decimals: 18,
    address: '0xUniversalMATICAddress', // Placeholder
    chainId: 137,
    chainName: 'Universal',
    isWrapped: true,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0/logo.png',
    unwrappedVersion: 'MATIC',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    chainId: 137,
    chainName: 'Polygon',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    wrappedVersion: 'uUSDC',
  },
  
  // Avalanche tokens and their wrapped versions
  {
    symbol: 'AVAX',
    name: 'Avalanche',
    decimals: 18,
    address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX address
    chainId: 43114,
    chainName: 'Avalanche',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png',
    wrappedVersion: 'uAVAX',
  },
  {
    symbol: 'uAVAX',
    name: 'Universal Avalanche',
    decimals: 18,
    address: '0xUniversalAVAXAddress', // Placeholder
    chainId: 43114,
    chainName: 'Universal',
    isWrapped: true,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png',
    unwrappedVersion: 'AVAX',
  },
  
  // Solana tokens and their wrapped versions
  {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    address: 'So11111111111111111111111111111111111111112', // Native SOL address
    chainId: 999, // Using 999 as Solana chain ID
    chainName: 'Solana',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    wrappedVersion: 'uSOL',
  },
  {
    symbol: 'uSOL',
    name: 'Universal Solana',
    decimals: 9,
    address: '0xUniversalSOLAddress', // Placeholder
    chainId: 999,
    chainName: 'Universal',
    isWrapped: true,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    unwrappedVersion: 'SOL',
  },
];

// Read cache from file
const readCache = (): { tokens: UniversalToken[], timestamp: number } | null => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error('Error reading universal token cache:', error);
  }
  return null;
};

// Write cache to file
const writeCache = (tokens: UniversalToken[]) => {
  try {
    const cacheData = JSON.stringify({
      tokens,
      timestamp: Date.now()
    });
    fs.writeFileSync(CACHE_FILE_PATH, cacheData, 'utf8');
  } catch (error) {
    console.error('Error writing universal token cache:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for query parameters to filter tokens
    const { chainId, search, wrapped } = req.query;
    
    // Try to read from cache first
    const cache = readCache();
    const now = Date.now();
    
    // Use cached tokens if available and not expired
    let tokens: UniversalToken[] = [];
    if (cache && now - cache.timestamp < CACHE_DURATION) {
      tokens = cache.tokens;
    } else {
      // In a real implementation, this would fetch from Universal.xyz API
      tokens = UNIVERSAL_TOKENS;
      
      // Update cache
      writeCache(tokens);
    }
    
    // Apply filters
    if (chainId) {
      const chainIdNum = parseInt(chainId as string, 10);
      tokens = tokens.filter(token => token.chainId === chainIdNum);
    }
    
    if (wrapped !== undefined) {
      const isWrapped = wrapped === 'true';
      tokens = tokens.filter(token => token.isWrapped === isWrapped);
    }
    
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      tokens = tokens.filter(token => 
        token.symbol.toLowerCase().includes(searchTerm) || 
        token.name.toLowerCase().includes(searchTerm) ||
        token.address.toLowerCase().includes(searchTerm)
      );
    }
    
    // Return tokens
    res.status(200).json(tokens);
  } catch (error) {
    console.error('Error fetching universal tokens:', error);
    res.status(500).json({ error: 'Failed to fetch universal tokens' });
  }
} 