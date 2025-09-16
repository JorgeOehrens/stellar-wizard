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

interface Base64VariantRequest {
  imageBase64: string;
  style: string;
  prompt?: string;
  intensity?: number;
  saveToStorage?: boolean; // Whether to save the variant to Supabase
  filename?: string; // Optional custom filename
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json() as Base64VariantRequest;

    const {
      imageBase64,
      style,
      prompt = '',
      intensity = 0.7,
      saveToStorage = true,
      filename
    } = body;

    if (!imageBase64 || !style) {
      return NextResponse.json(
        { error: 'imageBase64 and style are required' },
        { status: 400 }
      );
    }

    console.log(`[Base64Variant] Starting variant generation with style: ${style}`);

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
      // Step 1: Prepare image for Vision API
      console.log('[Base64Variant] Preparing image for AI analysis...');

      // Handle data URL format - if it's already a data URL, use it directly
      let base64ForVision = imageBase64;
      let base64Data = imageBase64;

      // If it's just base64 without data URL prefix, detect format and add prefix
      if (!imageBase64.startsWith('data:image/')) {
        let imageFormat = 'png';
        if (imageBase64.startsWith('/9j/')) {
          imageFormat = 'jpeg';
        } else if (imageBase64.startsWith('iVBORw0KGgo')) {
          imageFormat = 'png';
        } else if (imageBase64.startsWith('R0lGODlh')) {
          imageFormat = 'gif';
        }
        base64ForVision = `data:image/${imageFormat};base64,${imageBase64}`;
        base64Data = imageBase64;
      } else {
        // Extract just the base64 part from data URL
        base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      }

      console.log(`[Base64Variant] Base64 data length: ${base64Data.length} characters`);

      // Step 2: Analyze image with Vision API
      console.log('[Base64Variant] Analyzing image with GPT-4 Vision...');

      let visionResponse;
      try {
        visionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this image in detail for creating a styled variant. Describe:
1. Main subjects and their characteristics
2. Composition and layout
3. Colors and lighting
4. Background elements
5. Overall mood and atmosphere
Be specific and detailed to enable accurate recreation.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: base64ForVision,
                    detail: "high"
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        });
      } catch (visionError: any) {
        console.log('[Base64Variant] Vision API failed, using fallback description:', visionError.message);
        // Fallback: create a generic description for generation
        visionResponse = {
          choices: [{
            message: {
              content: "A digital artwork suitable for artistic transformation and style application. The image contains various elements that can be enhanced with different artistic styles."
            }
          }]
        };
      }

      const imageDescription = visionResponse.choices[0]?.message?.content || "";
      console.log('[Base64Variant] Image analysis complete');

      // Step 4: Generate styled variant
      console.log(`[Base64Variant] Generating ${style} variant...`);

      let variantPrompt = `Based on this image description: ${imageDescription}

Create a completely new artwork that ${stylePrompt}.`;

      if (prompt && prompt.trim()) {
        variantPrompt += ` Additional requirements: ${prompt}.`;
      }

      // Apply intensity
      if (intensity > 0.8) {
        variantPrompt += ` Make the ${style} style transformation very dramatic and prominent.`;
      } else if (intensity > 0.5) {
        variantPrompt += ` Apply the ${style} style clearly throughout the image.`;
      }

      variantPrompt += ` Create a high-quality digital artwork that captures the essence of the original while being distinctly styled in ${style} aesthetic.`;

      // Use DALL-E 3 for high-quality generation
      const generateResponse = await openai.images.generate({
        prompt: variantPrompt,
        n: 1,
        size: "1024x1024",
        model: "dall-e-3",
        quality: "hd",
        style: "vivid"
      });

      if (!generateResponse.data?.[0]?.url) {
        throw new Error('No variant image generated');
      }

      const variantImageUrl = generateResponse.data[0].url;
      console.log('[Base64Variant] Variant generated successfully');

      // Step 5: Download the generated variant
      const variantResponse = await fetch(variantImageUrl);
      const variantBuffer = Buffer.from(await variantResponse.arrayBuffer());

      let savedPath: string | null = null;
      let publicUrl: string | null = null;

      // Step 6: Optionally save to Supabase storage
      if (saveToStorage) {
        console.log('[Base64Variant] Saving variant to Supabase...');

        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const defaultFilename = `variant-${style}-${timestamp}-${randomId}.png`;
        const finalFilename = filename || defaultFilename;
        const storagePath = `images/variants/${finalFilename}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('images')
          .upload(storagePath, variantBuffer, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.warn('[Base64Variant] Storage upload failed:', uploadError);
          // Continue without storage - return base64 instead
        } else {
          savedPath = storagePath;
          publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${storagePath}`;
          console.log('[Base64Variant] Variant saved to storage');
        }
      }

      // Step 7: Return the variant
      const duration = Date.now() - startTime;
      console.log(`[Base64Variant] Completed in ${duration}ms`);

      const variantBase64 = `data:image/png;base64,${variantBuffer.toString('base64')}`;

      return NextResponse.json({
        success: true,
        variant: {
          base64: variantBase64,
          url: publicUrl || null,
          path: savedPath || null,
          filename: filename || null
        },
        original: {
          preserved: true,
          note: "Original image was not modified"
        },
        generation: {
          style: style,
          prompt: prompt || null,
          intensity: intensity,
          promptUsed: variantPrompt,
          imageAnalysis: imageDescription,
          method: 'vision_analysis_generation'
        },
        performance: {
          durationMs: duration,
          saved: !!savedPath
        }
      });

    } catch (error: any) {
      console.error('[Base64Variant] Processing error:', error);

      return NextResponse.json(
        {
          error: 'Failed to generate image variant',
          details: error?.message || 'Unknown error',
          stage: 'processing'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[Base64Variant] API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error?.message || 'Unknown error',
        stage: 'request_parsing'
      },
      { status: 500 }
    );
  }
}