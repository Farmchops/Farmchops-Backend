import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';
import { WalletTransaction } from './WalletTransaction';
import { Deal, IDeal } from './Deal';
import { DealRedemption } from './DealRedemption';

interface IOrderItem {
    product: mongoose.Types.ObjectId;
    productName: string;
    quantity: number;
    priceType: 'retail' | 'bulk';
    unitPrice: number;
    totalPrice: number;
    deal?: mongoose.Types.ObjectId;
}

export type OrderStatus =
    | 'pending_payment'
    | 'ready_for_processing'
    | 'processing'
    | 'ready_for_dispatch'
    | 'awaiting_pickup'
    | 'en_route'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'failed_delivery';

export type OrderStageOwner = 'system' | 'processing' | 'logistics' | 'rider' | 'support';

export interface OrderStatusHistoryEntry {
    status: OrderStatus;
    timestamp?: Date;
    note?: string;
    updatedBy?: mongoose.Types.ObjectId;
    updatedByName?: string;
    role?: string;
    metadata?: Record<string, any>;
}

export interface IOrder extends Document {

    orderNumber: string;
    user: mongoose.Types.ObjectId;

    // order Items
    items: IOrderItem[];

    // Virtuals
    totalItems?: number;

    subtotal: number;
    deliveryFee: number;
    totalAmount: number;

    paymentMethod: 'wallet' | 'pay_later' | 'paystack'
    paymentStatus: 'pending' | 'paid' | 'failed';
    orderStatus: OrderStatus;
    currentStageOwnerRole: OrderStageOwner;

    walletTransaction?: mongoose.Types.ObjectId;
    paymentReference?: string;
    paymentProvider?: 'paystack'
    providerResponse?: any;

    payLaterInfo?: {
        dueDate: Date;
        amountDue: number;
        isPaid: boolean;
        repaymentTransactions: mongoose.Types.ObjectId[];
    };

    groupOrder?: {
        isGroupOrder: boolean;
        groupId: string;
        initiator: mongoose.Types.ObjectId;
        participants: {
            user: mongoose.Types.ObjectId;
            joinedAt: Date;
            items: IOrderItem[]
            subtotal: number;
        }[];
        minGroupSize?: number;
        maxGroupSize?: number;
    };

    deliveryInfo: {
        address: string;
        city: string;
        state: string;
        phoneNumber: string;
        delveryDate?: Date;
        deliveryNote?: string
    };

    statusHistory: OrderStatusHistoryEntry[];

    assignedRider?: {
        rider: mongoose.Types.ObjectId;
        assignedBy: mongoose.Types.ObjectId;
        assignedAt: Date;
        note?: string;
    };

    handoverCodeHash?: string;
    handoverCodeMasked?: string;
    handoverCodeIssuedAt?: Date;
    handoverCodeActive: boolean;
    handoverCodeAttempts: number;
    handoverVerifiedAt?: Date;

    completedAt?: Date;
    cancelledAt?: Date;

    // Instance methods
    processWalletPayment(): Promise<IOrder>;
    cancelOrder(reason?: string): Promise<IOrder>;
    addStatusHistory(entry: OrderStatusHistoryEntry): void;
}

// Model with static methods
export interface IOrderModel extends Model<IOrder> {
    createIndividualOrder(data: {
        userId: mongoose.Types.ObjectId;
        items: {
            productId: mongoose.Types.ObjectId;
            quantity: number;
            priceType: 'retail' | 'bulk'
        }[];
        deliveryInfo: {
            address: string;
            city: string;
            state: string;
            phoneNumber: string;
        };
        paymentMethod: 'wallet' | 'pay_later' | 'paystack';
        deliveryFee?: number;
        payementReference?: string;
    }): Promise<IOrder>;
}

const OrderItemSchema = new Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product is required']
    },

    productName: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },

    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1']
    },

    unitPrice: {
        type: Number,
        required: [true, 'Unit price is required'],
        min: [1, 'Unit price must be at least 1 kobo']
    },


    totalPrice: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [1, 'Unit price must be at least 1 kobo']
    },

    deal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deal',
        required: false
    }
}, { _id: false });
    // Always include 'deal' in JSON responses
    OrderItemSchema.set('toJSON', {
        transform: function (doc, ret) {
            if (doc.deal) {
                ret.deal = doc.deal;
            }
            return ret;
        }
    });
    

