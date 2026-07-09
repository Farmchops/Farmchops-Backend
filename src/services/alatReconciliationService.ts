import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import { Product } from '../models/Product';
import User from '../models/User';
import emailService from './emailService';
import websocketService from './websocketService';
import alatPayService from '../config/alatpay';

const LOOKBACK_HOURS = 48;

export const confirmAlatOrderPayment = async (order: IOrder, transactionId: string, providerData: any) => {
  if (order.paymentStatus === 'paid') {
    return order;
  }

  order.paymentStatus = 'paid';
  order.orderStatus = 'ready_for_processing';
  order.currentStageOwnerRole = 'processing';
  order.paymentReference = transactionId;
  order.providerResponse = providerData;
  order.addStatusHistory({
    status: 'ready_for_processing',
    note: 'ALATPay payment verified',
    role: 'system',
    updatedByName: 'System'
  });
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
      paymentMethod: 'ALATPay',
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

// Safety net for when the frontend never calls /alat/verify (e.g. browser closed
// right after payment) — ALAT has no webhook on our account tier, so we poll their
// transaction list and reconcile any pending order whose payment actually completed.
export const reconcilePendingAlatOrders = async () => {
  const lookbackCutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const pendingOrders = await Order.find({
    paymentMethod: 'alat',
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    createdAt: { $gte: lookbackCutoff }
  }).select('+handoverCodePlain');

  if (pendingOrders.length === 0) {
    return { checked: 0, reconciled: 0 };
  }

  // ALAT's transaction record carries our order number back in customer.metadata
  // (set at checkout init); its own `orderId` is an internal ALAT UUID unrelated to us.
  const byOrderNumber = new Map(pendingOrders.map((o) => [o.orderNumber, o]));

  const startAt = lookbackCutoff.toISOString();
  const endAt = new Date().toISOString();

  const reconciled = new Set<string>();
  let page = 1;
  let totalPages = 1;

  do {
    const response = await alatPayService.listTransactions({ page, startAt, endAt });
    const rawData = response?.data;
    const transactions: any[] = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];
    totalPages = response?.pagination?.totalPages || 1;

    for (const txn of transactions) {
      const status = String(txn.status || txn.Status || '').toLowerCase();
      if (status !== 'completed') continue;

      const orderNumber = txn.customer?.metadata;
      const order = byOrderNumber.get(orderNumber);

      if (order && !reconciled.has(order.orderNumber)) {
        const transactionId = txn.customer?.transactionId || txn.id;
        await confirmAlatOrderPayment(order, transactionId, txn);
        reconciled.add(order.orderNumber);
      }
    }

    page += 1;
  } while (page <= totalPages);

  return { checked: pendingOrders.length, reconciled: reconciled.size };
};
