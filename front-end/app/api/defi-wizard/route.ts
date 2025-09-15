import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

interface InvestorProfile {
  riskTolerance?: 'low' | 'medium' | 'high';
  preferredAssets?: string[];
  targetApy?: number;
  liquidityNeed?: number; // percentage that must remain liquid
  investmentHorizon?: 'short' | 'medium' | 'long';
  investmentAmount?: number;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  maxSlippage?: number;
}

interface DeFiAllocation {
  protocol: string;
  strategy: string;
  asset: string;
  percentage: number;
  estimatedApy: number;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

interface DeFiStrategy {
  profile: InvestorProfile;
  allocations: DeFiAllocation[];
  totalEstimatedApy: number;
  totalRiskScore: number;
  warnings: string[];
  fees: {
    dappFee: number;
    protocolFees: number;
    gasEstimate: number;
  };
  network: 'TESTNET' | 'MAINNET';
  isComplete: boolean;
  needsInfo: string[];
}

const SYSTEM_PROMPT = `You are the DeFi Investment Wizard, a knowledgeable financial advisor specializing in decentralized finance on the Stellar blockchain. You help users build personalized DeFi investment strategies using DeFindex protocols.

Your expertise includes:
- DeFindex: A DeFi index protocol on Stellar with various strategies
- Soroswap: DEX for liquidity provision and swapping
- Blend Protocol: Lending and borrowing platform
- Stellar native assets like USDC, XLM, and other tokens
- Liquidity provision strategies and impermanent loss risks
- Yield farming and staking opportunities

Required investor profile information:
- Risk tolerance (low/medium/high)
- Preferred assets (USDC, XLM, etc.)
- Investment amount (in USD)
- Target APY or income goals
- Liquidity needs (% that must stay liquid)
- Investment horizon (short/medium/long term)
- Experience level (beginner/intermediate/advanced)

Optional information:
- Maximum acceptable slippage
- Specific protocols to avoid
- Minimum position sizes

IMPORTANT: The network (TESTNET/MAINNET) is set by the UI and affects available protocols. Always use the network provided in the user context.

DeFi Strategy Guidelines:
- Low risk: Focus on stablecoin lending, established protocols (20-40% APY range)
- Medium risk: Mix of lending, LP positions, yield farming (40-80% APY range)
- High risk: Leveraged strategies, newer protocols, volatile assets (80%+ APY)

Available DeFindex Strategies (adjust based on network):
1. Stable Yield Index: USDC lending on Blend Protocol (8-12% APY, low risk)
2. Balanced Growth Index: Mix of USDC/XLM LP + lending (15-25% APY, medium risk)
3. High Yield Index: Leveraged positions, yield farming (30-60% APY, high risk)
4. Liquidity Provider Index: Multiple LP positions across protocols (20-40% APY, medium-high risk)

Always validate allocations add up to 100% and provide realistic APY estimates based on current market conditions.

You should:
1. Ask follow-up questions to understand the user's full investment profile
2. Provide educational context about DeFi risks and opportunities
3. Be conversational and friendly, using investment advisor language
4. Once complete profile is gathered, return a detailed strategy plan
5. Allow users to iterate and adjust the strategy

Response format:
Always respond with JSON containing:
- message: Your conversational response to the user
- strategy: Current DeFi strategy object with gathered information
- questions: Array of specific questions you still need answered (if any)`;

export async function POST(request: NextRequest) {
  try {
    const { messages, currentStrategy, network } = await request.json();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { 
          role: 'system', 
          content: `${SYSTEM_PROMPT}\n\nCurrent network selection: ${network || 'TESTNET'}. Available protocols and strategies may differ based on network. Testnet has limited protocol options compared to Mainnet.`
        },
        ...messages,
      ],
      functions: [
        {
          name: 'create_defi_strategy',
          description: 'Create a personalized DeFi investment strategy with allocations',
          parameters: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  riskTolerance: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'User risk tolerance level'
                  },
                  preferredAssets: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of preferred assets (USDC, XLM, etc.)'
                  },
                  targetApy: {
                    type: 'number',
                    description: 'Target APY percentage'
                  },
                  liquidityNeed: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                    description: 'Percentage that must remain liquid'
                  },
                  investmentHorizon: {
                    type: 'string',
                    enum: ['short', 'medium', 'long'],
                    description: 'Investment time horizon'
                  },
                  investmentAmount: {
                    type: 'number',
                    minimum: 1,
                    description: 'Total investment amount in USD'
                  },
                  experienceLevel: {
                    type: 'string',
                    enum: ['beginner', 'intermediate', 'advanced'],
                    description: 'DeFi experience level'
                  },
                  maxSlippage: {
                    type: 'number',
                    minimum: 0.1,
                    maximum: 10,
                    description: 'Maximum acceptable slippage percentage'
                  }
                },
                description: 'User investment profile'
              },
              allocations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    protocol: {
                      type: 'string',
                      description: 'Protocol name (DeFindex, Soroswap, Blend)'
                    },
                    strategy: {
                      type: 'string',
                      description: 'Specific strategy name'
                    },
                    asset: {
                      type: 'string',
                      description: 'Asset being used in the strategy'
                    },
                    percentage: {
                      type: 'number',
                      minimum: 0,
                      maximum: 100,
                      description: 'Percentage of total investment'
                    },
                    estimatedApy: {
                      type: 'number',
                      description: 'Estimated APY for this allocation'
                    },
                    riskLevel: {
                      type: 'string',
                      enum: ['low', 'medium', 'high'],
                      description: 'Risk level of this allocation'
                    },
                    description: {
                      type: 'string',
                      description: 'Description of the strategy'
                    }
                  },
                  required: ['protocol', 'strategy', 'asset', 'percentage', 'estimatedApy', 'riskLevel', 'description']
                },
                description: 'Array of DeFi allocations'
              },
              totalEstimatedApy: {
                type: 'number',
                description: 'Weighted average estimated APY'
              },
              totalRiskScore: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description: 'Overall risk score (1-10)'
              },
              warnings: {
                type: 'array',
                items: { type: 'string' },
                description: 'Important warnings and risks'
              },
              fees: {
                type: 'object',
                properties: {
                  dappFee: {
                    type: 'number',
                    description: 'DApp fee percentage'
                  },
                  protocolFees: {
                    type: 'number',
                    description: 'Protocol fees percentage'
                  },
                  gasEstimate: {
                    type: 'number',
                    description: 'Estimated gas costs in USD'
                  }
                },
                required: ['dappFee', 'protocolFees', 'gasEstimate']
              },
              network: {
                type: 'string',
                enum: ['TESTNET', 'MAINNET'],
                description: 'Stellar network (set by UI, do not override)'
              },
              isComplete: {
                type: 'boolean',
                description: 'Whether strategy is complete and ready for execution'
              },
              needsInfo: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of information still needed'
              }
            },
            required: ['network', 'isComplete', 'needsInfo']
          }
        }
      ],
      function_call: 'auto',
      temperature: 0.7,
    });

    const responseMessage = completion.choices[0].message;
    
    if (responseMessage.function_call) {
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);
      
      // Ensure network is set from UI
      if (network) {
        functionArgs.network = network;
      }
      
      // Validate the strategy
      const validatedStrategy = validateDeFiStrategy(functionArgs);
      
      return NextResponse.json({
        message: responseMessage.content || "I've updated your DeFi investment strategy!",
        strategy: validatedStrategy,
        questions: validatedStrategy.needsInfo,
      });
    }

    return NextResponse.json({
      message: responseMessage.content || "I'm here to help you create the perfect DeFi investment strategy! What are your investment goals?",
      strategy: currentStrategy || {
        network: network || 'TESTNET',
        isComplete: false,
        needsInfo: ['riskTolerance', 'investmentAmount', 'preferredAssets'],
        profile: {},
        allocations: [],
        totalEstimatedApy: 0,
        totalRiskScore: 0,
        warnings: [],
        fees: { dappFee: 0, protocolFees: 0, gasEstimate: 0 }
      },
      questions: [],
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

function validateDeFiStrategy(strategy: any): DeFiStrategy {
  const validated: DeFiStrategy = {
    network: strategy.network || 'TESTNET',
    isComplete: false,
    needsInfo: [],
    profile: strategy.profile || {},
    allocations: strategy.allocations || [],
    totalEstimatedApy: strategy.totalEstimatedApy || 0,
    totalRiskScore: strategy.totalRiskScore || 0,
    warnings: strategy.warnings || [],
    fees: strategy.fees || { dappFee: 0, protocolFees: 0, gasEstimate: 0 }
  };

  // Validate required profile fields
  const requiredFields = ['riskTolerance', 'investmentAmount', 'preferredAssets'];
  
  requiredFields.forEach(field => {
    if (!validated.profile[field as keyof InvestorProfile]) {
      validated.needsInfo.push(field);
    }
  });

  // Validate allocations if provided
  if (validated.allocations.length > 0) {
    const totalAllocation = validated.allocations.reduce((sum, alloc) => sum + alloc.percentage, 0);
    if (Math.abs(totalAllocation - 100) > 1) { // Allow 1% tolerance
      validated.needsInfo.push('properAllocation');
      validated.warnings.push('Allocations must total 100%');
    }
  }

  // Check if strategy is complete
  validated.isComplete = validated.needsInfo.length === 0 && validated.allocations.length > 0;

  return validated;
}