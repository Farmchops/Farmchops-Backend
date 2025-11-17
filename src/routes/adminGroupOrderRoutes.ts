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

// Explicitly handle OPTIONS for all routes (CORS preflight)
router.options('*', (req, res) => {
  res.status(204).send();
});

// All routes require admin authentication (except OPTIONS for CORS preflight)
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return authenticateToken(req, res, next);
});
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return requireAdmin(req, res, next);
});

// Product group configuration
router.post('/products/:productId/group-config', configureGroupBuying);
router.post('/products/:productId/create-group', createGroup);

// Group management
router.post('/group-orders', createGroup); // Create group with productId in body
router.get('/group-orders', getAllGroups);
router.get('/group-orders/:groupId', getGroupDetailsAdmin);
router.post('/group-orders/:groupId/cancel', cancelGroup);

export default router;
