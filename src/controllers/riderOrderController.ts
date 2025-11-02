import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { performAction, OrderWorkflowError, getAvailableActions } from '../services/orderWorkflowService';
import { Order } from '../models/Order';

export const confirmDelivery = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

  const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const payload = { ...req.body } as Record<string, any>;
    if (!payload.handoverCode && typeof payload.customerHandoverCode === 'string') {
      payload.handoverCode = payload.customerHandoverCode;
    }
    if (!payload.handoverCode && typeof payload.code === 'string') {
      payload.handoverCode = payload.code;
    }
    if (!payload.handoverCode && typeof payload.handover_code === 'string') {
      payload.handoverCode = payload.handover_code;
    }
    if (typeof payload.handoverCode === 'string') {
      payload.handoverCode = payload.handoverCode.trim();
    }

    if (!payload.proof && req.file) {
      payload.proof = {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      };
    }

    const result = await performAction({
      orderId: id,
      action: 'confirm-delivery',
      user: req.user,
      payload
    });

    await result.order.populate({ path: 'user', select: 'firstName lastName phone' });

    const actions = getAvailableActions(result.order, req.user);

    return res.json({
      success: true,
      message: 'Delivery confirmed',
      data: {
        order: result.order,
        transition: {
          from: result.previousStatus,
          to: result.order.orderStatus,
          action: result.action
        },
        availableActions: actions
      }
    });
  } catch (error) {
    if (error instanceof OrderWorkflowError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details
      });
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
};

export const getAssignedOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const riderId = req.user._id as mongoose.Types.ObjectId;

    const activeQuery = {
      'assignedRider.rider': riderId,
      orderStatus: { $in: ['awaiting_pickup', 'en_route', 'failed_delivery'] }
    } as Record<string, unknown>;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [orders, total, awaitingPickup, enRoute, deliveredToday, totalWithRider] = await Promise.all([
      Order.find(activeQuery)
        .populate('user', 'firstName lastName phone')
        .skip(skip)
        .limit(limit)
        .sort({ updatedAt: -1 }),
      Order.countDocuments(activeQuery),
      Order.countDocuments({ 'assignedRider.rider': riderId, orderStatus: 'awaiting_pickup' }),
      Order.countDocuments({ 'assignedRider.rider': riderId, orderStatus: 'en_route' }),
      Order.countDocuments({
        'assignedRider.rider': riderId,
        orderStatus: 'delivered',
        handoverVerifiedAt: { $gte: startOfToday, $lte: endOfToday }
      }),
      Order.countDocuments({ 'assignedRider.rider': riderId })
    ]);

    const otherStatuses = Math.max(totalWithRider - awaitingPickup - enRoute - deliveredToday, 0);

    return res.json({
      success: true,
      data: {
        orders,
        page,
        pageSize: limit,
        total,
        metrics: {
          awaitingPickup,
          enRoute,
          deliveredToday,
          otherStatuses
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};
