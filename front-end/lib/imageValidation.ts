// Image validation utilities for the artwork workflow

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  dimensions?: { width: number; height: number };
  size: number;
  mimeType: string;
}

export interface ImageValidationRules {
  maxSizeBytes: number;
  minWidth: number;
  minHeight: number;
  allowedMimeTypes: string[];
}

export const DEFAULT_VALIDATION_RULES: ImageValidationRules = {
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  minWidth: 512,
  minHeight: 512,
  allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png']
};

// Validate image file before upload
export async function validateImageFile(
  file: File,
  rules: ImageValidationRules = DEFAULT_VALIDATION_RULES
): Promise<ImageValidationResult> {
  const result: ImageValidationResult = {
    isValid: false,
    size: file.size,
    mimeType: file.type
  };

  // Check MIME type
  if (!rules.allowedMimeTypes.includes(file.type.toLowerCase())) {
    result.error = `Invalid file type. Allowed: ${rules.allowedMimeTypes.join(', ')}`;
    return result;
  }

  // Check file size
  if (file.size > rules.maxSizeBytes) {
    const maxMB = rules.maxSizeBytes / (1024 * 1024);
    result.error = `File too large. Maximum size: ${maxMB} MB`;
    return result;
  }

  // Check dimensions
  try {
    const dimensions = await getImageDimensions(file);
    result.dimensions = dimensions;

    if (dimensions.width < rules.minWidth || dimensions.height < rules.minHeight) {
      result.error = `Image too small. Minimum dimensions: ${rules.minWidth}×${rules.minHeight}px`;
      return result;
    }

    result.isValid = true;
    return result;
  } catch (error) {
    result.error = 'Failed to read image dimensions';
    return result;
  }
}

// Get image dimensions from file
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Validate image URL (for ensuring stored images are accessible)
export async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok && response.headers.get('content-type')?.startsWith('image/');
  } catch {
    return false;
  }
}