'use client';

import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useWallet } from '../app/providers/WalletProvider';
import { Loader2, Wallet, Globe } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: Element, config: any) => void;
        };
      };
    };
  }
}

interface WalletAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletAuthModal: React.FC<WalletAuthModalProps> = ({ isOpen, onClose }) => {
  const { connect, connectWithGoogle } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingMethod, setConnectingMethod] = useState<'kit' | 'google' | null>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load Google Sign-In script
      const loadGoogleScript = () => {
        if (window.google) {
          setGoogleLoaded(true);
          initializeGoogleSignIn();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setGoogleLoaded(true);
          initializeGoogleSignIn();
        };
        document.head.appendChild(script);
      };

      loadGoogleScript();
    }
  }, [isOpen]);

  const initializeGoogleSignIn = () => {
    if (window.google && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
      });

      // Also render the sign-in button for better UX
      const buttonElement = document.getElementById('google-signin-button');
      if (buttonElement) {
        window.google.accounts.id.renderButton(buttonElement, {
          theme: 'outline',
          size: 'large',
          width: '100%',
        });
      }
    }
  };

  const handleGoogleResponse = async (response: any) => {
    setIsConnecting(true);
    setConnectingMethod('google');

    try {
      await connectWithGoogle(response);
      onClose();
    } catch (error) {
      console.error('Google sign-in failed:', error);
      alert(`Google sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
      setConnectingMethod(null);
    }
  };

  const handleKitConnect = async () => {
    setIsConnecting(true);
    setConnectingMethod('kit');

    try {
      await connect();
      onClose();
    } catch (error) {
      console.error('Wallet kit connection failed:', error);
    } finally {
      setIsConnecting(false);
      setConnectingMethod(null);
    }
  };

  const handleGoogleSignIn = () => {
    if (window.google) {
      // Use the One Tap prompt
      window.google.accounts.id.prompt();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-50 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Wallet
          </CardTitle>
          <CardDescription>
            Choose how you'd like to connect to the Stellar network
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Sign-In Option */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Continue with Google</h3>
              <Badge variant="outline">New!</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Create or recover a deterministic Stellar wallet using your Google account
            </p>
            {/* Google Sign-In Button Container */}
            <div id="google-signin-button" className="w-full" />

            {/* Fallback button if Google Sign-In fails to render */}
            {(!googleLoaded || isConnecting) && (
              <Button
                onClick={handleGoogleSignIn}
                disabled={isConnecting || !googleLoaded}
                className="w-full"
                variant="default"
              >
                {isConnecting && connectingMethod === 'google' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting with Google...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    {googleLoaded ? 'Continue with Google' : 'Loading Google Sign-In...'}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Wallet Kit Option */}
          <div className="space-y-3">
            <h3 className="font-medium">Continue with Wallet Kit</h3>
            <p className="text-sm text-muted-foreground">
              Connect using Freighter, hardware wallets, or import from seed phrase
            </p>
            <Button
              onClick={handleKitConnect}
              disabled={isConnecting}
              className="w-full"
              variant="outline"
            >
              {isConnecting && connectingMethod === 'kit' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening Wallet...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Wallet Kit
                </>
              )}
            </Button>
          </div>

          <div className="text-center">
            <Button variant="ghost" onClick={onClose} disabled={isConnecting}>
              Cancel
            </Button>
          </div>

          {/* Information */}
          <div className="text-xs text-muted-foreground space-y-2 pt-4 border-t">
            <p>
              <strong>Google:</strong> Your wallet is created deterministically from your Google account. Same account = same wallet.
            </p>
            <p>
              <strong>Wallet Kit:</strong> Connect existing wallets like Freighter or hardware wallets.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletAuthModal;