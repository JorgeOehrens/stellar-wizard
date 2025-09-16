import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('image') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload JPEG, PNG, or WebP images.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = path.extname(file.name);
    const filename = `${timestamp}-${Math.random().toString(36).substring(2)}${fileExtension}`;
    const filepath = path.join(uploadsDir, filename);

    // Write file
    await writeFile(filepath, buffer);

    // Return public URL
    const imageUrl = `/uploads/${filename}`;
    const fullUrl = `${request.nextUrl.origin}${imageUrl}`;

    console.log('Image uploaded successfully:', {
      filename,
      size: file.size,
      type: file.type,
      url: fullUrl
    });

    return NextResponse.json({
      success: true,
      filename,
      url: fullUrl,
      size: file.size,
      type: file.type
    });

  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}