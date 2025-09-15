import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

function preprocessImagePrompt(prompt: string): string {
  if (!prompt) return '';
  
  // Clean up the prompt
  let cleaned = prompt.trim();
  
  // Remove common prefixes that don't add value
  cleaned = cleaned.replace(/^(generate|create|make|draw|design)\s+(an?\s+)?(image|picture|artwork)\s+(of|for|showing)\s+/i, '');
  cleaned = cleaned.replace(/^(i want|i need|can you)\s+/i, '');
  cleaned = cleaned.replace(/^(please\s+)?/i, '');
  
  // Limit length to ~100 characters for better results
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100).trim();
    // Try to end at a word boundary
    const lastSpace = cleaned.lastIndexOf(' ');
    if (lastSpace > 70) {
      cleaned = cleaned.substring(0, lastSpace);
    }
  }
  
  // Ensure it's descriptive enough
  if (cleaned.length < 5) {
    return '';
  }
  
  return cleaned;
}

function isValidImagePrompt(prompt: string): boolean {
  if (!prompt || prompt.length < 5) return false;
  
  const greetings = ['hi', 'hello', 'hey', 'gm', 'test'];
  const lowerPrompt = prompt.toLowerCase().trim();
  if (greetings.includes(lowerPrompt)) return false;
  
  const generic = ['image', 'picture', 'something', 'anything', 'nft', 'art'];
  if (generic.includes(lowerPrompt)) return false;
  
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = "1024x1024" } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Preprocess and validate the prompt
    const cleanedPrompt = preprocessImagePrompt(prompt);
    
    if (!isValidImagePrompt(cleanedPrompt)) {
      return NextResponse.json(
        { error: 'Please provide a more descriptive image prompt (at least 5 characters, not just greetings or generic terms)' },
        { status: 400 }
      );
    }

    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      );
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: cleanedPrompt,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "standard",
      n: 1,
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    return NextResponse.json({
      imageUrl,
      prompt: cleanedPrompt,
      originalPrompt: prompt
    });

  } catch (error) {
    console.error('OpenAI Images API error:', error);
    
    if (error instanceof Error && error.message.includes('billing')) {
      return NextResponse.json(
        { error: 'Image generation service unavailable. Please check your OpenAI billing.' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}