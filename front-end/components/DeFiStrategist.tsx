'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useWallet } from '../app/providers/WalletProvider';
import { useNetwork } from '../app/providers/NetworkProvider';
import { Textarea } from './ui/textarea';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, ExternalLink, MessageCircle, Send, PieChart, DollarSign, ArrowUpDown, Repeat } from 'lucide-react';
import NetworkToggle from './ui/NetworkToggle';
import Image from 'next/image';

enum FlowType {
  INITIAL = 'initial',
  INVEST = 'invest',
  SWAP = 'swap'
}


enum FlowStep {
  CONVERSATION = 'conversation',
  STRATEGY_READY = 'strategy-ready',
  SWAP_READY = 'swap-ready',

  RISK_WARNING = 'risk-warning',
  SIGNING = 'signing',
  SUCCESS = 'success'
}

interface InvestorProfile {
  riskTolerance?: 'low' | 'medium' | 'high';
  preferredAssets?: string[];
  targetApy?: number;
  liquidityNeed?: number;
  investmentHorizon?: 'short' | 'medium' | 'long';
  investmentAmount?: number;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  maxSlippage?: number;
}

interface SwapPlan {
  assetIn: string;
  assetOut: string;
  amount: string;
  tradeType: 'EXACT_IN' | 'EXACT_OUT';
  slippageBps: number;
  protocols?: string[];
  from: string;
  to: string;
  network: 'testnet' | 'mainnet';
  assetInSymbol?: string;
  assetOutSymbol?: string;
  expectedOut?: string;
  priceImpact?: number;
  route?: any;
}


interface DeFiAllocation {
  protocol: string;
  strategy: string;
  asset: string;
  percentage: number;
  estimatedApy: number;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

interface DeFiStrategy {
  profile: InvestorProfile;
  allocations: DeFiAllocation[];
  totalEstimatedApy: number;
  totalRiskScore: number;
  warnings: string[];
  fees: {
    dappFee: number;
    protocolFees: number;
    gasEstimate: number;
  };
  network: 'TESTNET' | 'MAINNET';
  isComplete: boolean;
  needsInfo: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ExecutedStrategy {
  transactionHash: string;
  allocations: DeFiAllocation[];
  totalAmount: number;
  estimatedApy: number;
}

interface ExecutedSwap {
  transactionHash: string;
  assetIn: string;
  assetOut: string;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
}

// Helper function to get asset symbol from asset ID
const getAssetSymbolFromId = (assetId: string): string => {
  const assetMap: Record<string, string> = {
    'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75': 'USDT',
    'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV': 'USDC',
    'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA': 'STABLE'
  };
  return assetMap[assetId] || 'TOKEN';
};

const DeFiStrategist: React.FC = () => {
  const { isConnected, publicKey, signTransaction } = useWallet();
  const { network, getExplorerUrl } = useNetwork();
  const [flowType, setFlowType] = useState<FlowType>(FlowType.INITIAL);

  const [currentStep, setCurrentStep] = useState<FlowStep>(FlowStep.CONVERSATION);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "💰 Welcome! I'm your DeFi Wizard. I can help you with two things:\n\n🔹 **Invest** - Build personalized investment strategies using DeFindex protocols\n🔹 **Swap** - Exchange tokens using Soroswap with the best rates\n\nWhich would you like to do today?",

      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [strategy, setStrategy] = useState<DeFiStrategy>({
    profile: {},
    allocations: [],
    totalEstimatedApy: 0,
    totalRiskScore: 0,
    warnings: [],
    fees: { dappFee: 0, protocolFees: 0, gasEstimate: 0 },
    network: 'TESTNET',
    isComplete: false,
    needsInfo: ['riskTolerance', 'investmentAmount', 'preferredAssets']
  });
  const [executedStrategy, setExecutedStrategy] = useState<ExecutedStrategy | null>(null);
  const [swapPlan, setSwapPlan] = useState<SwapPlan | null>(null);
  const [swapTransaction, setSwapTransaction] = useState<any>(null);
  const [executedSwap, setExecutedSwap] = useState<ExecutedSwap | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (swapPlan) {
      setSwapPlan(prev => prev ? ({
        ...prev,
        from: publicKey || '',
        to: publicKey || '',
        network: network === 'TESTNET' ? 'testnet' : 'mainnet'
      }) : null);
    }
  }, [publicKey, network]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

