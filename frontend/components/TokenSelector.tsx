import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTokens } from '../services/tokenService';

export type Token = {
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
  chainId: number;
  chainName: string;
  isWrapped: boolean;
  logoURI?: string;
};

type Props = {
  label: string;
  tokens: Token[];
  selectedToken?: Token;
  onSelect: (token: Token) => void;
};

const TokenSelector = ({ label, tokens: initialTokens, selectedToken, onSelect }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<Token[]>(initialTokens);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(async (query: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true);
        try {
          // Use API-based search for Solana tokens
          const searchedTokens = await fetchTokens(query);
          setTokens(searchedTokens);
        } catch (error) {
          console.error('Error searching tokens:', error);
          // Fallback to client-side filtering
          const filtered = initialTokens.filter(
            token => 
              token.symbol.toLowerCase().includes(query.toLowerCase()) || 
              token.name.toLowerCase().includes(query.toLowerCase()) ||
              token.chainName.toLowerCase().includes(query.toLowerCase()) ||
              token.address?.toLowerCase().includes(query.toLowerCase())
          );
          setTokens(filtered);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Reset to initial tokens if query is too short
        setTokens(initialTokens);
      }
    }, 300);
  }, [initialTokens]);

  // Handle search query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, debouncedSearch]);

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

  const handleTokenSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
    setSearchQuery('');
    setTokens(initialTokens);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <button
        type="button"
        className="flex items-center justify-between w-full bg-background rounded-xl border border-surface-light px-4 py-3 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedToken ? (
          <div className="flex items-center">
            {selectedToken.logoURI && (
              <img 
                src={selectedToken.logoURI} 
                alt={selectedToken.symbol} 
                className="w-6 h-6 mr-2 rounded-full" 
              />
            )}
            <div>
              <div className="font-medium">{selectedToken.symbol}</div>
              <div className="text-xs text-gray-400">{selectedToken.chainName}</div>
            </div>
          </div>
        ) : (
          <span className="text-gray-400">Select a token</span>
        )}
        <svg
          className="h-5 w-5 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-surface rounded-xl shadow-lg max-h-80 overflow-auto border border-surface-light">
          <div className="p-2">
            <div className="mb-2">
              <input
                type="text"
                placeholder="Search tokens..."
                className="w-full px-3 py-2 bg-background rounded-lg border border-surface-light focus:outline-none focus:ring-2 focus:ring-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center py-4">
                <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : tokens.length === 0 ? (
              <div className="px-3 py-2 text-gray-400 text-center">
                No tokens found
              </div>
            ) : (
              tokens.map((token) => (
                <div
                  key={`${token.chainId}-${token.symbol}-${token.address}`}
                  className="px-3 py-2 hover:bg-background rounded-lg cursor-pointer"
                  onClick={() => handleTokenSelect(token)}
                >
                  <div className="flex items-center">
                    {token.logoURI && (
                      <img 
                        src={token.logoURI} 
                        alt={token.symbol} 
                        className="w-6 h-6 mr-2 rounded-full" 
                        onError={(e) => {
                          // Replace broken image with a placeholder
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/24';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-xs text-gray-400">{token.name}</div>
                    </div>
                    <div className="text-xs text-gray-400 bg-background px-2 py-1 rounded">
                      {token.chainName}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector; 