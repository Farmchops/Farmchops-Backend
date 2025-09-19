
// types/cart.ts
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  quantity: number;
  priceType: 'retail' | 'bulk';
  unitPrice: number;
  totalPrice: number;
  stock: number;
  minBulkQuantity?: number;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  lastUpdated: Date;
}

export interface CartValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  updatedCart?: Cart;
}