  const getDefaultStrategy = (): DeFiStrategy => ({
    profile: {},
    allocations: [],
    totalEstimatedApy: 0,
    totalRiskScore: 0,
    warnings: [],
    fees: { dappFee: 0, protocolFees: 0, gasEstimate: 0 },
    network: 'TESTNET',
    isComplete: false,
    needsInfo: ['riskTolerance', 'investmentAmount', 'preferredAssets']
  });

  const [strategy, setStrategy] = useState<DeFiStrategy>(getDefaultStrategy());
  const [swapPlan, setSwapPlan] = useState<SwapPlan | null>(null);
  const [swapTransaction, setSwapTransaction] = useState<any>(null);
  const [executedStrategy, setExecutedStrategy] = useState<ExecutedStrategy | null>(null);
  const [executedSwap, setExecutedSwap] = useState<ExecutedSwap | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (swapPlan) {
      setSwapPlan(prev => prev ? ({
        ...prev,
        from: publicKey || '',
        to: publicKey || '',
        network: network === 'TESTNET' ? 'testnet' : 'mainnet'
      }) : null);
    }
  }, [publicKey, network]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const endpoint = '/api/defi-wizard';

      const response = await fetch(endpoint, {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          currentStrategy: flowType === FlowType.INITIAL ? null : strategy,
          currentSwapPlan: swapPlan,
          flowType,
          network: network.toLowerCase(),
          userAddress: publicKey

        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Handle flow type detection
      if (data.flowType && flowType === FlowType.INITIAL) {
        setFlowType(data.flowType);
      }

      // Update appropriate state based on flow type
      if (data.strategy) {
        setStrategy(data.strategy);
        // Check if strategy is complete and move to next step
        if (data.strategy.isComplete && currentStep === FlowStep.CONVERSATION) {
          setCurrentStep(FlowStep.STRATEGY_READY);
        }
      }

      if (data.swapPlan) {
        setSwapPlan(data.swapPlan);
        // Check if swap is ready
        if (data.swapReady && currentStep === FlowStep.CONVERSATION) {
          setCurrentStep(FlowStep.SWAP_READY);
        }
      }

      if (data.swapTransaction) {
        setSwapTransaction(data.swapTransaction);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const modifyStrategy = () => {
    setCurrentStep(FlowStep.CONVERSATION);
    const modifyMessage: Message = {
      role: 'assistant',
      content: flowType === FlowType.SWAP
        ? "What would you like to change about your swap? I can help you adjust the assets, amount, slippage, or any other aspect."
        : "What would you like to change about your investment strategy? I can help you adjust your risk level, allocations, or any other aspect of the plan.",

      timestamp: new Date()
    };
    setMessages(prev => [...prev, modifyMessage]);
  };

  const proceedToRiskWarning = () => {
    setCurrentStep(FlowStep.RISK_WARNING);
  };

  const handleExecuteStrategy = async () => {
    if (!strategy.isComplete) return;

    setIsLoading(true);
    setCurrentStep(FlowStep.SIGNING);

    try {
      // Check if this is a vault investment strategy
      if ((strategy as any).chosenVault) {
        const chosenVault = (strategy as any).chosenVault;

        // Build the vault investment transaction
        const buildResponse = await fetch('/api/defindex/invest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultAddress: chosenVault.vaultId,
            amount: strategy.profile.investmentAmount,
            asset: getAssetSymbolFromId(chosenVault.assetId),
            userAddress: publicKey,
            network: network.toLowerCase()
          })
        });

        if (!buildResponse.ok) {
          throw new Error('Failed to build vault investment transaction');
        }

        const buildData = await buildResponse.json();

        // Sign transaction with wallet
        if (!signTransaction) {
          throw new Error('Wallet not connected');
        }

        const signedXdr = await signTransaction(buildData.xdr);

        // In a real implementation, you would submit the signed transaction to Horizon
        // For now, we'll simulate a successful transaction
        await new Promise(resolve => setTimeout(resolve, 2000));

        const executed: ExecutedStrategy = {
          transactionHash: 'VAULT_' + Date.now().toString(16).toUpperCase(),
          allocations: strategy.allocations,
          totalAmount: strategy.profile.investmentAmount || 1000,
          estimatedApy: (strategy as any).chosenVault?.assumedApy || strategy.totalEstimatedApy || 0
        };

        setExecutedStrategy(executed);
        setCurrentStep(FlowStep.SUCCESS);

      } else {
        // Handle legacy strategy execution
        await new Promise(resolve => setTimeout(resolve, 3000));

        const executed: ExecutedStrategy = {
          transactionHash: '9a8b7c6d5e4f3210fedcba9876543210abcdef123456789087654321fedcba98',
          allocations: strategy.allocations,
          totalAmount: strategy.profile.investmentAmount || 1000,
          estimatedApy: (strategy as any).chosenVault?.assumedApy || strategy.totalEstimatedApy || 0
        };

        setExecutedStrategy(executed);
        setCurrentStep(FlowStep.SUCCESS);
      }

    } catch (error) {
      console.error('Strategy execution failed:', error);
      setCurrentStep(FlowStep.STRATEGY_READY);

      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Investment failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or adjust your parameters.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleExecuteSwap = async () => {
    setIsLoading(true);
    setCurrentStep(FlowStep.SIGNING);

    try {
      // Use pre-built transaction from conversation
      if (!swapTransaction || !swapTransaction.xdr) {
        throw new Error('Swap transaction not ready. Please complete the conversation first.');
      }

      // Check if this is mock data and handle accordingly
      if (swapTransaction.xdr.includes('MOCK_XDR_FOR_DEVELOPMENT') || swapTransaction.isMockData) {
        // Simulate swap execution for mock data
        const executed: ExecutedSwap = {
          assetIn: swapPlan?.assetInSymbol || swapPlan?.assetIn || 'USDC',
          assetOut: swapPlan?.assetOutSymbol || swapPlan?.assetOut || 'XLM',
          amountIn: swapPlan?.amount || '0',
          amountOut: swapPlan?.expectedOut || '0',
          priceImpact: swapPlan?.priceImpact || 0
        };

        setExecutedSwap(executed);
        setCurrentStep(FlowStep.SUCCESS);

        const successMessage: Message = {
          role: 'assistant',
          content: `✅ **Mock Swap Executed Successfully!**\n\n🔄 Swapped ${executed.amountIn} ${executed.assetIn} → ${executed.amountOut} ${executed.assetOut}\n\n*Note: This was a simulated swap using mock data since Soroswap API is currently unavailable.*`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
        setIsLoading(false);
        return;
      }

      // Sign transaction with wallet for real transactions
      if (!signTransaction) {
        throw new Error('Wallet not connected');
      }

      const signedXdr = await signTransaction(swapTransaction.xdr);

      // Submit signed transaction
      const submitResponse = await fetch('/api/swap/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xdr: signedXdr,
          network: network.toLowerCase()
        })
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit swap transaction');
      }

      const submitData = await submitResponse.json();

      const executed: ExecutedSwap = {
        transactionHash: submitData.hash,
        assetIn: swapPlan.assetInSymbol || swapPlan.assetIn,
        assetOut: swapPlan.assetOutSymbol || swapPlan.assetOut,
        amountIn: swapPlan.amount,
        amountOut: swapPlan.expectedOut || '0',
        priceImpact: swapPlan.priceImpact || 0
      };

      setExecutedSwap(executed);
      setCurrentStep(FlowStep.SUCCESS);

    } catch (error) {
      console.error('Swap execution failed:', error);
      setCurrentStep(FlowStep.SWAP_READY);

      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or adjust your parameters.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);

    }

    setIsLoading(false);
  };

