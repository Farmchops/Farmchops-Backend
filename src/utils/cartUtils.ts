import { Product, IProduct } from '../models/Product';
import { Cart, CartItem, CartValidationResult } from '../types/cart';

export class CartUtils {
  /**
   * Find the optimal bulk tier for a given quantity
   */
  static getOptimalBulkTier(product: IProduct, quantity: number) {
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
  }

  /**
   * Get price info for a given quantity
   */
  static getPriceForQuantity(product: IProduct, quantity: number): { 
    price: number; 
    unit: string; 
    priceType: 'retail' | 'bulk';
    tierName?: string;
  } {
    const bulkTier = this.getOptimalBulkTier(product, quantity);
    
    if (bulkTier) {
      return {
        price: bulkTier.price,
        unit: bulkTier.unit,
        priceType: 'bulk',
        tierName: bulkTier.name
      };
    }

    return {
      price: product.pricing.retail.price,
      unit: product.pricing.retail.unit,
      priceType: 'retail'
    };
  }

  /**
   * Calculate item total price
   */
  static calculateItemPrice(product: IProduct, quantity: number): number {
    const { price } = this.getPriceForQuantity(product, quantity);
    return price * quantity;
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
        if (item.quantity > product.inventory.availableStock) {
          if (product.inventory.availableStock > 0) {
            warnings.push(`"${product.name}" quantity reduced from ${item.quantity} to ${product.inventory.availableStock} (limited stock)`);
            item.quantity = product.inventory.availableStock;
            hasChanges = true;
          } else {
            errors.push(`"${product.name}" is out of stock`);
            hasChanges = true;
            continue;
          }
        }

        // Get optimal pricing for current quantity
        const priceInfo = this.getPriceForQuantity(product, item.quantity);
        const newUnitPrice = priceInfo.price;
        const newPriceType = priceInfo.priceType;
        const newTotalPrice = this.calculateItemPrice(product, item.quantity);

        // Check if price type changed
        if (item.priceType !== newPriceType) {
          if (newPriceType === 'bulk' && priceInfo.tierName) {
            warnings.push(`"${product.name}" now qualifies for bulk pricing: ${priceInfo.tierName}`);
          }
          hasChanges = true;
        }

        // Check if price changed
        if (item.unitPrice !== newUnitPrice) {
          const oldPrice = item.unitPrice;
          warnings.push(`Price updated for "${product.name}": ₦${oldPrice.toLocaleString()} → ₦${newUnitPrice.toLocaleString()}`);
          hasChanges = true;
        }

        // Get min bulk quantity (lowest tier if bulk tiers exist)
        const minBulkQuantity = product.pricing.bulkTiers && product.pricing.bulkTiers.length > 0
          ? Math.min(...product.pricing.bulkTiers.map(tier => tier.minQuantity))
          : undefined;

        // Update item with current data
        const updatedItem: CartItem = {
          ...item,
          name: product.name,
          image: product.images[0] || '',
          unitPrice: newUnitPrice,
          totalPrice: newTotalPrice,
          priceType: newPriceType,
          stock: product.inventory.availableStock,
          minBulkQuantity: minBulkQuantity
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