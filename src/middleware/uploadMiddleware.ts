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
    fileSize: 2 * 1024 * 1024 // 2MB
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
    fileSize: 2 * 1024 * 1024 // 2MB per file
  }
});