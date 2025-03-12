import { useState, useEffect } from 'react';
import TokenSelector, { Token } from './TokenSelector';
import { ethers } from 'ethers';
import { fetchTokens, fetchPriceQuote } from '../services/tokenService';

// Default tokens for initial state
const DEFAULT_TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 1,
    chainName: 'Ethereum',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 1,
    chainName: 'Ethereum',
    isWrapped: false,
    logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  }
};

type Props = {
  walletAddress?: string;
};

const SwapForm = ({ walletAddress }: Props) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [sourceToken, setSourceToken] = useState<Token | undefined>(DEFAULT_TOKENS.ETH);
  const [destinationToken, setDestinationToken] = useState<Token | undefined>(DEFAULT_TOKENS.USDC);
  const [amount, setAmount] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('0');
  const [slippage, setSlippage] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [fee, setFee] = useState({ total: '0', gas: '0', protocol: '0' });
  const [exchangeRate, setExchangeRate] = useState('0');

  // Fetch tokens on component mount
  useEffect(() => {
    const getTokens = async () => {
      try {
        setIsLoadingTokens(true);
        const allTokens = await fetchTokens();
        setTokens(allTokens);
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
        // Set some default tokens if API fails
        setTokens([DEFAULT_TOKENS.ETH, DEFAULT_TOKENS.USDC]);
      } finally {
        setIsLoadingTokens(false);
      }
    };
    
    getTokens();
  }, []);

  // Fetch price quote when inputs change
  useEffect(() => {
    const getPriceQuote = async () => {
      if (!sourceToken || !destinationToken || !amount || parseFloat(amount) <= 0) {
        setEstimatedOutput('0');
        setExchangeRate('0');
        return;
      }

      setIsLoadingPrice(true);

      try {
        // Convert amount to lamports/wei based on decimals
        const decimals = sourceToken.decimals;
        const amountInSmallestUnit = ethers.utils.parseUnits(amount, decimals).toString();
        
        // Get price quote
        const quote = await fetchPriceQuote(
          sourceToken.address || '',
          destinationToken.address || '',
          amountInSmallestUnit,
          Math.round(slippage * 100) // Convert to basis points
        );
        
        // Convert output amount from smallest unit to display format
        const outputDecimals = destinationToken.decimals;
        const outputAmount = ethers.utils.formatUnits(quote.outAmount, outputDecimals);
        
        setEstimatedOutput(outputAmount);
        setExchangeRate(quote.exchangeRate);
        
        // Set fee details
        const outputValue = parseFloat(outputAmount);
        setFee({
          total: (outputValue * 0.003).toFixed(4),
          gas: (outputValue * 0.001).toFixed(4),
          protocol: (outputValue * 0.002).toFixed(4),
        });
      } catch (error) {
        console.error('Error fetching price quote:', error);
        // Fallback to mock calculation
        let rate = 1;
        
        // Mock rates for demo purposes
        if (sourceToken.symbol === 'ETH' && destinationToken.symbol === 'USDC') {
          rate = 2000; // 1 ETH = 2000 USDC
        } else if (sourceToken.symbol === 'USDC' && destinationToken.symbol === 'ETH') {
          rate = 0.0005; // 1 USDC = 0.0005 ETH
        } else if (sourceToken.symbol === 'MATIC' && destinationToken.symbol === 'USDC') {
          rate = 0.5; // 1 MATIC = 0.5 USDC
        } else if (sourceToken.symbol === 'AVAX' && destinationToken.symbol === 'USDC') {
          rate = 10; // 1 AVAX = 10 USDC
        }

        const inputAmount = parseFloat(amount);
        const output = inputAmount * rate;
        
        // Apply a mock fee
        const feeAmount = output * 0.003;
        const netOutput = output - feeAmount;
        
        setEstimatedOutput(netOutput.toFixed(destinationToken.decimals > 6 ? 6 : destinationToken.decimals));
        setExchangeRate(rate.toString());
        
        // Set mock fee details
        setFee({
          total: (feeAmount + 0.001 * rate).toFixed(4),
          gas: (0.001 * rate).toFixed(4),
          protocol: feeAmount.toFixed(4),
        });
      } finally {
        setIsLoadingPrice(false);
      }
    };

    getPriceQuote();
  }, [sourceToken, destinationToken, amount, slippage]);

  const handleSwap = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!sourceToken || !destinationToken || !amount || parseFloat(amount) <= 0) {
      alert('Please fill in all swap details');
      return;
    }

    setIsLoading(true);

    try {
      // Call our swap API
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceToken: sourceToken.symbol,
          sourceChain: sourceToken.chainName,
          destinationToken: destinationToken.symbol,
          destinationChain: destinationToken.chainName,
          amount,
          sourceAddress: walletAddress,
          destinationAddress: walletAddress,
          slippage,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Swap request failed');
      }
      
      const result = await response.json();
      
      alert(`Swap initiated! Transaction ID: ${result.requestId}
      
From: ${amount} ${sourceToken.symbol} (${sourceToken.chainName})
To: ~${estimatedOutput} ${destinationToken.symbol} (${destinationToken.chainName})
      
Estimated completion time: ${result.estimatedTime} seconds`);
      
      // Reset form
      setAmount('');
      setEstimatedOutput('0');
    } catch (error) {
      console.error('Error performing swap:', error);
      alert('Swap failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchTokens = () => {
    setSourceToken(destinationToken);
    setDestinationToken(sourceToken);
    setAmount(estimatedOutput);
  };

  return (
    <div className="card max-w-md w-full mx-auto">
      <h2 className="text-center text-2xl font-bold mb-6">Swap Tokens</h2>
      
      {isLoadingTokens ? (
        <div className="flex justify-center items-center py-20">
          <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <TokenSelector
              label="From"
              tokens={tokens}
              selectedToken={sourceToken}
              onSelect={setSourceToken}
            />
            <div className="mt-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="input mt-2"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="flex justify-center my-4">
            <button
              type="button"
              onClick={switchTokens}
              className="bg-background hover:bg-surface-light rounded-full p-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>
          
          <div className="mb-6">
            <TokenSelector
              label="To"
              tokens={tokens}
              selectedToken={destinationToken}
              onSelect={setDestinationToken}
            />
            <div className="mt-2 bg-background rounded-xl border border-surface-light px-4 py-3">
              <div className="text-gray-400 text-sm">Estimated output</div>
              <div className="text-lg font-medium flex items-center">
                {isLoadingPrice ? (
                  <div className="flex items-center">
                    <svg className="animate-spin h-4 w-4 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Calculating...
                  </div>
                ) : (
                  `${estimatedOutput} ${destinationToken?.symbol}`
                )}
              </div>
            </div>
          </div>
          
          <div className="mb-6 p-3 bg-background rounded-lg">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Exchange Rate</span>
              <span>
                1 {sourceToken?.symbol} ≈ {exchangeRate} {destinationToken?.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Network Fee</span>
              <span>{fee.gas} {destinationToken?.symbol}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Protocol Fee</span>
              <span>{fee.protocol} {destinationToken?.symbol}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-surface-light">
              <span className="text-gray-400">Total Fee</span>
              <span>{fee.total} {destinationToken?.symbol}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm">Slippage Tolerance</span>
            <div className="flex space-x-2">
              {[0.5, 1.0, 2.0].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 text-sm rounded-lg ${slippage === value ? 'bg-primary text-white' : 'bg-background'}`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={handleSwap}
            disabled={isLoading || !walletAddress || !amount || parseFloat(amount) <= 0 || isLoadingPrice}
            className="btn-primary w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : !walletAddress ? (
              'Connect Wallet'
            ) : !amount || parseFloat(amount) <= 0 ? (
              'Enter Amount'
            ) : isLoadingPrice ? (
              'Calculating...'
            ) : (
              'Swap'
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default SwapForm; 