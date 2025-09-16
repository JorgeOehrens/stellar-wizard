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
import { Upload, Palette, Download, Loader2, Sparkles, RefreshCw, Check, AlertCircle, History } from 'lucide-react';
import { uploadImageWithMetadata } from '@/lib/supabase';
import { validateImageFile, formatFileSize, ImageValidationResult } from '@/lib/imageValidation';

interface IterativeArtworkCreatorProps {
  onImageSelected?: (imageUrl: string, metadata?: ArtworkMetadata) => void;
}

interface ArtworkMetadata {
  originalUrl: string;
  originalPath: string;
  originalSha256: string;
  currentReference: string; // The current reference image being used for edits
  currentReferencePath: string;
  iterations: IterationData[];
  editParams?: EditParameters;
}

interface IterationData {
  id: number;
  referenceUrl: string;
  variants: VariantData[];
  editParams: EditParameters;
  selectedVariantIndex?: number;
  timestamp: string;
}

interface VariantData {
  index: number;
  url: string;
  path: string;
  editParams: EditParameters;
  success: boolean;
  error?: string;
}

interface EditParameters {
  preset: string;
  prompt?: string;
  intensity?: number;
  options?: Record<string, any>;
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

export const IterativeArtworkCreator: React.FC<IterativeArtworkCreatorProps> = ({ onImageSelected }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImageValidationResult | null>(null);
  const [artworkMetadata, setArtworkMetadata] = useState<ArtworkMetadata | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('anime-cinematic');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [intensity, setIntensity] = useState<number>(0.7);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [currentIteration, setCurrentIteration] = useState<IterationData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'validated' | 'editing' | 'selection'>('upload');
  const [iterations, setIterations] = useState<IterationData[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Validate immediately
    const validation = await validateImageFile(file);
    setValidationResult(validation);

    if (validation.isValid) {
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
        setStep('validated');
      };
      reader.readAsDataURL(file);
    } else {
      setStep('upload');
      setPreviewUrl('');
    }
  };

