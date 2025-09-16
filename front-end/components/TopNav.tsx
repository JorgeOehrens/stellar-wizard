'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '../app/providers/WalletProvider';
import { useNetwork } from '../app/providers/NetworkProvider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import StellarWizardLogo from './StellarWizardLogo';
import ThemeToggle from './ThemeToggle';
import NetworkToggle from './ui/NetworkToggle';
import WalletAuthModal from './WalletAuthModal';
import { Copy, Check } from 'lucide-react';

const TopNav: React.FC = () => {
  const { publicKey, authMethod, disconnect, isConnected } = useWallet();
  const { network } = useNetwork();
  const pathname = usePathname();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortenPublicKey = (key: string): string => {
    if (key.length <= 10) return key;
    return `${key.slice(0, 4)}…${key.slice(-6)}`;
  };

  const copyAddress = async () => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/nfts', label: 'NFTs' },
    { href: '/marketplace', label: 'Marketplace' },
    // { href: '/defi', label: 'DeFi' },
    // { href: '/swap', label: 'Swap' },
    // { href: '/lend', label: 'Lend' },
    // { href: '/dev/sdk-check', label: 'SDK Test' },
    // { href: '/about', label: 'About' },
  ];

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-2xl bg-black/30 dark:bg-white/5 backdrop-blur px-4 py-2 shadow-xl max-w-fit">
        <div className="flex items-center gap-6">
          {/* Logo - Icon + Wordmark */}
          <Link href="/" className="flex items-center">
            <StellarWizardLogo size={28} showText={true} variant="horizontal" />
          </Link>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors px-3 py-1.5 rounded-lg ${
                  pathname === link.href
                    ? 'text-hk-yellow bg-white/10'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Network Toggle */}
          <NetworkToggle className="hidden lg:flex" />

          {/* Network Badge */}
          <NetworkToggle variant="badge" className="lg:hidden" />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Wallet connection */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs font-mono text-white">
                  {shortenPublicKey(publicKey!)}
                </span>
                <button
                  onClick={copyAddress}
                  className="ml-1 p-1 hover:bg-white/10 rounded transition-colors"
                  title={copied ? 'Copied!' : 'Copy wallet address'}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-white/70 hover:text-white" />
                  )}
                </button>
                {authMethod && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {authMethod === 'google' ? 'Google' : 'Kit'}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="h-8 text-xs border-white/20 text-white/80 hover:bg-white/10 bg-transparent"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowAuthModal(true)}
              className="h-8 text-xs bg-hk-yellow text-black font-semibold hover:bg-hk-yellow/90"
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>

      <WalletAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </nav>
  );
};

export default TopNav;