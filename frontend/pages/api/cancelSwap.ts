import type { NextApiRequest, NextApiResponse } from 'next';
import { cancelSwap } from '../../services/temporalService';
import { cancelWorkflow, getWorkflowState, createWorkflowState } from '../../services/mockWorkflowState';

type CancelSwapResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

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
      
      // Get or create the workflow state
      let state = getWorkflowState(workflowId);
      if (!state) {
        // Create a new workflow state with a default input amount
        console.log('Creating new workflow state for:', workflowId);
        const inputAmount = '1';
        state = createWorkflowState(workflowId, inputAmount);
      }
      
      // Mark the workflow as cancelled in the shared state
      state = cancelWorkflow(workflowId);
      
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