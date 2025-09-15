'use client';

import React from 'react';
import Image from 'next/image';

interface StellarWizardLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  variant?: 'horizontal' | 'compact';
}

const StellarWizardLogo: React.FC<StellarWizardLogoProps> = ({ 
  className = "", 
  size = 32,
  showText = true,
  variant = 'horizontal'
}) => {
  if (variant === 'compact' || !showText) {
    return (
      <div className={`flex items-center ${className}`}>
        <Image
          src="/wizzard.svg"
          alt="Stellar Wizard"
          width={size}
          height={size}
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/wizzard.svg"
        alt="Stellar Wizard"
        width={size}
        height={size}
        className="object-contain"
      />
      
      <div className="flex flex-col leading-none">
        <span className="text-lg font-bold text-white tracking-tight">
          Stellar Wizard
        </span>
      </div>
    </div>
  );
};

export default StellarWizardLogo;