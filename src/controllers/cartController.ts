
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

const getOptimalPriceType = (product: IProduct, quantity: number): 'retail' | 'bulk' => {
  if (quantity >= product.pricing.bulk.minQuantity) {
    return 'bulk';
  }
  return 'retail';
};

const getPriceForType = (product: IProduct, type: 'retail' | 'bulk'): number => {
  return type === 'retail' ? product.pricing.retail.price : product.pricing.bulk.price;
};

const getUnitForType = (product: IProduct, type: 'retail' | 'bulk'): string => {
  return type === 'retail' ? product.pricing.retail.unit : product.pricing.bulk.unit;
};

const recalculateCart = (cart: Cart): Cart => {
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  cart.lastUpdated = new Date();
  return cart;
};

// ===== CONTROLLERS =====

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

