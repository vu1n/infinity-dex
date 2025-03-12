import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

type PriceRequest = {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
};

type PriceResponse = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: number;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { inputMint, outputMint, amount, slippageBps = 50 } = req.query;

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Construct the query URL
    const url = new URL('https://quote-api.jup.ag/v6/quote');
    url.searchParams.append('inputMint', inputMint as string);
    url.searchParams.append('outputMint', outputMint as string);
    url.searchParams.append('amount', amount as string);
    url.searchParams.append('slippageBps', slippageBps as string);

    // Fetch price quote from Jup.ag
    const response = await axios.get(url.toString());
    const priceQuote: PriceResponse = response.data;

    // Return the price quote
    res.status(200).json({
      inputMint: priceQuote.inputMint,
      outputMint: priceQuote.outputMint,
      inAmount: priceQuote.inAmount,
      outAmount: priceQuote.outAmount,
      priceImpactPct: priceQuote.priceImpactPct,
      slippageBps: priceQuote.slippageBps,
      // Calculate the exchange rate
      exchangeRate: (
        Number(priceQuote.outAmount) / Number(priceQuote.inAmount)
      ).toString(),
    });
  } catch (error) {
    console.error('Error fetching price quote:', error);
    res.status(500).json({ error: 'Failed to fetch price quote' });
  }
} 