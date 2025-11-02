import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Order, IOrder, OrderStatus, OrderStageOwner } from '../src/models/Order';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment variables');
  process.exit(1);
}

type LegacyStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'pending_payment'
  | 'completed'
  | 'failed_delivery'
  | 'ready_for_dispatch'
  | 'awaiting_pickup'
  | 'en_route';

const STATUS_MAP: Record<LegacyStatus, OrderStatus> = {
  pending: 'ready_for_processing',
  processing: 'processing',
  shipped: 'en_route',
  delivered: 'delivered',
  cancelled: 'cancelled',
  pending_payment: 'pending_payment',
  completed: 'completed',
  failed_delivery: 'failed_delivery',
  ready_for_dispatch: 'ready_for_dispatch',
  awaiting_pickup: 'awaiting_pickup',
  en_route: 'en_route'
};

const NEXT_STAGE_OWNER: Record<OrderStatus, OrderStageOwner> = {
  pending_payment: 'system',
  ready_for_processing: 'processing',
  processing: 'processing',
  ready_for_dispatch: 'logistics',
  awaiting_pickup: 'logistics',
  en_route: 'rider',
  delivered: 'support',
  completed: 'system',
  cancelled: 'support',
  failed_delivery: 'logistics'
};

const TERMINAL_STATUSES: Set<OrderStatus> = new Set(['delivered', 'completed', 'cancelled']);

const generateHandoverCode = () => {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const hashed = crypto.createHash('sha256').update(code).digest('hex');
  const masked = `***-${code.slice(-4)}`;
  return { code, hashed, masked };
};

const normalizeStatus = (status: string): OrderStatus => {
  if (!status) {
    return 'ready_for_processing';
  }

  if ((Object.values(OrderStatusEnum) as string[]).includes(status)) {
    return status as OrderStatus;
  }

  const lowered = status.toLowerCase() as LegacyStatus;
  return STATUS_MAP[lowered] ?? 'ready_for_processing';
};

enum OrderStatusEnum {
  pending_payment = 'pending_payment',
  ready_for_processing = 'ready_for_processing',
  processing = 'processing',
  ready_for_dispatch = 'ready_for_dispatch',
  awaiting_pickup = 'awaiting_pickup',
  en_route = 'en_route',
  delivered = 'delivered',
  completed = 'completed',
  cancelled = 'cancelled',
  failed_delivery = 'failed_delivery'
}

const migrateOrder = async (order: IOrder) => {
  let changed = false;
  let generatedCode: string | null = null;

  // Normalize delivery info
  if (!order.deliveryInfo) {
    order.deliveryInfo = {
      address: 'Unknown address',
      city: 'Unknown city',
      state: 'Unknown state',
      phoneNumber: 'N/A'
    } as any;
    changed = true;
  } else if (!order.deliveryInfo.state) {
    order.deliveryInfo.state = 'Unknown state';
    changed = true;
  }

  // Normalize order status
  const originalStatus = order.orderStatus as string;
  const normalized = normalizeStatus(originalStatus);
  if (normalized !== order.orderStatus) {
    order.orderStatus = normalized;
    changed = true;
  }

  // Ensure current stage owner role
  const expectedOwner = NEXT_STAGE_OWNER[order.orderStatus] ?? 'support';
  if (order.currentStageOwnerRole !== expectedOwner) {
    order.currentStageOwnerRole = expectedOwner;
    changed = true;
  }

  // Normalize status history
  if (!Array.isArray(order.statusHistory)) {
    order.statusHistory = [];
    changed = true;
  }

  order.statusHistory = order.statusHistory.map((entry) => {
    const mappedStatus = normalizeStatus(entry.status as string);
    const timestamp = entry.timestamp ?? ((order as any).createdAt as Date | undefined) ?? new Date();
    return {
      ...entry,
      status: mappedStatus,
      timestamp,
      role: entry.role || 'system',
      updatedByName: entry.updatedByName || 'System'
    };
  });

  // Ensure final history entry matches current status
  const lastHistory = order.statusHistory[order.statusHistory.length - 1];
  if (!lastHistory || lastHistory.status !== order.orderStatus) {
    order.statusHistory.push({
      status: order.orderStatus,
      timestamp: new Date(),
      note: lastHistory?.note || `Status migrated to ${order.orderStatus}`,
      role: 'system',
      updatedByName: 'System'
    });
    changed = true;
  }

  // Handover code adjustments
  if (!order.handoverCodeHash && !TERMINAL_STATUSES.has(order.orderStatus)) {
    const { code, hashed, masked } = generateHandoverCode();
    order.handoverCodeHash = hashed;
    order.handoverCodeMasked = masked;
    order.handoverCodeIssuedAt = order.handoverCodeIssuedAt ?? new Date();
    order.handoverCodeActive = true;
    order.handoverCodeAttempts = 0;
    generatedCode = code;
    changed = true;
  } else {
    if (!order.handoverCodeMasked && order.handoverCodeHash) {
      order.handoverCodeMasked = '***-????';
      changed = true;
    }
    order.handoverCodeActive = !TERMINAL_STATUSES.has(order.orderStatus);
  }

  if (order.handoverCodeAttempts === undefined || order.handoverCodeAttempts === null) {
    order.handoverCodeAttempts = 0;
    changed = true;
  }

  if (TERMINAL_STATUSES.has(order.orderStatus)) {
    order.handoverCodeActive = false;
  }

  if (changed) {
    await order.save();
  }

  return { changed, generatedCode } as const;
};

(async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const orders = await Order.find();
  console.log(`Found ${orders.length} orders to evaluate`);

  let updatedCount = 0;
  let codesGenerated = 0;

  for (const order of orders) {
    const { changed, generatedCode } = await migrateOrder(order);
    if (changed) {
      updatedCount += 1;
      console.log(`Order ${order.orderNumber} updated -> status: ${order.orderStatus}`);
    }
    if (generatedCode) {
      codesGenerated += 1;
      console.log(`  New handover code generated for ${order.orderNumber}: ${generatedCode}`);
    }
  }

  console.log('Migration complete');
  console.log(`Orders updated: ${updatedCount}`);
  console.log(`New handover codes generated: ${codesGenerated}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
