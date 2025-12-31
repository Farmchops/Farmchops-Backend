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