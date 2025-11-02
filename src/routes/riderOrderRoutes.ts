import { Router } from 'express';
import multer from 'multer';
import { confirmDelivery, getAssignedOrders } from '../controllers/riderOrderController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../utils/permissions';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticateToken);

router.get('/orders', requirePermission(PERMISSIONS.ORDERS_WORKFLOW_VIEW), getAssignedOrders);
router.get('/orders/assigned', requirePermission(PERMISSIONS.ORDERS_WORKFLOW_VIEW), getAssignedOrders);
router.patch('/orders/:id/confirm-delivery', requirePermission(PERMISSIONS.ORDERS_DELIVERY_CONFIRM), upload.single('proof'), confirmDelivery);
router.post('/orders/:id/confirm-delivery', requirePermission(PERMISSIONS.ORDERS_DELIVERY_CONFIRM), upload.single('proof'), confirmDelivery);

export default router;
