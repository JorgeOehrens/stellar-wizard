import { NextRequest, NextResponse } from 'next/server';
import { getUserPublicKey } from '@/lib/auth';
import { readJson } from '@/lib/jsonStore';

interface LikesData {
  [walletAddress: string]: {
    liked: string[]; // Array of nft IDs
    updatedAt: string;
  };
}

/**
 * GET /api/likes/me
 * Returns the current user's liked NFT IDs
 */
export async function GET(request: NextRequest) {
  try {
    // Get user's wallet address from headers
    const walletAddress = await getUserPublicKey(request);

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Authentication required. Please connect your wallet.' },
        { status: 401 }
      );
    }

    // Read likes data
    const likesData = await readJson<LikesData>('likes.json');

    // Get user's likes or return empty array
    const userLikes = likesData[walletAddress]?.liked || [];

    return NextResponse.json({
      liked: userLikes,
      total: userLikes.length,
      walletAddress,
      updatedAt: likesData[walletAddress]?.updatedAt || null
    });

  } catch (error) {
    console.error('Error fetching user likes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user likes' },
      { status: 500 }
    );
  }
}