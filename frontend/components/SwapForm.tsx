import React, { useState, useEffect, useCallback } from 'react';
import TokenSelector from './TokenSelector';
import { executeSwap } from '../pages/api/swap';
import { ConnectWalletButton, useWallet } from './WalletConnect';
import { ethers } from 'ethers';
import axios from 'axios';

// Define Token type if it doesn't exist in a separate file
interface Token {
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  chainName: string;
  address?: string;
  logoURI?: string;
  price?: number;
  isWrapped?: boolean;
  wrappedVersion?: string;
  unwrappedVersion?: string;
}

// Define the step in a swap route
interface RouteStep {
  type: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  exchangeRate?: string;
  fee?: {
    amount: string;
    token: string;
    usdValue: string;
  };
}

// Define the route for a swap
interface Route {
  steps: RouteStep[];
  totalFee?: {
    amount: string;
    token: string;
    usdValue: string;
  };
}

// API response types
interface TokensResponse {
  tokens: Token[];
}

interface PriceQuoteResponse {
  success: boolean;
  error?: string;
  estimatedOutput: string;
  exchangeRate: string;
  route: Route;
  totalFee?: {
    amount: string;
    token: string;
    usdValue: string;
  };
}

// Define the props for the SwapForm component
interface SwapFormProps {
  className?: string;
}

// Define the state for the swap form
interface SwapState {
  sourceToken: Token | null;
  destinationToken: Token | null;
  sourceAmount: string;
  destinationAmount: string;
  slippage: string;
  isLoading: boolean;
  error: string | null;
  exchangeRate: string;
  route: Route | null;
  transactionHash: string | null;
  transactionStatus: 'pending' | 'quoting' | 'quoted' | 'processing' | 'completed' | 'failed' | null;
  availableTokens: Token[];
  isLoadingTokens: boolean;
  workflowId: string | null;
  quote: {
    estimatedDestinationAmount: string;
    fee?: string;
  } | null;
  result: {
    destinationAmount: string;
    txHash?: string;
  } | null;
}

// Initial state for the swap form
const initialSwapState: SwapState = {
  sourceToken: null,
  destinationToken: null,
  sourceAmount: '',
  destinationAmount: '',
  slippage: '0.5',
  isLoading: false,
  error: null,
  exchangeRate: '0',
  route: null,
  transactionHash: null,
  transactionStatus: null,
  availableTokens: [],
  isLoadingTokens: true,
  workflowId: null,
  quote: null,
  result: null,
};

