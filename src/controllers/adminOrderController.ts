import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { Order, IOrder } from '../models/Order';
import { AuthRequest } from '../middleware/auth';
import { performAction, OrderWorkflowError, WorkflowAction, getAvailableActions, getWorkflowConfig } from '../services/orderWorkflowService';


// GET /api/admin/orders?search=&status=&page=&limit=&sort=
export const getOrders = async (req: Request, res: Response) => {
  try {
    const {
      search = '',
      status = '',
      page = 1,
      limit = 20,
      sort = '-createdAt',
      date
    } = req.query as any;

    const query: any = {};

    // Filter by status
    if (status && status !== 'all') {
      query.orderStatus = status;
    }

    // Search by order number or customer name
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by date (YYYY-MM-DD)
    if (date) {
      const start = new Date(date + 'T00:00:00.000Z');
      const end = new Date(date + 'T23:59:59.999Z');
      query.createdAt = { $gte: start, $lte: end };
    }

        // Populate user for customer name/email search using firstName/lastName/email
    let userMatch = null;
    if (search) {
      userMatch = await mongoose.model('User').find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }, '_id');
      if (userMatch.length) {
        query.$or.push({ user: { $in: userMatch.map((u: any) => u._id) } });
      }
    }

    const orders = await Order.find(query)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .populate('assignedRider.rider', 'firstName lastName phone adminRole')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        total,
        page: Number(page),
        pageSize: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/orders/:id - Get order details by ID
export const getOrderById = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { id } = req.params as { id: string };

    // Validate order ID exists
    if (!id) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const order = await Order.findById(id)
      .populate('user', 'firstName lastName email phone')
      .populate('items.product', 'name images')
      .populate('assignedRider.rider', 'firstName lastName phone adminRole')
      .populate('statusHistory.updatedBy', 'firstName lastName email adminRole');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const availableActions = req.user ? getAvailableActions(order, req.user) : [];

    return res.json({
      success: true,
      data: {
        order,
        availableActions
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// Helper to populate commonly queried order paths
const populateOrder = async (order: IOrder | null) => {
  if (!order) return order;

  await order.populate([
    { path: 'user', select: 'firstName lastName email phone adminRole' },
    { path: 'items.product', select: 'name images' },
    { path: 'assignedRider.rider', select: 'firstName lastName phone adminRole' },
    { path: 'statusHistory.updatedBy', select: 'firstName lastName email adminRole' }
  ]);

  return order;
};

const createActionHandler = (action: WorkflowAction) => async (req: AuthRequest, res: Response): Promise<Response> => {
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
      action,
      user: req.user,
      payload: req.body || {}
    });

    await populateOrder(result.order);

    const availableActions = getAvailableActions(result.order, req.user);

    return res.json({
      success: true,
      message: 'Order updated successfully',
      data: {
        order: result.order,
        transition: {
          from: result.previousStatus,
          to: result.order.orderStatus,
          action: result.action
        },
        availableActions
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

export const markOrderProcessing = createActionHandler('mark-processing');
export const markOrderReadyForDispatch = createActionHandler('mark-ready-for-dispatch');
export const assignOrderRider = createActionHandler('assign-rider');
export const confirmOrderPickup = createActionHandler('confirm-pickup');
export const failOrderDelivery = createActionHandler('fail-delivery');
export const returnOrderToDispatch = createActionHandler('return-to-dispatch');
export const cancelOrder = createActionHandler('cancel-order');
export const closeOrder = createActionHandler('close-order');

export const getOrderAvailableActions = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const availableActions = getAvailableActions(order, req.user);

    return res.json({
      success: true,
      data: {
        actions: availableActions
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/summary - Returns totalRevenue, totalOrders, conversionRate
export const getDashboardSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate } = req.query as any;

    const match: any = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

  
    const totalOrders = await Order.countDocuments(match);

    const paidMatch = { ...match, paymentStatus: 'paid' };

    const paidAgg = await Order.aggregate([
      { $match: paidMatch },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, paidOrders: { $sum: 1 } } }
    ]);

    const totalRevenue = (paidAgg[0]?.totalRevenue) || 0;
    const paidOrders = (paidAgg[0]?.paidOrders) || 0;

    const conversionRate = totalOrders > 0 ? Number(((paidOrders / totalOrders) * 100).toFixed(2)) : 0;

    return res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        conversionRate
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};



// GET /api/admin/dashboard/order-trend - Returns array of { month: 'YYYY-MM', orderCount }
export const getOrderTrend = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate } = req.query as any;

    const now = new Date();

    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    if (endDate) {
      end = new Date(endDate);
    } else {
      // end of current month
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Ensure valid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
    }

    const match: any = {
      createdAt: { $gte: start, $lte: end }
    };

    const agg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);


    const countMap: Record<string, number> = {};
    agg.forEach((row: any) => {
      const y = row._id.year;
      const m = String(row._id.month).padStart(2, '0');
      countMap[`${y}-${m}`] = row.count;
    });

    const results: Array<{ month: string; orderCount: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      results.push({ month: key, orderCount: countMap[key] || 0 });
      // next month
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/recent-orders - Returns array of { orderId, amount, date, userId }
export const getRecentOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { limit = 10, startDate, endDate } = req.query as any;

    const match: any = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(match)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('_id totalAmount createdAt user')
      .populate('user', '_id');

    const results = orders.map((o: any) => ({
      orderId: o._id?.toString?.() || String(o._id),
      amount: o.totalAmount,
      date: o.createdAt,
      userId: o.user && (o.user._id ? o.user._id.toString() : o.user.toString())
    }));

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/users-trend - Returns array of { month: 'YYYY-MM', userCount }
export const getUsersTrend = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate } = req.query as any;

    const now = new Date();

    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate);
    } else {
      // first day of month, 11 months ago
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    if (endDate) {
      end = new Date(endDate);
    } else {
      // end of current month
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Ensure valid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
    }

    const match: any = {
      createdAt: { $gte: start, $lte: end }
    };

    const agg = await User.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const countMap: Record<string, number> = {};
    agg.forEach((row: any) => {
      const y = row._id.year;
      const m = String(row._id.month).padStart(2, '0');
      countMap[`${y}-${m}`] = row.count;
    });

    const results: Array<{ month: string; userCount: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      results.push({ month: key, userCount: countMap[key] || 0 });
      // next month
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

export const getOrderWorkflowConfiguration = (_req: Request, res: Response): Response => {
  return res.json({
    success: true,
    data: getWorkflowConfig()
  });
};
