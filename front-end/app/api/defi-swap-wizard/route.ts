import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SwapPlan {
  assetIn: string;
  assetOut: string;
  amount: string;
  tradeType: 'EXACT_IN' | 'EXACT_OUT';
  slippageBps: number;
  protocols?: string[];
  from: string;
  to: string;
  network: 'testnet' | 'mainnet';
  assetInSymbol?: string;
  assetOutSymbol?: string;
  expectedOut?: string;
  priceImpact?: number;
  route?: any;
}

// Common Stellar assets for validation and symbol resolution
const STELLAR_ASSETS = {
  testnet: {
    'XLM': 'native',
    'USDC': 'CCKF7RF3LMQMWB4NMN5UWDTPGQ7AURZQSLHDMDC6BVHBSRQ7BXQWAFCH',
    'AQUA': 'CAP4JPEZYB5EBYCS7BEU3JJDJFNFNHLH4B4E7ZQDWSAJVX4WPYC3MZ6C',
    'yXLM': 'CDZPWMXSRK6L6ZYUV4WL3NZFYC2T3KSRXHC7CJTUNFH2TGUWZKVSBVPG'
  },
  mainnet: {
    'XLM': 'native',
    'USDC': 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    'AQUA': 'GBUYQB5AZQMXNSPZ7PDMF5RLMM3UXDAEWBZJ7ZVEYP5JGMRJR3V4GFFX',
    'yXLM': 'GDNGLAVOAZMI2LZJNR3BFUZN5HZPQFIJ2AQDCF7GZS35XJZBKP5R7IFQ'
  }
};

function parseUserIntent(messages: Message[]): {
  intent: 'invest' | 'swap' | 'unknown';
  assets?: { in?: string; out?: string };
  amount?: string;
} {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';

  // Check for explicit flow choice
  if (lastMessage.includes('swap') || lastMessage.includes('exchange') || lastMessage.includes('trade')) {
    return { intent: 'swap' };
  }

  if (lastMessage.includes('invest') || lastMessage.includes('strategy') || lastMessage.includes('portfolio')) {
    return { intent: 'invest' };
  }

  // Parse swap-specific information
  const swapKeywords = ['swap', 'exchange', 'trade', 'convert'];
  const hasSwapKeyword = swapKeywords.some(keyword => lastMessage.includes(keyword));

  if (hasSwapKeyword) {
    return { intent: 'swap' };
  }

  return { intent: 'unknown' };
}

function resolveAssetAddress(symbol: string, network: 'testnet' | 'mainnet'): string | null {
  const assets = STELLAR_ASSETS[network];
  const upperSymbol = symbol.toUpperCase();

  if (assets[upperSymbol as keyof typeof assets]) {
    return assets[upperSymbol as keyof typeof assets];
  }

  // If it looks like a contract address (starts with C and is ~56 chars), return as-is
  if (symbol.startsWith('C') && symbol.length >= 50) {
    return symbol;
  }

  return null;
}

function extractSwapInfo(content: string, network: 'testnet' | 'mainnet'): {
  assetIn?: string;
  assetOut?: string;
  amount?: string;
  assetInSymbol?: string;
  assetOutSymbol?: string;
} {
  const result: any = {};

  // Common patterns for swap requests
  const patterns = [
    /swap (\d+(?:\.\d+)?)\s*(\w+)\s*(?:for|to)\s*(\w+)/i,
    /exchange (\d+(?:\.\d+)?)\s*(\w+)\s*(?:for|to)\s*(\w+)/i,
    /(\d+(?:\.\d+)?)\s*(\w+)\s*(?:for|to)\s*(\w+)/i,
    /(\w+)\s*(?:for|to)\s*(\w+)/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      if (match.length >= 4) {
        // Pattern with amount
        result.amount = match[1];
        result.assetInSymbol = match[2];
        result.assetOutSymbol = match[3];
      } else if (match.length >= 3) {
        // Pattern without amount
        result.assetInSymbol = match[1];
        result.assetOutSymbol = match[2];
      }
      break;
    }
  }

  // Resolve symbols to addresses
  if (result.assetInSymbol) {
    result.assetIn = resolveAssetAddress(result.assetInSymbol, network);
  }
  if (result.assetOutSymbol) {
    result.assetOut = resolveAssetAddress(result.assetOutSymbol, network);
  }

  return result;
}

function formatSwapResponse(swapPlan: SwapPlan, isComplete: boolean): string {
  if (!swapPlan.assetIn || !swapPlan.assetOut) {
    return "I'd be happy to help you swap tokens! Please tell me:\n\n" +
           "🔹 What token do you want to swap FROM?\n" +
           "🔹 What token do you want to swap TO?\n" +
           "🔹 How much do you want to swap?\n\n" +
           "For example: 'Swap 100 USDC for XLM' or 'Exchange 50 XLM to AQUA'";
  }

  if (!swapPlan.amount) {
    return `Great! I see you want to swap **${swapPlan.assetInSymbol || 'tokens'}** for **${swapPlan.assetOutSymbol || 'tokens'}**.\n\n` +
           "How much would you like to swap? Please specify the amount.";
  }

  if (isComplete) {
    return `🔁 **Swap Configuration Complete!**\n\n` +
           `**From:** ${swapPlan.assetInSymbol} (${swapPlan.assetIn})\n` +
           `**To:** ${swapPlan.assetOutSymbol} (${swapPlan.assetOut})\n` +
           `**Amount:** ${swapPlan.amount}\n` +
           `**Slippage:** ${(swapPlan.slippageBps / 100).toFixed(2)}%\n` +
           `**Network:** ${swapPlan.network}\n\n` +
           "Ready to proceed with the swap review!";
  }

  return "I'm collecting your swap preferences. Is there anything else you'd like to adjust?";
}