// Define the SwapForm component
const SwapForm: React.FC<SwapFormProps> = ({ className }) => {
  // State for the swap form
  const [swapState, setSwapState] = useState<SwapState>(initialSwapState);
  
  // Get wallet state from the WalletConnect context
  const { 
    ethereumWallet, 
    solanaWallet, 
    connectEthereum, 
    connectSolana, 
    currentChain,
    switchChain
  } = useWallet();

  // State for tracking if the form is ready to swap
  const [isReadyToSwap, setIsReadyToSwap] = useState(false);

  // Fetch available tokens on component mount
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setSwapState(prev => ({ ...prev, isLoadingTokens: true }));
        const response = await fetch('/api/universalTokens?includeJupiter=true');
        
        if (!response.ok) {
          throw new Error('Failed to fetch tokens');
        }
        
        const data = await response.json();
        
        // Find ETH and SOL tokens for default selection
        const ethToken = data.find((token: Token) => 
          token.symbol.toUpperCase() === 'ETH' && token.chainName.toLowerCase() === 'ethereum'
        );
        
        const solToken = data.find((token: Token) => 
          token.symbol.toUpperCase() === 'SOL' && token.chainName.toLowerCase() === 'solana'
        );
        
        setSwapState(prev => ({ 
          ...prev, 
          availableTokens: data,
          sourceToken: ethToken || null,
          destinationToken: solToken || null,
          sourceAmount: '1',
          isLoadingTokens: false 
        }));
        
        // If we have both default tokens, fetch initial price quote
        if (ethToken && solToken) {
          setTimeout(() => {
            fetchPriceDirectly(ethToken, solToken, '1');
          }, 500);
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
        setSwapState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Failed to fetch tokens',
          isLoadingTokens: false 
        }));
      }
    };
    
    fetchTokens();
  }, []);

  // Check if the form is ready to swap
  useEffect(() => {
    const { sourceToken, destinationToken, sourceAmount } = swapState;
    const isConnected = !!ethereumWallet || !!solanaWallet;
    const hasValidAmount = sourceAmount !== '' && parseFloat(sourceAmount) > 0;
    
    setIsReadyToSwap(
      isConnected && 
      !!sourceToken && 
      !!destinationToken && 
      hasValidAmount
    );
  }, [swapState, ethereumWallet, solanaWallet]);

  // Handle source token selection
  const handleSourceTokenSelect = (token: Token) => {
    console.log('Selected source token:', token);
    setSwapState(prev => {
      const newState = {
        ...prev,
        sourceToken: token,
        // Reset destination amount when source token changes
        destinationAmount: ''
      };
      
      // Fetch price if both tokens are selected and we have an amount
      if (newState.destinationToken && newState.sourceAmount && parseFloat(newState.sourceAmount) > 0) {
        setTimeout(() => {
          fetchPriceDirectly(token, newState.destinationToken, newState.sourceAmount);
        }, 0);
      }
      
      return newState;
    });
  };

  // Handle destination token selection
  const handleDestinationTokenSelect = (token: Token) => {
    console.log('Selected destination token:', token);
    setSwapState(prev => {
      const newState = {
        ...prev,
        destinationToken: token,
        // Reset destination amount when destination token changes
        destinationAmount: ''
      };
      
      // Fetch price if both tokens are selected and we have an amount
      if (newState.sourceToken && newState.sourceAmount && parseFloat(newState.sourceAmount) > 0) {
        setTimeout(() => {
          fetchPriceDirectly(newState.sourceToken, token, newState.sourceAmount);
        }, 0);
      }
      
      return newState;
    });
  };

  // Handle source amount change
  const handleSourceAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numbers and decimals
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      // Update state first
      setSwapState(prev => {
        const newState = {
          ...prev,
          sourceAmount: value,
          isLoading: value !== '' && parseFloat(value) > 0
        };
        
        // Then check if we should fetch price
        if (
          newState.sourceToken && 
          newState.destinationToken && 
          value !== '' && 
          parseFloat(value) > 0
        ) {
          // Use setTimeout to ensure state is updated before fetchPrice is called
          setTimeout(() => {
            console.log('Fetching price after amount change:', {
              sourceToken: newState.sourceToken?.symbol,
              destinationToken: newState.destinationToken?.symbol,
              amount: value
            });
            
            // Call fetchPrice directly with current values
            fetchPriceDirectly(
              newState.sourceToken,
              newState.destinationToken,
              value
            );
          }, 0);
        } else if (value === '' || parseFloat(value) <= 0) {
          // Reset destination amount if source amount is invalid
          newState.destinationAmount = '';
          newState.isLoading = false;
        }
        
        return newState;
      });
    }
  };

  // Direct price fetch function that doesn't rely on state
  const fetchPriceDirectly = async (sourceToken: Token | null, destinationToken: Token | null, amount: string) => {
    if (!sourceToken || !destinationToken || !amount) {
      return;
    }

    try {
      const sourceSymbol = sourceToken.symbol;
      const destSymbol = destinationToken.symbol;
      
      console.log('Fetching price quote for:', {
        sourceToken: sourceSymbol,
        sourceChain: sourceToken.chainName.toLowerCase(),
        destinationToken: destSymbol,
        destinationChain: destinationToken.chainName.toLowerCase(),
        amount
      });
      
      // Call the cross-chain price API for all swaps
      const response = await fetch('/api/crossChainPrice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceToken: sourceSymbol,
          sourceChain: sourceToken.chainName.toLowerCase(),
          destinationToken: destSymbol,
          destinationChain: destinationToken.chainName.toLowerCase(),
          amount
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch price: ${response.statusText}`);
      }

      const data: PriceQuoteResponse = await response.json();
      console.log('Price quote data:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to calculate price');
      }
      
      setSwapState(prev => ({
        ...prev,
        destinationAmount: data.estimatedOutput,
        exchangeRate: data.exchangeRate,
        route: data.route,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error fetching price quote:', error);
      setSwapState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch price',
        isLoading: false
      }));
    }
  };

  // Keep the original fetchPrice for other use cases
  const fetchPrice = useCallback(async () => {
    if (!swapState.sourceToken || !swapState.destinationToken || !swapState.sourceAmount) {
      return;
    }

    setSwapState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Call the direct function with current state values
    fetchPriceDirectly(
      swapState.sourceToken,
      swapState.destinationToken,
      swapState.sourceAmount
    );
  }, [swapState.sourceToken, swapState.destinationToken, swapState.sourceAmount]);

  // Handle swap button click
  const handleSwap = async () => {
    if (!isReadyToSwap) return;
    
    try {
      setSwapState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: null,
        transactionHash: null,
        transactionStatus: null
      }));

      // Check if wallet is connected for the source chain
      const sourceChain = swapState.sourceToken?.chainName?.toLowerCase() || '';
      const destinationChain = swapState.destinationToken?.chainName?.toLowerCase() || '';
      
      // Ensure wallet is connected for the source chain
      if (
        (sourceChain === 'ethereum' && !ethereumWallet) ||
        (sourceChain === 'solana' && !solanaWallet)
      ) {
        throw new Error(`Please connect a ${sourceChain} wallet to proceed`);
      }

      // Get wallet address
      let walletAddress = '';
      if (sourceChain === 'ethereum' && ethereumWallet) {
        walletAddress = ethereumWallet.address;
      } else if (sourceChain === 'solana' && solanaWallet) {
        walletAddress = solanaWallet.publicKey.toString();
      }

      // Call the swap API which now uses Temporal
      const response = await axios.post('/api/swap', {
        sourceChain,
        destinationChain,
        sourceToken: swapState.sourceToken?.symbol,
        destinationToken: swapState.destinationToken?.symbol,
        amount: swapState.sourceAmount,
        slippage: swapState.slippage,
        walletAddress
      });

      if (response.data.success) {
        const { workflowId, route, status } = response.data.data;
        
        setSwapState(prev => ({
          ...prev,
          isLoading: false,
          route: route,
          workflowId: workflowId,
          transactionStatus: status
        }));

        // Start polling for quote
        pollForQuote(workflowId);
      } else {
        setSwapState(prev => ({
          ...prev,
          isLoading: false,
          error: response.data.error || 'Failed to initiate swap'
        }));
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      setSwapState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
    }
  };

  // Add a function to poll for the quote
  const pollForQuote = async (workflowId: string) => {
    try {
      // Poll for the quote every 2 seconds
      const interval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/swapStatus?workflowId=${workflowId}`);
          
          if (response.data.success) {
            const result = response.data.data;
            
            if (result) {
              // Update the state with the result
              setSwapState(prev => ({
                ...prev,
                destinationAmount: result.outputAmount,
                exchangeRate: result.exchangeRate ? result.exchangeRate.toString() : prev.exchangeRate,
                transactionStatus: result.success ? 'completed' : 'failed',
                error: result.errorMessage || null
              }));
              
              // Clear the interval if we have a result
              clearInterval(interval);
            }
          }
        } catch (error) {
          console.error('Error polling for quote:', error);
          // Don't clear the interval, keep trying
        }
      }, 2000);
      
      // Clear the interval after 2 minutes to avoid infinite polling
      setTimeout(() => {
        clearInterval(interval);
      }, 120000);
    } catch (error) {
      console.error('Error setting up polling:', error);
    }
  };

  // Add a function to confirm the swap
  const confirmSwap = async () => {
    if (!swapState.workflowId) {
      setSwapState(prev => ({
        ...prev,
        error: 'No active swap to confirm'
      }));
      return;
    }
    
    try {
      setSwapState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await axios.post('/api/confirmSwap', {
        workflowId: swapState.workflowId
      });
      
      if (response.data.success) {
        setSwapState(prev => ({
          ...prev,
          isLoading: false,
          transactionStatus: 'pending',
          error: null
        }));
        
        // Start polling for the result
        pollForResult(swapState.workflowId);
      } else {
        setSwapState(prev => ({
          ...prev,
          isLoading: false,
          error: response.data.error || 'Failed to confirm swap'
        }));
      }
    } catch (error) {
      console.error('Error confirming swap:', error);
      setSwapState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
    }
  };

  // Add a function to poll for the result
  const pollForResult = async (workflowId: string) => {
    try {
      // Poll for the result every 3 seconds
      const interval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/swapStatus?workflowId=${workflowId}`);
          
          if (response.data.success) {
            const result = response.data.data;
            
            if (result && (result.success || result.errorMessage)) {
              // Update the state with the result
              setSwapState(prev => ({
                ...prev,
                transactionStatus: result.success ? 'completed' : 'failed',
                error: result.errorMessage || null
              }));
              
              // Clear the interval if we have a result
              clearInterval(interval);
            }
          }
        } catch (error) {
          console.error('Error polling for result:', error);
          // Don't clear the interval, keep trying
        }
      }, 3000);
      
      // Clear the interval after 5 minutes to avoid infinite polling
      setTimeout(() => {
        clearInterval(interval);
      }, 300000);
    } catch (error) {
      console.error('Error setting up polling:', error);
    }
  };

  // Add a function to cancel the swap
  const cancelSwap = async () => {
    if (!swapState.workflowId) {
      setSwapState(prev => ({
        ...prev,
        error: 'No active swap to cancel'
      }));
      return;
    }
    
    try {
      setSwapState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await axios.post('/api/cancelSwap', {
        workflowId: swapState.workflowId
      });
      
      if (response.data.success) {
        setSwapState(prev => ({
          ...prev,
          isLoading: false,
          transactionStatus: 'failed',
          error: 'Swap cancelled by user',
          workflowId: null
        }));
      } else {
        setSwapState(prev => ({
          ...prev,
          isLoading: false,
          error: response.data.error || 'Failed to cancel swap'
        }));
      }
    } catch (error) {
      console.error('Error cancelling swap:', error);
      setSwapState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
    }
  };

  // Handle chain switching based on selected token
  const handleChainSwitch = useCallback(async (chain: string) => {
    if (!chain) return;
    
    const normalizedChain = chain.toLowerCase();
    
    if (normalizedChain === 'ethereum' && currentChain !== 'ethereum') {
      await switchChain('ethereum');
    } else if (normalizedChain === 'solana' && currentChain !== 'solana') {
      await switchChain('solana');
    }
  }, [currentChain, switchChain]);

  // Effect to switch chain when source token changes
  useEffect(() => {
    if (swapState.sourceToken?.chainName) {
      handleChainSwitch(swapState.sourceToken.chainName);
    }
  }, [swapState.sourceToken, handleChainSwitch]);

  // Swap the source and destination tokens
  const handleSwapTokens = () => {
    setSwapState(prev => {
      // Only swap if both tokens are selected
      if (!prev.sourceToken || !prev.destinationToken) return prev;
      
      // Invert the exchange rate when swapping tokens
      let invertedExchangeRate = '0';
      if (prev.exchangeRate && prev.exchangeRate !== '0') {
        const rate = parseFloat(prev.exchangeRate);
        if (rate > 0) {
          invertedExchangeRate = (1 / rate).toString();
        }
      }
      
      return {
        ...prev,
        sourceToken: prev.destinationToken,
        destinationToken: prev.sourceToken,
        sourceAmount: prev.destinationAmount,
        destinationAmount: prev.sourceAmount,
        exchangeRate: invertedExchangeRate, // Use the inverted exchange rate
        // Reset loading state
        isLoading: false
      };
    });
  };

  // Get explorer URL based on chain
  const getExplorerUrl = (txHash: string): string => {
    const sourceChain = swapState.sourceToken?.chainName?.toLowerCase() || '';
    if (sourceChain === 'ethereum') {
      return `https://goerli.etherscan.io/tx/${txHash}`;
    } else if (sourceChain === 'solana') {
      return `https://explorer.solana.com/tx/${txHash}`;
    }
    return `#`;
  };

  // Route Display Component
  const RouteDisplay = ({ route }: { route: Route }) => {
    if (!route || !route.steps || route.steps.length === 0) {
      return null;
    }

    // Get icon based on step type
    const getStepIcon = (type: string) => {
      switch (type) {
        case 'swap':
          return '↔️';
        case 'bridge':
          return '🌉';
        case 'wrap':
          return '📦';
        case 'unwrap':
          return '📭';
        default:
          return '→';
      }
    };

    // Get color based on step type
    const getStepColor = (type: string) => {
      switch (type) {
        case 'swap':
          return 'text-primary';
        case 'bridge':
          return 'text-secondary';
        case 'wrap':
          return 'text-accent';
        case 'unwrap':
          return 'text-accent';
        default:
          return 'text-white';
      }
    };

    return (
      <div className="mt-4 space-y-2">
        <div className="text-sm text-gray-400 mb-1">Route:</div>
        {route.steps.map((step, index) => (
          <div key={index} className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className={`mr-2 ${getStepColor(step.type)}`}>{getStepIcon(step.type)}</span>
                <span className="text-sm font-medium capitalize">{step.type}</span>
              </div>
              {step.fee && (
                <div className="text-xs text-gray-400">
                  Fee: {step.fee.amount} {step.fee.token} (${step.fee.usdValue})
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-surface-light rounded-full px-2 py-1 text-xs">
                  {step.fromToken} <span className="text-gray-400">({step.fromChain})</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <div className="bg-surface-light rounded-full px-2 py-1 text-xs">
                  {step.toToken} <span className="text-gray-400">({step.toChain})</span>
                </div>
              </div>
              {step.exchangeRate && (
                <div className="text-xs text-gray-400">
                  Rate: 1 {step.fromToken} = {parseFloat(step.exchangeRate).toFixed(6)} {step.toToken}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Refresh token prices periodically
  useEffect(() => {
    // Function to refresh token data
    const refreshTokenData = async () => {
      try {
        const response = await fetch('/api/universalTokens?includeJupiter=true');
        
        if (!response.ok) {
          throw new Error('Failed to fetch tokens');
        }
        
        const data = await response.json();
        
        // Update available tokens with fresh data
        setSwapState(prev => {
          // Find the current tokens in the new data to get updated prices
          const updatedSourceToken = prev.sourceToken 
            ? data.find((t: Token) => 
                t.symbol === prev.sourceToken?.symbol && 
                t.chainName === prev.sourceToken?.chainName
              ) || prev.sourceToken
            : prev.sourceToken;
            
          const updatedDestToken = prev.destinationToken
            ? data.find((t: Token) => 
                t.symbol === prev.destinationToken?.symbol && 
                t.chainName === prev.destinationToken?.chainName
              ) || prev.destinationToken
            : prev.destinationToken;
          
          return {
            ...prev,
            availableTokens: data,
            sourceToken: updatedSourceToken,
            destinationToken: updatedDestToken
          };
        });
        
      } catch (error) {
        console.error('Error refreshing token data:', error);
      }
    };
    
    // Refresh immediately
    refreshTokenData();
    
    // Set up interval to refresh every 30 seconds
    const intervalId = setInterval(refreshTokenData, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Render the swap form
  return (
    <div className={`bg-surface rounded-xl shadow-lg p-6 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Swap</h2>
        <ConnectWalletButton />
      </div>
      
      {/* Source token section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-white">From</label>
          {currentChain && (
            <span className="text-xs text-gray-400">
              Connected to {currentChain.charAt(0).toUpperCase() + currentChain.slice(1)}
            </span>
          )}
        </div>
        <div className="flex items-center bg-background rounded-xl p-3">
          <input
            type="text"
            value={swapState.sourceAmount}
            onChange={handleSourceAmountChange}
            placeholder="0.0"
            className="w-full bg-transparent text-lg font-medium focus:outline-none text-white"
          />
          <TokenSelector
            selectedToken={swapState.sourceToken}
            onSelectToken={handleSourceTokenSelect}
            showChainFilter={true}
            tokens={swapState.availableTokens}
            isLoading={swapState.isLoadingTokens}
          />
        </div>
      </div>
      
      {/* Swap direction button */}
      <div className="flex justify-center my-4">
        <button
          onClick={handleSwapTokens}
          className="bg-surface-light p-2 rounded-full hover:bg-surface-light transition-colors"
          disabled={!swapState.sourceToken || !swapState.destinationToken}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>
      
      {/* Destination token section */}
      <div className="mb-6">
        <label className="text-sm font-medium text-white mb-2 block">To</label>
        <div className="flex items-center bg-background rounded-xl p-3">
          <input
            type="text"
            value={swapState.destinationAmount}
            readOnly
            placeholder="0.0"
            className="w-full bg-transparent text-lg font-medium focus:outline-none text-white"
          />
          <TokenSelector
            selectedToken={swapState.destinationToken}
            onSelectToken={handleDestinationTokenSelect}
            showChainFilter={true}
            tokens={swapState.availableTokens}
            isLoading={swapState.isLoadingTokens}
          />
        </div>
      </div>
      
      {/* Exchange rate and route information */}
      {swapState.exchangeRate !== '0' && swapState.sourceToken && swapState.destinationToken && (
        <div className="mb-6 p-3 bg-background rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Exchange Rate</span>
            <span className="text-sm font-medium text-white">
              1 {swapState.sourceToken.symbol} ≈ {parseFloat(swapState.exchangeRate).toFixed(6)} {swapState.destinationToken.symbol}
            </span>
          </div>
          
          {swapState.route && swapState.route.steps && swapState.route.steps.length > 0 && (
            <>
              <div className="mt-2 mb-3">
                <span className="text-sm text-gray-400">Route Summary:</span>
                <div className="flex flex-wrap items-center mt-1">
                  {swapState.route.steps.map((step, index) => (
                    <React.Fragment key={index}>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                        {step.fromToken}
                        {step.type === 'bridge' && ` (${step.fromChain})`}
                      </span>
                      <span className="mx-1 text-gray-500 text-xs">
                        {step.type === 'swap' ? '↔️' : 
                         step.type === 'bridge' ? '🌉' : 
                         step.type === 'wrap' ? '📦' : '📭'}
                      </span>
                      {index === swapState.route!.steps.length - 1 && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                          {step.toToken}
                          {step.type === 'bridge' && ` (${step.toChain})`}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              
              <RouteDisplay route={swapState.route} />
            </>
          )}
          
          {/* Display total fee if available */}
          {swapState.route?.totalFee && (
            <div className="mt-3 pt-3 border-t border-surface-light">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total Fee</span>
                <span className="text-sm font-medium text-white">
                  {swapState.route.totalFee.amount} {swapState.route.totalFee.token} (${swapState.route.totalFee.usdValue})
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Add the status display section here */}
      {swapState.workflowId && (
        <div className="mb-4 p-4 rounded-lg bg-surface-light">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Swap Status</h3>
            <div className={`px-2 py-1 rounded-md text-xs font-medium ${
              swapState.transactionStatus === 'completed' ? 'bg-green-100 text-green-800' :
              swapState.transactionStatus === 'failed' ? 'bg-red-100 text-red-800' :
              swapState.transactionStatus === 'quoting' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {swapState.transactionStatus === 'completed' ? 'Completed' :
               swapState.transactionStatus === 'failed' ? 'Failed' :
               swapState.transactionStatus === 'quoting' ? 'Getting Quote' :
               swapState.transactionStatus === 'quoted' ? 'Ready to Confirm' :
               swapState.transactionStatus === 'processing' ? 'Processing' :
               'Pending'}
            </div>
          </div>
          
          {swapState.transactionStatus === 'quoted' && swapState.quote && (
            <div className="text-sm">
              <p className="mb-1">You will receive approximately:</p>
              <p className="font-medium text-lg">{swapState.quote.estimatedDestinationAmount} {swapState.destinationToken?.symbol}</p>
              <p className="text-xs text-gray-500 mt-1">
                Rate: 1 {swapState.sourceToken?.symbol} ≈ {
                  (parseFloat(swapState.quote.estimatedDestinationAmount) / parseFloat(swapState.sourceAmount)).toFixed(6)
                } {swapState.destinationToken?.symbol}
              </p>
              <p className="text-xs text-gray-500">Fee: {swapState.quote.fee || '0.1%'}</p>
            </div>
          )}
          
          {swapState.transactionStatus === 'completed' && swapState.result && (
            <div className="text-sm">
              <p className="text-green-600 font-medium">Swap completed successfully!</p>
              <p className="mt-1">You received: {swapState.result.destinationAmount} {swapState.destinationToken?.symbol}</p>
              {swapState.result.txHash && (
                <a 
                  href={`https://explorer.solana.com/tx/${swapState.result.txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline mt-2 inline-block"
                >
                  View transaction
                </a>
              )}
            </div>
          )}
          
          {swapState.transactionStatus === 'failed' && (
            <div className="text-sm">
              <p className="text-red-600 font-medium">Swap failed</p>
              <p className="mt-1">{swapState.error || 'An error occurred during the swap process.'}</p>
            </div>
          )}
          
          {(swapState.transactionStatus === 'quoting' || swapState.transactionStatus === 'processing') && (
            <div className="flex items-center space-x-2 text-sm">
              <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>{swapState.transactionStatus === 'quoting' ? 'Getting the best quote for you...' : 'Processing your swap...'}</p>
            </div>
          )}
        </div>
      )}
      
      {/* Swap button section */}
      {!swapState.workflowId ? (
        <button
          onClick={handleSwap}
          disabled={!isReadyToSwap || swapState.isLoading}
          className={`w-full py-3 px-4 rounded-xl font-medium ${
            isReadyToSwap && !swapState.isLoading
              ? 'btn-primary'
              : 'bg-surface-light text-gray-400 cursor-not-allowed'
          } transition-colors`}
        >
          {swapState.isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : !ethereumWallet && !solanaWallet ? (
            'Connect Wallet'
          ) : !swapState.sourceToken || !swapState.destinationToken ? (
            'Select Tokens'
          ) : !swapState.sourceAmount || parseFloat(swapState.sourceAmount) <= 0 ? (
            'Enter Amount'
          ) : (
            'Swap'
          )}
        </button>
      ) : (
        <div className="flex space-x-4">
          <button
            onClick={confirmSwap}
            disabled={swapState.isLoading || swapState.transactionStatus === 'completed' || swapState.transactionStatus === 'failed'}
            className={`w-1/2 py-3 px-4 rounded-xl font-medium ${
              !swapState.isLoading && swapState.transactionStatus !== 'completed' && swapState.transactionStatus !== 'failed'
                ? 'bg-secondary text-white'
                : 'bg-surface-light text-gray-400 cursor-not-allowed'
            } transition-colors`}
          >
            {swapState.isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Confirm Swap'
            )}
          </button>
          <button
            onClick={cancelSwap}
            disabled={swapState.isLoading || swapState.transactionStatus === 'completed' || swapState.transactionStatus === 'failed'}
            className={`w-1/2 py-3 px-4 rounded-xl font-medium ${
              !swapState.isLoading && swapState.transactionStatus !== 'completed' && swapState.transactionStatus !== 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-surface-light text-gray-400 cursor-not-allowed'
            } transition-colors`}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default SwapForm;