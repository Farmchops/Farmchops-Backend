import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { body } from 'express-validator';
import adminCtrl from '../controllers/adminVendorController';

const router = Router();

// All routes require admin token
router.use(authenticateToken, requireAdmin);

// PUT /admin/vendors/:id/status
router.put('/:id/status',
  body('status').isString().notEmpty(),
  adminCtrl.changeVendorStatusAdmin
);

// POST /admin/vendors/:id/contact
router.post('/:id/contact',
  body('note').isString().notEmpty(),
  adminCtrl.postVendorContact
);

// POST /admin/vendors/:id/request-info
router.post('/:id/request-info',
  body('message').isString().notEmpty(),
  adminCtrl.postVendorRequestInfo
);

// POST /admin/vendors/:id/notes
router.post('/:id/notes',
  body('text').isString().notEmpty(),
  adminCtrl.postVendorNote
);

// GET /admin/vendors
router.get('/', adminCtrl.listVendorsAdmin);

// GET /admin/vendors/:id
router.get('/:id', adminCtrl.getVendorDetailAdmin);

// DELETE /admin/vendors/:id
router.delete('/:id', adminCtrl.deleteVendorAdmin);

export default router;
