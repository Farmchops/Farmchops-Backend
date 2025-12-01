// src/middleware/auth.ts - UPDATED WITH PERMISSION CHECKS

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { hasPermission as checkPermission } from '../utils/permissions';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: IUser;
}

// Verify JWT token and attach user to request
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];

  try {
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check if admin account is active
    if (user.role === 'admin' && !user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Admin account is deactivated'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    console.error('[AUTH] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      token: (authHeader?.substring(0, 20) || 'none') + '...' // Log first 20 chars only
    });

    // Check if it's a token expiration error
    const isTokenExpired = error instanceof Error && error.name === 'TokenExpiredError';

    res.status(401).json({
      success: false,
      message: isTokenExpired ? 'Your session has expired. Please log in again.' : 'Invalid token',
      code: isTokenExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
};

// Optional authentication - attaches user if token is present, but doesn't require it
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // No token? That's okay, continue without user
    if (!token) {
      next();
      return;
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (user) {
      // Check if admin account is active
      if (user.role === 'admin' && !user.isActive) {
        // Invalid admin, continue as anonymous
        next();
        return;
      }
      req.user = user;
    }

    next();
  } catch (error) {
    // Invalid token? Continue as anonymous user
    next();
  }
};

// Check if user is admin (any admin role)
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }

  next();
};

// Check if user is super admin
export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin' || req.user.adminRole !== 'super_admin') {
    res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
    return;
  }

  next();
};

// Check if user has specific permission
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    // Check if user has the required permission
    const userPermissions = req.user.permissions || [];
    if (!checkPermission(userPermissions, permission)) {
      res.status(403).json({
        success: false,
        message: `Permission denied: ${permission} required`
      });
      return;
    }

    next();
  };
};

// Check if user has any of the specified permissions
export const requireAnyPermission = (permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAnyPermission = permissions.some(permission => 
      checkPermission(userPermissions, permission)
    );

    if (!hasAnyPermission) {
      res.status(403).json({
        success: false,
        message: `Permission denied: One of [${permissions.join(', ')}] required`
      });
      return;
    }

    next();
  };
};