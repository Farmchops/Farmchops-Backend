import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { WalletTransaction } from '../models/WalletTransaction';
import paystackService from '../config/paystack';

interface AuthRequest extends Request {
  user?: any;
}

// GET /api/wallet/balance - Get user's wallet balance
export const getWalletBalance = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(req.user._id).select('wallet firstName lastName email');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        balance: user.wallet?.balance || 0,
        currency: 'NGN',
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
};

// GET /api/wallet/transactions - Get user's wallet transaction history
export const getWalletTransactions = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      page = 1,
      limit = 20,
      type,
      status,
      startDate,
      endDate
    } = req.query;

    const query: any = { userId: req.user._id };

    if (type && ['credit', 'debit', 'refund'].includes(type as string)) {
      query.type = type;
    }

    if (status && ['pending', 'completed', 'failed'].includes(status as string)) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('orderId', 'orderNumber totalAmount'),
      WalletTransaction.countDocuments(query)
    ]);

    const results = transactions.map((t: any) => ({
      id: t._id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      reference: t.reference,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      status: t.status,
      order: t.orderId ? {
        id: t.orderId._id,
        orderNumber: t.orderId.orderNumber,
        amount: t.orderId.totalAmount
      } : null,
      createdAt: t.createdAt
    }));

    return res.json({
      success: true,
      data: {
        transactions: results,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
};

// POST /api/wallet/fund - Initialize wallet funding via Paystack
export const initializeWalletFunding = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required and must be at least ₦100'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate unique reference for wallet funding
    const reference = `WLT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

    // Create pending wallet transaction
    const currentBalance = user.wallet?.balance || 0;
    const pendingTransaction = await WalletTransaction.create({
      userId: user._id,
      type: 'credit',
      amount,
      description: 'Wallet funding via Paystack',
      reference,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + amount,
      status: 'pending'
    });

    // Initialize Paystack transaction (convert amount to kobo: 1 naira = 100 kobo)
    const amountInKobo = amount * 100;
    const paystackResponse = await paystackService.initializeTransaction(
      user.email,
      amountInKobo,
      reference,
      {
        type: 'wallet_funding',
        userId: (user._id as mongoose.Types.ObjectId).toString(),
        transactionId: (pendingTransaction._id as mongoose.Types.ObjectId).toString()
      }
    );

    return res.json({
      success: true,
      data: {
        reference,
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        amount,
        transactionId: pendingTransaction._id
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initialize wallet funding'
    });
  }
};

// GET /api/wallet/verify/:reference - Verify wallet funding transaction
export const verifyWalletFunding = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    // Find the pending transaction
    const transaction = await WalletTransaction.findOne({
      reference,
      userId: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // If already completed, return success
    if (transaction.status === 'completed') {
      const user = await User.findById(req.user._id).select('wallet');
      return res.json({
        success: true,
        data: {
          status: 'completed',
          amount: transaction.amount,
          reference: transaction.reference,
          newBalance: user?.wallet?.balance || transaction.balanceAfter
        }
      });
    }

    // Verify with Paystack
    const paystackResponse = await paystackService.verifyTransaction(reference);

    if (paystackResponse.status && paystackResponse.data.status === 'success') {
      // Update transaction status
      transaction.status = 'completed';
      await transaction.save();

      // Update user's wallet balance
      const user = await User.findById(req.user._id);
      if (user) {
        const newBalance = (user.wallet?.balance || 0) + transaction.amount;
        await user.updateOne({ $set: { 'wallet.balance': newBalance } });

        return res.json({
          success: true,
          data: {
            status: 'completed',
            amount: transaction.amount,
            reference: transaction.reference,
            newBalance
          }
        });
      }
    } else if (paystackResponse.data.status === 'failed') {
      transaction.status = 'failed';
      await transaction.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: { status: 'failed', reference }
      });
    }

    // Payment still pending
    return res.json({
      success: true,
      data: {
        status: 'pending',
        reference,
        message: 'Payment is still being processed'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify payment'
    });
  }
};

// POST /api/wallet/debit - Debit wallet (internal use for order payment)
export const debitWallet = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { amount, orderId, description } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentBalance = user.wallet?.balance || 0;
    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        data: { currentBalance, requiredAmount: amount }
      });
    }

    // Create debit transaction using the static method
    const transaction = await WalletTransaction.createTransaction({
      userId: user._id as mongoose.Types.ObjectId,
      type: 'debit',
      amount,
      orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
      description: description || 'Wallet payment'
    });

    return res.json({
      success: true,
      data: {
        transactionId: transaction._id,
        reference: transaction.reference,
        amount: transaction.amount,
        newBalance: transaction.balanceAfter
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process wallet debit'
    });
  }
};
