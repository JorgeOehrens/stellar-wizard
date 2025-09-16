'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useWallet } from '../providers/WalletProvider';
import { useNetwork } from '../providers/NetworkProvider';
import { Plus, ExternalLink, Image as ImageIcon, TrendingUp, Coins, Calendar, Hash, Send, Zap, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import Link from 'next/link';
import Image from 'next/image';
import TopNav from '../../components/TopNav';

interface NFTCreation {
  id: string;
  name: string;
  symbol?: string;
  supply: number;
  description?: string;
  royalties?: number;
  imageUrl?: string;
  network: 'TESTNET' | 'MAINNET';
  createdAt: string;
  txHash?: string;
  userAddress: string;
  plan: any;
}

interface FactoryNFTCollection {
  id: string;
  contractId: string;
  name: string;
  symbol: string;
  totalSupply: number;
  currentSupply: number;
  description: string;
  mediaUrl?: string;
  royaltiesPct: number;
  createdAt: string;
  creatorAddress: string;
  network: string;
  isCreator: boolean;
  canMint: boolean;
  nftsMinted: number;
  contractState: string;
}

interface StrategyCreation {
  id: string;
  title: string;
  type: 'blend' | 'soroswap' | 'defindex';
  allocations: any;
  network: 'TESTNET' | 'MAINNET';
  createdAt: string;
  txHash?: string;
  planId?: string;
  userAddress: string;
  plan: any;
}

const Dashboard: React.FC = () => {
  const { isConnected, publicKey } = useWallet();
  const { network, getExplorerUrl } = useNetwork();
  const [nftCreations, setNftCreations] = useState<NFTCreation[]>([]);
  const [strategyCreations, setStrategyCreations] = useState<StrategyCreation[]>([]);
  const [factoryCollections, setFactoryCollections] = useState<FactoryNFTCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<NFTCreation | StrategyCreation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<FactoryNFTCollection | null>(null);
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintAmount, setMintAmount] = useState('1');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferTokenId, setTransferTokenId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isConnected && publicKey) {
      loadCreations();
      loadFactoryCollections();
    }
  }, [isConnected, publicKey, network]);

  const loadCreations = async () => {
    try {
      setLoading(true);

      // Load NFT creations
      const nftResponse = await fetch(`/api/creations/list?type=nft&userAddress=${publicKey}`);
      if (nftResponse.ok) {
        const nftData = await nftResponse.json();
        setNftCreations(nftData.creations || []);
      }

      // Load Strategy creations
      const strategyResponse = await fetch(`/api/creations/list?type=strategy&userAddress=${publicKey}`);
      if (strategyResponse.ok) {
        const strategyData = await strategyResponse.json();
        setStrategyCreations(strategyData.creations || []);
      }
    } catch (error) {
      console.error('Failed to load creations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFactoryCollections = async () => {
    try {
      const response = await fetch(`/api/factory/nfts?userAddress=${publicKey}&network=${network.toLowerCase()}`);
      if (response.ok) {
        const data = await response.json();
        // setFactoryCollections(data.collections || []);
        console.log('Factory collections loaded:', data);
      }
    } catch (error) {
      console.error('Failed to load factory collections:', error);
    }
  };

  const loadStellarExpertNFTs = async () => {
    setLoading(true);
    try {
      const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';
      const response = await fetch(`/api/factory/nfts?userAddress=${publicKey}&network=${network.toLowerCase()}&contractId=${contractId}`);
      if (response.ok) {
        const data = await response.json();
        setFactoryCollections(data.collections || []);
        console.log('Stellar Expert NFTs loaded:', data);
        console.log('Stellar Expert URL:', data.stellarExpertUrl);
      }
    } catch (error) {
      console.error('Failed to load Stellar Expert NFTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!selectedCollection || !mintRecipient) return;

    try {
      setIsProcessing(true);
      const response = await fetch('/api/factory/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: selectedCollection.id,
          recipient: mintRecipient,
          amount: parseInt(mintAmount),
          userAddress: publicKey,
          network: network
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Mint transaction ready:', data.xdr);
        setMintDialogOpen(false);
        setMintRecipient('');
        setMintAmount('1');
        // Reload collections to update mint counts
        await loadFactoryCollections();
      }
    } catch (error) {
      console.error('Mint failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedCollection || !transferRecipient || !transferTokenId) return;

    try {
      setIsProcessing(true);
      const response = await fetch('/api/factory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedCollection.contractId,
          fromAddress: publicKey,
          toAddress: transferRecipient,
          tokenId: transferTokenId,
          network: network
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Transfer transaction ready:', data.xdr);
        setTransferDialogOpen(false);
        setTransferRecipient('');
        setTransferTokenId('');
      }
    } catch (error) {
      console.error('Transfer failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const openDetails = (item: NFTCreation | StrategyCreation) => {
    setSelectedItem(item);
    setDetailsOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isNFTCreation = (item: NFTCreation | StrategyCreation): item is NFTCreation => {
    return 'supply' in item;
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-readable mb-4">
            My Creations Dashboard
          </h1>
          <p className="text-readable-muted mb-8">
            Connect your wallet to view your NFT collections and DeFi strategies
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
      <TopNav />
      <div className="max-w-6xl mx-auto p-6 pt-24">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="hackmeridian-headline text-4xl font-bold text-readable mb-2">
            MY CREATIONS DASHBOARD
          </h1>
          <p className="text-xl text-readable-muted">
            Track your NFT collections and DeFi strategies
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Connected: {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)} | Network: {network}
          </p>
        </div>

        <Tabs defaultValue="nfts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            {/* <TabsTrigger value="factory-nfts" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Factory NFTs ({factoryCollections.length})
            </TabsTrigger> */}
            <TabsTrigger value="nfts" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              NFT Collections ({nftCreations.length})
            </TabsTrigger>
            <TabsTrigger value="strategies" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              DeFi Strategies ({strategyCreations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="factory-nfts" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-readable">Factory NFT Collections</h2>
              <div className="flex gap-2">
                <Button
                  onClick={loadStellarExpertNFTs}
                  variant="outline"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Load from Stellar Expert
                </Button>
                <Button asChild>
                  <Link href="/nfts">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Collection
                  </Link>
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-48 bg-muted rounded-t-lg" />
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : factoryCollections.length === 0 ? (
              <Card className="p-12 text-center">
                <CardContent>
                  <Zap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Factory Collections Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first NFT collection using the factory contract
                  </p>
                  <Button asChild>
                    <Link href="/nfts">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Collection
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {factoryCollections.map((collection) => (
                  <Card key={collection.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="h-48 bg-muted relative">
                      {collection.mediaUrl ? (
                        <Image
                          src={collection.mediaUrl}
                          alt={collection.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <ImageIcon className="w-16 h-16 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge variant={collection.network === 'mainnet' ? 'default' : 'secondary'}>
                          {collection.network.toUpperCase()}
                        </Badge>
                      </div>
                      {collection.isCreator && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="outline" className="bg-white/90 text-black">
                            Creator
                          </Badge>
                        </div>
                      )}
                      {collection.id.includes('stellar_expert') && (
                        <div className="absolute bottom-2 left-2">
                          <Badge variant="default" className="bg-blue-600 text-white">
                            Stellar Expert
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg truncate">{collection.name}</h3>
                        <Badge variant="outline" className="ml-2">{collection.symbol}</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <Coins className="w-3 h-3" />
                          Supply: {collection.nftsMinted}/{collection.totalSupply}
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-3 h-3" />
                          Royalties: {collection.royaltiesPct}%
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {formatDate(collection.createdAt)}
                        </div>
                        {collection.txHash && (
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3" />
                            <a
                              href={getExplorerUrl('tx', collection.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-xs"
                            >
                              View Transaction <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {collection.id.includes('stellar_expert') && (
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-3 h-3" />
                            <a
                              href={`https://stellar.expert/explorer/${network.toLowerCase()}/contract/${collection.contractId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                            >
                              View on Stellar Expert <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      {collection.isCreator && (
                        <div className="flex gap-2">
                          {collection.canMint && (
                            <Dialog open={mintDialogOpen && selectedCollection?.id === collection.id} onOpenChange={(open) => {
                              setMintDialogOpen(open);
                              if (open) setSelectedCollection(collection);
                            }}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="flex-1">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Mint
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Mint NFTs</DialogTitle>
                                  <DialogDescription>
                                    Mint new NFTs from {collection.name} collection
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="recipient">Recipient Address</Label>
                                    <Input
                                      id="recipient"
                                      value={mintRecipient}
                                      onChange={(e) => setMintRecipient(e.target.value)}
                                      placeholder="G..."
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="amount">Amount</Label>
                                    <Input
                                      id="amount"
                                      type="number"
                                      value={mintAmount}
                                      onChange={(e) => setMintAmount(e.target.value)}
                                      min="1"
                                      max={collection.totalSupply - collection.nftsMinted}
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-4">
                                    <Button
                                      onClick={() => setMintDialogOpen(false)}
                                      variant="outline"
                                      className="flex-1"
                                      disabled={isProcessing}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={handleMint}
                                      className="flex-1"
                                      disabled={isProcessing || !mintRecipient}
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                      ) : (
                                        <Zap className="w-4 h-4 mr-2" />
                                      )}
                                      Mint NFTs
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}

                          <Dialog open={transferDialogOpen && selectedCollection?.id === collection.id} onOpenChange={(open) => {
                            setTransferDialogOpen(open);
                            if (open) setSelectedCollection(collection);
                          }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="flex-1">
                                <Send className="w-3 h-3 mr-1" />
                                Send
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Transfer NFT</DialogTitle>
                                <DialogDescription>
                                  Send an NFT from {collection.name} collection
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="transfer-recipient">Recipient Address</Label>
                                  <Input
                                    id="transfer-recipient"
                                    value={transferRecipient}
                                    onChange={(e) => setTransferRecipient(e.target.value)}
                                    placeholder="G..."
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="token-id">Token ID</Label>
                                  <Input
                                    id="token-id"
                                    value={transferTokenId}
                                    onChange={(e) => setTransferTokenId(e.target.value)}
                                    placeholder="Token ID to transfer"
                                  />
                                </div>
                                <div className="flex gap-2 pt-4">
                                  <Button
                                    onClick={() => setTransferDialogOpen(false)}
                                    variant="outline"
                                    className="flex-1"
                                    disabled={isProcessing}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={handleTransfer}
                                    className="flex-1"
                                    disabled={isProcessing || !transferRecipient || !transferTokenId}
                                  >
                                    {isProcessing ? (
                                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                      <Send className="w-4 h-4 mr-2" />
                                    )}
                                    Transfer NFT
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="nfts" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-readable">NFT Collections</h2>
              <Button asChild>
                <Link href="/nfts">
                  <Plus className="w-4 h-4 mr-2" />
                  Create NFT Collection
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-48 bg-muted rounded-t-lg" />
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : nftCreations.length === 0 ? (
              <Card className="p-12 text-center">
                <CardContent>
                  <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No NFT Collections Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first NFT collection using our AI-powered wizard
                  </p>
                  <Button asChild>
                    <Link href="/nfts">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Collection
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nftCreations.map((nft) => (
                  <Card key={nft.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" 
                        onClick={() => openDetails(nft)}>
                    <div className="h-48 bg-muted relative">
                      {nft.imageUrl ? (
                        <Image
                          src={nft.imageUrl}
                          alt={nft.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <ImageIcon className="w-16 h-16 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge variant={nft.network === 'MAINNET' ? 'default' : 'secondary'}>
                          {nft.network}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg truncate">{nft.name}</h3>
                        {nft.symbol && (
                          <Badge variant="outline" className="ml-2">{nft.symbol}</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Coins className="w-3 h-3" />
                          Supply: {nft.supply.toLocaleString()} NFTs
                        </div>
                        {nft.royalties && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3 h-3" />
                            Royalties: {nft.royalties}%
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {formatDate(nft.createdAt)}
                        </div>
                        {nft.txHash && (
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3" />
                            <a
                              href={getExplorerUrl('tx', nft.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              View Transaction <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="strategies" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-readable">DeFi Strategies</h2>
              <Button asChild>
                <Link href="/defi">
                  <Plus className="w-4 h-4 mr-2" />
                  Create DeFi Strategy
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-muted rounded mb-2" />
                      <div className="h-3 bg-muted rounded w-3/4 mb-4" />
                      <div className="h-20 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : strategyCreations.length === 0 ? (
              <Card className="p-12 text-center">
                <CardContent>
                  <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No DeFi Strategies Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first DeFi strategy using our intelligent wizard
                  </p>
                  <Button asChild>
                    <Link href="/defi">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Strategy
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {strategyCreations.map((strategy) => (
                  <Card key={strategy.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => openDetails(strategy)}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{strategy.title}</CardTitle>
                          <CardDescription className="capitalize">{strategy.type} Strategy</CardDescription>
                        </div>
                        <Badge variant={strategy.network === 'MAINNET' ? 'default' : 'secondary'}>
                          {strategy.network}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {formatDate(strategy.createdAt)}
                        </div>
                        {strategy.txHash && (
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3" />
                            <a
                              href={getExplorerUrl('tx', strategy.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              View Transaction <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {strategy.planId && (
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3" />
                            Plan ID: {strategy.planId.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedItem && isNFTCreation(selectedItem) ? 'NFT Collection Details' : 'DeFi Strategy Details'}
              </DialogTitle>
              <DialogDescription>
                Complete details and plan information
              </DialogDescription>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name/Title</label>
                    <p className="font-semibold">
                      {isNFTCreation(selectedItem) ? selectedItem.name : selectedItem.title}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Network</label>
                    <p><Badge variant={selectedItem.network === 'MAINNET' ? 'default' : 'secondary'}>
                      {selectedItem.network}
                    </Badge></p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p>{formatDate(selectedItem.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Transaction</label>
                    {selectedItem.txHash ? (
                      <a
                        href={getExplorerUrl('tx', selectedItem.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        View on Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No transaction</p>
                    )}
                  </div>
                </div>

                {isNFTCreation(selectedItem) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold">NFT Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedItem.symbol && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Symbol</label>
                          <p>{selectedItem.symbol}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Supply</label>
                        <p>{selectedItem.supply.toLocaleString()} NFTs</p>
                      </div>
                      {selectedItem.royalties && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Royalties</label>
                          <p>{selectedItem.royalties}%</p>
                        </div>
                      )}
                    </div>
                    {selectedItem.description && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Description</label>
                        <p>{selectedItem.description}</p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">Full Plan JSON</h4>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedItem.plan, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;