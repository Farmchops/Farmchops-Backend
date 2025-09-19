import { Product } from '../models/Product';
import { Cart, CartItem, CartValidationResult } from '../types/cart';

export class CartUtils {
  /**
   * Calculate item total price based on quantity and price type
   */
  static calculateItemPrice(quantity: number, retailPrice: number, bulkPrice: number, minBulkQuantity: number, priceType: 'retail' | 'bulk'): number {
    if (priceType === 'bulk' && quantity >= minBulkQuantity) {
      return quantity * bulkPrice;
    }
    return quantity * retailPrice;
  }

  /**
   * Determine optimal price type for given quantity
   */
  static getOptimalPriceType(quantity: number, minBulkQuantity: number): 'retail' | 'bulk' {
    return quantity >= minBulkQuantity ? 'bulk' : 'retail';
  }

  /**
   * Calculate cart totals
   */
  static calculateCartTotals(items: CartItem[]): { totalItems: number; totalAmount: number } {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return { totalItems, totalAmount };
  }

  /**
   * Validate cart against current product data
   */
  static async validateCart(cart: Cart): Promise<CartValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const updatedItems: CartItem[] = [];
    let hasChanges = false;

    for (const item of cart.items) {
      try {
        const product = await Product.findById(item.productId);
        
        if (!product) {
          errors.push(`Product "${item.name}" is no longer available`);
          hasChanges = true;
          continue;
        }

        if (product.status !== 'active') {
          errors.push(`Product "${product.name}" is currently unavailable`);
          hasChanges = true;
          continue;
        }

        // Check stock availability
        if (item.quantity > product.inventory.availableStock ) {
          if (product.inventory.availableStock > 0) {
            warnings.push(`"${product.name}" quantity reduced from ${item.quantity} to ${product.inventory.availableStock} (limited stock)`);
            item.quantity = product.inventory.availableStock
            hasChanges = true;
          } else {
            errors.push(`"${product.name}" is out of stock`);
            hasChanges = true;
            continue;
          }
        }

        // Check price changes
        const currentRetailPrice = product.pricing.retail.price;
        const currentBulkPrice = product.pricing.bulk.price;
        const currentMinBulkQuantity = product.pricing.bulk.minQuantity;

        // Recalculate optimal price type
        const optimalPriceType = this.getOptimalPriceType(item.quantity, currentMinBulkQuantity);
        
        if (item.priceType !== optimalPriceType) {
          item.priceType = optimalPriceType;
          hasChanges = true;
        }

        // Recalculate prices
        const newUnitPrice = item.priceType === 'bulk' ? currentBulkPrice : currentRetailPrice;
        const newTotalPrice = this.calculateItemPrice(
          item.quantity, 
          currentRetailPrice, 
          currentBulkPrice, 
          currentMinBulkQuantity, 
          item.priceType
        );

        if (item.unitPrice !== newUnitPrice) {
          const oldPrice = item.unitPrice;
          warnings.push(`Price updated for "${product.name}": ₦${oldPrice.toLocaleString()} → ₦${newUnitPrice.toLocaleString()}`);
          hasChanges = true;
        }

        // Update item with current data
        const updatedItem: CartItem = {
          ...item,
          name: product.name,
          image: product.images[0] || '',
          unitPrice: newUnitPrice,
          totalPrice: newTotalPrice,
          stock: product.inventory.availableStock,
          minBulkQuantity: currentMinBulkQuantity
        };

        updatedItems.push(updatedItem);

      } catch (error) {
        errors.push(`Error validating "${item.name}"`);
        hasChanges = true;
      }
    }

    const isValid = errors.length === 0;
    
    if (hasChanges && updatedItems.length > 0) {
      const { totalItems, totalAmount } = this.calculateCartTotals(updatedItems);
      const updatedCart: Cart = {
        items: updatedItems,
        totalItems,
        totalAmount,
        lastUpdated: new Date()
      };
      
      return { isValid, errors, warnings, updatedCart };
    }

    return { isValid, errors, warnings };
  }

  /**
   * Create empty cart
   */
  static createEmptyCart(): Cart {
    return {
      items: [],
      totalItems: 0,
      totalAmount: 0,
      lastUpdated: new Date()
    };
  }
}

