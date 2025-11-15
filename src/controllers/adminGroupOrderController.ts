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
    const { groupBuyingEnabled, totalSlots, quantityPerSlot, pricePerSlot, maxActiveGroups = 5 } = req.body;

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
      if (!totalSlots || !quantityPerSlot || !pricePerSlot) {
        return res.status(400).json({
          success: false,
          message: 'Total slots, quantity per slot, and price per slot are required when enabling group buying'
        });
      }

      if (totalSlots < 2 || totalSlots > 100) {
        return res.status(400).json({
          success: false,
          message: 'Total slots must be between 2 and 100'
        });
      }

      if (quantityPerSlot < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity per slot must be at least 1'
        });
      }

      if (pricePerSlot < 1) {
        return res.status(400).json({
          success: false,
          message: 'Price per slot must be at least 1 kobo'
        });
      }

      product.groupConfig = {
        totalSlots,
        quantityPerSlot,
        pricePerSlot,
        maxActiveGroups
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

    return res.json({
      success: true,
      message: groupBuyingEnabled ? 'Group buying enabled successfully' : 'Group buying disabled',
      data: {
        product: {
          _id: product._id,
          name: product.name,
          groupBuyingEnabled: product.groupBuyingEnabled,
          groupConfig: product.groupConfig
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
    const { status, productId } = req.query;

    const query: Record<string, any> = {};

    if (status && ['active', 'confirmed', 'cancelled'].includes(String(status))) {
      query.status = status;
    }

    if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
      query['product._id'] = new mongoose.Types.ObjectId(String(productId));
    }

    const groups = await GroupOrder.find(query).sort({ createdAt: -1 });

    // Calculate stats
    const stats = {
      totalActiveGroups: await GroupOrder.countDocuments({ status: 'active' }),
      totalConfirmedGroups: await GroupOrder.countDocuments({ status: 'confirmed' }),
      totalCancelledGroups: await GroupOrder.countDocuments({ status: 'cancelled' }),
      totalRevenue: groups
        .filter(g => g.status === 'confirmed')
        .reduce((sum, g) => sum + (g.pricePerSlot * g.filledSlots), 0)
    };

    return res.json({
      success: true,
      data: {
        groups: groups.map(g => ({
          groupId: g.groupId,
          product: g.product,
          totalSlots: g.totalSlots,
          filledSlots: g.filledSlots,
          quantityPerSlot: g.quantityPerSlot,
          pricePerSlot: g.pricePerSlot,
          status: g.status,
          participantsCount: g.participants.length,
          totalRevenue: g.pricePerSlot * g.filledSlots + g.participants.reduce((sum, p) => sum + p.deliveryFee, 0),
          createdAt: g.createdAt,
          confirmedAt: g.confirmedAt,
          cancelledAt: g.cancelledAt,
          cancelledReason: g.cancelledReason
        })),
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

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const group = await GroupOrder.findOne({ groupId });

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
      paymentStatus: p.paymentStatus,
      paymentReference: p.paymentReference,
      paidAt: p.paidAt,
      deliveryInfo: p.deliveryInfo,
      deliveryFee: p.deliveryFee,
      orderId: p.orderId,
      joinedAt: p.joinedAt
    }));

    return res.json({
      success: true,
      data: {
        group: {
          groupId: group.groupId,
          product: group.product,
          totalSlots: group.totalSlots,
          filledSlots: group.filledSlots,
          quantityPerSlot: group.quantityPerSlot,
          pricePerSlot: group.pricePerSlot,
          status: group.status,
          participants,
          totalRevenue: group.pricePerSlot * group.filledSlots + group.participants.reduce((sum, p) => sum + p.deliveryFee, 0),
          createdAt: group.createdAt,
          confirmedAt: group.confirmedAt,
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
      message: 'Group cancelled successfully. Refunds are being processed for all participants.',
      data: {
        group: {
          groupId: group.groupId,
          status: group.status,
          cancelledAt: group.cancelledAt,
          cancelledReason: group.cancelledReason,
          participantsCount: group.participants.length,
          totalRefunds: group.participants.reduce((sum, p) => sum + p.amount + p.deliveryFee, 0)
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
 * Manually create a new group for a product
 */
export const createGroup = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { productId } = req.params;

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
          totalSlots: group.totalSlots,
          quantityPerSlot: group.quantityPerSlot,
          pricePerSlot: group.pricePerSlot,
          status: group.status,
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
