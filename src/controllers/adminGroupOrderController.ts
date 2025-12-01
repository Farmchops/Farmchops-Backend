import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GroupOrderService, GroupOrderError } from '../services/groupOrderService';
import { Product } from '../models/Product';
import { GroupOrder } from '../models/GroupOrder';
import mongoose from 'mongoose';

/**
 * POST /api/admin/products/:productId/group-config
 * Enable/configure group buying for a product
 */
export const configureGroupBuying = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { productId } = req.params;
    // Support both 'enabled' (from frontend) and 'groupBuyingEnabled' (backend standard)
    const groupBuyingEnabled = req.body.groupBuyingEnabled ?? req.body.enabled;
    const {
      minParticipants,
      maxParticipants,
      quantityPerPerson,
      targetQuantity,
      bulkPricePerUnit,
      deadlineHours = 168, // Default: 7 days
      maxActiveGroups = 3,
      checkoutWindowHours = 48 // Default: 48 hours
    } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update group buying configuration
    product.groupBuyingEnabled = groupBuyingEnabled;

    if (groupBuyingEnabled) {
      // Validate configuration
      if (!minParticipants || !maxParticipants || !quantityPerPerson || !targetQuantity || !bulkPricePerUnit) {
        return res.status(400).json({
          success: false,
          message: 'minParticipants, maxParticipants, quantityPerPerson, targetQuantity, and bulkPricePerUnit are required when enabling group buying'
        });
      }

      if (minParticipants < 2 || minParticipants > maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'minParticipants must be at least 2 and not greater than maxParticipants'
        });
      }

      if (maxParticipants < 2 || maxParticipants > 100) {
        return res.status(400).json({
          success: false,
          message: 'maxParticipants must be between 2 and 100'
        });
      }

      if (!quantityPerPerson.min || !quantityPerPerson.max || quantityPerPerson.min < 1) {
        return res.status(400).json({
          success: false,
          message: 'quantityPerPerson.min must be at least 1'
        });
      }

      if (quantityPerPerson.max < quantityPerPerson.min) {
        return res.status(400).json({
          success: false,
          message: 'quantityPerPerson.max must be greater than or equal to quantityPerPerson.min'
        });
      }

      if (targetQuantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'targetQuantity must be at least 1'
        });
      }

      if (bulkPricePerUnit < 1) {
        return res.status(400).json({
          success: false,
          message: 'bulkPricePerUnit must be at least 1 kobo'
        });
      }

      if (deadlineHours < 24) {
        return res.status(400).json({
          success: false,
          message: 'deadlineHours must be at least 24 hours'
        });
      }

      if (checkoutWindowHours < 24) {
        return res.status(400).json({
          success: false,
          message: 'checkoutWindowHours must be at least 24 hours'
        });
      }

      product.groupConfig = {
        minParticipants,
        maxParticipants,
        quantityPerPerson: {
          min: quantityPerPerson.min,
          max: quantityPerPerson.max
        },
        targetQuantity,
        bulkPricePerUnit: Math.round(bulkPricePerUnit * 100), // Convert naira to kobo (backend stores in kobo)
        deadlineHours,
        maxActiveGroups,
        checkoutWindowHours
      };

      await product.save();

      // Auto-create first group
      if (product._id) {
        await GroupOrderService.createGroup({ productId: product._id as mongoose.Types.ObjectId });
      }
    } else {
      product.groupConfig = undefined;
      await product.save();
    }

    // Reload product to get the saved state with all fields
    const savedProduct = await Product.findById(productId).lean();

    return res.json({
      success: true,
      message: groupBuyingEnabled ? 'Group buying enabled successfully' : 'Group buying disabled',
      data: {
        product: {
          _id: savedProduct?._id,
          name: savedProduct?.name,
          groupBuyingEnabled: savedProduct?.groupBuyingEnabled,
          groupConfig: savedProduct?.groupConfig
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to configure group buying'
    });
  }
};

/**
 * GET /api/admin/group-orders
 * Get all groups with admin stats
 */
export const getAllGroups = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { phase, productId } = req.query;

    const query: Record<string, any> = {};

    if (phase && ['filling', 'checkout_window', 'confirmed', 'expired', 'cancelled'].includes(String(phase))) {
      query.phase = phase;
    }

    if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
      query['product._id'] = new mongoose.Types.ObjectId(String(productId));
    }

    const groups = await GroupOrder.find(query).sort({ createdAt: -1 });

    // Calculate stats
    const stats = {
      totalFillingGroups: await GroupOrder.countDocuments({ phase: 'filling' }),
      totalCheckoutWindowGroups: await GroupOrder.countDocuments({ phase: 'checkout_window' }),
      totalConfirmedGroups: await GroupOrder.countDocuments({ phase: 'confirmed' }),
      totalExpiredGroups: await GroupOrder.countDocuments({ phase: 'expired' }),
      totalCancelledGroups: await GroupOrder.countDocuments({ phase: 'cancelled' }),
      totalRevenue: groups
        .filter(g => g.phase === 'confirmed')
        .reduce((sum, g) => sum + g.participants
          .filter(p => p.status === 'paid')
          .reduce((pSum, p) => pSum + p.amount + (p.deliveryFee || 0), 0), 0)
    };

    // Return mapped groups
    const mapped = groups.map(g => {
      const totalRevenue = g.participants
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount + (p.deliveryFee || 0), 0);

      return {
        groupId: g.groupId,
        product: g.product,
        minParticipants: g.minParticipants,
        maxParticipants: g.maxParticipants,
        reservedSlots: g.reservedSlots,
        paidSlots: g.paidSlots,
        quantityPerPerson: g.quantityPerPerson,
        bulkPricePerUnit: g.bulkPricePerUnit,
        phase: g.phase,
        participantsCount: g.participants.filter(p => p.status !== 'removed').length,
        waitlistCount: g.waitlist.length,
        totalRevenue,
        fillWindowExpiresAt: g.fillWindowExpiresAt,
        checkoutWindowOpensAt: g.checkoutWindowOpensAt,
        checkoutWindowClosesAt: g.checkoutWindowClosesAt,
        createdAt: g.createdAt,
        groupFilledAt: g.groupFilledAt,
        confirmedAt: g.confirmedAt,
        expiredAt: g.expiredAt,
        cancelledAt: g.cancelledAt,
        cancelledReason: g.cancelledReason
      };
    });

    return res.json({
      success: true,
      // legacy top-level fields some frontends still expect
      groups: mapped,
      stats,
      // new nested envelope
      data: {
        groups: mapped,
        stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch groups'
    });
  }
};

