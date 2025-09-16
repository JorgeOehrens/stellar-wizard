'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  X,
  Heart,
  User,
  Calendar,
  Hash,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Share
} from 'lucide-react';
import { useLike } from '@/hooks/useLike';
import { useNetwork } from '@/app/providers/NetworkProvider';
import { NFTMetadata } from './NFTCard';

interface NFTDetailModalProps {
  nft: NFTMetadata | null;
  isOpen: boolean;
  onClose: () => void;
}

const NFTDetailModal: React.FC<NFTDetailModalProps> = ({ nft, isOpen, onClose }) => {
  const { network } = useNetwork();
  const { totalLikes, likedByUser, toggle, isToggling } = useLike(nft?.id || '');
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen || !nft) return null;

  const shortenAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const getStellarExpertUrl = () => {
    const baseUrl = network.toLowerCase() === 'testnet'
      ? 'https://stellar.expert/explorer/testnet'
      : 'https://stellar.expert/explorer/public';
    return `${baseUrl}/contract/${nft.contractId}`;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: nft.name,
          text: `Check out this NFT: ${nft.name}`,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy URL to clipboard
      copyToClipboard(window.location.href, 'url');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-2xl font-bold">{nft.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="hidden sm:flex"
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Section */}
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800 rounded-lg">
                {!imageError ? (
                  <Image
                    src={nft.image}
                    alt={nft.name}
                    fill
                    className={`object-cover transition-opacity duration-300 ${
                      imageLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-400 to-pink-400">
                    <div className="text-center text-white">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-70" />
                      <p className="text-lg font-medium">{nft.name}</p>
                    </div>
                  </div>
                )}

                {/* Loading overlay */}
                {imageLoading && !imageError && (
                  <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={toggle}
                  disabled={isToggling}
                  className={`flex-1 ${
                    likedByUser
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Heart
                    className={`h-4 w-4 mr-2 ${
                      likedByUser ? 'fill-current' : ''
                    }`}
                  />
                  {likedByUser ? 'Unlike' : 'Like'} ({totalLikes})
                </Button>

                <Button
                  variant="outline"
                  onClick={() => window.open(getStellarExpertUrl(), '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Stellar Expert
                </Button>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-6">
              {/* Collection */}
              {nft.collectionName && (
                <div>
                  <Badge variant="secondary" className="text-sm">
                    {nft.collectionName}
                  </Badge>
                </div>
              )}

              {/* Description */}
              {nft.description && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {nft.description}
                  </p>
                </div>
              )}

              {/* Details */}
              <div className="space-y-4">
                <h3 className="font-semibold">Details</h3>

                <div className="grid grid-cols-1 gap-3">
                  {/* Token ID */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Token ID</span>
                    </div>
                    <span className="font-mono text-sm">{nft.tokenId}</span>
                  </div>

                  {/* Creator */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Creator</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{shortenAddress(nft.creator)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(nft.creator, 'creator')}
                        className="h-6 w-6 p-0"
                      >
                        {copied === 'creator' ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Contract */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Contract</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{shortenAddress(nft.contractId)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(nft.contractId, 'contract')}
                        className="h-6 w-6 p-0"
                      >
                        {copied === 'contract' ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Created</span>
                    </div>
                    <span className="text-sm">{formatDate(nft.createdAt)}</span>
                  </div>

                  {/* Network */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full" />
                      <span className="font-medium">Network</span>
                    </div>
                    <Badge variant="outline">
                      {network.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Royalties */}
                  {nft.royalties && nft.royalties > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <span className="font-medium">Royalties</span>
                      <Badge variant="secondary">
                        {nft.royalties}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Attributes */}
              {nft.attributes && nft.attributes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Attributes</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {nft.attributes.map((attr, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center"
                      >
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {attr.trait_type}
                        </p>
                        <p className="font-medium mt-1">{attr.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NFTDetailModal;