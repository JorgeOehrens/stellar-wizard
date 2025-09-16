import { NextRequest, NextResponse } from 'next/server';
import { getStellarService } from '../../../../lib/stellar';

export async function POST(request: NextRequest) {
  try {
    const {
      collectionName,
      symbol,
      totalSupply,   // opcional: úsalo luego para mint/airdrop
      description,   // opcional: metadata off-chain
      royaltiesPct,
      mediaUrl,
      airdrop,       // opcional { recipient, amount? }
      network,
      userAddress,   // <-- requerido: caller que firmará
    } = await request.json();

    // ===== Validaciones básicas =====
    if (!collectionName || !symbol || !mediaUrl || !userAddress) {
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

    // Direcciones G… válidas
    const isG = (g?: string) => typeof g === 'string' && g.startsWith('G') && g.length === 56;
    if (!isG(userAddress)) {
      return NextResponse.json({ error: 'Invalid Stellar address format (userAddress)' }, { status: 400 });
    }
    if (airdrop?.recipient && !isG(airdrop.recipient)) {
      return NextResponse.json({ error: 'Invalid airdrop recipient address format' }, { status: 400 });
    }

    // Royalties (bps)
    const royaltiesBps =
      typeof royaltiesPct === 'number' ? royaltiesPct : parseInt(royaltiesPct ?? '0', 10) || 0;
    if (!Number.isInteger(royaltiesBps) || royaltiesBps < 0 || royaltiesBps > 10000) {
      return NextResponse.json(
        { error: 'Royalties must be between 0 and 10000 basis points (0–100%)' },
        { status: 400 }
      );
    }

    // totalSupply solo para plan de mint posterior
    const supply =
      totalSupply == null ? undefined : Number(totalSupply);
    if (supply != null && (!Number.isInteger(supply) || supply <= 0)) {
      return NextResponse.json(
        { error: 'totalSupply (if provided) must be a positive integer' },
        { status: 400 }
      );
    }

    console.log('Building Soroban create_collection:', {
      network: stellarNetwork,
      userAddress,
      collectionName,
      symbol,
      royaltiesBps,
      uri_base: mediaUrl,
    });

    // ===== 1) BUILD (sin firmar) =====
    // Firma del ctor en tu contrato:
    //   (caller: Address, name: String, symbol: String, uri_base: String, royalties_bps: u32)
    const unsignedXdr = await stellarService.buildCreateCollectionTransaction(
      {
        caller: userAddress,
        name: collectionName,
        symbol,
        uri_base: mediaUrl,
        royalties_bps: royaltiesBps,
      },
      userAddress // tx source (quien firmará)
    );

    // ===== 2) SIMULATE =====
    const simulation = await stellarService.simulateTransaction(unsignedXdr);
    if (!simulation?.success) {
      console.error('Transaction simulation failed:', simulation?.error);
      return NextResponse.json(
        { error: `Transaction simulation failed: ${simulation?.error || 'unknown error'}` },
        { status: 400 }
      );
    }

    // ===== 3) PREPARE =====
    const preparedXdr = await stellarService.prepareTransaction(unsignedXdr, simulation);

    // ===== 4) Respuesta: XDR listo para firmar por el caller (Freighter/Albedo) =====
    const payload: any = {
      success: true,
      operation: 'create_collection',
      xdr: preparedXdr, // <-- este es el que debes firmar
      network: stellarNetwork,
      userAddress,
      factoryContractId,
      simulation: { cost: simulation.cost, success: true },
      metadata: {
        description: description ?? null,
        royalties_bps: royaltiesBps,
        uri_base: mediaUrl,
      },
    };

    // Plan de airdrop/mint (tu `mint` requiere to.require_auth())
    if (airdrop?.recipient) {
      payload.airdrop = {
        recipient: airdrop.recipient,
        amount: airdrop.amount || supply || 1,
        needsRecipientSignatureToMint: true, // tu método mint pide firma del destinatario
        needsMintAfterCreation: true,
      };
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Factory create collection API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to build collection creation transaction',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
