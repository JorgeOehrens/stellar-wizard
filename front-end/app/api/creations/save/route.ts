import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface CreationData {
  id?: string;
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

// Simple file-based storage for hackathon (in production, use a real database)
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

const saveCreations = (creations: CreationData[]) => {
  try {
    const filePath = getDataFilePath();
    fs.writeFileSync(filePath, JSON.stringify(creations, null, 2));
  } catch (error) {
    console.error('Error saving creations:', error);
    throw new Error('Failed to save creation data');
  }
};

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.type || !['nft', 'strategy'].includes(data.type)) {
      return NextResponse.json(
        { error: 'Valid type (nft or strategy) is required' },
        { status: 400 }
      );
    }

    if (!data.userAddress || !data.userAddress.startsWith('G') || data.userAddress.length !== 56) {
      return NextResponse.json(
        { error: 'Valid Stellar user address is required' },
        { status: 400 }
      );
    }

    if (!data.network || !['TESTNET', 'MAINNET'].includes(data.network)) {
      return NextResponse.json(
        { error: 'Valid network is required' },
        { status: 400 }
      );
    }

    if (!data.plan) {
      return NextResponse.json(
        { error: 'Plan data is required' },
        { status: 400 }
      );
    }

    // Load existing creations
    const creations = loadCreations();

    // Create new creation entry
    const newCreation: CreationData = {
      id: `${data.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type,
      userAddress: data.userAddress,
      network: data.network,
      plan: data.plan,
      txHash: data.txHash,
      planId: data.planId,
      createdAt: new Date().toISOString(),
    };

    // Add type-specific fields
    if (data.type === 'nft') {
      newCreation.name = data.name || data.plan.collectionName;
      newCreation.symbol = data.symbol || data.plan.symbol;
      newCreation.supply = data.supply || data.plan.totalSupply;
      newCreation.description = data.description || data.plan.description;
      newCreation.royalties = data.royalties || data.plan.royaltiesPct;
      newCreation.imageUrl = data.imageUrl || data.plan.mediaUrl;
    } else if (data.type === 'strategy') {
      newCreation.title = data.title || `${data.strategyType || 'DeFi'} Strategy`;
      newCreation.strategyType = data.strategyType;
      newCreation.allocations = data.allocations;
    }

    // Add to creations array
    creations.push(newCreation);

    // Save back to file
    saveCreations(creations);

    return NextResponse.json({
      success: true,
      creation: newCreation,
    });

  } catch (error) {
    console.error('Save creation API error:', error);
    return NextResponse.json(
      { error: 'Failed to save creation' },
      { status: 500 }
    );
  }
}