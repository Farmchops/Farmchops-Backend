import { Router } from 'express';
import { authenticateToken, requireAdmin, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../utils/permissions';
import {
  createDeal,
  updateDeal,
  cancelDeal,
  listDeals,
  getDeal,
  getDealStats,
  updateDealStatus,
  activateDeal
} from '../controllers/adminDealController';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);
router.use(requirePermission(PERMISSIONS.PROMO_DEALS_MANAGE));

router.get('/', listDeals);
router.post('/', createDeal);
router.get('/:id', getDeal);
router.put('/:id', updateDeal);
router.patch('/:id', updateDeal);
router.patch('/:id/status', updateDealStatus);
router.post('/:id/activate', activateDeal);
router.post('/:id/cancel', cancelDeal);
router.get('/:id/stats', getDealStats);

export default router;
