
// src/types/express/index.d.ts
import { IUser } from '../../models/User';
import { ICartItem } from '../../models/Cart';

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
    session?: {
      cart?: {
        items: ICartItem[];
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