import { NextApiRequest, NextApiResponse } from 'next';

type SwapRequest = {
  sourceToken: string;
  sourceChain: string;
  destinationToken: string;
  destinationChain: string;
  amount: string;
  sourceAddress: string;
  destinationAddress: string;
  slippage: number;
};

// Mock transaction for simulating responses
const generateMockTransaction = (request: SwapRequest) => {
  const requestId = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const sourceTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  
  return {
    requestId,
    sourceTransaction: {
      hash: sourceTxHash,
      status: 'completed',
      blockNumber: Math.floor(Math.random() * 1000000) + 15000000,
    },
    estimatedOutput: calculateEstimatedOutput(request),
    fee: {
      gas: (parseFloat(request.amount) * 0.001).toFixed(6),
      protocol: (parseFloat(request.amount) * 0.003).toFixed(6),
      bridge: request.sourceChain !== request.destinationChain 
        ? (parseFloat(request.amount) * 0.002).toFixed(6)
        : '0',
      total: (
        parseFloat(request.amount) * 0.001 + 
        parseFloat(request.amount) * 0.003 + 
        (request.sourceChain !== request.destinationChain ? parseFloat(request.amount) * 0.002 : 0)
      ).toFixed(6),
    },
    estimatedTime: request.sourceChain !== request.destinationChain ? 15 : 5,
  };
};

// Simulate exchange rate calculations
const calculateEstimatedOutput = (request: SwapRequest) => {
  const amount = parseFloat(request.amount);
  
  if (isNaN(amount)) {
    return '0';
  }
  
  let rate = 1;
  
  // Mock rates for demo purposes
  if (request.sourceToken === 'ETH' && request.destinationToken === 'USDC') {
    rate = 2000; // 1 ETH = 2000 USDC
  } else if (request.sourceToken === 'USDC' && request.destinationToken === 'ETH') {
    rate = 0.0005; // 1 USDC = 0.0005 ETH
  } else if (request.sourceToken === 'MATIC' && request.destinationToken === 'USDC') {
    rate = 0.5; // 1 MATIC = 0.5 USDC
  } else if (request.sourceToken === 'AVAX' && request.destinationToken === 'USDC') {
    rate = 10; // 1 AVAX = 10 USDC
  }
  
  const output = amount * rate;
  
  // Apply fees
  const fee = output * 0.003;
  const netOutput = output - fee;
  
  return netOutput.toFixed(6);
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const swapRequest = req.body as SwapRequest;
    
    // Validate request
    if (!swapRequest.sourceToken || !swapRequest.destinationToken || !swapRequest.amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Simulate processing delay
    setTimeout(() => {
      const result = generateMockTransaction(swapRequest);
      res.status(200).json(result);
    }, 1000);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 