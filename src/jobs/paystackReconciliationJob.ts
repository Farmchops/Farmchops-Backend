import cron from 'node-cron';
import { reconcilePendingPaystackOrders } from '../services/paystackReconciliationService';

export const startPaystackReconciliationJob = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { checked, reconciled } = await reconcilePendingPaystackOrders();
      if (checked > 0) {
        console.log(`[CRON] Paystack reconciliation: checked ${checked} pending order(s), reconciled ${reconciled}`);
      }
    } catch (error) {
      console.error('[CRON] Error in Paystack reconciliation job:', error);
    }
  });

  console.log('[CRON] Paystack reconciliation job started (runs every 5 minutes)');
};
