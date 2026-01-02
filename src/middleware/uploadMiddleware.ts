import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';
import CompressedCloudinaryStorage from './compressedCloudinaryStorage';

// Category Image Upload with Sharp compression
const categoryStorage = new CompressedCloudinaryStorage({
  folder: 'farmchops/categories',
  allowed_formats: ['jpg', 'jpeg', 'png'],
  compression: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 85
  }
}) as any;

export const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB (Sharp will compress to ~1-3MB before Cloudinary upload)
  }
});

// Product Images Upload with Sharp compression (up to 5)
const productStorage = new CompressedCloudinaryStorage({
  folder: 'farmchops/products',
  allowed_formats: ['jpg', 'jpeg', 'png'],
  compression: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 85
  }
}) as any;

export const uploadProductImages = multer({
  storage: productStorage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB (Sharp will compress to ~3-5MB before Cloudinary upload)
  }
});

// Vendor ID document upload (images or pdf)
const vendorDocStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'farmchops/vendor-docs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    transformation: []
  } as any
});

export const uploadVendorDoc = multer({
  storage: vendorDocStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// PayLater Application Documents (NIN card, passport photo)
// Using standard CloudinaryStorage for compatibility (ID verification requires high quality anyway)
const paylaterStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'farmchops/paylater-applications',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 90 }]
  } as any
});

export const uploadPaylaterImages = multer({
  storage: paylaterStorage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB per file
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

/**
 * Convert Cloudinary URL to base64 for Prembly API
 * Downloads the image from Cloudinary and converts it to base64
 */
export async function convertCloudinaryUrlToBase64(url: string): Promise<string> {
  try {
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to convert image to base64');
  }
}