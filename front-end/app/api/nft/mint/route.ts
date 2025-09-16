import { NextRequest, NextResponse } from 'next/server';
import { getStellarService } from '../../../../lib/stellar';

export async function POST(request: NextRequest) {
  try {
    const {
      collectionName,
      symbol,
      totalSupply,
      description,
      royaltiesPct,
      mediaUrl,
      airdrop,
      network,
      userAddress
    } = await request.json();

    // Validate required fields
    if (!collectionName || !symbol || !totalSupply || !mediaUrl || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate network
    const stellarNetwork = network === 'MAINNET' ? 'MAINNET' : 'TESTNET';
    const stellarService = getStellarService(stellarNetwork);

    // Validate Stellar address
    if (!userAddress.startsWith('G') || userAddress.length !== 56) {
      return NextResponse.json(
        { error: 'Invalid Stellar address format' },
        { status: 400 }
      );
    }

    // Validate airdrop recipient if provided
    if (airdrop?.recipient && (!airdrop.recipient.startsWith('G') || airdrop.recipient.length !== 56)) {
      return NextResponse.json(
        { error: 'Invalid airdrop recipient address format' },
        { status: 400 }
      );
    }

    console.log('Creating NFT collection via Stellar SDK:', {
      collectionName,
      symbol,
      totalSupply,
      royaltiesPct,
      userAddress,
      network: stellarNetwork,
      hasAirdrop: !!airdrop?.recipient
    });

    // Step 1: Build collection creation transaction
    const createCollectionXdr = await stellarService.buildCreateCollectionTransaction({
      caller: userAddress,
      name: collectionName,
      symbol: symbol,
      uri_base: mediaUrl,
      royalties_bps: royaltiesPct || 0
    }, userAddress);

    // Step 2: Simulate the transaction to check for errors
    const simulation = await stellarService.simulateTransaction(createCollectionXdr);
    if (!simulation.success) {
      console.error('Transaction simulation failed:', simulation.error);
      return NextResponse.json(
        { error: `Transaction simulation failed: ${simulation.error}` },
        { status: 400 }
      );
    }

    // Step 3: Prepare response with transaction to sign
    const response: any = {
      success: true,
      operation: 'create_nft_collection',
      createCollectionXdr,
      simulation: {
        cost: simulation.cost,
        success: true
      },
      network: stellarNetwork,
      userAddress,
      factoryContract: stellarService.getFactoryContractId()
    };

    // Step 4: If airdrop is specified, also prepare mint transaction
    if (airdrop && airdrop.recipient) {
      console.log('Preparing airdrop mint transaction:', {
        recipient: airdrop.recipient,
        amount: airdrop.amount || totalSupply
      });

      // For airdrop, we'll need to wait for the collection to be created first
      // So we'll return the airdrop info to be processed after collection creation
      response.airdrop = {
        recipient: airdrop.recipient,
        amount: airdrop.amount || totalSupply,
        // The mint transaction will be built after we know the collection ID
        needsMintAfterCreation: true
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('NFT mint API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to build transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

