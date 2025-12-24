import mongoose from 'mongoose';
import Coupon, { ICoupon } from '../models/Coupon';

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validate if a coupon can be used for an order
 */
export const validateCoupon = async (
  coupon: ICoupon,
  userId: mongoose.Types.ObjectId,
  orderAmount: number
): Promise<ValidationResult> => {

  // 1. Check status
  if (coupon.status !== 'active') {
    return { isValid: false, message: 'Coupon is not active' };
  }

  // 2. Check validity dates
  if (coupon.validFrom && new Date() < coupon.validFrom) {
    return { isValid: false, message: 'Coupon is not yet valid' };
  }

  if (coupon.validUntil && new Date() > coupon.validUntil) {
    // Auto-expire
    coupon.status = 'expired';
    await coupon.save();
    return { isValid: false, message: 'Coupon has expired' };
  }

  // 3. Check minimum order amount
  if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
    const minInNaira = (coupon.minOrderAmount / 100).toLocaleString();
    return {
      isValid: false,
      message: `Order must be at least ₦${minInNaira}`
    };
  }

  // 4. Check total usage limit
  if (coupon.maxUsesTotal && coupon.currentUses >= coupon.maxUsesTotal) {
    return { isValid: false, message: 'Coupon usage limit reached' };
  }

  // 5. Check per-user usage limit
  if (coupon.usedBy && coupon.usedBy.length > 0) {
    const userUseCount = coupon.usedBy.filter(id =>
      id.toString() === userId.toString()
    ).length;

    if (userUseCount >= coupon.maxUsesPerUser) {
      return { isValid: false, message: 'You have already used this coupon' };
    }
  }

  return { isValid: true };
};

/**
 * Calculate discount amount for a coupon
 */
export const calculateCouponDiscount = (
  coupon: ICoupon,
  orderAmount: number
): number => {
  if (coupon.discountType === 'percentage') {
    let discount = Math.floor(orderAmount * (coupon.discountValue / 100));
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
    return discount;
  }

  if (coupon.discountType === 'fixed_amount') {
    return Math.min(coupon.discountValue, orderAmount);
  }

  if (coupon.discountType === 'free_delivery') {
    // Free delivery handled separately
    return 0;
  }

  return 0;
};

/**
 * Find coupon by code (case-insensitive)
 */
export const findCouponByCode = async (code: string): Promise<ICoupon | null> => {
  return await Coupon.findOne({
    code: code.toUpperCase(),
    status: 'active'
  });
};

/**
 * Mark coupon as used by a user
 */
export const markCouponAsUsed = async (
  couponId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<void> => {
  await Coupon.findByIdAndUpdate(couponId, {
    $inc: { currentUses: 1 },
    $push: { usedBy: userId }
  });
};

/**
 * Check if coupon code exists
 */
export const couponCodeExists = async (code: string): Promise<boolean> => {
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  return !!coupon;
};
