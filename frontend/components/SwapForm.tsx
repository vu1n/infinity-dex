import { useState, useEffect, useRef } from 'react';
import TokenSelector, { Token } from './TokenSelector';
import { ethers } from 'ethers';
import { 
  fetchTokens, 
  fetchPriceQuote, 
  fetchTokenPrices, 
  updateTokensWithPrices, 
  fetchCrossChainPrice,
  findWrappedToken,
  findUnwrappedToken
} from '../services/tokenService';
import { CrossChainPriceResponse, RouteStep } from '../pages/api/crossChainPrice';

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

// Map token symbols to CoinGecko IDs for price fetching
const COINGECKO_IDS: Record<string, string> = {
  'ETH': 'ethereum',
  'USDC': 'usd-coin',
  'MATIC': 'matic-network',
  'AVAX': 'avalanche-2',
  'SOL': 'solana',
  'BTC': 'bitcoin',
  'USDT': 'tether',
  'DAI': 'dai',
  'BONK': 'bonk',
  'JUP': 'jupiter',
  'RAY': 'raydium',
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
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [isCrossChain, setIsCrossChain] = useState(false);
  const priceRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch tokens on component mount
  useEffect(() => {
    const getTokens = async () => {
      try {
        setIsLoadingTokens(true);
        const allTokens = await fetchTokens();
        setTokens(allTokens);
        
        // Fetch initial prices for default tokens
        await refreshTokenPrices(allTokens);
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
        // Set some default tokens if API fails
        setTokens([DEFAULT_TOKENS.ETH, DEFAULT_TOKENS.USDC]);
      } finally {
        setIsLoadingTokens(false);
      }
    };
    
    getTokens();
    
    // Set up interval for refreshing prices
    priceRefreshInterval.current = setInterval(() => {
      refreshTokenPrices(tokens);
    }, 10000); // 10 seconds
    
    // Clean up interval on unmount
    return () => {
      if (priceRefreshInterval.current) {
        clearInterval(priceRefreshInterval.current);
      }
    };
  }, []);

  // Refresh token prices
  const refreshTokenPrices = async (tokenList: Token[]) => {
    if (!tokenList.length) return;
    
    // Get unique symbols that have CoinGecko IDs
    const uniqueSymbols = new Set<string>();
    tokenList.forEach(token => {
      const symbol = token.symbol.toLowerCase().replace('u', ''); // Remove 'u' prefix for wrapped tokens
      if (COINGECKO_IDS[symbol] || Object.values(COINGECKO_IDS).includes(symbol)) {
        uniqueSymbols.add(symbol);
      }
    });
    
    // Add source and destination tokens if they exist
    if (sourceToken?.symbol) {
      const symbol = sourceToken.symbol.toLowerCase().replace('u', '');
      uniqueSymbols.add(symbol);
    }
    if (destinationToken?.symbol) {
      const symbol = destinationToken.symbol.toLowerCase().replace('u', '');
      uniqueSymbols.add(symbol);
    }
    
    // Convert to array and fetch prices
    const symbolsToFetch = Array.from(uniqueSymbols);
    const coinGeckoIds = symbolsToFetch.map(symbol => COINGECKO_IDS[symbol] || symbol);
    
    try {
      const priceMap = await fetchTokenPrices(coinGeckoIds);
      if (priceMap.size > 0) {
        // Update tokens with prices
        const updatedTokens = updateTokensWithPrices(tokenList, priceMap);
        setTokens(updatedTokens);
        
        // Update source and destination tokens if they exist
        if (sourceToken) {
          const updatedSourceToken = updatedTokens.find(
            t => t.symbol === sourceToken.symbol && t.chainId === sourceToken.chainId
          );
          if (updatedSourceToken) {
            setSourceToken(updatedSourceToken);
          }
        }
        
        if (destinationToken) {
          const updatedDestToken = updatedTokens.find(
            t => t.symbol === destinationToken.symbol && t.chainId === destinationToken.chainId
          );
          if (updatedDestToken) {
            setDestinationToken(updatedDestToken);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing token prices:', error);
    }
  };

  // Handle token selection
  const handleSourceTokenSelect = (token: Token) => {
    setSourceToken(token);
  };
  
  const handleDestinationTokenSelect = (token: Token) => {
    setDestinationToken(token);
  };

  // Fetch price quote when inputs change
  useEffect(() => {
    const getPriceQuote = async () => {
      if (!sourceToken || !destinationToken || !amount || parseFloat(amount) <= 0) {
        setEstimatedOutput('0');
        setExchangeRate('0');
        setRouteSteps([]);
        setIsCrossChain(false);
        return;
      }

      setIsLoadingPrice(true);

      try {
        // Check if this is a cross-chain swap
        const isCrossChainSwap = sourceToken.chainId !== destinationToken.chainId;
        setIsCrossChain(isCrossChainSwap);
        
        if (isCrossChainSwap) {
          // Fetch cross-chain price
          const crossChainPrice = await fetchCrossChainPrice(sourceToken, destinationToken);
          
          // Calculate output amount
          const inputAmount = parseFloat(amount);
          const outputAmount = inputAmount * parseFloat(crossChainPrice.exchangeRate);
          
          setEstimatedOutput(outputAmount.toFixed(destinationToken.decimals > 6 ? 6 : destinationToken.decimals));
          setExchangeRate(crossChainPrice.exchangeRate);
          setRouteSteps(crossChainPrice.route);
          
          // Set fee details (mock values for now)
          const feeAmount = outputAmount * 0.005; // 0.5% fee for cross-chain
          setFee({
            total: feeAmount.toFixed(4),
            gas: (feeAmount * 0.6).toFixed(4), // 60% of fee is gas
            protocol: (feeAmount * 0.4).toFixed(4), // 40% of fee is protocol fee
          });
        } else {
          // For same-chain swaps
          if (sourceToken.chainId === 999 && destinationToken.chainId === 999) {
            // Solana tokens - use Jup.ag API
            const decimals = sourceToken.decimals;
            const amountInSmallestUnit = ethers.utils.parseUnits(amount, decimals).toString();
            
            const quote = await fetchPriceQuote(
              sourceToken.address || '',
              destinationToken.address || '',
              amountInSmallestUnit,
              Math.round(slippage * 100) // Convert to basis points
            );
            
            const outputDecimals = destinationToken.decimals;
            const outputAmount = ethers.utils.formatUnits(quote.outAmount, outputDecimals);
            
            setEstimatedOutput(outputAmount);
            setExchangeRate(quote.exchangeRate);
            setRouteSteps([
              {
                fromToken: sourceToken.symbol,
                fromChain: sourceToken.chainName,
                toToken: destinationToken.symbol,
                toChain: destinationToken.chainName,
                exchangeRate: quote.exchangeRate,
                type: 'swap'
              }
            ]);
            
            // Set fee details
            const outputValue = parseFloat(outputAmount);
            setFee({
              total: (outputValue * 0.003).toFixed(4),
              gas: (outputValue * 0.001).toFixed(4),
              protocol: (outputValue * 0.002).toFixed(4),
            });
          } else {
            // EVM chain tokens - use price-based calculation
            let rate = 1;
            
            // Use real prices if available
            if (sourceToken.price && destinationToken.price) {
              rate = destinationToken.price / sourceToken.price;
            } else {
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
            }

            const inputAmount = parseFloat(amount);
            const output = inputAmount * rate;
            
            // Apply a mock fee
            const feeAmount = output * 0.003;
            const netOutput = output - feeAmount;
            
            setEstimatedOutput(netOutput.toFixed(destinationToken.decimals > 6 ? 6 : destinationToken.decimals));
            setExchangeRate(rate.toString());
            setRouteSteps([
              {
                fromToken: sourceToken.symbol,
                fromChain: sourceToken.chainName,
                toToken: destinationToken.symbol,
                toChain: destinationToken.chainName,
                exchangeRate: rate.toString(),
                type: 'swap'
              }
            ]);
            
            // Set fee details
            setFee({
              total: (feeAmount).toFixed(4),
              gas: (feeAmount * 0.3).toFixed(4),
              protocol: (feeAmount * 0.7).toFixed(4),
            });
          }
        }
      } catch (error) {
        console.error('Error fetching price quote:', error);
        
        // Fallback to simple calculation
        let rate = 1;
        if (sourceToken.price && destinationToken.price) {
          rate = destinationToken.price / sourceToken.price;
        }
        
        const inputAmount = parseFloat(amount);
        const output = inputAmount * rate;
        
        setEstimatedOutput(output.toFixed(destinationToken.decimals > 6 ? 6 : destinationToken.decimals));
        setExchangeRate(rate.toString());
        setRouteSteps([
          {
            fromToken: sourceToken.symbol,
            fromChain: sourceToken.chainName,
            toToken: destinationToken.symbol,
            toChain: destinationToken.chainName,
            exchangeRate: rate.toString(),
            type: 'swap'
          }
        ]);
        
        // Set mock fee details
        const feeAmount = output * 0.003;
        setFee({
          total: feeAmount.toFixed(4),
          gas: (feeAmount * 0.3).toFixed(4),
          protocol: (feeAmount * 0.7).toFixed(4),
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
          route: routeSteps,
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

  // Format USD value
  const formatUsdValue = (amount: string, token?: Token): string => {
    if (!token || !token.price || !amount || parseFloat(amount) <= 0) {
      return '≈ $0.00';
    }
    
    const value = parseFloat(amount) * token.price;
    
    if (value < 0.01) {
      return `≈ $${value.toFixed(6)}`;
    } else if (value < 1) {
      return `≈ $${value.toFixed(4)}`;
    } else if (value < 1000) {
      return `≈ $${value.toFixed(2)}`;
    } else {
      return `≈ $${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    }
  };

  // Render route steps
  const renderRouteSteps = () => {
    if (!routeSteps.length) return null;
    
    return (
      <div className="mb-6 p-3 bg-background rounded-lg">
        <div className="text-sm font-medium mb-2">Route</div>
        {routeSteps.map((step, index) => (
          <div key={index} className="flex items-center mb-2">
            <div className="flex-1">
              <div className="flex items-center">
                <span className="text-sm">{step.fromToken}</span>
                <span className="text-xs text-gray-400 ml-1">({step.fromChain})</span>
                <svg className="h-4 w-4 mx-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="text-sm">{step.toToken}</span>
                <span className="text-xs text-gray-400 ml-1">({step.toChain})</span>
              </div>
            </div>
            <div className="text-xs px-2 py-1 rounded bg-surface-light">
              {step.type === 'bridge' ? 'Bridge' : 'Swap'}
            </div>
          </div>
        ))}
      </div>
    );
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
              onSelect={handleSourceTokenSelect}
              showChainFilter={true}
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
              {amount && parseFloat(amount) > 0 && sourceToken?.price && (
                <div className="text-sm text-gray-400 mt-1 pl-2">
                  {formatUsdValue(amount, sourceToken)}
                </div>
              )}
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
              onSelect={handleDestinationTokenSelect}
              showChainFilter={true}
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
              {estimatedOutput && parseFloat(estimatedOutput) > 0 && destinationToken?.price && (
                <div className="text-sm text-gray-400 mt-1">
                  {formatUsdValue(estimatedOutput, destinationToken)}
                </div>
              )}
            </div>
          </div>
          
          {isCrossChain && (
            <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center text-yellow-700">
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Cross-chain swap</span>
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                This swap will bridge tokens across different blockchains using Universal.xyz wrapped assets.
              </p>
            </div>
          )}
          
          {renderRouteSteps()}
          
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