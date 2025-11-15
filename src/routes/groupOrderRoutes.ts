import { Router } from 'express';
import {
  getActiveGroups,
  joinGroup,
  leaveGroup,
  getMyGroups,
  getGroupDetails
} from '../controllers/groupOrderController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/active', getActiveGroups);
router.get('/:groupId', getGroupDetails);

// Protected routes (require authentication)
router.post('/:groupId/join', authenticateToken, joinGroup);
router.post('/:groupId/leave', authenticateToken, leaveGroup);
router.get('/user/my-groups', authenticateToken, getMyGroups);

export default router;
