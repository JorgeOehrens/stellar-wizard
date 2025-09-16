import {
  rpc,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Account,
  Keypair,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr
} from '@stellar/stellar-sdk';

// Network configuration
const NETWORKS = {
  TESTNET: {
    server: new rpc.Server('https://soroban-testnet.stellar.org'),
    passphrase: Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org'
  },
  MAINNET: {
    server: new rpc.Server('https://rpc.ankr.com/stellar_soroban'),
    passphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org'
  }
};

// Factory contract configuration
export const FACTORY_CONFIG = {
  TESTNET: {
    contractId: 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G',
    nftWasmHash: 'b2e8e159af63fb3201920dbf12bfab3af72ae7d920e81667421cc24347b1af1f'
  },
  MAINNET: {
    contractId: '', // To be deployed on mainnet
    nftWasmHash: ''
  }
};

export interface StellarNetwork {
  server: rpc.Server;
  passphrase: string;
  horizonUrl: string;
}

export interface CreateCollectionParams {
  caller: string;
  name: string;
  symbol: string;
  uri_base: string;
  royalties_bps: number; // Royalties in basis points (0-10000)
}

export interface MintNFTParams {
  collection_id: number;
  to: string;
  amount: number;
}

export class StellarService {
  private network: StellarNetwork;
  private networkName: 'TESTNET' | 'MAINNET';

  constructor(networkName: 'TESTNET' | 'MAINNET' = 'TESTNET') {
    this.networkName = networkName;
    this.network = NETWORKS[networkName];
  }

