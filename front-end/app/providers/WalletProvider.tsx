'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  FREIGHTER_ID
} from '@creit.tech/stellar-wallets-kit';
import { StellarSocialSDK, StellarSocialAccount } from '../../../stellar-social-sdk/dist/index.esm.js';
import type { SocialAuthConfig } from '../../../stellar-social-sdk/dist/index.d.ts';
import { useNetwork } from './NetworkProvider';

type WalletAuthMethod = 'kit' | 'google';

interface WalletContextType {
  publicKey: string | null;
  authMethod: WalletAuthMethod | null;
  socialAccount: StellarSocialAccount | null;
  connect: () => Promise<void>;
  connectWithGoogle: (credentialResponse: any) => Promise<void>;
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
  const [authMethod, setAuthMethod] = useState<WalletAuthMethod | null>(null);
  const [socialAccount, setSocialAccount] = useState<StellarSocialAccount | null>(null);
  const [kit, setKit] = useState<StellarWalletsKit | null>(null);
  const [socialSDK, setSocialSDK] = useState<StellarSocialSDK | null>(null);
  const { network } = useNetwork();

  // Initialize both wallet kit and social SDK when network changes
  useEffect(() => {
    const walletNetwork = network === 'MAINNET' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;

    // Initialize Stellar Wallets Kit
    const walletKit = new StellarWalletsKit({
      network: walletNetwork,
      selectedWalletId: FREIGHTER_ID,
      modules: [new FreighterModule()],
    });
    setKit(walletKit);

    // Initialize Social SDK
    const socialConfig: SocialAuthConfig = {
      contractId: process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID || 'CD3W76OGYGHT4X5TMNUXWGEEVUBES67D3ZU4BALSW3BO23IMPT6E662A',
      network: network === 'MAINNET' ? 'mainnet' : 'testnet',
      googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    };

    const sdk = new StellarSocialSDK(socialConfig);
    sdk.initialize().catch(console.error);
    setSocialSDK(sdk);

    // Check if already connected on mount and attempt reconnection
    const storedData = localStorage.getItem('stellar_wallet_data');
    if (storedData) {
      try {
        const { publicKey: storedKey, authMethod: storedMethod } = JSON.parse(storedData);

        if (storedMethod === 'kit' && walletKit) {
          // For Freighter wallet, attempt to reconnect
          walletKit.getAddress()
            .then(({ address }) => {
              if (address === storedKey) {
                setPublicKey(storedKey);
                setAuthMethod(storedMethod);
              } else {
                // Address mismatch, clear stored data
                localStorage.removeItem('stellar_wallet_data');
              }
            })
            .catch(() => {
              // Connection failed, clear stored data
              localStorage.removeItem('stellar_wallet_data');
            });
        } else if (storedMethod === 'google') {
          // For Google auth, we can restore from stored data
          setPublicKey(storedKey);
          setAuthMethod(storedMethod);
        }
      } catch (error) {
        console.error('Failed to parse stored wallet data:', error);
        localStorage.removeItem('stellar_wallet_data');
      }
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
            setAuthMethod('kit');
            setSocialAccount(null);

            // Store wallet data
            const walletData = {
              publicKey: address,
              authMethod: 'kit' as WalletAuthMethod
            };
            localStorage.setItem('stellar_wallet_data', JSON.stringify(walletData));
          } catch (error) {
            console.error('Failed to get wallet address:', error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const connectWithGoogle = async (credentialResponse: any): Promise<void> => {
    if (!socialSDK) {
      throw new Error('Social SDK not initialized');
    }

    try {
      const result = await socialSDK.authenticateWithGoogleCredential(credentialResponse);

      if (result.success && result.account) {
        setPublicKey(result.account.publicKey);
        setAuthMethod('google');
        setSocialAccount(result.account);

        // Store wallet data with Google auth method
        const walletData = {
          publicKey: result.account.publicKey,
          authMethod: 'google' as WalletAuthMethod
        };
        localStorage.setItem('stellar_wallet_data', JSON.stringify(walletData));

        console.log('Successfully connected with Google:', result.account.publicKey);
      } else {
        throw new Error(result.error || 'Google authentication failed');
      }
    } catch (error) {
      console.error('Google authentication error:', error);
      throw error;
    }
  };

  const disconnect = (): void => {
    setPublicKey(null);
    setAuthMethod(null);
    setSocialAccount(null);
    localStorage.removeItem('stellar_wallet_data');
  };

  const signTransaction = async (xdr: string, options?: any): Promise<string> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      if (authMethod === 'google' && socialAccount) {
        // Use Social SDK for Google-authenticated accounts
        const signedXdr = await socialAccount.signTransaction(xdr);
        return signedXdr;
      } else if (authMethod === 'kit' && kit) {
        // Use Wallet Kit for Freighter/hardware wallets
        const { signedTxXdr } = await kit.signTransaction(xdr, options);
        return signedTxXdr;
      } else {
        throw new Error('No valid signing method available');
      }
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
    authMethod,
    socialAccount,
    connect,
    connectWithGoogle,
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