import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import generateToken from "../utils/generateToken";
import User from '../models/User';
import { IUser } from '../models/User';
import Marketer from '../models/Marketer';
import { AuthResponse, ResetCodeResponse, ProfileResponse } from '../types/auth.types';
import emailService from "../services/emailService";

/**
 * Helper function to check if user profile is complete
 */
export const checkProfileComplete = (user: IUser): boolean => {
  return !!(user.firstName && user.lastName && user.phone && user.profile?.address);
};


export const login = async (
  req: Request,
  res: Response<AuthResponse>
): Promise<Response<AuthResponse>> => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Check if active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact support."
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Generate token
    const token = generateToken(String(user._id), user.role);

    // Remove password from response
    const { password: _, ...userResponse } = user.toObject();

    return res.json({
      success: true,
      message: "Login successful",
      data: { user: userResponse as any, token }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Server error during login" });
  }
};

/**
 * @desc Get current user profile
 * @route GET /api/auth/profile
 * @access Private
 */
export const getProfile = async (
  req: Request,
  res: Response<ProfileResponse>
): Promise<Response<ProfileResponse>> => {
  try {
    const user = (req as any).user;
    return res.json({
      success: true,
      message: "Profile retrieved successfully",
      data: { 
        user,
        profileComplete: checkProfileComplete(user)
      } as any
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile"
    });
  }
};

/**
 * @desc Update user profile
 * @route PUT /api/auth/profile
 * @access Private
 */
export const updateProfile = async (
  req: Request,
  res: Response<ProfileResponse>
): Promise<Response<ProfileResponse>> => {
  try {
    const user = (req as any).user;
    const { firstName, lastName, phone, address } = req.body;

    // Ensure phone number unique
    if (phone && phone !== user.phone) {
      const existingUser = await User.findOne({ phone, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number is already registered to another account"
        });
      }
    }

    // Update
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
   
    if (address !== undefined) {
      updateData.profile = {
        ...user.profile,
        address: address
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: { 
        user: updatedUser as any,
        profileComplete: checkProfileComplete(updatedUser as IUser)
      } as any
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating profile"
    });
  }
}

/**
 * @desc Request password reset
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = async (
  req: Request,
  res: Response<ResetCodeResponse>
): Promise<Response<ResetCodeResponse>> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent."
      });
    }

    // Generate reset token (6-digit code)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: resetCode,
      passwordResetExpires: resetExpires
    });

    // TODO: Send via email/SMS
    const emailSent = await emailService.sendPasswordResetEmail(email, resetCode)
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again"
      })
    }
    return res.json({
      success: true,
      message: "Password reset code sent successfully.",
      data: process.env.NODE_ENV === "development" ? { resetCode } : undefined
    }as ResetCodeResponse)
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error processing password reset request"
    });
  }
};

/**
 * @desc Reset password
 * @route POST /api/auth/reset-password
 * @access Public
 */
export const resetPassword = async (
  req: Request,
  res: Response<AuthResponse>
): Promise<Response<AuthResponse>> => {
  try {
    const { email, resetCode, newPassword } = req.body;

    const user = await User.findOne({
      email,
      passwordResetToken: resetCode,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset code" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined
    });

    return res.json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error resetting password"
    });
  }
};

/**
 * @desc Logout user (client-side token removal)
 * @route POST /api/auth/logout
 * @access Private
 */
export const logout = async (
  req: Request,
  res: Response<AuthResponse>
): Promise<Response<AuthResponse>> => {
  return res.json({ 
    success: true, 
    message: "Logged out successfully" 
  });
}  

/**
 * @desc Validate referral code (public endpoint)
 * @route POST /api/auth/validate-referral-code
 * @access Public
 */
export const validateReferralCode = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required"
      });
    }

    // Find marketer with matching code (case-insensitive)
    const marketer = await Marketer.findOne({
      marketingCode: referralCode.toUpperCase(),
      status: 'active'
    });

    if (!marketer) {
      return res.json({
        success: true,
        data: {
          isValid: false,
          message: "Invalid or inactive referral code"
        }
      });
    }

    return res.json({
      success: true,
      message: "Valid referral code",
      data: {
        isValid: true,
        marketerName: `${marketer.firstName} ${marketer.lastName}`
      }
    });
  } catch (error) {
    console.error("Validate referral code error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error validating referral code"
    });
  }
};

