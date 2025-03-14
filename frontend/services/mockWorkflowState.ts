// This file provides a mock implementation of workflow state management
// In a real application, this would be stored in a database

export interface WorkflowState {
  workflowId: string;
  status: 'pending' | 'quoted' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  confirmed: boolean;
  inputAmount?: string;
  outputAmount?: string;
  exchangeRate?: string;
}

// In-memory storage for workflow states
const workflowStates = new Map<string, WorkflowState>();

// Get a workflow state by ID
export function getWorkflowState(workflowId: string): WorkflowState | undefined {
  return workflowStates.get(workflowId);
}

// Create or update a workflow state
export function setWorkflowState(workflowId: string, state: Partial<WorkflowState>): WorkflowState {
  const existingState = workflowStates.get(workflowId);
  
  const newState: WorkflowState = {
    workflowId,
    status: state.status || existingState?.status || 'pending',
    createdAt: existingState?.createdAt || new Date(),
    updatedAt: new Date(),
    confirmed: state.confirmed !== undefined ? state.confirmed : (existingState?.confirmed || false),
    inputAmount: state.inputAmount || existingState?.inputAmount,
    outputAmount: state.outputAmount || existingState?.outputAmount,
    exchangeRate: state.exchangeRate || existingState?.exchangeRate
  };
  
  workflowStates.set(workflowId, newState);
  return newState;
}

// Create a new workflow state with initial values
export function createWorkflowState(workflowId: string, inputAmount: string): WorkflowState {
  // Calculate a realistic output amount based on the input amount
  const exchangeRate = '15.06';
  const outputAmount = (parseFloat(inputAmount) * parseFloat(exchangeRate)).toFixed(6);
  
  const state: WorkflowState = {
    workflowId,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmed: false,
    inputAmount,
    outputAmount,
    exchangeRate
  };
  
  workflowStates.set(workflowId, state);
  return state;
}

// Update the workflow state based on time elapsed
export function updateWorkflowState(workflowId: string): WorkflowState | undefined {
  const state = workflowStates.get(workflowId);
  if (!state) return undefined;
  
  const now = new Date();
  const elapsedSeconds = (now.getTime() - state.createdAt.getTime()) / 1000;
  
  // Update the state based on time elapsed
  if (state.status === 'pending' && elapsedSeconds > 5) {
    state.status = 'quoted';
    state.updatedAt = now;
  } else if (state.status === 'quoted' && state.confirmed && elapsedSeconds > 15) {
    // 90% chance of success, 10% chance of failure
    state.status = Math.random() < 0.9 ? 'completed' : 'failed';
    state.updatedAt = now;
  }
  
  workflowStates.set(workflowId, state);
  return state;
}

// Mark a workflow as confirmed
export function confirmWorkflow(workflowId: string): WorkflowState | undefined {
  const state = workflowStates.get(workflowId);
  if (!state) return undefined;
  
  state.confirmed = true;
  state.updatedAt = new Date();
  
  workflowStates.set(workflowId, state);
  return state;
}

// Mark a workflow as cancelled/failed
export function cancelWorkflow(workflowId: string): WorkflowState | undefined {
  const state = workflowStates.get(workflowId);
  if (!state) return undefined;
  
  state.status = 'failed';
  state.updatedAt = new Date();
  
  workflowStates.set(workflowId, state);
  return state;
}

// Helper function to generate a random hash
export function generateRandomHash(): string {
  return Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
} 