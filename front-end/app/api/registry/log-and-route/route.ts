import { NextRequest, NextResponse } from 'next/server';
import { 
  Contract,
  SorobanRpc, 
  TransactionBuilder,
  Address,
  nativeToScVal,
  ScVal,
  xdr
} from '@stellar/stellar-sdk';

interface LogAndRouteRequest {
  userAddress: string;
  actionType: 'NFT' | 'DEFI';
  planHash: string;
  payloadRef: string;
  network: 'TESTNET' | 'MAINNET';
  totalAmount: string; // Amount in stroops
  tokenAddress?: string; // Optional, defaults to native XLM
}

export async function POST(request: NextRequest) {
  try {
    const {
      userAddress,
      actionType,
      planHash,
      payloadRef,
      network,
      totalAmount,
      tokenAddress
    }: LogAndRouteRequest = await request.json();

    // Validate required fields
    if (!userAddress || !actionType || !planHash || !totalAmount) {
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
    
    // Default to native XLM if no token address provided
    const tokenAddr = tokenAddress || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAOBKKG6ABJYG' // Native token on testnet

    // Build operation arguments
    const args = [
      Address.fromString(userAddress).toScVal(),                    // user
      actionType === 'NFT' ? 
        nativeToScVal({ NFT: {} }, { type: 'symbol' }) : 
        nativeToScVal({ DEFI: {} }, { type: 'symbol' }),           // action_type
      nativeToScVal(planHash, { type: 'string' }),                 // plan_hash
      nativeToScVal(payloadRef, { type: 'string' }),               // payload_ref
      nativeToScVal(network, { type: 'string' }),                  // network
      nativeToScVal(BigInt(totalAmount), { type: 'i128' }),        // total_amount
      Address.fromString(tokenAddr).toScVal(),                     // token_address
    ];

    // Build the operation
    const operation = contract.call('log_and_route', ...args);

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

    // Simulate the transaction to get proper auth and resource requirements
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
      operation: 'log_and_route',
      params: {
        actionType,
        planHash,
        totalAmount,
        network
      }
    });

  } catch (error) {
    console.error('Registry log-and-route error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare registry transaction' },
      { status: 500 }
    );
  }
}