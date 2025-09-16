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
import { Upload, Palette, Download, Loader2 } from 'lucide-react';

interface ImageStylerProps {
  onImageStyled?: (styledImageUrl: string) => void;
}

interface StyledResult {
  success: boolean;
  original_image: string;
  styled_image: string;
  style: string;
  prompt_used: string;
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

export const ImageStyler: React.FC<ImageStylerProps> = ({ onImageStyled }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('anime-cinematic');
  const [description, setDescription] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isStyleing, setIsStyleing] = useState(false);
  const [styledResult, setStyledResult] = useState<StyledResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/image/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadedImageUrl(result.url);
        console.log('Image uploaded successfully:', result.url);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const applyStyle = async () => {
    if (!uploadedImageUrl) {
      alert('Please upload an image first');
      return;
    }

    setIsStyleing(true);
    try {
      const response = await fetch('/api/image/style', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: uploadedImageUrl,
          style: selectedStyle,
          description: description.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStyledResult(result);
        if (onImageStyled) {
          onImageStyled(result.styled_image);
        }
        console.log('Style applied successfully:', result);
      } else {
        throw new Error(result.error || 'Style application failed');
      }
    } catch (error) {
      console.error('Styling error:', error);
      alert('Failed to apply style: ' + (error as Error).message);
    } finally {
      setIsStyleing(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setUploadedImageUrl('');
    setStyledResult(null);
    setPreviewUrl('');
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Image Style Transfer</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div>
            <Label htmlFor="image-upload">Upload Image</Label>
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                id="image-upload"
                accept="image/*"
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
          </div>

          {/* Preview */}
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

          {/* Upload Button */}
          {selectedFile && !uploadedImageUrl && (
            <Button
              onClick={uploadImage}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload Image'
              )}
            </Button>
          )}

          {/* Style Selection */}
          {uploadedImageUrl && !styledResult && (
            <>
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
                <Label htmlFor="description">Additional Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add specific details about how you want the image styled..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>

              <Button
                onClick={applyStyle}
                disabled={isStyleing}
                className="w-full"
              >
                {isStyleing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying Style...
                  </>
                ) : (
                  <>
                    <Palette className="h-4 w-4 mr-2" />
                    Apply Style
                  </>
                )}
              </Button>
            </>
          )}

          {/* Results */}
          {styledResult && (
            <div className="space-y-4">
              <Label>Style Transfer Results</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Original</h4>
                  <img
                    src={styledResult.original_image}
                    alt="Original"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Styled ({styledResult.style})</h4>
                  <img
                    src={styledResult.styled_image}
                    alt="Styled"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(styledResult.styled_image, '_blank')}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Styled Image
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};