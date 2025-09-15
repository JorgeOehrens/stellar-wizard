import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { signedXdr, network } = await request.json();

    if (!signedXdr || !network) {
      return NextResponse.json(
        { error: 'Missing signed XDR or network' },
        { status: 400 }
      );
    }

    // For now, return a mock transaction hash and explorer URL
    // In a real implementation, you would:
    // 1. Submit the signed XDR to the Stellar network
    // 2. Return the actual transaction hash and explorer URL

    const mockHash = `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const explorerBaseUrl = network === 'MAINNET' 
      ? 'https://stellarexpert.io/explorer/public/tx'
      : 'https://stellarexpert.io/explorer/testnet/tx';

    // Simulate network submission time
    await new Promise(resolve => setTimeout(resolve, 2000));

    return NextResponse.json({
      hash: mockHash,
      explorerUrl: `${explorerBaseUrl}/${mockHash}`,
      network
    });

  } catch (error) {
    console.error('Transaction submit API error:', error);
    return NextResponse.json(
      { error: 'Failed to submit transaction' },
      { status: 500 }
    );
  }
}