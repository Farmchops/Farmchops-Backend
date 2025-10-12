import { Router } from 'express';
import { autocomplete, placeDetails } from '../controllers/placesController';

const router = Router();

router.get('/autocomplete', autocomplete);
router.get('/details', placeDetails);

export default router;
