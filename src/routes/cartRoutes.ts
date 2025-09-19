

import express from 'express';
import { body, param } from 'express-validator';
import { 
  addToCart, 
  getCartItems, 
  updateCartItem, 
  clearCart ,
  removeCartItem
} from '../controllers/cartController';
import {
  addToCartValidation,
  updateCartValidation,
  removeFromCartValidation
} from '../middleware/cartValidator';

const router = express.Router();




// ===== ROUTES =====

/**
 * GET /api/cart
 * Get current cart contents
 */
router.get('/', getCartItems);

/**
 * POST /api/cart/add
 * Add item to cart
 * Body: { productId: string, quantity: number }
 */
router.post('/add', addToCartValidation, addToCart);

/**
 * PUT /api/cart/update
 * Update cart item quantity and price type
 * Body: { productId: string, quantity: number, priceType: 'retail' | 'bulk' }
 */
router.put('/update', updateCartValidation, updateCartItem);

/**
 * DELETE /api/cart/clear
 * Clear entire cart
 */
router.delete('/clear', clearCart);

router.delete('/cart/remove/:productId',removeFromCartValidation, removeCartItem)

router.post('/cart/validate', removeFromCartValidation)

export default router;

