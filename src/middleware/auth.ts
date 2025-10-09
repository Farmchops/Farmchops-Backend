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
  try {
    const authHeader = req.headers['authorization'];
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
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
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