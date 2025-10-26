import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IWalletTransaction extends Document {
    userId: Types.ObjectId;
    type: 'credit' | 'debit' | 'refund';
    amount: number;
    orderId?: Types.ObjectId;
    description?: string;
    reference: string;
    balanceBefore: number;
    balanceAfter: number;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
}

export interface IWalletTransactionModel extends Model<IWalletTransaction> {
    createTransaction(transactionData: {
        userId: Types.ObjectId;
        type: 'credit' | 'debit' | 'refund';
        amount: number;
        orderId?: Types.ObjectId;
        description?: string;
    }): Promise<IWalletTransaction>;
}

const WalletTransactionSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },

    type: {
        type: String,
        enum: ['credit', 'debit', 'refund'],
        required: [true, 'Transaction type is required']
    },

    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [1, 'Amount must be at least 1 kobo']
    },

    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },

    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },

    reference: {
        type: String,
        required: true
    },

    balanceBefore: {
        type: Number,
        required: true
    },

    balanceAfter: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Indexes
WalletTransactionSchema.index({ userId: 1, createdAt: -1 }); // User transaction history
WalletTransactionSchema.index({ reference: 1 }, { unique: true }); // Transaction lookups - unique
WalletTransactionSchema.index({ orderId: 1 }); // Order related transactions
WalletTransactionSchema.index({ type: 1, status: 1 }); // Transaction analytics

// Static method to create a transaction
WalletTransactionSchema.statics.createTransaction = async function(transactionData) {
    // Validate transaction data
    if (!transactionData) {
        throw new Error('Transaction data is required');
    }
    if (!transactionData.userId) {
        throw new Error('User ID is required for transaction');
    }
    if (!transactionData.type) {
        throw new Error('Transaction type is required');
    }
    if (!['credit', 'debit', 'refund'].includes(transactionData.type)) {
        throw new Error(`Invalid transaction type: ${transactionData.type}`);
    }
    if (typeof transactionData.amount !== 'number' || transactionData.amount <= 0) {
        throw new Error('Valid transaction amount is required');
    }

    const user = await mongoose.model('User').findById(transactionData.userId);
    if (!user) {
        throw new Error('User not found');
    }

    const currentBalance = user.wallet.balance;
    const newBalance = transactionData.type === 'credit' || transactionData.type === 'refund'
        ? currentBalance + transactionData.amount
        : currentBalance - transactionData.amount;

    if (transactionData.type === 'debit' && newBalance < 0) {
        throw new Error('Insufficient wallet balance');
    }

    // Generate unique reference
    const reference = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

    const transaction = await this.create({
        ...transactionData,
        reference,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed'
    });

    // Update user's wallet balance
    await user.updateOne({
        $set: { 'wallet.balance': newBalance }
    });

    return transaction;
};

export const WalletTransaction = mongoose.model<IWalletTransaction, IWalletTransactionModel>(
    'WalletTransaction',
    WalletTransactionSchema
);