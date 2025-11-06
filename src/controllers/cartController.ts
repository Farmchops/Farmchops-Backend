import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Product } from '../models/Product';
import { AuthRequest } from '../middleware/auth';
import {
  getCart,
  saveCart,
  recalculateCart,
  getOptimalPriceType,
  getPriceForType,
  getUnitForType,
  getMinQuantityForType,
  getTierNameForType,
  clearCart as clearCartHelper
} from '../utils/cartHelpers';

/**
 * Add item to cart
 */
export const addToCart = async (req: AuthRequest, res: Response): Promise<Response> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const {
    productId,
    name,
    image,
    price,
    quantity,
    unit,
    priceType,
    minQuantity,
    tierName,
    dealId
  } = req.body;

  const normalizedDealId = dealId ? String(dealId) : undefined;

  try {
    // Still validate product exists and is available
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

    const cart = await getCart(req);

    // Use the tier information sent from frontend, don't recalculate
    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        item.priceType === priceType &&
        item.tierName === tierName &&
        item.dealId === normalizedDealId
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
      // Use all data from frontend request
      cart.items.push({
        productId,
        name,
        image,
        price,
        quantity,
        unit,
        priceType,
        minQuantity,
        tierName,
        dealId: normalizedDealId,
      });
    }

    recalculateCart(cart);
    await saveCart(req, cart);

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

/**
 * Get cart items
 */
export const getCartItems = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const cart = await getCart(req);
    return res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    console.error('Error getting cart items:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Update cart item quantity
 */
export const updateCartItem = async (req: AuthRequest, res: Response): Promise<Response> => {
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
    const cart = await getCart(req);

    const normalizedDealId = req.body.dealId ? String(req.body.dealId) : undefined;
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        item.priceType === priceType &&
        item.tierName === (req.body.tierName || undefined) &&
        item.dealId === normalizedDealId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not in cart',
      });
    }

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

    const item = cart.items[itemIndex];
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    // Only update the quantity - keep the user's selected tier/priceType unchanged
    item.quantity = quantity;

    recalculateCart(cart);
    await saveCart(req, cart);

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
export const clearCart = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    await clearCartHelper(req);

    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Remove specific item from cart
 */
export const removeCartItem = async (req: AuthRequest, res: Response): Promise<Response> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { priceType } = req.body;
  const { productId } = req.params;

  try {
    const cart = await getCart(req);

    const normalizedDealId = req.body.dealId ? String(req.body.dealId) : undefined;
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId &&
        item.priceType === priceType &&
        item.tierName === (req.body.tierName || undefined) &&
        item.dealId === normalizedDealId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    const removedItem = cart.items.splice(itemIndex, 1)[0];
    recalculateCart(cart);
    await saveCart(req, cart);

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
