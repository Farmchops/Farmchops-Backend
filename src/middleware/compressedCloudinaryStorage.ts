import { Request } from 'express';
import sharp from 'sharp';
import cloudinary from '../config/cloudinary';
import { Readable } from 'stream';

interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

interface CloudinaryParams {
  folder: string;
  allowed_formats: string[];
  transformation?: any[];
}

/**
 * Custom Multer storage engine that compresses images with Sharp
 * before uploading to Cloudinary
 */
class CompressedCloudinaryStorage {
  private folder: string;
  private allowedFormats: string[];
  private compressionOptions: CompressionOptions;

  constructor(params: CloudinaryParams & { compression: CompressionOptions }) {
    this.folder = params.folder;
    this.allowedFormats = params.allowed_formats;
    this.compressionOptions = params.compression;
  }

  async _handleFile(req: Request, file: Express.Multer.File, cb: Function) {
    try {
      // Check if file format is allowed
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      if (fileExtension && !this.allowedFormats.includes(fileExtension)) {
        return cb(new Error(`File format not allowed. Allowed formats: ${this.allowedFormats.join(', ')}`));
      }

      // Only compress images (skip PDFs)
      let uploadStream: Readable;
      let fileSize: number;

      if (file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
        // Compress the image with Sharp
        const chunks: Buffer[] = [];

        file.stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.stream.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const originalSize = buffer.length;

            // Compress with Sharp
            const compressedBuffer = await sharp(buffer)
              .resize(this.compressionOptions.maxWidth, this.compressionOptions.maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ quality: this.compressionOptions.quality, mozjpeg: true })
              .toBuffer();

            fileSize = compressedBuffer.length;
            const compressionRatio = ((1 - fileSize / originalSize) * 100).toFixed(2);

            console.log(`[Sharp Compression] ${file.originalname}:`);
            console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Compressed: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Reduction: ${compressionRatio}%`);

            // Create stream from compressed buffer
            uploadStream = Readable.from(compressedBuffer);

            // Upload to Cloudinary
            this.uploadToCloudinary(uploadStream, file, fileSize, cb);
          } catch (error) {
            cb(error);
          }
        });

        file.stream.on('error', (error: Error) => {
          cb(error);
        });
      } else {
        // For non-image files (PDFs), upload directly without compression
        uploadStream = file.stream;
        this.uploadToCloudinary(uploadStream, file, 0, cb);
      }
    } catch (error) {
      cb(error);
    }
  }

  private uploadToCloudinary(stream: Readable, file: Express.Multer.File, size: number, cb: Function) {
    const cloudinaryUploadStream = cloudinary.uploader.upload_stream(
      {
        folder: this.folder,
        resource_type: 'auto'
      },
      (error: any, result: any) => {
        if (error) {
          return cb(error);
        }

        cb(null, {
          path: result!.secure_url,
          filename: result!.public_id,
          size: size || result!.bytes,
          url: result!.secure_url,
          public_id: result!.public_id
        });
      }
    );

    stream.pipe(cloudinaryUploadStream);
  }

  _removeFile(req: Request, file: any, cb: Function) {
    // Delete from Cloudinary if needed
    if (file.public_id) {
      cloudinary.uploader.destroy(file.public_id, (error: any, result: any) => {
        cb(error);
      });
    } else {
      cb(null);
    }
  }
}

export default CompressedCloudinaryStorage;
