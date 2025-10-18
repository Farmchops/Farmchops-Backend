import 'express-session';
import { ICartItem } from '../models/Cart';

declare module 'express-session' {
  interface SessionData {
    cart?: {
      items: ICartItem[];
      totalItems: number;
      totalAmount: number;
      lastUpdated: Date;
    };
  }
}