/**
 * @desc Send verification email with code
 * @route POST /api/auth/send-verification-email
 * @access Public
 */
export const sendVerificationEmail = async (
  req: Request,
  res: Response<ResetCodeResponse>
): Promise<Response<ResetCodeResponse>> => {
  try {
    const { email, referralCode } = req.body;

    // Check if user already exists and is verified
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.profile.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already exists. Please sign in instead."
      });
    }

    // Validate referral code if provided
    let marketerId: mongoose.Types.ObjectId | null = null;
    if (referralCode) {
      const marketer = await Marketer.findOne({
        marketingCode: referralCode.toUpperCase(),
        status: 'active'
      });

      if (marketer) {
        marketerId = marketer._id as mongoose.Types.ObjectId;
      }
      // If invalid code, just ignore it (don't block signup)
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    if (existingUser && !existingUser.profile.isVerified) {
      // Update existing unverified user
      const updateData: any = {
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires
      };

      if (marketerId) {
        updateData.referredBy = marketerId;
        updateData.referralCode = referralCode.toUpperCase();
        updateData.referralDate = new Date();
      }

      await User.findByIdAndUpdate(existingUser._id, updateData);
    } else {
      // Create temporary user record for verification
      const tempUserData: any = {
        email,
        emailVerificationCode: verificationCode,
        emailVerificationExpires: verificationExpires,
        profile: { isVerified: false },
        isActive: false // Inactive until verified
      };

      if (marketerId) {
        tempUserData.referredBy = marketerId;
        tempUserData.referralCode = referralCode.toUpperCase();
        tempUserData.referralDate = new Date();
      }

      const tempUser = new User(tempUserData);
      await tempUser.save();
    }

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email"
      })
    }

    return res.json({
      success: true,
      message: "Verification code sent to your email",
      data: process.env.NODE_ENV === "development" ? { verificationCode } : undefined
    } as ResetCodeResponse);
  } catch (error) {
    const err = error as any;
    console.error("Send verification email error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Error sending verification email"
    });
  }
};

/**
 * @desc Verify email and complete registration
 * @route POST /api/auth/verify-email
 * @access Public
 */
export const verifyEmailAndRegister = async (
  req: Request,
  res: Response<AuthResponse>
): Promise<Response<AuthResponse>> => {
  try {
    const { email, verificationCode, password } = req.body;

    // Find user with valid verification code
    const user = await User.findOne({
      email,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code"
      });
    }

    if (user.profile.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already exists. Please sign in instead."
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user with password and verify
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        password: hashedPassword,
        role: "customer",
        wallet: { balance: 0 },
        isActive: true,
        'profile.isVerified': true,
        emailVerificationCode: undefined,
        emailVerificationExpires: undefined
      },
      { new: true }
    ).select("-password");

    // If user was referred, increment marketer's signup count
    if (updatedUser?.referredBy) {
      await Marketer.findByIdAndUpdate(updatedUser.referredBy, {
        $inc: { totalSignups: 1 }
      });
    }

    // Generate token
    const token = generateToken(String(updatedUser!._id), updatedUser!.role);

    return res.status(201).json({
      success: true,
      message: "Email verified and account created successfully",
      data: { user: updatedUser as any, token }
    });
  } catch (error) {
    const err = error as any;
    console.error("Email verification error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Error verifying email"
    });
  }
};

/**
 * @desc Resend verification email
 * @route POST /api/auth/resend-verification
 * @access Public
 */
export const resendVerificationEmail = async (
  req: Request,
  res: Response<ResetCodeResponse>
): Promise<Response<ResetCodeResponse>> => {
  try {
    const { email } = req.body;

    // Find unverified user
    const user = await User.findOne({ 
      email, 
      'profile.isVerified': false 
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No pending verification found for this email"
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await User.findByIdAndUpdate(user._id, {
      emailVerificationCode: verificationCode,
      emailVerificationExpires: verificationExpires
    });

    // TODO: Send verification email
    console.log(`New verification code for ${email}: ${verificationCode}`);

    return res.json({
      success: true,
      message: "New verification code sent to your email",
      data: process.env.NODE_ENV === "development" ? { verificationCode } : undefined
    } as ResetCodeResponse);
  } catch (error) {
    const err = error as any;
    console.error("Resend verification error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Error resending verification code"
    });
  }
};