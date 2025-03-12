import { useState, useEffect, useRef } from 'react';

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

const TokenSelector = ({ label, tokens, selectedToken, onSelect }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTokens, setFilteredTokens] = useState<Token[]>(tokens);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tokens based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredTokens(tokens);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tokens.filter(
      token => 
        token.symbol.toLowerCase().includes(query) || 
        token.name.toLowerCase().includes(query) ||
        token.chainName.toLowerCase().includes(query) ||
        token.address?.toLowerCase().includes(query)
    );
    
    setFilteredTokens(filtered);
  }, [searchQuery, tokens]);

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
            
            {filteredTokens.length === 0 ? (
              <div className="px-3 py-2 text-gray-400 text-center">
                No tokens found
              </div>
            ) : (
              filteredTokens.map((token) => (
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