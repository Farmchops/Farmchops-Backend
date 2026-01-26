// src/routes/admin/adminAuthRoutes.ts

import { Router } from 'express';
import {
  sendAdminInvite,
  adminSignup,
  adminLogin,
  adminForgotPassword,
  adminResetPassword
} from '../controllers/adminAuthController'
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// Handle OPTIONS preflight for all routes
router.options('*', (_req, res) => res.status(204).send());

// Super admin invites new admin (protected - super admin only)
router.post(
  '/send-invite',
  authenticateToken,
  requireSuperAdmin,
  sendAdminInvite
);

// Admin completes signup with OTP (public - but requires OTP)
router.post('/signup', adminSignup);

// Admin login (public)
router.post('/login', adminLogin);

// Admin forgot password (public)
router.post('/forgot-password', adminForgotPassword);

// Admin reset password with code (public)
router.post('/reset-password', adminResetPassword);

export default router;