'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from './ui/button';
import { useWallet } from '../app/providers/WalletProvider';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';

const HeroSection: React.FC = () => {
  const { isConnected, connect } = useWallet();

  return (
    <div className="relative min-h-screen flex items-center bg-overlay">
      {/* Magic Ball Decoration */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block opacity-20 dark:opacity-10">
        <Image
          src="/magic-ball.svg"
          alt="Magic Ball"
          width={200}
          height={200}
          className="object-contain animate-pulse"
        />
      </div>
      
      {/* Hero Content */}
      <div className="container mx-auto px-6 py-32 pt-24 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-hk-yellow/90 border border-hk-yellow rounded-full text-sm font-semibold text-hk-black mb-8 backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            Integrate with official Stellar SDKs

          </div>
          
          {/* Main Heading - HackMeridian style */}
          <h1 className="hackmeridian-headline text-5xl lg:text-8xl text-white dark:text-text-dark mb-8 tracking-wider leading-tight">
            FROM PROMPT
            <br />
            <span className="text-hk-yellow">
              TO BLOCKCHAIN
            </span>
            <br />
            <span className="hackmeridian-tagline text-3xl lg:text-5xl normal-case tracking-normal text-white/90 dark:text-gray-300">
              in one click
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl lg:text-2xl text-white/90 dark:text-gray-200 mb-12 max-w-4xl mx-auto leading-relaxed">
            Create NFTs, deploy DeFi strategies, and interact with Stellar using natural language. 
            <br className="hidden lg:block" />
            No coding required—just describe what you want to build.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            {isConnected ? (
              <>
                <Link href="/nfts">
                  <Button size="lg" className="h-14 px-8 text-lg bg-primary hover:bg-primary/90">
                    Create NFTs
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/defi">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
                    DeFi Strategies
                    <Zap className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </>
            ) : (
              <Button 
                size="lg" 
                onClick={connect}
                className="h-14 px-8 text-lg bg-primary hover:bg-primary/90"
              >
                Connect Wallet to Start
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
          
          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-6 bg-white/10 backdrop-blur border border-white/20 rounded-xl">
              <div className="w-12 h-12 bg-hk-yellow/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Image
                  src="/wizzard.svg"
                  alt="Wizard"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                AI-Powered Creation
              </h3>
              <p className="text-white/80 text-sm">
                Describe your vision in plain English and watch it come to life on the blockchain
              </p>
            </div>
            
            <div className="p-6 bg-white/10 backdrop-blur border border-white/20 rounded-xl">
              <div className="w-12 h-12 bg-hk-yellow/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-hk-yellow" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                One-Click Deployment
              </h3>
              <p className="text-white/80 text-sm">
                From concept to contract deployment in seconds, not hours
              </p>
            </div>
            
            <div className="p-6 bg-white/10 backdrop-blur border border-white/20 rounded-xl">
              <div className="w-12 h-12 bg-hk-yellow/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Sparkles className="w-6 h-6 text-hk-yellow" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Stellar Network
              </h3>
              <p className="text-white/80 text-sm">
                Built on Stellar's fast, low-cost, and scalable blockchain infrastructure
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
};

export default HeroSection;