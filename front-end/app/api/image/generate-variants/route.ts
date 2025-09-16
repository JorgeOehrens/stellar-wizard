import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import sharp from 'sharp';

// Supabase client for storage operations
// Note: Using anon key since service role is not available
// For production, add SUPABASE_SERVICE_ROLE_KEY to .env.local
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface VariantRequest {
  pathOriginal?: string;
  imageUrl?: string; // Support legacy format
  originalSha256?: string; // Support legacy format
  style?: string; // Support legacy format (maps to stylePreset)
  customPrompt?: string; // Support legacy format (maps to prompt)
  variantCount?: number; // Support legacy format (maps to numVariants)
  prompt?: string;
  stylePreset?: string;
  numVariants?: number;
  intensity?: number;
  seed?: number | null;
}

interface VariantResponse {
  variants: Array<{ path: string }>;
  editParams: {
    prompt: string;
    stylePreset: string;
    intensity: number;
    seed: number | null;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await request.json().catch(() => null) as VariantRequest | null;

    // Support both new format (pathOriginal) and legacy format (imageUrl)
    let pathOriginal = body?.pathOriginal;

    // If using legacy format with imageUrl, extract path from URL
    if (!pathOriginal && body?.imageUrl) {
      try {
        const url = new URL(body.imageUrl);
        // Extract everything after /public/
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)$/);
        if (pathMatch) {
          pathOriginal = pathMatch[1];
        }
      } catch (e) {
        // Fallback: try simpler match
        const urlMatch = body.imageUrl.match(/\/public\/(.+)$/);
        if (urlMatch) {
          pathOriginal = urlMatch[1];
        } else {
          console.error('[Variants] Failed to parse imageUrl:', e);
        }
      }

