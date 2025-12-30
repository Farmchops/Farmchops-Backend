import { Router } from 'express';
import { getAllUsers } from '../controllers/userController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// GET /api/admin/users - Get all users with purchase stats
router.get(
  '/',
  authenticateToken,
  requirePermission('view_users'),
  getAllUsers
);

export default router;
