import { Router } from 'express';
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  changeVendorStatus,
  uploadVendorDoc
} from '../controllers/vendorController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { body } from 'express-validator';
import { uploadVendorDoc as uploadVendorDocMiddleware } from '../middleware/uploadMiddleware';

const router = Router();

// POST /api/vendors - create vendor application (public)
// Public endpoint so vendors can apply without creating an account. Server will
// not store sensitive NIN data (do not include NIN in the schema).
// Accept both application/json and multipart/form-data (from browser forms).
// If the frontend posts a file, it should use the separate /:id/doc endpoint.
router.post('/',
  // Parse multipart form fields if the client used form-data (no files expected here)
  uploadVendorDocMiddleware.none(),
  body('firstName').isString().notEmpty(),
  body('address').isString().notEmpty(),
  // NIN is required by frontend but will NOT be stored in DB. We validate format here.
  body('nin').isString().isLength({ min: 6, max: 20 }).withMessage('Invalid NIN'),
  createVendor
);

// Upload vendor ID document (owner or admin)
router.post('/:id/doc', authenticateToken, uploadVendorDocMiddleware.single('idDoc'), uploadVendorDoc);

// GET /api/vendors - list (admin only)
router.get('/', authenticateToken, requireAdmin, getVendors);

// GET /api/vendors/:id - get vendor (owner or admin)
router.get('/:id', authenticateToken, getVendorById);

// PUT /api/vendors/:id - update (owner or admin)
router.put('/:id', authenticateToken, updateVendor);

// PATCH /api/vendors/:id/status - admin only
router.patch('/:id/status', authenticateToken, requireAdmin, changeVendorStatus);

export default router;
