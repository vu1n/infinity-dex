import { Connection, Client } from '@temporalio/client';
import { Token } from '../components/TokenSelector';
import { v4 as uuidv4 } from 'uuid';

// Define the SwapRequest type to match the Go type
export interface SwapRequest {
  sourceToken: Token;
  destinationToken: Token;
  amount: string | number; // Can be a string or number
  sourceAddress: string;
  destinationAddress: string;
  slippage: number;
  deadline: string; // ISO date string
  refundAddress?: string;
  requestID?: string;
  mockExecution?: boolean; // Flag to indicate if the workflow should mock execution
}

// Define the SwapQuote type to match the Go type
export interface SwapQuote {
  sourceToken: Token;
  destinationToken: Token;
  inputAmount: string;
  outputAmount: string;
  fee: {
    gasFee: string;
    protocolFee: string;
    networkFee: string;
    bridgeFee: string;
    totalFeeUSD: number;
  };
  path: string[];
  priceImpact: number;
  exchangeRate: number;
}

// Define the SwapResult type to match the Go type
export interface SwapResult {
  requestID: string;
  success: boolean;
  sourceTx: any; // Simplified for now
  destinationTx: any; // Simplified for now
  bridgeTx?: any; // Simplified for now
  inputAmount: string;
  outputAmount: string;
  fee: {
    gasFee: string;
    protocolFee: string;
    networkFee: string;
    bridgeFee: string;
    totalFeeUSD: number;
  };
  completionTime: string;
  errorMessage?: string;
}

// Define the SwapWorkflowInput type to match the Go type
export interface SwapWorkflowInput {
  request: SwapRequest;
}

// Create a singleton Temporal client
let client: Client | null = null;

// Initialize the Temporal client
async function getTemporalClient(): Promise<Client> {
  if (!client) {
    // Connect to the Temporal server
    const connection = await Connection.connect({
      address: process.env.NEXT_PUBLIC_TEMPORAL_ADDRESS || 'localhost:7233',
    });
    
    client = new Client({
      connection,
      namespace: 'default',
    });
  }
  
  return client;
}

// Start a swap workflow
export async function startSwapWorkflow(request: SwapRequest): Promise<string> {
  try {
    // Ensure request has a requestID
    if (!request.requestID) {
      request.requestID = uuidv4();
    }
    
    // Set deadline if not provided
    if (!request.deadline) {
      const deadline = new Date();
      deadline.setMinutes(deadline.getMinutes() + 30); // 30 minutes from now
      request.deadline = deadline.toISOString();
    }
    
    // Log the original amount for debugging
    console.log('Original amount:', request.amount);
    
    // Convert the amount to an integer value based on token decimals
    // Go's big.Int can only handle integer values, not decimals
    const parsedAmount = parseFloat(request.amount.toString());
    if (isNaN(parsedAmount)) {
      throw new Error('Invalid amount: must be a number');
    }
    
    // Get the token decimals (e.g., 18 for ETH, 9 for SOL)
    const decimals = request.sourceToken.decimals;
    
    // Convert to integer by multiplying by 10^decimals
    // For example, 1.5 ETH becomes 1500000000000000000 (1.5 * 10^18)
    const amountInSmallestUnit = Math.floor(parsedAmount * Math.pow(10, decimals));
    
    console.log(`Converting ${parsedAmount} ${request.sourceToken.symbol} to ${amountInSmallestUnit} (smallest unit)`);
    
    // Create a clean copy of the request
    const cleanRequest = {
      ...request,
      // Use the integer amount as a number, not a string
      amount: amountInSmallestUnit
    };
    
    // Create the input object that matches the Go SwapWorkflowInput struct
    const workflowInput: SwapWorkflowInput = {
      request: cleanRequest
    };
    
    console.log('Full workflow input:', JSON.stringify(workflowInput, null, 2));
    
    const client = await getTemporalClient();
    
    // Start the workflow with the properly structured input
    const handle = await client.workflow.start('SwapWorkflow', {
      args: [workflowInput], // Send the wrapped request as expected by Go
      taskQueue: 'swap-queue',
      workflowId: `swap-${request.requestID}`,
    });
    
    console.log(`Started workflow with ID: ${handle.workflowId}`);
    return handle.workflowId;
  } catch (error) {
    console.error('Error starting swap workflow:', error);
    throw error;
  }
}

// Get the swap quote from a running workflow
export async function getSwapQuote(workflowId: string): Promise<SwapQuote | null> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    
    // Query the workflow for the quote
    // Note: This assumes the workflow has a query type 'getQuote'
    // You may need to adjust based on your Go workflow implementation
    const quote = await handle.query('getQuote');
    return quote as SwapQuote;
  } catch (error) {
    console.error('Error getting swap quote:', error);
    return null;
  }
}

// Confirm a swap
export async function confirmSwap(workflowId: string): Promise<boolean> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    
    // Signal the workflow to confirm the swap
    await handle.signal('confirm_swap', [true]);
    return true;
  } catch (error) {
    console.error('Error confirming swap:', error);
    return false;
  }
}

// Cancel a swap
export async function cancelSwap(workflowId: string): Promise<boolean> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    
    // Signal the workflow to cancel the swap
    await handle.signal('cancel_swap', [true]);
    return true;
  } catch (error) {
    console.error('Error cancelling swap:', error);
    return false;
  }
}

// Get the result of a swap
export async function getSwapResult(workflowId: string): Promise<SwapResult | null> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    
    // Get the result of the workflow
    const result = await handle.result();
    return result as SwapResult;
  } catch (error) {
    console.error('Error getting swap result:', error);
    return null;
  }
} 