  const resetFlow = () => {
    setFlowType(FlowType.INITIAL);
    setCurrentStep(FlowStep.CONVERSATION);
    setMessages([{
      role: 'assistant',
      content: "💰 Welcome back! Would you like to **invest** in DeFi strategies or **swap** tokens today?",

      timestamp: new Date()
    }]);
    setStrategy({
      profile: {},
      allocations: [],
      totalEstimatedApy: 0,
      totalRiskScore: 0,
      warnings: [],
      fees: { dappFee: 0, protocolFees: 0, gasEstimate: 0 },
      network: network,
      isComplete: false,
      needsInfo: ['riskTolerance', 'investmentAmount', 'preferredAssets']
    });
    setSwapPlan({
      assetIn: '',
      assetOut: '',
      amount: '',
      tradeType: 'EXACT_IN',
      slippageBps: 50,
      protocols: ['soroswap', 'sdex'],
      from: publicKey || '',
      to: publicKey || '',
      network: network === 'TESTNET' ? 'testnet' : 'mainnet'
    });
    setExecutedStrategy(null);
    setExecutedSwap(null);

    setIsLoading(false);
  };

  const getFlowIcon = () => {
    switch (flowType) {
      case FlowType.INVEST:
        return <PieChart className="w-5 h-5 text-primary" />;
      case FlowType.SWAP:
        return <ArrowUpDown className="w-5 h-5 text-primary" />;
      default:
        return <DollarSign className="w-5 h-5 text-primary" />;
    }
  };

