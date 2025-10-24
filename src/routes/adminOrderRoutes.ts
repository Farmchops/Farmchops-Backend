import { Router } from 'express';
import { getOrders, getOrderById, updateOrderStatus } from '../controllers/adminOrderController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Apply authentication and admin authorization to all routes
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

export default router;
