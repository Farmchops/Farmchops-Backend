// src/routes/productRoutes.ts
import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getInventoryTracking,
  updateProductStock,
  addProductImages,
  removeProductImage
} from '../controllers/productController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { uploadProductImages } from '../middleware/uploadMiddleware';
import { configureGroupBuying } from '../controllers/adminGroupOrderController';

const router = Router();

// Public routes 
// GET /api/products - List products with filters
router.get('/', getProducts);

// GET /api/products/search - Search products
router.get('/search', searchProducts);

// GET /api/products/admin - List all products for admin (includes all statuses)
router.get('/admin', authenticateToken, requireAdmin, getProducts);

// GET /api/products/admin/stats - Get product statistics (admin only)
router.get('/admin/stats', authenticateToken, requireAdmin, getProductStats);

// GET /api/products/admin/inventory - Get inventory tracking (admin only)
router.get('/admin/inventory', authenticateToken, requireAdmin, getInventoryTracking);

// PATCH /api/products/admin/:id/stock - Update product stock (admin only)
router.patch('/admin/:id/stock', authenticateToken, requireAdmin, updateProductStock);

// POST /api/products/:productId/group-config - Configure group buying (admin only)
router.post('/:productId/group-config', authenticateToken, requireAdmin, configureGroupBuying);

// GET /api/products/:slug - Get single product
router.get('/:slug', getProductBySlug);

// Admin routes
// POST /api/products - Create product (admin only)
router.post('/admin/products', authenticateToken, requireAdmin, uploadProductImages.array('images', 5), createProduct);

router.put('/admin/products/:id', authenticateToken, requireAdmin, uploadProductImages.array('images', 5), updateProduct);

// POST /api/products/admin/products/:id/images - Add images to a product (admin only)
router.post('/admin/products/:id/images', authenticateToken, requireAdmin, uploadProductImages.array('images', 5), addProductImages);

// DELETE /api/products/admin/products/:id/images - Remove a specific image (admin only)
router.delete('/admin/products/:id/images', authenticateToken, requireAdmin, removeProductImage);

// DELETE /api/products/:id - Delete product (admin only)
router.delete('/:id', authenticateToken, requireAdmin, deleteProduct);



export default router;