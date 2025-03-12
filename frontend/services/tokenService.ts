import axios from 'axios';
import { Token } from '../components/TokenSelector';
import { SimplifiedToken } from '../pages/api/tokens';
import { TokenPrice } from '../pages/api/tokenPrices';

// Convert simplified tokens to our Token format
export const convertSimplifiedTokenToToken = (token: SimplifiedToken): Token => {
  return {
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    address: token.address,
    chainId: 999, // Solana chain ID (using 999 as a placeholder)
    chainName: 'Solana',
    isWrapped: false,
    logoURI: token.logoURI,
    price: undefined,
    priceChangePercentage24h: undefined,
  };
};

// Fetch all tokens from our API with pagination and search
export const fetchTokens = async (search?: string): Promise<Token[]> => {
  try {
    // Fetch tokens with optional search parameter
    const params: Record<string, string> = { limit: '200' };
    if (search) {
      params.search = search;
    }
    
    const response = await axios.get<SimplifiedToken[]>('/api/tokens', { params });
    const simplifiedTokens = response.data;
    
    // Convert to our Token format
    const tokens = simplifiedTokens.map(convertSimplifiedTokenToToken);
    
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
        price: undefined,
        priceChangePercentage24h: undefined,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: 1,
        chainName: 'Ethereum',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
        price: undefined,
        priceChangePercentage24h: undefined,
      },
      {
        symbol: 'MATIC',
        name: 'Polygon',
        decimals: 18,
        chainId: 137,
        chainName: 'Polygon',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0/logo.png',
        price: undefined,
        priceChangePercentage24h: undefined,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chainId: 137,
        chainName: 'Polygon',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
        price: undefined,
        priceChangePercentage24h: undefined,
      },
      {
        symbol: 'AVAX',
        name: 'Avalanche',
        decimals: 18,
        chainId: 43114,
        chainName: 'Avalanche',
        isWrapped: false,
        logoURI: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png',
        price: undefined,
        priceChangePercentage24h: undefined,
      },
    ];
    
    // Combine Jup.ag tokens with our mock tokens
    return [...tokens, ...mockTokens];
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

// Fetch token prices from our API
export const fetchTokenPrices = async (symbols: string[]): Promise<Map<string, TokenPrice>> => {
  try {
    if (!symbols.length) {
      return new Map();
    }
    
    // Convert symbols to lowercase for case-insensitive matching
    const symbolsParam = symbols.join(',');
    
    const response = await axios.get<TokenPrice[]>('/api/tokenPrices', {
      params: { symbols: symbolsParam }
    });
    
    // Create a map of symbol to price data
    const priceMap = new Map<string, TokenPrice>();
    response.data.forEach(price => {
      priceMap.set(price.symbol.toLowerCase(), price);
    });
    
    return priceMap;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    return new Map();
  }
};

// Update tokens with price data
export const updateTokensWithPrices = (tokens: Token[], priceMap: Map<string, TokenPrice>): Token[] => {
  return tokens.map(token => {
    const priceData = priceMap.get(token.symbol.toLowerCase());
    if (priceData) {
      return {
        ...token,
        price: priceData.current_price,
        priceChangePercentage24h: priceData.price_change_percentage_24h
      };
    }
    return token;
  });
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