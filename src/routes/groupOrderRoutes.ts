import { Router } from 'express';
import {
  getActiveGroups,
  joinGroup,
  leaveGroup,
  getMyGroups,
  getGroupDetails,
  groupOrderPaystackWebhook,
  verifyGroupOrderPayment
} from '../controllers/groupOrderController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Webhook route (NO authentication - Paystack calls this)
router.post('/webhook/paystack', groupOrderPaystackWebhook);

// Public routes
router.get('/active', getActiveGroups);
router.get('/:groupId', getGroupDetails);

// Protected routes (require authentication)
router.post('/:groupId/join', authenticateToken, joinGroup);
router.post('/:groupId/leave', authenticateToken, leaveGroup);
router.get('/user/my-groups', authenticateToken, getMyGroups);
router.get('/verify-payment/:reference', authenticateToken, verifyGroupOrderPayment);

export default router;
