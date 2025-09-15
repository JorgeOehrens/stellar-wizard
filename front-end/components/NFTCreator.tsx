'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useWallet } from '../app/providers/WalletProvider';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Loader2, Sparkles, CheckCircle, ExternalLink, Wand2 } from 'lucide-react';
import Image from 'next/image';

enum FlowStep {
  PROMPT = 'prompt',
  CLARIFYING = 'clarifying',
  PROCESSING = 'processing', 
  TRANSACTION_PLAN = 'transaction-plan',
  SIGNING = 'signing',
  SUCCESS = 'success'
}

interface NFTCollection {
  name: string;
  count: number;
  description: string;
  imageStyle?: string;
  contractAddress?: string;
  transactionHash?: string;
}

interface WizardQuestion {
  id: string;
  question: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  required: boolean;
}

const NFTCreator: React.FC = () => {
  const { isConnected, publicKey } = useWallet();
  const [currentStep, setCurrentStep] = useState<FlowStep>(FlowStep.PROMPT);
  const [prompt, setPrompt] = useState('');
  const [collection, setCollection] = useState<NFTCollection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wizardQuestions, setWizardQuestions] = useState<WizardQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setCurrentStep(FlowStep.PROCESSING);

    // Simulate AI analyzing the prompt
    setTimeout(() => {
      // Check if prompt is vague and needs clarification
      const isVague = !prompt.toLowerCase().includes('collection') || 
                     !prompt.toLowerCase().match(/\d+/) || 
                     prompt.length < 50;

      if (isVague) {
        // Generate wizard questions for clarification
        const questions: WizardQuestion[] = [
          {
            id: 'collectionName',
            question: 'Greetings! 🧙‍♂️ I see you want to create NFTs, but I need more details. What shall we name your collection?',
            type: 'text',
            required: true
          },
          {
            id: 'nftCount',
            question: 'How many NFTs should I conjure in this collection?',
            type: 'number',
            required: true
          },
          {
            id: 'imageStyle',
            question: 'What magical style should these NFTs embody?',
            type: 'select',
            options: ['Abstract Art', 'Digital Photography', 'Pixel Art', '3D Renders', 'Hand-drawn Illustrations', 'AI-Generated Art'],
            required: true
          },
          {
            id: 'theme',
            question: 'Tell me more about the theme or concept for your collection:',
            type: 'text',
            required: true
          }
        ];
        setWizardQuestions(questions);
        setCurrentStep(FlowStep.CLARIFYING);
      } else {
        // Extract info from detailed prompt
        const mockCollection: NFTCollection = {
          name: "Edu Rio Edition",
          count: 100,
          description: "Educational NFT collection inspired by Rio de Janeiro's vibrant culture and landmarks",
          imageStyle: "Digital Photography"
        };
        setCollection(mockCollection);
        setCurrentStep(FlowStep.TRANSACTION_PLAN);
      }
      setIsLoading(false);
    }, 2000);
  };

  const handleQuestionAnswer = (questionId: string, answer: string) => {
    setQuestionAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleClarificationComplete = () => {
    setIsLoading(true);
    setCurrentStep(FlowStep.PROCESSING);

    setTimeout(() => {
      // Create collection from answers
      const mockCollection: NFTCollection = {
        name: questionAnswers.collectionName || "Untitled Collection",
        count: parseInt(questionAnswers.nftCount) || 100,
        description: questionAnswers.theme || "A unique NFT collection",
        imageStyle: questionAnswers.imageStyle || "Abstract Art"
      };
      
      setCollection(mockCollection);
      setCurrentStep(FlowStep.TRANSACTION_PLAN);
      setIsLoading(false);
    }, 1500);
  };

  const handleSignTransaction = async () => {
    setIsLoading(true);
    setCurrentStep(FlowStep.SIGNING);

    // Simulate transaction signing and deployment
    setTimeout(() => {
      setCollection(prev => prev ? {
        ...prev,
        contractAddress: 'CA7QYNF7JWCXVS5456KQEQ3XQWXCQXVTLWGUJ5FJZTVLD6OGZVSB2LLY',
        transactionHash: '5a1b2c3d4e5f6789abcdef1234567890fedcba9876543210abcdef123456789'
      } : null);
      setCurrentStep(FlowStep.SUCCESS);
      setIsLoading(false);
    }, 3000);
  };

  const resetFlow = () => {
    setCurrentStep(FlowStep.PROMPT);
    setPrompt('');
    setCollection(null);
    setIsLoading(false);
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-readable mb-4">
            Create NFTs from Prompts
          </h1>
          <p className="text-readable-muted mb-8">
            Connect your wallet to start creating NFT collections using natural language
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
          <h1 className="hackmeridian-headline text-4xl font-bold text-readable mb-4">
            CREATE NFTS FROM PROMPTS
          </h1>
          <p className="text-xl text-readable-muted">
            Describe your NFT collection and watch it deploy to Stellar
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.PROMPT ? 'bg-primary text-primary-foreground' : 
              [FlowStep.PROCESSING, FlowStep.TRANSACTION_PLAN, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Write Intent
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              [FlowStep.PROCESSING, FlowStep.TRANSACTION_PLAN].includes(currentStep) ? 'bg-primary text-primary-foreground' : 
              [FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
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
              Sign & Deploy
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentStep === FlowStep.PROMPT && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Describe Your NFT Collection
              </CardTitle>
              <CardDescription>
                Use natural language to describe what you want to create
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Textarea
                placeholder="Example: Create a collection of 100 NFTs called 'Edu Rio Edition' featuring educational content about Rio de Janeiro's landmarks and culture..."
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
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create NFT Collection
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
              <h3 className="text-lg font-semibold mb-2">🧙‍♂️ The Wizard is Analyzing Your Request</h3>
              <p className="text-muted-foreground">
                Parsing your magical intent and preparing the spell...
              </p>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.CLARIFYING && (
          <div className="max-w-2xl mx-auto space-y-6">
            {wizardQuestions.map((question, index) => (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <Image
                      src="/wizzard.svg"
                      alt="Wizard"
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                    Wizard Question {index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="wizard-text">{question.question}</p>
                  
                  {question.type === 'text' && (
                    <Input
                      placeholder="Enter your answer..."
                      value={questionAnswers[question.id] || ''}
                      onChange={(e) => handleQuestionAnswer(question.id, e.target.value)}
                      className="w-full"
                    />
                  )}
                  
                  {question.type === 'number' && (
                    <Input
                      type="number"
                      placeholder="Enter a number..."
                      value={questionAnswers[question.id] || ''}
                      onChange={(e) => handleQuestionAnswer(question.id, e.target.value)}
                      className="w-full"
                    />
                  )}
                  
                  {question.type === 'select' && question.options && (
                    <Select 
                      value={questionAnswers[question.id] || ''} 
                      onValueChange={(value) => handleQuestionAnswer(question.id, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose an option..." />
                      </SelectTrigger>
                      <SelectContent>
                        {question.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>
            ))}
            
            <div className="flex justify-center">
              <Button
                onClick={handleClarificationComplete}
                disabled={wizardQuestions.some(q => q.required && !questionAnswers[q.id]) || isLoading}
                size="lg"
                className="px-8"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Casting Spell...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Continue the Magic ✨
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {currentStep === FlowStep.TRANSACTION_PLAN && collection && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Transaction Plan</CardTitle>
              <CardDescription>
                Review the parsed collection details before deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Collection Name</label>
                  <p className="text-lg font-semibold">{collection.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">NFT Count</label>
                  <p className="text-lg font-semibold">{collection.count} NFTs</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p>{collection.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Network</label>
                  <Badge variant="secondary">Stellar Testnet</Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={resetFlow} variant="outline" className="flex-1">
                  Modify Prompt
                </Button>
                <Button 
                  onClick={handleSignTransaction}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    'Sign & Deploy'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.SIGNING && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Deploying Contract</h3>
              <p className="text-muted-foreground mb-4">
                Please sign the transaction in your Freighter wallet...
              </p>
              <Badge variant="outline">Connected: {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}</Badge>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.SUCCESS && collection && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">NFT Collection Created!</h3>
              <p className="text-muted-foreground mb-8">
                Your "{collection.name}" collection has been successfully deployed to Stellar Testnet
              </p>
              
              <div className="space-y-4 text-left bg-muted/50 rounded-lg p-6 mb-8">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contract Address</label>
                  <p className="font-mono text-sm break-all">{collection.contractAddress}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction Hash</label>
                  <p className="font-mono text-sm break-all">{collection.transactionHash}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  asChild
                  className="flex-1"
                >
                  <a 
                    href={`https://stellar.expert/explorer/testnet/tx/${collection.transactionHash}`}
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

export default NFTCreator;