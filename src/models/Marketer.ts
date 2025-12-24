import mongoose, { Document, Schema } from 'mongoose';

export interface IMarketer extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  marketingCode: string;
  status: 'active' | 'inactive' | 'suspended';
  commissionRate: number;

  // Stats (updated automatically)
  totalSignups: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;

  // Commission payment tracking
  lastPaidAt?: Date;
  lastPaidAmount: number;
  unpaidCommission: number;

  // Admin tracking
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Optional user account link
  userId?: mongoose.Types.ObjectId;
}

const MarketerSchema = new Schema<IMarketer>({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [1, 'First name must be at least 1 character'],
    maxlength: [100, 'First name cannot exceed 100 characters']
  },

  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [1, 'Last name must be at least 1 character'],
    maxlength: [100, 'Last name cannot exceed 100 characters']
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },

  marketingCode: {
    type: String,
    required: [true, 'Marketing code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [6, 'Marketing code must be at least 6 characters'],
    maxlength: [12, 'Marketing code cannot exceed 12 characters'],
    match: [/^[A-Z0-9]+$/, 'Marketing code must contain only uppercase letters and numbers']
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },

  commissionRate: {
    type: Number,
    required: true,
    default: 10,
    min: [0, 'Commission rate cannot be negative'],
    max: [100, 'Commission rate cannot exceed 100']
  },

  // Stats
  totalSignups: {
    type: Number,
    default: 0,
    min: 0
  },

  totalOrders: {
    type: Number,
    default: 0,
    min: 0
  },

  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  },

  totalCommission: {
    type: Number,
    default: 0,
    min: 0
  },

  // Payment tracking
  lastPaidAt: {
    type: Date,
    default: null
  },

  lastPaidAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  unpaidCommission: {
    type: Number,
    default: 0,
    min: 0
  },

  // Admin tracking
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Optional user account
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// Note: marketingCode and email indexes are auto-created by unique: true in schema
MarketerSchema.index({ status: 1 });
MarketerSchema.index({ createdAt: -1 });

// Virtual for full name
MarketerSchema.virtual('fullName').get(function(this: IMarketer) {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save hook to ensure marketingCode is uppercase
MarketerSchema.pre<IMarketer>('save', function(next) {
  if (this.marketingCode) {
    this.marketingCode = this.marketingCode.toUpperCase();
  }
  next();
});

const Marketer = mongoose.model<IMarketer>('Marketer', MarketerSchema);
export default Marketer;
