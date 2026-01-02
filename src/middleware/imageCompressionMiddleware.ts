import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

interface ImageCompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Compress uploaded images before they are sent to Cloudinary
 * This middleware processes files from multer's memory storage
 */
export const compressImage = (options: ImageCompressionOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if there are files to process
      if (!req.file && !req.files) {
        return next();
      }

      // Handle single file upload
      if (req.file) {
        await compressSingleFile(req.file, options);
      }

      // Handle multiple files upload
      if (req.files) {
        if (Array.isArray(req.files)) {
          // Array of files
          for (const file of req.files) {
            await compressSingleFile(file, options);
          }
        } else {
          // Object with field names as keys
          const fileFields = req.files as { [fieldname: string]: Express.Multer.File[] };
          for (const fieldName in fileFields) {
            const files = fileFields[fieldName];
            if (files) {
              for (const file of files) {
                await compressSingleFile(file, options);
              }
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('Image compression error:', error);
      next(error);
    }
  };
};

/**
 * Compress a single file using Sharp
 */
async function compressSingleFile(
  file: Express.Multer.File,
  options: ImageCompressionOptions
): Promise<void> {
  try {
    // Only process image files
    if (!file.mimetype.startsWith('image/')) {
      return;
    }

    // Skip PDF files
    if (file.mimetype === 'application/pdf') {
      return;
    }

    const { maxWidth, maxHeight, quality, format } = options;

    // Read the original file
    let imageBuffer: Buffer;

    if (file.buffer) {
      // Memory storage - file is already in buffer
      imageBuffer = file.buffer;
    } else if (file.path) {
      // Disk storage - read from file system
      imageBuffer = await fs.promises.readFile(file.path);
    } else {
      console.warn('File has no buffer or path, skipping compression');
      return;
    }

    // Compress and resize the image
    let sharpInstance = sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside', // Maintain aspect ratio, fit within dimensions
        withoutEnlargement: true // Don't upscale smaller images
      });

    // Apply format conversion if specified
    if (format === 'jpeg' || !format) {
      sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
    } else if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality });
    }

    const compressedBuffer = await sharpInstance.toBuffer();

    // Calculate compression ratio
    const originalSize = imageBuffer.length;
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

    console.log(`[Image Compression] ${file.originalname}:`);
    console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Reduction: ${compressionRatio}%`);

    // Update the file object with compressed data
    if (file.buffer) {
      file.buffer = compressedBuffer;
      file.size = compressedBuffer.length;
    } else if (file.path) {
      // Write compressed buffer back to file
      await fs.promises.writeFile(file.path, compressedBuffer);
      file.size = compressedBuffer.length;
    }

  } catch (error) {
    console.error(`Error compressing file ${file.originalname}:`, error);
    // Don't throw error - allow upload to proceed with original file
  }
}

/**
 * Pre-configured compression presets
 */
export const compressionPresets = {
  // Category images: 800x800, 85% quality
  category: compressImage({
    maxWidth: 800,
    maxHeight: 800,
    quality: 85,
    format: 'jpeg'
  }),

  // Product images: 2000x2000, 85% quality
  product: compressImage({
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 85,
    format: 'jpeg'
  }),

  // PayLater documents: 2000x2000, 90% quality (higher quality for ID verification)
  paylaterDocument: compressImage({
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 90,
    format: 'jpeg'
  }),

  // Vendor documents: 1500x1500, 85% quality
  vendorDocument: compressImage({
    maxWidth: 1500,
    maxHeight: 1500,
    quality: 85,
    format: 'jpeg'
  })
};