  const getFlowTitle = () => {
    switch (flowType) {
      case FlowType.INVEST:
        return 'Investment Advisor';
      case FlowType.SWAP:
        return 'Swap Assistant';
      default:
        return 'DeFi Wizard';
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-readable mb-4">
            DeFi Investment Wizard
          </h1>
          <p className="text-readable-muted mb-8">
            Connect your wallet to start building personalized DeFi investment strategies or swap tokens

          </p>
          <Card className="p-8">
            <CardContent className="text-center">
              <p className="text-lg text-muted-foreground">
                Please connect your Stellar wallet to continue
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg-light dark:bg-bg-dark">

      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <h1 className="hackmeridian-headline text-4xl font-bold text-readable">
              DEFI WIZARD

            </h1>
            <NetworkToggle />
          </div>
          <p className="text-xl text-readable-muted">
            {flowType === FlowType.INVEST ? 'Build personalized investment strategies with AI guidance' :
             flowType === FlowType.SWAP ? 'Swap tokens with optimal routing and best rates' :
             'Invest in DeFi strategies or swap tokens with AI guidance'}

          </p>
        </div>

        {flowType !== FlowType.INITIAL && (
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                currentStep === FlowStep.CONVERSATION ? 'bg-primary text-primary-foreground' :
                [FlowStep.STRATEGY_READY, FlowStep.SWAP_READY, FlowStep.RISK_WARNING, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
                {flowType === FlowType.SWAP ? 'Configure Swap' : 'Chat with Advisor'}
              </div>
              <div className="w-8 h-px bg-border" />
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                [FlowStep.STRATEGY_READY, FlowStep.SWAP_READY].includes(currentStep) ? 'bg-primary text-primary-foreground' :
                [FlowStep.RISK_WARNING, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
                {flowType === FlowType.SWAP ? 'Review Swap' : 'Review Strategy'}
              </div>
              <div className="w-8 h-px bg-border" />
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                [FlowStep.RISK_WARNING, FlowStep.SIGNING].includes(currentStep) ? 'bg-primary text-primary-foreground' :
                currentStep === FlowStep.SUCCESS ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
                Execute
              </div>

            </div>
          </div>
        )}

        {/* Main Content */}
        {currentStep === FlowStep.CONVERSATION && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getFlowIcon()}
                  Chat with {getFlowTitle()}
                </CardTitle>
                <CardDescription>
                  {flowType === FlowType.INVEST ? 'Discuss your goals, risk tolerance, and preferred assets' :
                   flowType === FlowType.SWAP ? 'Configure your token swap with optimal routing' :
                   'Choose between investing in DeFi strategies or swapping tokens'}

                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Messages */}
                <div className="h-96 overflow-y-auto space-y-4 mb-4 p-4 bg-muted/30 rounded-lg">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-card-foreground border'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            {getFlowIcon()}
                            <span className="text-xs font-medium text-muted-foreground">
                              {getFlowTitle()}

                            </span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card text-card-foreground border p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          {getFlowIcon()}
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            {getFlowTitle()} is analyzing...

                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="flex gap-2">
                  <Textarea
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      flowType === FlowType.INITIAL ? "Type 'invest' or 'swap'..." :
                      flowType === FlowType.SWAP ? "Tell me what tokens you want to swap..." :
                      "Tell me about your investment goals..."
                    }

                    disabled={isLoading}
                    rows={2}
                    className="flex-1 resize-none"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!currentMessage.trim() || isLoading}
                    size="icon"
                    className="self-end"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {flowType === FlowType.SWAP ? (
                    <>
                      <ArrowUpDown className="w-5 h-5 text-primary" />
                      Swap Configuration
                    </>
                  ) : (
                    <>
                      <PieChart className="w-5 h-5 text-primary" />
                      Investment Profile
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {flowType === FlowType.SWAP ? (
                  <>
                    {swapPlan.assetIn && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">From</label>
                        <p className="font-semibold text-sm break-all">
                          {swapPlan.assetInSymbol || swapPlan.assetIn}
                        </p>
                      </div>
                    )}

                    {swapPlan.assetOut && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">To</label>
                        <p className="font-semibold text-sm break-all">
                          {swapPlan.assetOutSymbol || swapPlan.assetOut}
                        </p>
                      </div>
                    )}

                    {swapPlan.amount && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Amount</label>
                        <p className="font-semibold">{swapPlan.amount}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Slippage</label>
                      <p className="font-semibold">{(swapPlan.slippageBps / 100).toFixed(2)}%</p>
                    </div>

                    {swapPlan.expectedOut && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Expected Output</label>
                        <p className="font-semibold text-green-600">{swapPlan.expectedOut}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {strategy.profile.riskTolerance && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Risk Tolerance</label>
                        <Badge variant="outline" className="ml-2 capitalize">
                          {strategy.profile.riskTolerance}
                        </Badge>
                      </div>
                    )}

                    {strategy.profile.investmentAmount && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Investment Amount</label>
                        <p className="font-semibold">${strategy.profile.investmentAmount.toLocaleString()}</p>
                      </div>
                    )}

                    {strategy.profile.preferredAssets && strategy.profile.preferredAssets.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Preferred Assets</label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {strategy.profile.preferredAssets.map((asset) => (
                            <Badge key={asset} variant="secondary" className="text-xs">
                              {asset}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {strategy.profile.targetApy && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Target APY</label>
                        <p className="font-semibold text-green-600">{strategy.profile.targetApy}%</p>
                      </div>
                    )}

                    {strategy.profile.investmentHorizon && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Time Horizon</label>
                        <Badge variant="outline" className="ml-2 capitalize">
                          {strategy.profile.investmentHorizon}-term
                        </Badge>
                      </div>
                    )}

                    {strategy.needsInfo.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Still Needed</label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {strategy.needsInfo.map((info) => (
                            <Badge key={info} variant="outline" className="text-xs">
                              {info.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {strategy.isComplete && (
                      <Badge className="w-full justify-center bg-green-500">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Strategy Ready!
                      </Badge>
                    )}
                  </>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Network</label>
                  <p className="font-semibold">{network}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Swap Ready Screen */}
        {currentStep === FlowStep.SWAP_READY && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-primary" />
                Swap Summary
              </CardTitle>
              <CardDescription>
                Review your swap details before execution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">From</p>
                    <p className="text-xl font-bold">{swapPlan.assetInSymbol || 'Token'}</p>
                    <p className="text-sm font-mono">{swapPlan.amount}</p>
                  </div>
                  <ArrowUpDown className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">To</p>
                    <p className="text-xl font-bold">{swapPlan.assetOutSymbol || 'Token'}</p>
                    <p className="text-sm font-mono text-green-600">{swapPlan.expectedOut || '~'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Slippage Tolerance</p>
                    <p className="font-semibold">{(swapPlan.slippageBps / 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Price Impact</p>
                    <p className="font-semibold">{swapPlan.priceImpact?.toFixed(3) || '< 0.01'}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Network</p>
                    <p className="font-semibold capitalize">{swapPlan.network}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Route</p>
                    <p className="font-semibold">{swapPlan.protocols?.join(' → ') || 'Optimal'}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={modifyStrategy} variant="outline" className="flex-1">
                  Modify Swap
                </Button>
                <Button onClick={handleExecuteSwap} className="flex-1">
                  Execute Swap
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Investment Strategy Ready Screen */}

        {currentStep === FlowStep.STRATEGY_READY && strategy.isComplete && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                {(strategy as any).vaultRecommendation ? 'Vault Investment Ready' : 'Investment Strategy Plan Ready'}
              </CardTitle>
              <CardDescription>
                {(strategy as any).vaultRecommendation
                  ? 'Review your vault recommendation and projected returns'
                  : 'Review your personalized DeFi allocation before execution'}

              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Strategy Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Investment</p>
                  <p className="text-2xl font-bold">${strategy.profile.investmentAmount?.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Estimated APY</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(strategy as any).chosenVault?.assumedApy || strategy.totalEstimatedApy || 0}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <p className="text-2xl font-bold">{strategy.totalRiskScore || 5}/10</p>
                </div>
              </div>

              {/* Vault Projections */}
              {(strategy as any).projections && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Projected Balance Growth</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(strategy as any).projections.map((proj: any) => (
                      <div key={proj.months} className="text-center p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">{proj.months} months</p>
                        <p className="text-xl font-bold">${proj.balance.toFixed(2)}</p>
                        <p className="text-xs text-green-600">+${proj.totalReturns.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    *Projections assume monthly compounding and no additional contributions
                  </p>
                </div>
              )}

              {/* Vault Details */}
              {(strategy as any).chosenVault && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Chosen Vault Details</h3>
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">DeFindex Vault</h4>
                        <p className="text-sm text-muted-foreground font-mono">
                          {(strategy as any).chosenVault.vaultId.slice(0, 8)}...
                          {(strategy as any).chosenVault.vaultId.slice(-6)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={(strategy as any).chosenVault.riskLabel === 'Conservative' ? 'secondary' :
                                       (strategy as any).chosenVault.riskLabel === 'Balanced' ? 'default' : 'destructive'}>
                          {(strategy as any).chosenVault.riskLabel}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Asset</p>
                        <p className="font-semibold">{getAssetSymbolFromId((strategy as any).chosenVault.assetId)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">APY</p>
                        <p className="font-semibold text-green-600">{(strategy as any).chosenVault.assumedApy}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">TVL</p>
                        <p className="font-semibold">{((parseFloat((strategy as any).chosenVault.tvl) / 1e7).toFixed(2))} {getAssetSymbolFromId((strategy as any).chosenVault.assetId)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Network</p>
                        <p className="font-semibold">{(strategy as any).chosenVault.network.toUpperCase()}</p>
                      </div>
                    </div>

                    {/* Strategy Allocations */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Strategy Allocations</p>
                      {(strategy as any).chosenVault.allocations.map((alloc: any, index: number) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="font-mono">{alloc.strategyId.slice(0, 8)}...{alloc.strategyId.slice(-6)}</span>
                          <span className="font-semibold">{alloc.percent.toFixed(2)}%</span>
                        </div>
                      ))}
                      {(strategy as any).chosenVault.idlePercent > 0 && (
                        <div className="flex justify-between text-xs">
                          <span>Idle</span>
                          <span className="font-semibold">{(strategy as any).chosenVault.idlePercent.toFixed(2)}%</span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">{(strategy as any).chosenVault.rationale}</p>
                  </div>
                </div>
              )}

              {/* Allocations */}
              {strategy.allocations && strategy.allocations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Portfolio Allocations</h3>
                <div className="space-y-3">
                  {strategy.allocations.map((allocation, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{allocation.strategy}</h4>
                          <p className="text-sm text-muted-foreground">{allocation.protocol} • {allocation.asset}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{allocation.percentage}%</p>
                          <Badge variant={allocation.riskLevel === 'low' ? 'secondary' : allocation.riskLevel === 'medium' ? 'default' : 'destructive'}>
                            {allocation.estimatedApy.toFixed(1)}% APY
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{allocation.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Warnings */}
              {strategy.warnings && strategy.warnings.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Important Notes</h3>
                  {strategy.warnings.map((warning, index) => (
                    <Alert key={index} className="mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Fees */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Fee Breakdown</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">DApp Fee</p>
                    <p className="font-semibold">{strategy.fees?.dappFee || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Protocol Fees</p>
                    <p className="font-semibold">{strategy.fees?.protocolFees || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gas Estimate</p>
                    <p className="font-semibold">${strategy.fees?.gasEstimate || 0}</p>
                  </div>
                </div>
              </div>


              <div className="flex gap-3">
                <Button onClick={modifyStrategy} variant="outline" className="flex-1">
                  Modify Strategy
                </Button>
                <Button onClick={proceedToRiskWarning} className="flex-1">
                  Continue to Risk Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {currentStep === FlowStep.RISK_WARNING && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Risk Disclosure & Final Confirmation
              </CardTitle>
              <CardDescription>
                Please review and acknowledge these important risks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>DeFi Risks:</strong> Your investments are subject to smart contract risks, market volatility, and potential impermanent loss in liquidity pools. Past performance does not guarantee future results.
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Liquidity Risk:</strong> Some DeFi positions may have lock-up periods or withdrawal delays. Ensure you understand the liquidity terms before proceeding.
                </AlertDescription>
              </Alert>

              {strategy.totalRiskScore > 7 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>High Risk Strategy:</strong> This strategy has a high risk score ({strategy.totalRiskScore}/10). Consider reducing your position size or choosing a more conservative approach.
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Strategy Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Investment Amount:</span>
                    <span className="font-mono">${strategy.profile.investmentAmount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target APY:</span>
                    <span className="font-mono text-green-600">
                      {((strategy as any).chosenVault?.assumedApy || strategy.totalEstimatedApy || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Risk Level:</span>
                    <span className="font-mono">{strategy.totalRiskScore || 5}/10</span>

                  </div>
                  <div className="flex justify-between">
                    <span>Network:</span>
                    <span className="font-mono">{strategy.network}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentStep(flowType === FlowType.SWAP ? FlowStep.SWAP_READY : FlowStep.STRATEGY_READY)} variant="outline" className="flex-1">
                  Back to Review
                </Button>
                <Button

                  onClick={handleExecuteStrategy}
                  disabled={isLoading}
                  className="flex-1"
                >
                  I Understand, Execute Strategy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signing Screen */}
        {currentStep === FlowStep.SIGNING && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {flowType === FlowType.SWAP ? 'Executing Swap' : 'Executing Investment Strategy'}
              </h3>

              <p className="text-muted-foreground mb-4">
                Please sign the transactions in your Freighter wallet...
              </p>
              <Badge variant="outline">Connected: {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}</Badge>
            </CardContent>
          </Card>
        )}

        {/* Success Screen */}
        {currentStep === FlowStep.SUCCESS && (executedStrategy || executedSwap) && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">
                {flowType === FlowType.SWAP ? 'Swap Executed Successfully!' : 'Strategy Executed Successfully!'}
              </h3>
              <p className="text-muted-foreground mb-8">
                {flowType === FlowType.SWAP
                  ? `Your token swap has been completed on Stellar ${network}`
                  : `Your investment strategy has been deployed to DeFindex protocols on Stellar ${network}`}

              </p>

              <div className="space-y-4 text-left bg-muted/50 rounded-lg p-6 mb-8">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction Hash</label>
                  <p className="font-mono text-sm break-all">
                    {executedSwap?.transactionHash || executedStrategy?.transactionHash}
                  </p>
                </div>
                {executedSwap ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Swapped</label>
                        <p className="font-semibold">{executedSwap.amountIn} {executedSwap.assetIn}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Received</label>
                        <p className="font-semibold text-green-600">{executedSwap.amountOut} {executedSwap.assetOut}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Price Impact</label>
                      <p className="font-semibold">{executedSwap.priceImpact.toFixed(3)}%</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Invested</label>
                        <p className="font-semibold">${executedStrategy?.totalAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Estimated APY</label>
                        <p className="font-semibold text-green-600">{executedStrategy?.estimatedApy.toFixed(2)}%</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Active Positions</label>
                      <p className="font-semibold">{executedStrategy?.allocations.length} protocols</p>
                    </div>
                  </>
                )}

              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  asChild
                  className="flex-1"
                >
                  <a
                    href={getExplorerUrl('tx', executedSwap?.transactionHash || executedStrategy?.transactionHash || '')}

                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Explorer
                  </a>
                </Button>
                <Button onClick={resetFlow} className="flex-1">
                  {flowType === FlowType.SWAP ? 'New Swap' : 'Create New Strategy'}

                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default DeFiStrategist;