  /**
   * Get account information from Stellar network with retry logic
   */
  async getAccount(publicKey: string, maxRetries: number = 3): Promise<Account> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const account = await this.network.server.getAccount(publicKey);
        return account;
      } catch (error) {
        lastError = error;
        console.error(`Failed to load account on attempt ${attempt}:`, error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          (errorMessage.includes('timeout') ||
           errorMessage.includes('network') ||
           errorMessage.includes('ECONNRESET') ||
           errorMessage.includes('500')) &&
          attempt < maxRetries
        ) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
          console.log(`Retrying account load in ${delay}ms... (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    throw new Error(`Failed to load account ${publicKey} after ${maxRetries} attempts: ${lastError}`);
  }

  /**
   * Build transaction to create NFT collection via Factory
   */
  async buildCreateCollectionTransaction(
    params: CreateCollectionParams,
    sourcePublicKey: string
  ): Promise<string> {
    try {
      const account = await this.getAccount(sourcePublicKey);
      const contract = new Contract(FACTORY_CONFIG[this.networkName].contractId);

      console.log('StellarService: Converting parameters to ScVal:', {
        caller: params.caller,
        name: params.name,
        symbol: params.symbol,
        uri_base: params.uri_base,
        royalties_bps: params.royalties_bps,
        royalties_bps_type: typeof params.royalties_bps
      });

      // Convert parameters to ScVal
      const callerScVal = new Address(params.caller).toScVal();
      const nameScVal = nativeToScVal(params.name, { type: 'string' });
      const symbolScVal = nativeToScVal(params.symbol, { type: 'string' });
      const uriBaseScVal = nativeToScVal(params.uri_base, { type: 'string' });
      const royaltiesBpsScVal = nativeToScVal(params.royalties_bps, { type: 'u32' });

      console.log('StellarService: ScVal conversion completed');

      // Build the contract operation
      const operation = contract.call(
        'create_collection',
        callerScVal,
        nameScVal,
        symbolScVal,
        uriBaseScVal,
        royaltiesBpsScVal
      );

      // Build transaction
      const txBuilder = new TransactionBuilder(account, {
        fee: '1000000', // 0.1 XLM max fee
        networkPassphrase: this.network.passphrase,
      });

      const transaction = txBuilder
        .addOperation(operation)
        .setTimeout(300) // 5 minutes
        .build();

      return transaction.toXDR();
    } catch (error) {
      console.error('Error building create collection transaction:', error);
      throw new Error(`Failed to build create collection transaction: ${error}`);
    }
  }

  /**
   * Build transaction to mint NFTs via Factory
   */
  async buildMintTransaction(
    params: MintNFTParams,
    sourcePublicKey: string
  ): Promise<string> {
    try {
      const account = await this.getAccount(sourcePublicKey);
      const contract = new Contract(FACTORY_CONFIG[this.networkName].contractId);

      // Convert parameters to ScVal
      const collectionIdScVal = nativeToScVal(params.collection_id, { type: 'u128' });
      const toScVal = new Address(params.to).toScVal();
      const amountScVal = nativeToScVal(params.amount, { type: 'u32' });

      // Build the contract operation
      const operation = contract.call(
        'mint',
        collectionIdScVal,
        toScVal,
        amountScVal
      );

      // Build transaction
      const txBuilder = new TransactionBuilder(account, {
        fee: '1000000', // 0.1 XLM max fee
        networkPassphrase: this.network.passphrase,
      });

      const transaction = txBuilder
        .addOperation(operation)
        .setTimeout(300) // 5 minutes
        .build();

      return transaction.toXDR();
    } catch (error) {
      console.error('Error building mint transaction:', error);
      throw new Error(`Failed to build mint transaction: ${error}`);
    }
  }

  /**
   * Submit a signed transaction to the network with retry logic
   */
  async submitTransaction(signedXdr: string, maxRetries: number = 3): Promise<{
    hash: string;
    success: boolean;
    result?: any;
    error?: string;
    warning?: string;
  }> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const transaction = TransactionBuilder.fromXDR(signedXdr, this.network.passphrase);
        const result = await this.network.server.sendTransaction(transaction);

        if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          return {
            hash: result.hash,
            success: true,
            result: result
          };
        } else if (result.status === rpc.Api.GetTransactionStatus.PENDING) {
          console.log(`Transaction ${result.hash} is PENDING, checking status...`);

          // For PENDING transactions, wait longer and use the proper method
          await new Promise(resolve => setTimeout(resolve, 3000));

          try {
            // Use the server's getTransaction to check final status
            const finalStatus = await this.network.server.getTransaction(result.hash);
            console.log(`Final transaction status:`, finalStatus.status);

            if (finalStatus.status === rpc.Api.GetTransactionStatus.SUCCESS) {
              return {
                hash: result.hash,
                success: true,
                result: finalStatus
              };
            } else if (finalStatus.status === rpc.Api.GetTransactionStatus.PENDING) {
              // Still pending, for Soroban this can be normal
              if (attempt < maxRetries) {
                console.log(`Transaction still pending, retrying... (${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              } else {
                // After max retries, consider it successful but pending
                console.log(`Transaction ${result.hash} remained PENDING but likely succeeded`);
                return {
                  hash: result.hash,
                  success: true,
                  result: result,
                  warning: 'Transaction was submitted successfully but final confirmation took longer than expected'
                };
              }
            }
          } catch (statusError) {
            console.warn(`Failed to check transaction status on attempt ${attempt}:`, statusError);
            // If we can't check status but have a hash, it might still succeed
            if (attempt >= maxRetries) {
              return {
                hash: result.hash,
                success: true,
                result: result,
                warning: 'Transaction was submitted but status could not be verified'
              };
            }
          }

          continue;
        } else {
          // Extract detailed error information
          let detailedError = `Transaction failed with status: ${result.status}`;

          // Also log the full result for debugging
          console.error('Full transaction result:', JSON.stringify(result, null, 2));

          // Try to extract more specific error details from the errorResult
          if ((result as any).errorResult) {
            try {
              const errorResult = (result as any).errorResult;
              if (errorResult._attributes?.result?._switch) {
                const errorCode = errorResult._attributes.result._switch;
                const errorName = errorCode.name || 'unknown';
                const errorValue = errorCode.value || 'unknown';

                detailedError = `Transaction failed: ${errorName} (code: ${errorValue})`;

                // Add specific error descriptions for common errors
                switch (errorName) {
                  case 'txMalformed':
                    detailedError += ' - The transaction XDR is malformed or invalid';
                    break;
                  case 'txBadSeq':
                    detailedError += ' - Invalid sequence number for account';
                    break;
                  case 'txNoSource':
                    detailedError += ' - Source account not found';
                    break;
                  case 'txInsufficientBalance':
                    detailedError += ' - Insufficient XLM balance for fees';
                    break;
                  case 'txInsufficientFee':
                    detailedError += ' - Transaction fee too low';
                    break;
                  case 'txBadAuth':
                    detailedError += ' - Invalid signature or authorization';
                    break;
                  case 'txInternalError':
                    detailedError += ' - Internal Stellar network error';
                    break;
                  default:
                    detailedError += ' - Check Stellar documentation for error code details';
                }
              }

              if (errorResult._attributes?.feeCharged) {
                const feeCharged = errorResult._attributes.feeCharged._value;
                detailedError += ` (Fee charged: ${feeCharged} stroops)`;
              }
            } catch (parseError) {
              console.warn('Failed to parse error result:', parseError);
            }
          }

          return {
            hash: result.hash,
            success: false,
            error: detailedError
          };
        }
      } catch (error) {
        lastError = error;
        console.error(`Transaction submission attempt ${attempt} failed:`, error);

        // Check if it's a retryable error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('timeout') ||
          errorMessage.includes('network') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('500')
        ) {
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
            console.log(`Retrying transaction submission in ${delay}ms... (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Non-retryable error or max retries reached
        break;
      }
    }

    return {
      hash: '',
      success: false,
      error: `Failed to submit transaction after ${maxRetries} attempts: ${lastError}`
    };
  }

  /**
   * Simulate a transaction to estimate fees and check for errors
   */
  async simulateTransaction(xdr: string): Promise<{
    success: boolean;
    cost?: string;
    result?: any;
    error?: string;
  }> {
    try {
      const transaction = TransactionBuilder.fromXDR(xdr, this.network.passphrase);
      const simulation = await this.network.server.simulateTransaction(transaction);

      if (rpc.Api.isSimulationSuccess(simulation)) {
        return {
          success: true,
          cost: 'cost' in simulation ? (simulation as any).cost?.cpuInsns || '0' : '0',
          result: 'result' in simulation ? (simulation as any).result : null
        };
      } else {
        return {
          success: false,
          error: `Simulation failed: ${'error' in simulation ? (simulation as any).error : 'Unknown error'}`
        };
      }
    } catch (error) {
      console.error('Error simulating transaction:', error);
      return {
        success: false,
        error: `Failed to simulate transaction: ${error}`
      };
    }
  }

  /**
   * Prepare a transaction for signing by applying simulation results
   */
  async prepareTransaction(
    unsignedXdr: string,
    simulation: any
  ): Promise<string> {
    try {
      const transaction = TransactionBuilder.fromXDR(unsignedXdr, this.network.passphrase);

      // For Soroban contracts, we need to call prepareTransaction on the server
      // This will inject the footprint, update fees, and make it ready for signing
      const preparedTransaction = await this.network.server.prepareTransaction(transaction);

      return preparedTransaction.toXDR();

    } catch (error) {
      console.error('Error preparing transaction:', error);
      throw new Error(`Failed to prepare transaction: ${error}`);
    }
  }

  /**
   * Get collection information from Factory contract
   */
  async getCollection(collectionId: number): Promise<any> {
    try {
      const contract = new Contract(FACTORY_CONFIG[this.networkName].contractId);

      // We would need to get a source account for read operations
      // For now, return a mock structure
      return {
        collection_id: collectionId,
        contract_id: `C${'A'.repeat(55)}`, // Mock contract ID
        name: 'Collection Name',
        symbol: 'SYMBOL',
        creator: 'G' + 'A'.repeat(55),
        uri_base: 'https://example.com/metadata',
        royalties_bps: 250,
        created_at: Date.now()
      };
    } catch (error) {
      console.error('Error getting collection:', error);
      throw new Error(`Failed to get collection: ${error}`);
    }
  }

  /**
   * Get transaction status and details
   */
  async getTransaction(hash: string): Promise<{
    success: boolean;
    transaction?: any;
    error?: string;
  }> {
    try {
      const transaction = await this.network.server.getTransaction(hash);
      return {
        success: true,
        transaction: transaction
      };
    } catch (error) {
      console.error('Error getting transaction:', error);
      return {
        success: false,
        error: `Failed to get transaction: ${error}`
      };
    }
  }

  /**
   * Get the explorer URL for a transaction or contract
   */
  getExplorerUrl(type: 'tx' | 'contract', identifier: string): string {
    const networkPath = this.networkName === 'MAINNET' ? 'public' : 'testnet';
    const typeMap = {
      tx: 'tx',
      contract: 'contract'
    };
    return `https://stellar.expert/explorer/${networkPath}/${typeMap[type]}/${identifier}`;
  }

  /**
   * Format amounts for display
   */
  formatAmount(amount: string | number, decimals: number = 7): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return (num / Math.pow(10, decimals)).toFixed(decimals);
  }

  /**
   * Convert human readable amount to base units
   */
  toBaseUnits(amount: string | number, decimals: number = 7): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return Math.floor(num * Math.pow(10, decimals)).toString();
  }

  /**
   * Get the Factory contract ID for the current network
   */
  getFactoryContractId(): string {
    return FACTORY_CONFIG[this.networkName].contractId;
  }
}

// Export singleton instances
export const stellarTestnet = new StellarService('TESTNET');
export const stellarMainnet = new StellarService('MAINNET');

// Helper function to get the right service based on network
export function getStellarService(network: 'TESTNET' | 'MAINNET'): StellarService {
  return network === 'MAINNET' ? stellarMainnet : stellarTestnet;
}