import { AuthRequest } from '../middleware/auth';
import Cart, { ICart, ICartItem } from '../models/Cart';
import { IProduct } from '../models/Product';

export interface SessionCart {
  items: ICartItem[];
  totalItems: number;
  totalAmount: number;
  lastUpdated: Date;
}

/**
 * Get cart for the current request
 * - If user is logged in (JWT): returns database cart
 * - If user is anonymous: returns session cart
 * - On first access after login: merges session cart into database cart
 */
export async function getCart(req: AuthRequest): Promise<SessionCart | ICart> {
  // User is logged in - use database cart
  if (req.user) {
    let userCart = await Cart.findOne({ userId: req.user._id });

    // Create cart if user doesn't have one
    if (!userCart) {
      const newCart = new Cart({
        userId: req.user._id,
        items: [],
        totalItems: 0,
        totalAmount: 0
      });
      userCart = await newCart.save();
    }

    // Check if there's a session cart to merge
    if (req.session?.cart && req.session.cart.items.length > 0) {
      console.log(`Merging session cart into user cart for user ${req.user._id}`);
      const mergedCart = await mergeSessionCartIntoUserCart(req.session.cart, userCart);
      // Clear session cart after merge
      req.session.cart = undefined;
      return mergedCart;
    }

    return userCart;
  }

  // User is anonymous - use session cart
  if (!req.session) {
    throw new Error('Session not available');
  }

  if (!req.session.cart) {
    const emptyCart: SessionCart = {
      items: [],
      totalItems: 0,
      totalAmount: 0,
      lastUpdated: new Date()
    };
    req.session.cart = emptyCart;
  }

  return req.session.cart;
}

/**
 * Save cart based on user authentication status
 * - Logged in: saves to database
 * - Anonymous: saves to session
 */
export async function saveCart(req: AuthRequest, cart: SessionCart | ICart): Promise<void> {
  if (req.user) {
    // It's a database cart
    if ('save' in cart) {
      await cart.save();
    }
  } else {
    // It's a session cart
    if (!req.session) {
      throw new Error('Session not available');
    }
    req.session.cart = cart as SessionCart;
  }
}

/**
 * Merge session cart items into user's database cart
 */
async function mergeSessionCartIntoUserCart(
  sessionCart: SessionCart,
  userCart: ICart
): Promise<ICart> {
  for (const sessionItem of sessionCart.items) {
    const existingItemIndex = userCart.items.findIndex(
      item => item.productId === sessionItem.productId && item.priceType === sessionItem.priceType && item.tierName === sessionItem.tierName
    );

    if (existingItemIndex > -1 && userCart.items[existingItemIndex]) {
      // Item already exists in user cart, add quantities
      userCart.items[existingItemIndex].quantity += sessionItem.quantity;
    } else {
      // New item, add to user cart
      userCart.items.push(sessionItem);
    }
  }

  // Recalculate totals
  recalculateCart(userCart);
  await userCart.save();

  return userCart;
}

/**
 * Recalculate cart totals
 */
export function recalculateCart(cart: SessionCart | ICart): SessionCart | ICart {
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  cart.lastUpdated = new Date();
  return cart;
}

/**
 * Find the best bulk tier for a quantity
 */
export function getOptimalBulkTier(product: IProduct, quantity: number) {
  if (!product.pricing.bulkTiers || product.pricing.bulkTiers.length === 0) {
    return null;
  }

  const qualifyingTiers = product.pricing.bulkTiers.filter(
    tier => quantity >= tier.minQuantity
  );

  if (qualifyingTiers.length === 0) {
    return null;
  }

  return qualifyingTiers.reduce((best, tier) => {
    const tierPerUnit = tier.price / tier.minQuantity;
    const bestPerUnit = best.price / best.minQuantity;
    return tierPerUnit < bestPerUnit ? tier : best;
  });
}

/**
 * Get the optimal price type for a given quantity
 */
export function getOptimalPriceType(product: IProduct, quantity: number): 'retail' | 'bulk' {
  const bulkTier = getOptimalBulkTier(product, quantity);
  return bulkTier ? 'bulk' : 'retail';
}

/**
 * Get price for a given price type
 */
export function getPriceForType(product: IProduct, priceType: 'retail' | 'bulk', quantity: number = 1): number {
  if (priceType === 'bulk') {
    const bulkTier = getOptimalBulkTier(product, quantity);
    if (bulkTier) {
      return bulkTier.price;
    }
  }
  return product.pricing.retail.price;
}

/**
 * Get unit for a given price type
 */
export function getUnitForType(product: IProduct, priceType: 'retail' | 'bulk', quantity: number = 1): string {
  if (priceType === 'bulk') {
    const bulkTier = getOptimalBulkTier(product, quantity);
    if (bulkTier) {
      return bulkTier.unit;
    }
  }
  return product.pricing.retail.unit;
}

/**
 * Get minimum quantity for a given price type
 */
export function getMinQuantityForType(product: IProduct, priceType: 'retail' | 'bulk', quantity: number = 1): number {
  if (priceType === 'bulk') {
    const bulkTier = getOptimalBulkTier(product, quantity);
    if (bulkTier) {
      return bulkTier.minQuantity;
    }
  }
  return product.pricing.retail.minQuantity;
}

/**
 * Get tier name for a given price type (only for bulk)
 */
export function getTierNameForType(product: IProduct, priceType: 'retail' | 'bulk', quantity: number = 1): string | undefined {
  if (priceType === 'bulk') {
    const bulkTier = getOptimalBulkTier(product, quantity);
    if (bulkTier) {
      return bulkTier.name;
    }
  }
  return undefined;
}

/**
 * Clear cart based on authentication status
 */
export async function clearCart(req: AuthRequest): Promise<void> {
  if (req.user) {
    // Logged in - clear database cart
    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      {
        items: [],
        totalItems: 0,
        totalAmount: 0,
        lastUpdated: new Date()
      }
    );
  } else {
    // Anonymous - clear session cart
    if (req.session) {
      req.session.cart = undefined;
    }
  }
}
