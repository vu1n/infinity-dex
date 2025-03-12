import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Define the token type based on Jup.ag response
export type JupToken = {
  address: string;
  chainId: number;
  decimals: number;
  logoURI: string;
  name: string;
  symbol: string;
  tags: string[];
};

// Simplified token type for frontend
export type SimplifiedToken = {
  address: string;
  decimals: number;
  logoURI: string;
  name: string;
  symbol: string;
};

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), '.token-cache.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Filter tokens by criteria
const filterTokens = (tokens: JupToken[]): SimplifiedToken[] => {
  // Filter out tokens with no logo, sort by volume/popularity (using tags as a proxy)
  const filteredTokens = tokens
    .filter(token => 
      // Keep tokens with logos and exclude spam tokens
      token.logoURI && 
      !token.tags?.includes('spam') &&
      // Keep only tokens with certain tags or popular tokens
      (token.tags?.includes('popular') || 
       token.tags?.includes('listed') || 
       ['SOL', 'USDC', 'USDT', 'BTC', 'ETH', 'BONK', 'JUP', 'RAY'].includes(token.symbol))
    )
    .slice(0, 200); // Limit to top 200 tokens
  
  // Map to simplified token structure
  return filteredTokens.map(token => ({
    address: token.address,
    decimals: token.decimals,
    logoURI: token.logoURI,
    name: token.name,
    symbol: token.symbol,
  }));
};

// Read cache from file
const readCache = (): { tokens: SimplifiedToken[], timestamp: number } | null => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error('Error reading token cache:', error);
  }
  return null;
};

// Write cache to file
const writeCache = (tokens: SimplifiedToken[]) => {
  try {
    const cacheData = JSON.stringify({
      tokens,
      timestamp: Date.now()
    });
    fs.writeFileSync(CACHE_FILE_PATH, cacheData, 'utf8');
  } catch (error) {
    console.error('Error writing token cache:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for query parameters to filter tokens
    const { search, limit = '200' } = req.query;
    const maxTokens = parseInt(limit as string, 10);
    
    // Try to read from cache first
    const cache = readCache();
    const now = Date.now();
    
    // Use cached tokens if available and not expired
    if (cache && now - cache.timestamp < CACHE_DURATION) {
      let tokens = cache.tokens;
      
      // Apply search filter if provided
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        tokens = tokens.filter(token => 
          token.symbol.toLowerCase().includes(searchTerm) || 
          token.name.toLowerCase().includes(searchTerm) ||
          token.address.toLowerCase().includes(searchTerm)
        );
      }
      
      // Apply limit
      tokens = tokens.slice(0, maxTokens);
      
      return res.status(200).json(tokens);
    }
    
    // Fetch tokens from Jup.ag if cache is invalid
    const response = await axios.get('https://token.jup.ag/all');
    const jupTokens: JupToken[] = response.data;
    
    // Filter and simplify tokens
    const simplifiedTokens = filterTokens(jupTokens);
    
    // Update cache
    writeCache(simplifiedTokens);
    
    // Apply search filter if provided
    let tokens = simplifiedTokens;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      tokens = tokens.filter(token => 
        token.symbol.toLowerCase().includes(searchTerm) || 
        token.name.toLowerCase().includes(searchTerm) ||
        token.address.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply limit
    tokens = tokens.slice(0, maxTokens);
    
    // Return tokens
    res.status(200).json(tokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    
    // Try to use cache even if expired in case of error
    const cache = readCache();
    if (cache) {
      console.log('Returning cached tokens due to API error');
      return res.status(200).json(cache.tokens.slice(0, parseInt(req.query.limit as string || '200', 10)));
    }
    
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
} 