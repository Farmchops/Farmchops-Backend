import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Coupon from '../models/Coupon';
import { Order } from '../models/Order';
import { validateCoupon, calculateCouponDiscount } from '../services/couponService';

/**
 * @desc Create a new coupon
 * @route POST /api/admin/coupons
 * @access Private (manage_marketing permission)
 */
export const createCoupon = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      maxUsesTotal,
      maxUsesPerUser,
      validFrom,
      validUntil
    } = req.body;

    const adminId = (req as any).user._id;

    // Check if code already exists
    const existingCode = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    // Create coupon
    const coupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      maxUsesTotal,
      maxUsesPerUser: maxUsesPerUser || 1,
      validFrom,
      validUntil,
      createdBy: adminId
    });

    await coupon.save();

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: { coupon }
    });
  } catch (error: any) {
    console.error('Create coupon error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating coupon'
    });
  }
};

/**
 * @desc Get all coupons with pagination
 * @route GET /api/admin/coupons
 * @access Private (manage_marketing permission)
 */
export const getAllCoupons = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page = 1,
      limit = 20,
      status
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};
    if (status) {
      query.status = status;
    }

    // Get total count
    const total = await Coupon.countDocuments(query);

    // Get coupons
    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    return res.json({
      success: true,
      data: {
        coupons,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get all coupons error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving coupons'
    });
  }
};

/**
 * @desc Get single coupon by ID
 * @route GET /api/admin/coupons/:couponId
 * @access Private (manage_marketing permission)
 */
export const getCouponById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    return res.json({
      success: true,
      data: { coupon }
    });
  } catch (error) {
    console.error('Get coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving coupon'
    });
  }
};

/**
 * @desc Update coupon
 * @route PUT /api/admin/coupons/:couponId
 * @access Private (manage_marketing permission)
 */
export const updateCoupon = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponId } = req.params;
    const { description, status, maxUsesTotal, validUntil } = req.body;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Update allowed fields only
    if (description) coupon.description = description;
    if (status) coupon.status = status;
    if (maxUsesTotal !== undefined) coupon.maxUsesTotal = maxUsesTotal;
    if (validUntil) coupon.validUntil = new Date(validUntil);

    await coupon.save();

    return res.json({
      success: true,
      message: 'Coupon updated successfully',
      data: { coupon }
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating coupon'
    });
  }
};

/**
 * @desc Delete coupon (soft delete)
 * @route DELETE /api/admin/coupons/:couponId
 * @access Private (super_admin only)
 */
export const deleteCoupon = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Soft delete - set status to inactive
    coupon.status = 'inactive';
    await coupon.save();

    return res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting coupon'
    });
  }
};

/**
 * @desc Validate coupon for user (Public - authenticated)
 * @route POST /api/coupons/validate
 * @access Private (user must be logged in)
 */
export const validateCouponForUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponCode, orderAmount } = req.body;
    const userId = (req as any).user._id;

    if (!couponCode || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and order amount are required'
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      status: 'active'
    });

    if (!coupon) {
      return res.json({
        success: true,
        data: {
          isValid: false,
          message: 'Coupon not found or inactive'
        }
      });
    }

    // Validate coupon
    const validation = await validateCoupon(coupon, userId, orderAmount);

    if (!validation.isValid) {
      return res.json({
        success: true,
        data: {
          isValid: false,
          message: validation.message
        }
      });
    }

    // Calculate discount
    const discount = calculateCouponDiscount(coupon, orderAmount);
    const finalAmount = orderAmount - discount;

    return res.json({
      success: true,
      message: 'Coupon is valid',
      data: {
        isValid: true,
        coupon: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          maxDiscountAmount: coupon.maxDiscountAmount
        },
        calculatedDiscount: discount,
        finalAmount
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error validating coupon'
    });
  }
};

/**
 * @desc Get coupon usage report
 * @route GET /api/admin/coupons/:couponId/report
 * @access Private (manage_marketing permission)
 */
export const getCouponReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Find all orders that used this coupon
    const orders = await Order.find({
      couponUsed: couponId,
      orderStatus: { $in: ['delivered', 'completed'] }
    }).populate('user', 'firstName lastName email');

    // Calculate metrics
    const totalUses = orders.length;
    const totalDiscount = orders.reduce((sum, order) => sum + (order.totalDiscount || 0), 0);
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const averageDiscount = totalUses > 0 ? Math.floor(totalDiscount / totalUses) : 0;

    // Get recent uses
    const recentUses = orders
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(order => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: (order.user as any)?.firstName + ' ' + (order.user as any)?.lastName,
        orderDate: order.createdAt,
        discountAmount: order.totalDiscount,
        orderTotal: order.totalAmount
      }));

    return res.json({
      success: true,
      data: {
        coupon: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue
        },
        metrics: {
          totalUses,
          totalDiscount,
          totalRevenue,
          averageDiscount,
          uniqueUsers: coupon.usedBy.length
        },
        recentUses
      }
    });
  } catch (error) {
    console.error('Get coupon report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating coupon report'
    });
  }
};
