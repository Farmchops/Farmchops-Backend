import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IPaymentLink extends Document {
  code: string;
  createdBy: Types.ObjectId;
  orderId?: Types.ObjectId;
  amount: number;
  description: string;
  recipientName?: string;
  recipientPhone?: string;
  status: 'active' | 'paid' | 'expired' | 'cancelled';
  expiresAt: Date;
  paidBy?: {
    name: string;
    email: string;
    phone?: string;
  };
  paidAt?: Date;
  paymentReference?: string;
  paymentMethod?: 'paystack' | 'wallet';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentLinkModel extends Model<IPaymentLink> {
  generateUniqueCode(): Promise<string>;
}

const PaymentLinkSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator user ID is required']
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },

  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [100, 'Amount must be at least ₦100']
  },

  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  recipientName: {
    type: String,
    trim: true
  },

  recipientPhone: {
    type: String,
    trim: true
  },

  status: {
    type: String,
    enum: ['active', 'paid', 'expired', 'cancelled'],
    default: 'active'
  },

  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days default
  },

  paidBy: {
    name: String,
    email: String,
    phone: String
  },

  paidAt: {
    type: Date
  },

  paymentReference: {
    type: String
  },

  paymentMethod: {
    type: String,
    enum: ['paystack', 'wallet']
  },

  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
PaymentLinkSchema.index({ code: 1 }, { unique: true });
PaymentLinkSchema.index({ createdBy: 1, createdAt: -1 });
PaymentLinkSchema.index({ orderId: 1 });
PaymentLinkSchema.index({ status: 1, expiresAt: 1 });
PaymentLinkSchema.index({ paymentReference: 1 });

// Static method to generate unique code
PaymentLinkSchema.statics.generateUniqueCode = async function(): Promise<string> {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar chars (0,O,1,I)
  let code: string;
  let exists = true;

  while (exists) {
    code = 'PAY-';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const existing = await this.findOne({ code });
    exists = !!existing;
  }

  return code!;
};

// Virtual to check if link is expired
PaymentLinkSchema.virtual('isExpired').get(function() {
  return this.status === 'active' && new Date() > this.expiresAt;
});

// Pre-save middleware to auto-expire links
PaymentLinkSchema.pre('save', function(next) {
  if (this.status === 'active' && new Date() > this.expiresAt) {
    this.status = 'expired';
  }
  next();
});

export const PaymentLink = mongoose.model<IPaymentLink, IPaymentLinkModel>(
  'PaymentLink',
  PaymentLinkSchema
);
