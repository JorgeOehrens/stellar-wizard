import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, base64Image, style, description, prompt: customPrompt } = await request.json();

    if ((!imageUrl && !base64Image) || !style) {
      return NextResponse.json({ error: 'Missing required fields: imageUrl or base64Image, style' }, { status: 400 });
    }

    // Enhanced style prompts without artist/studio references
    const stylePrompts = {
      'anime-cinematic': 'anime-inspired hand-painted cinematic style, soft pastel palette, cel-shaded edges, painterly backgrounds, warm ambient light, dreamy atmosphere, high-quality animation art style',
      'cyberpunk': 'cyberpunk futuristic style, neon colors, digital art, high-tech atmosphere, glowing elements, dark urban setting, electronic aesthetic',
      'oil-painting': 'classical oil painting style, rich textures, painterly brushstrokes, renaissance aesthetic, warm lighting, artistic masterpiece quality',
      'pixel-art': '8-bit pixel art style, retro gaming aesthetic, blocky textures, limited color palette, nostalgic video game art',
      'anime': 'Japanese anime art style, cel-shaded illustration, vibrant colors, expressive characters, clean lineart, manga-inspired',
      'watercolor': 'watercolor painting style, soft flowing colors, paper texture, artistic brushwork, delicate transparency effects',
      'sketch': 'pencil sketch drawing style, hand-drawn lines, artistic shading, paper texture, monochromatic artwork',
      'pop-art': 'pop art style, bold bright colors, comic book aesthetic, high contrast, graphic design elements, modern art'
    };

    const selectedPrompt = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts['anime-cinematic'];

    console.log('Creating new styled version of image:', {
      style,
      customPrompt,
      description,
      imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'base64 image provided',
      hasBase64: !!base64Image
    });

    let originalImageUrl = imageUrl;

    try {
      // Prepare image URL for Vision API
      let visionImageUrl = originalImageUrl;
      if (base64Image && !originalImageUrl) {
        visionImageUrl = `data:image/png;base64,${base64Image.replace(/^data:image\/[a-z]+;base64,/, '')}`;
      }

      console.log('Analyzing original image with Vision API...');

      // Use Vision API to analyze the original image in detail
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image thoroughly and provide a comprehensive description for creating a new artwork inspired by it. Include: main subject/character details, pose and expression, clothing and accessories, background elements, lighting mood, color palette, composition, and any unique features. Be very detailed and specific to enable accurate recreation as a new styled artwork."
              },
              {
                type: "image_url",
                image_url: {
                  url: visionImageUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      const imageDescription = visionResponse.choices[0]?.message?.content || "artwork";
      console.log('Detailed image analysis completed:', imageDescription.substring(0, 200) + '...');

      // Create a comprehensive prompt for generating a completely new styled version
      let enhancedPrompt = `Create a brand new artwork inspired by this description: ${imageDescription}.

Style requirements: Apply ${selectedPrompt} style throughout the entire image.`;

      if (customPrompt) {
        enhancedPrompt += ` Additional creative direction: ${customPrompt}.`;
      }

      if (description) {
        enhancedPrompt += ` Context: ${description}.`;
      }

      enhancedPrompt += `

Make this a completely new interpretation and recreation, not just a filter or edit. The result should be a fresh, high-quality digital artwork that captures the essence of the original while being distinctly styled. Focus on creating something new and artistic rather than copying.`;

      console.log('Generating new styled artwork with enhanced prompt...');

      const generateResponse = await openai.images.generate({
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        model: "dall-e-3",
        quality: "hd"
      });

      console.log('New styled artwork generated successfully');

      return NextResponse.json({
        success: true,
        original_image: originalImageUrl,
        styled_image: generateResponse.data[0].url,
        style: style,
        prompt_used: enhancedPrompt,
        method_used: 'vision_recreation',
        image_analysis: imageDescription
      });

    } catch (error) {
      console.error('Vision analysis failed, using fallback approach:', error);

      // Fallback: Generate new artwork based on style and custom prompt only
      const fallbackPrompt = `Create a beautiful ${selectedPrompt} style artwork. ${customPrompt ? customPrompt + '. ' : ''}${description ? description + '. ' : ''}High quality, detailed digital NFT artwork. Make it unique and artistic.`;

      console.log('Using fallback generation approach...');

      try {
        const fallbackResponse = await openai.images.generate({
          prompt: fallbackPrompt,
          n: 1,
          size: "1024x1024",
          model: "dall-e-3",
          quality: "hd"
        });

        return NextResponse.json({
          success: true,
          original_image: originalImageUrl,
          styled_image: fallbackResponse.data[0].url,
          style: style,
          prompt_used: fallbackPrompt,
          method_used: 'fallback_generation',
          warning: 'Used style-based generation as fallback'
        });

      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        throw new Error('All generation methods failed');
      }
    }

  } catch (error: any) {
    console.error('Image styling API error:', error);

    // Handle specific OpenAI errors
    if (error?.error?.code === 'invalid_image') {
      return NextResponse.json(
        { error: 'Invalid image format. Please upload a valid PNG or JPEG image.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create styled artwork',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}