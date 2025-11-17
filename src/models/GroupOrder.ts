import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGroupParticipant {
  id: string;
  userId: mongoose.Types.ObjectId;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  quantity: number;
  amount: number;
  paymentStatus: 'paid';
  paymentReference: string;
  paidAt: Date;
  deliveryInfo: {
    address: string;
    city: string;
    state: string;
    phoneNumber: string;
  };
  deliveryFee: number;
  orderId?: mongoose.Types.ObjectId;
  joinedAt: Date;
}

export interface IGroupOrder extends Document {
  groupId: string;
  product: {
    _id: mongoose.Types.ObjectId;
    name: string;
    images: string[];
  };
  totalSlots: number;
  quantityPerSlot: number;
  pricePerSlot: number;
  participants: IGroupParticipant[];
  filledSlots: number;
  status: 'active' | 'confirmed' | 'cancelled';
  confirmedAt?: Date;
  cancelledAt?: Date;
  cancelledReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupOrderModel extends Model<IGroupOrder> {
  generateGroupId(): Promise<string>;
}

const GroupParticipantSchema = new Schema<IGroupParticipant>({
  id: {
    type: String,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['paid'],
    default: 'paid',
    required: true
  },
  paymentReference: {
    type: String,
    required: true
  },
  paidAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  deliveryInfo: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    phoneNumber: { type: String, required: true }
  },
  deliveryFee: {
    type: Number,
    required: true,
    min: 0
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const GroupOrderSchema = new Schema<IGroupOrder>({
  groupId: {
    type: String,
    required: true,
    unique: true
  },
  product: {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: { type: String, required: true },
    images: [{ type: String }]
  },
  totalSlots: {
    type: Number,
    required: true,
    min: 2,
    max: 100
  },
  quantityPerSlot: {
    type: Number,
    required: true,
    min: 1
  },
  pricePerSlot: {
    type: Number,
    required: true,
    min: 0
  },
  participants: {
    type: [GroupParticipantSchema],
    default: []
  },
  filledSlots: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'confirmed', 'cancelled'],
    default: 'active',
    required: true
  },
  confirmedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelledReason: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Indexes
GroupOrderSchema.index({ 'product._id': 1, status: 1 });
GroupOrderSchema.index({ status: 1, createdAt: -1 });
GroupOrderSchema.index({ 'participants.userId': 1 });

// Static method to generate unique group ID
GroupOrderSchema.statics.generateGroupId = async function(): Promise<string> {
  const prefix = 'GRP';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let groupId: string;
  let exists = true;

  while (exists) {
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    groupId = `${prefix}-${suffix}`;

    const existing = await this.findOne({ groupId });
    exists = !!existing;
  }

  return groupId!;
};

// Pre-save validation
GroupOrderSchema.pre('save', function(next) {
  if (this.filledSlots > this.totalSlots) {
    return next(new Error('Filled slots cannot exceed total slots'));
  }

  if (this.participants.length !== this.filledSlots) {
    return next(new Error('Participants count must match filled slots'));
  }

  next();
});

export const GroupOrder = mongoose.model<IGroupOrder, IGroupOrderModel>('GroupOrder', GroupOrderSchema);
