import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

// Category Image Upload
const categoryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'farmchops/categories',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  } as any
});

export const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  }
});

// Product Images Upload (up to 5)
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'farmchops/products',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  } as any
});

export const uploadProductImages = multer({
  storage: productStorage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB per file
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
const paylaterStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'farmchops/paylater-applications',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto' }]
  } as any
});

export const uploadPaylaterImages = multer({
  storage: paylaterStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB per file
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