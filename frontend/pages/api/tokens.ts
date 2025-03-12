import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

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

// Cache tokens to avoid repeated API calls
let tokenCache: JupToken[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = Date.now();
    
    // Use cached tokens if available and not expired
    if (tokenCache && now - lastFetchTime < CACHE_DURATION) {
      return res.status(200).json(tokenCache);
    }
    
    // Fetch tokens from Jup.ag
    const response = await axios.get('https://token.jup.ag/all');
    const tokens: JupToken[] = response.data;
    
    // Update cache
    tokenCache = tokens;
    lastFetchTime = now;
    
    // Return tokens
    res.status(200).json(tokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    
    // If we have cached tokens, return them even if expired
    if (tokenCache) {
      console.log('Returning cached tokens due to API error');
      return res.status(200).json(tokenCache);
    }
    
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
} 