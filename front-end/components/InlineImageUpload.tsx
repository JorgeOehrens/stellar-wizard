'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface InlineImageUploadProps {
  onImageUploaded: (imageUrl: string, originalUrl?: string, styleInfo?: { style: string; success: boolean; error?: string }) => void;
  onError?: (error: string) => void;
}

export const InlineImageUpload: React.FC<InlineImageUploadProps> = ({
  onImageUploaded,
  onError
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [useUrl, setUseUrl] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('anime-cinematic');

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadAndStyleImage = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('style', selectedStyle);
      formData.append('description', description.trim());

      const response = await fetch('/api/image/upload-and-style', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        console.log('Upload and style successful:', result);
        const styleInfo = {
          style: selectedStyle,
          success: !result.stylization_error,
          error: result.stylization_error
        };
        onImageUploaded(result.styled_image, result.original_image, styleInfo);
      } else {
        throw new Error(result.error || 'Upload and style failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (manualUrl.trim()) {
      onImageUploaded(manualUrl.trim());
    }
  };

  if (useUrl) {
    return (
      <Card className="border-dashed border-2 border-primary/50">
        <CardContent className="p-4 space-y-4">
          <div className="text-center">
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <h3 className="font-medium">Enter Image URL</h3>
            <p className="text-sm text-muted-foreground">
              Paste the URL of your image
            </p>
          </div>

          <Textarea
            placeholder="https://example.com/your-image.jpg"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            rows={2}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleUrlSubmit}
              disabled={!manualUrl.trim()}
              className="flex-1"
            >
              Use This URL
            </Button>
            <Button
              variant="outline"
              onClick={() => setUseUrl(false)}
              className="flex-1"
            >
              Upload Instead
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-2 border-primary/50">
      <CardContent className="p-4 space-y-4">
        <div className="text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="font-medium">Upload Your Image</h3>
          <p className="text-sm text-muted-foreground">
            Upload and automatically style with your chosen art style! ✨
          </p>
        </div>

        {!selectedFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Image
              </Button>
              <Button
                variant="ghost"
                onClick={() => setUseUrl(true)}
                className="flex-1"
              >
                Or Use URL
              </Button>
            </div>
          </>
        )}

        {previewUrl && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-32 object-cover"
              />
            </div>

            <div>
              <Label htmlFor="style-select">Choose Art Style</Label>
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

            <Textarea
              placeholder="Add details for styling (optional): e.g., 'make it more magical', 'add fantasy elements'..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />

            <div className="flex gap-2">
              <Button
                onClick={uploadAndStyleImage}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Styling...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Style with {styleOptions.find(s => s.value === selectedStyle)?.label}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl('');
                  setDescription('');
                }}
                disabled={isUploading}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};