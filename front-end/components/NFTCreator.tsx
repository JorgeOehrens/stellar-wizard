'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useWallet } from '../app/providers/WalletProvider';
import { useNetwork } from '../app/providers/NetworkProvider';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Loader2, Sparkles, CheckCircle, ExternalLink, Wand2, MessageCircle, Send } from 'lucide-react';
import NetworkToggle from './ui/NetworkToggle';
import Image from 'next/image';

enum FlowStep {
  CONVERSATION = 'conversation',
  IMAGE_GENERATION = 'image-generation',
  PLAN_READY = 'plan-ready',
  SIGNING = 'signing',
  SUCCESS = 'success'
}

interface NFTPlan {
  collectionName?: string;
  symbol?: string;
  totalSupply?: number;
  description?: string;
  royaltiesPct?: number;
  mediaUrl?: string;
  mediaPrompt?: string;
  airdrop?: {
    recipient: string;
    amount?: number;
  } | null;
  network: 'TESTNET' | 'MAINNET';
  isComplete: boolean;
  needsInfo: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface NFTCollection {
  name: string;
  count: number;
  description?: string;
  royaltyPercentage?: number;
  mediaUrl?: string;
  airdropAddress?: string;
  contractAddress?: string;
  transactionHash?: string;
}

const NFTCreator: React.FC = () => {
  const { isConnected, publicKey, signTransaction } = useWallet();
  const { network, getExplorerUrl } = useNetwork();
  const [currentStep, setCurrentStep] = useState<FlowStep>(FlowStep.CONVERSATION);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "🧙‍♂️ Greetings! I'm the Stellar NFT Wizard. I'll help you create your NFT collection step by step. To get started, tell me about the NFT collection you'd like to create!",
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState<NodeJS.Timeout | null>(null);
  const [nftPlan, setNftPlan] = useState<NFTPlan>({
    network: 'TESTNET',
    isComplete: false,
    needsInfo: ['collectionName', 'symbol', 'totalSupply', 'mediaUrl']
  });
  const [finalCollection, setFinalCollection] = useState<NFTCollection | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentStep === FlowStep.CONVERSATION && !isLoading) {
      startInactivityTimeout();
    } else {
      clearInactivityTimeout();
    }

