import { useState } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';

export default function Pools() {
  const [walletAddress, setWalletAddress] = useState<string | undefined>();

  const handleConnect = (address: string) => {
    setWalletAddress(address);
  };

  // Mock pool data
  const poolData = [
    { pair: 'uETH / uUSDC', tvl: '$4,250,000', volume24h: '$1,250,000', apr: '12.5%', chain: 'Ethereum' },
    { pair: 'uETH / uUSDC', tvl: '$1,750,000', volume24h: '$450,000', apr: '14.2%', chain: 'Polygon' },
    { pair: 'uAVAX / uUSDC', tvl: '$950,000', volume24h: '$320,000', apr: '18.7%', chain: 'Avalanche' },
    { pair: 'uMATIC / uUSDC', tvl: '$620,000', volume24h: '$180,000', apr: '15.3%', chain: 'Polygon' },
  ];

  return (
    <>
      <Head>
        <title>Liquidity Pools - Infinity DEX</title>
        <meta name="description" content="Provide liquidity to earn fees on Infinity DEX" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col">
        <Header onConnect={handleConnect} />
        <main className="flex-1 py-10 px-4">
          <div className="max-w-screen-xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Liquidity Pools</h1>
              <p className="text-gray-400">Provide liquidity to earn fees and rewards</p>
            </div>
            
            <div className="card mb-8">
              <div className="p-4 bg-background rounded-t-xl border-b border-surface-light">
                <div className="text-xl font-bold">Your Positions</div>
              </div>
              <div className="p-6 text-center">
                {walletAddress ? (
                  <div>
                    <p className="text-gray-400 mb-4">You don't have any active positions</p>
                    <button className="btn-primary">Add Liquidity</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-400 mb-4">Connect your wallet to view your positions</p>
                    <button className="btn-primary" onClick={() => {}}>Connect Wallet</button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="card">
              <div className="p-4 bg-background rounded-t-xl border-b border-surface-light">
                <div className="text-xl font-bold">Available Pools</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-400 border-b border-surface-light">
                      <th className="p-4">Pool</th>
                      <th className="p-4">Chain</th>
                      <th className="p-4">TVL</th>
                      <th className="p-4">24h Volume</th>
                      <th className="p-4">APR</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolData.map((pool, index) => (
                      <tr key={index} className="border-b border-surface-light hover:bg-background">
                        <td className="p-4 font-medium">{pool.pair}</td>
                        <td className="p-4">{pool.chain}</td>
                        <td className="p-4">{pool.tvl}</td>
                        <td className="p-4">{pool.volume24h}</td>
                        <td className="p-4 text-secondary">{pool.apr}</td>
                        <td className="p-4">
                          <button className="btn-outline py-1 px-3 text-sm">
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 text-center text-sm text-gray-400">
                Coming soon: Liquidity mining rewards and incentives
              </div>
            </div>
          </div>
        </main>
        <footer className="py-8 px-6 border-t border-surface-light">
          <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Infinity DEX
              </span>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                Docs
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                GitHub
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                Twitter
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                Discord
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
} 