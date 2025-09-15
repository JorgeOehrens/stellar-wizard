'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  StellarWalletsKit, 
  WalletNetwork, 
  FreighterModule,
  FREIGHTER_ID
} from '@creit.tech/stellar-wallets-kit';

interface WalletContextType {
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);

  useEffect(() => {
    const walletKit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: [new FreighterModule()],
    });

    setKit(walletKit);

    // Check if already connected on mount
    const storedPublicKey = localStorage.getItem('stellar_wallet_public_key');
    if (storedPublicKey) {
      setPublicKey(storedPublicKey);
    }
  }, []);

  const connect = async (): Promise<void> => {
    if (!kit) return;

    try {
      await kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            setPublicKey(address);
            localStorage.setItem('stellar_wallet_public_key', address);
          } catch (error) {
            console.error('Failed to get wallet address:', error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const disconnect = (): void => {
    setPublicKey(null);
    localStorage.removeItem('stellar_wallet_public_key');
  };

  const isConnected = publicKey !== null;

  const contextValue: WalletContextType = {
    publicKey,
    connect,
    disconnect,
    isConnected,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};