import { NextRequest, NextResponse } from 'next/server';
import { getUserPublicKey } from '@/lib/auth';
import { atomicUpdate } from '@/lib/jsonStore';

interface LikesData {
  [walletAddress: string]: {
    liked: string[]; // Array of nft IDs
    updatedAt: string;
  };
}

interface LikeRequest {
  action: 'like' | 'unlike';
}

/**
 * POST /api/likes/[nftId]
 * Like or unlike an NFT for the current user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { nftId: string } }
) {
  try {
    const { nftId } = params;

    // Get user's wallet address from headers
    const walletAddress = await getUserPublicKey(request);

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Authentication required. Please connect your wallet.' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: LikeRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { action } = body;

    // Validate input
    if (!nftId || !action || !['like', 'unlike'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid nftId or action. Action must be "like" or "unlike".' },
        { status: 400 }
      );
    }

    console.log(`🎯 ${action.toUpperCase()} NFT: ${nftId} by ${walletAddress}`);

    // Atomically update likes data
    const updatedLikes = await atomicUpdate<LikesData>('likes.json', (currentLikes) => {
      // Ensure user entry exists
      if (!currentLikes[walletAddress]) {
        currentLikes[walletAddress] = {
          liked: [],
          updatedAt: new Date().toISOString()
        };
      }

      // Get current liked NFTs as a Set for efficient operations
      const likedSet = new Set(currentLikes[walletAddress].liked);

      // Perform like/unlike operation
      if (action === 'like') {
        likedSet.add(nftId);
      } else {
        likedSet.delete(nftId);
      }

      // Update user's likes
      currentLikes[walletAddress] = {
        liked: Array.from(likedSet),
        updatedAt: new Date().toISOString()
      };

      return currentLikes;
    });

    // Check if NFT is now liked by user
    const isLiked = updatedLikes[walletAddress].liked.includes(nftId);

    // Calculate total likes for this NFT across all users
    let totalLikes = 0;
    Object.values(updatedLikes).forEach(userLikes => {
      if (userLikes.liked.includes(nftId)) {
        totalLikes++;
      }
    });

    console.log(`✅ ${action.toUpperCase()} successful. NFT ${nftId} now has ${totalLikes} total likes`);

    return NextResponse.json({
      success: true,
      nftId,
      action,
      liked: isLiked,
      totalLikes,
      walletAddress,
      updatedAt: updatedLikes[walletAddress].updatedAt
    });

  } catch (error) {
    console.error('Error updating NFT likes:', error);
    return NextResponse.json(
      { error: 'Failed to update NFT likes' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/likes/[nftId]
 * Get like information for a specific NFT
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { nftId: string } }
) {
  try {
    const { nftId } = params;
    const walletAddress = await getUserPublicKey(request);

    if (!nftId) {
      return NextResponse.json(
        { error: 'NFT ID is required' },
        { status: 400 }
      );
    }

    // Read likes data
    const { readJson } = await import('@/lib/jsonStore');
    const likesData = await readJson<LikesData>('likes.json');

    // Calculate total likes for this NFT
    let totalLikes = 0;
    Object.values(likesData).forEach(userLikes => {
      if (userLikes.liked.includes(nftId)) {
        totalLikes++;
      }
    });

    // Check if current user has liked this NFT
    const isLikedByUser = walletAddress ?
      (likesData[walletAddress]?.liked.includes(nftId) || false) :
      false;

    return NextResponse.json({
      nftId,
      totalLikes,
      likedByUser: isLikedByUser,
      walletAddress
    });

  } catch (error) {
    console.error('Error fetching NFT likes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch NFT likes' },
      { status: 500 }
    );
  }
}