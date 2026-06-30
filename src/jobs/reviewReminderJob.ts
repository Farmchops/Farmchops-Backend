import cron from 'node-cron';
import { Review } from '../models/Review';
import emailService from '../services/emailService';

const FIRST_REMINDER_DELAY_DAYS = 3;
const SECOND_REMINDER_DELAY_DAYS = 4; // days after first reminder
const MAX_REMINDERS = 2;

export const startReviewReminderJob = () => {
  // Run once every day at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('[CRON] Running review reminder job...');

      const now = new Date();
      const firstReminderCutoff = new Date(now.getTime() - FIRST_REMINDER_DELAY_DAYS * 24 * 60 * 60 * 1000);
      const secondReminderCutoff = new Date(now.getTime() - SECOND_REMINDER_DELAY_DAYS * 24 * 60 * 60 * 1000);

      // Fetch unsubmitted, non-expired reviews that still have reminders left
      const pendingReviews = await Review.find({
        isSubmitted: false,
        tokenExpiresAt: { $gt: now },
        reminderCount: { $lt: MAX_REMINDERS },
        createdAt: { $lte: firstReminderCutoff }, // at least 3 days old
      })
        .populate('buyerId', 'firstName email')
        .populate('orderId', 'orderNumber');

      if (pendingReviews.length === 0) {
        console.log('[CRON] No review reminders to send');
        return;
      }

      console.log(`[CRON] Found ${pendingReviews.length} reviews eligible for a reminder`);

      const frontendUrl = process.env.FRONTEND_URL || 'https://farmchops.com';

      for (const review of pendingReviews) {
        try {
          // Second reminder requires 4 days gap since the last one was sent
          if (review.reminderCount === 1) {
            if (!review.lastReminderSentAt || review.lastReminderSentAt > secondReminderCutoff) {
              continue;
            }
          }

          const buyer = review.buyerId as any;
          const order = review.orderId as any;

          if (!buyer?.email || !order?.orderNumber) continue;

          const reviewUrl = `${frontendUrl}/review?token=${review.token}`;
          const customerName = (buyer.firstName as string || '').trim() || 'there';

          await emailService.sendOrderReviewRequestEmail(buyer.email, {
            customerName,
            orderNumber: order.orderNumber,
            reviewUrl,
          });

          review.reminderCount += 1;
          review.lastReminderSentAt = now;
          await review.save();

          console.log(`[CRON] Reminder ${review.reminderCount} sent for order ${order.orderNumber} → ${buyer.email}`);
        } catch (err) {
          console.error(`[CRON] Failed to send reminder for review ${review._id}:`, err);
        }
      }

      console.log('[CRON] Review reminder job completed');
    } catch (error) {
      console.error('[CRON] Error in review reminder job:', error);
    }
  });

  console.log('[CRON] Review reminder job started (runs daily at 10:00 AM)');
};
