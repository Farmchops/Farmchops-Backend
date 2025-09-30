import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats
} from '../controllers/categoryController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { uploadCategoryImage } from '../middleware/uploadMiddleware';

const router = Router();

// Public routes
router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);

// Admin routes
router.post(
  '/admin/categories',
  authenticateToken,
  requireAdmin,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Category name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Category name must be between 2 and 50 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description cannot exceed 200 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  createCategory
);

router.put(
  '/admin/categories/:id',
  authenticateToken,
  requireAdmin,
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Category name cannot be empty')
      .isLength({ min: 2, max: 50 })
      .withMessage('Category name must be between 2 and 50 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description cannot exceed 200 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  updateCategory
);

router.post(
  '/admin/categories',
  authenticateToken,
  requireAdmin,
  uploadCategoryImage.single('image'), // Handle single file upload
  createCategory
);

router.put(
  '/admin/categories/:id',
  authenticateToken,
  requireAdmin,
  uploadCategoryImage.single('image'),
  updateCategory
);


router.delete('/admin/categories/:id', authenticateToken, requireAdmin, deleteCategory);
router.get('/admin/categories-stats', authenticateToken, requireAdmin, getCategoryStats);

export default router;
