import { NextRequest, NextResponse } from 'next/server';

export interface InvestmentRequest {
  vaultAddress: string;
  amount: number; // in human units
  asset: string;
  userAddress: string;
  network: 'testnet' | 'mainnet';
}

export interface InvestmentResponse {
  xdr: string;
  vaultAddress: string;
  amount: string; // in stroops
  estimatedGas: number;
  network: string;
}

/**
 * POST /api/defindex/invest
 * Build XDR transaction for vault investment
 */
export async function POST(request: NextRequest) {
  try {
    const body: InvestmentRequest = await request.json();

    // Validate required fields
    if (!body.vaultAddress || !body.amount || !body.userAddress || !body.network) {
      return NextResponse.json(
        { error: 'Missing required fields: vaultAddress, amount, userAddress, network' },
        { status: 400 }
      );
    }

    // Validate amount
    if (body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate vault address format (Stellar address)
    if (!body.vaultAddress.match(/^[C][A-Z0-9]{55}$/)) {
      return NextResponse.json(
        { error: 'Invalid vault address format' },
        { status: 400 }
      );
    }

    // Validate user address format
    if (!body.userAddress.match(/^[G][A-Z0-9]{55}$/)) {
      return NextResponse.json(
        { error: 'Invalid user address format' },
        { status: 400 }
      );
    }

    // Convert amount to stroops (7 decimal places)
    const amountInStroops = Math.floor(body.amount * 1e7).toString();

    // In a real implementation, this would build an actual Stellar transaction
    // For now, we'll create a mock XDR that represents the investment transaction
    const mockXdr = generateMockInvestmentXdr({
      vaultAddress: body.vaultAddress,
      userAddress: body.userAddress,
      amount: amountInStroops,
      asset: body.asset,
      network: body.network
    });

    const response: InvestmentResponse = {
      xdr: mockXdr,
      vaultAddress: body.vaultAddress,
      amount: amountInStroops,
      estimatedGas: 0.1, // Estimated transaction fee in USD
      network: body.network
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error building investment transaction:', error);
    return NextResponse.json(
      { error: 'Failed to build investment transaction' },
      { status: 500 }
    );
  }
}

function generateMockInvestmentXdr(params: {
  vaultAddress: string;
  userAddress: string;
  amount: string;
  asset: string;
  network: string;
}): string {
  // This is a mock XDR for demonstration purposes
  // In a real implementation, you would use the Stellar SDK to build the actual transaction
  // that calls the vault's deposit/invest function with the specified parameters

  const mockOperations = [
    {
      type: 'invoke_contract',
      contractAddress: params.vaultAddress,
      function: 'deposit',
      args: [
        { type: 'address', value: params.userAddress },
        { type: 'u128', value: params.amount },
        { type: 'address', value: params.asset }
      ]
    }
  ];

  // This would normally be a properly encoded XDR string
  // For demo purposes, we'll create a base64-encoded representation
  const mockTransaction = {
    network: params.network,
    source: params.userAddress,
    operations: mockOperations,
    fee: '100000', // 0.01 XLM
    sequence: Date.now().toString(),
    timestamp: Date.now()
  };

  // Convert to base64 (mock XDR)
  return Buffer.from(JSON.stringify(mockTransaction)).toString('base64');
}

/**
 * GET /api/defindex/invest/estimate
 * Estimate investment transaction costs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('amount');
    const vaultAddress = searchParams.get('vaultAddress');
    const network = searchParams.get('network') || 'testnet';

    if (!amount || !vaultAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: amount, vaultAddress' },
        { status: 400 }
      );
    }

    // Calculate estimated costs
    const estimatedCosts = {
      transactionFee: 0.0001, // XLM
      transactionFeeUsd: 0.01, // Approximate USD value
      protocolFee: parseFloat(amount) * 0.005, // 0.5% protocol fee
      slippage: parseFloat(amount) * 0.001, // 0.1% estimated slippage
      totalCostUsd: 0.01 + (parseFloat(amount) * 0.006) // Combined costs
    };

    return NextResponse.json({
      estimation: estimatedCosts,
      vaultAddress,
      amount,
      network,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error estimating investment costs:', error);
    return NextResponse.json(
      { error: 'Failed to estimate costs' },
      { status: 500 }
    );
  }
}