import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { StellarNetwork } from '../app/providers/NetworkProvider';

export interface ContractCallParams {
  contractId: string;
  method: string;
  args: any[];
  walletKit: StellarWalletsKit;
  userAddress: string;
  network: StellarNetwork;
  rpcUrl: string;
  networkPassphrase: string;
  getExplorerUrl: (type: 'tx' | 'contract', id: string) => string;
}

export interface TransactionResult {
  txHash: string;
  explorerUrl: string;
  result?: any;
}

export async function invokeWithFreighter({
  contractId,
  method,
  args,
  walletKit,
  userAddress,
  network,
  rpcUrl,
  networkPassphrase,
  getExplorerUrl
}: ContractCallParams): Promise<TransactionResult> {
  try {
    // Dynamic imports to avoid SSR issues
    const { 
      SorobanRpc, 
      TransactionBuilder, 
      Networks, 
      Contract
    } = await import('@stellar/stellar-sdk');
    
    const rpcServer = new SorobanRpc.Server(rpcUrl);
    
    // Create contract instance
    const contract = new Contract(contractId);
    
    // Build the operation
    const operation = contract.call(method, ...args);
    
    // Get user account info
    const account = await rpcServer.getAccount(userAddress);
    
    // Build transaction
    const txBuilder = new TransactionBuilder(account, {
      fee: '100000', // Base fee
      networkPassphrase,
    });
    
    txBuilder.addOperation(operation);
    txBuilder.setTimeout(30);
    
    const transaction = txBuilder.build();
    
    // Simulate the transaction
    const simulation = await rpcServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }
    
    if (!simulation.result) {
      throw new Error('No result from simulation');
    }
    
    // Prepare transaction with simulation results
    const assembledTx = SorobanRpc.assembleTransaction(transaction, simulation);
    
    // Sign with Freighter
    const { signedTxXdr } = await walletKit.signTransaction(assembledTx.toXDR(), {
      networkPassphrase,
    });
    
    // Parse signed transaction
    const signedTx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
    
    // Submit transaction
    const result = await rpcServer.sendTransaction(signedTx);
    
    if (result.status === 'ERROR') {
      throw new Error(`Transaction failed: ${result.errorResult?.toXDR()}`);
    }
    
    // Wait for transaction to be confirmed
    const hash = result.hash;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      const status = await rpcServer.getTransaction(hash);
      
      if (status.status === 'SUCCESS') {
        return {
          txHash: hash,
          explorerUrl: getExplorerUrl('tx', hash),
          result: status.returnValue
        };
      } else if (status.status === 'FAILED') {
        throw new Error(`Transaction failed: ${status.resultXdr?.toXDR()}`);
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    // If we reach here, transaction is still pending
    return {
      txHash: hash,
      explorerUrl: getExplorerUrl('tx', hash)
    };
    
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

export function formatAmount(amount: string, decimals: number): bigint {
  const factor = 10n ** BigInt(decimals);
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * factor + BigInt(paddedFraction);
}

export function parseAmount(amount: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals);
  const whole = amount / factor;
  const remainder = amount % factor;
  const fraction = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}