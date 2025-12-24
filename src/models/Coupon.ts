import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  description: string;

  // Discount configuration
  discountType: 'percentage' | 'fixed_amount' | 'free_delivery';
  discountValue: number;
  maxDiscountAmount?: number;

  // Usage rules
  minOrderAmount?: number;
  maxUsesTotal?: number;
  maxUsesPerUser: number;
  currentUses: number;

  // Validity
  validFrom?: Date;
  validUntil?: Date;
  status: 'active' | 'inactive' | 'expired';

  // Tracking
  createdBy: mongoose.Types.ObjectId;
  usedBy: mongoose.Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [6, 'Coupon code must be at least 6 characters'],
    maxlength: [12, 'Coupon code cannot exceed 12 characters'],
    match: [/^[A-Z0-9]+$/, 'Coupon code must contain only uppercase letters and numbers']
  },

  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  discountType: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_delivery'],
    required: [true, 'Discount type is required']
  },

  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value must be positive'],
    validate: {
      validator: function(this: ICoupon, value: number) {
        if (this.discountType === 'percentage') {
          return value >= 1 && value <= 100;
        }
        return value > 0;
      },
      message: 'Invalid discount value for the selected type'
    }
  },

  maxDiscountAmount: {
    type: Number,
    default: null,
    min: [0, 'Max discount amount must be positive']
  },

  minOrderAmount: {
    type: Number,
    default: null,
    min: [0, 'Minimum order amount must be positive']
  },

  maxUsesTotal: {
    type: Number,
    default: null,
    min: [1, 'Max uses total must be at least 1']
  },

  maxUsesPerUser: {
    type: Number,
    default: 1,
    min: [1, 'Max uses per user must be at least 1']
  },

  currentUses: {
    type: Number,
    default: 0,
    min: 0
  },

  validFrom: {
    type: Date,
    default: null
  },

  validUntil: {
    type: Date,
    default: null
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active'
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  usedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// Note: code index is auto-created by unique: true in schema
CouponSchema.index({ status: 1 });
CouponSchema.index({ validUntil: 1 });
CouponSchema.index({ usedBy: 1 });

// Pre-save hook to ensure code is uppercase
CouponSchema.pre<ICoupon>('save', function(next) {
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

// Virtual to check if coupon is expired
CouponSchema.virtual('isExpired').get(function(this: ICoupon) {
  if (!this.validUntil) return false;
  return new Date() > this.validUntil;
});

// Virtual to check if usage limit reached
CouponSchema.virtual('isLimitReached').get(function(this: ICoupon) {
  if (!this.maxUsesTotal) return false;
  return this.currentUses >= this.maxUsesTotal;
});

const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);
export default Coupon;
