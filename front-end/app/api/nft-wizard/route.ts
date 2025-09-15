import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

interface NFTPlan {
  collectionName?: string;
  symbol?: string;
  totalSupply?: number;
  description?: string;
  royaltiesPct?: number;
  mediaUrl?: string;
  mediaPrompt?: string;
  airdrop?: {
    recipient: string;
    amount?: number;
  } | null;
  network: 'TESTNET' | 'MAINNET';
  isComplete: boolean;
  needsInfo: string[];
}

const SYSTEM_PROMPT = `You are the Stellar NFT Wizard, a friendly AI assistant that helps users create NFT collections on the Stellar blockchain. Your job is to gather all necessary information through natural conversation and validate inputs.

Required information:
- Collection name (1-32 characters)
- Symbol (3-12 characters, uppercase letters/numbers)
- Total supply/Number of NFTs (1-10000)
- Media URL (valid URL format) OR Media Prompt (text description for AI image generation)

Optional information:
- Description (up to 500 characters)
- Royalty percentage (0-10%)
- Airdrop recipient (valid Stellar address starting with G, 56 characters)
- Airdrop amount (number of NFTs to airdrop)

IMPORTANT: The network (TESTNET/MAINNET) is set by the UI and must never be changed by you. Always use the network provided in the user context.

Validation rules:
- Collection name: 1-32 characters, meaningful
- Symbol: 3-12 characters, uppercase letters and numbers only
- Total supply: 1-10000 NFTs
- Royalty percentage: 0-10%
- Stellar addresses: must start with G and be exactly 56 characters
- Media URL: must be a valid URL (http/https/ipfs)

You should:
1. Ask follow-up questions if information is missing or unclear
2. Validate all inputs and politely correct invalid ones
3. Be conversational and friendly, using wizard-themed language
4. Respect the network selection from the UI (never override it)
5. Once all required info is collected and valid, return a structured plan
6. Allow users to modify any field even after the plan is complete

Response format:
Always respond with JSON containing:
- message: Your conversational response to the user
- plan: Current NFT plan object with gathered information
- questions: Array of specific questions you still need answered (if any)`;

export async function POST(request: NextRequest) {
  try {
    const { messages, currentPlan, network } = await request.json();

    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { 
          role: 'system', 
          content: `${SYSTEM_PROMPT}\n\nCurrent network selection: ${network || 'TESTNET'}. This network must be used in your plan and cannot be changed.`
        },
        ...messages,
      ],
      functions: [
        {
          name: 'propose_nft_plan',
          description: 'Propose an NFT collection plan with gathered information',
          parameters: {
            type: 'object',
            properties: {
              collectionName: {
                type: 'string',
                description: 'Name of the NFT collection (1-32 characters)',
              },
              symbol: {
                type: 'string',
                description: 'Collection symbol (3-12 characters, uppercase letters/numbers)',
              },
              totalSupply: {
                type: 'integer',
                minimum: 1,
                maximum: 10000,
                description: 'Total number of NFTs to mint (1-10000)',
              },
              mediaUrl: {
                type: 'string',
                description: 'Media or IPFS URL for the collection',
              },
              mediaPrompt: {
                type: 'string',
                description: 'Text prompt for AI image generation if mediaUrl is not provided',
              },
              description: {
                type: 'string',
                description: 'Collection description (up to 500 characters)',
              },
              royaltiesPct: {
                type: 'number',
                minimum: 0,
                maximum: 10,
                description: 'Royalty percentage (0-10%)',
              },
              airdrop: {
                type: ['object', 'null'],
                properties: {
                  recipient: {
                    type: 'string',
                    description: 'Stellar address to airdrop NFTs to (must start with G, 56 characters)',
                  },
                  amount: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Number of NFTs to airdrop',
                  },
                },
                required: ['recipient'],
                description: 'Airdrop configuration (optional)',
              },
              network: {
                type: 'string',
                enum: ['TESTNET', 'MAINNET'],
                description: 'Stellar network (set by UI, do not override)',
              },
              isComplete: {
                type: 'boolean',
                description: 'Whether all required information has been collected and validated',
              },
              needsInfo: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of information still needed',
              },
            },
            required: ['network', 'isComplete', 'needsInfo'],
          },
        },
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
      
      // Validate the plan
      const validatedPlan = validateNFTPlan(functionArgs);
      
      return NextResponse.json({
        message: responseMessage.content || "I've updated your NFT plan!",
        plan: validatedPlan,
        questions: validatedPlan.needsInfo,
      });
    }

    return NextResponse.json({
      message: responseMessage.content || "I'm here to help you create your NFT collection! What would you like to know?",
      plan: currentPlan || {
        network: network || 'TESTNET',
        isComplete: false,
        needsInfo: ['collectionName', 'totalSupply', 'mediaUrl'],
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

function validateNFTPlan(plan: any): NFTPlan {
  const validated: NFTPlan = {
    network: plan.network || 'TESTNET',
    isComplete: false,
    needsInfo: [],
  };

  // Validate collection name
  if (plan.collectionName) {
    if (plan.collectionName.length >= 1 && plan.collectionName.length <= 32) {
      validated.collectionName = plan.collectionName;
    } else {
      validated.needsInfo.push('collectionName');
    }
  } else {
    validated.needsInfo.push('collectionName');
  }

  // Validate symbol
  if (plan.symbol) {
    const symbolRegex = /^[A-Z0-9]{3,12}$/;
    if (symbolRegex.test(plan.symbol)) {
      validated.symbol = plan.symbol;
    } else {
      validated.needsInfo.push('symbol');
    }
  } else {
    validated.needsInfo.push('symbol');
  }

  // Validate total supply
  if (plan.totalSupply) {
    if (plan.totalSupply >= 1 && plan.totalSupply <= 10000) {
      validated.totalSupply = plan.totalSupply;
    } else {
      validated.needsInfo.push('totalSupply');
    }
  } else {
    validated.needsInfo.push('totalSupply');
  }

  // Validate media URL or media prompt (at least one required)
  if (plan.mediaUrl) {
    try {
      new URL(plan.mediaUrl);
      validated.mediaUrl = plan.mediaUrl;
    } catch {
      validated.needsInfo.push('mediaUrl');
    }
  } else if (plan.mediaPrompt && plan.mediaPrompt.trim().length > 0) {
    validated.mediaPrompt = plan.mediaPrompt.trim();
  } else {
    validated.needsInfo.push('mediaUrl');
  }

  // Validate optional fields
  if (plan.description && plan.description.length <= 500) {
    validated.description = plan.description;
  }

  if (plan.royaltiesPct !== undefined) {
    if (plan.royaltiesPct >= 0 && plan.royaltiesPct <= 10) {
      validated.royaltiesPct = plan.royaltiesPct;
    }
  }

  // Validate airdrop (optional)
  if (plan.airdrop && plan.airdrop.recipient) {
    if (plan.airdrop.recipient.startsWith('G') && plan.airdrop.recipient.length === 56) {
      validated.airdrop = {
        recipient: plan.airdrop.recipient,
        amount: plan.airdrop.amount || validated.totalSupply || 1,
      };
    }
  }

  // Check if plan is complete (all required fields filled)
  validated.isComplete = validated.needsInfo.length === 0;

  return validated;
}