import { Router } from 'express';
import {
  checkoutSummary,
  createOrder,
  getUserOrders,
  getOrderById,
  getOrderByNumber,
  cancelOrder,
  paystackWebhook,
  verifyPayment,
  verifyAlatPayment
} from '../controllers/orderController';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// Checkout summary (supports both authenticated and anonymous users)
router.post('/checkout', optionalAuth, checkoutSummary);

// Create order (requires authentication)
router.post('/create', authenticateToken, createOrder);

// Get user orders (requires authentication)
router.get('/', authenticateToken, getUserOrders);

// Get order by order number (requires authentication)
router.get('/number/:orderNumber', authenticateToken, getOrderByNumber);

// Get order by ID (requires authentication)
router.get('/:id', authenticateToken, getOrderById);

// Cancel order (requires admin authentication)
router.post('/:id/cancel', authenticateToken, requireAdmin, cancelOrder);

// Paystack webhook (no auth - verified by signature)
router.post('/paystack/webhook', paystackWebhook);

// ALATPay payment verification (requires authentication)
router.post('/alat/verify', authenticateToken, verifyAlatPayment);

// Verify payment manually (requires authentication)
router.get('/paystack/verify/:reference', authenticateToken, verifyPayment);

export default router;
