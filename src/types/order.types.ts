export interface CheckoutRequest {
  name: string;
  phone: string;
  address: string;
  area?: string;
  postalCode?: string;
  origin?: string;
  notes?: string;
  couponCode?: string;
}

export interface DeliveryInfo {
  address: string;
  country: string;
  isInternational: boolean;
  fee: number;
  // Domestic zone-based
  zone?: number;
  zoneName?: string;
  // International only
  carrier?: string;
  estimatedDays?: string;
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