function formatSwapConfirmation(swapPlan: SwapPlan, transaction: any): string {
  const amountHuman = parseFloat(swapPlan.amount) / 1e7;
  const expectedOutHuman = swapPlan.expectedOut ?
    (parseFloat(swapPlan.expectedOut) / 1e7).toFixed(4) : 'calculating...';

  return `🔄 **Swap Transaction Ready**

### Swap Details
- **From:** ${amountHuman.toFixed(4)} ${swapPlan.assetInSymbol || 'tokens'}
- **To:** ~${expectedOutHuman} ${swapPlan.assetOutSymbol || 'tokens'}
- **Price Impact:** ${(swapPlan.priceImpact || 0).toFixed(2)}%
- **Slippage:** ${(swapPlan.slippageBps / 100).toFixed(2)}%
- **Network:** ${swapPlan.network}

### Route
${swapPlan.route ?
  `- **Protocols:** ${Array.isArray(swapPlan.route.protocols) ? swapPlan.route.protocols.join(', ') : 'Direct'}
- **Path:** ${Array.isArray(swapPlan.route.path) ? swapPlan.route.path.map(p => p.slice(0, 8) + '...').join(' → ') : 'Direct swap'}` :
  '- **Route:** Direct swap'
}

${transaction.fee ? `### Estimated Fee
- **Network Fee:** ${transaction.fee} XLM` : ''}

**Next Steps:**
✅ **Confirm and sign** (I'll prepare for wallet signature)
🔄 **Adjust swap** (change amount or tokens)
❌ **Cancel**

⚠️ **Please verify all details before signing. This transaction cannot be reversed.**`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, currentSwapPlan, flowType, network, userAddress } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({
        error: 'Invalid request: messages array required'
      }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1];

    if (!lastUserMessage || lastUserMessage.role !== 'user') {
      return NextResponse.json({
        error: 'Invalid request: last message must be from user'
      }, { status: 400 });
    }

    // Parse user intent if not already determined
    let detectedFlowType = flowType;
    if (flowType === 'initial') {
      const intent = parseUserIntent(messages);
      if (intent.intent === 'swap') {
        detectedFlowType = 'swap';
      } else if (intent.intent === 'invest') {
        detectedFlowType = 'invest';
      }
    }

    // If this is not a swap flow, redirect to investment wizard
    if (detectedFlowType !== 'swap') {
      return NextResponse.json({
        message: "I see you're interested in investing! Let me redirect you to our investment advisor who can help you build a personalized DeFi strategy.",
        flowType: 'invest'
      });
    }

    // Extract swap information from the user's message
    const swapInfo = extractSwapInfo(lastUserMessage.content, network);

    // Update swap plan with new information
    const updatedSwapPlan: SwapPlan = {
      assetIn: '',
      assetOut: '',
      amount: '',
      tradeType: 'EXACT_IN',
      slippageBps: 50,
      protocols: ['soroswap', 'sdex'],
      from: '',
      to: '',
      network: network,
      ...currentSwapPlan,
      from: userAddress || currentSwapPlan?.from || '',
      to: userAddress || currentSwapPlan?.to || '',
      ...swapInfo
    };

    // Convert human-readable amounts to base units if needed
    if (updatedSwapPlan.amount && !updatedSwapPlan.amount.includes('0000000')) {
      // Assume 7 decimals for most Stellar assets
      const humanAmount = parseFloat(updatedSwapPlan.amount);
      if (!isNaN(humanAmount)) {
        updatedSwapPlan.amount = Math.floor(humanAmount * 10000000).toString();
      }
    }

    // Check if swap plan is complete
    const isSwapComplete = !!(
      updatedSwapPlan.assetIn &&
      updatedSwapPlan.assetOut &&
      updatedSwapPlan.amount &&
      updatedSwapPlan.from
    );

    // Get quote if swap is complete
    if (isSwapComplete) {
      try {
        const port = process.env.PORT || '3000';
        const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

        const quoteResponse = await fetch(`${baseUrl}/api/swap/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSwapPlan)
        });

        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          updatedSwapPlan.expectedOut = quoteData.expectedOut;
          updatedSwapPlan.priceImpact = quoteData.priceImpact;
          updatedSwapPlan.route = quoteData.route;
        }
      } catch (error) {
        console.error('Failed to get swap quote:', error);
      }
    }

    // Generate response message using the appropriate flow stage
    let responseMessage: string;
    let swapTransaction: any = null;

    if (isSwapComplete) {
      // Call Soroswap build to prepare transaction
      try {
        const port = process.env.PORT || '3000';
        const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

        const buildResponse = await fetch(`${baseUrl}/api/swap/build`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSwapPlan)
        });

        if (buildResponse.ok) {
          const buildData = await buildResponse.json();
          swapTransaction = {
            xdr: buildData.xdr,
            quote: buildData.quote,
            fee: buildData.fee
          };
          responseMessage = formatSwapConfirmation(updatedSwapPlan, swapTransaction);
        } else {
          responseMessage = formatSwapResponse(updatedSwapPlan, isSwapComplete);
        }
      } catch (error) {
        console.error('Failed to build swap transaction:', error);
        responseMessage = formatSwapResponse(updatedSwapPlan, isSwapComplete);
      }
    } else {
      responseMessage = formatSwapResponse(updatedSwapPlan, isSwapComplete);
    }

    return NextResponse.json({
      message: responseMessage,
      swapPlan: updatedSwapPlan,
      swapReady: isSwapComplete,
      swapTransaction,
      flowType: 'swap'
    });

  } catch (error) {
    console.error('Swap wizard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}