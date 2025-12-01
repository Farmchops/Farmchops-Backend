import mongoose, { Document, Schema, Model } from 'mongoose';

// Participant in the group (can be reserved or paid)
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

  // Participant status
  status: 'reserved' | 'paid' | 'removed';

  // Timestamps
  reservedAt: Date;
  paidAt?: Date;
  checkoutDeadline?: Date;
  removedAt?: Date;

  // Payment details (only after checkout)
  paymentReference?: string;
  deliveryInfo?: {
    address: string;
    city: string;
    state: string;
    phoneNumber: string;
  };
  deliveryFee?: number;
  orderId?: mongoose.Types.ObjectId;
}

// Waitlist participant
export interface IWaitlistParticipant {
  userId: mongoose.Types.ObjectId;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  quantity: number;
  joinedAt: Date;
  notifiedAt?: Date;
  promotionDeadline?: Date; // 24 hours to checkout after promotion
}

export interface IGroupOrder extends Document {
  groupId: string;

  // Product info
  product: {
    _id: mongoose.Types.ObjectId;
    name: string;
    images: string[];
  };

  // Configuration from admin
  minParticipants: number;
  maxParticipants: number;
  quantityPerPerson: {
    min: number;
    max: number;
  };
  targetQuantity: number; // e.g., 50kg total
  bulkPricePerUnit: number; // e.g., ₦500/kg
  deadlineHours: number; // Hours from creation before group expires (e.g., 168 = 7 days)
  maxActiveGroups: number; // How many groups can be active for this product

  // Phase tracking
  phase: 'filling' | 'checkout_window' | 'confirmed' | 'expired' | 'cancelled';

  // Checkout window (48 hours after group fills)
  checkoutWindowOpensAt?: Date;
  checkoutWindowClosesAt?: Date;
  checkoutWindowDurationHours: number; // Default: 48 hours

  // Participants
  participants: IGroupParticipant[];
  reservedSlots: number; // Count of 'reserved' participants
  paidSlots: number; // Count of 'paid' participants

  // Waitlist
  waitlist: IWaitlistParticipant[];

  // Shareable link
  shareableCode: string;

  // Status tracking
  fillWindowExpiresAt?: Date; // When the filling window expires (createdAt + deadlineHours)
  groupFilledAt?: Date; // When minimum participants was reached
  confirmedAt?: Date; // When all participants paid
  expiredAt?: Date; // When deadline passed
  cancelledAt?: Date;
  cancelledReason?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Methods
  getTotalQuantity(): number;
  getReservedCount(): number;
  getPaidCount(): number;
  canAcceptMoreParticipants(): boolean;
  isGroupFilled(): boolean;
  shouldOpenCheckoutWindow(): boolean;
  isCheckoutWindowOpen(): boolean;
  isCheckoutWindowExpired(): boolean;
  getShareableLink(): string;
}

export interface IGroupOrderModel extends Model<IGroupOrder> {
  generateGroupId(): Promise<string>;
  generateShareableCode(): string;
}

