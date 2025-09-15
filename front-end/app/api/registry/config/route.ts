import { NextRequest, NextResponse } from 'next/server';
import { 
  Contract,
  SorobanRpc, 
  TransactionBuilder
} from '@stellar/stellar-sdk';

interface ConfigRequest {
  network: 'TESTNET' | 'MAINNET';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = (searchParams.get('network') || 'TESTNET') as 'TESTNET' | 'MAINNET';

    // Get contract ID from environment
    const contractId = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID;
    if (!contractId) {
      return NextResponse.json(
        { error: 'Registry contract not configured' },
        { status: 500 }
      );
    }

    // Set up RPC client based on network
    const rpcUrl = network === 'MAINNET' 
      ? process.env.NEXT_PUBLIC_SOROBAN_MAINNET_RPC_URL || 'https://soroban-mainnet.stellar.org'
      : process.env.NEXT_PUBLIC_SOROBAN_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org';
    
    const networkPassphrase = network === 'MAINNET'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015';

    const server = new SorobanRpc.Server(rpcUrl);

    // Create contract instance
    const contract = new Contract(contractId);

    // Build operation to get config
    const operation = contract.call('get_config');

    // Use a dummy account for read-only operations
    const dummyAccount = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const account = await server.getAccount(dummyAccount);

    // Build transaction
    const txBuilder = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase,
    });
    
    txBuilder.addOperation(operation);
    txBuilder.setTimeout(30);
    
    const transaction = txBuilder.build();

    // Simulate the transaction to get the result
    const simulation = await server.simulateTransaction(transaction);

    if (SorobanRpc.Api.isSimulationError(simulation)) {
      return NextResponse.json(
        { error: `Simulation failed: ${simulation.error}` },
        { status: 400 }
      );
    }

    if (!simulation.result || !simulation.result.retval) {
      return NextResponse.json(
        { error: 'No result from simulation' },
        { status: 400 }
      );
    }

    // Parse the config result
    let config;
    try {
      // The result parsing depends on the Soroban SDK version and return type
      // This would need proper XDR parsing in production
      config = simulation.result.retval;
    } catch (parseError) {
      console.error('Error parsing config:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse contract config' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
      contractId,
      network,
      rpcUrl
    });

  } catch (error) {
    console.error('Registry config error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contract config' },
      { status: 500 }
    );
  }
}