    return () => clearInactivityTimeout();
  }, [currentStep, isLoading]);

  useEffect(() => {
    // Initialize image prompt from plan when entering image generation
    if (currentStep === FlowStep.IMAGE_GENERATION && nftPlan.mediaPrompt && !imagePrompt) {
      setImagePrompt(nftPlan.mediaPrompt);
      // Auto-generate image if we have a prompt
      generateImage(nftPlan.mediaPrompt);
    }
  }, [currentStep, nftPlan.mediaPrompt, imagePrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearInactivityTimeout = () => {
    if (inactivityTimeout) {
      clearTimeout(inactivityTimeout);
      setInactivityTimeout(null);
    }
  };

  const startInactivityTimeout = () => {
    clearInactivityTimeout();
    const timeout = setTimeout(() => {
      if (currentStep === FlowStep.CONVERSATION && !isLoading) {
        const followUpMessage = getFollowUpMessage();
        if (followUpMessage) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: followUpMessage,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      }
    }, 3000);
    setInactivityTimeout(timeout);
  };

  const getFollowUpMessage = () => {
    if (nftPlan.needsInfo.includes('collectionName')) {
      return "What would you like to name your NFT collection?";
    }
    if (nftPlan.needsInfo.includes('totalSupply')) {
      return "How many NFTs should be minted? (1-10,000)";
    }
    if (nftPlan.needsInfo.includes('mediaUrl') && !nftPlan.mediaPrompt) {
      return "Do you have an image prompt or a direct media URL (IPFS) for this collection?";
    }
    if (nftPlan.needsInfo.includes('symbol')) {
      return "What symbol would you like for your collection? (3-12 characters, uppercase)";
    }
    return null;
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    clearInactivityTimeout();

    const userMessage: Message = {
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/nft-wizard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          currentPlan: nftPlan,
          network
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setNftPlan(data.plan);

      // Check if plan is complete and move to next step
      if (data.plan.isComplete && currentStep === FlowStep.CONVERSATION) {
        // If no mediaUrl but has mediaPrompt, go to image generation
        if (!data.plan.mediaUrl && data.plan.mediaPrompt) {
          setCurrentStep(FlowStep.IMAGE_GENERATION);
        } else {
          setCurrentStep(FlowStep.PLAN_READY);
        }
      } else {
        // Start inactivity timeout for incomplete plans
        startInactivityTimeout();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      startInactivityTimeout();
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const modifyPlan = () => {
    setCurrentStep(FlowStep.CONVERSATION);
    const modifyMessage: Message = {
      role: 'assistant',
      content: "What would you like to change about your NFT collection plan? I can help you modify any aspect of it.",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, modifyMessage]);
  };

  const handleSignTransaction = async () => {
    if (!nftPlan.collectionName || !nftPlan.totalSupply || !nftPlan.mediaUrl || isMinting) return;

    setIsMinting(true);
    setCurrentStep(FlowStep.SIGNING);

    try {
      // Step 1: Build transaction
      const mintResponse = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionName: nftPlan.collectionName,
          symbol: nftPlan.symbol,
          totalSupply: nftPlan.totalSupply,
          description: nftPlan.description,
          royaltiesPct: nftPlan.royaltiesPct,
          mediaUrl: nftPlan.mediaUrl,
          airdrop: nftPlan.airdrop,
          network
        }),
      });

      if (!mintResponse.ok) {
        throw new Error(`Failed to build transaction: ${mintResponse.statusText}`);
      }

      const { xdr } = await mintResponse.json();

      // Step 2: Sign transaction
      if (!signTransaction) {
        throw new Error('Wallet not properly connected');
      }

      const signedXdr = await signTransaction(xdr, { networkPassphrase: network === 'MAINNET' ? 'Public Global Stellar Network ; September 2015' : 'Test SDF Network ; September 2015' });

      // Step 3: Submit transaction
      const submitResponse = await fetch('/api/tx/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedXdr,
          network
        }),
      });

      if (!submitResponse.ok) {
        throw new Error(`Failed to submit transaction: ${submitResponse.statusText}`);
      }

      const { hash, explorerUrl } = await submitResponse.json();

      const newCollection: NFTCollection = {
        name: nftPlan.collectionName,
        count: nftPlan.totalSupply,
        description: nftPlan.description,
        royaltyPercentage: nftPlan.royaltiesPct,
        mediaUrl: nftPlan.mediaUrl,
        airdropAddress: nftPlan.airdrop?.recipient,
        contractAddress: 'CA7QYNF7JWCXVS5456KQEQ3XQWXCQXVTLWGUJ5FJZTVLD6OGZVSB2LLY',
        transactionHash: hash
      };

      setFinalCollection(newCollection);
      setCurrentStep(FlowStep.SUCCESS);

    } catch (error) {
      console.error('Transaction failed:', error);
      
      // Log error to API if available
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: 'minting',
            error: error instanceof Error ? error.message : 'Unknown error',
            planId: `${nftPlan.collectionName}-${Date.now()}`
          })
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      const errorMessage: Message = {
        role: 'assistant',
        content: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or modify your plan.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentStep(FlowStep.PLAN_READY);
    }

    setIsMinting(false);
  };

  const generateImage = async (prompt: string) => {
    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/ai/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          size: "1024x1024"
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);
      setImagePrompt(prompt);

    } catch (error) {
      console.error('Image generation failed:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}. Please try a different prompt.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsGeneratingImage(false);
  };

  const acceptImage = () => {
    if (generatedImage) {
      setNftPlan(prev => ({
        ...prev,
        mediaUrl: generatedImage,
        mediaPrompt: imagePrompt
      }));
      setCurrentStep(FlowStep.PLAN_READY);
    }
  };

  const regenerateImage = () => {
    if (imagePrompt) {
      generateImage(imagePrompt);
    }
  };

  const refineImage = () => {
    setGeneratedImage(null);
  };

  const resetFlow = () => {
    clearInactivityTimeout();
    setCurrentStep(FlowStep.CONVERSATION);
    setMessages([{
      role: 'assistant',
      content: "🧙‍♂️ Ready for another magical NFT creation? Tell me what you'd like to create!",
      timestamp: new Date()
    }]);
    setNftPlan({
      network,
      isComplete: false,
      needsInfo: ['collectionName', 'symbol', 'totalSupply', 'mediaUrl']
    });
    setFinalCollection(null);
    setIsLoading(false);
    setIsMinting(false);
    setGeneratedImage(null);
    setImagePrompt('');
    setIsGeneratingImage(false);
    startInactivityTimeout();
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
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <h1 className="hackmeridian-headline text-4xl font-bold text-readable">
              AI NFT CREATION WIZARD
            </h1>
            <NetworkToggle />
          </div>
          <p className="text-xl text-readable-muted">
            Chat with the wizard to create your perfect NFT collection
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.CONVERSATION ? 'bg-primary text-primary-foreground' : 
              [FlowStep.PLAN_READY, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Chat with AI
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.IMAGE_GENERATION ? 'bg-primary text-primary-foreground' : 
              [FlowStep.PLAN_READY, FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Generate Image
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.PLAN_READY ? 'bg-primary text-primary-foreground' : 
              [FlowStep.SIGNING, FlowStep.SUCCESS].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Review Plan
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentStep === FlowStep.SIGNING ? 'bg-primary text-primary-foreground' : 
              currentStep === FlowStep.SUCCESS ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">4</span>
              Deploy NFTs
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
                  Chat with the NFT Wizard
                </CardTitle>
                <CardDescription>
                  Describe your NFT collection and I'll help you create it step by step
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
                            <Image
                              src="/wizzard.svg"
                              alt="Wizard"
                              width={16}
                              height={16}
                              className="object-contain"
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              NFT Wizard
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
                          <Image
                            src="/wizzard.svg"
                            alt="Wizard"
                            width={16}
                            height={16}
                            className="object-contain"
                          />
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            Wizard is thinking...
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
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your NFT collection..."
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

            {/* Current Plan Sidebar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {nftPlan.collectionName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Collection Name</label>
                    <p className="font-semibold">{nftPlan.collectionName}</p>
                  </div>
                )}
                
                {nftPlan.symbol && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Symbol</label>
                    <p className="font-semibold">{nftPlan.symbol}</p>
                  </div>
                )}
                
                {nftPlan.totalSupply && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Supply</label>
                    <p className="font-semibold">{nftPlan.totalSupply} NFTs</p>
                  </div>
                )}
                
                {nftPlan.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="text-sm">{nftPlan.description}</p>
                  </div>
                )}
                
                {nftPlan.royaltiesPct !== undefined && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Royalties</label>
                    <p className="font-semibold">{nftPlan.royaltiesPct}%</p>
                  </div>
                )}
                
                {nftPlan.mediaUrl && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Media URL</label>
                    <p className="text-sm break-all">{nftPlan.mediaUrl}</p>
                  </div>
                )}
                
                {nftPlan.mediaPrompt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Image Prompt</label>
                    <p className="text-sm">{nftPlan.mediaPrompt}</p>
                  </div>
                )}
                
                {nftPlan.airdrop?.recipient && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Airdrop To</label>
                    <p className="text-sm font-mono break-all">{nftPlan.airdrop.recipient}</p>
                    {nftPlan.airdrop.amount && (
                      <p className="text-xs text-muted-foreground">{nftPlan.airdrop.amount} NFTs</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Network</label>
                  <p className="font-semibold">{network}</p>
                </div>

                {nftPlan.needsInfo.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Still Needed</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {nftPlan.needsInfo.map((info) => (
                        <Badge key={info} variant="outline" className="text-xs">
                          {info}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {nftPlan.isComplete && (
                  <Badge className="w-full justify-center bg-green-500">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Plan Complete!
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === FlowStep.IMAGE_GENERATION && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Image Generation
              </CardTitle>
              <CardDescription>
                Generate the perfect image for your NFT collection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!generatedImage ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Image Prompt</label>
                    <Textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="Describe the image you want to generate..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    onClick={() => generateImage(imagePrompt)}
                    disabled={!imagePrompt.trim() || isGeneratingImage}
                    className="w-full"
                  >
                    {isGeneratingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Image...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Image
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <Image
                      src={generatedImage}
                      alt="Generated NFT image"
                      width={512}
                      height={512}
                      className="rounded-lg mx-auto border"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Prompt Used</label>
                    <p className="text-sm mt-1">{imagePrompt}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={regenerateImage} variant="outline" disabled={isGeneratingImage}>
                      {isGeneratingImage ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Regenerate
                    </Button>
                    <Button onClick={refineImage} variant="outline">
                      Edit Prompt
                    </Button>
                    <Button onClick={acceptImage} className="flex-1">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept Image
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.PLAN_READY && nftPlan.isComplete && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                NFT Collection Plan Ready
              </CardTitle>
              <CardDescription>
                Review your collection details before minting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Collection Name</label>
                  <p className="text-lg font-semibold">{nftPlan.collectionName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Symbol</label>
                  <p className="text-lg font-semibold">{nftPlan.symbol}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Supply</label>
                  <p className="text-lg font-semibold">{nftPlan.totalSupply} NFTs</p>
                </div>
                {nftPlan.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p>{nftPlan.description}</p>
                  </div>
                )}
                {nftPlan.royaltiesPct !== undefined && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Royalties</label>
                    <p className="font-semibold">{nftPlan.royaltiesPct}%</p>
                  </div>
                )}
                {nftPlan.mediaUrl && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Media URL</label>
                    <p className="text-sm break-all">{nftPlan.mediaUrl}</p>
                  </div>
                )}
                {nftPlan.airdrop?.recipient && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Airdrop Address</label>
                    <p className="text-sm font-mono break-all">{nftPlan.airdrop.recipient}</p>
                    {nftPlan.airdrop.amount && (
                      <p className="text-xs text-muted-foreground">{nftPlan.airdrop.amount} NFTs</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Network</label>
                  <Badge variant="secondary">Stellar {network}</Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={modifyPlan} variant="outline" className="flex-1">
                  Modify Plan
                </Button>
                <Button 
                  onClick={handleSignTransaction}
                  disabled={isMinting || !nftPlan.mediaUrl}
                  className="flex-1"
                >
                  {isMinting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    'Mint NFTs'
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
              <h3 className="text-lg font-semibold mb-2">Minting NFT Collection</h3>
              <p className="text-muted-foreground mb-4">
                Please sign the transaction in your Freighter wallet...
              </p>
              <Badge variant="outline">Connected: {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}</Badge>
            </CardContent>
          </Card>
        )}

        {currentStep === FlowStep.SUCCESS && finalCollection && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">NFT Collection Created!</h3>
              <p className="text-muted-foreground mb-8">
                Your "{finalCollection.name}" collection has been successfully deployed to Stellar {network}
              </p>
              
              <div className="space-y-4 text-left bg-muted/50 rounded-lg p-6 mb-8">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Collection Name</label>
                  <p className="font-semibold">{finalCollection.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Supply</label>
                  <p className="font-semibold">{finalCollection.count} NFTs</p>
                </div>
                {finalCollection.airdropAddress && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Airdropped To</label>
                    <p className="font-mono text-sm break-all">{finalCollection.airdropAddress}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contract Address</label>
                  <p className="font-mono text-sm break-all">{finalCollection.contractAddress}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction Hash</label>
                  <p className="font-mono text-sm break-all">{finalCollection.transactionHash}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  asChild
                  className="flex-1"
                >
                  <a 
                    href={getExplorerUrl('tx', finalCollection.transactionHash!)}
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