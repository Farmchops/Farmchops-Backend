import { Router } from 'express';
import { searchAddresses } from '../controllers/addressController';

const router = Router();

// GET /api/addresses/search - Search for addresses
router.get('/search', searchAddresses);

export default router;