      console.log('[Variants] Extracted path from imageUrl:', pathOriginal);
    }

    if (!pathOriginal) {
      return NextResponse.json(
        { error: 'pathOriginal or imageUrl is required' },
        { status: 400 }
      );
    }

    // Map legacy format to new format
    const {
      prompt = body?.customPrompt || '',
      stylePreset = body?.style || 'anime',
      numVariants = body?.variantCount || 3,
      intensity = body?.intensity || 0.7,
      seed = body?.seed || null
    } = body as any;

    // Validate numVariants range
    if (numVariants < 1 || numVariants > 4) {
      return NextResponse.json(
        { error: 'numVariants must be between 1 and 4' },
        { status: 400 }
      );
    }

    console.log(`[Variants] Starting generation for ${pathOriginal}`, {
      prompt,
      stylePreset,
      numVariants,
      intensity,
      seed,
      usingImageUrl: !!body?.imageUrl
    });

    // Step 1: Get the source URL - either use provided imageUrl directly or create signed URL
    let sourceUrl: string;

    if (body?.imageUrl && body.imageUrl.startsWith('http')) {
      // If imageUrl was provided and is valid, use it directly
      sourceUrl = body.imageUrl;
      console.log(`[Variants] Using provided imageUrl directly`);
    } else {
      // Create signed URL for the path
      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from('images')
        .createSignedUrl(pathOriginal, 60); // 60 second expiry

      if (signError || !signedData?.signedUrl) {
        console.error('[Variants] Failed to sign URL:', signError);
        return NextResponse.json(
          { error: 'Original image not found or cannot create signed URL' },
          { status: 404 }
        );
      }

      sourceUrl = signedData.signedUrl;
      console.log(`[Variants] Signed URL created for ${pathOriginal}`);
    }

    // Step 2: Set up timeout with AbortController (45 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[Variants] Aborting due to timeout');
      controller.abort();
    }, 45000);

    try {
      // Step 3: Try edit endpoint first, fallback to generation
      let variants: Blob[];

      // For high intensity, use edit endpoint for better style application
      if (intensity >= 0.7) {
        try {
          console.log('[Variants] Using edit endpoint for better style transformation');
          variants = await generateVariantsWithEdit({
            sourceUrl: sourceUrl,
            prompt,
            stylePreset,
            numVariants,
            intensity,
            signal: controller.signal,
          });
        } catch (editError) {
          console.log('[Variants] Edit failed, falling back to generation:', editError);
          variants = await generateVariantsWithOpenAI({
            sourceUrl: sourceUrl,
            prompt,
            stylePreset,
            numVariants,
            intensity,
            seed,
            signal: controller.signal,
          });
        }
      } else {
        variants = await generateVariantsWithOpenAI({
          sourceUrl: sourceUrl,
          prompt,
          stylePreset,
          numVariants,
          intensity,
          seed,
          signal: controller.signal,
        });
      }

      console.log(`[Variants] Generated ${variants.length} variants`);

      // Step 4: Upload variants to Supabase
      const savedVariants: Array<{ path: string }> = [];

      // Clean up the path - remove duplicate "images/" if present
      let cleanPath = pathOriginal;
      if (cleanPath.startsWith('images/images/')) {
        cleanPath = cleanPath.replace('images/images/', 'images/');
      }

      const basePath = cleanPath.replace(/\.[^.]+$/, ''); // Remove extension
      const extension = cleanPath.match(/\.[^.]+$/)?.[0] || '.png';

      for (let i = 0; i < variants.length; i++) {
        const variantData = variants[i];
        const variantPath = `${basePath}_v${i + 1}${extension}`;

        console.log(`[Variants] Uploading variant ${i + 1} to ${variantPath}`);

        // Upload to Supabase
        const { error: uploadError } = await supabaseAdmin.storage
          .from('images')
          .upload(variantPath, variantData, {
            contentType: 'image/png',
            upsert: true, // x-upsert: true
          });

        if (uploadError) {
          console.error(`[Variants] Failed to upload variant ${i + 1}:`, uploadError);
          throw uploadError;
        }

        savedVariants.push({ path: variantPath });
      }

      const duration = Date.now() - startTime;
      console.log(`[Variants] Completed in ${duration}ms, saved ${savedVariants.length} variants`);

      // Step 5: Return success response (compatible with both formats)
      // If legacy format was used, include additional fields
      if (body?.imageUrl || body?.originalSha256) {
        // Get public URLs for variants
        const variantsWithUrls = savedVariants.map((v, index) => {
          const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${v.path}`;
          return {
            index: index + 1,
            url: publicUrl,
            path: v.path,
            editParams: { prompt, stylePreset, intensity, seed },
            success: true
          };
        });

        return NextResponse.json({
          success: true,
          variants: variantsWithUrls,
          successCount: savedVariants.length,
          totalRequested: numVariants,
          originalSha256: body?.originalSha256 || null,
          editParams: {
            preset: stylePreset,
            prompt: prompt || body?.customPrompt,
            intensity,
            options: { variantCount: numVariants }
          }
        });
      }

      // New format response
      return NextResponse.json<VariantResponse>({
        variants: savedVariants,
        editParams: { prompt, stylePreset, intensity, seed }
      });

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[Variants] Provider timeout after 45s');
        return NextResponse.json(
          { error: 'Provider timeout - request took too long' },
          { status: 504 }
        );
      }

      console.error('[Variants] Provider/storage error:', error);
      return NextResponse.json(
        {
          error: 'Provider or storage error',
          detail: String(error?.message || error)
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error: any) {
    console.error('[Variants] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        detail: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Generate variants using OpenAI with proper error handling
async function generateVariantsWithOpenAI(opts: {
  sourceUrl: string;
  prompt: string;
  stylePreset: string;
  numVariants: number;
  intensity: number;
  seed: any;
  signal: AbortSignal;
}): Promise<Blob[]> {
  const { sourceUrl, prompt, stylePreset, numVariants, intensity, signal } = opts;

  // Enhanced style presets with more detailed descriptions
  const stylePrompts: Record<string, string> = {
    'anime': 'Japanese anime manga art style with cel-shaded illustration, vibrant colors, expressive eyes, clean lineart, dynamic poses',
    'anime-cinematic': 'cinematic anime art style inspired by high-quality animation films, soft pastel colors, detailed backgrounds, atmospheric lighting, painterly textures',
    'cyberpunk': 'cyberpunk futuristic digital art style with neon lights, holographic effects, dark urban atmosphere, glowing technological elements, high contrast',
    'oil-painting': 'classical oil painting masterpiece style with thick impasto textures, rich colors, dramatic lighting, renaissance aesthetic, painterly brushstrokes',
    'pixel-art': 'retro 8-bit pixel art style with blocky sprites, limited color palette, nostalgic video game aesthetic, crisp pixels',
    'watercolor': 'delicate watercolor painting style with soft flowing colors, transparent washes, paper texture, artistic brushwork, dreamy atmosphere',
    'sketch': 'detailed pencil sketch drawing style with expressive lines, cross-hatching, artistic shading, paper texture, monochromatic tones',
    'pop-art': 'bold pop art style with bright saturated colors, comic book aesthetic, Ben Day dots, high contrast, graphic design elements'
  };

  const selectedStyle = stylePrompts[stylePreset] || stylePrompts['anime'];

  // First analyze the image with Vision API for detailed understanding
  console.log('[Variants] Analyzing source image with GPT-4 Vision for detailed recreation');

  const visionResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image in extreme detail for recreating it in a different art style. Include:
1. Main subjects (people, objects) - describe faces, poses, clothing, expressions
2. Background elements and environment
3. Lighting, shadows, and atmosphere
4. Color palette and dominant colors
5. Composition and framing
6. Any text or logos visible
7. Unique details that must be preserved
Be very specific and detailed.`
          },
          {
            type: "image_url",
            image_url: {
              url: sourceUrl,
              detail: "high"
            }
          }
        ]
      }
    ],
    max_tokens: 500
  }, { signal });

  const imageDescription = visionResponse.choices[0]?.message?.content || "";
  console.log('[Variants] Detailed image analysis:', imageDescription.substring(0, 200) + '...');

  // Generate variants with strong style application
  const variants: Blob[] = [];

  for (let i = 0; i < numVariants; i++) {
    // Create different variations for diversity
    const variationTypes = [
      'exact recreation',
      'slightly different angle',
      'alternative lighting mood',
      'enhanced details'
    ];

    const variation = variationTypes[i] || 'exact recreation';

    // Build a comprehensive prompt that will create a NEW image with the style
    let fullPrompt = `Create a completely NEW artwork based on this description: ${imageDescription}.

STYLE REQUIREMENTS: Transform this ENTIRELY into ${selectedStyle} style. This must be a complete artistic transformation, not just a filter.

VARIATION: ${variation}`;

    // Add user's custom prompt if provided
    if (prompt && prompt.trim()) {
      fullPrompt += `

ADDITIONAL MODIFICATIONS: ${prompt}`;
    }

    // Apply intensity by emphasizing style
    if (intensity > 0.8) {
      fullPrompt += `

Make the ${stylePreset} style VERY prominent and dramatic. This should look like authentic ${stylePreset} artwork.`;
    } else if (intensity > 0.5) {
      fullPrompt += `

Apply the ${stylePreset} style clearly and noticeably throughout the image.`;
    }

    fullPrompt += `

IMPORTANT: This must be a complete artistic recreation in ${stylePreset} style, not just the original image with effects. Create NEW artwork inspired by the original.`;

    console.log(`[Variants] Generating variant ${i + 1}/${numVariants} with style: ${stylePreset}`);

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      model: "dall-e-3",
      quality: "hd", // Use HD for better quality
      style: "vivid" // Use vivid for more dramatic transformations
    }, { signal });

    if (response.data?.[0]?.url) {
      // Fetch the generated image
      const imageResponse = await fetch(response.data[0].url, { signal });
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`);
      }

      const blob = await imageResponse.blob();
      variants.push(blob);
      console.log(`[Variants] Variant ${i + 1} created with ${stylePreset} style transformation`);
    } else {
      throw new Error(`No image URL returned for variant ${i + 1}`);
    }
  }

  return variants;
}

// Generate variants using DALL-E Edit API with masks for better transformation
async function generateVariantsWithEdit(opts: {
  sourceUrl: string;
  prompt: string;
  stylePreset: string;
  numVariants: number;
  intensity: number;
  signal: AbortSignal;
}): Promise<Blob[]> {
  const { sourceUrl, prompt, stylePreset, numVariants, intensity, signal } = opts;

  // Enhanced style descriptions for edit endpoint
  const stylePrompts: Record<string, string> = {
    'anime': 'Transform completely into Japanese anime manga art style, cel-shaded, vibrant colors, expressive eyes',
    'anime-cinematic': 'Transform into cinematic anime film style with soft pastels, detailed backgrounds, atmospheric lighting',
    'cyberpunk': 'Transform into cyberpunk style with neon lights, holographic effects, futuristic tech elements',
    'oil-painting': 'Transform into classical oil painting with visible brushstrokes, rich colors, dramatic lighting',
    'pixel-art': 'Transform into retro pixel art with blocky sprites, limited colors, 8-bit aesthetic',
    'watercolor': 'Transform into watercolor painting with flowing colors, transparent washes, artistic texture',
    'sketch': 'Transform into pencil sketch with expressive lines, cross-hatching, monochromatic style',
    'pop-art': 'Transform into pop art with bold colors, comic book style, high contrast graphics'
  };

  const selectedStyle = stylePrompts[stylePreset] || stylePrompts['anime'];

  console.log('[Variants-Edit] Downloading and processing source image');

  // Download source image
  const imageResponse = await fetch(sourceUrl, { signal });
  if (!imageResponse.ok) {
    throw new Error('Failed to fetch source image');
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  // Process image to meet DALL-E requirements
  const processedImage = await sharp(imageBuffer)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .ensureAlpha()
    .toBuffer();

  const variants: Blob[] = [];

  for (let i = 0; i < numVariants; i++) {
    // Create different mask patterns for variety
    let maskBuffer: Buffer;

    if (i === 0) {
      // Full transformation for first variant
      maskBuffer = await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Fully transparent = edit everything
        }
      }).png().toBuffer();
    } else {
      // Progressive masks for variations
      const opacity = 0.1 + (i * 0.2); // Increasing opacity for each variant
      maskBuffer = await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: opacity }
        }
      }).png().toBuffer();
    }

    // Build edit prompt with variations
    const variations = ['', 'with enhanced details', 'with dramatic lighting', 'with unique perspective'];
    let editPrompt = `${selectedStyle}. ${prompt || ''}. ${variations[i] || ''}`;

    if (intensity > 0.8) {
      editPrompt += '. Make the transformation extremely dramatic and prominent';
    }

    editPrompt += '. High quality digital artwork';

    console.log(`[Variants-Edit] Creating variant ${i + 1}/${numVariants} with edit API`);

    const imageFile = new File([processedImage], 'image.png', { type: 'image/png' });
    const maskFile = new File([maskBuffer], 'mask.png', { type: 'image/png' });

    const editResponse = await openai.images.edit({
      image: imageFile,
      mask: maskFile,
      prompt: editPrompt,
      n: 1,
      size: "1024x1024"
    }, { signal });

    if (editResponse.data?.[0]?.url) {
      const variantResponse = await fetch(editResponse.data[0].url, { signal });
      const blob = await variantResponse.blob();
      variants.push(blob);
      console.log(`[Variants-Edit] Variant ${i + 1} created successfully`);
    } else {
      throw new Error(`No image returned for variant ${i + 1}`);
    }
  }

  return variants;
}