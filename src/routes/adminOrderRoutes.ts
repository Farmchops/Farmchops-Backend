import { Router } from 'express';
import { getOrders } from '../controllers/adminOrderController';
// Add authentication/authorization middleware as needed

const router = Router();

router.get('/orders', getOrders);

export default router;
