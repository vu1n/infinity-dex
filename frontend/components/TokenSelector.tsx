import { useState } from 'react';

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

  const handleTokenSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
  };

  return (
    <div className="relative">
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
        <div className="absolute z-10 mt-1 w-full bg-surface rounded-xl shadow-lg max-h-60 overflow-auto border border-surface-light">
          <div className="p-2">
            {tokens.map((token) => (
              <div
                key={`${token.chainId}-${token.symbol}`}
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
                  <div>
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-xs text-gray-400">{token.chainName}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector; 