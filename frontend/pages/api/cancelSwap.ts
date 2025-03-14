import type { NextApiRequest, NextApiResponse } from 'next';
import { cancelSwap } from '../../services/temporalService';
import { cancelWorkflow } from '../../services/mockWorkflowState';

type CancelSwapResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

// Import the workflowStates from swapStatus.ts
// In a real implementation, this would be in a shared database
// For this mock, we'll declare it here but it won't be shared with swapStatus.ts
const workflowStates = new Map<string, any>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CancelSwapResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { workflowId } = req.body;

    // Validate required fields
    if (!workflowId) {
      return res.status(400).json({
        success: false,
        error: 'Missing workflow ID'
      });
    }

    // For development, use mock data instead of calling Temporal
    if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_SWAP === 'true') {
      console.log('Using mock cancel swap for workflow:', workflowId);
      
      // Mark the workflow as cancelled in the shared state
      const state = cancelWorkflow(workflowId);
      
      if (!state) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          message: 'Swap cancelled successfully (mock)',
          workflowId
        }
      });
    }

    // Cancel the swap using Temporal
    const cancelled = await cancelSwap(workflowId);

    if (cancelled) {
      return res.status(200).json({
        success: true,
        data: {
          message: 'Swap cancelled successfully',
          workflowId
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel swap'
      });
    }
  } catch (error) {
    console.error('Error cancelling swap:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
} 