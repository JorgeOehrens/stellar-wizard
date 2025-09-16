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
import { Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';

const TopNav: React.FC = () => {
  const { publicKey, authMethod, disconnect, isConnected, balance, isLoadingBalance, refreshBalance } = useWallet();
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

  const viewSmartContract = () => {
    const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';
    const networkPath = network === 'MAINNET' ? 'public' : 'testnet';
    const explorerUrl = `https://stellar.expert/explorer/${networkPath}/contract/${contractId}`;
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };

  const getPrimaryBalance = (): string => {
    if (!balance || balance.length === 0) return '0';
    const xlmBalance = balance.find(b => b.asset === 'XLM');
    if (xlmBalance) {
      return parseFloat(xlmBalance.balance).toFixed(2);
    }
    return parseFloat(balance[0].balance).toFixed(2);
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Created' },
    { href: '/nfts', label: 'NFTs' },
    // { href: '/marketplace', label: 'Marketplace' },
    // { href: '/defi', label: 'DeFi' },
    // { href: '/swap', label: 'Swap' },
    // { href: '/lend', label: 'Lend' },
    // { href: '/dev/sdk-check', label: 'SDK Test' },
    // { href: '/about', label: 'About' },
  ];

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-2xl bg-white/95 dark:bg-black/40 dark:border-white/10 border border-black/20 backdrop-blur-md px-4 py-2 shadow-2xl max-w-fit">
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
                    ? 'text-hk-yellow bg-black/10 dark:bg-white/10'
                    : 'text-black/80 dark:text-white/80 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
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
              {/* Balance Display */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-black/10 dark:bg-white/10 backdrop-blur rounded-lg">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-black dark:text-white">
                    {isLoadingBalance ? '...' : `${getPrimaryBalance()} XLM`}
                  </span>
                  <button
                    onClick={refreshBalance}
                    className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                    title="Refresh balance"
                    disabled={isLoadingBalance}
                  >
                    <RefreshCw className={`h-3 w-3 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white ${isLoadingBalance ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Wallet Info */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-black/10 dark:bg-white/10 backdrop-blur rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs font-mono text-black dark:text-white">
                  {shortenPublicKey(publicKey!)}
                </span>
                <button
                  onClick={copyAddress}
                  className="ml-1 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                  title={copied ? 'Copied!' : 'Copy wallet address'}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white" />
                  )}
                </button>
                {authMethod && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {authMethod === 'google' ? 'Google' : 'Kit'}
                  </Badge>
                )}
              </div>

              {/* Smart Contract View Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={viewSmartContract}
                className="h-8 text-xs border-black/20 dark:border-white/20 text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10 bg-transparent"
                title="View Smart Contract on Stellar Expert"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Contract
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="h-8 text-xs border-black/20 dark:border-white/20 text-black/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10 bg-transparent"
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