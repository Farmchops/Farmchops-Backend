import { Router } from 'express';
import {
  createPaymentLink,
  getPaymentLinkByCode,
  payPaymentLink,
  verifyPaymentLinkPayment,
  getMyPaymentLinks,
  cancelPaymentLink,
  regeneratePaymentLink
} from '../controllers/paymentLinkController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
// GET /api/payment-links/:code - Get payment link details
router.get('/:code', getPaymentLinkByCode);

// POST /api/payment-links/:code/pay - Initialize payment
router.post('/:code/pay', payPaymentLink);

// GET /api/payment-links/:code/verify - Verify payment
router.get('/:code/verify', verifyPaymentLinkPayment);

// Protected routes (authentication required)
// POST /api/payment-links/create - Create a new payment link
router.post('/create', authenticateToken, createPaymentLink);

// GET /api/payment-links/my-links - Get user's payment links
router.get('/user/my-links', authenticateToken, getMyPaymentLinks);

// PATCH /api/payment-links/:code/cancel - Cancel a payment link
router.patch('/:code/cancel', authenticateToken, cancelPaymentLink);

// POST /api/payment-links/:code/regenerate - Regenerate a payment link with new code
router.post('/:code/regenerate', authenticateToken, regeneratePaymentLink);

export default router;
