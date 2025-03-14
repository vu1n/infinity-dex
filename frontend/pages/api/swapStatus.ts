import type { NextApiRequest, NextApiResponse } from 'next';
import { getSwapResult } from '../../services/temporalService';
import { 
  getWorkflowState, 
  updateWorkflowState, 
  createWorkflowState, 
  generateRandomHash 
} from '../../services/mockWorkflowState';

type SwapStatusResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SwapStatusResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { workflowId } = req.query;

    // Validate required fields
    if (!workflowId || Array.isArray(workflowId)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid workflow ID'
      });
    }

    // For development, use mock data instead of calling Temporal
    if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_SWAP === 'true') {
      console.log('Using mock swap status for workflow:', workflowId);
      
      // Extract the request ID from the workflow ID (format: swap-{requestId})
      const requestId = workflowId.replace('swap-', '');
      
      // Get or create the workflow state
      let state = getWorkflowState(workflowId);
      if (!state) {
        // Create a new workflow state with a random input amount
        const inputAmount = Math.random() > 0.5 ? '1' : '0.5';
        state = createWorkflowState(workflowId, inputAmount);
      }
      
      // Update the workflow state based on time elapsed
      state = updateWorkflowState(workflowId) || state;
      
      // Return the appropriate response based on the workflow state
      if (state.status === 'quoted') {
        return res.status(200).json({
          success: true,
          data: {
            requestID: requestId,
            status: 'quoted',
            quote: {
              inputAmount: state.inputAmount,
              outputAmount: state.outputAmount,
              exchangeRate: state.exchangeRate,
              fee: {
                gasFee: '0.001',
                protocolFee: '0.002',
                networkFee: '0.0005',
                bridgeFee: '0.0015',
                totalFeeUSD: 5.50
              }
            }
          }
        });
      } else if (state.status === 'completed') {
        return res.status(200).json({
          success: true,
          data: {
            requestID: requestId,
            success: true,
            sourceTx: { hash: `0x${generateRandomHash()}`, status: 'confirmed' },
            destinationTx: { hash: `0x${generateRandomHash()}`, status: 'confirmed' },
            inputAmount: state.inputAmount,
            outputAmount: state.outputAmount,
            exchangeRate: state.exchangeRate,
            fee: {
              gasFee: '0.001',
              protocolFee: '0.002',
              networkFee: '0.0005',
              bridgeFee: '0.0015',
              totalFeeUSD: 5.50
            },
            completionTime: new Date().toISOString()
          }
        });
      } else if (state.status === 'failed') {
        return res.status(200).json({
          success: true,
          data: {
            requestID: requestId,
            success: false,
            inputAmount: state.inputAmount,
            outputAmount: state.outputAmount,
            exchangeRate: state.exchangeRate,
            errorMessage: 'Swap failed due to insufficient liquidity'
          }
        });
      } else {
        // Still in progress (pending)
        return res.status(200).json({
          success: true,
          data: {
            requestID: requestId,
            status: 'pending',
            message: 'Swap is being processed'
          }
        });
      }
    }

    // For production, get the actual swap result using Temporal
    const result = await getSwapResult(workflowId);

    if (result) {
      return res.status(200).json({
        success: true,
        data: result
      });
    } else {
      return res.status(200).json({
        success: true,
        data: {
          status: 'pending',
          message: 'Swap is being processed'
        }
      });
    }
  } catch (error) {
    console.error('Error getting swap status:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
} 