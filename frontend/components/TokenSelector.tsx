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
}

// Define the props for the TokenSelector component
interface Props {
  selectedToken: Token | null;
  onSelectToken: (token: Token) => void;
  showChainFilter?: boolean;
}

// Sample tokens for demonstration
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

const TokenSelector: React.FC<Props> = ({ selectedToken, onSelectToken, showChainFilter = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<Token[]>(SAMPLE_TOKENS);
  const [filteredTokens, setFilteredTokens] = useState<Token[]>(SAMPLE_TOKENS);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [uniqueChains, setUniqueChains] = useState<string[]>([]);
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
    // In a real app, you would fetch tokens from an API
    setTokens(SAMPLE_TOKENS);
    
    // Extract unique chains
    const chains = Array.from(new Set(SAMPLE_TOKENS.map(token => token.chainName)));
    setUniqueChains(chains);
  }, []);

  // Filter tokens based on search query and selected chain
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
    
    setFilteredTokens(filtered);
  }, [searchQuery, selectedChain, tokens]);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-surface-light hover:bg-surface rounded-xl px-3 py-2 transition-colors"
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
          </>
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
            
            {showChainFilter && (
              <div className="mt-2 flex flex-wrap gap-1">
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
              </div>
            )}
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {filteredTokens.length > 0 ? (
              filteredTokens.map(token => (
                <button
                  key={`${token.symbol}-${token.chainId}`}
                  onClick={() => handleSelectToken(token)}
                  className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-surface-light transition-colors text-left"
                >
                  {token.logoURI && (
                    <img 
                      src={token.logoURI} 
                      alt={token.symbol} 
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-medium text-white">{token.symbol}</div>
                    <div className="text-xs text-gray-400 flex items-center">
                      <span>{token.name}</span>
                      <span className="mx-1">•</span>
                      <span>{token.chainName}</span>
                    </div>
                  </div>
                  {token.price && (
                    <div className="ml-auto text-right">
                      <div className="text-sm text-gray-300">${token.price.toLocaleString()}</div>
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-gray-400 text-center">
                No tokens found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector; 