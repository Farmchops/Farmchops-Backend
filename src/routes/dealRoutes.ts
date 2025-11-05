import { Router } from 'express';
import { getActiveDeal, getUpcomingDeals } from '../controllers/dealController';

const router = Router();

router.get('/active', getActiveDeal);
router.get('/upcoming', getUpcomingDeals);

export default router;
