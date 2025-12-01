import cron from 'node-cron';
import { GroupOrder } from '../models/GroupOrder';

/**
 * Cron job to auto-dissolve unfilled groups past their fill window expiry
 * Runs every 10 minutes
 */
export const startGroupOrderExpiryJob = () => {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log('[CRON] Checking for expired unfilled groups...');

      const now = new Date();

      // Find all groups that are:
      // 1. In 'filling' phase (not filled yet)
      // 2. Past their fillWindowExpiresAt time
      const expiredGroups = await GroupOrder.find({
        phase: 'filling',
        fillWindowExpiresAt: { $lte: now }
      });

      if (expiredGroups.length === 0) {
        console.log('[CRON] No expired groups found');
        return;
      }

      console.log(`[CRON] Found ${expiredGroups.length} expired groups to dissolve`);

      // Dissolve each expired group
      for (const group of expiredGroups) {
        try {
          group.phase = 'expired';
          group.expiredAt = now;
          await group.save();

          console.log(`[CRON] Dissolved group ${group.groupId} - ${group.participants.length} participants, ${group.waitlist.length} waitlisted`);
        } catch (error) {
          console.error(`[CRON] Error dissolving group ${group.groupId}:`, error);
        }
      }

      console.log('[CRON] Group expiry check completed');
    } catch (error) {
      console.error('[CRON] Error in group expiry job:', error);
    }
  });

  console.log('[CRON] Group order expiry job started (runs every 10 minutes)');
};

/**
 * Cron job to check for expired checkout windows
 * Runs every 30 minutes
 */
export const startCheckoutWindowExpiryJob = () => {
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('[CRON] Checking for expired checkout windows...');

      const now = new Date();

      // Find groups in checkout_window phase that have expired
      const expiredCheckoutGroups = await GroupOrder.find({
        phase: 'checkout_window',
        checkoutWindowClosesAt: { $lte: now }
      });

      if (expiredCheckoutGroups.length === 0) {
        console.log('[CRON] No expired checkout windows found');
        return;
      }

      console.log(`[CRON] Found ${expiredCheckoutGroups.length} groups with expired checkout windows`);

      for (const group of expiredCheckoutGroups) {
        try {
          // Check if anyone has paid
          const paidCount = group.participants.filter(p => p.status === 'paid').length;

          if (paidCount === 0) {
            // No one paid - expire the group
            group.phase = 'expired';
            group.expiredAt = now;
            console.log(`[CRON] Expired group ${group.groupId} - no payments received`);
          } else {
            // Some people paid - keep it but mark as expired for unpaid participants
            group.phase = 'expired';
            group.expiredAt = now;
            console.log(`[CRON] Expired group ${group.groupId} - ${paidCount} paid participants`);
          }

          await group.save();
        } catch (error) {
          console.error(`[CRON] Error expiring checkout window for group ${group.groupId}:`, error);
        }
      }

      console.log('[CRON] Checkout window expiry check completed');
    } catch (error) {
      console.error('[CRON] Error in checkout window expiry job:', error);
    }
  });

  console.log('[CRON] Checkout window expiry job started (runs every 30 minutes)');
};
