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

const SYSTEM_PROMPT = `You are the DeFi Investment Wizard, a knowledgeable financial advisor specializing in decentralized finance on the Stellar blockchain. You help users build personalized DeFi investment strategies using DeFindex vault recommendations and projected returns.

CRITICAL CONVERSATION STATE RULES:
1. NEVER restart or reset the conversation flow once investment profile gathering has begun
2. Always preserve and build upon previously collected user information
3. Parse user messages for multiple profile fields at once (e.g., "Aggressive 12 months 1000 USD")
4. Only ask for missing information, never re-ask for information already provided
5. Progress through states: intro → profile gathering → vault recommendation → confirmation

CONVERSATION FLOW:
State 1: Introduction (only if no profile data exists)
State 2: Profile Gathering - Collect required fields through natural conversation
State 3: Vault Recommendation - Show recommendation with projections
State 4: Confirmation - Ask user to proceed, adjust, or cancel

INTELLIGENT INPUT PARSING:
- Extract multiple fields from single user messages
- Examples:
  * "Aggressive 12 months 1000 USD" → risk: Aggressive, timeHorizon: 12, amount: 1000
  * "Conservative investor, 6 months, beginner" → risk: Conservative, timeHorizon: 6, experience: beginner
  * "I want to invest 500 dollars for 18 months, balanced risk" → amount: 500, timeHorizon: 18, risk: Balanced

Required investor profile information:
- Investment amount (in human units like "1000 USDC" or "500 USD")
- Risk tolerance (Conservative/Balanced/Aggressive)
- Time horizon (6, 12, 18, or 24 months)
- Liquidity needs (Low/Medium/High or short/medium/long term)
- Experience level (Beginner/Intermediate/Advanced)

PROFILE COMPLETION LOGIC:
- If ANY required field is missing, ask conversationally for the missing fields only
- When ALL required fields are present, immediately call defindex_recommend_and_project function
- NEVER restart the conversation or ask for already-provided information
- Convert investment amount to base units (amount * 1e7) before calling the function

When you have complete profile information, call defindex_recommend_and_project and show comprehensive results including:

### 🎯 Your Recommended Strategy
- **Vault:** {vaultAddress}
- **Risk:** {riskLevel}
- **Time horizon:** {timeHorizon} months
- **Amount:** {amount} USD
- **Why:** {rationale}

📈 **Projected Balance (Network: {network})**
- Initial: **{amount} USD**
- Assumed APY: **{apy}%** (monthly compounding)

**6 months:** ≈ **{projection}**
**12 months:** ≈ **{projection}**
**18 months:** ≈ **{projection}**
**24 months:** ≈ **{projection}**

💡 *Note:* APY is estimated from vault clustering analysis.

**Next Steps:**
✅ **Confirm and invest** (I'll prepare the transaction)
🔄 **Adjust strategy** (change your preferences)
❌ **Cancel**

Always include disclaimer: "This is not financial advice. Returns are estimates and not guaranteed."

Response format:
Always respond with JSON containing:
- message: Your conversational response to the user (use markdown formatting)
- strategy: Current DeFi strategy object with gathered information
- questions: Array of specific questions you still need answered (if any)`;

