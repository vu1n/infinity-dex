import axios from 'axios';
import { Token } from '../components/TokenSelector';
import { SimplifiedToken } from '../pages/api/tokens';
import { TokenPrice } from '../pages/api/tokenPrices';
import { UniversalToken } from '../pages/api/universalTokens';
import { CrossChainPriceResponse } from '../pages/api/crossChainPrice';

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

// Convert Universal tokens to our Token format
export const convertUniversalTokenToToken = (token: UniversalToken): Token => {
  return {
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    address: token.address,
    chainId: token.chainId,
    chainName: token.chainName,
    isWrapped: token.isWrapped,
    logoURI: token.logoURI,
    price: undefined,
    priceChangePercentage24h: undefined,
    wrappedVersion: token.wrappedVersion,
    unwrappedVersion: token.unwrappedVersion,
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
    
    // Fetch Solana tokens
    const solanaResponse = await axios.get<SimplifiedToken[]>('/api/tokens', { params });
    const solanaTokens = solanaResponse.data.map(convertSimplifiedTokenToToken);
    
    // Fetch Universal.xyz tokens (both wrapped and unwrapped)
    const universalResponse = await axios.get<UniversalToken[]>('/api/universalTokens', { 
      params: { 
        search: search || '' 
      } 
    });
    const universalTokens = universalResponse.data.map(convertUniversalTokenToToken);
    
    // Combine all tokens
    return [...solanaTokens, ...universalTokens];
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

// Fetch tokens by chain
export const fetchTokensByChain = async (chainId: number, search?: string): Promise<Token[]> => {
  try {
    const params: Record<string, string> = {};
    if (search) {
      params.search = search;
    }
    
    // For Solana tokens
    if (chainId === 999) {
      const response = await axios.get<SimplifiedToken[]>('/api/tokens', { 
        params: { 
          ...params,
          limit: '200'
        } 
      });
      return response.data.map(convertSimplifiedTokenToToken);
    }
    
    // For other chains, use Universal.xyz tokens
    const response = await axios.get<UniversalToken[]>('/api/universalTokens', { 
      params: { 
        ...params,
        chainId 
      } 
    });
    return response.data.map(convertUniversalTokenToToken);
  } catch (error) {
    console.error(`Error fetching tokens for chain ${chainId}:`, error);
    return [];
  }
};

// Fetch wrapped tokens
export const fetchWrappedTokens = async (search?: string): Promise<Token[]> => {
  try {
    const params: Record<string, string> = { wrapped: 'true' };
    if (search) {
      params.search = search;
    }
    
    const response = await axios.get<UniversalToken[]>('/api/universalTokens', { params });
    return response.data.map(convertUniversalTokenToToken);
  } catch (error) {
    console.error('Error fetching wrapped tokens:', error);
    return [];
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

// Fetch cross-chain price
export const fetchCrossChainPrice = async (
  sourceToken: Token,
  destinationToken: Token,
): Promise<CrossChainPriceResponse> => {
  try {
    const response = await axios.get<CrossChainPriceResponse>('/api/crossChainPrice', {
      params: {
        sourceToken: sourceToken.symbol,
        sourceChain: sourceToken.chainName,
        destinationToken: destinationToken.symbol,
        destinationChain: destinationToken.chainName,
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching cross-chain price:', error);
    
    // Return a fallback response
    return {
      sourceToken: sourceToken.symbol,
      sourceChain: sourceToken.chainName,
      destinationToken: destinationToken.symbol,
      destinationChain: destinationToken.chainName,
      exchangeRate: '1',
      priceImpactPct: 0,
      route: [
        {
          fromToken: sourceToken.symbol,
          fromChain: sourceToken.chainName,
          toToken: destinationToken.symbol,
          toChain: destinationToken.chainName,
          exchangeRate: '1',
          type: 'swap'
        }
      ]
    };
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

// Find the wrapped version of a token
export const findWrappedToken = (token: Token, tokens: Token[]): Token | undefined => {
  if (token.wrappedVersion) {
    return tokens.find(t => 
      t.symbol === token.wrappedVersion && 
      t.isWrapped === true
    );
  }
  return undefined;
};

// Find the unwrapped version of a token
export const findUnwrappedToken = (token: Token, tokens: Token[]): Token | undefined => {
  if (token.unwrappedVersion) {
    return tokens.find(t => 
      t.symbol === token.unwrappedVersion && 
      t.isWrapped === false
    );
  }
  return undefined;
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