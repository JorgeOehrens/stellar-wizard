import { NextRequest, NextResponse } from 'next/server';
import { getStellarService } from '../../../../lib/stellar';


export async function POST(request: NextRequest) {
  try {
    const {
      collectionName,
      symbol,
      totalSupply,
      description,     // (no se usa en el ctor; podrías guardarlo en metadata on-chain/off-chain)
      royaltiesPct,
      mediaUrl,
      airdrop,
      network,
      userAddress,
    } = await request.json();

    // ===== Validaciones básicas =====
    if (!collectionName || !symbol || totalSupply == null || !mediaUrl || !userAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const stellarNetwork = network === 'MAINNET' ? 'MAINNET' : 'TESTNET';
    const stellarService = getStellarService(stellarNetwork);

    const factoryContractId = stellarService.getFactoryContractId();
    if (!factoryContractId) {
      return NextResponse.json(
        {
          error: `Factory contract not yet deployed on ${stellarNetwork}. Please use TESTNET for now.`,
          network: stellarNetwork,
          suggestion: 'Switch to TESTNET to create NFT collections',
        },

        { status: 400 }
      );
    }

    // Dirección Stellar
    if (typeof userAddress !== 'string' || !userAddress.startsWith('G') || userAddress.length !== 56) {
      return NextResponse.json({ error: 'Invalid Stellar address format' }, { status: 400 });
    }

    // Validar y truncar URL si es demasiado larga (límite del contrato NFT)
    let processedMediaUrl = mediaUrl;
    if (mediaUrl.length > 200) {
      console.warn(`Media URL too long (${mediaUrl.length} chars), using placeholder`);
      processedMediaUrl = `https://nft.placeholder/${Date.now()}.png`;
    }

    // Airdrop (opcional)
    if (airdrop?.recipient && (!airdrop.recipient.startsWith('G') || airdrop.recipient.length !== 56)) {
      return NextResponse.json({ error: 'Invalid airdrop recipient address format' }, { status: 400 });
    }

    // totalSupply como u32
    const supply = Number(totalSupply);
    if (!Number.isInteger(supply) || supply <= 0 || supply > 4_294_967_295) {
      return NextResponse.json({ error: 'totalSupply must be a positive integer (u32)' }, { status: 400 });
    }

    // Royalties (guardar para paso posterior si tu contrato lo soporta en otro método)
    const royaltiesBps =
      typeof royaltiesPct === 'number' ? royaltiesPct : parseInt(royaltiesPct, 10) || 0;
    if (royaltiesBps < 0 || royaltiesBps > 10000) {
      return NextResponse.json(
        { error: 'Royalties must be between 0 and 10000 basis points (0-100%)' },
        { status: 400 }
      );
    }

    console.log('Creating NFT collection via Stellar Soroban:', {
      collectionName,
      symbol,
      totalSupply: supply,
      royaltiesPct,
      royaltiesBps,
      userAddress,
      network: stellarNetwork,
      hasAirdrop: !!airdrop?.recipient,
    });

    // ===== Paso 1: Build (sin firmar) =====
    // Alinear con el ctor: (admin/caller, name, symbol, uri, royalties_bps)
    const unsignedXdr = await stellarService.buildCreateCollectionTransaction(
      {
        caller: userAddress,
        name: collectionName,
        symbol,
        uri_base: processedMediaUrl, // <- usar URL procesada (truncada si es necesario)
        royalties_bps: royaltiesBps, // <- usar royalties_bps en el ctor
      },
      userAddress
    );

    // ===== Paso 2: Simulate =====
    const simulation = await stellarService.simulateTransaction(unsignedXdr);
    if (!simulation?.success) {
      console.error('Transaction simulation failed:', simulation?.error);
      return NextResponse.json(
        { error: `Transaction simulation failed: ${simulation?.error || 'unknown error'}` },
        { status: 400 }
      );
    }

    // ===== Paso 3: Prepare (imprescindible para Soroban) =====
    // Debe inyectar footprint, ajustar fees y dejar el XDR listo para firma.
    const preparedXdr = await stellarService.prepareTransaction(unsignedXdr, simulation);

    // ===== Respuesta: devolver XDR preparado para firmar en el cliente =====
    const response: any = {
      success: true,
      operation: 'create_nft_collection',
      xdr: preparedXdr, // <- este es el que debes firmar y luego enviar
      simulation: {
        cost: simulation.cost,
        success: true,
      },
      network: stellarNetwork,
      userAddress,
      factoryContract: factoryContractId,
      // Info sobre la colección creada
      collection: {
        name: collectionName,
        symbol,
        totalSupply: supply, // Supply como metadata/referencia
        royalties_bps: royaltiesBps,
        uri_base: processedMediaUrl,
        original_uri: mediaUrl !== processedMediaUrl ? mediaUrl : undefined // Mantener URL original si fue truncada
      },
    };

    // Airdrop diferido (mint después de crear la colección)
    if (airdrop?.recipient) {
      response.airdrop = {
        recipient: airdrop.recipient,
        amount: airdrop.amount || supply,
        needsMintAfterCreation: true,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('NFT mint API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to build transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

