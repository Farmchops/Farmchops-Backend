import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GroupOrderService, GroupOrderError } from '../services/groupOrderService';
import mongoose from 'mongoose';

/**
 * GET /api/group-orders/active
 * Get all active groups
 */
export const getActiveGroups = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { productId } = req.query;

    let groups;
    if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
      groups = await GroupOrderService.getActiveGroupsForProduct(new mongoose.Types.ObjectId(String(productId)));
    } else {
      groups = await GroupOrderService.getAllActiveGroups();
    }

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
          createdAt: g.createdAt,
          participantsCount: g.participants.length
        }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch active groups'
    });
  }
};

/**
 * POST /api/group-orders/:groupId/join
 * Join a group
 */
export const joinGroup = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;
    const { deliveryInfo, paymentReference, deliveryFee = 0 } = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // Validate delivery info
    if (!deliveryInfo || !deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.state || !deliveryInfo.phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Complete delivery information required'
      });
    }

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference required'
      });
    }

    const result = await GroupOrderService.joinGroup({
      groupId,
      userId: req.user._id as mongoose.Types.ObjectId,
      deliveryInfo,
      paymentReference,
      deliveryFee
    });

    if (result.autoConfirmed) {
      return res.json({
        success: true,
        message: 'Group is now full! Your order has been created.',
        data: {
          groupId: result.group.groupId,
          filledSlots: result.group.filledSlots,
          totalSlots: result.group.totalSlots,
          status: result.group.status,
          order: result.orders && result.orders.length > 0 ? {
            orderNumber: result.orders.find(o => o.user.equals(req.user?._id))?.orderNumber,
            orderStatus: 'ready_for_processing'
          } : null
        }
      });
    }

    return res.json({
      success: true,
      message: 'Successfully joined the group',
      data: {
        groupId: result.group.groupId,
        filledSlots: result.group.filledSlots,
        totalSlots: result.group.totalSlots,
        status: result.group.status
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
      message: error instanceof Error ? error.message : 'Failed to join group'
    });
  }
};

/**
 * POST /api/group-orders/:groupId/leave
 * Leave a group
 */
export const leaveGroup = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const result = await GroupOrderService.leaveGroup({
      groupId,
      userId: req.user._id as mongoose.Types.ObjectId
    });

    return res.json({
      success: true,
      message: 'Successfully left the group. Refund is being processed.',
      data: {
        refund: {
          amount: result.refundAmount,
          status: 'processing'
        },
        group: {
          groupId: result.group.groupId,
          filledSlots: result.group.filledSlots,
          totalSlots: result.group.totalSlots
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
      message: error instanceof Error ? error.message : 'Failed to leave group'
    });
  }
};

/**
 * GET /api/users/me/group-orders
 * Get current user's group participations
 */
export const getMyGroups = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const groups = await GroupOrderService.getUserGroups(req.user._id as mongoose.Types.ObjectId);

    return res.json({
      success: true,
      data: {
        groups: groups.map(g => {
          const myParticipation = g.participants.find(p => req.user && p.userId.equals(req.user._id as mongoose.Types.ObjectId));
          return {
            groupId: g.groupId,
            product: g.product,
            filledSlots: g.filledSlots,
            totalSlots: g.totalSlots,
            status: g.status,
            createdAt: g.createdAt,
            confirmedAt: g.confirmedAt,
            myParticipation: myParticipation ? {
              amount: myParticipation.amount,
              quantity: myParticipation.quantity,
              paymentStatus: myParticipation.paymentStatus,
              orderId: myParticipation.orderId,
              joinedAt: myParticipation.joinedAt
            } : null
          };
        })
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch your groups'
    });
  }
};

/**
 * GET /api/group-orders/:groupId
 * Get group details
 */
export const getGroupDetails = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const { GroupOrder } = await import('../models/GroupOrder');
    const group = await GroupOrder.findOne({ groupId });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Hide sensitive participant data
    const sanitizedParticipants = group.participants.map(p => ({
      id: p.id,
      user: {
        firstName: p.user.firstName,
        lastName: p.user.lastName.charAt(0) + '***' // Hide last name
      },
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
          participants: sanitizedParticipants,
          createdAt: group.createdAt,
          confirmedAt: group.confirmedAt
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
