'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useWallet } from '../app/providers/WalletProvider';
import { useNetwork } from '../app/providers/NetworkProvider';
import { Textarea } from './ui/textarea';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, ExternalLink, MessageCircle, Send, PieChart, DollarSign } from 'lucide-react';
import NetworkToggle from './ui/NetworkToggle';
import Image from 'next/image';

enum FlowStep {
  CONVERSATION = 'conversation',
  STRATEGY_READY = 'strategy-ready',
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

const DeFiStrategist: React.FC = () => {
  const { isConnected, publicKey, signTransaction } = useWallet();
  const { network, getExplorerUrl } = useNetwork();
  const [currentStep, setCurrentStep] = useState<FlowStep>(FlowStep.CONVERSATION);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "💰 Welcome! I'm your DeFi Investment Wizard. I'll help you create a personalized investment strategy using DeFindex protocols on Stellar.\n\nTo get started, tell me about your investment goals, risk tolerance, and what you'd like to achieve with your portfolio!",
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const response = await fetch('/api/defi-wizard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          currentStrategy: strategy,
          network
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStrategy(data.strategy);

      // Check if strategy is complete and move to next step
      if (data.strategy.isComplete && currentStep === FlowStep.CONVERSATION) {
        setCurrentStep(FlowStep.STRATEGY_READY);
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
      content: "What would you like to change about your investment strategy? I can help you adjust your risk level, allocations, or any other aspect of the plan.",
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
      // Simulate strategy execution
      await new Promise(resolve => setTimeout(resolve, 3000));

      const executed: ExecutedStrategy = {
        transactionHash: '9a8b7c6d5e4f3210fedcba9876543210abcdef123456789087654321fedcba98',
        allocations: strategy.allocations,
        totalAmount: strategy.profile.investmentAmount || 1000,
        estimatedApy: strategy.totalEstimatedApy
      };

      setExecutedStrategy(executed);
      setCurrentStep(FlowStep.SUCCESS);

    } catch (error) {
      console.error('Strategy execution failed:', error);
      setCurrentStep(FlowStep.STRATEGY_READY);
    }

    setIsLoading(false);
  };

  const resetFlow = () => {
    setCurrentStep(FlowStep.CONVERSATION);
    setMessages([{
      role: 'assistant',
      content: "💰 Ready to create another investment strategy? Tell me about your new investment goals!",
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
    setExecutedStrategy(null);
    setIsLoading(false);
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-readable mb-4">
            DeFi Investment Wizard
          </h1>
          <p className="text-readable-muted mb-8">
            Connect your wallet to start building personalized DeFi investment strategies
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
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <h1 className="hackmeridian-headline text-4xl font-bold text-readable">
              DEFI INVESTMENT WIZARD
            </h1>
            <NetworkToggle />
          </div>
          <p className="text-xl text-readable-muted">
            Build personalized investment strategies with AI guidance
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.CONVERSATION ? 'bg-primary text-primary-foreground' : 
              [FlowStep.STRATEGY_READY, FlowStep.RISK_WARNING, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Chat with Advisor
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.STRATEGY_READY ? 'bg-primary text-primary-foreground' : 
              [FlowStep.RISK_WARNING, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Review Strategy
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              [FlowStep.RISK_WARNING, FlowStep.SIGNING].includes(currentStep) ? 'bg-primary text-primary-foreground' : 
              currentStep === FlowStep.SUCCESS ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Execute Strategy
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentStep === FlowStep.CONVERSATION && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Chat with Investment Advisor
                </CardTitle>
                <CardDescription>
                  Discuss your goals, risk tolerance, and preferred assets
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
                            <DollarSign className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium text-muted-foreground">
                              Investment Advisor
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
                          <DollarSign className="w-4 h-4 text-primary" />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            Advisor is analyzing...
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
                    placeholder="Tell me about your investment goals..."
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

            {/* Strategy Plan Sidebar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  Investment Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Network</label>
                  <p className="font-semibold">{network}</p>
                </div>

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
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === FlowStep.STRATEGY_READY && strategy.isComplete && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Investment Strategy Plan Ready
              </CardTitle>
              <CardDescription>
                Review your personalized DeFi allocation before execution
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
                  <p className="text-2xl font-bold text-green-600">{strategy.totalEstimatedApy.toFixed(2)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <p className="text-2xl font-bold">{strategy.totalRiskScore}/10</p>
                </div>
              </div>

              {/* Allocations */}
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

              {/* Warnings */}
              {strategy.warnings.length > 0 && (
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
                    <p className="font-semibold">{strategy.fees.dappFee}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Protocol Fees</p>
                    <p className="font-semibold">{strategy.fees.protocolFees}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gas Estimate</p>
                    <p className="font-semibold">${strategy.fees.gasEstimate}</p>
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
                    <span className="font-mono text-green-600">{strategy.totalEstimatedApy.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Risk Level:</span>
                    <span className="font-mono">{strategy.totalRiskScore}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network:</span>
                    <span className="font-mono">{strategy.network}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentStep(FlowStep.STRATEGY_READY)} variant="outline" className="flex-1">
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

        {currentStep === FlowStep.SIGNING && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Executing Investment Strategy</h3>
              <p className="text-muted-foreground mb-4">
                Please sign the transactions in your Freighter wallet...
              </p>
              <Badge variant="outline">Connected: {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}</Badge>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.SUCCESS && executedStrategy && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Strategy Executed Successfully!</h3>
              <p className="text-muted-foreground mb-8">
                Your investment strategy has been deployed to DeFindex protocols on Stellar {network}
              </p>
              
              <div className="space-y-4 text-left bg-muted/50 rounded-lg p-6 mb-8">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction Hash</label>
                  <p className="font-mono text-sm break-all">{executedStrategy.transactionHash}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Invested</label>
                    <p className="font-semibold">${executedStrategy.totalAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Estimated APY</label>
                    <p className="font-semibold text-green-600">{executedStrategy.estimatedApy.toFixed(2)}%</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Active Positions</label>
                  <p className="font-semibold">{executedStrategy.allocations.length} protocols</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  asChild
                  className="flex-1"
                >
                  <a 
                    href={getExplorerUrl('tx', executedStrategy.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Explorer
                  </a>
                </Button>
                <Button onClick={resetFlow} className="flex-1">
                  Create New Strategy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DeFiStrategist;