const OrderSchema: Schema = new Schema({
    orderNumber: {
        type: String,
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required'],
        index: true
    },

    items: {
        type: [OrderItemSchema],
        required: true,
        validate: {
            validator: function(items: IOrderItem[]) {
                return items.length > 0
            },
            message: 'Order must contain at least one item'
        }
    },

    subtotal: {
        type: Number,
        required: true,
        min: 1
    },

    deliveryFee: {
        type: Number,
        required: [true, 'Delivery fee is required'],
        min: 0,
        default: 0
    },

    totalAmount: {
        type: Number,
        required: [true, 'Total amount is required'],
        min: 1
    },

    paymentMethod: {
        type: String,
        enum: ['wallet', 'pay_later', 'paystack'],
        required: [true, 'Payement method is required'],
    },

    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },

    orderStatus: {
        type: String,
        enum: ['pending_payment', 'ready_for_processing', 'processing', 'ready_for_dispatch', 'awaiting_pickup', 'en_route', 'delivered', 'completed', 'cancelled', 'failed_delivery'],
        default: 'pending_payment'
    },

    currentStageOwnerRole: {
        type: String,
        enum: ['system', 'processing', 'logistics', 'rider', 'support'],
        default: 'system'
    },

    walletTransaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WalletTransaction',
        required: function(this: IOrder) {
        }
    },

    paymentReference: {
        type: String,
        trim: true,
        required: function(this: IOrder) {
            return 'paystack'.includes(this.paymentMethod)
        }
    },

    paymentProvider: {
        type: String,
        enum: 'paystack',
        required: function(this: IOrder) {
           return ['paystack', 'flutterwave'].includes(this.paymentMethod);
        
    }
  },

    providerResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    payLaterInfo: {
    dueDate: {
        type: Date,
        required: function(this: IOrder){
            return this.paymentMethod === 'pay_later'
        }
    },
    amountDue: {
      type: Number,
      min: [0, 'Amount due cannot be negative'],
      required: function(this: IOrder) {
        return this.paymentMethod === 'pay_later';
    }
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  repaymentTransaction: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalletTransaction'
  }]
},

groupOrder: {
    isGroupOrder: {
        type: Boolean,
        default: false
   },
   groupId: {
    type: String,
    trim: true
   },
   initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
   },
   participants: [{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
   joinedAt: {
    type: Date,
    default: Date.now
   },
   items: [OrderItemSchema],
   subtotal: {
    type: Number,
    min: 0
   }
}],
minGroupSize: {
    type: Number,
    min: 2
  }
},

deliveryInfo: {
    address: {
        type: String,
        required: [true, 'Delivery address is required'],
        trim: true,
        maxlength: [200, 'Address cannot exceed 200 characters']
    },
    city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    state: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    deliveryDate: Date,
    deliveryNotes: {
        type: String,
        trim: true,
        maxlength: 500
    }
},

assignedRider: {
    rider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    assignedAt: Date,
    note: {
        type: String,
        trim: true,
        maxlength: 500
    }
},

handoverCodeHash: {
    type: String,
    select: false
},

handoverCodeMasked: {
    type: String,
    default: null
},

handoverCodeIssuedAt: Date,

handoverCodeActive: {
    type: Boolean,
    default: false
},

handoverCodeAttempts: {
    type: Number,
    default: 0,
    select: false
},

handoverVerifiedAt: Date,

statusHistory: [{
    status: {
        type: String,
        enum: ['pending_payment', 'ready_for_processing', 'processing', 'ready_for_dispatch', 'awaiting_pickup', 'en_route', 'delivered', 'completed', 'cancelled', 'failed_delivery'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String,
        trim: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedByName: {
        type: String,
        trim: true,
        maxlength: 120
    },
    role: {
        type: String,
        trim: true,
        maxlength: 60
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
  }],

  adminNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  completedAt: Date,
  cancelledAt: Date

  }, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true}
});

OrderSchema.index({ user: 1, createdAt: -1 }); // User order history
OrderSchema.index({ orderNumber: 1 }, { unique: true }); // Order lookup - unique
OrderSchema.index({ orderStatus: 1, createdAt: -1 }); // Admin dashboard
OrderSchema.index({ paymentStatus: 1 }); // Payment queries
OrderSchema.index({ paymentReference: 1 }, { unique: true, sparse: true }); // Payment gateway lookups - unique, sparse
OrderSchema.index({ 'groupOrder.groupId': 1 }); // Group order queries
OrderSchema.index({ 'payLaterInfo.dueDate': 1, 'payLaterInfo.isPaid': 1 }); // Pay later tracking


