'use client';

import React from 'react';
import { useNetwork, StellarNetwork } from '../../app/providers/NetworkProvider';
import { Badge } from './badge';

interface NetworkToggleProps {
  variant?: 'full' | 'badge';
  className?: string;
}

const NetworkToggle: React.FC<NetworkToggleProps> = ({ variant = 'full', className = '' }) => {
  const { network, setNetwork } = useNetwork();

  if (variant === 'badge') {
    return (
      <Badge 
        variant={network === 'MAINNET' ? 'destructive' : 'secondary'} 
        className={className}
      >
        {network}
      </Badge>
    );
  }

  return (
    <div className={`flex items-center bg-muted rounded-lg p-1 ${className}`}>
      <button
        onClick={() => setNetwork('TESTNET')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          network === 'TESTNET'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Testnet
      </button>
      <button
        onClick={() => setNetwork('MAINNET')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          network === 'MAINNET'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Mainnet
      </button>
    </div>
  );
};

export default NetworkToggle;