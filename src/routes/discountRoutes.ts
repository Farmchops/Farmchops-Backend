import { Router } from 'express';
import { validateCouponForUser } from '../controllers/couponController';
import { calculateDiscounts } from '../controllers/discountController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/coupons/validate - Validate coupon for user
router.post('/validate', authenticateToken, validateCouponForUser);

// POST /api/orders/calculate-discounts - Calculate all available discounts
router.post('/calculate-discounts', authenticateToken, calculateDiscounts);

// Alias for frontend compatibility (singular version)
router.post('/calculate-discount', authenticateToken, calculateDiscounts);

export default router;
