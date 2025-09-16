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
  // Confirmation tracking
  pendingConfirmation?: {
    field: 'collectionName' | 'symbol' | 'totalSupply' | 'mediaUrl' | 'mediaPrompt' | 'description' | 'royaltiesPct' | 'airdrop';
    value: any;
    question: string;
  };
}

interface WizardResponse {
  type: 'followup' | 'plan';
  message?: string;
  plan?: NFTPlan;
}

const SYSTEM_PROMPT = `You are the Stellar NFT Wizard, a friendly AI assistant that helps users create NFT collections on the Stellar blockchain.

CRITICAL CONVERSATION RULES:
1. NEVER automatically assign user input to fields without explicit confirmation
2. When users greet you (hi, hello, gm, etc.) or ask questions, respond conversationally
3. Validate ALL inputs before accepting them - reject vague, generic, or invalid inputs politely
4. Always CONFIRM each field explicitly with the user before adding it to the plan
5. Use clear, scannable Markdown formatting with emojis and bullet points

CONFIRMATION FLOW EXAMPLE:
User: "Cyber Wizards"
You: "🧙‍♂️ Great choice! You'd like your collection to be called **'Cyber Wizards'**, correct? (yes/no)"
User: "yes" → THEN set collectionName in plan

Required information:
- Collection name (1-32 characters)
- Symbol (3-12 characters, uppercase letters/numbers)
- Total supply/Number of NFTs (1-10000)

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
        // timeout: 10000, // 10 second timeout - removed as not supported in this API version
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
        mediaUrlOrPrompt: "🎨 For your NFT artwork, you can upload an image (which I'll style with anime-inspired cinematic effects), provide a URL, or have me generate one from a prompt!",
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
  
  // Check if it's too generic or vague
  const generic = ['test', 'nft', 'collection', 'token', 'coin', 'crypto', 'ok', 'sure', 'yes', 'no', 'maybe', 'something', 'anything', 'whatever'];
  const lowerName = name.toLowerCase().trim();
  if (generic.includes(lowerName)) return false;
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;
  
  return true;
}

function isValidSymbol(symbol: string): boolean {
  if (!symbol) return false;
  const symbolRegex = /^[A-Z0-9]{3,12}$/;
  return symbolRegex.test(symbol.toUpperCase());
}

function isValidSupply(input: string): number | null {
  const num = parseInt(input.trim());
  if (isNaN(num) || num < 1 || num > 10000) return null;
  return num;
}

function isValidMediaUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:', 'ipfs:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

function isValidMediaPrompt(prompt: string): boolean {
  if (!prompt || prompt.length < 10) return false;
  if (isGreeting(prompt)) return false;
  
  const generic = ['test', 'image', 'picture', 'something', 'anything', 'whatever', 'art', 'drawing'];
  const lowerPrompt = prompt.toLowerCase().trim();
  if (generic.includes(lowerPrompt)) return false;
  
  return true;
}

function isConfirmation(message: string): boolean {
  const confirmations = ['yes', 'y', 'yeah', 'yep', 'correct', 'right', 'that\'s right', 'exactly', 'perfect', 'ok', 'okay', 'confirm', 'confirmed'];
  const rejections = ['no', 'n', 'nope', 'incorrect', 'wrong', 'not right', 'cancel'];
  const lowerMessage = message.toLowerCase().trim();
  
  return confirmations.includes(lowerMessage) || rejections.includes(lowerMessage);
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
  const fallbackPlan = currentPlan ? { ...currentPlan } : {
    network: network || 'TESTNET',
    isComplete: false,
    needsInfo: ['collectionName', 'symbol', 'totalSupply', 'mediaUrl'],
  };

  const lastMessage = messages[messages.length - 1]?.content?.trim() || '';

  // Handle greetings
  if (isGreeting(lastMessage) && !fallbackPlan.collectionName && !fallbackPlan.pendingConfirmation) {
    return NextResponse.json({
      type: 'followup',
      message: "🧙‍♂️ **Welcome, fellow creator!**\n\nI'm the Stellar NFT Wizard, here to help you bring your digital collection to life on the Stellar blockchain.\n\n✨ **What I can help you with:**\n- Create NFT collections with custom names and symbols\n- Generate stunning AI artwork for your NFTs\n- Set up royalties and airdrops\n- Deploy everything to Stellar's network\n\n💬 **Would you like to start by naming your NFT collection, or do you have a question first?**\n\nFeel free to ask questions or jump right in!",
      plan: fallbackPlan,
    });
  }

  // Handle pending confirmations
  if (fallbackPlan.pendingConfirmation) {
    const isPositive = ['yes', 'y', 'yeah', 'yep', 'correct', 'right', 'that\'s right', 'exactly', 'perfect', 'ok', 'okay', 'confirm', 'confirmed'].includes(lastMessage.toLowerCase().trim());
    const isNegative = ['no', 'n', 'nope', 'incorrect', 'wrong', 'not right', 'cancel'].includes(lastMessage.toLowerCase().trim());
    
    if (isPositive) {
      // Confirm the field
      const field = fallbackPlan.pendingConfirmation.field;
      const value = fallbackPlan.pendingConfirmation.value;
      
      fallbackPlan[field] = value;
      fallbackPlan.needsInfo = (fallbackPlan.needsInfo || []).filter((f: string) => f !== field && f !== 'symbol'); // Remove both field and symbol since symbol relates to collectionName
      delete fallbackPlan.pendingConfirmation;
      
      // Move to next field
      return getNextStepMessage(fallbackPlan);
    } else if (isNegative) {
      delete fallbackPlan.pendingConfirmation;
      return getNextStepMessage(fallbackPlan, "No problem! Let's try again.");
    } else {
      // Not a clear yes/no, re-ask for confirmation
      return NextResponse.json({
        type: 'followup',
        message: `${fallbackPlan.pendingConfirmation.question}\n\n💬 **Please answer yes or no.**`,
        plan: fallbackPlan,
      });
    }
  }

  // Process new input based on what we're currently collecting
  if (!fallbackPlan.collectionName) {
    if (isValidCollectionName(lastMessage)) {
      // Propose collection name for confirmation
      fallbackPlan.pendingConfirmation = {
        field: 'collectionName',
        value: lastMessage,
        question: `🧙‍♂️ Great choice! You'd like your collection to be called **"${lastMessage}"**, correct?`
      };
      
      return NextResponse.json({
        type: 'followup',
        message: `✨ You've chosen the name **"${lastMessage}"** for your collection.\n\n✅ **Is this correct?**\n(Reply with **yes** or **no**)`,
        plan: fallbackPlan,
      });
    } else if (!isGreeting(lastMessage) && lastMessage.length > 0) {
      return NextResponse.json({
        type: 'followup',
        message: `⚠️ **"${lastMessage}"** is too short, generic, or unclear for an NFT collection name.\n\nPlease choose a descriptive collection name (between **3 and 40 characters**).\n\n🎨 **Examples:**\n- **Mystic Dragons**\n- **Pixel Pandas** \n- **Cosmic Crystals**\n- **Digital Art Warriors**`,
        plan: fallbackPlan,
      });
    }
  } else if (!fallbackPlan.symbol) {
    const upperMessage = lastMessage.toUpperCase();
    if (isValidSymbol(upperMessage)) {
      fallbackPlan.pendingConfirmation = {
        field: 'symbol',
        value: upperMessage,
        question: `🔤 Perfect! You want the symbol to be **"${upperMessage}"**, correct?`
      };
      
      return NextResponse.json({
        type: 'followup',
        message: `🔤 You've chosen **"${upperMessage}"** as your collection symbol.\n\n✅ **Is this correct?**\n(Reply with **yes** or **no**)`,
        plan: fallbackPlan,
      });
    } else {
      return NextResponse.json({
        type: 'followup',
        message: `⚠️ **"${lastMessage}"** is not a valid symbol.\n\n🔤 Please enter **3-12 characters** using only uppercase letters and numbers.\n\n**Examples:**\n- **CYBER**\n- **DRAG123**\n- **PIXELS**\n- **ART2024**`,
        plan: fallbackPlan,
      });
    }
  } else if (!fallbackPlan.totalSupply) {
    const supply = isValidSupply(lastMessage);
    if (supply) {
      fallbackPlan.pendingConfirmation = {
        field: 'totalSupply',
        value: supply,
        question: `🔢 Got it! You want to mint **${supply} NFTs**, correct?`
      };
      
      return NextResponse.json({
        type: 'followup',
        message: `🔢 You want to mint **${supply} NFTs** for your collection.\n\n✅ **Is this correct?**\n(Reply with **yes** or **no**)`,
        plan: fallbackPlan,
      });
    } else {
      return NextResponse.json({
        type: 'followup',
        message: `⚠️ **"${lastMessage}"** is not a valid number.\n\n🔢 Please enter a number between **1 and 10,000**.\n\n**Examples:**\n- **100**\n- **1000**\n- **5000**`,
        plan: fallbackPlan,
      });
    }
  } else if (!fallbackPlan.mediaUrl && !fallbackPlan.mediaPrompt) {
    if (isValidMediaUrl(lastMessage)) {
      fallbackPlan.pendingConfirmation = {
        field: 'mediaUrl',
        value: lastMessage,
        question: `🖼️ Great! You want to use this image URL: **${lastMessage}**, correct?`
      };
      
      return NextResponse.json({
        type: 'followup',
        message: `🖼️ You want to use this image URL for your collection:\n\n**${lastMessage}**\n\n✅ **Is this correct?**\n(Reply with **yes** or **no**)`,
        plan: fallbackPlan,
      });
    } else if (isValidMediaPrompt(lastMessage)) {
      fallbackPlan.pendingConfirmation = {
        field: 'mediaPrompt',
        value: lastMessage,
        question: `🎨 Perfect! You want me to generate an image with this description: **"${lastMessage}"**, correct?`
      };
      
      return NextResponse.json({
        type: 'followup',
        message: `🎨 You want me to generate an image with this description:\n\n**"${lastMessage}"**\n\n✅ **Is this correct?**\n(Reply with **yes** or **no**)`,
        plan: fallbackPlan,
      });
    } else {
      return NextResponse.json({
        type: 'followup',
        message: `⚠️ That doesn't look like a valid URL or image description.\n\n🎨 **For the NFT artwork, you can:**\n\n1. **Upload an image** (I'll style it with anime-inspired cinematic effects!)\n2. **Provide a URL:**\n   - **https://example.com/image.png**\n   - **ipfs://...**\n\n3. **Describe the image:**\n   - **A majestic dragon with golden scales flying over mountains**\n   - **Pixel art robot in a futuristic city**\n\n**Upload an image above or describe what you'd like!**`,
        plan: fallbackPlan,
      });
    }
  }

  // If we get here, guide them to the next step
  return getNextStepMessage(fallbackPlan);
}

