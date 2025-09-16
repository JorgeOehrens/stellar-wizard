import { NextRequest, NextResponse } from 'next/server';

const SOROSWAP_BASE_URL = 'https://api.soroswap.finance';

interface BuildRequest {
  assetIn: string;
  assetOut: string;
  amount: string;
  tradeType: 'EXACT_IN' | 'EXACT_OUT';
  slippageBps: number;
  protocols?: string[];
  from: string;
  to: string;
  network: 'testnet' | 'mainnet';
  route?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: BuildRequest = await request.json();

    const {
      assetIn,
      assetOut,
      amount,
      tradeType = 'EXACT_IN',
      slippageBps = 50,
      protocols = ['soroswap', 'sdex'],
      from,
      to,
      network = 'testnet',
      route
    } = body;

    // Validate required fields
    if (!assetIn || !assetOut || !amount || !from || !to) {
      return NextResponse.json({
        error: 'Missing required fields: assetIn, assetOut, amount, from, to'
      }, { status: 400 });
    }

    // First get a fresh quote if we don't have route data
    let quoteData = route;
    if (!quoteData) {
      const quoteRequest = {
        assetIn,
        assetOut,
        amount,
        tradeType,
        protocols,
        maxHops: 2,
        slippageBps
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key if available
      const apiKey = process.env.SOROSWAP_API_KEY;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
      }

      const quoteResponse = await fetch(`${SOROSWAP_BASE_URL}/quote?network=${network}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(quoteRequest)
      });

      if (!quoteResponse.ok) {
        console.error('Failed to get quote for build:', quoteResponse.status);

        // Return mock XDR for development
        return NextResponse.json({
          xdr: 'AAAAAgAAAAA...MOCK_XDR_FOR_DEVELOPMENT...AAAACg==',
          isMockData: true
        });
      }

      quoteData = await quoteResponse.json();
    }

    // Build the swap transaction
    const buildRequest = {
      quote: quoteData,
      from,
      to
    };

    console.log('Building swap transaction:', buildRequest);

    const buildHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if available
    const buildApiKey = process.env.SOROSWAP_API_KEY;
    if (buildApiKey) {
      buildHeaders['Authorization'] = `Bearer ${buildApiKey}`;
      buildHeaders['X-API-Key'] = buildApiKey;
    }

    const buildResponse = await fetch(`${SOROSWAP_BASE_URL}/quote/build?network=${network}`, {
      method: 'POST',
      headers: buildHeaders,
      body: JSON.stringify(buildRequest)
    });

    if (!buildResponse.ok) {
      console.error('Soroswap build failed:', buildResponse.status, await buildResponse.text());

      // Return mock XDR for development
      return NextResponse.json({
        xdr: 'AAAAAgAAAAA...MOCK_XDR_FOR_DEVELOPMENT...AAAACg==',
        isMockData: true
      });
    }

    const buildData = await buildResponse.json();

    return NextResponse.json({
      xdr: buildData.xdr || buildData.transaction,
      quote: quoteData,
      fee: buildData.fee
    });

  } catch (error) {
    console.error('Build API error:', error);

    // Return mock XDR for development/testing
    return NextResponse.json({
      xdr: 'AAAAAgAAAAA...MOCK_XDR_FOR_DEVELOPMENT...AAAACg==',
      isMockData: true,
      error: error instanceof Error ? error.message : 'Build failed'
    });
  }
}