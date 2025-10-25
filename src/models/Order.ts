import mongoose, { Document, Schema, Model } from 'mongoose';
import { WalletTransaction } from './WalletTransaction';

interface IOrderItem {
    product: mongoose.Types.ObjectId;
    productName: string;
    quantity: number;
    priceType: 'retail' | 'bulk';
    unitPrice: number;
    totalPrice: number;
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
    orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

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

    statusHistory: {
        status: string;
        timestamp: Date;
        note?: string
    }[];

    completedAt?: Date;
    cancelledAt?: Date;

    // Instance methods
    processWalletPayment(): Promise<IOrder>;
    cancelOrder(reason?: string): Promise<IOrder>;
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
    }
}, { _id: false });

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
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
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

statusHistory: [{
    status: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String,
        trim: true
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

OrderSchema.pre<IOrder>('save', async function(next) {
    if (this.isNew) {
        const year = new Date().getFullYear();
        const count = await mongoose.model('Order').countDocuments({
            createdAt: { $gte: new Date(`${year}-01-01`) }
        });

        this.orderNumber =  `FCP-${year}-${String(count + 1).padStart(7, '0')}`;

        this.statusHistory = [{
            status: this.orderStatus,
            timestamp: new Date(),
            note: 'Order created'
        }];
    } else if (this.isModified('orderStatus')) {
        // Update status history and completion dates when status changes
        this.statusHistory.push({
            status: this.orderStatus,
            timestamp: new Date(),
            note: `Status changed to ${this.orderStatus}`
        });

        // Set completion or cancellation date based on status
        if (this.orderStatus === 'delivered' && !this.completedAt) {
            this.completedAt = new Date();
        } else if (this.orderStatus === 'cancelled' && !this.cancelledAt) {
            this.cancelledAt = new Date();
        }
    }

    next();
});

OrderSchema.statics.createIndividualOrder = async function(data: {
    userId: mongoose.Types.ObjectId;
    items: {
        productId: mongoose.Types.ObjectId;
        quantity: number;
        priceType: 'retail' | 'bulk'
    } [];
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
    const Product = mongoose.model('Product')

    const orderItems: IOrderItem[] = [];
    let subtotal = 0

    for (const item of data.items){
        const product = await Product.findById(item.productId);
        if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
        }

        if (!product.canFulfillOrder(item.quantity, item.priceType)) {
            throw new Error (`Insufficient stock for ${product.name}`);
        }

    const pricing = product.pricing[item.priceType];
    const unitPrice = pricing.price / pricing.minQuantity;
    const totalPrice = unitPrice * item.quantity;
    
    orderItems.push({
      product: item.productId,
      productName: product.name,
      quantity: item.quantity,
      priceType: item.priceType,
      unitPrice,
      totalPrice
    });

    subtotal += totalPrice;
    }

    const deliveryFee = data.deliveryFee || 0;
    const totalAmount = subtotal + deliveryFee;

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
           dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      amountDue: totalAmount,
      isPaid: false,
      repaymentTransactions: []
        } : undefined
    })

    await order.save();

    // Process wallet payment if that's the payment method
    if (data.paymentMethod === 'wallet') {
        await order.processWalletPayment();
    }

    // Update product stock
    for (const item of data.items) {
        const product = await Product.findById(item.productId);
        if (product) {
            await product.updateStock(item.quantity, 'decrease');
        }
    }

    return order;
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
  await this.save();
  return this;
};

OrderSchema.methods.cancelOrder = async function(reason?: string) {
  if (!['pending', 'confirmed'].includes(this.orderStatus)) {
    throw new Error('Only pending or confirmed orders can be cancelled');
  }
  
  this.orderStatus = 'cancelled';
  
  // Restore product stock
  const Product = mongoose.model('Product');
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (product) {
      await product.updateStock(item.quantity, 'increase');
    }
  }
  
  // Process refund if payment was made
  if (this.paymentStatus === 'paid' && this.walletTransaction) {
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