function parseUserIntent(messages: any[]): 'invest' | 'swap' | 'unknown' {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';

  // Check for explicit flow choice
  if (lastMessage.includes('swap') || lastMessage.includes('exchange') || lastMessage.includes('trade')) {
    return 'swap';
  }

  if (lastMessage.includes('invest') || lastMessage.includes('strategy') || lastMessage.includes('portfolio')) {
    return 'invest';
  }

  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const { messages, currentStrategy, network, flowType, userAddress, currentSwapPlan } = await request.json();

    console.log('DeFi Wizard Request:', {
      flowType,
      lastMessage: messages[messages.length - 1]?.content,
      messagesLength: messages.length,
      hasCurrentStrategy: !!currentStrategy,
      hasSwapPlan: !!currentSwapPlan
    });

    // Only handle flow type detection for truly initial messages (no current strategy or flowType)
    if ((flowType === 'initial' || flowType === undefined) &&
        (!currentStrategy || !currentStrategy?.profile || Object.keys(currentStrategy.profile).length === 0) &&
        messages.length <= 2) {
      const intent = parseUserIntent(messages);

      if (intent === 'swap') {
        // Handle swap flow directly
        const swapResponse = await handleSwapFlow(messages, network, userAddress);
        return NextResponse.json({
          ...swapResponse,
          flowType: 'swap'
        });
      }

      if (intent === 'unknown') {
        return NextResponse.json({
          message: "Hi! I'm your DeFi Wizard. I can help you with:\n\n🔹 **Invest** - Build personalized DeFi investment strategies\n🔹 **Swap** - Exchange tokens with optimal routing\n\nWhat would you like to do?",
          strategy: currentStrategy || {
            network: network || 'TESTNET',
            isComplete: false,
            needsInfo: ['riskTolerance', 'investmentAmount', 'timeHorizon'],
            profile: {},
            allocations: [],
            totalEstimatedApy: 0,
            totalRiskScore: 0,
            warnings: [],
            fees: { dappFee: 0, protocolFees: 0, gasEstimate: 0 }
          }
        });
      }
    }

    // Handle ongoing swap flow
    if (flowType === 'swap') {
      const swapResponse = await handleSwapFlow(messages, network, userAddress, currentSwapPlan);
      return NextResponse.json({
        ...swapResponse,
        flowType: 'swap'
      });
    }

    // Handle investment flow - check if profile is complete and call function directly
    if (currentStrategy && !currentStrategy.isComplete) {
      const isProfileComplete = checkIfProfileComplete(currentStrategy.profile);
      if (isProfileComplete) {
        console.log('Profile is complete, calling defindex_recommend_and_project directly');
        try {
          const recommendResponse = await callDefIndexRecommendAndProject(currentStrategy.profile, network);
          const message = formatComprehensiveInvestmentSummary(
            recommendResponse.vault,
            recommendResponse.projection,
            recommendResponse.apiCalls,
            {
              amountBase: (currentStrategy.profile.investmentAmount * 1e7).toString(),
              risk: capitalizeFirst(currentStrategy.profile.riskTolerance),
              horizonMonths: currentStrategy.profile.timeHorizon,
              network
            },
            recommendResponse.fallbackUsed
          );

          const strategy = {
            ...currentStrategy,
            isComplete: true,
            chosenVault: recommendResponse.vault,
            projections: recommendResponse.projection,
            apiCalls: recommendResponse.apiCalls
          };

          return NextResponse.json({
            message,
            strategy,
            questions: []
          });
        } catch (error) {
          console.error('Error calling defindex_recommend_and_project:', error);
        }
      }
    }

    // Build system context with current strategy state
    let systemContext = `${SYSTEM_PROMPT}\n\nCurrent network selection: ${network || 'TESTNET'}. Available protocols and strategies may differ based on network. Testnet has limited protocol options compared to Mainnet.`;

    if (currentStrategy?.profile) {
      systemContext += `\n\nCURRENT STRATEGY STATE:`;
      systemContext += `\nProfile: ${JSON.stringify(currentStrategy.profile)}`;
      systemContext += `\nNeeds info: ${JSON.stringify(currentStrategy.needsInfo || [])}`;
      systemContext += `\nIs complete: ${currentStrategy.isComplete || false}`;
      systemContext += `\n\nIMPORTANT: Build upon this existing information. Do not restart or ask for information already provided.`;
    }


    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemContext

        },
        ...messages,
      ],
      functions: [
        {
          name: 'defindex_recommend_and_project',
          description: 'Get complete vault recommendation with projections - guarantees a specific vault selection',
          parameters: {
            type: 'object',
            properties: {
              amountBase: {
                type: 'string',
                description: 'Investment amount in base units (amount * 1e7)'
              },
              risk: {
                type: 'string',
                enum: ['Conservative', 'Balanced', 'Aggressive'],
                description: 'User risk tolerance level'
              },
              horizonMonths: {
                type: 'integer',
                enum: [6, 12, 18, 24],
                description: 'Investment time horizon in months'
              },
              network: {
                type: 'string',
                enum: ['testnet', 'mainnet'],
                description: 'Stellar network (testnet or mainnet)'
              },
              liquidityNeeds: {
                type: 'string',
                enum: ['Low', 'Medium', 'High'],
                description: 'User liquidity requirements',
                default: 'Medium'
              },
              experienceLevel: {
                type: 'string',
                enum: ['Beginner', 'Intermediate', 'Advanced'],
                description: 'DeFi experience level',
                default: 'Intermediate'
              }
            },
            required: ['amountBase', 'risk', 'horizonMonths', 'network']
          }
        },
        {
          name: 'update_profile',
          description: 'Update user investment profile with new information gathered from conversation',
          parameters: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  riskTolerance: {
                    type: 'string',
                    enum: ['Conservative', 'Balanced', 'Aggressive'],
                    description: 'User risk tolerance level'
                  },
                  investmentAmount: {
                    type: 'number',
                    minimum: 1,
                    description: 'Investment amount in USD'
                  },
                  timeHorizon: {
                    type: 'number',
                    enum: [6, 12, 18, 24],
                    description: 'Investment time horizon in months'
                  },
                  liquidityNeeds: {
                    type: 'string',
                    enum: ['Low', 'Medium', 'High'],
                    description: 'User liquidity requirements'
                  },
                  experienceLevel: {
                    type: 'string',
                    enum: ['Beginner', 'Intermediate', 'Advanced'],
                    description: 'DeFi experience level'
                  }
                }
              },
              needsInfo: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of information still needed to complete profile'
              },
              isComplete: {
                type: 'boolean',
                description: 'Whether profile is complete and ready for vault recommendation'
              }
            },
            required: ['profile', 'needsInfo', 'isComplete']
          }
        },
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

      if (responseMessage.function_call.name === 'update_profile') {
        // Handle profile update - merge new profile data with existing strategy
        const updatedStrategy = {
          ...currentStrategy,
          profile: {
            ...currentStrategy?.profile,
            ...functionArgs.profile,
            // Convert risk tolerance to lowercase for consistency
            riskTolerance: functionArgs.profile.riskTolerance?.toLowerCase(),
            // Convert time horizon to investment horizon format
            investmentHorizon: functionArgs.profile.timeHorizon > 18 ? 'long' :
                              functionArgs.profile.timeHorizon > 12 ? 'medium' : 'short'
          },
          needsInfo: functionArgs.needsInfo,
          isComplete: functionArgs.isComplete,
          network: network || 'TESTNET'
        };

        return NextResponse.json({
          message: responseMessage.content || "I've updated your investment profile. Let me know if you have any other preferences to share!",
          strategy: updatedStrategy,
          questions: functionArgs.needsInfo
        });
      } else if (responseMessage.function_call.name === 'defindex_recommend_and_project') {
        // Handle combined vault recommendation and projection
        try {
          const port = process.env.PORT || '3000';
          const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

          const response = await fetch(`${baseUrl}/api/defindex/recommend-and-project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(functionArgs)
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to get vault recommendation');
          }

          // Format the comprehensive investment summary message
          const message = formatComprehensiveInvestmentSummary(
            data.vault,
            data.projection,
            data.apiCalls,
            functionArgs,
            data.fallbackUsed
          );

          // Create a strategy object that indicates completion
          const strategy = {
            profile: {
              riskTolerance: functionArgs.risk.toLowerCase(),
              investmentAmount: parseFloat(functionArgs.amountBase) / 1e7,
              targetApy: data.vault.assumedApy,
              investmentHorizon: functionArgs.horizonMonths > 18 ? 'long' : functionArgs.horizonMonths > 12 ? 'medium' : 'short',
              experienceLevel: functionArgs.experienceLevel?.toLowerCase() || 'intermediate',
              timeHorizon: functionArgs.horizonMonths
            },
            allocations: data.vault.allocations.map((alloc: any) => ({
              protocol: 'DeFindex',
              strategy: `Strategy ${alloc.strategyId.slice(0, 8)}...`,
              asset: data.vault.assetId,
              percentage: alloc.percent,
              estimatedApy: data.vault.assumedApy,
              riskLevel: data.vault.riskLabel.toLowerCase(),
              description: `${alloc.percent.toFixed(2)}% allocation to strategy ${alloc.strategyId.slice(0, 8)}...`
            })),
            totalEstimatedApy: data.vault.assumedApy,
            totalRiskScore: data.vault.riskLabel === 'Conservative' ? 3 :
                           data.vault.riskLabel === 'Balanced' ? 5 : 7,
            warnings: ['Vault investments are subject to smart contract risks and market volatility'],
            fees: { dappFee: 0.5, protocolFees: 0.25, gasEstimate: 0.1 },
            network: network || 'TESTNET',
            isComplete: true,
            needsInfo: [],
            chosenVault: data.vault,
            projections: data.projection,
            apiCalls: data.apiCalls
          };

          return NextResponse.json({
            message,
            strategy,
            questions: []
          });

        } catch (error) {
          console.error('Error getting vault recommendation:', error);
          return NextResponse.json({
            message: "❌ **Vault Selection Failed**\n\nI encountered an error selecting a vault. Here are your options:\n\n🔄 **Try Balanced** risk tolerance\n📊 **Use top TVL stable vault**\n📋 **See all available vaults**\n\nPlease let me know how you'd like to proceed.",
            strategy: currentStrategy || getDefaultStrategy(network),
            questions: []
          });
        }
      } else if (responseMessage.function_call.name === 'create_defi_strategy') {
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

function formatComprehensiveInvestmentSummary(
  vault: any,
  projections: any[],
  apiCalls: any[],
  userInput: any,
  fallbackUsed?: string
): string {
  const amountHuman = (parseFloat(userInput.amountBase) / 1e7).toLocaleString();
  const assetSymbol = getAssetSymbol(vault.assetId);
  const stellarExpertLink = getStellarExpertLink(vault.vaultId, userInput.network);

  // Format strategy allocations
  const strategyAllocations = vault.allocations.map((alloc: any) =>
    `- Strategy \`${alloc.strategyId.slice(0, 8)}...${alloc.strategyId.slice(-6)}\`: **${alloc.percent.toFixed(2)}%**`
  ).join('\n');

  const idleAllocation = vault.idlePercent > 0 ?
    `- **Idle:** **${vault.idlePercent.toFixed(2)}%**` : '';

  // Format projections
  const projectionLines = projections.map(proj =>
    `**${proj.months} months:** ~ **${proj.amountHuman}**`
  ).join('\n');

  // Format API calls
  const apiCallLines = apiCalls.map((call, index) =>
    `${index + 1}. **${call.method} ${call.path}** — ${call.purpose}.`
  ).join('\n');

  return `### 🎯 Recommended Vault
- **Vault ID:** \`${vault.vaultId}\`
- **Network:** ${userInput.network}
- **Explorer:** [View on Stellar Expert](${stellarExpertLink})
- **Underlying asset:** \`${vault.assetId}\`
- **TVL (base units):** \`${vault.tvl}\`
- **Total supply (base units):** \`${vault.totalSupply}\`
- **Risk cluster:** ${vault.riskLabel}
- **Assumed APY for projection:** **${vault.assumedApy}%**

${fallbackUsed ? `⚠️ **Fallback applied:** ${fallbackUsed}\n\n` : ''}**Strategy allocations**
${strategyAllocations}
${idleAllocation}

### 💵 Your Investment
- **Amount:** ${amountHuman} ${assetSymbol} (base units: \`${userInput.amountBase}\`)
- **Horizon:** ${userInput.horizonMonths} months
- **Liquidity preference:** ${userInput.liquidityNeeds || 'Medium'} term

### 📈 Projected Balance (monthly compounding at ${vault.assumedApy}% APY)
${projectionLines}

> _Assumptions shown above. Edit APY or amount to re-simulate._

### 🔍 API Calls
${apiCallLines}

**Next Steps:**
✅ **Confirm and invest** (I'll prepare the transaction)
🔄 **Adjust strategy** (change your preferences)
❌ **Cancel**

⚠️ **Disclaimer:** This is not financial advice. Returns are estimates and not guaranteed.`;
}

function getStellarExpertLink(vaultId: string, network: string): string {
  const networkPath = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkPath}/contract/${vaultId}`;
}

function getAssetSymbol(assetAddress: string): string {
  const assetMap: Record<string, string> = {
    'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75': 'USDT',
    'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV': 'USDC',
    'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA': 'STABLE'
  };

  return assetMap[assetAddress] || 'TOKEN';
}

function getDefaultStrategy(network: string): any {
  return {
    network: network || 'TESTNET',
    isComplete: false,
    needsInfo: ['riskTolerance', 'investmentAmount', 'preferredAssets'],
    profile: {},
    allocations: [],
    totalEstimatedApy: 0,
    totalRiskScore: 0,
    warnings: [],
    fees: { dappFee: 0, protocolFees: 0, gasEstimate: 0 }
  };
}

function checkIfProfileComplete(profile: any): boolean {
  const requiredFields = ['investmentAmount', 'riskTolerance', 'timeHorizon'];
  return requiredFields.every(field => profile[field] !== undefined && profile[field] !== null);
}

async function callDefIndexRecommendAndProject(profile: any, network: string) {
  const port = process.env.PORT || '3000';
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  const response = await fetch(`${baseUrl}/api/defindex/recommend-and-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amountBase: (profile.investmentAmount * 1e7).toString(),
      risk: capitalizeFirst(profile.riskTolerance),
      horizonMonths: profile.timeHorizon,
      network,
      liquidityNeeds: profile.liquidityNeeds || 'Medium',
      experienceLevel: profile.experienceLevel || 'Intermediate'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to get vault recommendation');
  }

  return await response.json();
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function handleSwapFlow(messages: any[], network: string, userAddress?: string, currentSwapPlan?: any) {
  try {
    const port = process.env.PORT || '3000';
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

    const swapResponse = await fetch(`${baseUrl}/api/defi-swap-wizard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        currentSwapPlan,
        flowType: 'swap',
        network,
        userAddress
      })
    });

    if (!swapResponse.ok) {
      throw new Error('Failed to get swap response');
    }

    const swapData = await swapResponse.json();
    return swapData;

  } catch (error) {
    console.error('Error in swap flow:', error);
    return {
      message: "❌ **Swap Error**\n\nI encountered an error processing your swap request. Please try again or provide more specific details about what you'd like to swap.",
      swapPlan: currentSwapPlan || {},
      swapReady: false
    };
  }

}