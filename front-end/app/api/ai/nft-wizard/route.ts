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

interface WizardResponse {
  type: 'followup' | 'plan';
  message?: string;
  plan?: NFTPlan;
}

const SYSTEM_PROMPT = `You are the Stellar NFT Wizard, a friendly AI assistant that helps users create NFT collections on the Stellar blockchain.

Your job is to gather information through natural conversation and validate inputs. Always be conversational and friendly, using wizard-themed language.

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

IMPORTANT: The network (TESTNET/MAINNET) is set by the UI and must never be changed by you.

Validation rules:
- Collection name: 1-32 characters, meaningful
- Symbol: 3-12 characters, uppercase letters and numbers only
- Total supply: 1-10000 NFTs
- Royalty percentage: 0-10%
- Stellar addresses: must start with G and be exactly 56 characters
- Media URL: must be a valid URL (http/https/ipfs)

Response guidelines:
1. Ask follow-up questions if information is missing or unclear
2. Validate all inputs and politely correct invalid ones
3. Once all required info is collected and valid, use the propose_nft_plan function
4. If not ready for a plan, respond conversationally to gather more info

Current network: NETWORK_PLACEHOLDER`;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callOpenAIWithRetry(messages: any[], network: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!openai) {
        throw new Error('OpenAI API key not configured');
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: SYSTEM_PROMPT.replace('NETWORK_PLACEHOLDER', network || 'TESTNET')
          },
          ...messages,
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'propose_nft_plan',
              description: 'Propose an NFT collection plan when all required information has been gathered',
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
                    type: 'object',
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
                },
                required: ['collectionName', 'symbol', 'totalSupply'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.7,
        timeout: 10000, // 10 second timeout
      });

      return completion;

    } catch (error: any) {
      console.error(`OpenAI API attempt ${attempt} failed:`, error);
      
      // Handle rate limiting with exponential backoff
      if (error?.status === 429 && attempt < retries) {
        const backoffMs = Math.pow(2, attempt - 1) * 250; // 250ms, 500ms, 1000ms
        console.log(`Rate limited, retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      // Handle timeout errors  
      if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout') || error?.name === 'TimeoutError') {
        console.log(`Request timeout on attempt ${attempt}, retrying...`);
        if (attempt < retries) {
          const backoffMs = Math.pow(2, attempt - 1) * 500; // Longer backoff for timeouts
          await sleep(backoffMs);
          continue;
        }
        throw new Error('Request timeout - please try a shorter message or try again later.');
      }

      // Handle authentication errors
      if (error?.status === 401) {
        throw new Error('OpenAI API authentication failed. Check your API key.');
      }

      // Handle bad request errors
      if (error?.status === 400) {
        console.error('OpenAI 400 error details:', error);
        throw new Error('Invalid request to OpenAI API. Switching to manual mode.');
      }

      // Handle model errors
      if (error?.status === 404) {
        throw new Error('OpenAI model not found. Check your model name.');
      }

      // If this is the last attempt, throw the error
      if (attempt === retries) {
        throw error;
      }

      // For other errors, wait and retry
      const backoffMs = Math.pow(2, attempt - 1) * 250;
      await sleep(backoffMs);
    }
  }

  throw new Error('All retry attempts failed');
}

function repairInvalidJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    // Try to fix common JSON issues
    let fixed = jsonString
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/'/g, '"')      // Replace single quotes with double quotes
      .replace(/(\w+):/g, '"$1":'); // Add quotes to unquoted keys

    try {
      return JSON.parse(fixed);
    } catch (secondError) {
      throw new Error(`Invalid JSON that couldn't be repaired: ${jsonString}`);
    }
  }
}

