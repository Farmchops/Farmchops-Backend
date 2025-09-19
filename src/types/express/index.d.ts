
// src/types/express/index.d.ts
import { IUser } from '../../models/User';

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
    session?: {
      cart?: {
        items: {
          productId: string;
          name: string;
          image: string;
          price: number;
          quantity: number;
          unit: string;
          priceType: 'retail' | 'bulk';
        }[];
        totalItems: number;
        totalAmount: number;
        lastUpdated: Date;
      };
      passport?: {
        user: string;
      };
      [key: string]: any;
    };
  }
}