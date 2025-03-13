import { NextApiRequest, NextApiResponse } from 'next';
import { getLatestTokenPrices } from '../../lib/db';

// Define the price data type
export type TokenPrice = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  last_updated: string;
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
    
    // Get prices from database
    const dbPrices = await getLatestTokenPrices();
    
    // Convert database prices to the expected format
    const prices: TokenPrice[] = dbPrices
      .filter(price => symbolList.includes(price.symbol.toLowerCase()))
      .map(price => ({
        id: price.symbol.toLowerCase(),
        symbol: price.symbol.toLowerCase(),
        name: price.name,
        current_price: price.price_usd,
        price_change_percentage_24h: price.change_24h || 0,
        last_updated: price.last_updated
      }));
    
    // Return prices
    res.status(200).json(prices);
  } catch (error) {
    console.error('Error fetching token prices:', error);
    res.status(500).json({ error: 'Failed to fetch token prices' });
  }
} 