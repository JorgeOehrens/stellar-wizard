import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/app/providers/WalletProvider';

interface LikeInfo {
  totalLikes: number;
  likedByUser: boolean;
  isLoading: boolean;
}

interface UseLikeReturn extends LikeInfo {
  toggle: () => Promise<void>;
  isToggling: boolean;
}

/**
 * Custom hook for managing NFT likes
 * Handles like/unlike operations and maintains state
 */
export function useLike(nftId: string): UseLikeReturn {
  const { publicKey, isConnected } = useWallet();
  const [totalLikes, setTotalLikes] = useState(0);
  const [likedByUser, setLikedByUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Fetch current like status
  const fetchLikeStatus = useCallback(async () => {
    if (!nftId) return;

    try {
      setIsLoading(true);

      const headers: Record<string, string> = {};
      if (publicKey && isConnected) {
        headers['x-wallet-address'] = publicKey;
        headers['x-auth-method'] = 'kit'; // Could be enhanced to detect actual method
      }

      const response = await fetch(`/api/likes/${nftId}`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setTotalLikes(data.totalLikes || 0);
        setLikedByUser(data.likedByUser || false);
      } else {
        console.error('Failed to fetch like status:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching like status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [nftId, publicKey, isConnected]);

  // Toggle like/unlike
  const toggle = useCallback(async () => {
    if (!publicKey || !isConnected) {
      alert('Please connect your wallet to like NFTs');
      return;
    }

    if (isToggling) return; // Prevent double-clicks

    try {
      setIsToggling(true);

      const action = likedByUser ? 'unlike' : 'like';

      const response = await fetch(`/api/likes/${nftId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': publicKey,
          'x-auth-method': 'kit' // Could be enhanced to detect actual method
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        const data = await response.json();
        setTotalLikes(data.totalLikes || 0);
        setLikedByUser(data.liked || false);

        console.log(`${action.toUpperCase()} successful for NFT ${nftId}`);
      } else {
        const errorData = await response.json();
        console.error('Failed to toggle like:', errorData.error);
        alert(errorData.error || 'Failed to update like status');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsToggling(false);
    }
  }, [nftId, publicKey, isConnected, likedByUser, isToggling]);

  // Fetch like status when component mounts or dependencies change
  useEffect(() => {
    fetchLikeStatus();
  }, [fetchLikeStatus]);

  return {
    totalLikes,
    likedByUser,
    isLoading,
    toggle,
    isToggling
  };
}

/**
 * Hook for fetching user's liked NFTs
 */
export function useUserLikes() {
  const { publicKey, isConnected } = useWallet();
  const [likedNFTs, setLikedNFTs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserLikes = useCallback(async () => {
    if (!publicKey || !isConnected) {
      setLikedNFTs([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/likes/me', {
        headers: {
          'x-wallet-address': publicKey,
          'x-auth-method': 'kit'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLikedNFTs(data.liked || []);
      } else {
        console.error('Failed to fetch user likes:', response.statusText);
        setLikedNFTs([]);
      }
    } catch (error) {
      console.error('Error fetching user likes:', error);
      setLikedNFTs([]);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, isConnected]);

  useEffect(() => {
    fetchUserLikes();
  }, [fetchUserLikes]);

  return {
    likedNFTs,
    isLoading,
    refetch: fetchUserLikes
  };
}