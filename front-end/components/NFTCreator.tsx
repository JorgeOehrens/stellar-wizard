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

enum FlowPhase {
  COLLECTING = 'collecting',
  IMAGE_GENERATION = 'image-generation',
  CONFIRMING = 'confirming',
  CLI_COMMANDS = 'cli-commands',
  MINTING = 'minting',
  DONE = 'done'
}

type CollectState = {
  awaitingField?: "collectionName" | "totalSupply" | "mediaUrlOrPrompt" | "royaltiesPct" | "airdrop" | "network";
  missing: string[];
  inFlight: boolean;
  lastNudgeKey?: string;
  nudgeCountForField: Record<string, number>;
};

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
  // Confirmation tracking
  pendingConfirmation?: {
    field: 'collectionName' | 'symbol' | 'totalSupply' | 'mediaUrl' | 'mediaPrompt' | 'description' | 'royaltiesPct' | 'airdrop';
    value: any;
    question: string;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;

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
  const { network, getExplorerUrl, getNetworkPassphrase } = useNetwork();
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>(FlowPhase.COLLECTING);
  const [collectState, setCollectState] = useState<CollectState>({
    missing: ['collectionName', 'symbol', 'totalSupply', 'mediaUrlOrPrompt'],
    inFlight: false,
    nudgeCountForField: {}
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "🧙‍♂️ **Welcome, fellow creator!**\\n\\nI'm the Stellar NFT Wizard, here to help you bring your digital collection to life on the Stellar blockchain.\\n\\n✨ **What I can help you with:**\\n- Create NFT collections with custom names and symbols\\n- Generate stunning AI artwork for your NFTs\\n- Set up royalties and airdrops\\n- Deploy everything to Stellar's network\\n\\n💬 **Would you like to start by naming your NFT collection, or do you have a question first?**\\n\\nFeel free to ask questions or jump right in!",

      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const nudgeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conversationId] = useState(`conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [lastMessageRole, setLastMessageRole] = useState<'user' | 'assistant'>('assistant');

  const [nftPlan, setNftPlan] = useState<NFTPlan>({
    network: 'TESTNET',
    isComplete: false,
    needsInfo: ['collectionName', 'symbol', 'totalSupply', 'mediaUrl']
  });
  const [finalCollection, setFinalCollection] = useState<NFTCollection | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [cliCommands, setCliCommands] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Removed auto-nudge system - let users respond naturally
  useEffect(() => {
    return () => clearNudgeTimeout();
  }, []);

  useEffect(() => {
    // Initialize image prompt from plan when entering image generation
    if (currentPhase === FlowPhase.IMAGE_GENERATION && nftPlan.mediaPrompt && !imagePrompt) {
      setImagePrompt(nftPlan.mediaPrompt);
      // Auto-generate image if we have a prompt
      generateImage(nftPlan.mediaPrompt);
    }
  }, [currentPhase, nftPlan.mediaPrompt, imagePrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearNudgeTimeout = () => {
    if (nudgeRef.current) {
      clearTimeout(nudgeRef.current);
      nudgeRef.current = null;
    }
  };

  const computeMissing = (plan: NFTPlan): string[] => {
    const missing: string[] = [];
    
    if (!plan.collectionName) missing.push('collectionName');
    if (!plan.symbol) missing.push('symbol');
    if (!plan.totalSupply) missing.push('totalSupply');
    if (!plan.mediaUrl && !plan.mediaPrompt) missing.push('mediaUrlOrPrompt');
    
    return missing;
  };

  const isPlanComplete = (plan: NFTPlan): boolean => {
    return !!(plan.collectionName && plan.symbol && plan.totalSupply && (plan.mediaUrl || plan.mediaPrompt));
  };

  const generateCliCommands = (plan: NFTPlan): string[] => {
    const commands: string[] = [];
    
    // Use the deployed Factory/Registry contract
    const factoryContractId = 'CD3W76OGYGHT4X5TMNUXWGEEVUBES67D3ZU4BALSW3BO23IMPT6E662A';
    
    // Determine recipient wallet
    const recipientWallet = plan.airdrop?.recipient || publicKey || 'G...USER_PUBLIC_KEY';
    const amount = plan.totalSupply || 1;
    
    // Step 1: Create collection via factory
    const createCollectionCommand = `# Step 1: Create NFT collection via Factory
stellar contract invoke \\
  --id ${factoryContractId} \\
  --source deployer \\
  --network testnet \\
  -- create_collection \\
  --creator G...YOUR_ADDRESS \\
  --name "${plan.collectionName}" \\
  --symbol "${plan.symbol}" \\
  --uri_base "${plan.mediaUrl || 'https://example.com/metadata/'}" \\
  --royalties ${(plan.royaltiesPct || 0) * 100}`;
    
    // commands.push(createCollectionCommand);
    
    // Step 2: Mint NFTs using the returned collection ID
    const mintCommand = `# Step 2: Mint NFTs (replace <collection_id> with ID from step 1)
stellar contract invoke \\
  --id ${factoryContractId} \\
  --source deployer \\
  --network testnet \\
  -- mint \\
  --collection_id <collection_id> \\
  --to ${recipientWallet} \\
  --amount ${amount}`;
    
    // commands.push(mintCommand);
    
    // Alternative using the convenience script
    const scriptCommand = `# Alternative: Use convenience scripts
./scripts/create-collection.sh "${plan.collectionName}" "${plan.symbol}" "${plan.mediaUrl || 'https://example.com/metadata/'}" ${(plan.royaltiesPct || 0) * 100}
./scripts/mint-from-factory.sh <collection_id> ${recipientWallet} ${amount}`;
    
    // commands.push(scriptCommand);
    
    return commands;
  };

  const getAwaitingField = (missing: string[]): "collectionName" | "totalSupply" | "mediaUrlOrPrompt" | "royaltiesPct" | "airdrop" | "network" | undefined => {
    if (missing.includes('collectionName')) return 'collectionName';
    if (missing.includes('symbol')) return 'collectionName'; // Map symbol to collectionName for simplicity
    if (missing.includes('totalSupply')) return 'totalSupply';
    if (missing.includes('mediaUrlOrPrompt')) return 'mediaUrlOrPrompt';
    return undefined;
  };

  // Remove old startInactivityTimeout function - replaced by scheduleNudge

  // Removed automatic follow-up system

  // Removed nudge scheduling system

  const sendMessage = async () => {
    if (!currentMessage.trim() || collectState.inFlight || isLoading) return;
    
    // Prevent sending messages when not in collecting phase
    if (currentPhase !== FlowPhase.COLLECTING) return;

    clearNudgeTimeout();
    setCollectState(prev => ({ ...prev, inFlight: true }));

    const userMessage: Message = {
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setLastMessageRole('user');

    try {
      const response = await fetch('/api/ai/nft-wizard', {
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
          network,
          conversationId
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
      setLastMessageRole('assistant');
      
      if (data.plan) {
        setNftPlan(data.plan);
        const missing = computeMissing(data.plan);
        const awaitingField = getAwaitingField(missing);
        
        setCollectState(prev => ({
          ...prev,
          missing,
          awaitingField
        }));
      }

      // Handle different response types and phase transitions
      if (data.plan) {
        const plan = data.plan;
        
        // Check if plan is complete (all required fields collected)
        const planIsComplete = isPlanComplete(plan);
        
        if (planIsComplete && !plan.pendingConfirmation && currentPhase === FlowPhase.COLLECTING) {
          // Plan is complete, transition to next phase
          if (plan.mediaPrompt && !plan.mediaUrl) {
            // Need to generate image first
            setCurrentPhase(FlowPhase.IMAGE_GENERATION);
          } else {
            // Ready for confirmation
            setCurrentPhase(FlowPhase.CONFIRMING);
          }
          
          // Add completion message when moving to next phase
          const completionMessage: Message = {
            role: 'assistant',
            content: "✅ **Perfect! Your NFT collection plan is complete.**\\n\\nLet's move to the next step.",
            timestamp: new Date()
          };
          setMessages(prev => [...prev, completionMessage]);
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '⚠️ **I encountered a technical hiccup.**\\n\\nCould you please try sending your message again?',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setLastMessageRole('assistant');
    }

    setIsLoading(false);
    setCollectState(prev => ({ ...prev, inFlight: false }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const modifyPlan = () => {
    clearNudgeTimeout();
    setCurrentPhase(FlowPhase.COLLECTING);
    const modifyMessage: Message = {
      role: 'assistant',
      content: "🔧 **What would you like to change about your NFT collection plan?**\\n\\nI can help you modify any aspect of it.",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, modifyMessage]);
    setLastMessageRole('assistant');
    
    // Reset collect state
    const missing = computeMissing(nftPlan);
    setCollectState({
      missing,
      awaitingField: getAwaitingField(missing),
      inFlight: false,
      nudgeCountForField: {},
      lastNudgeKey: undefined
    });
  };

  const handleQuickCreateNFT = async () => {
    if (isMinting) return;

    // Check if mainnet is selected but not supported yet
    if (network === 'MAINNET') {
      const warningMessage: Message = {
        role: 'assistant',
        content: "⚠️ **MAINNET not yet supported**\\n\\nThe Factory contract is not yet deployed on MAINNET. Please switch to TESTNET to create NFT collections.\\n\\nYou can switch networks using the toggle in the top-right corner.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, warningMessage]);
      return;
    }

    // Set default NFT plan values
    const defaultPlan: NFTPlan = {
      collectionName: "Quick Test Collection",
      symbol: "QUICK",
      totalSupply: 100,
      description: "Test NFT collection created with one click",
      royaltiesPct: 2.5,
      mediaUrl: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=500",
      network: network as 'TESTNET' | 'MAINNET',
      isComplete: true,
      needsInfo: []
    };

    setNftPlan(defaultPlan);

    // Add a quick message to chat
    const quickMessage: Message = {
      role: 'assistant',
      content: "🚀 **Quick NFT created with default settings!**\\n\\nYou can now sign the transaction to mint your test collection.",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, quickMessage]);

    // Move directly to minting phase
    setCurrentPhase(FlowPhase.MINTING);

    // Call the existing transaction handler
    return handleSignTransaction();

  };

  const handleSignTransaction = async () => {
    if (!nftPlan.collectionName || !nftPlan.totalSupply || !nftPlan.mediaUrl || isMinting) return;

    clearNudgeTimeout();
    setIsMinting(true);
    setCurrentPhase(FlowPhase.MINTING);

    try {
      console.log('Starting NFT collection creation:', JSON.stringify({
          collectionName: nftPlan.collectionName,
          symbol: nftPlan.symbol,
          totalSupply: nftPlan.totalSupply,
          description: nftPlan.description,
          royaltiesPct: 250, // Test value: 2.5% royalties (valid range 0-10000)
          mediaUrl: nftPlan.mediaUrl,
          airdrop: nftPlan.airdrop,
          network,
          userAddress: publicKey
        }));
      // Step 1: Create collection via factory
      const createResponse = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionName: nftPlan.collectionName,
          symbol: nftPlan.symbol,
          totalSupply: nftPlan.totalSupply,
          description: nftPlan.description,
          royaltiesPct: 250, // Test value: 2.5% royalties (valid range 0-10000)
          mediaUrl: nftPlan.mediaUrl,
          airdrop: nftPlan.airdrop,
          network,
          userAddress: publicKey
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to build collection creation transaction: ${createResponse.statusText}`);
      }

      const {
        success,
        xdr: preparedXdr,
        simulation,
        network: stellarNetwork,
        factoryContract,
        airdrop
      } = await createResponse.json();

      if (!success) {
        throw new Error('Failed to build collection creation transaction');
      }

      console.log('Transaction built successfully:', {
        factoryContract,
        hasAirdrop: !!airdrop,
        simulationSuccess: simulation.success
      });

      // Step 2: Sign and submit the collection creation transaction
      const networkPassphrase = getNetworkPassphrase();

      const signedTx = await signTransaction(preparedXdr, {
        networkPassphrase: networkPassphrase
      });

      if (!signedTx) {
        throw new Error('User cancelled transaction signing');
      }

      // Submit the signed transaction
      const submitResponse = await fetch('/api/stellar/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedXdr: signedTx,
          network: stellarNetwork
        })
      });

      const submitResult = await submitResponse.json();
      if (!submitResult.success) {
        throw new Error(`Transaction failed: ${submitResult.error}`);
      }

      const hash = submitResult.hash;
      console.log('Collection created successfully:', hash);

      // Log warning if present
      if (submitResult.warning) {
        console.log('Transaction warning:', submitResult.warning);
      }

      // Step 3: Handle airdrop if specified
      let airdropResults = [];
      if (airdrop && airdrop.needsMintAfterCreation) {
        console.log(`Processing airdrop for ${airdrop.recipient}`);

        // Wait for collection creation to be confirmed (simplified for demo)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get the collection ID from the transaction result
        // In a real implementation, you'd parse this from the transaction result
        const collectionId = Math.floor(Math.random() * 1000) + 1; // Mock for now

        // Build mint transaction
        const mintResponse = await fetch('/api/factory/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collectionId,
            recipient: airdrop.recipient,
            amount: airdrop.amount,
            userAddress: publicKey,
            network: stellarNetwork
          })
        });

        const mintData = await mintResponse.json();
        if (mintData.success) {
          const signedMintTx = await signTransaction(mintData.mintXdr, {
            networkPassphrase: networkPassphrase
          });
          if (signedMintTx) {
            const mintSubmitResponse = await fetch('/api/stellar/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signedXdr: signedMintTx,
                network: stellarNetwork
              })
            });

            const mintSubmitResult = await mintSubmitResponse.json();
            if (mintSubmitResult.success) {
              airdropResults.push({
                recipient: airdrop.recipient,
                amount: airdrop.amount,
                hash: mintSubmitResult.hash
              });
            }
          }
        }
      }

      const newCollection: NFTCollection = {
        name: nftPlan.collectionName,
        count: nftPlan.totalSupply,
        description: nftPlan.description,
        royaltyPercentage: nftPlan.royaltiesPct,
        mediaUrl: nftPlan.mediaUrl,
        airdropAddress: nftPlan.airdrop?.recipient,
        contractAddress: factoryContract,
        transactionHash: hash
      };

      // Save the creation to our database
      try {
        await fetch('/api/creations/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nft',
            userAddress: publicKey,
            network,
            plan: nftPlan,
            txHash: hash,
            name: nftPlan.collectionName,
            symbol: nftPlan.symbol,
            supply: nftPlan.totalSupply,
            description: nftPlan.description,
            royalties: nftPlan.royaltiesPct,
            imageUrl: nftPlan.mediaUrl
          })
        });
      } catch (saveError) {
        console.error('Failed to save creation:', saveError);
        // Don't fail the whole flow if saving fails
      }

      setFinalCollection(newCollection);
      setCurrentPhase(FlowPhase.DONE);
      
      // Add success message to chat
      const successMessage: Message = {
        role: 'assistant',
        content: `🎉 **Your NFT collection has been created successfully!**\\n\\n📋 **Transaction Hash:** ${hash}\\n🔗 **Factory Contract:** ${factoryContract}\\n${airdropResults.length > 0 ? `\\n🎁 **Airdrops:** ${airdropResults.length} successful airdrops to specified recipients\\n` : ''}\\n✨ Your "${nftPlan.collectionName}" collection is now live on Stellar ${stellarNetwork}!`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);


    } catch (error) {
      console.error('Transaction failed:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      

      // Log error to API if available
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: 'minting',
            error: errorMessage,
            planId: `${nftPlan.collectionName}-${Date.now()}`,
            errorDetails: error

          })
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      // Provide specific error messages based on common issues
      let userErrorMessage = '';
      if (errorMessage.includes('Wallet not connected')) {
        userErrorMessage = `⚠️ **Wallet Connection Error**\\n\\nYour wallet is not properly connected. Please reconnect your wallet and try again.`;
      } else if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
        userErrorMessage = `⚠️ **Transaction Cancelled**\\n\\nYou cancelled the transaction in your wallet. Click "Yes - Mint NFTs" to try again.`;
      } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        userErrorMessage = `⚠️ **Insufficient Balance**\\n\\nYou don't have enough XLM to pay for transaction fees. Please add XLM to your wallet and try again.`;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        userErrorMessage = `⚠️ **Network Error**\\n\\nNetwork connection issue. Please check your internet connection and try again.`;
      } else {
        userErrorMessage = `⚠️ **Transaction Error**\\n\\n${errorMessage}\\n\\n**Solutions:**\\n- Check your wallet connection\\n- Ensure you have enough XLM for fees\\n- Try using the CLI commands instead`;
      }

      const assistantErrorMessage: Message = {
        role: 'assistant',
        content: `${userErrorMessage}\\n\\n💡 **Alternative:** You can use the CLI commands shown in the previous step to mint directly via Stellar CLI.\\n\\nYour plan is saved - just click "Yes - Mint NFTs" to retry the UI mint.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantErrorMessage]);
      setCurrentPhase(FlowPhase.CLI_COMMANDS); // Go back to CLI commands page to show alternative

    }

    setIsMinting(false);
  };

  const generateImage = async (prompt: string) => {
    if (!prompt || prompt.trim().length < 5) {
      const errorMessage: Message = {
        role: 'assistant',
        content: "⚠️ **Please provide a more detailed description for your NFT image.**\\n\\nI need at least **5 characters** to create something amazing! 🎨",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }


    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/ai/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),

          size: "1024x1024"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);

      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);
      setImagePrompt(data.prompt || prompt); // Use cleaned prompt if available


    } catch (error) {
      console.error('Image generation failed:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `⚠️ **I had trouble generating that image:**\\n${error instanceof Error ? error.message : 'Unknown error'}\\n\\n🎨 **Try being more specific about what you want to see!**\\n\\n**Examples:**\\n- **A majestic dragon with golden scales**\\n- **A cute robot in a futuristic city**`,

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
      setCurrentPhase(FlowPhase.CONFIRMING);

    }
  };

  const regenerateImage = () => {
    if (imagePrompt) {
      generateImage(imagePrompt);
    }
  };

  const refineImage = () => {
    setGeneratedImage(null);
    // Add a helpful message
    const refineMessage: Message = {
      role: 'assistant',
      content: "✨ **Let's refine your image!**\\n\\nEdit the prompt below to describe exactly what you want to see, then generate a new image.",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, refineMessage]);
  };

  const resetFlow = () => {
    clearNudgeTimeout();
    setCurrentPhase(FlowPhase.COLLECTING);
    setMessages([{
      role: 'assistant',
      content: "🧙‍♂️ **Ready for another magical NFT creation?**\\n\\nLet's bring your next digital collection to life!\\n\\n✨ **What I can help you with:**\\n- Create NFT collections with custom names and symbols\\n- Generate stunning AI artwork for your NFTs\\n- Set up royalties and airdrops\\n- Deploy everything to Stellar's network\\n\\n💬 **Would you like to start by naming your NFT collection, or do you have a question first?**\\n\\nFeel free to ask questions or jump right in!",

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
    setCliCommands([]);
    setLastMessageRole('assistant');
    
    // Reset collect state
    setCollectState({
      missing: ['collectionName', 'symbol', 'totalSupply', 'mediaUrlOrPrompt'],
      awaitingField: 'collectionName',
      inFlight: false,
      nudgeCountForField: {},
      lastNudgeKey: undefined
    });

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
          <div className="mt-4">
            <Button
              onClick={handleQuickCreateNFT}
              disabled={isMinting || !isConnected}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-2"
            >
              {isMinting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating & Signing...
                </>
              ) : !isConnected ? (
                <>
                  🔗 Connect Wallet First
                </>
              ) : (
                <>
                  🚀 Quick Create & Sign NFT
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              {!isConnected
                ? "Connect your Stellar wallet to create and sign NFT transactions"
                : "Creates a test NFT collection with default settings and opens wallet for signing"
              }
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentPhase === FlowPhase.COLLECTING ? 'bg-primary text-primary-foreground' : 
              [FlowPhase.IMAGE_GENERATION, FlowPhase.CONFIRMING, FlowPhase.MINTING, FlowPhase.DONE].includes(currentPhase) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'

            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Chat with AI
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentPhase === FlowPhase.IMAGE_GENERATION ? 'bg-primary text-primary-foreground' : 
              [FlowPhase.CONFIRMING, FlowPhase.MINTING, FlowPhase.DONE].includes(currentPhase) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'

            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Generate Image
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentPhase === FlowPhase.CONFIRMING ? 'bg-primary text-primary-foreground' : 
              [FlowPhase.CLI_COMMANDS, FlowPhase.MINTING, FlowPhase.DONE].includes(currentPhase) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'

            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Review Plan
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentPhase === FlowPhase.CLI_COMMANDS ? 'bg-primary text-primary-foreground' : 
              [FlowPhase.MINTING, FlowPhase.DONE].includes(currentPhase) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">4</span>
              Sign
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              currentPhase === FlowPhase.MINTING ? 'bg-primary text-primary-foreground' : 
              currentPhase === FlowPhase.DONE ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">5</span>

              Deploy NFTs
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentPhase === FlowPhase.COLLECTING && (

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
                        <div className="text-sm whitespace-pre-wrap">
                          {message.content.split('\\n').map((line, i) => (
                            <div key={i} className={i > 0 ? 'mt-2' : ''}>
                              {line}
                            </div>
                          ))}
                        </div>

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
                    disabled={!currentMessage.trim() || isLoading || collectState.inFlight}
                    size="icon"
                    className="self-end"
                  >
                    {collectState.inFlight ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}

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

                {nftPlan.pendingConfirmation && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Pending Confirmation</label>
                    <Badge variant="secondary" className="w-full justify-center mt-1">
                      ⏳ Confirming {nftPlan.pendingConfirmation.field}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      "{nftPlan.pendingConfirmation.value}"
                    </p>
                  </div>
                )}

                {nftPlan.needsInfo.length > 0 && !nftPlan.pendingConfirmation && (

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

                {nftPlan.isComplete && !nftPlan.pendingConfirmation && (

                  <Badge className="w-full justify-center bg-green-500">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Plan Complete!
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentPhase === FlowPhase.IMAGE_GENERATION && (

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
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button onClick={regenerateImage} variant="outline" disabled={isGeneratingImage} className="flex-1">
                        {isGeneratingImage ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        Regenerate Same
                      </Button>
                      <Button onClick={refineImage} variant="outline" className="flex-1">
                        ✏️ Edit & Regenerate
                      </Button>
                    </div>
                    <Button onClick={acceptImage} className="w-full" size="lg">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept This Image
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      💡 Tip: You can regenerate or edit the prompt until you're happy with the result!
                    </p>

                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentPhase === FlowPhase.CONFIRMING && (

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                ✅ Here's your NFT plan. Do you confirm?
              </CardTitle>
              <CardDescription>
                Review all details carefully before proceeding to mint

              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
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
                    <label className="text-sm font-medium text-muted-foreground">Media</label>
                    <div className="mt-2">
                      <Image
                        src={nftPlan.mediaUrl}
                        alt="NFT Collection Media"
                        width={200}
                        height={200}
                        className="rounded-lg border object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{nftPlan.mediaUrl}</p>
                  </div>
                )}
                {nftPlan.mediaPrompt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Image Prompt</label>
                    <p className="text-sm italic">"{nftPlan.mediaPrompt}"</p>

                  </div>
                )}
                {nftPlan.airdrop?.recipient && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Airdrop</label>
                    <p className="text-sm font-mono break-all">{nftPlan.airdrop.recipient}</p>
                    {nftPlan.airdrop.amount && (
                      <p className="text-xs text-muted-foreground">{nftPlan.airdrop.amount} NFTs will be airdropped</p>

                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Network</label>
                  <Badge variant="secondary">Stellar {network}</Badge>
                </div>
              </div>
              
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Reply <strong>yes</strong> to mint, or <strong>no</strong> to adjust
                </p>
                <div className="flex gap-3">
                  <Button onClick={modifyPlan} variant="outline" className="flex-1">
                    No - Adjust Plan
                  </Button>
                  <Button 
                    onClick={() => {
                      // Generate CLI commands and move to CLI phase
                      const commands = generateCliCommands(nftPlan);
                      setCliCommands(commands);
                      setCurrentPhase(FlowPhase.CLI_COMMANDS);
                    }}
                    disabled={!nftPlan.mediaUrl && !nftPlan.mediaPrompt}
                    className="flex-1"
                  >
                    Yes - Show CLI Commands
                  </Button>

                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentPhase === FlowPhase.CLI_COMMANDS && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                ✅ Your NFT collection **{nftPlan.collectionName} ({nftPlan.symbol})** is ready!
              </CardTitle>
              <CardDescription>
                Run these Soroban CLI commands to mint your NFTs on TESTNET
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Collection Summary */}
              <div className="bg-muted/50 rounded-lg p-6 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">🔢 Total Supply</label>
                    <p className="text-lg font-semibold">{nftPlan.totalSupply} NFTs</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">👛 Recipient</label>
                    <p className="text-sm font-mono break-all">
                      {nftPlan.airdrop?.recipient || publicKey || 'G...USER_PUBLIC_KEY'}
                    </p>
                  </div>
                </div>
                {nftPlan.mediaUrl && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">🖼️ Media</label>
                    <p className="text-sm break-all text-muted-foreground">{nftPlan.mediaUrl}</p>
                  </div>
                )}
              </div>

              {/* CLI Commands */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  🚀 Ready-to-use CLI Commands
                </h3>
                
                {cliCommands.map((command, index) => (
                  <div key={index} className="space-y-2">
                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {command}
                      </pre>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(command)}
                      className="w-full"
                    >
                      📋 Copy Command
                    </Button>
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Instructions:</h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Make sure you have the Stellar CLI installed</li>
                  <li>Ensure your deployer account is configured</li>
                  <li>Copy and run the commands in your terminal</li>
                  <li>Your NFTs will be minted directly on Stellar TESTNET</li>
                </ol>
              </div>

              {/* Development Notice */}
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">🏭 Factory Pattern:</h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This system now uses a Factory/Registry pattern! The Factory contract deploys individual NFT collection contracts 
                  and handles fee routing. The CLI commands above show the new factory-based workflow.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  onClick={() => setCurrentPhase(FlowPhase.CONFIRMING)} 
                  variant="outline" 
                  className="flex-1"
                >
                  ← Back to Plan
                </Button>
                <Button 
                  onClick={handleSignTransaction}
                  disabled={isMinting}

                  className="flex-1"
                >
                  {isMinting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    </>
                  ) : (
                    'Or Mint via UI'

                  )}
                </Button>
                <Button onClick={resetFlow} variant="outline" className="flex-1">
                  Start New Collection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentPhase === FlowPhase.MINTING && (
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

        {currentPhase === FlowPhase.DONE && finalCollection && (

          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">🎉 Your NFT collection has been created!</h3>
              <p className="text-muted-foreground mb-8">
                <strong>"{finalCollection.name}"</strong> collection is now live on Stellar {network}

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
                {finalCollection.mediaUrl && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Collection Image</label>
                    <div className="mt-2">
                      <Image
                        src={finalCollection.mediaUrl}
                        alt="Collection Media"
                        width={150}
                        height={150}
                        className="rounded-lg border object-cover mx-auto"
                      />
                    </div>
                  </div>
                )}

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

              <div className="space-y-3">
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
                  <Button onClick={resetFlow} className="flex-1" size="lg">
                    Start a New Collection
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your collection is permanently stored on the Stellar blockchain!
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NFTCreator;