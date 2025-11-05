import mongoose, { Document, Model, Schema } from 'mongoose';

export type DealStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'sold_out'
  | 'ended'
  | 'cancelled';

export interface IDeal extends Document {
  title: string;
  product: mongoose.Types.ObjectId;
  dealPrice?: number;
  discountPercentage?: number;
  maxUnits: number;
  perUserLimit: number;
  startAt: Date;
  endAt: Date;
  status: DealStatus;
  soldUnits: number;
  reservedUnits: number;
  description?: string;
  heroImage?: string;
  isFeatured: boolean;
  createdBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDealModel extends Model<IDeal> {
  determineStatus(payload: {
    startAt: Date;
    endAt: Date;
    soldUnits?: number;
    maxUnits: number;
    status?: DealStatus;
  }): DealStatus;
}

const DealSchema = new Schema<IDeal, IDealModel>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  dealPrice: {
    type: Number,
    min: [0, 'Deal price cannot be negative']
  },
  discountPercentage: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100']
  },
  maxUnits: {
    type: Number,
    required: true,
    min: [1, 'Max units must be at least 1']
  },
  perUserLimit: {
    type: Number,
    default: 1,
    min: [1, 'Per user limit must be at least 1']
  },
  startAt: {
    type: Date,
    required: true
  },
  endAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'paused', 'sold_out', 'ended', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  soldUnits: {
    type: Number,
    default: 0,
    min: 0
  },
  reservedUnits: {
    type: Number,
    default: 0,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  heroImage: {
    type: String,
    trim: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date
}, {
  timestamps: true
});

DealSchema.index({ status: 1, startAt: 1 });
DealSchema.index({ startAt: 1, endAt: 1 });
DealSchema.index({ isFeatured: 1 });

DealSchema.statics.determineStatus = function({ startAt, endAt, soldUnits = 0, maxUnits, status }: {
  startAt: Date;
  endAt: Date;
  soldUnits?: number;
  maxUnits: number;
  status?: DealStatus;
}): DealStatus {
  if (status === 'cancelled') {
    return 'cancelled';
  }
  const now = new Date();
  if (status === 'paused') {
    if (soldUnits >= maxUnits) {
      return 'sold_out';
    }
    if (now > endAt) {
      return 'ended';
    }
    return 'paused';
  }

  if (now < startAt) {
    return 'scheduled';
  }
  if (soldUnits >= maxUnits) {
    return 'sold_out';
  }
  if (now >= startAt && now <= endAt) {
    return 'active';
  }
  return now > endAt ? 'ended' : 'scheduled';
};

export const Deal = mongoose.model<IDeal, IDealModel>('Deal', DealSchema);
