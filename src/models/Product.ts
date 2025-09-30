import mongoose, { Document, Schema } from 'mongoose';

type ProductStatus = 'active' | 'inactive' | 'out_of_stock';

export interface IProduct extends Document {
  status: ProductStatus;
  name: string;
  description: string;
  images: string[];
  category: mongoose.Types.ObjectId; // Reference to Category schema
  
  // Dual Pricing Structure - Core Feature
  pricing: {
    retail: {
      price: number; 
      unit: string; // e.g., "per kg", "per piece"
      minQuantity: number;
    };
    bulk: {
      price: number; 
      unit: string; // e.g., "per 25kg bag", "per crate"
      minQuantity: number;
    };
  };
  
  // Simple Inventory Management
  inventory: {
    availableStock: number;
    lowStockThreshold: number;
    unit: string; // base unit (kg, pieces, bags, etc.)
  };
  


  // For Search & SEO
  tags: string[];
  slug: string;
  
  // Basic Analytics for Admin Dashboard
  stats: {
    viewCount: { type: Number; default: 0 };
    orderCount: { type: Number; default: 0 };
    totalSold: { type: Number; default: 0 }; // total quantity sold
  };
  
  // Timestamps
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
    maxlength: [500, 'Description cannot exceed 500 characters'] // Shorter for MVP
  },
  
  images: {
  type: [String], // Change from [{type: String}] to just [String]
  default: [],
  validate: {
    validator: function(arr: string[]) {
      return arr.length <= 5; // Remove the > 0 check (makes it optional)
    },
    message: 'Product can have maximum 5 images'
  }
},
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  
  // Dual Pricing - Core MVP Feature
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
    bulk: {
      price: {
        type: Number,
        required: [true, 'Bulk price is required'],
        min: [1, 'Price must be at least 1 kobo']
      },
      unit: {
        type: String,
        required: [true, 'Bulk unit is required'],
        trim: true,
        maxlength: [20, 'Unit description too long']
      },
      minQuantity: {
        type: Number,
        required: [true, 'Minimum bulk quantity is required'],
        min: [1, 'Minimum quantity must be at least 1']
      }
    }
  },
  
  // Simplified Inventory
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
  
  // Simple Analytics for Admin Dashboard
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

// Essential Indexes for MVP Performance
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ name: 'text', description: 'text' }); // Search functionality
ProductSchema.index({ 'stats.orderCount': -1 }); // Popular products

// Virtual: Check if low stock (for admin alerts)
ProductSchema.virtual('isLowStock').get(function(this: IProduct) {
  return this.inventory.availableStock <= this.inventory.lowStockThreshold;
});

// Virtual: Calculate bulk savings for frontend display
ProductSchema.virtual('bulkSavings').get(function(this: IProduct) {
  const retailPerUnit = this.pricing.retail.price / this.pricing.retail.minQuantity;
  const bulkPerUnit = this.pricing.bulk.price / this.pricing.bulk.minQuantity;
  
  const savings = retailPerUnit - bulkPerUnit;
  const savingsPercent = savings > 0 ? Math.round((savings / retailPerUnit) * 100) : 0;
  
  return {
    amount: Math.max(0, savings),
    percentage: savingsPercent
  };
});

// Pre-save: Auto-generate slug and update stock status
ProductSchema.pre<IProduct>('validate', function(next) {
  if (this.pricing.bulk.price >= this.pricing.retail.price) {
    next(new Error('Bulk price must be less than retail price'));
  } else {
    next();
  }
  // Auto-update status based on stock
  if (this.inventory.availableStock <= 0) {
    this.set('status', 'out_of_stock');
  } else if (this.get('status') === 'out_of_stock' && this.inventory.availableStock > 0) {
    this.set('status', 'active');
  }
  
  next();
});

// Method: Update stock when order is placed (for wallet/pay-later orders)
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
  const minQty = orderType === 'retail' ? this.pricing.retail.minQuantity : this.pricing.bulk.minQuantity;
  
  return quantity >= minQty && this.inventory.availableStock >= quantity && this.status === 'active';
};

export const Product = mongoose.model<IProduct>('Product', ProductSchema);