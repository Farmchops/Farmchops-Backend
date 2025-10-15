import { body, param } from 'express-validator';

// Add to cart - productId in BODY
export const addToCartValidation = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID'),
  
  body('quantity')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantity must be between 1 and 1000'),
  
  body('priceType')
    .optional()
    .isIn(['retail', 'bulk'])
    .withMessage('Price type must be either retail or bulk')
];

// Update cart - productId in BODY (not params!)
export const updateCartValidation = [
  body('productId')  // Changed from param to body
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID'),
  
  body('quantity')
    .isInt({ min: 1, max: 1000 })  // Changed min to 1 (0 should remove item)
    .withMessage('Quantity must be between 1 and 1000'),
  
  body('priceType')
    .isIn(['retail', 'bulk'])
    .withMessage('Price type must be retail or bulk')
];

// Remove from cart - productId in PARAMS
export const removeFromCartValidation = [
  param('productId')  // ✅ Correct - in URL
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('priceType')
    .isIn(['retail', 'bulk'])
    .withMessage('Price type must be retail or bulk')
];