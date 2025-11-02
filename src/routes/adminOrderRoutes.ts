import { Router } from 'express';
import { getOrders, 
    getOrderById, 
    updateOrderStatus, 
    getDashboardSummary, 
    getOrderTrend, 
    getUsersTrend, 
    getRecentOrders } from '../controllers/adminOrderController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();


router.use(authenticateToken);
router.use(requireAdmin);

router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

//dashboard routes
router.get('/dashboard/summary', getDashboardSummary);
router.get('/dashboard/order-trend', getOrderTrend);
router.get('/dashboard/users-trend', getUsersTrend);
router.get('/dashboard/recent-orders', getRecentOrders);

export default router;
