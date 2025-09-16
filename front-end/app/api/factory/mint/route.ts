import { NextRequest, NextResponse } from 'next/server';
import { getStellarService } from '../../../../lib/stellar';

export async function POST(request: NextRequest) {
  try {
    const {
      collectionId,
      recipient,
      amount,
      userAddress,
      network
    } = await request.json();

    // Validate required fields
    if (!collectionId || !recipient || !amount || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: collectionId, recipient, amount, userAddress' },
        { status: 400 }
      );
    }

    // Validate network
    const stellarNetwork = network === 'MAINNET' ? 'MAINNET' : 'TESTNET';
    const stellarService = getStellarService(stellarNetwork);

    // Validate Stellar addresses
    if (!userAddress.startsWith('G') || userAddress.length !== 56) {
      return NextResponse.json(
        { error: 'Invalid caller Stellar address format' },
        { status: 400 }
      );
    }

    if (!recipient.startsWith('G') || recipient.length !== 56) {
      return NextResponse.json(
        { error: 'Invalid recipient Stellar address format' },
        { status: 400 }
      );
    }

    console.log('Building mint transaction via Factory:', {
      collectionId,
      recipient,
      amount,
      userAddress,
      network: stellarNetwork
    });

    // Build mint transaction
    const mintXdr = await stellarService.buildMintTransaction({
      collection_id: collectionId,
      to: recipient,
      amount: amount
    }, userAddress);

    // Simulate the transaction to check for errors
    const simulation = await stellarService.simulateTransaction(mintXdr);
    if (!simulation.success) {
      console.error('Mint transaction simulation failed:', simulation.error);
      return NextResponse.json(
        { error: `Mint transaction simulation failed: ${simulation.error}` },
        { status: 400 }
      );
    }

    const response = {
      success: true,
      operation: 'mint_nft',
      mintXdr,
      simulation: {
        cost: simulation.cost,
        success: true
      },
      network: stellarNetwork,
      userAddress,
      factoryContract: stellarService.getFactoryContractId(),
      collectionId,
      recipient,
      amount
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Factory mint API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to build mint transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}