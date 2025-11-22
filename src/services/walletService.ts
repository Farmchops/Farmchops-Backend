import mongoose from 'mongoose';
import User from '../models/User';
import { WalletTransaction, IWalletTransaction } from '../models/WalletTransaction';

export interface WalletFundingResult {
  success: boolean;
  transaction?: IWalletTransaction;
  newBalance?: number;
  error?: string;
}

export interface WalletDebitResult {
  success: boolean;
  transaction?: IWalletTransaction;
  newBalance?: number;
  error?: string;
}

class WalletService {
  /**
   * Credit user's wallet (used after successful Paystack payment)
   */
  async creditWallet(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    description: string,
    reference?: string
  ): Promise<WalletFundingResult> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const currentBalance = user.wallet?.balance || 0;
      const newBalance = currentBalance + amount;

      // Create transaction record
      const txnReference = reference || `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

      const transaction = await WalletTransaction.create({
        userId,
        type: 'credit',
        amount,
        description,
        reference: txnReference,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed'
      });

      // Update user's wallet balance
      await user.updateOne({ $set: { 'wallet.balance': newBalance } });

      return {
        success: true,
        transaction,
        newBalance
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to credit wallet'
      };
    }
  }

  /**
   * Debit user's wallet (used for order payment)
   */
  async debitWallet(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    description: string,
    orderId?: string | mongoose.Types.ObjectId
  ): Promise<WalletDebitResult> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const currentBalance = user.wallet?.balance || 0;
      if (currentBalance < amount) {
        return { success: false, error: 'Insufficient wallet balance' };
      }

      const newBalance = currentBalance - amount;

      // Create transaction record
      const reference = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

      const transaction = await WalletTransaction.create({
        userId,
        type: 'debit',
        amount,
        description,
        reference,
        orderId: orderId ? new mongoose.Types.ObjectId(orderId.toString()) : undefined,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed'
      });

      // Update user's wallet balance
      await user.updateOne({ $set: { 'wallet.balance': newBalance } });

      return {
        success: true,
        transaction,
        newBalance
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to debit wallet'
      };
    }
  }

  /**
   * Refund to user's wallet
   */
  async refundToWallet(
    userId: string | mongoose.Types.ObjectId,
    amount: number,
    description: string,
    orderId?: string | mongoose.Types.ObjectId
  ): Promise<WalletFundingResult> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const currentBalance = user.wallet?.balance || 0;
      const newBalance = currentBalance + amount;

      // Create refund transaction record
      const reference = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

      const transaction = await WalletTransaction.create({
        userId,
        type: 'refund',
        amount,
        description,
        reference,
        orderId: orderId ? new mongoose.Types.ObjectId(orderId.toString()) : undefined,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed'
      });

      // Update user's wallet balance
      await user.updateOne({ $set: { 'wallet.balance': newBalance } });

      return {
        success: true,
        transaction,
        newBalance
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refund wallet'
      };
    }
  }

  /**
   * Get user's wallet balance
   */
  async getBalance(userId: string | mongoose.Types.ObjectId): Promise<number> {
    const user = await User.findById(userId).select('wallet');
    return user?.wallet?.balance || 0;
  }

  /**
   * Check if user has sufficient balance
   */
  async hasSufficientBalance(userId: string | mongoose.Types.ObjectId, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  /**
   * Complete a pending wallet funding transaction (called from webhook)
   */
  async completePendingFunding(reference: string): Promise<WalletFundingResult> {
    try {
      const transaction = await WalletTransaction.findOne({ reference, status: 'pending' });

      if (!transaction) {
        return { success: false, error: 'Transaction not found or already processed' };
      }

      const user = await User.findById(transaction.userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Update transaction status
      transaction.status = 'completed';
      await transaction.save();

      // Update user's wallet balance
      const newBalance = (user.wallet?.balance || 0) + transaction.amount;
      await user.updateOne({ $set: { 'wallet.balance': newBalance } });

      return {
        success: true,
        transaction,
        newBalance
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete funding'
      };
    }
  }

  /**
   * Fail a pending wallet funding transaction
   */
  async failPendingFunding(reference: string): Promise<void> {
    await WalletTransaction.updateOne(
      { reference, status: 'pending' },
      { $set: { status: 'failed' } }
    );
  }
}

export default new WalletService();
