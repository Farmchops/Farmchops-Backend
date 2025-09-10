import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import generateToken from "../utils/generateToken";
import { IUser } from '../models/User';
import { AuthResponse, ResetCodeResponse, ProfileResponse } from '../types/auth.types';

/**
 * @desc Register new user
 * @route POST /api/auth/register
 * @access Public
 */
export const register = async (
  req: Request,
  res: Response<AuthResponse>
): Promise<Response<AuthResponse>> => {
  try {
    const { email, password, fullName, phone } = req.body;
    const User = mongoose.model("User");

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email
          ? "User with this email already exists"
          : "User with this phone number already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      fullName,
      phone,
      role: "customer",
      wallet: { balance: 0 },
      isActive: true,
      isVerified: false
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id.toString(), user.role);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { user: userResponse, token }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error during registration" 
    });
  }
};

/**
 * @desc Login user
 * @route POST /api/auth/login
 * @access Public
 */
export const login = async (
  req: Request,
  res: Response<AuthResponse>
): Promise<Response<AuthResponse>> => {
  try {
    const { email, password } = req.body;
    const User = mongoose.model("User");

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
    const token = generateToken(user._id.toString(), user.role);

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({
      success: true,
      message: "Login successful",
      data: { user: userResponse, token }
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
      data: { user }
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
    const { fullName, phone, address } = req.body;
    const User = mongoose.model("User");

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
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating profile"
    });
  }
};

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
    const User = mongoose.model("User");

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
    console.log(`Password reset code for ${email}: ${resetCode}`);

    return res.json({
      success: true,
      message: "If an account with that email exists, a password reset code has been sent.",
      data: process.env.NODE_ENV === "development" ? { resetCode } : undefined
    } as ResetCodeResponse);
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
    const User = mongoose.model("User");

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
};
