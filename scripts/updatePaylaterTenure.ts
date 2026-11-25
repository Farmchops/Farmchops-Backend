/**
 * One-off: set the PayLater repayment tenure on the existing settings document
 * to 90 days (3 months). The schema/service defaults only apply when no settings
 * document exists yet, so an already-created document keeps its old value.
 *
 * Only affects loans created after this runs; existing loans keep their due date.
 *
 * Usage: npx ts-node scripts/updatePaylaterTenure.ts
 */
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PayLaterSettings } from '../src/models/PayLater';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URI;
const NEW_REPAYMENT_DAYS = 90;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment variables');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI as string);

  const settings = await PayLaterSettings.findOne();
  if (!settings) {
    console.log('No PayLater settings document found; defaults (90 days) will apply on first use.');
    return;
  }

  const previous = settings.defaultRepaymentDays;
  if (previous === NEW_REPAYMENT_DAYS) {
    console.log(`Repayment tenure already ${NEW_REPAYMENT_DAYS} days; nothing to do.`);
    return;
  }

  settings.defaultRepaymentDays = NEW_REPAYMENT_DAYS;
  await settings.save();
  console.log(`Updated PayLater repayment tenure: ${previous} -> ${NEW_REPAYMENT_DAYS} days`);
}

run()
  .catch((err) => {
    console.error('Failed to update PayLater tenure:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
