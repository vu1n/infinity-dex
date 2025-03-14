import type { NextApiRequest, NextApiResponse } from 'next';
import { confirmSwap } from '../../services/temporalService';
import { confirmWorkflow } from '../../services/mockWorkflowState';

type ConfirmSwapResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

// Remove the duplicate workflowStates Map
// const workflowStates = new Map<string, any>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfirmSwapResponse>
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
      console.log('Using mock confirm swap for workflow:', workflowId);
      
      // Mark the workflow as confirmed in the shared state
      const state = confirmWorkflow(workflowId);
      
      if (!state) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          message: 'Swap confirmed successfully (mock)',
          workflowId
        }
      });
    }

    // Confirm the swap using Temporal
    const confirmed = await confirmSwap(workflowId);

    if (confirmed) {
      return res.status(200).json({
        success: true,
        data: {
          message: 'Swap confirmed successfully',
          workflowId
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to confirm swap'
      });
    }
  } catch (error) {
    console.error('Error confirming swap:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
} 