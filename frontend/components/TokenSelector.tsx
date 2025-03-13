import React, { useState, useEffect, useRef } from 'react';

// Define the Token interface
export interface Token {
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
  jupiterVerified?: boolean;
  jupiterVolume?: number;
}

// Define the props for the TokenSelector component
interface Props {
  selectedToken: Token | null;
  onSelectToken: (token: Token) => void;
  showChainFilter?: boolean;
  tokens?: Token[];
  isLoading?: boolean;
}

// Sample tokens for demonstration (fallback if no tokens are provided)
const SAMPLE_TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 1,
    chainName: 'Ethereum',
    logoURI: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    price: 1800
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chainId: 1,
    chainName: 'Ethereum',
    logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    price: 1
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    chainId: 999,
    chainName: 'Solana',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    price: 120
  },
  {
    symbol: 'MATIC',
    name: 'Polygon',
    decimals: 18,
    chainId: 137,
    chainName: 'Polygon',
    logoURI: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    price: 0.7
  },
  {
    symbol: 'AVAX',
    name: 'Avalanche',
    decimals: 18,
    chainId: 43114,
    chainName: 'Avalanche',
    logoURI: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
    price: 28
  },
  {
    symbol: 'uETH',
    name: 'Universal Ethereum',
    decimals: 18,
    chainId: 0,
    chainName: 'Universal',
    logoURI: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    price: 1800,
    isWrapped: true,
    unwrappedVersion: 'ETH'
  },
  {
    symbol: 'uSOL',
    name: 'Universal Solana',
    decimals: 9,
    chainId: 0,
    chainName: 'Universal',
    logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    price: 120,
    isWrapped: true,
    unwrappedVersion: 'SOL'
  }
];

const TokenSelector: React.FC<Props> = ({ 
  selectedToken, 
  onSelectToken, 
  showChainFilter = false,
  tokens = SAMPLE_TOKENS,
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTokens, setFilteredTokens] = useState<Token[]>(tokens);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [uniqueChains, setUniqueChains] = useState<string[]>([]);
  const [showJupiterOnly, setShowJupiterOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize tokens and unique chains
  useEffect(() => {
    // Extract unique chains from provided tokens
    const chains = Array.from(new Set(tokens.map(token => token.chainName)));
    setUniqueChains(chains);
    
    // Reset filtered tokens when tokens prop changes
    setFilteredTokens(tokens);
  }, [tokens]);

  // Filter tokens based on search query, selected chain, and Jupiter verification
  useEffect(() => {
    let filtered = tokens;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(token => 
        token.symbol.toLowerCase().includes(query) || 
        token.name.toLowerCase().includes(query)
      );
    }
    
    // Filter by selected chain
    if (selectedChain) {
      filtered = filtered.filter(token => token.chainName === selectedChain);
    }
    
    // Filter by Jupiter verification
    if (showJupiterOnly) {
      filtered = filtered.filter(token => token.jupiterVerified === true);
    }
    
    setFilteredTokens(filtered);
  }, [searchQuery, selectedChain, showJupiterOnly, tokens]);

  // Handle token selection
  const handleSelectToken = (token: Token) => {
    onSelectToken(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle chain selection
  const handleSelectChain = (chain: string | null) => {
    setSelectedChain(chain);
  };

  // Toggle Jupiter verified filter
  const toggleJupiterFilter = () => {
    setShowJupiterOnly(!showJupiterOnly);
  };

  // Check if any tokens are Jupiter verified
  const hasJupiterTokens = tokens.some(token => token.jupiterVerified);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-surface-light hover:bg-surface rounded-xl px-3 py-2 transition-colors"
        disabled={isLoading}
      >
        {selectedToken ? (
          <>
            {selectedToken.logoURI && (
              <img 
                src={selectedToken.logoURI} 
                alt={selectedToken.symbol} 
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="font-medium text-white">{selectedToken.symbol}</span>
            <span className="text-xs text-gray-400">({selectedToken.chainName})</span>
            {selectedToken.jupiterVerified && (
              <span className="ml-1 text-xs bg-blue-500/20 text-blue-400 px-1 rounded">Jupiter</span>
            )}
          </>
        ) : isLoading ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-white">Loading...</span>
          </div>
        ) : (
          <span className="text-white">Select Token</span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-surface rounded-xl shadow-lg z-10 overflow-hidden">
          <div className="p-3 border-b border-surface-light">
            <input
              type="text"
              placeholder="Search token name or symbol"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-surface-light rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white"
              autoFocus
            />
            
            <div className="mt-2 flex flex-wrap gap-1">
              {showChainFilter && (
                <>
                  <button
                    onClick={() => handleSelectChain(null)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      selectedChain === null 
                        ? 'bg-primary text-white' 
                        : 'bg-surface-light text-gray-300 hover:bg-surface-light'
                    }`}
                  >
                    All Chains
                  </button>
                  {uniqueChains.map(chain => (
                    <button
                      key={chain}
                      onClick={() => handleSelectChain(chain)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        selectedChain === chain 
                          ? 'bg-primary text-white' 
                          : 'bg-surface-light text-gray-300 hover:bg-surface-light'
                      }`}
                    >
                      {chain}
                    </button>
                  ))}
                </>
              )}
              
              {/* Jupiter verified filter */}
              {hasJupiterTokens && (
                <button
                  onClick={toggleJupiterFilter}
                  className={`text-xs px-2 py-1 rounded-full ${
                    showJupiterOnly 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-surface-light text-gray-300 hover:bg-surface-light'
                  }`}
                >
                  Jupiter Verified
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-white">Loading tokens...</span>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No tokens found
              </div>
            ) : (
              filteredTokens.map(token => (
                <button
                  key={`${token.symbol}-${token.chainId}`}
                  onClick={() => handleSelectToken(token)}
                  className="w-full flex items-center p-3 hover:bg-background transition-colors"
                >
                  {token.logoURI ? (
                    <img 
                      src={token.logoURI} 
                      alt={token.symbol} 
                      className="w-8 h-8 rounded-full mr-3"
                      onError={(e) => {
                        // Fallback for broken images
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32';
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-light mr-3 flex items-center justify-center">
                      <span className="text-xs font-bold">{token.symbol.substring(0, 2)}</span>
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <div className="flex items-center">
                      <span className="font-medium text-white">{token.symbol}</span>
                      {token.jupiterVerified && (
                        <span className="ml-1 text-xs bg-blue-500/20 text-blue-400 px-1 rounded">Jupiter</span>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-gray-400">
                      <span>{token.name}</span>
                      <span className="mx-1">•</span>
                      <span>{token.chainName}</span>
                      {token.jupiterVolume && token.jupiterVolume > 0 && (
                        <>
                          <span className="mx-1">•</span>
                          <span>${(token.jupiterVolume / 1000000).toFixed(2)}M vol</span>
                        </>
                      )}
                    </div>
                  </div>
                  {token.price !== undefined && token.price !== null && (
                    <div className="text-right">
                      <div className="text-white">${token.price < 0.01 ? token.price.toExponential(2) : token.price.toFixed(2)}</div>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector; 