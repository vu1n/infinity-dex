import { NextRequest, NextResponse } from 'next/server';

// Define the price history response type
interface PriceHistoryPoint {
  timestamp: string;
  priceUSD: number;
  change24h: number;
  volume24h: number;
  marketCapUSD: number;
  source: string;
}

interface PriceHistoryResponse {
  symbol: string;
  chainId: number;
  chainName: string;
  history: PriceHistoryPoint[];
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const chainId = searchParams.get('chainId');
    const days = searchParams.get('days') || '7'; // Default to 7 days

    // Validate required parameters
    if (!symbol || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters: symbol and chainId' },
        { status: 400 }
      );
    }

    // Call the backend API to get price history
    const apiUrl = process.env.PRICE_API_URL || 'http://localhost:8080';
    const response = await fetch(
      `${apiUrl}/api/v1/prices/history?symbol=${symbol}&chainId=${chainId}&days=${days}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching price history: ${errorText}`);
      return NextResponse.json(
        { error: `Failed to fetch price history: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Format the response
    const formattedResponse: PriceHistoryResponse = {
      symbol: data.symbol,
      chainId: parseInt(chainId),
      chainName: data.chainName || getChainName(parseInt(chainId)),
      history: data.history.map((point: any) => ({
        timestamp: point.timestamp,
        priceUSD: point.priceUSD,
        change24h: point.change24h || 0,
        volume24h: point.volume24h || 0,
        marketCapUSD: point.marketCapUSD || 0,
        source: point.source,
      })),
    };

    return NextResponse.json(formattedResponse);
  } catch (error) {
    console.error('Error in token price history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get chain name from chain ID
function getChainName(chainId: number): string {
  const chainMap: Record<number, string> = {
    1: 'ethereum',
    56: 'binance',
    137: 'polygon',
    43114: 'avalanche',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    534352: 'scroll',
    59144: 'linea',
    324: 'zksync',
    1101: 'polygon-zkevm',
    100: 'gnosis',
    250: 'fantom',
    42220: 'celo',
    1284: 'moonbeam',
    1285: 'moonriver',
    30: 'rootstock',
    1313161554: 'aurora',
    128: 'heco',
    66: 'okex',
    288: 'boba',
    25: 'cronos',
    122: 'fuse',
    1666600000: 'harmony',
    2222: 'kava',
    1088: 'metis',
    106: 'velas',
    40: 'telos',
    592: 'astar',
    1399811149: 'solana',
  };

  return chainMap[chainId] || `chain-${chainId}`;
} 