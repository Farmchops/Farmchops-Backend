import { Router } from 'express';
import { validateToken, submitReview, listReviews, getReview, deleteReview } from '../controllers/reviewController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public — used by buyers clicking the review link
router.get('/validate/:token', validateToken);
router.post('/submit', submitReview);

// Admin — protected
router.get('/', authenticateToken, requireAdmin, listReviews);
router.get('/:id', authenticateToken, requireAdmin, getReview);
router.delete('/:id', authenticateToken, requireAdmin, deleteReview);

export default router;
