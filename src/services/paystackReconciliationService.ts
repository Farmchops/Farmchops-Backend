import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { Product } from '../models/Product';
import User from '../models/User';
import emailService from './emailService';
import websocketService from './websocketService';
import paystackService from '../config/paystack';

const LOOKBACK_HOURS = 48;

export const confirmPaystackOrderPayment = async (order: IOrder, providerData: any) => {
  // Atomic check-and-mark: only one concurrent request (webhook, client verify,
  // or this reconciliation job) can win this update, preventing double stock deduction.
  const claimed = await Order.findOneAndUpdate(
    { _id: (order._id as mongoose.Types.ObjectId), paymentStatus: { $ne: 'paid' } },
    { $set: { paymentStatus: 'paid' } },
    { new: false }
  );

  if (!claimed) {
    return order;
  }

  order.paymentStatus = 'paid';
  if (order.orderStatus !== 'ready_for_processing') {
    order.orderStatus = 'ready_for_processing';
    order.currentStageOwnerRole = 'processing';
    order.addStatusHistory({
      status: 'ready_for_processing',
      note: 'Paystack payment reconciled',
      role: 'system',
      updatedByName: 'System'
    });
  }
  order.providerResponse = providerData;
  await order.save();

  for (const item of order.items) {
    const product = await Product.findById((item as any).product);
    if (product) await (product as any).updateStock(item.quantity, 'decrease');
  }

  await order.populate('items.product', 'name images');
  await order.populate('user', 'firstName lastName email');

  websocketService.broadcastOrderStatusChanged(
    (order._id as mongoose.Types.ObjectId).toString(),
    'pending_payment',
    'ready_for_processing',
    order
  );

  const user = await User.findById(order.user);
  if (user) {
    const handoverCode = (order as any).handoverCodePlain;
    const orderItems = order.items.map((item: any) => ({
      productName: item.productName,
      quantity: item.quantity,
      price: item.totalPrice
    }));
    const deliveryAddress = `${order.deliveryInfo.address}, ${order.deliveryInfo.city}, ${order.deliveryInfo.state}`;

    await emailService.sendOrderConfirmationEmail(user.email, {
      orderNumber: order.orderNumber,
      customerName: `${user.firstName} ${user.lastName}`,
      items: orderItems,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      tax: order.tax,
      totalAmount: order.totalAmount,
      deliveryAddress,
      paymentMethod: 'Paystack',
      handoverCode
    });

    await emailService.sendNewOrderNotificationEmail({
      orderNumber: order.orderNumber,
      customerName: `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      totalAmount: order.totalAmount,
      deliveryAddress,
      items: orderItems
    });
  }

  return order;
};

// Safety net for when neither the Paystack webhook nor the client's /paystack/verify
// call ever confirms a successful charge (webhook signature mismatch, browser closed
// before redirect, network drop) — poll Paystack directly by reference for any order
// still stuck at pending_payment.
export const reconcilePendingPaystackOrders = async () => {
  const lookbackCutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const pendingOrders = await Order.find({
    paymentMethod: 'paystack',
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    paymentReference: { $exists: true, $ne: null },
    createdAt: { $gte: lookbackCutoff }
  }).select('+handoverCodePlain');

  if (pendingOrders.length === 0) {
    return { checked: 0, reconciled: 0 };
  }

  let reconciled = 0;
  for (const order of pendingOrders) {
    try {
      const response = await paystackService.verifyTransaction(order.paymentReference as string);
      if (response.status && response.data.status === 'success') {
        await confirmPaystackOrderPayment(order, response.data);
        reconciled += 1;
      }
    } catch (error) {
      console.error(`[Paystack Reconciliation] Failed to verify order ${order.orderNumber}:`, error);
    }
  }

  return { checked: pendingOrders.length, reconciled };
};
