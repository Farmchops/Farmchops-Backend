import { Router } from 'express';
import {
  getWalletBalance,
  getWalletTransactions,
  initializeWalletFunding,
  verifyWalletFunding,
  debitWallet
} from '../controllers/walletController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All wallet routes require authentication
router.use(authenticateToken);

// GET /api/wallet/balance - Get user's wallet balance
router.get('/balance', getWalletBalance);

// GET /api/wallet/transactions - Get transaction history
router.get('/transactions', getWalletTransactions);

// POST /api/wallet/fund - Initialize wallet funding via Paystack
router.post('/fund', initializeWalletFunding);

// GET /api/wallet/verify/:reference - Verify wallet funding transaction
router.get('/verify/:reference', verifyWalletFunding);

// POST /api/wallet/debit - Debit wallet (for order payment)
router.post('/debit', debitWallet);

export default router;
