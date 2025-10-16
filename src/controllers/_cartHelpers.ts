import { Request } from 'express';

export interface CartItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
  priceType: 'retail' | 'bulk';
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  lastUpdated: Date;
}

export function getCart(req: Request): Cart {
  if (!req.session) throw new Error('Session not available');
  return req.session.cart as Cart;
}
