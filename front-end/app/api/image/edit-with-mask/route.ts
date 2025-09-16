import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import sharp from 'sharp';

// Supabase client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EditRequest {
  imageUrl: string;
  style: string;
  customPrompt?: string;
  intensity?: number;
  maskMode?: 'full' | 'partial' | 'auto'; // full: edit entire image, partial: edit specific areas, auto: smart detection
  originalSha256?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json() as EditRequest;

    const {
      imageUrl,
      style,
      customPrompt = '',
      intensity = 0.7,
      maskMode = 'full',
      originalSha256
    } = body;

    if (!imageUrl || !style) {
      return NextResponse.json(
        { error: 'imageUrl and style are required' },
        { status: 400 }
      );
    }

    console.log(`[Edit] Starting image edit with style: ${style}, mode: ${maskMode}`);

    // Style descriptions for different presets
    const styleDescriptions: Record<string, string> = {
      'anime': 'Transform into Japanese anime manga art style with vibrant colors, cel-shading, expressive eyes, clean lineart',
      'anime-cinematic': 'Transform into cinematic anime style with soft pastel colors, detailed backgrounds, atmospheric lighting, painterly quality',
      'cyberpunk': 'Transform into cyberpunk style with neon lights, holographic effects, futuristic tech, dark atmosphere',
      'oil-painting': 'Transform into classical oil painting with thick brushstrokes, rich colors, dramatic lighting',
      'pixel-art': 'Transform into retro 8-bit pixel art with blocky sprites, limited colors, nostalgic gaming aesthetic',
      'watercolor': 'Transform into watercolor painting with soft flowing colors, transparent washes, artistic brushwork',
      'sketch': 'Transform into detailed pencil sketch with expressive lines, cross-hatching, monochromatic tones',
      'pop-art': 'Transform into bold pop art with bright saturated colors, comic book aesthetic, high contrast'
    };

    const stylePrompt = styleDescriptions[style] || styleDescriptions['anime'];

    try {
      // Step 1: Download the original image
      console.log('[Edit] Downloading original image...');
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch image');
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Step 2: Process image to ensure it meets DALL-E requirements
      console.log('[Edit] Processing image for DALL-E edit...');

      // Resize to square and convert to PNG with alpha channel
      const processedImage = await sharp(imageBuffer)
        .resize(1024, 1024, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .ensureAlpha()
        .toBuffer();

      // Step 3: Create mask based on mode
      let maskBuffer: Buffer;

      if (maskMode === 'full') {
        // Full image edit - create a mask that covers the entire image
        console.log('[Edit] Creating full image mask for complete transformation...');

        // Create a fully transparent mask (entire image will be edited)
        maskBuffer = await sharp({
          create: {
            width: 1024,
            height: 1024,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 } // Fully transparent = edit everything
          }
        })
        .png()
        .toBuffer();

      } else if (maskMode === 'partial') {
        // Partial edit - create a mask that preserves edges/important features
        console.log('[Edit] Creating partial mask to preserve key features...');

        // Use edge detection to preserve important features
        const edges = await sharp(processedImage)
          .greyscale()
          .convolve({
            width: 3,
            height: 3,
            kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
          })
          .negate() // Invert so edges are protected
          .threshold(128) // Create binary mask
          .toBuffer();

        // Convert to RGBA with alpha channel
        maskBuffer = await sharp(edges)
          .ensureAlpha()
          .png()
          .toBuffer();

      } else {
        // Auto mode - intelligent masking based on image analysis
        console.log('[Edit] Using auto mode for intelligent masking...');

        // Create a gradient mask that's stronger in the center
        const { width, height } = await sharp(processedImage).metadata();

        // Create radial gradient mask
        maskBuffer = await sharp({
          create: {
            width: width || 1024,
            height: height || 1024,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          }
        })
        .composite([{
          input: Buffer.from(
            `<svg width="${width}" height="${height}">
              <defs>
                <radialGradient id="gradient">
                  <stop offset="0%" stop-color="white" stop-opacity="0"/>
                  <stop offset="70%" stop-color="white" stop-opacity="${intensity}"/>
                  <stop offset="100%" stop-color="white" stop-opacity="1"/>
                </radialGradient>
              </defs>
              <rect width="${width}" height="${height}" fill="url(#gradient)"/>
            </svg>`
          ),
          blend: 'over'
        }])
        .png()
        .toBuffer();
      }

      // Step 4: Build the edit prompt
      let editPrompt = stylePrompt;

      if (customPrompt) {
        editPrompt += `. ${customPrompt}`;
      }

      // Add intensity modifiers
      if (intensity > 0.8) {
        editPrompt += `. Make the ${style} transformation very dramatic and prominent`;
      } else if (intensity > 0.5) {
        editPrompt += `. Apply the ${style} style clearly throughout`;
      }

      editPrompt += `. High quality digital artwork, maintaining original composition`;

      console.log('[Edit] Using prompt:', editPrompt.substring(0, 150) + '...');

      // Step 5: Call DALL-E edit endpoint
      console.log('[Edit] Calling DALL-E edit API...');

      const imageFile = new File([processedImage], 'image.png', { type: 'image/png' });
      const maskFile = new File([maskBuffer], 'mask.png', { type: 'image/png' });

      const editResponse = await openai.images.edit({
        image: imageFile,
        mask: maskFile,
        prompt: editPrompt,
        n: 1,
        size: "1024x1024"
      });

      if (!editResponse.data?.[0]?.url) {
        throw new Error('No edited image returned from DALL-E');
      }

      const editedImageUrl = editResponse.data[0].url;
      console.log('[Edit] Image edited successfully');

      // Step 6: Download and save the edited image
      const editedResponse = await fetch(editedImageUrl);
      const editedBuffer = Buffer.from(await editedResponse.arrayBuffer());

      // Generate filename for edited version
      const timestamp = Date.now();
      const filename = `edited-${style}-${timestamp}.png`;
      const path = `images/${filename}`;

      // Upload to Supabase
      const { error: uploadError } = await supabaseAdmin.storage
        .from('images')
        .upload(path, editedBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`;

      const duration = Date.now() - startTime;
      console.log(`[Edit] Completed in ${duration}ms`);

      return NextResponse.json({
        success: true,
        original_image: imageUrl,
        edited_image: publicUrl,
        path: path,
        style: style,
        prompt_used: editPrompt,
        mask_mode: maskMode,
        intensity: intensity,
        duration_ms: duration,
        originalSha256: originalSha256
      });

    } catch (error: any) {
      console.error('[Edit] Processing error:', error);

      // Fallback to generation if edit fails
      console.log('[Edit] Falling back to generation approach...');

      // Use the style API as fallback
      const fallbackResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/image/style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          style,
          prompt: customPrompt,
          description: `Apply ${intensity * 100}% style intensity`
        })
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        return NextResponse.json({
          ...fallbackData,
          method_used: 'fallback_generation',
          warning: 'Used generation fallback due to edit API issues'
        });
      }

      throw error;
    }

  } catch (error: any) {
    console.error('[Edit] API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to edit image',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}