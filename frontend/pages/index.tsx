import { useState } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import SwapForm from '../components/SwapForm';

export default function Home() {
  return (
    <>
      <Head>
        <title>Infinity DEX - Multichain Decentralized Exchange</title>
        <meta name="description" content="Fast, low-fee cross-chain swaps powered by Universal.xyz" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-10 px-4">
          <div className="max-w-screen-xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold mb-2">Multichain DEX</h1>
              <p className="text-xl text-gray-400 mb-8">Swap any token across any blockchain with lower fees and faster transactions</p>
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="px-4 py-2 bg-surface rounded-full text-sm font-medium">
                  Powered by Universal.xyz
                </div>
                <div className="px-4 py-2 bg-surface rounded-full text-sm font-medium">
                  50% Lower Fees
                </div>
                <div className="px-4 py-2 bg-surface rounded-full text-sm font-medium">
                  15s Average Swap Time
                </div>
              </div>
            </div>
            <SwapForm />
            <div className="mt-10 text-center opacity-75 hover:opacity-100 transition-opacity">
              <p className="text-sm text-gray-400">
                Infinity DEX is currently in demo mode. No real transactions will be performed.
              </p>
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