// src/routes/productRoutes.ts
import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats
} from '../controllers/productController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { uploadProductImages } from '../middleware/uploadMiddleware';

const router = Router();

// Public routes 
// GET /api/products - List products with filters
router.get('/', getProducts);

// GET /api/products/search - Search products
router.get('/search', searchProducts);

// GET /api/products/admin/stats - Get product statistics (admin only)
router.get('/admin/stats', authenticateToken, requireAdmin, getProductStats);

// GET /api/products/:slug - Get single product
router.get('/:slug', getProductBySlug);

// Admin routes
// POST /api/products - Create product (admin only)
router.post('/admin/products', authenticateToken, requireAdmin, uploadProductImages.array('images', 5), createProduct);

router.put('/admin/products/:id',authenticateToken, requireAdmin, uploadProductImages.array('images', 5), updateProduct);


// DELETE /api/products/:id - Delete product (admin only)
router.delete('/:id', authenticateToken, requireAdmin, deleteProduct);



export default router;