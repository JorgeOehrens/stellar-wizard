'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  StellarWalletsKit, 
  WalletNetwork, 
  FreighterModule,
  FREIGHTER_ID
} from '@creit.tech/stellar-wallets-kit';
import { useNetwork } from './NetworkProvider';

interface WalletContextType {
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
  signTransaction: (xdr: string, options?: any) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const { network } = useNetwork();

  // Reinitialize wallet kit when network changes
  useEffect(() => {
    const walletNetwork = network === 'MAINNET' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;
    
    const walletKit = new StellarWalletsKit({
      network: walletNetwork,
      selectedWalletId: FREIGHTER_ID,
      modules: [new FreighterModule()],
    });

    setKit(walletKit);

    // Check if already connected on mount
    const storedPublicKey = localStorage.getItem('stellar_wallet_public_key');
    if (storedPublicKey) {
      setPublicKey(storedPublicKey);
    }
  }, [network]);

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

  const signTransaction = async (xdr: string, options?: any): Promise<string> => {
    if (!kit || !publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const { signedTxXdr } = await kit.signTransaction(xdr, options);
      return signedTxXdr;
    } catch (error: any) {
      console.error('Failed to sign transaction:', error);
      
      // Provide more specific error messages
      if (error?.message?.includes('User denied') || error?.message?.includes('rejected')) {
        throw new Error('User rejected the transaction in wallet');
      } else if (error?.message?.includes('timeout')) {
        throw new Error('Transaction signing timed out');
      } else if (error?.message?.includes('invalid') || error?.message?.includes('malformed')) {
        throw new Error('Invalid transaction data - this might be a development/testing issue');
      } else if (error?.message) {
        throw new Error(`Wallet error: ${error.message}`);
      } else {
        throw new Error('Failed to sign transaction - please check your wallet connection');
      }
    }
  };

  const isConnected = publicKey !== null;

  const contextValue: WalletContextType = {
    publicKey,
    connect,
    disconnect,
    isConnected,
    signTransaction,
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