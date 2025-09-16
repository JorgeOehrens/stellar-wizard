import { NextRequest, NextResponse } from 'next/server';

const SOROSWAP_BASE_URL = 'https://api.soroswap.finance';

interface QuoteRequest {
  assetIn: string;
  assetOut: string;
  amount: string;
  tradeType: 'EXACT_IN' | 'EXACT_OUT';
  slippageBps: number;
  protocols?: string[];
  network: 'testnet' | 'mainnet';
}

export async function POST(request: NextRequest) {
  try {
    const body: QuoteRequest = await request.json();

    const {
      assetIn,
      assetOut,
      amount,
      tradeType = 'EXACT_IN',
      slippageBps = 50,
      protocols = ['soroswap', 'sdex'],
      network = 'testnet'
    } = body;

    // Validate required fields
    if (!assetIn || !assetOut || !amount) {
      return NextResponse.json({
        error: 'Missing required fields: assetIn, assetOut, amount'
      }, { status: 400 });
    }

    // Prepare quote request for Soroswap
    const quoteRequest = {
      assetIn,
      assetOut,
      amount,
      tradeType,
      protocols,
      maxHops: 2,
      slippageBps
    };

    console.log('Requesting quote from Soroswap:', quoteRequest);

    // Call Soroswap quote API with authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if available
    const apiKey = process.env.SOROSWAP_API_KEY;
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      // Also try X-API-Key header as some APIs use this format
      headers['X-API-Key'] = apiKey;
    }

    const soroswapResponse = await fetch(`${SOROSWAP_BASE_URL}/quote?network=${network}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(quoteRequest)
    });

    if (!soroswapResponse.ok) {
      console.error('Soroswap quote failed:', soroswapResponse.status, await soroswapResponse.text());

      // Return a mock quote for development/fallback
      return NextResponse.json({
        quote: quoteRequest,
        expectedOut: Math.floor(parseInt(amount) * 0.95).toString(), // Mock 5% slippage
        priceImpact: 0.1,
        route: {
          protocols: protocols,
          path: [assetIn, assetOut]
        },
        isMockData: true
      });
    }

    const quoteData = await soroswapResponse.json();

    // Extract relevant information from Soroswap response
    const response = {
      quote: quoteData,
      expectedOut: quoteData.expectedAmountOut || quoteData.amountOut,
      priceImpact: quoteData.priceImpact || 0.1,
      route: quoteData.route || {
        protocols: protocols,
        path: [assetIn, assetOut]
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Quote API error:', error);

    // Return error response
    return NextResponse.json({
      error: 'Failed to get swap quote',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}