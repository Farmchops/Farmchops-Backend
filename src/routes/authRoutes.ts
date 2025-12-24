// src/routes/authRoutes.ts
import { Router } from 'express';
import {
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  sendVerificationEmail,
  verifyEmailAndRegister,
  resendVerificationEmail,
  validateReferralCode
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/validate-referral-code - Validate referral code (public)
router.post('/validate-referral-code', validateReferralCode);

// POST /api/auth/login - User login (JWT)
router.post('/login', login);

// POST /api/auth/logout - Token invalidation
router.post('/logout', authenticateToken, logout);

// POST /api/auth/forgot-password - Password reset
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password - Complete password reset
router.post('/reset-password', resetPassword);

// GET /api/auth/profile - Get user profile
router.get('/profile', authenticateToken, getProfile);

// PUT /api/auth/profile - Update user profile
router.put('/profile', authenticateToken, updateProfile);

// POST /api/auth/signup
router.post('/signup', sendVerificationEmail);

// POST /api/auth/signup/complete
router.post('/signup/complete', verifyEmailAndRegister);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendVerificationEmail);

export default router;