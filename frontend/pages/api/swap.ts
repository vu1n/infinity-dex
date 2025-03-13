import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Define the response type
type SwapResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

// Define the swap request type
type SwapRequest = {
  sourceChain: string;
  destinationChain: string;
  sourceToken: string;
  destinationToken: string;
  amount: string;
  slippage: string;
  walletAddress: string;
  signature?: string;
};

// Define the route step type
export type RouteStep = {
  type: 'wrap' | 'unwrap' | 'swap';
  fromToken: string;
  toToken: string;
  fromChain?: string;
  toChain?: string;
};

// Define the swap route type
export type SwapRoute = {
  steps: RouteStep[];
  exchangeRate: string;
  estimatedGas: string;
  estimatedTime: string;
};

// Get the backend service URL from environment variables
const SWAP_SERVICE_URL = process.env.SWAP_SERVICE_URL || 'http://localhost:8080';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SwapResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      sourceChain,
      destinationChain,
      sourceToken,
      destinationToken,
      amount,
      slippage,
      walletAddress,
      signature
    } = req.body as SwapRequest;

    // Validate required fields
    if (!sourceChain || !destinationChain || !sourceToken || !destinationToken || !amount || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // For testnet implementation, we'll mock the swap process
    if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_SWAP === 'true') {
      console.log('Using mock swap implementation for testnet');
      
      // Create a mock swap route
      const isCrossChain = sourceChain !== destinationChain;
      const mockRoute: SwapRoute = {
        steps: [],
        exchangeRate: '0',
        estimatedGas: isCrossChain ? '0.005' : '0.002',
        estimatedTime: isCrossChain ? '30-60' : '10-30'
      };

      // Add steps based on whether it's cross-chain or not
      if (isCrossChain) {
        // For cross-chain swaps, we need to wrap, swap, and unwrap
        if (sourceToken !== `u${sourceToken}`) {
          mockRoute.steps.push({
            type: 'wrap',
            fromToken: sourceToken,
            toToken: `u${sourceToken}`,
            fromChain: sourceChain,
            toChain: sourceChain
          });
        }

        mockRoute.steps.push({
          type: 'swap',
          fromToken: `u${sourceToken}`,
          toToken: `u${destinationToken}`,
          fromChain: sourceChain,
          toChain: destinationChain
        });

        if (destinationToken !== `u${destinationToken}`) {
          mockRoute.steps.push({
            type: 'unwrap',
            fromToken: `u${destinationToken}`,
            toToken: destinationToken,
            fromChain: destinationChain,
            toChain: destinationChain
          });
        }
      } else {
        // For same-chain swaps, we just need a single swap step
        mockRoute.steps.push({
          type: 'swap',
          fromToken: sourceToken,
          toToken: destinationToken,
          fromChain: sourceChain,
          toChain: destinationChain
        });
      }

      // Mock transaction hash
      const mockTxHash = `0x${Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)).join('')}`;

      // Return mock response
      return res.status(200).json({
        success: true,
        data: {
          route: mockRoute,
          transactionHash: mockTxHash,
          status: 'pending'
        }
      });
    }

    // For production, connect to the actual swap service
    const response = await axios.post(`${SWAP_SERVICE_URL}/api/v1/swap`, {
      sourceChain,
      destinationChain,
      sourceToken,
      destinationToken,
      amount,
      slippage: slippage || '0.5',
      walletAddress,
      signature
    });

    return res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error processing swap:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}

// Helper function to execute a swap transaction
export async function executeSwap(
  sourceChain: string,
  destinationChain: string,
  sourceToken: string,
  destinationToken: string,
  amount: string,
  walletAddress: string,
  signature?: string
): Promise<any> {
  try {
    const response = await axios.post('/api/swap', {
      sourceChain,
      destinationChain,
      sourceToken,
      destinationToken,
      amount,
      slippage: '0.5', // Default slippage
      walletAddress,
      signature
    });

    return response.data;
  } catch (error) {
    console.error('Error executing swap:', error);
    throw error;
  }
}

// Helper function to get a swap quote
export async function getSwapQuote(
  sourceChain: string,
  destinationChain: string,
  sourceToken: string,
  destinationToken: string,
  amount: string
): Promise<any> {
  try {
    const response = await axios.post('/api/quote', {
      sourceChain,
      destinationChain,
      sourceToken,
      destinationToken,
      amount
    });

    return response.data;
  } catch (error) {
    console.error('Error getting swap quote:', error);
    throw error;
  }
} 