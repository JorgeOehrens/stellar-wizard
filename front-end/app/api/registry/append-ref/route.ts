import { NextRequest, NextResponse } from 'next/server';
import { 
  Contract,
  SorobanRpc, 
  TransactionBuilder,
  Address,
  nativeToScVal
} from '@stellar/stellar-sdk';

interface AppendTxRefRequest {
  userAddress: string;
  recordId: string;
  txRef: string;
  network: 'TESTNET' | 'MAINNET';
}

export async function POST(request: NextRequest) {
  try {
    const {
      userAddress,
      recordId,
      txRef,
      network
    }: AppendTxRefRequest = await request.json();

    // Validate required fields
    if (!userAddress || !recordId || !txRef) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

    // Build operation arguments
    const args = [
      Address.fromString(userAddress).toScVal(),       // user
      nativeToScVal(BigInt(recordId), { type: 'u64' }), // id
      nativeToScVal(txRef, { type: 'string' }),        // tx_ref
    ];

    // Build the operation
    const operation = contract.call('append_tx_ref', ...args);

    // Get user account info
    const account = await server.getAccount(userAddress);

    // Build transaction
    const txBuilder = new TransactionBuilder(account, {
      fee: '100000', // Base fee
      networkPassphrase,
    });
    
    txBuilder.addOperation(operation);
    txBuilder.setTimeout(30);
    
    const transaction = txBuilder.build();

    // Simulate the transaction
    const simulation = await server.simulateTransaction(transaction);

    if (SorobanRpc.Api.isSimulationError(simulation)) {
      return NextResponse.json(
        { error: `Simulation failed: ${simulation.error}` },
        { status: 400 }
      );
    }

    if (!simulation.result) {
      return NextResponse.json(
        { error: 'No result from simulation' },
        { status: 400 }
      );
    }

    // Prepare transaction with simulation results
    const assembledTx = SorobanRpc.assembleTransaction(transaction, simulation);

    return NextResponse.json({
      success: true,
      transactionXdr: assembledTx.toXDR(),
      contractId,
      operation: 'append_tx_ref',
      params: {
        recordId,
        txRef
      }
    });

  } catch (error) {
    console.error('Registry append-ref error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare append transaction' },
      { status: 500 }
    );
  }
}