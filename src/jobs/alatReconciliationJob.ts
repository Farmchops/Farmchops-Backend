import cron from 'node-cron';
import { reconcilePendingAlatOrders } from '../services/alatReconciliationService';

export const startAlatReconciliationJob = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { checked, reconciled } = await reconcilePendingAlatOrders();
      if (checked > 0) {
        console.log(`[CRON] ALAT reconciliation: checked ${checked} pending order(s), reconciled ${reconciled}`);
      }
    } catch (error) {
      console.error('[CRON] Error in ALAT reconciliation job:', error);
    }
  });

  console.log('[CRON] ALAT reconciliation job started (runs every 5 minutes)');
};
