'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Palette, Download, Loader2, Sparkles, RefreshCw, Check, AlertCircle, ArrowRight, FileImage, Clipboard } from 'lucide-react';
import { uploadImageWithMetadata } from '@/lib/supabase';
import { validateImageFile, formatFileSize } from '@/lib/imageValidation';

interface VariantArtworkCreatorProps {
  onImageSelected?: (imageUrl: string, metadata?: ImageMetadata) => void;
}

interface ImageMetadata {
  originalUrl: string;
  originalPath: string;
  originalSha256: string;
  editParams?: {
    preset: string;
    prompt?: string;
    intensity?: number;
    options?: Record<string, any>;
  };
}

interface Variant {
  index: number;
  url: string;
  path: string;
  editParams: any;
  success: boolean;
  error?: string;
}

const styleOptions = [
  { value: 'anime-cinematic', label: 'Anime Cinematic', description: 'Hand-painted cinematic style with soft pastels and cel-shading' },
  { value: 'cyberpunk', label: 'Cyberpunk', description: 'Futuristic neon and digital art' },
  { value: 'oil-painting', label: 'Oil Painting', description: 'Classical renaissance painting style' },
  { value: 'pixel-art', label: 'Pixel Art', description: 'Retro 8-bit gaming style' },
  { value: 'anime', label: 'Anime', description: 'Japanese manga/anime art style' },
  { value: 'watercolor', label: 'Watercolor', description: 'Soft watercolor painting' },
  { value: 'sketch', label: 'Pencil Sketch', description: 'Hand-drawn pencil sketch' },
  { value: 'pop-art', label: 'Pop Art', description: 'Bold colors and comic book style' },
];

