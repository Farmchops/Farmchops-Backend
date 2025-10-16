import express from 'express';
import { body, param } from 'express-validator';
import { 
  addToCart, 
  getCartItems, 
  updateCartItem, 
  clearCart,
  removeCartItem
} from '../controllers/cartController';
import {
  addToCartValidation,
  updateCartValidation,
  removeFromCartValidation
} from '../middleware/cartValidator';

const router = express.Router();

// Get current cart contents
router.get('/', getCartItems);

// Add item to cart
router.post('/add', addToCartValidation, addToCart);

// Update cart item quantity and price 
router.put('/update', updateCartValidation, updateCartItem);

// Remove specific item from cart
router.delete('/remove/:productId', removeFromCartValidation, removeCartItem);  // ✅ Fixed: removed '/cart'

// Clear entire cart
router.delete('/clear', clearCart);

export default router;