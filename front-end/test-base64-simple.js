#!/usr/bin/env node

const test = async () => {
  try {
    // Simple 1x1 red pixel
    const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hTBu4QAAAABJRU5ErkJggg==";

    const response = await fetch('http://localhost:3002/api/image/generate-from-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        style: 'anime',
        saveToStorage: false
      })
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Success:', result.success);

    if (result.success) {
      console.log('Variant generated successfully!');
      console.log('Has base64:', !!result.variant?.base64);
      console.log('Has URL:', !!result.variant?.url);
      console.log('Method:', result.generation?.method);
    } else {
      console.log('Error:', result.error);
      console.log('Details:', result.details);
    }
  } catch (error) {
    console.log('Request failed:', error.message);
  }
};

test();