export const VariantArtworkCreator: React.FC<VariantArtworkCreatorProps> = ({ onImageSelected }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalMetadata, setOriginalMetadata] = useState<ImageMetadata | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('anime-cinematic');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [intensity, setIntensity] = useState<number>(0.7);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'variants' | 'selection'>('upload');
  const [validationError, setValidationError] = useState<string>('');
  const [imageInfo, setImageInfo] = useState<{ size: string; dimensions?: string } | null>(null);
  const [currentReferenceUrl, setCurrentReferenceUrl] = useState<string>('');
  const [iterationHistory, setIterationHistory] = useState<Array<{
    referenceUrl: string;
    style: string;
    prompt?: string;
    variants: Variant[];
  }>>([]);
  const [uploadError, setUploadError] = useState<string>('');
  const [variantError, setVariantError] = useState<string>('');
  const [inputMethod, setInputMethod] = useState<'file' | 'base64'>('file');
  const [base64Input, setBase64Input] = useState<string>('');
  const [base64Error, setBase64Error] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous validation error and info
    setValidationError('');
    setImageInfo(null);

    // Validate the image file
    const validation = await validateImageFile(file);

    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid image file');
      setSelectedFile(null);
      setPreviewUrl('');
      return;
    }

    setSelectedFile(file);

    // Set image info
    const dimensionsText = validation.dimensions
      ? `${validation.dimensions.width}×${validation.dimensions.height}px`
      : undefined;
    setImageInfo({
      size: formatFileSize(validation.size),
      dimensions: dimensionsText
    });

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBase64Input = (base64String: string) => {
    setBase64Error('');
    setBase64Input(base64String);

    if (!base64String.trim()) {
      setPreviewUrl('');
      return;
    }

    try {
      // Validate base64 format
      let cleanBase64 = base64String.trim();

      // If it's already a data URL, use as is
      if (cleanBase64.startsWith('data:image/')) {
        setPreviewUrl(cleanBase64);
        return;
      }

      // If it's just base64, add data URL prefix
      if (cleanBase64.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
        // Try to determine format from base64 header
        let format = 'png';
        if (cleanBase64.startsWith('/9j/')) format = 'jpeg';
        else if (cleanBase64.startsWith('iVBORw0KGgo')) format = 'png';
        else if (cleanBase64.startsWith('R0lGODlh')) format = 'gif';

        const dataUrl = `data:image/${format};base64,${cleanBase64}`;
        setPreviewUrl(dataUrl);
        return;
      }

      throw new Error('Invalid base64 format');
    } catch (error) {
      setBase64Error('Invalid base64 image data. Please provide a valid base64 string or data URL.');
      setPreviewUrl('');
    }
  };

  const uploadOriginalImage = async () => {
    if (!selectedFile && inputMethod === 'file') return;
    if (!base64Input && inputMethod === 'base64') return;

    setIsUploading(true);
    setUploadError('');

    try {
      if (inputMethod === 'file' && selectedFile) {
        // Traditional file upload
        const uploadResult = await uploadImageWithMetadata(selectedFile);

        const metadata: ImageMetadata = {
          originalUrl: uploadResult.url,
          originalPath: uploadResult.path,
          originalSha256: uploadResult.sha256
        };

        setOriginalMetadata(metadata);
        setCurrentReferenceUrl(uploadResult.url);
        setStep('variants');
        console.log('Original image uploaded:', metadata);
      } else if (inputMethod === 'base64' && base64Input) {
        // Base64 input - no upload needed, go directly to variants
        const metadata: ImageMetadata = {
          originalUrl: previewUrl, // Use the data URL as the original
          originalPath: 'base64-input', // Placeholder path
          originalSha256: 'base64-input' // Placeholder hash
        };

        setOriginalMetadata(metadata);
        setCurrentReferenceUrl(previewUrl);
        setStep('variants');
        console.log('Base64 image processed:', metadata);
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      setUploadError(`Failed to process image: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const generateVariants = async () => {
    if (!originalMetadata || !currentReferenceUrl) return;

    setIsGeneratingVariants(true);
    setVariantError('');

    try {
      // Determine if we should use base64 endpoint or traditional variants endpoint
      const isBase64Input = currentReferenceUrl.startsWith('data:image/');

      let response;

      if (isBase64Input) {
        // Use base64 variant generation endpoint
        response = await fetch('/api/image/generate-from-base64', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: currentReferenceUrl,
            style: selectedStyle,
            prompt: customPrompt.trim() || undefined,
            intensity,
            saveToStorage: true,
            filename: `variant-${selectedStyle}-${Date.now()}.png`
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          // Convert single variant result to variants array format
          // Prioritize URL from storage, fallback to base64 if no URL
          const variantUrl = result.variant?.url || result.variant?.base64;

          if (!variantUrl) {
            throw new Error('No variant image URL or base64 data received from server');
          }

          const newVariants = [{
            index: 1,
            url: variantUrl,
            path: result.variant?.path || 'base64-variant',
            editParams: {
              style: selectedStyle,
              prompt: customPrompt.trim() || undefined,
              intensity,
              method: result.generation?.method || 'base64-generation'
            },
            success: true
          }];

          console.log('Base64 variant created:', {
            url: variantUrl,
            method: result.generation?.method,
            hasStorageUrl: !!result.variant?.url,
            hasBase64: !!result.variant?.base64
          });

          setVariants(newVariants);

          // Add to iteration history
          setIterationHistory(prev => [...prev, {
            referenceUrl: currentReferenceUrl,
            style: selectedStyle,
            prompt: customPrompt.trim() || undefined,
            variants: newVariants
          }]);

          setStep('selection');
          console.log('Base64 variant generated:', result);
        } else {
          throw new Error(result.error || 'Base64 variant generation failed');
        }
      } else {
        // Use traditional variants endpoint
        response = await fetch('/api/image/generate-variants', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: currentReferenceUrl,
            originalSha256: originalMetadata.originalSha256,
            style: selectedStyle,
            customPrompt: customPrompt.trim() || undefined,
            intensity,
            variantCount: 2
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          const newVariants = result.variants;

          // Check if any variants were generated successfully
          const successfulVariants = newVariants.filter((v: Variant) => v.success);
          if (successfulVariants.length === 0) {
            throw new Error('No variants were generated successfully');
          }

          setVariants(newVariants);

          // Add to iteration history
          setIterationHistory(prev => [...prev, {
            referenceUrl: currentReferenceUrl,
            style: selectedStyle,
            prompt: customPrompt.trim() || undefined,
            variants: newVariants
          }]);

          setStep('selection');
          console.log('Variants generated:', result);

          // Show warning if some variants failed
          if (successfulVariants.length < newVariants.length) {
            setVariantError(`Warning: Only ${successfulVariants.length} of ${newVariants.length} variants generated successfully`);
          }
        } else {
          throw new Error(result.error || 'Variant generation failed');
        }
      }
    } catch (error) {
      console.error('Variant generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown variant generation error';
      setVariantError(`Failed to generate variants: ${errorMessage}`);
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const selectVariant = (variantIndex: number) => {
    setSelectedVariant(variantIndex);
    const variant = variants.find(v => v.index === variantIndex);

    if (variant && onImageSelected) {
      const metadata: ImageMetadata = {
        ...originalMetadata!,
        editParams: variant.editParams
      };
      onImageSelected(variant.url, metadata);
    }
  };

  const useOriginalImage = () => {
    if (originalMetadata && onImageSelected) {
      onImageSelected(originalMetadata.originalUrl, originalMetadata);
    }
  };

  const iterateWithVariant = (variantIndex: number) => {
    const variant = variants.find(v => v.index === variantIndex);
    if (!variant) return;

    // Set the selected variant as the new reference
    setCurrentReferenceUrl(variant.url);
    setSelectedVariant(null);
    setVariants([]);
    setStep('variants');

    // Clear custom prompt for new iteration
    setCustomPrompt('');
  };

  const startOver = () => {
    setSelectedFile(null);
    setOriginalMetadata(null);
    setVariants([]);
    setSelectedVariant(null);
    setPreviewUrl('');
    setCustomPrompt('');
    setValidationError('');
    setImageInfo(null);
    setCurrentReferenceUrl('');
    setIterationHistory([]);
    setUploadError('');
    setVariantError('');
    setBase64Input('');
    setBase64Error('');
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const successfulVariants = variants.filter(v => v.success);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Palette className="h-5 w-5" />
          <span>Enhanced Artwork Creation</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Upload Image */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Input Method Toggle */}
            <div>
              <Label>Input Method</Label>
              <div className="flex mt-2 bg-muted rounded-lg p-1">
                <Button
                  type="button"
                  variant={inputMethod === 'file' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setInputMethod('file');
                    setBase64Input('');
                    setBase64Error('');
                    setPreviewUrl('');
                  }}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  type="button"
                  variant={inputMethod === 'base64' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setInputMethod('base64');
                    setSelectedFile(null);
                    setValidationError('');
                    setImageInfo(null);
                    setPreviewUrl('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="flex-1"
                >
                  <Clipboard className="h-4 w-4 mr-2" />
                  Paste Base64
                </Button>
              </div>
            </div>

            {/* File Upload */}
            {inputMethod === 'file' && (
              <div>
                <Label htmlFor="image-upload">Upload Your Image</Label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="image-upload"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Image
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported: JPG, PNG • Max 10 MB • Min 512×512px
                </p>
              </div>
            )}

            {/* Base64 Input */}
            {inputMethod === 'base64' && (
              <div>
                <Label htmlFor="base64-input">Base64 Image Data</Label>
                <Textarea
                  id="base64-input"
                  placeholder="Paste your base64 image data here (with or without data:image prefix)..."
                  value={base64Input}
                  onChange={(e) => handleBase64Input(e.target.value)}
                  className="mt-2 font-mono text-xs"
                  rows={4}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    Supports data URLs (data:image/...) or raw base64 strings
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const testBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hTBu4QAAAABJRU5ErkJggg==";
                      handleBase64Input(testBase64);
                    }}
                    className="text-xs"
                  >
                    Use Test Image
                  </Button>
                </div>
              </div>
            )}

            {validationError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive font-medium">Invalid Image</p>
                </div>
                <p className="text-sm text-destructive mt-1">{validationError}</p>
              </div>
            )}

            {base64Error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive font-medium">Invalid Base64</p>
                </div>
                <p className="text-sm text-destructive mt-1">{base64Error}</p>
              </div>
            )}

            {previewUrl && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>Preview</Label>
                  {imageInfo && (
                    <div className="text-xs text-muted-foreground">
                      {imageInfo.size}{imageInfo.dimensions ? ` • ${imageInfo.dimensions}` : ''}
                    </div>
                  )}
                </div>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive font-medium">Upload Failed</p>
                </div>
                <p className="text-sm text-destructive mt-1">{uploadError}</p>
              </div>
            )}

            {((inputMethod === 'file' && selectedFile) || (inputMethod === 'base64' && base64Input && previewUrl && !base64Error)) && (
              <Button
                onClick={uploadOriginalImage}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {inputMethod === 'file' ? 'Uploading to Storage...' : 'Processing Image...'}
                  </>
                ) : (
                  inputMethod === 'file' ? 'Upload & Continue' : 'Process & Continue'
                )}
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Configure Variants */}
        {step === 'variants' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium text-green-600">
                ✓ {iterationHistory.length === 0 ? 'Original image uploaded' : `Iteration ${iterationHistory.length + 1}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {iterationHistory.length === 0
                  ? 'Now configure your AI style variants'
                  : 'Continue iterating with new style variants'}
              </p>
            </div>

            {/* Show current reference image */}
            {currentReferenceUrl && (
              <div>
                <Label>Current Reference</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <img
                    src={currentReferenceUrl}
                    alt="Current reference"
                    className="w-full h-32 object-cover"
                  />
                </div>
                {iterationHistory.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on variant from iteration {iterationHistory.length}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="style-select">Art Style</Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {styleOptions.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      <div>
                        <div className="font-medium">{style.label}</div>
                        <div className="text-sm text-muted-foreground">{style.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custom-prompt">Custom Prompt (Optional)</Label>
              <Textarea
                id="custom-prompt"
                placeholder="Add specific details: 'add magical sparkles', 'make it more dramatic', 'change background to forest'..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>

            {variantError && !isGeneratingVariants && (
              <div className={`p-3 border rounded-lg ${
                variantError.startsWith('Warning:')
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-destructive/10 border-destructive/20'
              }`}>
                <div className="flex items-center space-x-2">
                  <AlertCircle className={`h-4 w-4 ${
                    variantError.startsWith('Warning:') ? 'text-yellow-600' : 'text-destructive'
                  }`} />
                  <p className={`text-sm font-medium ${
                    variantError.startsWith('Warning:') ? 'text-yellow-800' : 'text-destructive'
                  }`}>
                    {variantError.startsWith('Warning:') ? 'Partial Success' : 'Generation Failed'}
                  </p>
                </div>
                <p className={`text-sm mt-1 ${
                  variantError.startsWith('Warning:') ? 'text-yellow-700' : 'text-destructive'
                }`}>
                  {variantError}
                </p>
              </div>
            )}

            <Button
              onClick={generateVariants}
              disabled={isGeneratingVariants}
              className="w-full"
            >
              {isGeneratingVariants ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {currentReferenceUrl.startsWith('data:image/') ? 'Generating Base64 Variant...' : 'Generating 2 Variants...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {variantError && !variantError.startsWith('Warning:') ? 'Retry Generation' :
                   currentReferenceUrl.startsWith('data:image/') ? 'Generate Base64 Variant' : 'Generate Style Variants'}
                </>
              )}
            </Button>

            {variantError && !variantError.startsWith('Warning:') && !isGeneratingVariants && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('upload')}
                  className="flex-1"
                  size="sm"
                >
                  Start Over
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVariantError('');
                    setCurrentReferenceUrl(originalMetadata?.originalUrl || '');
                    setIterationHistory([]);
                  }}
                  className="flex-1"
                  size="sm"
                >
                  Use Original Image
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Select Variant */}
        {step === 'selection' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium">Choose Your Action</h3>
              <p className="text-sm text-muted-foreground">
                {successfulVariants.length} variants generated • Iteration {iterationHistory.length}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Original Image Option */}
              <div
                className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all ${
                  selectedVariant === 0 ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-gray-300'
                }`}
                onClick={() => setSelectedVariant(0)}
              >
                <img
                  src={originalMetadata?.originalUrl}
                  alt="Original"
                  className="w-full h-32 object-cover"
                />
                <div className="absolute top-2 right-2">
                  {selectedVariant === 0 && (
                    <div className="bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="p-2 bg-white">
                  <p className="text-xs font-medium">Original</p>
                  <p className="text-xs text-muted-foreground">Unchanged</p>
                </div>
              </div>

              {/* Variant Options */}
              {successfulVariants.map((variant) => (
                <div
                  key={variant.index}
                  className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedVariant === variant.index ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-gray-300'
                  }`}
                  onClick={() => setSelectedVariant(variant.index)}
                >
                  <img
                    src={variant.url}
                    alt={`Variant ${variant.index}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    {selectedVariant === variant.index && (
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-white">
                    <p className="text-xs font-medium">Variant {variant.index}</p>
                    <p className="text-xs text-muted-foreground">
                      {styleOptions.find(s => s.value === selectedStyle)?.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {/* Primary Actions */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => selectedVariant === 0 ? useOriginalImage() : selectVariant(selectedVariant!)}
                  disabled={selectedVariant === null}
                  className="flex-1"
                >
                  Use Selected Image
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedVariant !== null && selectedVariant !== 0 ? iterateWithVariant(selectedVariant) : null}
                  disabled={selectedVariant === null || selectedVariant === 0}
                  className="flex-1"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Iterate with This
                </Button>
              </div>

              {/* Secondary Actions */}
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('variants')}
                  className="flex-1"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Different Style
                </Button>
                {successfulVariants.length === 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Go back to try again with same settings
                      setStep('variants');
                      setVariantError('');
                    }}
                    className="flex-1"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Generation
                  </Button>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={startOver}
              className="w-full"
            >
              Start Over
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};