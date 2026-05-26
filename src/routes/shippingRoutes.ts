import { Router } from 'express';
import { shippingRates } from '../controllers/shippingController';

const router = Router();

// GET /api/shipping/rates?country=GB  — returns rates for a specific country
// GET /api/shipping/rates             — returns flat rates for all regions
router.get('/rates', shippingRates);

export default router;
