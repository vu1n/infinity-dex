import { useState } from 'react';
import Link from 'next/link';
import { ConnectWalletButton } from './WalletConnect';

// Define the props for the Header component
interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  return (
    <header className={`py-4 px-6 flex justify-between items-center border-b border-surface-light ${className || ''}`}>
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
        <ConnectWalletButton />
      </nav>
    </header>
  );
};

export default Header; 