export interface CheckoutRequest {
  name: string;
  phone: string;
  address: string;
  origin?: string; // Optional warehouse coordinates override
  notes?: string; // Optional customer notes for special instructions
  couponCode?: string; // Optional coupon code for discount
}

export interface DeliveryInfo {
  address: string;
  distanceKm: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  fee: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
}

export interface DiscountInfo {
  type: 'first_time' | 'coupon' | 'marketer_promo';
  code?: string;
  description: string;
  amount: number;
}

export interface OrderTotals {
  subtotalBeforeDiscount: number;
  discount: number;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  grandTotal: number;
}

export interface CheckoutSummaryResponse {
  success: boolean;
  data?: {
    cart: any; // Cart interface from cart.ts
    customerInfo: CustomerInfo;
    delivery: DeliveryInfo;
    notes: string | null;
    discount: DiscountInfo | null;
    totals: OrderTotals;
  };
  message?: string; // For error messages
}