import { Connection, Client } from '@temporalio/client';
import { Token } from '../components/TokenSelector';
import { v4 as uuidv4 } from 'uuid';

// Define the SwapRequest type to match the Go type
export interface SwapRequest {
  sourceToken: Token;
  destinationToken: Token;
  amount: string; // Using string for big numbers, but ensure it's a plain number string without quotes
  sourceAddress: string;
  destinationAddress: string;
  slippage: number;
  deadline: string; // ISO date string
  refundAddress?: string;
  requestID?: string;
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
    
    // Parse the amount as a number to avoid serialization issues with Go's big.Int
    const parsedAmount = parseFloat(request.amount);
    if (isNaN(parsedAmount)) {
      throw new Error('Invalid amount: must be a number');
    }
    
    console.log('Original amount:', request.amount);
    console.log('Parsed amount:', parsedAmount);
    
    // Create a clean copy of the request with the parsed amount
    const cleanRequest = {
      ...request,
      // Convert back to string but ensure it's a clean number string
      amount: parsedAmount.toString()
    };
    
    const client = await getTemporalClient();
    
    // Start the workflow with the clean request
    // We'll also add a special serialization hint to the client
    const handle = await client.workflow.start('SwapWorkflow', {
      args: [{ request: cleanRequest }],
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