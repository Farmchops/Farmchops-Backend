import mongoose from 'mongoose';
import {
  PayLaterApplication,
  PayLaterAccount,
  PayLaterOrder,
  PayLaterCart,
  PayLaterSettings,
  IPayLaterCartItem
} from '../models/PayLater';
import { Product } from '../models/Product';

// Default settings
const DEFAULT_SETTINGS = {
  markupPercentage: 10,
  defaultRepaymentDays: 30,
  minCreditLimit: 50000,
  maxCreditLimit: 500000,
  deliveryFee: 2500
};

class PayLaterService {
  /**
   * Get PayLater settings (create default if not exists)
   */
  async getSettings() {
    let settings = await PayLaterSettings.findOne();
    if (!settings) {
      settings = await PayLaterSettings.create(DEFAULT_SETTINGS);
    }
    return settings;
  }

  /**
   * Calculate PayLater price with markup
   */
  async calculatePayLaterPrice(regularPrice: number): Promise<number> {
    const settings = await this.getSettings();
    return Math.round(regularPrice * (1 + settings.markupPercentage / 100));
  }

  /**
   * Generate unique order number
   */
  async generateOrderNumber(): Promise<string> {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PL-${timestamp}-${random}`;
  }

  /**
   * Check if user has existing application
   */
  async hasExistingApplication(userId: string | mongoose.Types.ObjectId): Promise<{
    hasApplication: boolean;
    application?: any;
    status?: string;
  }> {
    const application = await PayLaterApplication.findOne({
      userId,
      status: { $in: ['pending', 'approved'] }
    });

    if (!application) {
      return { hasApplication: false };
    }

    return {
      hasApplication: true,
      application,
      status: application.status
    };
  }

  /**
   * Get user's PayLater account
   */
  async getAccount(userId: string | mongoose.Types.ObjectId) {
    return PayLaterAccount.findOne({ userId, status: 'active' });
  }

  /**
   * Check if user can use PayLater (has active account with no active loan)
   */
  async canUsePaylater(userId: string | mongoose.Types.ObjectId): Promise<{
    canUse: boolean;
    reason?: string;
    account?: any;
  }> {
    const account = await this.getAccount(userId);

    if (!account) {
      return { canUse: false, reason: 'No active PayLater account' };
    }

    if (account.status !== 'active') {
      return { canUse: false, reason: 'PayLater account is not active', account };
    }

    if (account.hasActiveLoan) {
      return { canUse: false, reason: 'You have an active loan. Please repay before making new purchases', account };
    }

    return { canUse: true, account };
  }

  /**
   * Get cart with calculated totals
   */
  async getCartWithTotals(userId: string | mongoose.Types.ObjectId) {
    const settings = await this.getSettings();
    let cart = await PayLaterCart.findOne({ userId });

    if (!cart) {
      cart = await PayLaterCart.create({ userId, items: [] });
    }

    const subtotal = cart.items.reduce((sum, item) => sum + (item.paylaterPrice * item.quantity), 0);
    const totalAmount = subtotal + settings.deliveryFee;

    return {
      cart,
      subtotal,
      deliveryFee: settings.deliveryFee,
      totalAmount,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  /**
   * Add item to cart
   */
  async addToCart(
    userId: string | mongoose.Types.ObjectId,
    productId: string,
    quantity: number
  ) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.inventory.availableStock < quantity) {
      throw new Error('Insufficient stock');
    }

    const settings = await this.getSettings();
    const paylaterPrice = Math.round(product.pricing.retail.price * (1 + settings.markupPercentage / 100));

    let cart = await PayLaterCart.findOne({ userId });
    if (!cart) {
      cart = await PayLaterCart.create({ userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (existingItemIndex > -1 && cart.items[existingItemIndex]) {
      cart.items[existingItemIndex]!.quantity += quantity;
    } else {
      (cart.items as IPayLaterCartItem[]).push({
        productId: new mongoose.Types.ObjectId(productId),
        name: product.name,
        image: product.images?.[0] || '',
        quantity,
        unit: product.inventory.unit || 'unit',
        regularPrice: product.pricing.retail.price,
        paylaterPrice
      });
    }

    await cart.save();
    return this.getCartWithTotals(userId);
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    userId: string | mongoose.Types.ObjectId,
    productId: string,
    quantity: number
  ) {
    const cart = await PayLaterCart.findOne({ userId });
    if (!cart) {
      throw new Error('Cart not found');
    }

    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      throw new Error('Item not in cart');
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const product = await Product.findById(productId);
      if (product && product.inventory.availableStock < quantity) {
        throw new Error('Insufficient stock');
      }
      if (cart.items[itemIndex]) {
        cart.items[itemIndex]!.quantity = quantity;
      }
    }

    await cart.save();
    return this.getCartWithTotals(userId);
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: string | mongoose.Types.ObjectId, productId: string) {
    const cart = await PayLaterCart.findOne({ userId });
    if (!cart) {
      throw new Error('Cart not found');
    }

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    await cart.save();
    return this.getCartWithTotals(userId);
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string | mongoose.Types.ObjectId) {
    await PayLaterCart.updateOne({ userId }, { $set: { items: [] } });
  }

  /**
   * Process checkout
   */
  async checkout(
    userId: string | mongoose.Types.ObjectId,
    deliveryAddress: {
      street: string;
      city: string;
      state: string;
      phone: string;
    }
  ) {
    const account = await this.getAccount(userId);
    if (!account) {
      throw new Error('No active PayLater account');
    }

    if (account.hasActiveLoan) {
      throw new Error('You have an active loan. Please repay before making new purchases');
    }

    const cartData = await this.getCartWithTotals(userId);
    if (cartData.cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    if (cartData.totalAmount > account.availableCredit) {
      throw new Error(`Cart total (₦${cartData.totalAmount.toLocaleString()}) exceeds available credit (₦${account.availableCredit.toLocaleString()})`);
    }

    // Verify stock availability
    for (const item of cartData.cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.inventory.availableStock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
    }

    const settings = await this.getSettings();
    const orderNumber = await this.generateOrderNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + settings.defaultRepaymentDays);

    // Create order
    const order = await PayLaterOrder.create({
      userId,
      accountId: account._id,
      orderNumber,
      items: cartData.cart.items,
      subtotal: cartData.subtotal,
      deliveryFee: cartData.deliveryFee,
      totalAmount: cartData.totalAmount,
      deliveryAddress,
      dueDate,
      repaymentStatus: 'pending',
      orderStatus: 'processing'
    });

    // Update account
    account.hasActiveLoan = true;
    account.activeLoanAmount = cartData.totalAmount;
    account.activeLoanDueDate = dueDate;
    account.activeLoanOrderId = order._id as mongoose.Types.ObjectId;
    account.availableCredit = 0; // Lock all credit while loan is active
    await account.save();

    // Reduce product inventory
    for (const item of cartData.cart.items) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { 'inventory.availableStock': -item.quantity } }
      );
    }

    // Clear cart
    await this.clearCart(userId);

    return { order, account };
  }

  /**
   * Mark loan as repaid (admin action)
   */
  async markAsRepaid(
    orderId: string,
    repaidAmount: number,
    notes?: string
  ) {
    const order = await PayLaterOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.repaymentStatus === 'paid') {
      throw new Error('Order is already marked as paid');
    }

    const account = await PayLaterAccount.findById(order.accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Update order
    order.repaymentStatus = 'paid';
    order.repaidAt = new Date();
    order.repaidAmount = repaidAmount;
    order.repaymentNotes = notes || null;
    await order.save();

    // Update account - restore credit
    account.hasActiveLoan = false;
    account.activeLoanAmount = null;
    account.activeLoanDueDate = null;
    account.activeLoanOrderId = null;
    account.availableCredit = account.creditLimit;
    await account.save();

    return { order, account };
  }

  /**
   * Check and mark overdue loans
   */
  async checkOverdueLoans() {
    const now = new Date();
    const result = await PayLaterOrder.updateMany(
      {
        repaymentStatus: 'pending',
        dueDate: { $lt: now }
      },
      { $set: { repaymentStatus: 'overdue' } }
    );
    return result.modifiedCount;
  }

  /**
   * Get application statistics
   */
  async getApplicationStats() {
    const [pending, approved, rejected] = await Promise.all([
      PayLaterApplication.countDocuments({ status: 'pending' }),
      PayLaterApplication.countDocuments({ status: 'approved' }),
      PayLaterApplication.countDocuments({ status: 'rejected' })
    ]);
    return { pending, approved, rejected };
  }

  /**
   * Get loan statistics
   */
  async getLoanStats() {
    const [
      totalUsers,
      usersWithActiveLoan,
      overdueLoans
    ] = await Promise.all([
      PayLaterAccount.countDocuments({ status: 'active' }),
      PayLaterAccount.countDocuments({ status: 'active', hasActiveLoan: true }),
      PayLaterOrder.countDocuments({ repaymentStatus: 'overdue' })
    ]);

    const totalOutstandingResult = await PayLaterOrder.aggregate([
      { $match: { repaymentStatus: { $in: ['pending', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const totalOutstanding = totalOutstandingResult[0]?.total || 0;

    return { totalUsers, usersWithActiveLoan, overdueLoans, totalOutstanding };
  }
}

export default new PayLaterService();
