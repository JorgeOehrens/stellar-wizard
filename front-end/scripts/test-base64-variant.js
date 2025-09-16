#!/usr/bin/env node

/**
 * Test script for the /api/image/generate-from-base64 endpoint
 *
 * Usage:
 * node scripts/test-base64-variant.js <base64-image-file> [style] [prompt]
 *
 * Example:
 * node scripts/test-base64-variant.js ./test-image.txt cyberpunk "neon lights, futuristic"
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3002';

async function testBase64Variant(base64FilePath, style = 'anime', customPrompt = '') {
  console.log('🧪 Testing Base64 Image Variant Generation\n');
  console.log('📍 API URL:', API_URL);
  console.log('📁 Base64 file:', base64FilePath);
  console.log('🎨 Style:', style);
  console.log('✨ Prompt:', customPrompt || 'None');
  console.log('=====================================\n');

  try {
    // Read base64 image data
    console.log('📖 Reading base64 image data...');

    if (!fs.existsSync(base64FilePath)) {
      throw new Error(`File not found: ${base64FilePath}`);
    }

    let imageBase64 = fs.readFileSync(base64FilePath, 'utf8').trim();

    // If the file contains a data URL, extract just the base64 part
    if (imageBase64.startsWith('data:image/')) {
      const base64Match = imageBase64.match(/^data:image\/[a-z]+;base64,(.+)$/);
      if (base64Match) {
        imageBase64 = base64Match[1];
      }
    }

    console.log(`✅ Base64 data loaded (${imageBase64.length} characters)`);

    // Test different scenarios
    const testCases = [
      {
        name: 'Basic variant generation',
        body: {
          imageBase64,
          style,
          saveToStorage: true
        }
      },
      {
        name: 'With custom prompt',
        body: {
          imageBase64,
          style,
          prompt: customPrompt || 'magical sparkles, glowing effects',
          intensity: 0.8,
          saveToStorage: true,
          filename: `test-${style}-variant.png`
        }
      },
      {
        name: 'High intensity transformation',
        body: {
          imageBase64,
          style,
          prompt: customPrompt || 'dramatic transformation',
          intensity: 0.95,
          saveToStorage: false // Return only base64
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🔄 Test: ${testCase.name}`);
      console.log('Request body:', JSON.stringify({
        ...testCase.body,
        imageBase64: `${testCase.body.imageBase64.substring(0, 50)}... (${testCase.body.imageBase64.length} chars)`
      }, null, 2));

      const startTime = Date.now();

      try {
        const response = await fetch(`${API_URL}/api/image/generate-from-base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testCase.body),
          // Set timeout for 60 seconds
          signal: AbortSignal.timeout(60000)
        });

        const duration = Date.now() - startTime;
        const data = await response.json();

        if (response.ok) {
          console.log(`✅ Success (${duration}ms)`);

          if (data.variant) {
            console.log('\n📦 Variant generated:');
            console.log(`   - Style: ${data.generation?.style}`);
            console.log(`   - Intensity: ${data.generation?.intensity}`);
            console.log(`   - Method: ${data.generation?.method}`);

            if (data.variant.url) {
              console.log(`   - Storage URL: ${data.variant.url}`);
            }

            if (data.variant.base64) {
              console.log(`   - Base64 length: ${data.variant.base64.length} chars`);

              // Optionally save base64 to file for inspection
              const outputFile = `output-${testCase.name.replace(/\s+/g, '-')}-${Date.now()}.txt`;
              fs.writeFileSync(outputFile, data.variant.base64);
              console.log(`   - Saved to: ${outputFile}`);
            }

            console.log(`\n📈 Performance:`);
            console.log(`   - Total duration: ${data.performance?.durationMs}ms`);
            console.log(`   - Saved to storage: ${data.performance?.saved}`);
          }

          if (data.generation?.imageAnalysis) {
            console.log(`\n🔍 Image analysis: ${data.generation.imageAnalysis.substring(0, 150)}...`);
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

  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    process.exit(1);
  }
}

// Test error cases
async function testErrorCases() {
  console.log('\n\n🧪 Testing error handling...\n');

  const errorTests = [
    {
      name: 'Missing imageBase64',
      body: {
        style: 'anime'
      },
      expectedStatus: 400
    },
    {
      name: 'Missing style',
      body: {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      },
      expectedStatus: 400
    },
    {
      name: 'Invalid base64',
      body: {
        imageBase64: 'invalid-base64-data',
        style: 'anime'
      },
      expectedStatus: 500
    }
  ];

  for (const test of errorTests) {
    console.log(`\n🔄 Error test: ${test.name}`);

    try {
      const response = await fetch(`${API_URL}/api/image/generate-from-base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.body),
      });

      const data = await response.json();

      if (response.status === test.expectedStatus) {
        console.log(`✅ Got expected status ${response.status}`);
        console.log('Error message:', data.error);
      } else {
        console.log(`❌ Unexpected status: ${response.status} (expected ${test.expectedStatus})`);
        console.log('Response:', data);
      }
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  const base64FilePath = process.argv[2];
  const style = process.argv[3] || 'anime';
  const customPrompt = process.argv[4] || '';

  if (!base64FilePath) {
    console.error('❌ Error: Please provide a base64 image file path');
    console.error('Usage: node scripts/test-base64-variant.js <base64-file> [style] [prompt]');
    console.error('Example: node scripts/test-base64-variant.js ./image.txt cyberpunk "neon effects"');
    process.exit(1);
  }

  // Test with provided image
  await testBase64Variant(base64FilePath, style, customPrompt);

  // Test error cases
  await testErrorCases();

  console.log('\n\n✨ All tests completed!');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run tests
main();