/**
 * GET /api/admin/group-orders/:groupId
 * Get detailed group information
 */
export const getGroupDetailsAdmin = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;

    // Debug: log what groupId we're looking for
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[DEV] getGroupDetailsAdmin called. groupId:', groupId, 'params:', req.params);
    }

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const group = await GroupOrder.findOne({ groupId });

    // Debug: log whether we found the group
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[DEV] Group lookup result:', group ? `Found: ${group.groupId}` : 'Not found');
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Full participant details for admin
    const participants = group.participants.map(p => ({
      id: p.id,
      userId: p.userId,
      user: p.user,
      quantity: p.quantity,
      amount: p.amount,
      status: p.status,
      paymentReference: p.paymentReference,
      reservedAt: p.reservedAt,
      paidAt: p.paidAt,
      checkoutDeadline: p.checkoutDeadline,
      removedAt: p.removedAt,
      deliveryInfo: p.deliveryInfo,
      deliveryFee: p.deliveryFee,
      orderId: p.orderId
    }));

    // Waitlist details for admin
    const waitlist = group.waitlist.map(w => ({
      userId: w.userId,
      user: w.user,
      quantity: w.quantity,
      joinedAt: w.joinedAt,
      notifiedAt: w.notifiedAt,
      promotionDeadline: w.promotionDeadline
    }));

    const totalRevenue = group.participants
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount + (p.deliveryFee || 0), 0);

    return res.json({
      success: true,
      data: {
        group: {
          groupId: group.groupId,
          product: group.product,
          minParticipants: group.minParticipants,
          maxParticipants: group.maxParticipants,
          quantityPerPerson: group.quantityPerPerson,
          targetQuantity: group.targetQuantity,
          bulkPricePerUnit: group.bulkPricePerUnit,
          deadlineHours: group.deadlineHours,
          checkoutWindowDurationHours: group.checkoutWindowDurationHours,
          phase: group.phase,
          reservedSlots: group.reservedSlots,
          paidSlots: group.paidSlots,
          participants,
          waitlist,
          shareableCode: group.shareableCode,
          shareableLink: group.getShareableLink(),
          fillWindowExpiresAt: group.fillWindowExpiresAt,
          checkoutWindowOpensAt: group.checkoutWindowOpensAt,
          checkoutWindowClosesAt: group.checkoutWindowClosesAt,
          totalRevenue,
          createdAt: group.createdAt,
          groupFilledAt: group.groupFilledAt,
          confirmedAt: group.confirmedAt,
          expiredAt: group.expiredAt,
          cancelledAt: group.cancelledAt,
          cancelledReason: group.cancelledReason
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch group details'
    });
  }
};

/**
 * POST /api/admin/group-orders/:groupId/cancel
 * Cancel a group (admin only)
 */
export const cancelGroup = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;
    const { reason } = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const group = await GroupOrderService.cancelGroup(groupId, reason);

    return res.json({
      success: true,
      message: 'Group cancelled successfully. Refunds are being processed for all paid participants.',
      data: {
        group: {
          groupId: group.groupId,
          phase: group.phase,
          cancelledAt: group.cancelledAt,
          cancelledReason: group.cancelledReason,
          participantsCount: group.participants.filter(p => p.status !== 'removed').length,
          paidParticipantsCount: group.participants.filter(p => p.status === 'paid').length,
          totalRefunds: group.participants
            .filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + p.amount + (p.deliveryFee || 0), 0)
        }
      }
    });
  } catch (error) {
    if (error instanceof GroupOrderError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel group'
    });
  }
};

/**
 * POST /api/admin/products/:productId/create-group
 * Manually create a new group for a product (URL param version)
 */
export const createGroup = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // Debug: log request in dev to help trace why this endpoint fails for some clients
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[DEV] createGroup called. params:', req.params, 'body:', req.body, 'headers:', {
        origin: req.headers.origin,
        authorization: req.headers.authorization ? 'present' : 'missing'
      });
    }

    // Try both params and body for productId
    const productId = req.params.productId || req.body.productId;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const group = await GroupOrderService.createGroup({
      productId: new mongoose.Types.ObjectId(productId)
    });

    return res.json({
      success: true,
      message: 'Group created successfully',
      data: {
        group: {
          groupId: group.groupId,
          product: group.product,
          minParticipants: group.minParticipants,
          maxParticipants: group.maxParticipants,
          quantityPerPerson: group.quantityPerPerson,
          targetQuantity: group.targetQuantity,
          bulkPricePerUnit: group.bulkPricePerUnit,
          phase: group.phase,
          shareableCode: group.shareableCode,
          shareableLink: group.getShareableLink(),
          createdAt: group.createdAt
        }
      }
    });
  } catch (error) {
    if (error instanceof GroupOrderError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create group'
    });
  }
};
