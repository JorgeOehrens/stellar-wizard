import { NextRequest, NextResponse } from 'next/server';

const SOROSWAP_BASE_URL = 'https://api.soroswap.finance';

interface SubmitRequest {
  xdr: string;
  network: 'testnet' | 'mainnet';
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitRequest = await request.json();

    const { xdr, network = 'testnet' } = body;

    // Validate required fields
    if (!xdr) {
      return NextResponse.json({
        error: 'Missing required field: xdr'
      }, { status: 400 });
    }

    // Check if this is mock data
    if (xdr.includes('MOCK_XDR_FOR_DEVELOPMENT')) {
      // Return a mock transaction hash for development
      const mockHash = `${'a'.repeat(64)}`;
      return NextResponse.json({
        hash: mockHash,
        status: 'success',
        isMockData: true
      });
    }

    console.log('Submitting transaction to Soroswap:', { xdr: xdr.substring(0, 20) + '...', network });

    // Submit the signed transaction to Soroswap
    const submitResponse = await fetch(`${SOROSWAP_BASE_URL}/send?network=${network}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ xdr })
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('Soroswap submit failed:', submitResponse.status, errorText);

      return NextResponse.json({
        error: 'Failed to submit transaction',
        details: errorText,
        status: submitResponse.status
      }, { status: submitResponse.status });
    }

    const submitData = await submitResponse.json();

    return NextResponse.json({
      hash: submitData.hash || submitData.transactionHash,
      status: submitData.status || 'success',
      result: submitData
    });

  } catch (error) {
    console.error('Submit API error:', error);

    return NextResponse.json({
      error: 'Failed to submit transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}