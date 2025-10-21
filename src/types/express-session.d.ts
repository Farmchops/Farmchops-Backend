
import 'express-session';
import type { Cart } from '../controllers/_cartHelpers';

declare module 'express-session' {
  interface SessionData {
    cart?: Cart;
  }
}
