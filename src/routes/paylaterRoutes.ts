import { Router } from 'express';
import {
  submitApplication,
  getStatus,
  getProducts,
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  checkout,
  getOrders,
  getOrderById
} from '../controllers/paylaterController';
import { authenticateToken } from '../middleware/auth';
import { uploadPaylaterImages } from '../middleware/uploadMiddleware';

const router = Router();

// All PayLater routes require authentication
router.use(authenticateToken);

// Application
// POST /api/paylater/apply - Submit PayLater application with document uploads
router.post('/apply', uploadPaylaterImages.fields([
  { name: 'ninCardImage', maxCount: 1 },
  { name: 'passportPhoto', maxCount: 1 }
]), submitApplication);

// GET /api/paylater/status - Get user's PayLater status
router.get('/status', getStatus);

// Products
// GET /api/paylater/products - Get products with PayLater pricing
router.get('/products', getProducts);

// Cart
// GET /api/paylater/cart - Get PayLater cart
router.get('/cart', getCart);

// POST /api/paylater/cart/add - Add to PayLater cart
router.post('/cart/add', addToCart);

// PUT /api/paylater/cart/update - Update cart item quantity
router.put('/cart/update', updateCartItem);

// DELETE /api/paylater/cart/remove/:productId - Remove item from cart
router.delete('/cart/remove/:productId', removeFromCart);

// DELETE /api/paylater/cart/clear - Clear entire cart
router.delete('/cart/clear', clearCart);

// Checkout
// POST /api/paylater/checkout - Process checkout
router.post('/checkout', checkout);

// Orders
// GET /api/paylater/orders - Get user's PayLater order history
router.get('/orders', getOrders);

// GET /api/paylater/orders/:id - Get single order details
router.get('/orders/:id', getOrderById);

export default router;
