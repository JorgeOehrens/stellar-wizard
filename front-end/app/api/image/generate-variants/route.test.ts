import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
        upload: vi.fn(),
      })),
    },
  })),
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    images: {
      generate: vi.fn(),
    },
  })),
}));

describe('/api/image/generate-variants', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env;

    // Set required env variables
    process.env = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      OPENAI_API_KEY: 'test-openai-key',
    };

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Request Validation', () => {
    it('should return 400 if pathOriginal is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('pathOriginal is required');
    });

    it('should return 400 if numVariants is out of range', async () => {
      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/test/image.png',
          numVariants: 5,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('numVariants must be between 1 and 4');
    });

    it('should accept valid request with default values', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = (createClient as any)();

      // Mock successful signed URL creation
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/signed/image.png' },
        error: null,
      });

      // Mock successful upload
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: {},
        error: null,
      });

      // Mock OpenAI responses
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new (OpenAI as any)();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Image description' } }],
      });

      mockOpenAI.images.generate.mockResolvedValue({
        data: [{ url: 'https://openai.com/image.png' }],
      });

      // Mock fetch for image download
      mockFetch.mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['image data']),
      });

      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/test/image.png',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.variants).toBeInstanceOf(Array);
      expect(data.editParams).toEqual({
        prompt: '',
        stylePreset: 'anime',
        intensity: 0.7,
        seed: null,
      });
    });
  });

  describe('Signed URL Handling', () => {
    it('should return 404 if image not found in Supabase', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = (createClient as any)();

      // Mock failed signed URL creation
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Object not found' },
      });

      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/nonexistent/image.png',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Original image not found or cannot create signed URL');
    });
  });

  describe('Timeout Handling', () => {
    it('should return 504 on timeout after 45 seconds', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = (createClient as any)();

      // Mock successful signed URL creation
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/signed/image.png' },
        error: null,
      });

      // Mock OpenAI to simulate timeout
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new (OpenAI as any)();

      mockOpenAI.chat.completions.create.mockImplementation(async (_, options) => {
        // Simulate abort
        return new Promise((_, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/test/image.png',
        }),
      });

      // Fast-forward timers to trigger timeout
      vi.useFakeTimers();
      const responsePromise = POST(request);
      vi.advanceTimersByTime(45001);
      const response = await responsePromise;
      vi.useRealTimers();

      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data.error).toBe('Provider timeout - request took too long');
    });
  });

  describe('Variant Generation', () => {
    it('should generate and save multiple variants', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = (createClient as any)();

      // Mock successful signed URL creation
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/signed/image.png' },
        error: null,
      });

      // Track upload calls
      const uploadCalls: any[] = [];
      mockSupabase.storage.from().upload.mockImplementation((path, data) => {
        uploadCalls.push({ path, data });
        return Promise.resolve({ data: {}, error: null });
      });

      // Mock OpenAI responses
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new (OpenAI as any)();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Test image description' } }],
      });

      // Generate 3 different images
      let imageCount = 0;
      mockOpenAI.images.generate.mockImplementation(async () => ({
        data: [{ url: `https://openai.com/image${++imageCount}.png` }],
      }));

      // Mock fetch for image downloads
      mockFetch.mockImplementation((url) => {
        if (url.includes('openai.com')) {
          return Promise.resolve({
            ok: true,
            blob: async () => new Blob([`image data ${url}`]),
          });
        }
      });

      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/test/original.png',
          prompt: 'add sparkles',
          stylePreset: 'cyberpunk',
          numVariants: 3,
          intensity: 0.8,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.variants).toHaveLength(3);
      expect(data.variants[0].path).toBe('images/test/original_v1.png');
      expect(data.variants[1].path).toBe('images/test/original_v2.png');
      expect(data.variants[2].path).toBe('images/test/original_v3.png');

      expect(data.editParams).toEqual({
        prompt: 'add sparkles',
        stylePreset: 'cyberpunk',
        intensity: 0.8,
        seed: null,
      });

      // Verify uploads were called correctly
      expect(uploadCalls).toHaveLength(3);
      expect(uploadCalls[0].path).toBe('images/test/original_v1.png');
      expect(uploadCalls[1].path).toBe('images/test/original_v2.png');
      expect(uploadCalls[2].path).toBe('images/test/original_v3.png');
    });

    it('should handle provider errors gracefully', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = (createClient as any)();

      // Mock successful signed URL creation
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/signed/image.png' },
        error: null,
      });

      // Mock OpenAI Vision API error
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new (OpenAI as any)();

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API error: rate limit exceeded')
      );

      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/test/image.png',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toBe('Provider or storage error');
      expect(data.detail).toContain('OpenAI API error');
    });

    it('should handle storage upload errors', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = (createClient as any)();

      // Mock successful signed URL creation
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/signed/image.png' },
        error: null,
      });

      // Mock failed upload
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: { message: 'Storage quota exceeded' },
      });

      // Mock successful OpenAI calls
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new (OpenAI as any)();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Image description' } }],
      });

      mockOpenAI.images.generate.mockResolvedValue({
        data: [{ url: 'https://openai.com/image.png' }],
      });

      // Mock fetch for image download
      mockFetch.mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['image data']),
      });

      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/test/image.png',
          numVariants: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toBe('Provider or storage error');
      expect(data.detail).toContain('Storage quota exceeded');
    });
  });

  describe('Style Presets', () => {
    const stylePresets = [
      'anime',
      'anime-cinematic',
      'cyberpunk',
      'oil-painting',
      'pixel-art',
      'watercolor',
      'sketch',
      'pop-art',
    ];

    it.each(stylePresets)('should support %s style preset', async (style) => {
      const { createClient } = await import('@supabase/supabase-js');
      const mockSupabase = (createClient as any)();

      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://test.supabase.co/signed/image.png' },
        error: null,
      });

      mockSupabase.storage.from().upload.mockResolvedValue({
        data: {},
        error: null,
      });

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new (OpenAI as any)();

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Image description' } }],
      });

      // Capture the prompt used
      let capturedPrompt = '';
      mockOpenAI.images.generate.mockImplementation(async (params) => {
        capturedPrompt = params.prompt;
        return { data: [{ url: 'https://openai.com/image.png' }] };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['image data']),
      });

      const request = new NextRequest('http://localhost:3000/api/image/generate-variants', {
        method: 'POST',
        body: JSON.stringify({
          pathOriginal: 'images/test/image.png',
          stylePreset: style,
          numVariants: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.editParams.stylePreset).toBe(style);
      expect(capturedPrompt).toContain(style.replace('-', ' '));
    });
  });
});