OrderSchema.virtual('totalItems').get(function(this: IOrder) {
    return this.items.reduce((total, item) => total + item.quantity, 0)
});

OrderSchema.virtual('summary').get(function(this: IOrder) {
    return {
        totalItems: this.totalItems,
        ItemCount: this.items.length,
        totalAmountInNaira: this.totalAmount / 100,
        status: this.orderStatus,
        paymentStatus: this.paymentStatus
    };
});

const generateHandoverCode = () => {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const hashed = crypto.createHash('sha256').update(code).digest('hex');
    const masked = `***-${code.slice(-4)}`;
    return { code, hashed, masked };
};

OrderSchema.methods.addStatusHistory = function(entry: OrderStatusHistoryEntry) {
    if (!Array.isArray(this.statusHistory)) {
        this.statusHistory = [];
    }
    this.statusHistory.push({
        status: entry.status,
        timestamp: entry.timestamp || new Date(),
        note: entry.note,
        updatedBy: entry.updatedBy,
        updatedByName: entry.updatedByName,
        role: entry.role,
        metadata: entry.metadata || null
    });
};

OrderSchema.pre<IOrder>('save', async function(next) {
    if (this.isNew) {
        const year = new Date().getFullYear();
        const count = await mongoose.model('Order').countDocuments({
            createdAt: { $gte: new Date(`${year}-01-01`) }
        });

        this.orderNumber =  `FCP-${year}-${String(count + 1).padStart(7, '0')}`;

        if (!this.handoverCodeHash) {
            const { code, hashed, masked } = generateHandoverCode();
            (this as any).handoverCodePlain = code;
            this.handoverCodeHash = hashed;
            this.handoverCodeMasked = masked;
            this.handoverCodeIssuedAt = new Date();
            this.handoverCodeActive = true;
            this.handoverCodeAttempts = 0;
        }

        if (!this.statusHistory || this.statusHistory.length === 0) {
            this.statusHistory = [{
                status: this.orderStatus,
                timestamp: new Date(),
                note: 'Order created',
                role: 'system',
                updatedByName: 'System'
            }];
        }
    } else {
        if (this.isModified('orderStatus')) {
            if (this.orderStatus === 'delivered' && !this.completedAt) {
                this.completedAt = new Date();
            } else if (this.orderStatus === 'cancelled' && !this.cancelledAt) {
                this.cancelledAt = new Date();
            }
        }
    }

    next();
});

