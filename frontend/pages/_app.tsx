import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import WalletProvider from '@/components/WalletConnect';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Infinity DEX - Multichain Decentralized Exchange</title>
        <meta name="description" content="Multichain DEX leveraging Universal.xyz for fast and low-fee cross-chain swaps" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <WalletProvider>
        <Component {...pageProps} />
      </WalletProvider>
    </>
  );
}

export default MyApp; 