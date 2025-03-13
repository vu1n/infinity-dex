import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { UniversalToken } from './universalTokens';

// Define the Jupiter token type
export type JupiterToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags: string[];
  daily_volume?: number;
  created_at?: string;
  extensions?: {
    coingeckoId?: string;
  };
};

// Cache file path
const CACHE_FILE_PATH = path.join(process.cwd(), '.jupiter-token-cache.json');
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Read cache from file
const readCache = (): { tokens: JupiterToken[], timestamp: number } | null => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error('Error reading Jupiter token cache:', error);
  }
  return null;
};

// Write cache to file
const writeCache = (tokens: JupiterToken[]) => {
  try {
    const cacheData = JSON.stringify({
      tokens,
      timestamp: Date.now()
    });
    fs.writeFileSync(CACHE_FILE_PATH, cacheData, 'utf8');
  } catch (error) {
    console.error('Error writing Jupiter token cache:', error);
  }
};

// Fetch Jupiter verified tokens
const fetchJupiterTokens = async (): Promise<JupiterToken[]> => {
  try {
    // Fetch verified tokens from Jupiter API
    const response = await axios.get('https://api.jup.ag/tokens/v1/tagged/verified');
    const tokens: JupiterToken[] = response.data;
    
    console.log(`Fetched ${tokens.length} verified tokens from Jupiter API`);
    return tokens;
  } catch (error) {
    console.error('Error fetching Jupiter tokens:', error);
    return [];
  }
};

// Convert Jupiter tokens to Universal tokens format
const convertToUniversalTokens = (jupiterTokens: JupiterToken[]): UniversalToken[] => {
  return jupiterTokens.map(token => ({
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    address: token.address,
    chainId: 999, // Solana chain ID
    chainName: 'Solana',
    isWrapped: false,
    logoURI: token.logoURI,
    price: 0, // Will be updated later
    // Add Jupiter-specific metadata
    jupiterVerified: true,
    jupiterVolume: token.daily_volume || 0
  }));
};

// Filter tokens to get only memecoins
const filterMemecoins = (tokens: JupiterToken[]): JupiterToken[] => {
  // Known memecoin symbols (case insensitive)
  const knownMemecoins = [
    'bonk', 'wif', 'dogwif', 'bome', 'book of meme', 'popcat', 'cat', 
    'mog', 'slerf', 'sloth', 'nope', 'wen', 'samo', 'doge', 'shib', 
    'pepe', 'cope', 'ape', 'monkey', 'frog', 'moon', 'rocket', 'wojak',
    'jup', 'jupiter', 'pyth', 'ray', 'raydium'
  ];
  
  // Filter tokens that:
  // 1. Have the 'verified' tag
  // 2. Are on Solana
  // 3. Match known memecoin symbols or names
  // 4. Have some daily volume (if available)
  return tokens.filter(token => {
    // Must be verified
    if (!token.tags.includes('verified')) return false;
    
    // Check if it's a known memecoin
    const symbolLower = token.symbol.toLowerCase();
    const nameLower = token.name.toLowerCase();
    
    const isKnownMemecoin = knownMemecoins.some(memecoin => 
      symbolLower.includes(memecoin.toLowerCase()) || 
      nameLower.includes(memecoin.toLowerCase())
    );
    
    // Check if it has some volume (if available)
    const hasVolume = !token.daily_volume || token.daily_volume > 1000;
    
    return isKnownMemecoin && hasVolume;
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if we should include all tokens or just memecoins
    const { memecoinsOnly } = req.query;
    const onlyMemecoins = memecoinsOnly === 'true';
    
    // Try to read from cache first
    const cache = readCache();
    const now = Date.now();
    
    // Use cached tokens if available and not expired
    let jupiterTokens: JupiterToken[] = [];
    
    if (cache && now - cache.timestamp < CACHE_DURATION) {
      jupiterTokens = cache.tokens;
      console.log(`Using ${jupiterTokens.length} cached Jupiter tokens`);
    } else {
      // Fetch fresh tokens
      jupiterTokens = await fetchJupiterTokens();
      
      // Cache the tokens
      if (jupiterTokens.length > 0) {
        writeCache(jupiterTokens);
      }
    }
    
    // Filter tokens if needed
    let filteredTokens = jupiterTokens;
    if (onlyMemecoins) {
      filteredTokens = filterMemecoins(jupiterTokens);
      console.log(`Filtered to ${filteredTokens.length} memecoins`);
    }
    
    // Convert to Universal tokens format
    const universalTokens = convertToUniversalTokens(filteredTokens);
    
    // Return the tokens
    res.status(200).json(universalTokens);
  } catch (error) {
    console.error('Error handling Jupiter tokens request:', error);
    res.status(500).json({ error: 'Failed to fetch Jupiter tokens' });
  }
} 