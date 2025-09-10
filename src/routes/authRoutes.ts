// src/routes/authRoutes.ts
import { Router } from 'express';
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - User registration
router.post('/register', register);

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

export default router;