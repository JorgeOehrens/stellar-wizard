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

interface WalletBalance {
  balance: string;
  asset: string;
}

interface WalletContextType {
  publicKey: string | null;
  authMethod: WalletAuthMethod | null;
  socialAccount: StellarSocialAccount | null;
  balance: WalletBalance[] | null;
  isLoadingBalance: boolean;
  connect: () => Promise<void>;
  connectWithGoogle: (credentialResponse: any) => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
  signTransaction: (xdr: string, options?: any) => Promise<string>;
  refreshGoogleAuth: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<WalletAuthMethod | null>(null);
  const [socialAccount, setSocialAccount] = useState<StellarSocialAccount | null>(null);
  const [balance, setBalance] = useState<WalletBalance[] | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
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

    // Initialize Social SDK
    const socialConfig: SocialAuthConfig = {
      contractId: process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID || 'CD3W76OGYGHT4X5TMNUXWGEEVUBES67D3ZU4BALSW3BO23IMPT6E662A',
      network: network === 'MAINNET' ? 'mainnet' : 'testnet',
      googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    };

    const sdk = new StellarSocialSDK(socialConfig);
    sdk.initialize().catch(console.error);

    // Set states after initialization
    setKit(walletKit);
    setSocialSDK(sdk);

    // Small delay to ensure kit is properly set before connection restoration
    setTimeout(() => {
      // Check if already connected on mount and attempt reconnection
      const storedData = localStorage.getItem('stellar_wallet_data');
      if (storedData) {
        try {
          const { publicKey: storedKey, authMethod: storedMethod } = JSON.parse(storedData);
          console.log('Restoring wallet connection:', { publicKey: storedKey?.slice(0, 8) + '...', authMethod: storedMethod });

          if (storedMethod === 'kit') {
            // For Freighter wallet, attempt to reconnect and verify
            walletKit.getAddress()
              .then(({ address }) => {
                console.log('Wallet kit address check:', address === storedKey ? 'MATCH' : 'MISMATCH');
                if (address === storedKey) {
                  // Set wallet in kit for signing
                  walletKit.setWallet(FREIGHTER_ID);
                  setPublicKey(storedKey);
                  setAuthMethod(storedMethod);
                  console.log('Wallet connection restored successfully');
                } else {
                  // Address mismatch, clear stored data
                  console.log('Address mismatch, clearing stored data');
                  localStorage.removeItem('stellar_wallet_data');
                }
              })
              .catch((error) => {
                // Connection failed, clear stored data
                console.log('Failed to restore wallet connection:', error);
                localStorage.removeItem('stellar_wallet_data');
              });
          } else if (storedMethod === 'google') {
            // For Google auth, we need to restore the social account as well
            setPublicKey(storedKey);
            setAuthMethod(storedMethod);
            console.log('Google auth connection restored');

            // For Google auth, the social account needs to be re-authenticated
            // We'll show as connected but signing will require re-auth if session expired
            console.log('Google auth restored - social account will be verified on first transaction');
          }
        } catch (error) {
          console.error('Failed to parse stored wallet data:', error);
          localStorage.removeItem('stellar_wallet_data');
        }
      }
    }, 100); // Small delay to ensure proper initialization
  }, [network]);

  const connect = async (): Promise<void> => {
    if (!kit) {
      console.error('Wallet kit not initialized');
      return;
    }

    try {
      await kit.openModal({
        onWalletSelected: async (option) => {
          console.log('Wallet selected:', option.id);
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            console.log('Wallet connected successfully:', address);

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

  const refreshBalance = async (): Promise<void> => {
    if (!publicKey) return;

    setIsLoadingBalance(true);
    try {
      if (authMethod === 'google' && socialAccount) {
        // Use Social SDK for balance
        const balanceData = await socialAccount.getBalance();
        setBalance(balanceData);
      } else {
        // Use Stellar SDK for regular wallets
        const { Horizon } = await import('@stellar/stellar-sdk');
        const server = new Horizon.Server(
          network === 'MAINNET'
            ? 'https://horizon.stellar.org'
            : 'https://horizon-testnet.stellar.org'
        );

        const account = await server.loadAccount(publicKey);
        const balanceData = account.balances.map(bal => ({
          balance: bal.balance || '0',
          asset: bal.asset_type === 'native' ? 'XLM' : `${bal.asset_code}:${bal.asset_issuer}`
        }));
        setBalance(balanceData);
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const refreshGoogleAuth = async (): Promise<void> => {
    // For now, clear the social account and require re-authentication
    // In a full implementation, we'd try to restore the session
    console.log('Google auth refresh requested - clearing stored data');
    setPublicKey(null);
    setAuthMethod(null);
    setSocialAccount(null);
    localStorage.removeItem('stellar_wallet_data');
    throw new Error('Google session expired - please sign in again');
  };

  const signTransaction = async (xdr: string, options?: any): Promise<string> => {
    console.log('signTransaction called with:', {
      publicKey: publicKey ? `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}` : null,
      authMethod,
      hasKit: !!kit,
      hasSocialAccount: !!socialAccount
    });

    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      if (authMethod === 'google') {
        if (socialAccount) {
          // Use Social SDK for Google-authenticated accounts
          console.log('Using Google/Social SDK for signing');
          const signedXdr = await socialAccount.signTransaction(xdr);
          return signedXdr;
        } else {
          // Social account not available, try to refresh first
          console.log('Social account not available, attempting to refresh...');
          try {
            // Since refreshGoogleAuth clears the session, this will throw
            await refreshGoogleAuth();
            throw new Error('Refresh should have thrown an error');
          } catch (refreshError) {
            console.error('Failed to refresh Google auth:', refreshError);
            throw new Error('Google authentication session expired - please reconnect with Google');
          }
        }
      } else if (kit) {
        // For any wallet kit connection (Freighter, etc.)
        console.log('Using Wallet Kit for signing');

        // Ensure wallet is set in kit
        kit.setWallet(FREIGHTER_ID);

        // Verify connection before signing
        try {
          const { address } = await kit.getAddress();
          console.log('Kit address verification:', address === publicKey ? 'MATCH' : 'MISMATCH');
          if (address !== publicKey) {
            throw new Error('Wallet address mismatch - please reconnect');
          }
        } catch (connectionError) {
          console.error('Kit connection error during signing:', connectionError);
          // Clear stored data and throw connection error
          localStorage.removeItem('stellar_wallet_data');
          setPublicKey(null);
          setAuthMethod(null);
          throw new Error('Freighter is not connected - please reconnect your wallet');
        }

        // Double-check that we can sign with the current wallet setup
        try {
          console.log('Attempting transaction signing...');
          const { signedTxXdr } = await kit.signTransaction(xdr, options);
          console.log('Transaction signed successfully');
          return signedTxXdr;
        } catch (signingError) {
          console.error('Transaction signing failed:', signingError);
          throw signingError;
        }
      } else {
        console.error('No signing method available:', {
          authMethod,
          hasKit: !!kit,
          hasSocialAccount: !!socialAccount,
          publicKey: publicKey ? 'present' : 'missing'
        });
        throw new Error('No valid signing method available - please reconnect your wallet');
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
      } else if (error?.message?.includes('not connected')) {
        throw new Error(error.message); // Pass through connection errors as-is
      } else if (error?.message?.includes('No valid signing method')) {
        throw new Error(error.message); // Pass through signing method errors as-is
      } else if (error?.message) {
        throw new Error(`Wallet error: ${error.message}`);
      } else {
        throw new Error('Failed to sign transaction - please check your wallet connection');
      }
    }
  };

  const isConnected = publicKey !== null;

  // Auto-refresh balance when wallet connects or network changes
  useEffect(() => {
    if (isConnected) {
      refreshBalance();
    }
  }, [isConnected, network, authMethod]);

  const contextValue: WalletContextType = {
    publicKey,
    authMethod,
    socialAccount,
    balance,
    isLoadingBalance,
    connect,
    connectWithGoogle,
    disconnect,
    isConnected,
    signTransaction,
    refreshGoogleAuth,
    refreshBalance,
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