const WaitlistParticipantSchema = new Schema<IWaitlistParticipant>({
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
  joinedAt: {
    type: Date,
    default: Date.now
  },
  notifiedAt: {
    type: Date
  },
  promotionDeadline: {
    type: Date
  }
}, { _id: false });

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
  status: {
    type: String,
    enum: ['reserved', 'paid', 'removed'],
    default: 'reserved',
    required: true
  },
  reservedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  paidAt: {
    type: Date
  },
  checkoutDeadline: {
    type: Date
  },
  removedAt: {
    type: Date
  },
  paymentReference: {
    type: String
  },
  deliveryInfo: {
    address: { type: String },
    city: { type: String },
    state: { type: String },
    phoneNumber: { type: String }
  },
  deliveryFee: {
    type: Number,
    min: 0
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
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
  minParticipants: {
    type: Number,
    required: true,
    min: 2,
    default: 5
  },
  maxParticipants: {
    type: Number,
    required: true,
    min: 2,
    max: 100,
    default: 10
  },
  quantityPerPerson: {
    min: {
      type: Number,
      required: true,
      default: 5
    },
    max: {
      type: Number,
      required: true,
      default: 15
    }
  },
  targetQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  bulkPricePerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  deadlineHours: {
    type: Number,
    required: true,
    default: 168 // 7 days
  },
  maxActiveGroups: {
    type: Number,
    required: true,
    default: 3
  },
  phase: {
    type: String,
    enum: ['filling', 'checkout_window', 'confirmed', 'expired', 'cancelled'],
    default: 'filling',
    required: true
  },
  checkoutWindowOpensAt: {
    type: Date
  },
  checkoutWindowClosesAt: {
    type: Date
  },
  checkoutWindowDurationHours: {
    type: Number,
    required: true,
    default: 48
  },
  participants: {
    type: [GroupParticipantSchema],
    default: []
  },
  reservedSlots: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  paidSlots: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  waitlist: {
    type: [WaitlistParticipantSchema],
    default: []
  },
  shareableCode: {
    type: String,
    required: true,
    unique: true
  },
  fillWindowExpiresAt: {
    type: Date
  },
  groupFilledAt: {
    type: Date
  },
  confirmedAt: {
    type: Date
  },
  expiredAt: {
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

// Indexes (shareableCode already has unique: true, no need for separate index)
GroupOrderSchema.index({ 'product._id': 1, phase: 1 });
GroupOrderSchema.index({ phase: 1, createdAt: -1 });
GroupOrderSchema.index({ 'participants.userId': 1 });
GroupOrderSchema.index({ checkoutWindowClosesAt: 1 });

// Instance methods
GroupOrderSchema.methods.getTotalQuantity = function(): number {
  return this.participants
    .filter((p: IGroupParticipant) => p.status !== 'removed')
    .reduce((sum: number, p: IGroupParticipant) => sum + p.quantity, 0);
};

GroupOrderSchema.methods.getReservedCount = function(): number {
  return this.participants.filter((p: IGroupParticipant) => p.status === 'reserved').length;
};

GroupOrderSchema.methods.getPaidCount = function(): number {
  return this.participants.filter((p: IGroupParticipant) => p.status === 'paid').length;
};

GroupOrderSchema.methods.canAcceptMoreParticipants = function(): boolean {
  const activeParticipants = this.participants.filter((p: IGroupParticipant) => p.status !== 'removed').length;
  return activeParticipants < this.maxParticipants && this.phase === 'filling';
};

GroupOrderSchema.methods.isGroupFilled = function(): boolean {
  const activeParticipants = this.participants.filter((p: IGroupParticipant) => p.status !== 'removed').length;
  return activeParticipants >= this.minParticipants;
};

GroupOrderSchema.methods.shouldOpenCheckoutWindow = function(): boolean {
  return this.isGroupFilled() && this.phase === 'filling' && !this.checkoutWindowOpensAt;
};

GroupOrderSchema.methods.isCheckoutWindowOpen = function(): boolean {
  if (!this.checkoutWindowOpensAt || !this.checkoutWindowClosesAt) {
    return false;
  }
  const now = new Date();
  return now >= this.checkoutWindowOpensAt && now <= this.checkoutWindowClosesAt;
};

GroupOrderSchema.methods.isCheckoutWindowExpired = function(): boolean {
  if (!this.checkoutWindowClosesAt) {
    return false;
  }
  return new Date() > this.checkoutWindowClosesAt;
};

GroupOrderSchema.methods.getShareableLink = function(): string {
  return `${process.env.FRONTEND_URL}/group-buy/${this.shareableCode}`;
};

// Static methods
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

GroupOrderSchema.statics.generateShareableCode = function(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Pre-save validation
GroupOrderSchema.pre('save', function(next) {
  // Update counts
  this.reservedSlots = this.getReservedCount();
  this.paidSlots = this.getPaidCount();

  // Validate participant counts
  const activeParticipants = this.participants.filter(p => p.status !== 'removed').length;
  if (activeParticipants > this.maxParticipants) {
    return next(new Error('Active participants cannot exceed maximum participants'));
  }

  next();
});

export const GroupOrder = mongoose.model<IGroupOrder, IGroupOrderModel>('GroupOrder', GroupOrderSchema);
