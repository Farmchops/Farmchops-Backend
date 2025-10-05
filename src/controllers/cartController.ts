
import { Request, Response } from 'express';
import { validationResult, body } from 'express-validator';
import { Product, IProduct } from '../models/Product';

// ===== TYPES =====
interface CartItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
  priceType: 'retail' | 'bulk';
}

interface Cart {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  lastUpdated: Date;
}

// ===== HELPERS =====
const getCart = (req: Request): Cart => {
  if (!req.session) {
    throw new Error('Session not available');
  }
  if (!req.session.cart) {
    req.session.cart = {
      items: [],
      totalItems: 0,
      totalAmount: 0,
      lastUpdated: new Date(),
    };
  }
  return req.session.cart;
};

const saveCart = (req: Request, cart: Cart): void => {
  if (!req.session) {
    throw new Error('Session not available');
  }
  req.session.cart = cart;
};

// Find the best bulk tier for a quantity (cheapest per-unit price that quantity qualifies for)
const getOptimalBulkTier = (product: IProduct, quantity: number) => {
  if (!product.pricing.bulkTiers || product.pricing.bulkTiers.length === 0) {
    return null;
  }

  // Filter tiers the quantity qualifies for
  const qualifyingTiers = product.pricing.bulkTiers.filter(
    tier => quantity >= tier.minQuantity
  );

  if (qualifyingTiers.length === 0) {
    return null;
  }

  // Return the tier with best per-unit price
  return qualifyingTiers.reduce((best, tier) => {
    const tierPerUnit = tier.price / tier.minQuantity;
    const bestPerUnit = best.price / best.minQuantity;
    return tierPerUnit < bestPerUnit ? tier : best;
  });
};

// Get the price and unit for a given quantity
const getPriceForQuantity = (product: IProduct, quantity: number): { price: number; unit: string; tierName?: string } => {
  const bulkTier = getOptimalBulkTier(product, quantity);
  
  if (bulkTier) {
    return {
      price: bulkTier.price,
      unit: bulkTier.unit,
      tierName: bulkTier.name
    };
  }

  return {
    price: product.pricing.retail.price,
    unit: product.pricing.retail.unit
  };
};

// Calculate total price for quantity
const calculateTotalPrice = (product: IProduct, quantity: number): number => {
  const { price } = getPriceForQuantity(product, quantity);
  return price * quantity;
};

const recalculateCart = (cart: Cart): Cart => {
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  cart.lastUpdated = new Date();
  return cart;
};



// Helper to determine optimal price type
const getOptimalPriceType = (product: IProduct, quantity: number): 'retail' | 'bulk' => {
  const bulkTier = getOptimalBulkTier(product, quantity);
  return bulkTier ? 'bulk' : 'retail';
};

// Helper to get price for a given price type
const getPriceForType = (product: IProduct, priceType: 'retail' | 'bulk'): number => {
  if (priceType === 'bulk') {
    // Find the best bulk tier for the minimum quantity in cart
    const bulkTier = getOptimalBulkTier(product, 1);
    if (bulkTier) {
      return bulkTier.price;
    }
  }
  return product.pricing.retail.price;
};

// Helper to get unit for a given price type
const getUnitForType = (product: IProduct, priceType: 'retail' | 'bulk'): string => {
  if (priceType === 'bulk') {
    const bulkTier = getOptimalBulkTier(product, 1);
    if (bulkTier) {
      return bulkTier.unit;
    }
  }
  return product.pricing.retail.unit;
};

/**
 * Add item to cart
 */
export const addToCart = async (req: Request, res: Response): Promise<Response> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { productId, quantity } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Product is not available for purchase',
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
    }

    if (quantity > product.inventory.availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.inventory.availableStock} items available in stock`,
      });
    }

    let cart: Cart;
    try {
      cart = getCart(req);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Session not available',
      });
    }
    const priceType = getOptimalPriceType(product, quantity);
    const price = getPriceForType(product, priceType);
    const unit = getUnitForType(product, priceType);
    const existingIndex = cart.items.findIndex(
      (item) => item.productId === productId && item.priceType === priceType
    );

    if (existingIndex > -1 && cart.items[existingIndex]) {
      const newQuantity = cart.items[existingIndex].quantity + quantity;
      if (newQuantity > product.inventory.availableStock) {
        return res.status(400).json({
          success: false,
          message: `Total quantity exceeds available stock (${product.inventory.availableStock})`,
        });
      }
      cart.items[existingIndex].quantity = newQuantity;
    } else {
      cart.items.push({
        productId: (product._id as string | { toString(): string }).toString(),
        name: product.name,
        image: product.images[0] || '',
        price,
        quantity,
        unit,
        priceType,
      });
    }

    saveCart(req, recalculateCart(cart));

    return res.status(200).json({
      success: true,
      message: 'Item added to cart',
      cart,
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getCartItems = (req: Request, res: Response): Response => {
  const cart = getCart(req);
  return res.status(200).json({
    success: true,
    cart,
  });
};

/**
 * Update item quantity in cart
 */
export const updateCartItem = async (req: Request, res: Response): Promise<Response> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { productId, quantity, priceType } = req.body;

  if (quantity < 1) {
    return res.status(400).json({
      success: false,
      message: 'Quantity must be at least 1',
    });
  }

  try {
    let cart: Cart;
    try {
      cart = getCart(req);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Session not available',
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId && item.priceType === priceType
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not in cart',
      });
    }

    // Fetch product to check inventory and pricing
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Product is not available',
      });
    }

    if (quantity > product.inventory.availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.inventory.availableStock} items available`,
      });
    }

    const newPriceType = getOptimalPriceType(product, quantity);
    const newPrice = getPriceForType(product, newPriceType);
    const newUnit = getUnitForType(product, newPriceType);

    const item = cart.items[itemIndex];
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }
    item.quantity = quantity;
    item.priceType = newPriceType;
    item.price = newPrice;
    item.unit = newUnit;

    saveCart(req, recalculateCart(cart));

    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      cart,
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Clear entire cart
 */
export const clearCart = (req: Request, res: Response): Response => {
  if (req.session) {
    req.session.cart = undefined;
  } else {
    return res.status(500).json({
      success: false,
      message: 'Session not available',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Cart cleared',
  });
};

export const removeCartItem = async (req: Request, res: Response): Promise<Response> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { productId, priceType } = req.body;

  try {
    let cart: Cart;
    try {
      cart = getCart(req);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Session not available',
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId === productId && item.priceType === priceType
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    const removedItem = cart.items.splice(itemIndex, 1)[0];
    saveCart(req, recalculateCart(cart));

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      removedItem,
      cart,
    });
  } catch (error) {
    console.error('Error removing cart item:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

