import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = "1024x1024" } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
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
      prompt: prompt,
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
      prompt
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