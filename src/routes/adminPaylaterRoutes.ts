import { Router } from 'express';
import {
  getApplications,
  getApplicationById,
  reviewApplication,
  getUsers,
  getUserById,
  updateCreditLimit,
  markAsRepaid,
  getAllOrders,
  getSettings,
  updateSettings,
  updateOrderStatus
} from '../controllers/adminPaylaterController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All admin PayLater routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Applications
// GET /api/admin/paylater/applications - Get all applications with filtering
router.get('/applications', getApplications);

// GET /api/admin/paylater/applications/:id - Get single application details
router.get('/applications/:id', getApplicationById);

// POST /api/admin/paylater/applications/:id/review - Approve or reject application
router.post('/applications/:id/review', reviewApplication);

// Users/Accounts
// GET /api/admin/paylater/users - Get all PayLater users with filtering
router.get('/users', getUsers);

// GET /api/admin/paylater/users/:id - Get single user's PayLater details
router.get('/users/:id', getUserById);

// PATCH /api/admin/paylater/users/:id/credit-limit - Update user's credit limit
router.patch('/users/:id/credit-limit', updateCreditLimit);

// Repayments
// POST /api/admin/paylater/orders/:id/repaid - Mark order as repaid
router.post('/orders/:id/repaid', markAsRepaid);

// Orders
// GET /api/admin/paylater/orders - Get all PayLater orders
router.get('/orders', getAllOrders);

// PATCH /api/admin/paylater/orders/:id/status - Update order status
router.patch('/orders/:id/status', updateOrderStatus);

// Settings
// GET /api/admin/paylater/settings - Get PayLater settings
router.get('/settings', getSettings);

// PUT /api/admin/paylater/settings - Update PayLater settings
router.put('/settings', updateSettings);

export default router;