OrderSchema.statics.createIndividualOrder = async function(data: {
    userId: mongoose.Types.ObjectId;
    items: {
        productId: mongoose.Types.ObjectId;
        quantity: number;
        priceType: 'retail' | 'bulk';
        unitPrice?: number;
        totalPrice?: number;
        dealId?: mongoose.Types.ObjectId;
    }[];
    deliveryInfo: {
        address: string,
        city: string,
        state: string,
        phoneNumber: string;
    };
    paymentMethod: 'wallet' | 'pay_later' | 'paystack';
    deliveryFee?: number;
    payementReference?: string
}) {
    const Product = mongoose.model('Product');

    const orderItems: IOrderItem[] = [];
    let subtotal = 0;

    const dealAggregates = new Map<string, { deal: IDeal; quantity: number }>();

    for (const item of data.items) {
        const product = await Product.findById(item.productId);
        if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
        }

        if (!product.canFulfillOrder(item.quantity, item.priceType)) {
            throw new Error(`Insufficient stock for ${product.name}`);
        }

        if (!product.pricing) {
            throw new Error(`Product ${product.name} has no pricing information`);
        }

        if (item.dealId) {
            const dealDoc = await Deal.findById(item.dealId);
            if (!dealDoc) {
                throw new Error('Selected deal is no longer available');
            }

            if (!dealDoc.product.equals(item.productId)) {
                throw new Error('Deal does not match the selected product');
            }

            const dealKey = (dealDoc._id as mongoose.Types.ObjectId).toString();
            const existing = dealAggregates.get(dealKey);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                dealAggregates.set(dealKey, { deal: dealDoc, quantity: item.quantity });
            }
        }

        let pricing;

        if (item.priceType === 'retail') {
            pricing = product.pricing.retail;

            if (!pricing) {
                throw new Error(`Product ${product.name} does not have retail pricing`);
            }
        } else if (item.priceType === 'bulk') {
            if (!product.pricing.bulkTiers || product.pricing.bulkTiers.length === 0) {
                throw new Error(`Product ${product.name} does not have bulk pricing available`);
            }

            pricing = product.pricing.bulkTiers[0];
        } else {
            throw new Error(`Invalid price type: ${item.priceType}. Must be 'retail' or 'bulk'`);
        }

        if (typeof pricing.price !== 'number' || pricing.price <= 0) {
            throw new Error(`Invalid price for ${product.name} ${item.priceType} pricing`);
        }

        if (typeof pricing.minQuantity !== 'number' || pricing.minQuantity <= 0) {
            throw new Error(`Invalid minQuantity for ${product.name} ${item.priceType} pricing`);
        }

        const overrideUnitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : undefined;
        const overrideTotalPrice = typeof item.totalPrice === 'number' ? item.totalPrice : undefined;

        const computedUnitPrice = pricing.price / pricing.minQuantity;
        let unitPrice = computedUnitPrice;
        let totalPrice = unitPrice * item.quantity;

        if (overrideUnitPrice !== undefined) {
            unitPrice = overrideUnitPrice;
            totalPrice = unitPrice * item.quantity;
        }

        if (overrideTotalPrice !== undefined) {
            totalPrice = overrideTotalPrice;
            if (overrideUnitPrice === undefined) {
                unitPrice = item.quantity > 0 ? overrideTotalPrice / item.quantity : unitPrice;
            }
        }

        orderItems.push({
            product: item.productId,
            productName: product.name,
            quantity: item.quantity,
            priceType: item.priceType,
            unitPrice,
            totalPrice,
            ...(item.dealId ? { deal: item.dealId } : {})
        });

        subtotal += totalPrice;
    }

    for (const { deal, quantity } of dealAggregates.values()) {
        const remainingUnits = Math.max(deal.maxUnits - deal.soldUnits, 0);
        if (quantity > remainingUnits) {
            throw new Error(`Deal "${deal.title}" is sold out`);
        }

        const computedStatus = Deal.determineStatus({
            startAt: deal.startAt,
            endAt: deal.endAt,
            soldUnits: deal.soldUnits,
            maxUnits: deal.maxUnits,
            status: deal.status
        });

        if (!['active', 'scheduled'].includes(computedStatus)) {
            throw new Error(`Deal "${deal.title}" is not active`);
        }

        if (computedStatus === 'scheduled' && deal.startAt && deal.startAt > new Date()) {
            throw new Error(`Deal "${deal.title}" has not started yet`);
        }

        if (deal.perUserLimit) {
            const existingRedemptions = await DealRedemption.aggregate([
                { $match: { deal: deal._id, user: data.userId } },
                { $group: { _id: null, total: { $sum: '$quantity' } } }
            ]);
            const alreadyRedeemed = existingRedemptions[0]?.total || 0;
            if (alreadyRedeemed + quantity > deal.perUserLimit) {
                throw new Error(`Deal "${deal.title}" limit reached`);
            }
        }
    }

    const deliveryFee = data.deliveryFee || 0;
    const totalAmount = subtotal + deliveryFee;

    const incrementedDeals: Array<{ dealId: mongoose.Types.ObjectId; quantity: number }> = [];
    let createdRedemptionIds: mongoose.Types.ObjectId[] = [];

    try {
        for (const entry of dealAggregates.values()) {
            const updatedDeal = await Deal.findOneAndUpdate(
                {
                    _id: entry.deal._id,
                    soldUnits: { $lte: entry.deal.maxUnits - entry.quantity }
                },
                {
                    $inc: { soldUnits: entry.quantity }
                },
                { new: true }
            );

            if (!updatedDeal) {
                throw new Error(`Deal "${entry.deal.title}" is no longer available`);
            }

            const nextStatus = Deal.determineStatus({
                startAt: updatedDeal.startAt,
                endAt: updatedDeal.endAt,
                soldUnits: updatedDeal.soldUnits,
                maxUnits: updatedDeal.maxUnits,
                status: updatedDeal.status
            });

            if (nextStatus !== updatedDeal.status) {
                updatedDeal.status = nextStatus;
                await updatedDeal.save();
            }

            entry.deal = updatedDeal;
            incrementedDeals.push({ dealId: updatedDeal._id as mongoose.Types.ObjectId, quantity: entry.quantity });
        }

        const order = new this({
            user: data.userId,
            items: orderItems,
            subtotal,
            deliveryFee,
            totalAmount,
            paymentMethod: data.paymentMethod,
            deliveryInfo: data.deliveryInfo,
            paymentReference: data.payementReference,
            paymentProvider: ['paystack', 'flutterwave'].includes(data.paymentMethod)
                ? data.paymentMethod as 'paystack'
                : undefined,
            payLaterInfo: data.paymentMethod === 'pay_later' ? {
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                amountDue: totalAmount,
                isPaid: false,
                repaymentTransactions: []
            } : undefined
        });

        await order.save();

        const handoverCodePlain = (order as any).handoverCodePlain;
        if (handoverCodePlain) {
            order.set('handoverCodePlain', handoverCodePlain, { strict: false });
        }

        if (data.paymentMethod === 'wallet') {
            await order.processWalletPayment();
        }

        if (dealAggregates.size) {
            const redemptionDocs = Array.from(dealAggregates.values()).map((entry) => ({
                deal: entry.deal._id,
                user: data.userId,
                order: order._id,
                quantity: entry.quantity
            }));
            const insertedRedemptions = await DealRedemption.insertMany(redemptionDocs);
            createdRedemptionIds = insertedRedemptions.map((doc) => doc._id as mongoose.Types.ObjectId);
        }

        for (const item of data.items) {
            const product = await Product.findById(item.productId);
            if (product) {
                await product.updateStock(item.quantity, 'decrease');
            }
        }

        return order;
    } catch (error) {
        if (createdRedemptionIds.length) {
            await DealRedemption.deleteMany({ _id: { $in: createdRedemptionIds } });
        }

        if (incrementedDeals.length) {
            for (const entry of incrementedDeals) {
                const rolledDeal = await Deal.findOneAndUpdate(
                    { _id: entry.dealId },
                    { $inc: { soldUnits: -entry.quantity } },
                    { new: true }
                );

                if (rolledDeal) {
                    const nextStatus = Deal.determineStatus({
                        startAt: rolledDeal.startAt,
                        endAt: rolledDeal.endAt,
                        soldUnits: rolledDeal.soldUnits,
                        maxUnits: rolledDeal.maxUnits,
                        status: rolledDeal.status
                    });

                    if (nextStatus !== rolledDeal.status) {
                        rolledDeal.status = nextStatus;
                        await rolledDeal.save();
                    }
                }
            }
        }

        throw error;
    }
};

