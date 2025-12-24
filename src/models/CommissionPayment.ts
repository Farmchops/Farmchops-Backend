import mongoose, { Document, Schema } from 'mongoose';

export interface ICommissionPayment extends Document {
  marketer: mongoose.Types.ObjectId;

  // Payment period
  periodStart: Date;
  periodEnd: Date;

  // Payment details
  totalOrders: number;
  totalRevenue: number;
  commissionRate: number;
  commissionAmount: number;

  // Payment tracking
  status: 'pending' | 'paid' | 'cancelled';
  paidAt?: Date;
  paidBy?: mongoose.Types.ObjectId;
  paymentMethod?: 'bank_transfer' | 'cash' | 'wallet';
  paymentReference?: string;

  // Order references
  orders: mongoose.Types.ObjectId[];

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const CommissionPaymentSchema = new Schema<ICommissionPayment>({
  marketer: {
    type: Schema.Types.ObjectId,
    ref: 'Marketer',
    required: [true, 'Marketer is required']
  },

  periodStart: {
    type: Date,
    required: [true, 'Period start date is required']
  },

  periodEnd: {
    type: Date,
    required: [true, 'Period end date is required'],
    validate: {
      validator: function(this: ICommissionPayment, value: Date) {
        return value > this.periodStart;
      },
      message: 'Period end must be after period start'
    }
  },

  totalOrders: {
    type: Number,
    required: true,
    min: [0, 'Total orders cannot be negative']
  },

  totalRevenue: {
    type: Number,
    required: true,
    min: [0, 'Total revenue cannot be negative']
  },

  commissionRate: {
    type: Number,
    required: true,
    min: [0, 'Commission rate cannot be negative'],
    max: [100, 'Commission rate cannot exceed 100']
  },

  commissionAmount: {
    type: Number,
    required: true,
    min: [0, 'Commission amount cannot be negative']
  },

  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },

  paidAt: {
    type: Date,
    default: null
  },

  paidBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'wallet'],
    default: null
  },

  paymentReference: {
    type: String,
    trim: true,
    default: null
  },

  orders: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }],

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: null
  }
}, {
  timestamps: true
});

// Indexes
CommissionPaymentSchema.index({ marketer: 1 });
CommissionPaymentSchema.index({ periodStart: 1, periodEnd: 1 });
CommissionPaymentSchema.index({ status: 1 });
CommissionPaymentSchema.index({ createdAt: -1 });

const CommissionPayment = mongoose.model<ICommissionPayment>('CommissionPayment', CommissionPaymentSchema);
export default CommissionPayment;
