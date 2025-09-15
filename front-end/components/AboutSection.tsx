'use client';

import React from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, TrendingUp, Globe, Zap } from 'lucide-react';

const AboutSection: React.FC = () => {
  const stats = [
    {
      icon: Users,
      title: "Internet Users vs dApp Users",
      description: "The adoption gap",
      value: "5B vs 17.2M",
      subtitle: "daily active users",
      source: "Statista, DappRadar"
    },
    {
      icon: TrendingUp,
      title: "Market Growth Projection", 
      description: "Blockchain market size",
      value: "$2.25B → $99.7B",
      subtitle: "by 2025",
      source: "Grand View Research"
    },
    {
      icon: Globe,
      title: "Global Adoption Rate",
      description: "Current blockchain adoption",
      value: "< 5%",
      subtitle: "of global population",
      source: "Market Research Future"
    },
    {
      icon: Zap,
      title: "User Experience Gap",
      description: "Technical barrier reduction needed",
      value: "95%",
      subtitle: "complexity reduction",
      source: "Crypto.com Research"
    }
  ];

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16 relative">
          {/* Magician decoration */}
          <div className="absolute left-8 top-0 hidden xl:block opacity-15 dark:opacity-10">
            <Image
              src="/magician.svg"
              alt="Magician"
              width={120}
              height={120}
              className="object-contain"
            />
          </div>
          
          <h1 className="hackmeridian-headline text-4xl lg:text-5xl font-bold text-readable mb-6">
            BRIDGING THE WEB3 ADOPTION GAP
          </h1>
          <p className="text-xl text-readable-muted max-w-3xl mx-auto leading-relaxed">
            Stellar Wizard addresses the massive gap between traditional internet users and 
            blockchain adoption by making Web3 interactions as simple as natural language.
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center">
              <CardHeader className="pb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{stat.title}</CardTitle>
                <CardDescription>{stat.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {stat.subtitle}
                </div>
                <Badge variant="outline" className="text-xs">
                  {stat.source}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Problem Statement */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <Card className="bg-destructive/5 border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">The Problem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Technical Complexity</h4>
                <p className="text-muted-foreground text-sm">
                  Current blockchain interfaces require users to understand smart contracts, 
                  gas fees, and complex transaction flows.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Knowledge Barrier</h4>
                <p className="text-muted-foreground text-sm">
                  Users need to learn specialized terminology and concepts before 
                  they can safely interact with DeFi protocols.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Fear of Loss</h4>
                <p className="text-muted-foreground text-sm">
                  One mistake in a transaction can result in permanent loss of funds, 
                  creating anxiety for new users.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-green-500">Our Solution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Natural Language Interface</h4>
                <p className="text-muted-foreground text-sm">
                  Users describe what they want to do in plain English, 
                  and AI handles the technical complexity.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Smart Risk Management</h4>
                <p className="text-muted-foreground text-sm">
                  Built-in risk assessment and validation before any transaction 
                  is executed, with clear explanations.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">One-Click Execution</h4>
                <p className="text-muted-foreground text-sm">
                  Complex multi-step DeFi operations reduced to a single 
                  confirmation, just like traditional apps.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Impact Vision */}
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Our Vision for Impact</CardTitle>
            <CardDescription>
              Democratizing access to decentralized finance through AI-powered simplicity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">10M+</div>
                <div className="text-sm text-muted-foreground">
                  New users onboarded to Web3 by 2025
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-accent mb-2">95%</div>
                <div className="text-sm text-muted-foreground">
                  Reduction in user errors and failed transactions
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-500 mb-2">1000x</div>
                <div className="text-sm text-muted-foreground">
                  Faster onboarding compared to traditional DeFi
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* References Section */}
        <div className="mt-16 pt-8 border-t border-border">
          <h3 className="text-lg font-semibold mb-6 text-center">Data Sources & References</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-medium text-foreground mb-2">Market Research</h4>
              <ul className="space-y-1">
                <li>• Grand View Research - Blockchain Market Analysis</li>
                <li>• Market Research Future - Web3 Adoption Trends</li>
                <li>• Statista - Global Internet Usage Statistics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Industry Data</h4>
              <ul className="space-y-1">
                <li>• DappRadar - Daily Active Wallet Analytics</li>
                <li>• Crypto.com Research - User Experience Studies</li>
                <li>• Stellar Development Foundation - Network Statistics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutSection;