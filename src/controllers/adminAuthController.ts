// src/controllers/admin/adminAuthController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import emailService from '../services/emailService';
import { AuthRequest } from '../middleware/auth';
import { getPermissionsForRole } from '../utils/permissions';

// Super Admin sends invite to create new admin
export const sendAdminInvite = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, adminRole } = req.body;

    // Validate required fields
    if (!email || !adminRole) {
      res.status(400).json({
        success: false,
        message: 'Email and admin role are required'
      });
      return;
    }

    // Validate admin role
    const validRoles = ['inventory_officer', 'operations_officer', 'logistics', 
                       'customer_support', 'finance', 'admin'];
    if (!validRoles.includes(adminRole)) {
      res.status(400).json({
        success: false,
        message: 'Invalid admin role'
      });
      return;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
      return;
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create pending admin user (not yet active)
    const pendingAdmin = await User.create({
      email: email.toLowerCase(),
      role: 'admin',
      adminRole,
      permissions: getPermissionsForRole(adminRole),
      emailVerificationCode: otp,
      emailVerificationExpires: otpExpires,
      profile: { isVerified: false },
      isActive: false, // Will be activated after signup completion
      invitedBy: req.user?._id
    });

    // Send admin invite email
    const emailSent = await emailService.sendAdminInviteEmail(email, otp, adminRole);
    
    if (!emailSent) {
      // Delete the pending admin if email fails
      await User.findByIdAndDelete(pendingAdmin._id);
      res.status(500).json({
        success: false,
        message: 'Failed to send invitation email'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Admin invitation sent to ${email}`,
      data: {
        email,
        adminRole,
        expiresIn: '15 minutes'
      }
    });
  } catch (error) {
    console.error('Send admin invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send admin invitation'
    });
  }
};

// Admin completes signup with OTP
export const adminSignup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !otp || !password || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        message: 'All fields are required: email, otp, password, firstName, lastName'
      });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
      return;
    }

    // Find pending admin with OTP
    const admin = await User.findOne({
      email: email.toLowerCase(),
      role: 'admin',
      emailVerificationCode: otp,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!admin) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update admin account
    admin.password = hashedPassword;
    admin.firstName = firstName;
    admin.lastName = lastName;
    admin.profile.isVerified = true;
    admin.isActive = true;
    admin.emailVerificationCode = undefined;
    admin.emailVerificationExpires = undefined;
    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully. Please login.',
      data: {
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        adminRole: admin.adminRole
      }
    });
  } catch (error) {
    console.error('Admin signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin signup failed'
    });
  }
};

// Admin login
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Find admin user (explicitly select password field)
    const admin = await User.findOne({
      email: email.toLowerCase(),
      role: 'admin'
    }).select('+password');

    if (!admin || !admin.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Check if admin is active
    if (!admin.isActive) {
      res.status(403).json({
        success: false,
        message: 'Admin account is deactivated. Contact super admin.'
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: admin._id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          adminRole: admin.adminRole,
          permissions: admin.permissions
        }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Admin forgot password
export const adminForgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    const admin = await User.findOne({
      email: email.toLowerCase(),
      role: 'admin'
    });

    if (!admin) {
      // Don't reveal if email exists
      res.status(200).json({
        success: true,
        message: 'If an admin account exists, a reset code has been sent'
      });
      return;
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    admin.passwordResetToken = resetCode;
    admin.passwordResetExpires = resetExpires;
    await admin.save();

    // Send reset email
    const emailSent = await emailService.sendPasswordResetEmail(email, resetCode);
    
    if (!emailSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to send reset email'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email'
    });
  } catch (error) {
    console.error('Admin forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
};

// Admin reset password with code
export const adminResetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Email, reset code, and new password are required'
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
      return;
    }

    const admin = await User.findOne({
      email: email.toLowerCase(),
      role: 'admin',
      passwordResetToken: resetCode,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!admin) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    admin.password = hashedPassword;
    admin.passwordResetToken = undefined;
    admin.passwordResetExpires = undefined;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
};