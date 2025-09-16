#!/usr/bin/env node

/**
 * Manual test script for the /api/image/generate-variants endpoint
 *
 * Usage:
 * node scripts/test-variants.js <pathOriginal>
 *
 * Example:
 * node scripts/test-variants.js images/test/original.png
 */

const API_URL = process.env.API_URL || 'http://localhost:3002';

async function testVariantGeneration(pathOriginal) {
  console.log('🧪 Testing variant generation endpoint...\n');
  console.log('📍 API URL:', API_URL);
  console.log('🖼️  Original path:', pathOriginal);
  console.log('-----------------------------------\n');

  const testCases = [
    {
      name: 'Basic variant generation (default params)',
      body: {
        pathOriginal,
      },
    },
    {
      name: 'Anime style with custom prompt',
      body: {
        pathOriginal,
        prompt: 'add magical sparkles and glowing aura',
        stylePreset: 'anime',
        numVariants: 2,
        intensity: 0.8,
      },
    },
    {
      name: 'Cyberpunk style with high intensity',
      body: {
        pathOriginal,
        prompt: 'neon lights, futuristic',
        stylePreset: 'cyberpunk',
        numVariants: 3,
        intensity: 0.9,
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n🔄 Test: ${testCase.name}`);
    console.log('Request body:', JSON.stringify(testCase.body, null, 2));

    const startTime = Date.now();

    try {
      const response = await fetch(`${API_URL}/api/image/generate-variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.body),
      });

      const duration = Date.now() - startTime;
      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Success (${duration}ms)`);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data.variants && data.variants.length > 0) {
          console.log(`\n📦 Generated ${data.variants.length} variants:`);
          data.variants.forEach((v, i) => {
            console.log(`   ${i + 1}. ${v.path}`);
          });
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

// Test with invalid request
async function testInvalidRequests() {
  console.log('\n\n🧪 Testing invalid requests...\n');

  const invalidTests = [
    {
      name: 'Missing pathOriginal',
      body: {
        prompt: 'test',
      },
      expectedStatus: 400,
    },
    {
      name: 'Invalid numVariants (too high)',
      body: {
        pathOriginal: 'images/test.png',
        numVariants: 10,
      },
      expectedStatus: 400,
    },
    {
      name: 'Non-existent image',
      body: {
        pathOriginal: 'images/nonexistent/fake-image-12345.png',
      },
      expectedStatus: 404,
    },
  ];

  for (const test of invalidTests) {
    console.log(`\n🔄 Test: ${test.name}`);
    console.log('Expected status:', test.expectedStatus);

    try {
      const response = await fetch(`${API_URL}/api/image/generate-variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
  const pathOriginal = process.argv[2];

  if (!pathOriginal) {
    console.error('❌ Error: Please provide a pathOriginal as argument');
    console.error('Usage: node scripts/test-variants.js <pathOriginal>');
    console.error('Example: node scripts/test-variants.js images/test/original.png');
    process.exit(1);
  }

  // Test valid requests
  await testVariantGeneration(pathOriginal);

  // Test invalid requests
  await testInvalidRequests();

  console.log('\n\n✨ All tests completed!');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run tests
main();