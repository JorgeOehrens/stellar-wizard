'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useWallet } from '../app/providers/WalletProvider';
import { Textarea } from './ui/textarea';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

enum FlowStep {
  PROMPT = 'prompt',
  CLARIFYING = 'clarifying',
  PROCESSING = 'processing', 
  STRATEGY_PLAN = 'strategy-plan',
  RISK_WARNING = 'risk-warning',
  SIGNING = 'signing',
  SUCCESS = 'success'
}

interface DeFiStrategy {
  type: string;
  supplyAmount: number;
  borrowAmount: number;
  supplyAsset: string;
  borrowAsset: string;
  collateralRatio: number;
  estimatedAPY: number;
  liquidationPrice: number;
  transactionHash?: string;
}

const DeFiStrategist: React.FC = () => {
  const { isConnected, publicKey } = useWallet();
  const [currentStep, setCurrentStep] = useState<FlowStep>(FlowStep.PROMPT);
  const [prompt, setPrompt] = useState('');
  const [strategy, setStrategy] = useState<DeFiStrategy | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setCurrentStep(FlowStep.PROCESSING);

    // Simulate AI processing
    setTimeout(() => {
      // Mock parsing the prompt
      const mockStrategy: DeFiStrategy = {
        type: "Supply and Borrow",
        supplyAmount: 100,
        borrowAmount: 30,
        supplyAsset: "USDC",
        borrowAsset: "USDC",
        collateralRatio: 300,
        estimatedAPY: 8.5,
        liquidationPrice: 0.85
      };
      
      setStrategy(mockStrategy);
      setCurrentStep(FlowStep.STRATEGY_PLAN);
      setIsLoading(false);
    }, 2000);
  };

  const handleContinueToRisk = () => {
    setCurrentStep(FlowStep.RISK_WARNING);
  };

  const handleSignTransaction = async () => {
    setIsLoading(true);
    setCurrentStep(FlowStep.SIGNING);

    // Simulate transaction signing and execution
    setTimeout(() => {
      setStrategy(prev => prev ? {
        ...prev,
        transactionHash: '7f8e9d0c1b2a3456789abcdef0123456789fedcba9876543210abcdef1234567'
      } : null);
      setCurrentStep(FlowStep.SUCCESS);
      setIsLoading(false);
    }, 3000);
  };

  const resetFlow = () => {
    setCurrentStep(FlowStep.PROMPT);
    setPrompt('');
    setStrategy(null);
    setIsLoading(false);
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Create DeFi Strategies
          </h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to start creating DeFi strategies on Blend Protocol
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
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Create DeFi Strategies
          </h1>
          <p className="text-xl text-muted-foreground">
            Describe your DeFi strategy and execute it on Blend Protocol
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.PROMPT ? 'bg-primary text-primary-foreground' : 
              [FlowStep.PROCESSING, FlowStep.STRATEGY_PLAN, FlowStep.RISK_WARNING, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Write Intent
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              [FlowStep.PROCESSING, FlowStep.STRATEGY_PLAN].includes(currentStep) ? 'bg-primary text-primary-foreground' : 
              [FlowStep.RISK_WARNING, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              AI Processes
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              [FlowStep.SIGNING].includes(currentStep) ? 'bg-primary text-primary-foreground' : 
              currentStep === FlowStep.SUCCESS ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Execute Strategy
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentStep === FlowStep.PROMPT && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Describe Your DeFi Strategy
              </CardTitle>
              <CardDescription>
                Tell us what you want to do with your assets on Blend Protocol
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Textarea
                placeholder="Example: Supply 100 USDC and borrow 30 USDC with collateral. I want to earn yield while maintaining liquidity..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <Button 
                onClick={handlePromptSubmit}
                disabled={!prompt.trim() || isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Create DeFi Strategy
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.PROCESSING && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">AI is Analyzing Your Strategy</h3>
              <p className="text-muted-foreground">
                Parsing your request and calculating optimal parameters...
              </p>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.STRATEGY_PLAN && strategy && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Strategy Overview</CardTitle>
              <CardDescription>
                Review your DeFi strategy before execution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Strategy Type</label>
                  <p className="text-lg font-semibold">{strategy.type}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Protocol</label>
                  <Badge variant="secondary">Blend Protocol</Badge>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Supply Amount</label>
                  <p className="text-lg font-semibold">{strategy.supplyAmount} {strategy.supplyAsset}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Borrow Amount</label>
                  <p className="text-lg font-semibold">{strategy.borrowAmount} {strategy.borrowAsset}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Collateral Ratio</label>
                  <p className="text-lg font-semibold">{strategy.collateralRatio}%</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Estimated APY</label>
                  <p className="text-lg font-semibold text-green-500">{strategy.estimatedAPY}%</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button onClick={resetFlow} variant="outline" className="flex-1">
                  Modify Strategy
                </Button>
                <Button onClick={handleContinueToRisk} className="flex-1">
                  Continue to Risk Assessment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.RISK_WARNING && strategy && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Risk Assessment
              </CardTitle>
              <CardDescription>
                Please review the risks before proceeding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Liquidation Risk:</strong> Your position may be liquidated if the value of your collateral falls below {strategy.liquidationPrice} USD. Please ensure you monitor your position regularly.
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Market Risk:</strong> DeFi protocols are subject to market volatility and smart contract risks. Only invest what you can afford to lose.
                </AlertDescription>
              </Alert>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Key Risk Metrics</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Liquidation Price:</span>
                    <span className="font-mono">${strategy.liquidationPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Collateral Ratio:</span>
                    <span className="font-mono">{strategy.collateralRatio}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Collateral Ratio:</span>
                    <span className="font-mono">125%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentStep(FlowStep.STRATEGY_PLAN)} variant="outline" className="flex-1">
                  Back to Strategy
                </Button>
                <Button 
                  onClick={handleSignTransaction}
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
              <h3 className="text-lg font-semibold mb-2">Executing Strategy</h3>
              <p className="text-muted-foreground mb-4">
                Please sign the transaction in your Freighter wallet...
              </p>
              <Badge variant="outline">Connected: {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}</Badge>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.SUCCESS && strategy && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Strategy Executed!</h3>
              <p className="text-muted-foreground mb-8">
                Your DeFi strategy has been successfully executed on Blend Protocol
              </p>
              
              <div className="space-y-4 text-left bg-muted/50 rounded-lg p-6 mb-8">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction Hash</label>
                  <p className="font-mono text-sm break-all">{strategy.transactionHash}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Supplied</label>
                    <p className="font-semibold">{strategy.supplyAmount} {strategy.supplyAsset}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Borrowed</label>
                    <p className="font-semibold">{strategy.borrowAmount} {strategy.borrowAsset}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  asChild
                  className="flex-1"
                >
                  <a 
                    href={`https://stellar.expert/explorer/testnet/tx/${strategy.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Explorer
                  </a>
                </Button>
                <Button onClick={resetFlow} className="flex-1">
                  Create Another
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