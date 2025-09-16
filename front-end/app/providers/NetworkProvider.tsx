'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type StellarNetwork = 'TESTNET' | 'MAINNET';

interface NetworkContextType {
  network: StellarNetwork;
  setNetwork: (network: StellarNetwork) => void;
  getRpcUrl: () => string;
  getExplorerUrl: (type: 'tx' | 'contract', id: string) => string;
  getNetworkPassphrase: () => string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'network';

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [network, setNetworkState] = useState<StellarNetwork>('TESTNET');

  useEffect(() => {
    // Load network from localStorage on client side
    if (typeof window !== 'undefined') {
      const savedNetwork = localStorage.getItem(STORAGE_KEY) as StellarNetwork;
      if (savedNetwork === 'TESTNET' || savedNetwork === 'MAINNET') {
        setNetworkState(savedNetwork);
      }
    }
  }, []);

  const setNetwork = (newNetwork: StellarNetwork) => {
    setNetworkState(newNetwork);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newNetwork);
    }
  };

  const getRpcUrl = (): string => {
    switch (network) {
      case 'TESTNET':
        return process.env.NEXT_PUBLIC_SOROBAN_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org';
      case 'MAINNET':
        return process.env.NEXT_PUBLIC_SOROBAN_MAINNET_RPC_URL || 'https://rpc.ankr.com/stellar_soroban';
      default:
        return 'https://soroban-testnet.stellar.org';
    }
  };

  const getExplorerUrl = (type: 'tx' | 'contract', id: string): string => {
    const baseUrl = network === 'MAINNET' 
      ? 'https://stellar.expert/explorer/public'
      : 'https://stellar.expert/explorer/testnet';
    
    return `${baseUrl}/${type}/${id}`;
  };

  const getNetworkPassphrase = (): string => {
    switch (network) {
      case 'TESTNET':
        return 'Test SDF Network ; September 2015';
      case 'MAINNET':
        return 'Public Global Stellar Network ; September 2015';
      default:
        return 'Test SDF Network ; September 2015';
    }
  };

  const value: NetworkContextType = {
    network,
    setNetwork,
    getRpcUrl,
    getExplorerUrl,
    getNetworkPassphrase,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};