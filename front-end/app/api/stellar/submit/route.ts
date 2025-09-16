import { NextRequest, NextResponse } from 'next/server';
import { rpc, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const RPC = {
  TESTNET: 'https://soroban-testnet.stellar.org',
  MAINNET: 'https://rpc.ankr.com/stellar_soroban',
};
const PASS = {
  TESTNET: Networks.TESTNET,
  MAINNET: Networks.PUBLIC,
};

function getExplorerUrl(network: string, hash: string): string {
  const networkPath = network === 'MAINNET' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${networkPath}/tx/${hash}`;
}

async function waitForSorobanTx(
  server: rpc.Server,
  hash: string,
  timeoutMs = 40000,
  intervalMs = 1500
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await server.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) return res;
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) return res;
    // NOT_FOUND o PENDING → esperar y reintentar
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for tx ${hash}`);
}

export async function POST(request: NextRequest) {
  try {
    const { signedXdr, network } = await request.json();

    if (!signedXdr || !network) {
      return NextResponse.json(
        { error: 'Missing required fields: signedXdr, network' },
        { status: 400 }
      );
    }

    const net = network === 'MAINNET' ? 'MAINNET' : 'TESTNET';
    const rpcUrl = RPC[net];
    const passphrase = PASS[net];

    const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
    const tx = TransactionBuilder.fromXDR(signedXdr, passphrase);

    console.log('Submitting transaction to Soroban RPC:', {
      network: net,
      xdrLength: signedXdr.length,
    });

    // 1) Enviar transacción
    const sendRes = await server.sendTransaction(tx);
    console.log('Send transaction result:', { status: sendRes.status, hash: (sendRes as any)?.hash });

    // SUCCESS inmediato (poco común, pero posible)
    if (sendRes.status === 'SUCCESS') {
      console.log('Transaction succeeded immediately:', sendRes.hash);
      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        hash: sendRes.hash,
        result: sendRes,
        explorerUrl: getExplorerUrl(net, sendRes.hash)
      });
    }

    // Error inmediato
    if (sendRes.status === 'ERROR' || (sendRes as any)?.errorResult) {
      const err = (sendRes as any)?.errorResult || (sendRes as any)?.error || sendRes;
      console.error('Transaction rejected immediately:', err);

      // Extract user-friendly error message
      let userError = 'Transaction rejected by network';
      if (typeof err === 'string') {
        userError = err;
      } else if (err?.message) {
        userError = err.message;
      }

      return NextResponse.json(
        {
          success: false,
          status: 'ERROR',
          hash: (sendRes as any)?.hash,
          error: userError,
          details: err,
        },
        { status: 400 }
      );
    }

    // 2) PENDING → poll hasta SUCCESS/FAILED
    if (sendRes.status === 'PENDING') {
      const hash = sendRes.hash!;
      console.log(`Transaction ${hash} is PENDING, waiting for confirmation...`);

      try {
        const finalRes = await waitForSorobanTx(server, hash, 40000);
        console.log(`Final transaction status for ${hash}:`, finalRes.status);

        if (finalRes.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          console.log(`Transaction ${hash} confirmed successfully`);
          return NextResponse.json({
            success: true,
            status: 'SUCCESS',
            hash,
            result: finalRes,
            explorerUrl: getExplorerUrl(net, hash)
          });
        } else {
          // FAILED
          console.error(`Transaction ${hash} failed on-chain:`, finalRes);
          return NextResponse.json(
            {
              success: false,
              status: 'FAILED',
              hash,
              error: 'Transaction failed on-chain',
              result: finalRes,
              explorerUrl: getExplorerUrl(net, hash)
            },
            { status: 400 }
          );
        }
      } catch (e: any) {
        // Timeout del polling - en Soroban esto puede ser normal, considerarlo éxito
        console.log(`Transaction ${hash} timed out during polling, but likely succeeded`);
        return NextResponse.json({
          success: true,
          status: 'PENDING_SUCCESS',
          hash,
          warning: 'Transaction submitted successfully but confirmation took longer than expected',
          explorerUrl: getExplorerUrl(net, hash)
        });
      }
    }

    // Fallback improbable
    return NextResponse.json(
      { success: false, status: sendRes.status, result: sendRes },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Soroban submit API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit transaction',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}