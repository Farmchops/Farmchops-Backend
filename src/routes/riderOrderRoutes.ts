import { Router } from 'express';
import { confirmDelivery, getAssignedOrders } from '../controllers/riderOrderController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../utils/permissions';

const router = Router();

router.use(authenticateToken);

router.get('/orders', requirePermission(PERMISSIONS.ORDERS_WORKFLOW_VIEW), getAssignedOrders);
router.get('/orders/assigned', requirePermission(PERMISSIONS.ORDERS_WORKFLOW_VIEW), getAssignedOrders);
router.patch('/orders/:id/confirm-delivery', requirePermission(PERMISSIONS.ORDERS_DELIVERY_CONFIRM), confirmDelivery);
router.post('/orders/:id/confirm-delivery', requirePermission(PERMISSIONS.ORDERS_DELIVERY_CONFIRM), confirmDelivery);

export default router;
