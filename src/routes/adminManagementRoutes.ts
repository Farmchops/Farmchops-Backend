// src/routes/admin/adminManagementRoutes.ts

import { Router } from 'express';
import {
  listAdmins,
  getAdminById,
  updateAdminRole,
  toggleAdminStatus,
  deleteAdmin,
  updateAdminPermissions
} from '../controllers/adminManagementController';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// All routes require super admin authentication
router.use(authenticateToken, requireSuperAdmin);

// List all admins with filters
router.get('/list', listAdmins);

// Get single admin by ID
router.get('/:id', getAdminById);

// Update admin role and permissions
router.put('/:id/role', updateAdminRole);

// Toggle admin active/inactive status
router.put('/:id/status', toggleAdminStatus);

router.put('/:id/permissions', updateAdminPermissions);

// Delete admin (use with caution)
router.delete('/:id', deleteAdmin);

export default router;