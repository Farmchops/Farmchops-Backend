import { Request, Response } from 'express';
import { calculateOrderDiscounts } from '../services/discountService';

/**
 * @desc Calculate order discounts (shows all available discounts and picks best one)
 * @route POST /api/orders/calculate-discounts
 * @access Private (authenticated users)
 */
export const calculateDiscounts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { subtotal, couponCode } = req.body;
    const userId = (req as any).user._id;

    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid subtotal is required'
      });
    }

    // Calculate all available discounts
    const discountResult = await calculateOrderDiscounts(userId, subtotal, couponCode);

    return res.json({
      success: true,
      data: {
        subtotal,
        discounts: discountResult.discounts,
        bestDiscount: discountResult.bestDiscount,
        totalDiscount: discountResult.totalDiscount,
        finalSubtotal: discountResult.finalSubtotal
      }
    });
  } catch (error) {
    console.error('Calculate discounts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error calculating discounts'
    });
  }
};
