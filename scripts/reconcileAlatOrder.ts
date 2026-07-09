import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment variables');
  process.exit(1);
}

import { Order } from '../src/models/Order';
import alatPayService from '../src/config/alatpay';
import { confirmAlatOrderPayment } from '../src/services/alatReconciliationService';

const orderNumber = process.argv[2];
const transactionId = process.argv[3];

if (!orderNumber || !transactionId) {
  console.error('Usage: ts-node scripts/reconcileAlatOrder.ts <orderNumber> <transactionId>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(MONGODB_URI as string);

  try {
    const order = await Order.findOne({ orderNumber }).select('+handoverCodePlain');
    if (!order) {
      console.error(`Order ${orderNumber} not found`);
      process.exit(1);
    }

    if (order.paymentStatus === 'paid') {
      console.log(`Order ${orderNumber} is already marked paid — nothing to do`);
      process.exit(0);
    }

    const alatResponse = await alatPayService.verifyTransaction(transactionId);
    const data = alatResponse?.data || alatResponse?.Data || alatResponse;
    const status = String(data?.status || data?.Status || '').toLowerCase();

    if (status !== 'completed') {
      console.error(`Transaction ${transactionId} is not completed (status: ${status || 'unknown'})`);
      process.exit(1);
    }

    await confirmAlatOrderPayment(order, transactionId, data);
    console.log(`Order ${orderNumber} reconciled successfully — now paid / ready_for_processing`);
  } finally {
    await mongoose.disconnect();
  }
})();
