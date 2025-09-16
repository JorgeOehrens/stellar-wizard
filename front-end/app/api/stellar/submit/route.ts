import { NextRequest, NextResponse } from 'next/server';
import { getStellarService } from '../../../../lib/stellar';

export async function POST(request: NextRequest) {
  try {
    const { signedXdr, network } = await request.json();

    // Validate required fields
    if (!signedXdr || !network) {
      return NextResponse.json(
        { error: 'Missing required fields: signedXdr, network' },
        { status: 400 }
      );
    }

    // Validate network
    const stellarNetwork = network === 'MAINNET' ? 'MAINNET' : 'TESTNET';
    const stellarService = getStellarService(stellarNetwork);

    console.log('Submitting transaction to Stellar network:', {
      network: stellarNetwork,
      xdrLength: signedXdr.length
    });

    // Submit the signed transaction with retry logic
    const result = await stellarService.submitTransaction(signedXdr, 3);

    if (result.success) {
      console.log('Transaction submitted successfully:', result.hash);

      return NextResponse.json({
        success: true,
        hash: result.hash,
        network: stellarNetwork,
        explorerUrl: stellarService.getExplorerUrl('tx', result.hash),
        result: result.result
      });
    } else {
      console.error('Transaction submission failed:', result.error);

      // Provide more specific error messages
      let userFriendlyError = result.error || 'Transaction submission failed';

      if (result.error?.includes('insufficient')) {
        userFriendlyError = 'Insufficient XLM balance to pay transaction fees';
      } else if (result.error?.includes('timeout')) {
        userFriendlyError = 'Network timeout - please try again';
      } else if (result.error?.includes('sequence')) {
        userFriendlyError = 'Account sequence number error - please refresh and try again';
      } else if (result.error?.includes('pending')) {
        userFriendlyError = 'Transaction is taking longer than expected to process';
      }

      return NextResponse.json(
        {
          success: false,
          error: userFriendlyError,
          hash: result.hash,
          originalError: result.error
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Stellar submit API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}