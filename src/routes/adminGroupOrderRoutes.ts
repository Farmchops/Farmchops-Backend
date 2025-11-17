import { Router } from 'express';
import {
  configureGroupBuying,
  getAllGroups,
  getGroupDetailsAdmin,
  cancelGroup,
  createGroup
} from '../controllers/adminGroupOrderController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Product group configuration
router.post('/products/:productId/group-config', configureGroupBuying);
router.post('/products/:productId/create-group', createGroup);

// Group management
router.post('/group-orders', createGroup); // Create group with productId in body
router.get('/group-orders', getAllGroups);
router.get('/group-orders/:groupId', getGroupDetailsAdmin);
router.post('/group-orders/:groupId/cancel', cancelGroup);

export default router;