  const uploadAndInitialize = async () => {
    if (!selectedFile || !validationResult?.isValid) return;

    setIsUploading(true);
    try {
      const uploadResult = await uploadImageWithMetadata(selectedFile);

      const metadata: ArtworkMetadata = {
        originalUrl: uploadResult.url,
        originalPath: uploadResult.path,
        originalSha256: uploadResult.sha256,
        currentReference: uploadResult.url,
        currentReferencePath: uploadResult.path,
        iterations: []
      };

      setArtworkMetadata(metadata);
      setIterations([]);
      setStep('editing');
      console.log('Original image uploaded and validated:', metadata);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const generateVariants = async () => {
    if (!artworkMetadata) return;

    setIsGeneratingVariants(true);
    try {
      const iterationId = iterations.length + 1;
      const editParams: EditParameters = {
        preset: selectedStyle,
        prompt: customPrompt.trim() || undefined,
        intensity,
        options: { variantCount: 1 }
      };

      // Convert current reference image to base64
      console.log('Converting reference image to base64...');
      const imageResponse = await fetch(artworkMetadata.currentReference);
      const imageBlob = await imageResponse.blob();

      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract just the base64 part (remove data:image/...;base64, prefix)
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(imageBlob);
      });

      console.log('Generating variant with base64 endpoint...');
      const response = await fetch('/api/image/generate-from-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          style: selectedStyle,
          prompt: customPrompt.trim() || undefined,
          intensity,
          saveToStorage: true,
          filename: `variant-${selectedStyle}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Base64 endpoint result:', result);

        // Convert the result to match expected VariantData format
        // Prioritize the Supabase URL, fall back to base64 if URL is not available
        const variantUrl = result.variant.url || result.variant.base64;

        const variant: VariantData = {
          index: 1,
          url: variantUrl,
          path: result.variant.path || '',
          editParams,
          success: true
        };

        console.log('Created variant with URL:', variantUrl);

        const newIteration: IterationData = {
          id: iterationId,
          referenceUrl: artworkMetadata.currentReference,
          variants: [variant],
          editParams,
          timestamp: new Date().toISOString()
        };

        setCurrentIteration(newIteration);
        setIterations(prev => [...prev, newIteration]);
        setStep('selection');
        console.log('Iteration completed:', newIteration);
      } else {
        throw new Error(result.error || 'Variant generation failed');
      }
    } catch (error) {
      console.error('Variant generation error:', error);
      alert('Failed to generate variants: ' + (error as Error).message);
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const selectVariant = (variantIndex: number) => {
    if (!currentIteration || !artworkMetadata) return;

    // Update iteration with selected variant
    const updatedIteration = {
      ...currentIteration,
      selectedVariantIndex: variantIndex
    };

    // Update iterations list
    setIterations(prev =>
      prev.map(iter => iter.id === currentIteration.id ? updatedIteration : iter)
    );

    if (variantIndex === 0) {
      // Selected original - use original as reference
      const finalMetadata: ArtworkMetadata = {
        ...artworkMetadata,
        iterations: [...iterations.slice(0, -1), updatedIteration]
      };

      if (onImageSelected) {
        onImageSelected(artworkMetadata.originalUrl, finalMetadata);
      }
    } else {
      // Selected a variant - use it as reference for potential next iteration
      const variant = currentIteration.variants.find(v => v.index === variantIndex);
      if (variant && variant.success) {
        const updatedMetadata: ArtworkMetadata = {
          ...artworkMetadata,
          currentReference: variant.url,
          currentReferencePath: variant.path,
          editParams: variant.editParams,
          iterations: [...iterations.slice(0, -1), updatedIteration]
        };

        setArtworkMetadata(updatedMetadata);

        if (onImageSelected) {
          onImageSelected(variant.url, updatedMetadata);
        }
      }
    }
  };

  const startNewIteration = () => {
    setCurrentIteration(null);
    setCustomPrompt('');
    setStep('editing');
  };

  const startOver = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setArtworkMetadata(null);
    setCurrentIteration(null);
    setIterations([]);
    setPreviewUrl('');
    setCustomPrompt('');
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const successfulVariants = currentIteration?.variants.filter(v => v.success) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Palette className="h-5 w-5" />
          <span>Enhanced Iterative Artwork Creation</span>
          {iterations.length > 0 && (
            <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
              {iterations.length} iteration{iterations.length !== 1 ? 's' : ''}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Upload & Validation */}
        {step === 'upload' && (
          <div className="space-y-4">
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
                  Choose Image (JPG/PNG, ≤10MB, ≥512×512px)
                </Button>
              </div>
            </div>

            {validationResult && !validationResult.isValid && (
              <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Validation Failed</span>
                </div>
                <p className="text-red-600 text-sm mt-1">{validationResult.error}</p>
                {selectedFile && (
                  <p className="text-red-500 text-xs mt-2">
                    File: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Validated & Ready to Upload */}
        {step === 'validated' && (
          <div className="space-y-4">
            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="font-medium">Image Validated Successfully</span>
              </div>
              {validationResult && (
                <div className="text-green-600 text-sm mt-2">
                  <p>Dimensions: {validationResult.dimensions?.width}×{validationResult.dimensions?.height}px</p>
                  <p>Size: {formatFileSize(validationResult.size)}</p>
                  <p>Type: {validationResult.mimeType}</p>
                </div>
              )}
            </div>

            {previewUrl && (
              <div>
                <Label>Preview</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={uploadAndInitialize}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading to Supabase Storage...
                </>
              ) : (
                'Upload & Initialize Canonical Reference'
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Editing Configuration */}
        {step === 'editing' && artworkMetadata && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium text-green-600">
                ✓ Reference stored in Supabase
                {iterations.length > 0 && ` • Iteration ${iterations.length + 1}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                SHA256: {artworkMetadata.originalSha256.substring(0, 16)}...
              </p>
            </div>

            {iterations.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2 text-sm">
                  <History className="h-4 w-4" />
                  <span>Current reference from iteration {iterations.length}</span>
                </div>
                <img
                  src={artworkMetadata.currentReference}
                  alt="Current reference"
                  className="w-full h-24 object-cover rounded mt-2"
                />
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

            <Button
              onClick={generateVariants}
              disabled={isGeneratingVariants}
              className="w-full"
            >
              {isGeneratingVariants ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Style Variant from Reference...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Style Variant
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 4: Variant Selection */}
        {step === 'selection' && currentIteration && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium">Choose Your Favorite (Iteration {currentIteration.id})</h3>
              <p className="text-sm text-muted-foreground">
                {successfulVariants.length} variants generated successfully
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Current Reference Option */}
              <div
                className="relative border rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-gray-300"
                onClick={() => selectVariant(0)}
              >
                <img
                  src={currentIteration.referenceUrl}
                  alt="Current Reference"
                  className="w-full h-32 object-cover"
                />
                <div className="p-2 bg-white">
                  <p className="text-xs font-medium">
                    {iterations.length === 1 ? 'Original' : `Iteration ${iterations.length - 1} Result`}
                  </p>
                  <p className="text-xs text-muted-foreground">Current Reference</p>
                </div>
              </div>

              {/* Variant Options */}
              {successfulVariants.map((variant) => (
                <div
                  key={variant.index}
                  className="relative border rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-gray-300"
                  onClick={() => selectVariant(variant.index)}
                >
                  <img
                    src={variant.url}
                    alt={`Variant ${variant.index}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-2 bg-white">
                    <p className="text-xs font-medium">Variant {variant.index}</p>
                    <p className="text-xs text-muted-foreground">
                      {styleOptions.find(s => s.value === selectedStyle)?.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={startNewIteration}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Continue Iterating
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('editing')}
                className="flex-1"
              >
                Different Style
              </Button>
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