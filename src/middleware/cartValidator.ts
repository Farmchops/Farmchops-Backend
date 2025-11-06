import { body, param } from 'express-validator';

// Add to cart - productId in BODY
export const addToCartValidation = [
  body('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('name')
    .notEmpty()
    .withMessage('Product name is required')
    .isString()
    .withMessage('Product name must be a string'),

  body('image')
    .notEmpty()
    .withMessage('Product image is required')
    .isString()
    .withMessage('Product image must be a string'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isNumeric()
    .withMessage('Price must be a number')
    .custom((value) => value > 0)
    .withMessage('Price must be greater than 0'),

  body('quantity')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantity must be between 1 and 1000'),

  body('unit')
    .notEmpty()
    .withMessage('Unit is required')
    .isString()
    .withMessage('Unit must be a string'),

  body('priceType')
    .notEmpty()
    .withMessage('Price type is required')
    .isIn(['retail', 'bulk'])
    .withMessage('Price type must be either retail or bulk'),

  body('minQuantity')
    .notEmpty()
    .withMessage('Minimum quantity is required')
    .isInt({ min: 1 })
    .withMessage('Minimum quantity must be at least 1'),

  body('tierName')
    .optional()
    .isString()
    .withMessage('Tier name must be a string'),

  body('dealId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Deal ID must be a valid Mongo ID')
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
    .withMessage('Price type must be retail or bulk'),

  body('tierName')
    .optional()
    .isString()
    .withMessage('Tier name must be a string'),

  body('dealId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Deal ID must be a valid Mongo ID')
];

// Remove from cart - productId in PARAMS
export const removeFromCartValidation = [
  param('productId')  // ✅ Correct - in URL
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('priceType')
    .isIn(['retail', 'bulk'])
    .withMessage('Price type must be retail or bulk'),

  body('tierName')
    .optional()
    .isString()
    .withMessage('Tier name must be a string'),

  body('dealId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Deal ID must be a valid Mongo ID')
];