import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to calculate SHA256 hash of a file using Web Crypto API
async function calculateSHA256(file: File | Blob): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();

    // Check if Web Crypto API is available
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback to a simple hash based on file properties
      const timestamp = Date.now();
      const size = file.size;
      const type = file.type || 'unknown';
      return `fallback_${timestamp}_${size}_${type.replace('/', '_')}`;
    }
  } catch (error) {
    console.warn('Failed to calculate SHA256, using fallback:', error);
    // Fallback to a simple hash based on file properties
    const timestamp = Date.now();
    const size = file.size;
    const type = file.type || 'unknown';
    return `fallback_${timestamp}_${size}_${type.replace('/', '_')}`;
  }
}

// Enhanced upload with immediate Supabase storage and metadata
export async function uploadImageWithMetadata(file: File): Promise<{
  url: string;
  path: string;
  sha256: string;
  size: number;
  contentType: string;
}> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const sha256 = await calculateSHA256(file);
  const fileName = `original-${sha256.substring(0, 16)}-${Date.now()}.${fileExt}`;
  const filePath = `images/${fileName}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file, {
      contentType: file.type || 'image/jpeg'
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);

  return {
    url: publicUrl,
    path: filePath,
    sha256,
    size: file.size,
    contentType: file.type || 'image/jpeg'
  };
}

// Helper function to upload image to Supabase Storage
export async function uploadImageToSupabase(file: File): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `images/${fileName}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);

  return {
    url: publicUrl,
    path: filePath
  };
}

// Helper function to upload image from URL to Supabase Storage
export async function uploadImageFromUrlToSupabase(imageUrl: string, prefix: string = 'styled'): Promise<{ url: string; path: string }> {
  try {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Get the image data as blob
    const blob = await response.blob();

    // Determine file extension from content type or default to jpg
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const fileExt = contentType.split('/')[1] || 'jpg';

    // Generate filename
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `images/${fileName}`;

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, blob, {
        contentType: contentType
      });

    if (error) {
      throw new Error(`Failed to upload image to Supabase: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      path: filePath
    };
  } catch (error) {
    console.error('Error uploading image from URL to Supabase:', error);
    throw error;
  }
}

// Function to save variant images with edit parameters
export async function saveVariantImage(
  imageUrl: string,
  originalSha256: string,
  variantIndex: number,
  editParams: {
    preset: string;
    prompt?: string;
    intensity?: number;
    options?: Record<string, any>;
  }
): Promise<{
  url: string;
  path: string;
  editParams: typeof editParams;
}> {
  try {
    // Fetch the variant image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch variant image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const fileExt = contentType.split('/')[1] || 'jpg';

    // Generate filename based on original hash and variant index
    const fileName = `edited_${originalSha256.substring(0, 16)}_v${variantIndex}_${Date.now()}.${fileExt}`;
    const filePath = `images/${fileName}`;

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, blob, {
        contentType: contentType,
        metadata: {
          original_sha256: originalSha256,
          variant_index: variantIndex.toString(),
          edit_params: JSON.stringify(editParams)
        }
      });

    if (error) {
      throw new Error(`Failed to upload variant image: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      path: filePath,
      editParams
    };
  } catch (error) {
    console.error('Error saving variant image:', error);
    throw error;
  }
}