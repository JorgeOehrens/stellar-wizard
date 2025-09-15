import { NextRequest, NextResponse } from 'next/server';
import { 
  Contract,
  SorobanRpc, 
  TransactionBuilder,
  Address,
  nativeToScVal
} from '@stellar/stellar-sdk';

interface GetRecordsRequest {
  userAddress?: string;
  recordId?: string;
  network: 'TESTNET' | 'MAINNET';
  start?: number;
  limit?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const recordId = searchParams.get('recordId');
    const network = (searchParams.get('network') || 'TESTNET') as 'TESTNET' | 'MAINNET';
    const start = searchParams.get('start');
    const limit = searchParams.get('limit');

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

    let operation;
    let operationType;

    if (recordId) {
      // Get specific record by ID
      operation = contract.call('get_record', nativeToScVal(BigInt(recordId), { type: 'u64' }));
      operationType = 'get_record';
    } else if (userAddress) {
      // Get user's records
      operation = contract.call('get_user_records', Address.fromString(userAddress).toScVal());
      operationType = 'get_user_records';
    } else if (start && limit) {
      // Get records range
      operation = contract.call('get_records_range', 
        nativeToScVal(BigInt(start), { type: 'u64' }),
        nativeToScVal(parseInt(limit), { type: 'u32' })
      );
      operationType = 'get_records_range';
    } else {
      // Get total records count
      operation = contract.call('get_total_records');
      operationType = 'get_total_records';
    }

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

    // Parse the result based on the operation type
    let result;
    try {
      // The result parsing depends on the Soroban SDK version and return type
      // This is a simplified version - in production you'd want proper XDR parsing
      result = simulation.result.retval;
    } catch (parseError) {
      console.error('Error parsing result:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse contract result' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      operation: operationType,
      result,
      contractId,
      network
    });

  } catch (error) {
    console.error('Registry get-records error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}