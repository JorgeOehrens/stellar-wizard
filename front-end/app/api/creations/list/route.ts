import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface CreationData {
  id: string;
  type: 'nft' | 'strategy';
  userAddress: string;
  network: 'TESTNET' | 'MAINNET';
  plan: any;
  txHash?: string;
  planId?: string;
  createdAt: string;
  // NFT specific
  name?: string;
  symbol?: string;
  supply?: number;
  description?: string;
  royalties?: number;
  imageUrl?: string;
  // Strategy specific
  title?: string;
  strategyType?: 'blend' | 'soroswap' | 'defindex';
  allocations?: any;
}

const getDataFilePath = () => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'creations.json');
};

const loadCreations = (): CreationData[] => {
  try {
    const filePath = getDataFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading creations:', error);
  }
  return [];
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'nft' | 'strategy'
    const userAddress = searchParams.get('userAddress');
    const network = searchParams.get('network'); // optional filter

    // Load all creations
    let creations = loadCreations();

    // Filter by type if specified
    if (type && ['nft', 'strategy'].includes(type)) {
      creations = creations.filter(creation => creation.type === type);
    }

    // Filter by user address if specified
    if (userAddress) {
      creations = creations.filter(creation => creation.userAddress === userAddress);
    }

    // Filter by network if specified
    if (network && ['TESTNET', 'MAINNET'].includes(network)) {
      creations = creations.filter(creation => creation.network === network);
    }

    // Sort by creation date (most recent first)
    creations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      creations,
      total: creations.length,
    });

  } catch (error) {
    console.error('List creations API error:', error);
    return NextResponse.json(
      { error: 'Failed to load creations' },
      { status: 500 }
    );
  }
}