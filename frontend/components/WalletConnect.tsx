import React, { useState, useEffect, createContext, useContext } from 'react';
import { ethers } from 'ethers';
import Image from 'next/image';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

// Define the wallet types we support
type WalletType = 'metamask' | 'phantom' | 'walletconnect' | 'none';

// Define the wallet state
type WalletState = {
  connected: boolean;
  address: string;
  chainId: number;
  chainName: string;
  balance: string;
  type: WalletType;
};

// Initial wallet state
const initialWalletState: WalletState = {
  connected: false,
  address: '',
  chainId: 0,
  chainName: '',
  balance: '0',
  type: 'none',
};

// Chain configuration
const SUPPORTED_CHAINS = {
  // Ethereum testnets
  5: {
    name: 'Ethereum',
    testnet: 'Goerli',
    rpcUrl: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    blockExplorer: 'https://goerli.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  // Solana (using 999 as a placeholder)
  999: {
    name: 'Solana',
    testnet: 'Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    blockExplorer: 'https://explorer.solana.com/?cluster=devnet',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
  },
  // Polygon testnet
  80001: {
    name: 'Polygon',
    testnet: 'Mumbai',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'Matic',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  // Avalanche testnet
  43113: {
    name: 'Avalanche',
    testnet: 'Fuji',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    blockExplorer: 'https://testnet.snowtrace.io',
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18,
    },
  },
};

// Define types for our wallet context
type EthereumWallet = {
  address: string;
  provider: ethers.providers.Web3Provider;
  signer: ethers.Signer;
};

type SolanaWallet = {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
};

type WalletContextType = {
  ethereumWallet: EthereumWallet | null;
  solanaWallet: SolanaWallet | null;
  connectEthereum: () => Promise<void>;
  connectSolana: () => Promise<void>;
  disconnectEthereum: () => Promise<void>;
  disconnectSolana: () => Promise<void>;
  isConnecting: boolean;
  currentChain: 'ethereum' | 'solana' | null;
  switchChain: (chain: 'ethereum' | 'solana') => Promise<void>;
};

// Create context with default values
const WalletContext = createContext<WalletContextType>({
  ethereumWallet: null,
  solanaWallet: null,
  connectEthereum: async () => {},
  connectSolana: async () => {},
  disconnectEthereum: async () => {},
  disconnectSolana: async () => {},
  isConnecting: false,
  currentChain: null,
  switchChain: async () => {},
});

// Hook to use the wallet context
export const useWallet = () => useContext(WalletContext);

// Provider component
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ethereumWallet, setEthereumWallet] = useState<EthereumWallet | null>(null);
  const [solanaWallet, setSolanaWallet] = useState<SolanaWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentChain, setCurrentChain] = useState<'ethereum' | 'solana' | null>(null);

  // Check if wallets are already connected on component mount
  useEffect(() => {
    const checkConnections = async () => {
      // Check Ethereum connection
      if (window.ethereum && window.ethereum.selectedAddress) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const address = await signer.getAddress();
          
          setEthereumWallet({
            address,
            provider,
            signer,
          });
          
          setCurrentChain('ethereum');
        } catch (error) {
          console.error('Error checking Ethereum connection:', error);
        }
      }

      // Check Solana connection (Phantom)
      if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
        try {
          setSolanaWallet(window.solana);
          setCurrentChain('solana');
        } catch (error) {
          console.error('Error checking Solana connection:', error);
        }
      }
    };

    checkConnections();
  }, []);

  // Connect to Ethereum wallet (MetaMask)
  const connectEthereum = async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download.html', '_blank');
      return;
    }

    try {
      setIsConnecting(true);
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      setEthereumWallet({
        address,
        provider,
        signer,
      });
      
      setCurrentChain('ethereum');
    } catch (error) {
      console.error('Error connecting to Ethereum wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect to Solana wallet (Phantom)
  const connectSolana = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      setIsConnecting(true);
      
      const response = await window.solana.connect();
      setSolanaWallet(window.solana);
      setCurrentChain('solana');
    } catch (error) {
      console.error('Error connecting to Solana wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from Ethereum wallet
  const disconnectEthereum = async () => {
    setEthereumWallet(null);
    if (currentChain === 'ethereum') {
      setCurrentChain(null);
    }
  };

  // Disconnect from Solana wallet
  const disconnectSolana = async () => {
    if (solanaWallet) {
      try {
        await solanaWallet.disconnect();
      } catch (error) {
        console.error('Error disconnecting from Solana wallet:', error);
      }
    }
    
    setSolanaWallet(null);
    if (currentChain === 'solana') {
      setCurrentChain(null);
    }
  };

  // Switch between chains
  const switchChain = async (chain: 'ethereum' | 'solana') => {
    if (chain === currentChain) return;

    if (chain === 'ethereum') {
      await connectEthereum();
    } else {
      await connectSolana();
    }
  };

  return (
    <WalletContext.Provider
      value={{
        ethereumWallet,
        solanaWallet,
        connectEthereum,
        connectSolana,
        disconnectEthereum,
        disconnectSolana,
        isConnecting,
        currentChain,
        switchChain,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// Button component for connecting wallets
interface WalletButtonProps {
  onConnect?: () => void;
  className?: string;
}

export const ConnectWalletButton: React.FC<WalletButtonProps> = ({ onConnect, className }) => {
  const { 
    ethereumWallet, 
    solanaWallet, 
    connectEthereum, 
    connectSolana,
    disconnectEthereum,
    disconnectSolana,
    isConnecting,
    currentChain
  } = useWallet();

  const [showOptions, setShowOptions] = useState(false);

  const handleConnect = async (wallet: 'ethereum' | 'solana') => {
    if (wallet === 'ethereum') {
      await connectEthereum();
    } else {
      await connectSolana();
    }
    
    setShowOptions(false);
    if (onConnect) onConnect();
  };

  const handleDisconnect = async () => {
    if (currentChain === 'ethereum') {
      await disconnectEthereum();
    } else if (currentChain === 'solana') {
      await disconnectSolana();
    }
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Get current wallet address
  const getCurrentWalletAddress = () => {
    if (currentChain === 'ethereum' && ethereumWallet) {
      return formatAddress(ethereumWallet.address);
    } else if (currentChain === 'solana' && solanaWallet) {
      return formatAddress(solanaWallet.publicKey.toString());
    }
    return null;
  };

  return (
    <div className="relative">
      {!currentChain ? (
        <button
          className={`btn-primary ${className}`}
          onClick={() => setShowOptions(!showOptions)}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <button
          className={`bg-surface hover:bg-surface-light text-white font-bold py-2 px-4 rounded-xl flex items-center ${className}`}
          onClick={() => setShowOptions(!showOptions)}
        >
          {currentChain === 'ethereum' ? (
            <Image src="/metamask-logo.svg" alt="MetaMask" width={20} height={20} className="mr-2" />
          ) : (
            <Image src="/phantom-logo.svg" alt="Phantom" width={20} height={20} className="mr-2" />
          )}
          {getCurrentWalletAddress()}
        </button>
      )}

      {showOptions && (
        <div className="absolute mt-2 w-48 bg-surface rounded-xl shadow-lg z-10">
          {!currentChain ? (
            <>
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-surface-light"
                onClick={() => handleConnect('ethereum')}
              >
                <Image src="/metamask-logo.svg" alt="MetaMask" width={20} height={20} className="mr-2" />
                MetaMask (Ethereum)
              </button>
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-surface-light"
                onClick={() => handleConnect('solana')}
              >
                <Image src="/phantom-logo.svg" alt="Phantom" width={20} height={20} className="mr-2" />
                Phantom (Solana)
              </button>
            </>
          ) : (
            <button
              className="w-full px-4 py-2 text-sm text-red-500 hover:bg-surface-light"
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Add TypeScript declarations for window objects
declare global {
  interface Window {
    ethereum?: any;
    solana?: SolanaWallet & {
      isPhantom?: boolean;
      isConnected?: boolean;
    };
  }
}

export default WalletProvider; 