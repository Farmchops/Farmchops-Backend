import { Router } from 'express';
import {
  createMarketer,
  getAllMarketers,
  getMarketerById,
  updateMarketer,
  deleteMarketer,
  getMarketerReport,
  payCommission,
  getMarketersSummaryReport
} from '../controllers/marketerController';
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  getCouponReport
} from '../controllers/couponController';
import { authenticateToken, requirePermission, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// ============================================
// MARKETER ROUTES
// ============================================

// POST /api/admin/marketers - Create marketer
router.post(
  '/marketers',
  authenticateToken,
  requirePermission('manage_marketing'),
  createMarketer
);

// GET /api/admin/marketers - Get all marketers
router.get(
  '/marketers',
  authenticateToken,
  requirePermission('manage_marketing'),
  getAllMarketers
);

// GET /api/admin/marketers/:marketerId - Get single marketer
router.get(
  '/marketers/:marketerId',
  authenticateToken,
  requirePermission('manage_marketing'),
  getMarketerById
);

// PUT /api/admin/marketers/:marketerId - Update marketer
router.put(
  '/marketers/:marketerId',
  authenticateToken,
  requirePermission('manage_marketing'),
  updateMarketer
);

// DELETE /api/admin/marketers/:marketerId - Delete marketer (soft delete)
router.delete(
  '/marketers/:marketerId',
  authenticateToken,
  requireSuperAdmin,
  deleteMarketer
);

// GET /api/admin/marketers/:marketerId/report - Get marketer performance report
router.get(
  '/marketers/:marketerId/report',
  authenticateToken,
  requirePermission('manage_marketing'),
  getMarketerReport
);

// POST /api/admin/marketers/:marketerId/pay-commission - Pay commission
router.post(
  '/marketers/:marketerId/pay-commission',
  authenticateToken,
  requirePermission('manage_marketing'),
  payCommission
);

// GET /api/admin/reports/marketers - Get all marketers summary report
router.get(
  '/reports/marketers',
  authenticateToken,
  requirePermission('manage_marketing'),
  getMarketersSummaryReport
);

// ============================================
// COUPON ROUTES (Admin)
// ============================================

// POST /api/admin/coupons - Create coupon
router.post(
  '/coupons',
  authenticateToken,
  requirePermission('manage_marketing'),
  createCoupon
);

// GET /api/admin/coupons - Get all coupons
router.get(
  '/coupons',
  authenticateToken,
  requirePermission('manage_marketing'),
  getAllCoupons
);

// GET /api/admin/coupons/:couponId - Get single coupon
router.get(
  '/coupons/:couponId',
  authenticateToken,
  requirePermission('manage_marketing'),
  getCouponById
);

// PUT /api/admin/coupons/:couponId - Update coupon
router.put(
  '/coupons/:couponId',
  authenticateToken,
  requirePermission('manage_marketing'),
  updateCoupon
);

// DELETE /api/admin/coupons/:couponId - Delete coupon (soft delete)
router.delete(
  '/coupons/:couponId',
  authenticateToken,
  requireSuperAdmin,
  deleteCoupon
);

// GET /api/admin/coupons/:couponId/report - Get coupon usage report
router.get(
  '/coupons/:couponId/report',
  authenticateToken,
  requirePermission('manage_marketing'),
  getCouponReport
);

export default router;