OrderSchema.methods.processWalletPayment = async function() {
  if (this.paymentMethod !== 'wallet') {
    throw new Error('This method is only for wallet payments');
  }

  if (this.paymentStatus !== 'pending') {
    throw new Error('Payment has already been processed');
  }

  const transaction = await WalletTransaction.createTransaction({
    userId: this.user,
    type: 'debit',
    amount: this.totalAmount,
    orderId: this._id,
    description: `Payment for order ${this.orderNumber}`
  });

  this.walletTransaction = transaction._id;
  this.paymentStatus = 'paid';
    if (this.orderStatus === 'pending_payment') {
        this.orderStatus = 'ready_for_processing';
        this.currentStageOwnerRole = 'processing';
        this.addStatusHistory({
            status: 'ready_for_processing',
            note: 'Wallet payment confirmed',
            role: 'system',
            updatedByName: 'System'
        });
    }
  await this.save();
  return this;
};

OrderSchema.methods.cancelOrder = async function(reason?: string) {
    const cancellableStatuses: OrderStatus[] = [
        'pending_payment',
        'ready_for_processing',
        'processing',
        'ready_for_dispatch',
        'awaiting_pickup'
    ];

    if (!cancellableStatuses.includes(this.orderStatus)) {
        throw new Error('Order cannot be cancelled at the current stage');
  }
  
  this.orderStatus = 'cancelled';
    this.currentStageOwnerRole = 'support';
    this.handoverCodeActive = false;
    this.addStatusHistory({
        status: 'cancelled',
        note: reason || 'Order cancelled',
        role: 'system',
        updatedByName: 'System'
    });
  
  // Restore product stock
  const Product = mongoose.model('Product');
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (product) {
      await product.updateStock(item.quantity, 'increase');
    }
  }
  
  // Process refund if payment was made via wallet
  if (this.paymentStatus === 'paid' && this.paymentMethod === 'wallet' && this.walletTransaction) {
    await WalletTransaction.createTransaction({
      userId: this.user,
      type: 'refund',
      amount: this.totalAmount,
      orderId: this._id,
      description: `Refund for cancelled order ${this.orderNumber}`
    });
  }
  
  await this.save();
  return this;
};

export const Order = mongoose.model<IOrder, IOrderModel>('Order', OrderSchema);