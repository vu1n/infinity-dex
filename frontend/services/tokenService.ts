import axios from 'axios';
import { Token } from '../components/TokenSelector';
import { JupToken } from '../pages/api/tokens';

// Convert Jup.ag tokens to our Token format
export const convertJupTokenToToken = (jupToken: JupToken): Token => {
  return {
    symbol: jupToken.symbol,
    name: jupToken.name,
    decimals: jupToken.decimals,
    address: jupToken.address,
    chainId: 999, // Solana chain ID (using 999 as a placeholder)
    chainName: 'Solana',
    isWrapped: false,
    logoURI: jupToken.logoURI,
  };
};

// Fetch all tokens from our API (which gets them from Jup.ag)
export const fetchTokens = async (): Promise<Token[]> => {
  try {
    // Fetch Jup.ag tokens
    const response = await axios.get<JupToken[]>('/api/tokens');
    const jupTokens = response.data;
    
    // Convert to our Token format
    const tokens = jupTokens.map(convertJupTokenToToken);
    
    // Add our mock tokens for other chains
    const mockTokens: Token[] = [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        chainId: 1,
        chainName: 'Ethereum',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: 1,
        chainName: 'Ethereum',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
      },
      {
        symbol: 'MATIC',
        name: 'Polygon',
        decimals: 18,
        chainId: 137,
        chainName: 'Polygon',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0/logo.png',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: 137,
        chainName: 'Polygon',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
      },
      {
        symbol: 'AVAX',
        name: 'Avalanche',
        decimals: 18,
        chainId: 43114,
        chainName: 'Avalanche',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png',
      },
    ];
    
    // Combine Jup.ag tokens with our mock tokens
    return [...tokens, ...mockTokens];
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

// Fetch price quote from our API (which gets it from Jup.ag)
export const fetchPriceQuote = async (
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50
): Promise<{
  inAmount: string;
  outAmount: string;
  exchangeRate: string;
  priceImpactPct: number;
}> => {
  try {
    // Only fetch from Jup.ag if both tokens are Solana tokens
    if (inputMint && outputMint && inputMint.length >= 32 && outputMint.length >= 32) {
      const response = await axios.get(`/api/price`, {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps,
        },
      });
      return response.data;
    }
    
    // For cross-chain or non-Solana tokens, use mock data
    return {
      inAmount: amount,
      outAmount: (parseFloat(amount) * 2).toString(), // Mock exchange rate
      exchangeRate: '2',
      priceImpactPct: 0.1,
    };
  } catch (error) {
    console.error('Error fetching price quote:', error);
    throw error;
  }
}; 