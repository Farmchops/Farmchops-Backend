// src/models/User.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'customer' | 'admin';
  profile: {
    address?: string;
    dateOfBirth?: Date;
    isVerified: boolean;
  };
  wallet: {
    balance: number;
  };
  emailVerificationCode?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  adminRole?: 'super_admin' | 'inventory_officer' | 'operations_officer' |
              'logistics' | 'customer_support' | 'finance' | 'admin' | 'rider';
  permissions: string[];
  isActive: boolean;
  invitedBy?: mongoose.Types.ObjectId;

  // Referral tracking
  referredBy?: mongoose.Types.ObjectId;
  referralCode?: string;
  referralDate?: Date;

  // First order tracking (for marketer commission - FIRST ORDER ONLY)
  hasPlacedFirstOrder: boolean;

  // First-time discount tracking
  hasUsedFirstTimeDiscount: boolean;
  firstTimeDiscountUsedAt?: Date;
  firstTimeDiscountOrderId?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): any;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  password: {
    type: String,
    required: function(this: IUser) {
      return this.profile?.isVerified === true;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },

  firstName: {
    type: String,
    required: false, 
    trim: true,
  },
  
  lastName: {
    type: String,
    required: false, 
    trim: true,
  },
  
  phone: {
    type: String,
    required: false,
    trim: true,
  },
  
  role: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer'
  },

  adminRole: {
    type: String,
    enum: ['super_admin', 'inventory_officer', 'operations_officer', 'logistics',
           'customer_support', 'finance', 'admin', 'rider'],
    required: function(this: IUser) {
      return this.role === 'admin';
    }
  },
  
  permissions: {
    type: [String],
    default: []
  },
  
  isActive: {
    type: Boolean,
    default: true  
  },
  
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  emailVerificationCode: {
    type: String,
    select: false
  },

  emailVerificationExpires: {
    type: Date,
    select: false
  },
  
  passwordResetToken: {
    type: String,
    select: false
  },
  
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  profile: {
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    },
    dateOfBirth: {
      type: Date
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },

  wallet: {
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative']
    }
  },

  // Referral tracking
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: 'Marketer',
    default: null
  },

  referralCode: {
    type: String,
    default: null
  },

  referralDate: {
    type: Date,
    default: null
  },

  // First order tracking (for marketer commission - FIRST ORDER ONLY)
  hasPlacedFirstOrder: {
    type: Boolean,
    default: false
  },

  // First-time discount tracking
  hasUsedFirstTimeDiscount: {
    type: Boolean,
    default: false
  },

  firstTimeDiscountUsedAt: {
    type: Date,
    default: null
  },

  firstTimeDiscountOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ adminRole: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ referredBy: 1 });
UserSchema.index({ hasPlacedFirstOrder: 1 });
UserSchema.index({ hasUsedFirstTimeDiscount: 1 });

const User = mongoose.model<IUser>("User", UserSchema);
export default User;