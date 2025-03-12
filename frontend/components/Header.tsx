import { useState } from 'react';
import Link from 'next/link';

// Add type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

type Props = {
  onConnect?: (address: string) => void;
};

const Header = ({ onConnect }: Props) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        const userAddress = accounts[0];
        setAddress(userAddress);
        setConnected(true);
        if (onConnect) {
          onConnect(userAddress);
        }
      } else {
        alert('Please install MetaMask to use this feature');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  return (
    <header className="py-4 px-6 flex justify-between items-center border-b border-surface-light">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Infinity DEX
          </span>
        </Link>
      </div>
      <nav className="flex items-center space-x-6">
        <Link href="/" className="font-medium">
          Swap
        </Link>
        <Link href="/pools" className="font-medium">
          Pools
        </Link>
        <Link href="/stats" className="font-medium">
          Stats
        </Link>
        {connected ? (
          <div className="px-4 py-2 bg-surface-light rounded-xl">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        ) : (
          <button 
            onClick={connectWallet} 
            className="btn-primary"
          >
            Connect Wallet
          </button>
        )}
      </nav>
    </header>
  );
};

export default Header; 