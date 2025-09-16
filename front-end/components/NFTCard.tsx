'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Heart, Eye, User, Calendar } from 'lucide-react';
import { useLike } from '@/hooks/useLike';

export interface NFTMetadata {
  id: string;
  contractId: string;
  tokenId: string;
  name: string;
  image: string;
  creator: string;
  createdAt: string;
  likes: number;
  description?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  collectionName?: string;
  royalties?: number;
}

interface NFTCardProps {
  nft: NFTMetadata;
  onClick?: (nft: NFTMetadata) => void;
  className?: string;
}

const NFTCard: React.FC<NFTCardProps> = ({ nft, onClick, className = '' }) => {
  const { totalLikes, likedByUser, toggle, isToggling } = useLike(nft.id);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const shortenAddress = (address: string): string => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when clicking like button
    toggle();
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(nft);
    }
  };

  return (
    <Card
      className={`group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${className}`}
      onClick={handleCardClick}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
        {/* Image */}
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
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-400 to-pink-400">
            <div className="text-center text-white">
              <Eye className="h-8 w-8 mx-auto mb-2 opacity-70" />
              <p className="text-sm font-medium">{nft.name}</p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {imageLoading && !imageError && (
          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Like button */}
        <Button
          size="sm"
          variant="secondary"
          className={`absolute top-3 right-3 h-8 w-8 p-0 rounded-full backdrop-blur-sm transition-all duration-200 ${
            likedByUser
              ? 'bg-red-500/90 hover:bg-red-600/90 text-white'
              : 'bg-white/90 hover:bg-white text-gray-700'
          } ${isToggling ? 'scale-90' : 'hover:scale-110'}`}
          onClick={handleLikeClick}
          disabled={isToggling}
        >
          <Heart
            className={`h-4 w-4 transition-all duration-200 ${
              likedByUser ? 'fill-current' : ''
            }`}
          />
        </Button>

        {/* Collection badge */}
        {nft.collectionName && (
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 text-xs backdrop-blur-sm bg-white/90 text-gray-700"
          >
            {nft.collectionName}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* NFT Title */}
        <div>
          <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
            {nft.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Token #{nft.tokenId}
          </p>
        </div>

        {/* Description */}
        {nft.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {nft.description}
          </p>
        )}

        {/* Creator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Creator: {shortenAddress(nft.creator)}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          {/* Likes */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Heart className="h-4 w-4" />
            <span>{totalLikes}</span>
          </div>

          {/* Created date */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(nft.createdAt)}</span>
          </div>
        </div>

        {/* Royalties */}
        {nft.royalties && nft.royalties > 0 && (
          <div className="text-center">
            <Badge variant="outline" className="text-xs">
              {nft.royalties}% Royalties
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NFTCard;