import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { startSwapWorkflow, SwapRequest as TemporalSwapRequest } from '../../services/temporalService';
import { createWorkflowState } from '../../services/mockWorkflowState';

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

// Define when to use mock implementation vs Temporal
const USE_MOCK_IMPLEMENTATION = process.env.USE_MOCK_IMPLEMENTATION === 'true';
const USE_TEMPORAL = process.env.USE_TEMPORAL === 'true' || process.env.NODE_ENV === 'development';

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

    // For testnet implementation or when using Temporal
    if (USE_TEMPORAL || USE_MOCK_IMPLEMENTATION) {
      console.log('Using Temporal workflow or mock implementation for swap');
      
      try {
        // Convert the API request to a Temporal swap request
        let sourceTokenObj = await fetchTokenDetails(sourceToken, sourceChain);
        let destTokenObj = await fetchTokenDetails(destinationToken, destinationChain);
        
        if (!sourceTokenObj || !destTokenObj) {
          return res.status(400).json({
            success: false,
            error: 'Invalid token details'
          });
        }
        
        // Ensure chainId is a number, not a string
        if (typeof sourceTokenObj.chainId === 'string') {
          sourceTokenObj = {
            ...sourceTokenObj,
            chainId: parseInt(sourceTokenObj.chainId, 10)
          };
        }
        
        if (typeof destTokenObj.chainId === 'string') {
          destTokenObj = {
            ...destTokenObj,
            chainId: parseInt(destTokenObj.chainId, 10)
          };
        }
        
        // Parse the amount as a number to avoid double-quoting issues
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid amount: must be a positive number greater than zero'
          });
        }
        
        // Keep the amount as a number
        console.log('Original amount:', amount);
        console.log('Parsed amount:', parsedAmount);
        
        let workflowId: string;
        
        if (USE_MOCK_IMPLEMENTATION) {
          // Generate a unique workflow ID for mocking
          workflowId = `swap-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          // Create initial workflow state for mocking
          createWorkflowState(workflowId, parsedAmount.toString());
        } else {
          // Use Temporal workflow with mock flag
          const temporalRequest: TemporalSwapRequest = {
            sourceToken: sourceTokenObj,
            destinationToken: destTokenObj,
            amount: parsedAmount, // Pass the amount as a number
            sourceAddress: walletAddress,
            destinationAddress: walletAddress, // Using the same address for source and destination
            slippage: parseFloat(slippage || '0.5'),
            deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
            // Add a flag to indicate this should be mocked within the workflow
            mockExecution: true
          };
          
          console.log('Sending Temporal request with amount:', parsedAmount);
          
          // Start the Temporal workflow
          workflowId = await startSwapWorkflow(temporalRequest);
          console.log(`Started Temporal workflow with ID: ${workflowId}`);
        }
        
        // Create a mock swap route for UI display
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
        
        // Return response with workflow ID
        return res.status(200).json({
          success: true,
          data: {
            workflowId,
            route: mockRoute,
            status: 'pending'
          }
        });
      } catch (error) {
        console.error('Error starting swap workflow:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start swap workflow'
        });
      }
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

// Helper function to fetch token details
async function fetchTokenDetails(symbol: string, chainName: string) {
  try {
    // Use the tokens directly from the request instead of making an API call
    // This avoids the need for an internal API call from the server
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : '';
        
    const response = await axios.get(`${baseUrl}/api/universalTokens?includeJupiter=true`);
    
    if (response.data) {
      // Find the token that matches the symbol and chain
      const token = response.data.find((t: any) => 
        t.symbol.toLowerCase() === symbol.toLowerCase() && 
        t.chainName.toLowerCase() === chainName.toLowerCase()
      );
      
      if (token) {
        // Ensure chainId is a number
        if (typeof token.chainId === 'string') {
          token.chainId = parseInt(token.chainId, 10);
        }
        return token;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching token details:', error);
    return null;
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