import { Router } from 'express';
import {
  getActiveGroups,
  reserveSlot,
  initiateCheckout,
  joinWaitlist,
  leaveGroup,
  getMyGroups,
  getGroupDetails,
  getGroupByShareableCode,
  groupOrderPaystackWebhook,
  verifyGroupOrderPayment
} from '../controllers/groupOrderController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Webhook route (NO authentication - Paystack calls this)
router.post('/webhook/paystack', groupOrderPaystackWebhook);

// Public routes
router.get('/active', getActiveGroups);
router.get('/share/:shareableCode', getGroupByShareableCode);
router.get('/:groupId', getGroupDetails);

// Protected routes (require authentication)
router.post('/:groupId/reserve', authenticateToken, reserveSlot);
router.post('/:groupId/checkout', authenticateToken, initiateCheckout);
router.post('/:groupId/waitlist', authenticateToken, joinWaitlist);
router.post('/:groupId/leave', authenticateToken, leaveGroup);
router.get('/user/my-groups', authenticateToken, getMyGroups);
router.get('/verify-payment/:reference', authenticateToken, verifyGroupOrderPayment);

export default router;
