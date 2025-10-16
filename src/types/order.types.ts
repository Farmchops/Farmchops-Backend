export interface CheckoutRequest {
  name: string;
  phone: string;
  address: string;
  origin?: string; // Optional warehouse coordinates override
  notes?: string; // Optional customer notes for special instructions
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

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
}

export interface CheckoutSummaryResponse {
  success: boolean;
  data?: {
    cart: any; // Cart interface from cart.ts
    customerInfo: CustomerInfo;
    delivery: DeliveryInfo;
    notes: string | null;
    totals: OrderTotals;
  };
  message?: string; // For error messages
}