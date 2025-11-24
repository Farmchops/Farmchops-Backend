import mongoose, { Document, Schema, Types } from 'mongoose';

// PayLater Application
export interface IPayLaterApplication extends Document {
  userId: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  phoneNumber: string;
  bvn: string;
  nin: string;
  status: 'pending' | 'approved' | 'rejected';
  creditLimit: number | null;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PayLaterApplicationSchema = new Schema<IPayLaterApplication>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  bvn: {
    type: String,
    required: true,
    trim: true
  },
  nin: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  creditLimit: {
    type: Number,
    default: null
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

PayLaterApplicationSchema.index({ userId: 1 });
PayLaterApplicationSchema.index({ status: 1 });
PayLaterApplicationSchema.index({ createdAt: -1 });

export const PayLaterApplication = mongoose.model<IPayLaterApplication>(
  'PayLaterApplication',
  PayLaterApplicationSchema
);

// PayLater Account
export interface IPayLaterAccount extends Document {
  userId: Types.ObjectId;
  applicationId: Types.ObjectId;
  creditLimit: number;
  availableCredit: number;
  hasActiveLoan: boolean;
  activeLoanAmount: number | null;
  activeLoanDueDate: Date | null;
  activeLoanOrderId: Types.ObjectId | null;
  status: 'active' | 'suspended' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const PayLaterAccountSchema = new Schema<IPayLaterAccount>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  applicationId: {
    type: Schema.Types.ObjectId,
    ref: 'PayLaterApplication',
    required: true
  },
  creditLimit: {
    type: Number,
    required: true,
    min: 0
  },
  availableCredit: {
    type: Number,
    required: true,
    min: 0
  },
  hasActiveLoan: {
    type: Boolean,
    default: false
  },
  activeLoanAmount: {
    type: Number,
    default: null
  },
  activeLoanDueDate: {
    type: Date,
    default: null
  },
  activeLoanOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'PayLaterOrder',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active'
  }
}, {
  timestamps: true
});

PayLaterAccountSchema.index({ userId: 1 }, { unique: true });
PayLaterAccountSchema.index({ status: 1 });
PayLaterAccountSchema.index({ hasActiveLoan: 1 });

export const PayLaterAccount = mongoose.model<IPayLaterAccount>(
  'PayLaterAccount',
  PayLaterAccountSchema
);

// PayLater Order
export interface IPayLaterOrderItem {
  productId: Types.ObjectId;
  name: string;
  image: string;
  quantity: number;
  unit: string;
  regularPrice: number;
  paylaterPrice: number;
}

export interface IPayLaterOrder extends Document {
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  orderNumber: string;
  items: IPayLaterOrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    phone: string;
  };
  dueDate: Date;
  repaymentStatus: 'pending' | 'paid' | 'overdue';
  repaidAt: Date | null;
  repaidAmount: number | null;
  repaymentNotes: string | null;
  orderStatus: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const PayLaterOrderSchema = new Schema<IPayLaterOrder>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'PayLaterAccount',
    required: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: { type: String, required: true },
    image: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true },
    regularPrice: { type: Number, required: true },
    paylaterPrice: { type: Number, required: true }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    required: true,
    default: 2500
  },
  totalAmount: {
    type: Number,
    required: true
  },
  deliveryAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    phone: { type: String, required: true }
  },
  dueDate: {
    type: Date,
    required: true
  },
  repaymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  repaidAt: {
    type: Date,
    default: null
  },
  repaidAmount: {
    type: Number,
    default: null
  },
  repaymentNotes: {
    type: String,
    default: null
  },
  orderStatus: {
    type: String,
    enum: ['processing', 'shipped', 'delivered', 'cancelled'],
    default: 'processing'
  }
}, {
  timestamps: true
});

PayLaterOrderSchema.index({ userId: 1, createdAt: -1 });
PayLaterOrderSchema.index({ accountId: 1 });
PayLaterOrderSchema.index({ orderNumber: 1 }, { unique: true });
PayLaterOrderSchema.index({ repaymentStatus: 1 });
PayLaterOrderSchema.index({ dueDate: 1 });

export const PayLaterOrder = mongoose.model<IPayLaterOrder>(
  'PayLaterOrder',
  PayLaterOrderSchema
);

// PayLater Cart
export interface IPayLaterCartItem {
  productId: Types.ObjectId;
  name: string;
  image: string;
  quantity: number;
  unit: string;
  regularPrice: number;
  paylaterPrice: number;
}

export interface IPayLaterCart extends Document {
  userId: Types.ObjectId;
  items: IPayLaterCartItem[];
  updatedAt: Date;
}

const PayLaterCartSchema = new Schema<IPayLaterCart>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: { type: String, required: true },
    image: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true },
    regularPrice: { type: Number, required: true },
    paylaterPrice: { type: Number, required: true }
  }]
}, {
  timestamps: true
});

PayLaterCartSchema.index({ userId: 1 }, { unique: true });

export const PayLaterCart = mongoose.model<IPayLaterCart>(
  'PayLaterCart',
  PayLaterCartSchema
);

// PayLater Settings
export interface IPayLaterSettings extends Document {
  markupPercentage: number;
  defaultRepaymentDays: number;
  minCreditLimit: number;
  maxCreditLimit: number;
  deliveryFee: number;
  updatedBy: Types.ObjectId | null;
  updatedAt: Date;
}

const PayLaterSettingsSchema = new Schema<IPayLaterSettings>({
  markupPercentage: {
    type: Number,
    required: true,
    default: 10
  },
  defaultRepaymentDays: {
    type: Number,
    required: true,
    default: 30
  },
  minCreditLimit: {
    type: Number,
    required: true,
    default: 50000
  },
  maxCreditLimit: {
    type: Number,
    required: true,
    default: 500000
  },
  deliveryFee: {
    type: Number,
    required: true,
    default: 2500
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

export const PayLaterSettings = mongoose.model<IPayLaterSettings>(
  'PayLaterSettings',
  PayLaterSettingsSchema
);
