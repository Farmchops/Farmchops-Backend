import { body, param } from 'express-validator';

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

export const updateCartValidation = [
  param('productId')
    .isMongoId()
    .withMessage('Invalid product ID'),
  
  body('quantity')
    .isInt({ min: 0, max: 1000 })
    .withMessage('Quantity must be between 0 and 1000')
];

export const removeFromCartValidation = [
  param('productId')
    .isMongoId()
    .withMessage('Invalid product ID'),

    body('priceType')
    .isIn(['retail', 'bulk'])
    .withMessage('Price type must be retail or bulk')
];