function getNextStepMessage(plan: any, prefix = "") {
  const missing = [];
  if (!plan.collectionName) missing.push('collectionName');
  if (!plan.symbol) missing.push('symbol');
  if (!plan.totalSupply) missing.push('totalSupply');
  if (!plan.mediaUrl && !plan.mediaPrompt) missing.push('mediaUrl');
  
  plan.needsInfo = missing;
  plan.isComplete = missing.length === 0;

  let message = prefix ? `${prefix}\n\n` : "";

  if (!plan.collectionName) {
    message += "✨ **What would you like to name your NFT collection?**\n\nChoose something descriptive and unique!";
  } else if (!plan.symbol) {
    message += `🔤 **Now I need a symbol for "${plan.collectionName}"**\n\nPlease enter **3-12 characters** (letters/numbers, uppercase).`;
  } else if (!plan.totalSupply) {
    message += `🔢 **How many NFTs should be minted for ${plan.collectionName}?**\n\nEnter a number between **1 and 10,000**.`;
  } else if (!plan.mediaUrl && !plan.mediaPrompt) {
    message += `🎨 **Almost done! For the NFT artwork, you can:**\n\n1. **Upload an image** (I'll transform it with anime-inspired cinematic styling)\n2. **Provide an image URL/IPFS link**\n3. **Describe the image you'd like me to generate**\n\n**Just upload an image above or tell me what you'd like!**`;
  } else {
    message += `✅ **Perfect! I have everything needed:**\n\n- **Collection:** ${plan.collectionName}\n- **Symbol:** ${plan.symbol}\n- **Supply:** ${plan.totalSupply} NFTs\n- **Media:** ${plan.mediaUrl ? 'URL provided' : 'AI generation planned'}`;
  }

  return NextResponse.json({
    type: plan.isComplete ? 'plan' : 'followup',
    message,
    plan: validateNFTPlan(plan),
  });
}

function validateNFTPlan(plan: any): NFTPlan {
  const validated: NFTPlan = {
    network: plan.network || 'TESTNET',
    isComplete: false,
    needsInfo: [],
  };
  
  // Preserve pending confirmation
  if (plan.pendingConfirmation) {
    validated.pendingConfirmation = plan.pendingConfirmation;
  }

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