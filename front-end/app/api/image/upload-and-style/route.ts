import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToSupabase, uploadImageFromUrlToSupabase } from '../../../../lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('image') as unknown as File;
    const style: string = data.get('style') as string || 'studio-ghibli';
    const description: string = data.get('description') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload JPEG, PNG, or WebP images.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    console.log('Starting upload and style process:', {
      fileName: file.name,
      size: file.size,
      type: file.type,
      style
    });

    // Step 1: Upload original image to Supabase
    const uploadResult = await uploadImageToSupabase(file);
    console.log('Image uploaded to Supabase:', uploadResult.url);

    // Step 2: Apply style with AI
    const stylePrompts = {
      'anime-cinematic': 'anime-inspired hand-painted cinematic style, soft pastel palette, cel-shaded edges, painterly backgrounds, warm ambient light, dreamy atmosphere, high-quality animation art style',
      'cyberpunk': 'in cyberpunk style, neon colors, futuristic, digital art, dark atmosphere, glowing elements',
      'oil-painting': 'as a classical oil painting, renaissance style, rich textures, dramatic lighting, masterpiece quality',
      'pixel-art': 'as 8-bit pixel art, retro gaming style, pixelated, vibrant colors, digital nostalgia',
      'anime': 'in anime art style, manga-inspired, expressive characters, dynamic poses, cel-shading',
      'watercolor': 'as a watercolor painting, soft washes, flowing colors, artistic paper texture, delicate brushstrokes',
      'sketch': 'as a detailed pencil sketch, hand-drawn, artistic shading, black and white, fine lines',
      'pop-art': 'in pop art style, bold colors, high contrast, comic book aesthetic, Ben-Day dots'
    };

    const selectedPrompt = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts['anime-cinematic'];
    const fullPrompt = `Transform this image ${selectedPrompt}. ${description ? `Additional details: ${description}` : ''} Make it suitable for an NFT artwork. High quality, detailed, artistic.`;

    console.log('Applying style with prompt:', fullPrompt.substring(0, 100) + '...');

    let styledImageSupabaseUrl = uploadResult.url; // Fallback to original
    let styledImagePath = uploadResult.path;
    let stylizationError: string | null = null;

    try {
      const response = await openai.images.generate({
        prompt: `Based on the reference image, ${fullPrompt}`,
        n: 1,
        size: "1024x1024",
        model: "dall-e-3",
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No styled image generated');
      }

      const styledImageUrl = response.data[0].url;
      console.log('Style applied successfully. Generated image URL:', styledImageUrl);

      // Step 3: Upload styled image to Supabase
      const styledUploadResult = await uploadImageFromUrlToSupabase(styledImageUrl, 'styled');
      styledImageSupabaseUrl = styledUploadResult.url;
      styledImagePath = styledUploadResult.path;

      console.log('Styled image uploaded to Supabase:', styledImageSupabaseUrl);

    } catch (styleError: any) {
      console.warn('Stylization failed, using original image:', styleError.message);
      stylizationError = styleError.message;
    }

    return NextResponse.json({
      success: true,
      original_image: uploadResult.url,
      original_path: uploadResult.path,
      styled_image: styledImageSupabaseUrl,
      styled_path: styledImagePath,
      style: style,
      prompt_used: fullPrompt,
      stylization_error: stylizationError,
      message: stylizationError
        ? `Image uploaded to Supabase successfully! Stylization failed, using original image.`
        : `Image uploaded to Supabase and styled with ${style} successfully!`
    });

  } catch (error: any) {
    console.error('Upload and style API error:', error);

    // Handle specific errors
    if (error?.message?.includes('Supabase')) {
      return NextResponse.json(
        { error: 'Failed to upload to Supabase. Please check your storage configuration.' },
        { status: 500 }
      );
    }

    if (error?.error?.code === 'invalid_image') {
      return NextResponse.json(
        { error: 'Invalid image format for AI processing.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to upload and style image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}