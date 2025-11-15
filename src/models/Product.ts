import mongoose, { Document, Schema } from 'mongoose';

type ProductStatus = 'active' | 'inactive' | 'out_of_stock' | 'draft';

export interface IProduct extends Document {
  status: ProductStatus;
  name: string;
  description: string;
  images: string[];
  category: mongoose.Types.ObjectId;

  pricing: {
    retail: {
      price: number;
      unit: string;
      minQuantity: number;
    };
    bulkTiers?: Array<{
      name: string;
      price: number;
      unit: string;
      minQuantity: number;
    }>;
  };

  inventory: {
    availableStock: number;
    lowStockThreshold: number;
    unit: string;
  };

  groupBuyingEnabled: boolean;
  groupConfig?: {
    totalSlots: number;
    quantityPerSlot: number;
    pricePerSlot: number;
    maxActiveGroups: number;
  };

  tags: string[];
  slug: string;

  stats: {
    viewCount: number;
    orderCount: number;
    totalSold: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  images: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr: string[]) {
        return arr.length <= 5;
      },
      message: 'Product can have maximum 5 images'
    }
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  
  pricing: {
    retail: {
      price: {
        type: Number,
        required: [true, 'Retail price is required'],
        min: [1, 'Price must be at least 1 kobo']
      },
      unit: {
        type: String,
        required: [true, 'Retail unit is required'],
        trim: true,
        maxlength: [20, 'Unit description too long']
      },
      minQuantity: {
        type: Number,
        required: [true, 'Minimum retail quantity is required'],
        min: [1, 'Minimum quantity must be at least 1']
      }
    },
    bulkTiers: [{
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [50, 'Tier name too long']
      },
      price: {
        type: Number,
        required: true,
        min: [1, 'Price must be at least 1 kobo']
      },
      unit: {
        type: String,
        required: true,
        trim: true,
        maxlength: [20, 'Unit description too long']
      },
      minQuantity: {
        type: Number,
        required: true,
        min: [1, 'Minimum quantity must be at least 1']
      }
    }],
    default: []
  },
  
  inventory: {
    availableStock: {
      type: Number,
      required: [true, 'Available stock is required'],
      min: [0, 'Stock cannot be negative']
    },
    lowStockThreshold: {
      type: Number,
      required: [true, 'Low stock threshold is required'],
      min: [0, 'Threshold cannot be negative'],
      default: 10
    },
    unit: {
      type: String,
      required: [true, 'Inventory unit is required'],
      trim: true
    }
  },

  groupBuyingEnabled: {
    type: Boolean,
    default: false
  },

  groupConfig: {
    totalSlots: {
      type: Number,
      min: [2, 'Group must have at least 2 slots'],
      max: [100, 'Group cannot have more than 100 slots']
    },
    quantityPerSlot: {
      type: Number,
      min: [1, 'Quantity per slot must be at least 1']
    },
    pricePerSlot: {
      type: Number,
      min: [1, 'Price per slot must be at least 1 kobo']
    },
    maxActiveGroups: {
      type: Number,
      min: [1, 'Must allow at least 1 active group'],
      max: [50, 'Cannot have more than 50 active groups'],
      default: 5
    }
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'out_of_stock'],
    default: 'draft'
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [30, 'Tag too long']
  }],
  
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  stats: {
    viewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    orderCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSold: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ 'stats.orderCount': -1 });

// Virtual: Check if low stock
ProductSchema.virtual('isLowStock').get(function(this: IProduct) {
  return this.inventory.availableStock <= this.inventory.lowStockThreshold;
});

// Virtual: Calculate bulk savings (best tier)
ProductSchema.virtual('bulkSavings').get(function(this: IProduct) {
  if (!this.pricing.bulkTiers || this.pricing.bulkTiers.length === 0) {
    return null;
  }

  const retailPerUnit = this.pricing.retail.price / this.pricing.retail.minQuantity;
  
  // Find the cheapest bulk tier
  const cheapestTier = this.pricing.bulkTiers.reduce((min, tier) => {
    const tierPerUnit = tier.price / tier.minQuantity;
    const minPerUnit = min.price / min.minQuantity;
    return tierPerUnit < minPerUnit ? tier : min;
  });
  
  const bulkPerUnit = cheapestTier.price / cheapestTier.minQuantity;
  const savings = retailPerUnit - bulkPerUnit;
  const savingsPercent = savings > 0 ? Math.round((savings / retailPerUnit) * 100) : 0;
  
  return {
    amount: Math.max(0, savings),
    percentage: savingsPercent,
    tierName: cheapestTier.name
  };
});

// Validate hook
ProductSchema.pre<IProduct>('validate', function(next) {
  // Generate slug
  if (this.isNew || this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-');
  }

  // Validate bulk tiers if they exist
  if (this.pricing.bulkTiers && this.pricing.bulkTiers.length > 0) {
    for (const tier of this.pricing.bulkTiers) {
      if (tier.price >= this.pricing.retail.price) {
        next(new Error(`Bulk tier "${tier.name}" price must be less than retail price`));
        return;
      }
    }
  }
  
  // Auto-update status based on stock
  if (this.inventory.availableStock <= 0) {
    this.set('status', 'out_of_stock');
  } else if (this.get('status') === 'out_of_stock' && this.inventory.availableStock > 0) {
    this.set('status', 'active');
  }
  
  next();
});

// Method: Update stock when order is placed
ProductSchema.methods.updateStock = function(quantityOrdered: number, operation: 'decrease' | 'increase') {
  if (operation === 'decrease') {
    this.inventory.availableStock = Math.max(0, this.inventory.availableStock - quantityOrdered);
    this.stats.orderCount += 1;
    this.stats.totalSold += quantityOrdered;
  } else {
    this.inventory.availableStock += quantityOrdered;
    this.stats.orderCount = Math.max(0, this.stats.orderCount - 1);
    this.stats.totalSold = Math.max(0, this.stats.totalSold - quantityOrdered);
  }
  
  return this.save();
};

// Method: Check if quantity is available for ordering
ProductSchema.methods.canFulfillOrder = function(quantity: number, orderType: 'retail' | 'bulk'): boolean {
  const minQty = orderType === 'retail' ? this.pricing.retail.minQuantity : this.pricing.bulkTiers?.[0]?.minQuantity || 0;
  
  return quantity >= minQty && this.inventory.availableStock >= quantity && this.status === 'active';
};

export const Product = mongoose.model<IProduct>('Product', ProductSchema);