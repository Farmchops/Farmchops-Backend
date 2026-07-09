import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

import alatPayService from '../src/config/alatpay';

const transactionId = process.argv[2];

if (!transactionId) {
  console.error('Usage: ts-node scripts/checkAlatTransaction.ts <transactionId>');
  process.exit(1);
}

(async () => {
  try {
    const response = await alatPayService.verifyTransaction(transactionId);
    console.log(JSON.stringify(response, null, 2));
  } catch (error: any) {
    console.error('Failed to fetch transaction:', error.message);
    process.exit(1);
  }
})();