export async function POST(request: NextRequest) {
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let lastUserMsg = '';
  let messages: any[] = [];
  let currentPlan: any = null;
  let network: string = 'TESTNET';

  try {
    const requestData = await request.json();
    messages = requestData.messages || [];
    currentPlan = requestData.currentPlan;
    network = requestData.network || 'TESTNET';
    const requestType = requestData.requestType;
    const awaitingField = requestData.awaitingField;

    // Validate inputs
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }

    if (!network || !['TESTNET', 'MAINNET'].includes(network)) {
      throw new Error('Valid network (TESTNET or MAINNET) is required');
    }

    lastUserMsg = messages[messages.length - 1]?.content || '';

    if (!openai) {
      // Enhanced fallback with better parsing
      return handleFallbackFlow(messages, currentPlan, network);
    }

    // Handle nudge requests differently
    if (requestType === 'nudge' && awaitingField) {
      const nudgePrompts = {
        collectionName: "✨ What would you like to name your NFT collection?",
        symbol: "🔤 What symbol would you like for your collection? (3-12 characters, uppercase letters/numbers)",
        totalSupply: "🔢 How many NFTs should be minted? (1-10,000)",
        mediaUrlOrPrompt: "🎨 Do you have an image URL/IPFS or should we generate the image from a prompt?",
        royaltiesPct: "💰 Do you want to set royalties? (0-10%, optional)",
        airdrop: "🚀 Do you want an immediate airdrop to a wallet address? (optional)"
      };

      return NextResponse.json({
        type: 'followup',
        message: nudgePrompts[awaitingField as keyof typeof nudgePrompts] || "What else would you like to add to your NFT collection?",
      });
    }

    const completion = await callOpenAIWithRetry(messages, network);
    const responseMessage = completion.choices?.[0]?.message;

    if (!responseMessage) {
      throw new Error('No response from OpenAI');
    }

    // Handle tool calls (new format)
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      
      if (toolCall.function?.name === 'propose_nft_plan') {
        let functionArgs;
        
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (parseError) {
          // Try to repair the JSON
          try {
            functionArgs = repairInvalidJSON(toolCall.function.arguments);
          } catch (repairError) {
            console.error('Failed to parse or repair function arguments:', toolCall.function.arguments);
            throw new Error('Invalid function call arguments from AI');
          }
        }

        // Ensure network is set from UI
        functionArgs.network = network;
        
        // Validate the plan
        const validatedPlan = validateNFTPlan(functionArgs);
        
        return NextResponse.json({
          type: 'plan',
          message: responseMessage.content || "Perfect! I've gathered all the information for your NFT collection. Here's your plan:",
          plan: validatedPlan,
        });
      }
    }

    // Regular conversational response
    return NextResponse.json({
      type: 'followup',
      message: responseMessage.content || "I'm here to help you create your NFT collection! What would you like to know?",
      plan: currentPlan || {
        network: network || 'TESTNET',
        isComplete: false,
        needsInfo: ['collectionName', 'symbol', 'totalSupply', 'mediaUrl'],
      },
    });

  } catch (error: any) {
    const errorMessage = error.message || 'An unexpected error occurred';
    console.error('NFT Wizard API error:', error);

    // Log to our error endpoint
    try {
      await fetch(`${request.nextUrl.origin}/api/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'nft_conversation',
          error: errorMessage,
          lastUserMsg,
          conversationId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    // Handle specific error types and fall back to manual mode when needed
    if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout') || 
        errorMessage.includes('Invalid request') || errorMessage.includes('400')) {
      // For timeouts and bad requests, switch to fallback mode
      return handleFallbackFlow(messages, currentPlan, network);
    }

    // Return user-friendly error message - but still with fallback plan
    const friendlyMessage = errorMessage.includes('API key') 
      ? "I'm having trouble connecting to my AI brain. Let me guide you through manually instead!"
      : errorMessage.includes('rate limit') || errorMessage.includes('429')
      ? "I'm getting a lot of requests right now. Let me help you step by step instead."
      : errorMessage.includes('timeout')
      ? "That took longer than expected. Let me guide you through manually."
      : "I encountered an issue with AI processing. Let me help you create your NFT collection manually!";

    // Even for other errors, provide fallback plan
    const fallbackPlan = currentPlan || {
      network: network || 'TESTNET',
      isComplete: false,
      needsInfo: ['collectionName', 'symbol', 'totalSupply', 'mediaUrl'],
    };

    return NextResponse.json({
      type: 'followup',
      message: friendlyMessage,
      plan: fallbackPlan,
    }, { status: 200 }); // Return 200 to avoid triggering client-side error handlers
  }
}

function isGreeting(message: string): boolean {
  const greetings = ['hi', 'hello', 'hey', 'gm', 'good morning', 'good afternoon', 'good evening', 'sup', 'yo', 'hiya', 'howdy'];
  const lowerMessage = message.toLowerCase().trim();
  return greetings.some(greeting => 
    lowerMessage === greeting || 
    lowerMessage.startsWith(greeting + ' ') || 
    lowerMessage.startsWith(greeting + '!')
  );
}

function isValidCollectionName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 40) return false;
  if (isGreeting(name)) return false;
  
  // Check if it's too generic
  const generic = ['test', 'nft', 'collection', 'token', 'coin', 'crypto'];
  const lowerName = name.toLowerCase();
  if (generic.includes(lowerName)) return false;
  
  return true;
}

function preprocessImagePrompt(prompt: string): string {
  if (!prompt) return '';
  
  // Clean up the prompt
  let cleaned = prompt.trim();
  
  // Remove common prefixes
  cleaned = cleaned.replace(/^(generate|create|make|draw|design)\s+(an?\s+)?(image|picture|artwork)\s+(of|for|showing)\s+/i, '');
  cleaned = cleaned.replace(/^(i want|i need|can you)\s+/i, '');
  
  // Limit length to ~100 characters for better results
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100).trim();
    // Try to end at a word boundary
    const lastSpace = cleaned.lastIndexOf(' ');
    if (lastSpace > 70) {
      cleaned = cleaned.substring(0, lastSpace);
    }
  }
  
  return cleaned;
}

function isValidImagePrompt(prompt: string): boolean {
  if (!prompt || prompt.length < 5) return false;
  if (isGreeting(prompt)) return false;
  
  const generic = ['test', 'image', 'picture', 'something', 'anything'];
  const lowerPrompt = prompt.toLowerCase();
  if (generic.includes(lowerPrompt)) return false;
  
  return true;
}

function handleFallbackFlow(messages: any[], currentPlan: any, network: string) {
  const fallbackPlan = { ...currentPlan } || {
    network: network || 'TESTNET',
    isComplete: false,
    needsInfo: ['collectionName', 'symbol', 'totalSupply', 'mediaUrl'],
  };

  const lastMessage = messages[messages.length - 1]?.content?.trim() || '';
  const lowerMessage = lastMessage.toLowerCase();

  // Handle greetings separately
  if (isGreeting(lastMessage) && !fallbackPlan.collectionName) {
    return NextResponse.json({
      type: 'followup',
      message: "🧙‍♂️ Greetings, fellow creator! I'm the Stellar NFT Wizard, and I'm here to help you bring your digital collection to life on the Stellar blockchain.\n\n✨ I'll guide you through creating your NFT collection step by step. Let's start with the basics:\n\n**What would you like to name your NFT collection?**\n\n(Choose something descriptive and unique - this will be the main name people see!)",
      plan: fallbackPlan,
    });
  }

  // Only process collection name if it's valid and we don't have one yet
  if (!fallbackPlan.collectionName && lastMessage && messages.length > 1) {
    if (isValidCollectionName(lastMessage)) {
      fallbackPlan.collectionName = lastMessage;
      fallbackPlan.needsInfo = (fallbackPlan.needsInfo || []).filter(f => f !== 'collectionName');
    } else if (!isGreeting(lastMessage)) {
      // Invalid name but not a greeting - ask for clarification
      return NextResponse.json({
        type: 'followup',
        message: `Hmm, "${lastMessage}" seems a bit short or generic for an NFT collection name. \n\n🎨 Let's choose something more descriptive and unique! What's your collection really about? \n\nFor example: "Mystic Dragons", "Pixel Pandas", "Cosmic Crystals", etc.`,
        plan: fallbackPlan,
      });
    }
  }

  if (!fallbackPlan.symbol && fallbackPlan.collectionName && lastMessage) {
    // Look for symbol-like patterns (3-12 uppercase chars/numbers)
    const symbolMatch = lastMessage.match(/\b[A-Z0-9]{3,12}\b/);
    if (symbolMatch) {
      fallbackPlan.symbol = symbolMatch[0];
      fallbackPlan.needsInfo = (fallbackPlan.needsInfo || []).filter(f => f !== 'symbol');
    } else if (lastMessage.length >= 3 && lastMessage.length <= 12) {
      fallbackPlan.symbol = lastMessage.toUpperCase();
      fallbackPlan.needsInfo = (fallbackPlan.needsInfo || []).filter(f => f !== 'symbol');
    }
  }

  if (!fallbackPlan.totalSupply && fallbackPlan.symbol && lastMessage) {
    // Look for numbers
    const numberMatch = lastMessage.match(/\b(\d+)\b/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num >= 1 && num <= 10000) {
        fallbackPlan.totalSupply = num;
        fallbackPlan.needsInfo = (fallbackPlan.needsInfo || []).filter(f => f !== 'totalSupply');
      }
    }
  }

  if (!fallbackPlan.mediaUrl && !fallbackPlan.mediaPrompt && fallbackPlan.totalSupply && lastMessage) {
    // Check if it's a URL or a description
    if (lastMessage.startsWith('http') || lastMessage.startsWith('ipfs://')) {
      fallbackPlan.mediaUrl = lastMessage;
      fallbackPlan.needsInfo = (fallbackPlan.needsInfo || []).filter(f => f !== 'mediaUrl');
    } else if (lastMessage.length > 10) {
      fallbackPlan.mediaPrompt = lastMessage;
      fallbackPlan.needsInfo = (fallbackPlan.needsInfo || []).filter(f => f !== 'mediaUrl');
    }
  }

  // Update needsInfo based on what we have
  const missing = [];
  if (!fallbackPlan.collectionName) missing.push('collectionName');
  if (!fallbackPlan.symbol) missing.push('symbol');
  if (!fallbackPlan.totalSupply) missing.push('totalSupply');
  if (!fallbackPlan.mediaUrl && !fallbackPlan.mediaPrompt) missing.push('mediaUrl');
  
  fallbackPlan.needsInfo = missing;
  fallbackPlan.isComplete = missing.length === 0;

  // Determine next question
  let nextQuestion = "🧙‍♂️ Let's create your NFT collection! I'll guide you through each step.";
  if (!fallbackPlan.collectionName) {
    nextQuestion = "✨ What would you like to name your NFT collection?";
  } else if (!fallbackPlan.symbol) {
    nextQuestion = `🔤 Great! Now I need a symbol for "${fallbackPlan.collectionName}". Please enter 3-12 characters (letters/numbers, uppercase):`;
  } else if (!fallbackPlan.totalSupply) {
    nextQuestion = `🔢 Perfect! How many "${fallbackPlan.symbol}" NFTs should be minted? (Enter a number between 1-10,000):`;
  } else if (!fallbackPlan.mediaUrl && !fallbackPlan.mediaPrompt) {
    nextQuestion = `🎨 Almost done! For the NFT image, you can either:\n• Provide an image URL/IPFS link\n• Describe the image you'd like me to generate`;
  } else {
    nextQuestion = `✅ Perfect! I have everything needed:\n• Collection: ${fallbackPlan.collectionName}\n• Symbol: ${fallbackPlan.symbol}\n• Supply: ${fallbackPlan.totalSupply} NFTs\n• Media: ${fallbackPlan.mediaUrl ? 'URL provided' : 'AI generation planned'}`;
  }

  return NextResponse.json({
    type: fallbackPlan.isComplete ? 'plan' : 'followup',
    message: nextQuestion,
    plan: validateNFTPlan(fallbackPlan),
  });
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