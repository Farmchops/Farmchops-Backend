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

    const result = await performAction({
      orderId: id,
      action: 'confirm-delivery',
      user: req.user,
      payload: req.body || {}
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

    const query = {
      'assignedRider.rider': req.user._id,
      orderStatus: { $in: ['awaiting_pickup', 'en_route', 'failed_delivery'] }
    } as Record<string, unknown>;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'firstName lastName phone')
        .skip(skip)
        .limit(limit)
        .sort({ updatedAt: -1 }),
      Order.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        orders,
        page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};
