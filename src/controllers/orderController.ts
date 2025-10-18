import { Request, Response } from 'express';
import { getCart } from '../utils/_cartHelpers';
import { getDistanceBetween } from '../services/googleMapsService';
import { CheckoutRequest, CheckoutSummaryResponse } from '../types/order.types';

// Fee config (NGN)
const BASE_FEE = 200; // base delivery fee
const PER_KM = 100; // per kilometer
const MIN_FEE = 300;
const FREE_THRESHOLD = 50000; // free delivery if subtotal >= this (in kobo)

function calculateFee(subtotal: number, distanceKm: number): number {
  if (subtotal >= FREE_THRESHOLD) return 0;
  const fee = Math.max(MIN_FEE, Math.round(BASE_FEE + PER_KM * distanceKm));
  return fee;
}

export const checkoutSummary = async (req: Request<{}, CheckoutSummaryResponse, CheckoutRequest>, res: Response<CheckoutSummaryResponse>): Promise<Response<CheckoutSummaryResponse>> => {
  try {
    const { name, phone, address, origin, notes } = req.body;
    if (!name || !phone || !address) {
      return res.status(400).json({ success: false, message: 'name, phone and address are required' });
    }

    const cart = getCart(req);
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Server origin (warehouse) - you may want to make this configurable
    const warehouse = origin || process.env.DEFAULT_WAREHOUSE_COORDS || '6.5244,3.3792';

    // Use Google Distance Matrix to calculate distance
    const distanceResult = await getDistanceBetween(warehouse, address);
    const distanceKm = Number((distanceResult.distanceMeters / 1000).toFixed(2));

    const subtotal = cart.totalAmount; // assume stored in same currency unit as prices
    const deliveryFee = calculateFee(subtotal, distanceKm);

    const totals = {
      subtotal,
      deliveryFee,
      grandTotal: subtotal + deliveryFee
    };

    return res.json({
      success: true,
      data: {
        cart,
        customerInfo: {
          name,
          phone
        },
        delivery: {
          address,
          distanceKm,
          durationSeconds: distanceResult.durationSeconds,
          distanceText: distanceResult.distanceText,
          durationText: distanceResult.durationText,
          fee: deliveryFee
        },
        notes: notes || null, // Optional customer notes for special instructions
        totals
      }
    });
  } catch (error: any) {
    console.error('Checkout summary error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to compute checkout summary' });
  }
};
