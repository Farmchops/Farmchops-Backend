import { Router } from 'express';
import {
	getOrders,
	getOrderById,
	markOrderProcessing,
	markOrderReadyForDispatch,
	assignOrderRider,
	confirmOrderPickup,
	failOrderDelivery,
	returnOrderToDispatch,
	cancelOrder,
	closeOrder,
	getOrderAvailableActions,
	getOrderWorkflowConfiguration,
	listRiders
} from '../controllers/adminOrderController';
import { authenticateToken, requireAdmin, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../utils/permissions';

const router = Router();

// Apply authentication and admin authorization to all routes
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/riders', requirePermission(PERMISSIONS.ORDERS_DISPATCH_ASSIGN), listRiders);
router.get('/orders/workflow/config', requirePermission(PERMISSIONS.ORDERS_WORKFLOW_VIEW), getOrderWorkflowConfiguration);
router.get('/orders', getOrders);
router.get('/orders/:id/actions', requirePermission(PERMISSIONS.ORDERS_WORKFLOW_VIEW), getOrderAvailableActions);
router.get('/orders/:id', getOrderById);

router.patch('/orders/:id/actions/mark-processing', requirePermission(PERMISSIONS.ORDERS_PROCESSING_START), markOrderProcessing);
router.patch('/orders/:id/actions/mark-ready-for-dispatch', requirePermission(PERMISSIONS.ORDERS_PROCESSING_COMPLETE), markOrderReadyForDispatch);
router.patch('/orders/:id/actions/assign-rider', requirePermission(PERMISSIONS.ORDERS_DISPATCH_ASSIGN), assignOrderRider);
router.patch('/orders/:id/actions/confirm-pickup', requirePermission(PERMISSIONS.ORDERS_DISPATCH_HANDOVER), confirmOrderPickup);
router.patch('/orders/:id/actions/fail-delivery', requirePermission(PERMISSIONS.ORDERS_DISPATCH_FAIL), failOrderDelivery);
router.patch('/orders/:id/actions/return-to-dispatch', requirePermission(PERMISSIONS.ORDERS_DISPATCH_RETURN), returnOrderToDispatch);
router.patch('/orders/:id/actions/cancel', requirePermission(PERMISSIONS.ORDERS_OVERRIDE_CANCEL), cancelOrder);
router.patch('/orders/:id/actions/close', requirePermission(PERMISSIONS.ORDERS_DELIVERY_CLOSE), closeOrder);

export default router;
