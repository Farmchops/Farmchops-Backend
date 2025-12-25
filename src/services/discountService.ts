import mongoose from 'mongoose';
import User from '../models/User';
import { Order } from '../models/Order';
import Coupon from '../models/Coupon';
import { validateCoupon } from './couponService';

interface DiscountCalculation {
  type: 'first_time' | 'coupon' | 'marketer_promo';
  code?: string;
  description: string;
  amount: number;
  applied: boolean;
  isFreeDelivery?: boolean; // Flag for free delivery coupons
}

interface DiscountResult {
  discounts: DiscountCalculation[];
  bestDiscount: DiscountCalculation | null;
  totalDiscount: number;
  finalSubtotal: number;
  hasFreeDelivery: boolean; // Flag to indicate if free delivery should be applied
  freeDeliveryCoupon?: string; // The coupon code for free delivery
}

/**
 * Calculate all available discounts for an order
 * Automatically selects the best discount (NO STACKING)
 * Note: Free delivery is handled separately and doesn't compete with other discounts
 */
export const calculateOrderDiscounts = async (
  userId: mongoose.Types.ObjectId,
  subtotal: number,
  couponCode?: string,
  deliveryFee?: number
): Promise<DiscountResult> => {
  const discounts: DiscountCalculation[] = [];
  let hasFreeDelivery = false;
  let freeDeliveryCoupon: string | undefined;

  // 1. Check first-time discount eligibility
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  // User qualifies for first-time discount if:
  // - Has not used it before
  // - Has no completed/delivered orders
  // - Order meets minimum amount (₦5,000 = 500000 kobo)
  const hasCompletedOrder = await Order.findOne({
    user: userId,
    orderStatus: { $in: ['delivered', 'completed'] }
  });

  if (!hasCompletedOrder && !user.hasUsedFirstTimeDiscount && subtotal >= 500000) {
    // Calculate 10% discount, capped at ₦2,000 (200000 kobo)
    const discount = Math.min(
      Math.floor(subtotal * 0.10),  // 10%
      200000                          // Max ₦2,000
    );

    discounts.push({
      type: 'first_time',
      description: 'First-time buyer discount (10%)',
      amount: discount,
      applied: false  // Will be set later
    });
  }

  // 2. Check coupon if provided
  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      status: 'active'
    });

    if (coupon) {
      const validation = await validateCoupon(coupon, userId, subtotal);

      if (validation.isValid) {
        let discount = 0;

        if (coupon.discountType === 'percentage') {
          discount = Math.floor(subtotal * (coupon.discountValue / 100));
          if (coupon.maxDiscountAmount) {
            discount = Math.min(discount, coupon.maxDiscountAmount);
          }
        } else if (coupon.discountType === 'fixed_amount') {
          discount = coupon.discountValue;
        } else if (coupon.discountType === 'free_delivery') {
          // Free delivery coupon - set flag and use delivery fee as discount amount
          hasFreeDelivery = true;
          freeDeliveryCoupon = coupon.code;
          discount = deliveryFee || 0; // Use actual delivery fee for comparison
        }

        discounts.push({
          type: 'coupon',
          code: coupon.code,
          description: coupon.description,
          amount: discount,
          applied: false,
          isFreeDelivery: coupon.discountType === 'free_delivery'
        });
      }
    }
  }

  // 3. Determine best discount (no stacking)
  let bestDiscount: DiscountCalculation | null = null;

  if (discounts.length > 0) {
    bestDiscount = discounts.reduce((best, current) =>
      current.amount > best.amount ? current : best
    );

    if (bestDiscount) {
      bestDiscount.applied = true;

      // If best discount is free delivery, set the flag
      if (bestDiscount.isFreeDelivery) {
        hasFreeDelivery = true;
        freeDeliveryCoupon = bestDiscount.code;
      }
    }
  }

  return {
    discounts,
    bestDiscount,
    totalDiscount: bestDiscount?.amount || 0,
    finalSubtotal: subtotal - (bestDiscount?.isFreeDelivery ? 0 : (bestDiscount?.amount || 0)),
    hasFreeDelivery,
    freeDeliveryCoupon
  };
};

/**
 * Check if user is eligible for first-time discount
 */
export const isEligibleForFirstTimeDiscount = async (
  userId: mongoose.Types.ObjectId,
  subtotal: number
): Promise<boolean> => {
  const user = await User.findById(userId);
  if (!user || user.hasUsedFirstTimeDiscount) {
    return false;
  }

  const hasCompletedOrder = await Order.findOne({
    user: userId,
    orderStatus: { $in: ['delivered', 'completed'] }
  });

  return !hasCompletedOrder && subtotal >= 500000;
};

/**
 * Calculate first-time discount amount
 */
export const calculateFirstTimeDiscount = (subtotal: number): number => {
  if (subtotal < 500000) {
    return 0;
  }

  // 10% discount, capped at ₦2,000 (200000 kobo)
  return Math.min(
    Math.floor(subtotal * 0.10),
    200000
  );
};
