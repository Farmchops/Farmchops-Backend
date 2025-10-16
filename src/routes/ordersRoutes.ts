import { Router } from 'express';
import { checkoutSummary } from '../controllers/orderController';

const router = Router();

// POST /api/orders/checkout - returns checkout summary with delivery fee
router.post('/checkout', checkoutSummary);

export default router;
