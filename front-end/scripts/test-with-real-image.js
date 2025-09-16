#!/usr/bin/env node

/**
 * Test script that uses a real image from Supabase
 * First uploads a test image, then tests variant generation
 */

const API_URL = process.env.API_URL || 'http://localhost:3002';

async function uploadTestImage() {
  console.log('📤 Uploading test image to Supabase...\n');

  // Generate a simple test image using DALL-E
  const generateResponse = await fetch(`${API_URL}/api/image/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'A cute cartoon cat wearing a wizard hat, digital art, colorful',
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  if (!generateResponse.ok) {
    const error = await generateResponse.json();
    console.error('Failed to generate test image:', error);
    return null;
  }

  const generateData = await generateResponse.json();
  console.log('✅ Test image generated:', generateData.imageUrl);

  // The image is already saved in Supabase, extract the path
  if (generateData.imagePath) {
    return generateData.imagePath;
  }

  // Extract path from URL if imagePath not provided
  const url = new URL(generateData.imageUrl);
  const pathMatch = url.pathname.match(/\/images\/(.+)$/);
  if (pathMatch) {
    return `images/${pathMatch[1]}`;
  }

  console.error('Could not extract path from image URL');
  return null;
}

async function testVariantGeneration(pathOriginal) {
  console.log('\n🧪 Testing variant generation...\n');
  console.log('📍 Original path:', pathOriginal);

  const testCases = [
    {
      name: 'Basic variant generation',
      body: {
        pathOriginal,
        numVariants: 2,
      },
    },
    {
      name: 'Anime style with sparkles',
      body: {
        pathOriginal,
        prompt: 'add magical sparkles and glowing effects',
        stylePreset: 'anime',
        numVariants: 2,
        intensity: 0.8,
      },
    },
    {
      name: 'Cyberpunk style',
      body: {
        pathOriginal,
        prompt: 'neon lights, holographic effects',
        stylePreset: 'cyberpunk',
        numVariants: 2,
        intensity: 0.9,
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n🔄 Test: ${testCase.name}`);
    console.log('Request:', JSON.stringify(testCase.body, null, 2));

    const startTime = Date.now();

    try {
      const response = await fetch(`${API_URL}/api/image/generate-variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.body),
        // Add longer timeout for variant generation
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      const duration = Date.now() - startTime;
      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Success (${duration}ms)`);

        if (data.variants && data.variants.length > 0) {
          console.log(`\n📦 Generated ${data.variants.length} variants:`);
          data.variants.forEach((v, i) => {
            console.log(`   ${i + 1}. ${v.path}`);
          });
          console.log('\nEdit params:', JSON.stringify(data.editParams, null, 2));
        }
      } else {
        console.log(`❌ Failed with status ${response.status} (${duration}ms)`);
        console.log('Error:', data);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Request failed (${duration}ms)`);
      console.log('Error:', error.message);
    }

    console.log('-----------------------------------');
  }
}

async function main() {
  console.log('🚀 Starting comprehensive variant generation test\n');
  console.log('API URL:', API_URL);
  console.log('===================================\n');

  // First, try to use an existing image or upload a test one
  let testImagePath = process.argv[2];

  if (!testImagePath) {
    console.log('No image path provided, generating a test image...\n');
    testImagePath = await uploadTestImage();

    if (!testImagePath) {
      console.error('❌ Failed to create test image');
      process.exit(1);
    }
  }

  // Test variant generation with the image
  await testVariantGeneration(testImagePath);

  console.log('\n\n✨ All tests completed!');
  console.log('Check Supabase to see the generated variants.');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run tests
main();