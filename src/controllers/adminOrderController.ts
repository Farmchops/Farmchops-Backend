import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { Order, IOrder } from '../models/Order';
import { AuthRequest } from '../middleware/auth';
import { performAction, OrderWorkflowError, WorkflowAction, getAvailableActions, getWorkflowConfig } from '../services/orderWorkflowService';
import websocketService from '../services/websocketService';
import { generateInvoicePDF } from '../services/invoiceService';


// GET /api/admin/orders?search=&status=&page=&limit=&sort=
import { PERMISSIONS } from '../utils/permissions';

// Map adminRole to OrderStageOwner
const mapAdminRoleToStageOwner = (adminRole: string): string => {
  const roleMap: Record<string, string> = {
    'operations_officer': 'processing',
    'logistics': 'logistics',
    'customer_support': 'support',
    'rider': 'rider',
    'super_admin': 'system'
  };
  return roleMap[adminRole] || adminRole;
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search = '',
      status = '',
      page = 1,
      limit = 20,
      sort = '-createdAt',
      date,
      ownerRole,
      includeAssigned = 'false',
      assignedTo
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

    // Visibility / ownerRole handling
    const caller = req.user;
    const callerPermissions = caller?.permissions || [];
    const isSuper = caller && (Array.isArray(callerPermissions) && callerPermissions.includes(PERMISSIONS.ALL) || (caller as any).adminRole === 'super_admin');

    // If assignedTo is provided (admin filtering by assigned user), respect it
    if (assignedTo && mongoose.Types.ObjectId.isValid(String(assignedTo))) {
      query['assignedRider.rider'] = new mongoose.Types.ObjectId(String(assignedTo));
    }

    // Non-super-admin behavior for ownerRole
    if (!isSuper) {
      const callerAdminRole = (caller as any)?.adminRole;
      const mappedOwnerRole = callerAdminRole ? mapAdminRoleToStageOwner(callerAdminRole) : undefined;
      const effectiveOwner = ownerRole || mappedOwnerRole;

      if (ownerRole) {
        // If caller asked for a specific ownerRole, return orders owned by that role OR explicitly assigned to caller
        query.$or = [
          { currentStageOwnerRole: ownerRole },
          { 'assignedRider.rider': caller?._id }
        ];
      } else if (effectiveOwner) {
        // Default to caller's mapped stage owner role, but always include orders assigned to caller
        query.$or = [
          { currentStageOwnerRole: effectiveOwner },
          { 'assignedRider.rider': caller?._id }
        ];
      } else if (includeAssigned === 'true') {
        // If no ownerRole and includeAssigned, include assigned orders
        query['assignedRider.rider'] = caller?._id;
      }
    }

    // If includeAssigned explicitly requested for super admins, include assigned orders in broad search by not restricting
    // (super admins already see all orders)

    const orders = await Order.find(query)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images')
      .populate('items.deal', 'title discountPercentage startAt endAt')
      .populate('assignedRider.rider', 'firstName lastName phone adminRole')
      .populate('groupOrder.initiator', 'firstName lastName email')
      .populate('groupOrder.participants.user', 'firstName lastName email')
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
      .populate('items.deal', 'title discountPercentage startAt endAt')
      .populate('assignedRider.rider', 'firstName lastName phone adminRole')
      .populate('statusHistory.updatedBy', 'firstName lastName email adminRole')
      .populate('groupOrder.initiator', 'firstName lastName email')
      .populate('groupOrder.participants.user', 'firstName lastName email');

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

    // Broadcast order status change to admin WebSocket clients
    websocketService.broadcastOrderStatusChanged(
      (result.order._id as mongoose.Types.ObjectId).toString(),
      result.previousStatus,
      result.order.orderStatus,
      result.order
    );

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
export const confirmOrderDelivery = createActionHandler('confirm-delivery');
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


export const listRiders = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { search = '', status = 'active' } = req.query as { search?: string; status?: string };

    const filter: Record<string, unknown> = {
      role: 'admin',
      adminRole: 'rider'
    };

    if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'all') {
      // leave isActive unspecified
    } else {
      filter.isActive = true;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex }
      ];
    }

    const riders = await User.find(filter)
      .select('firstName lastName email phone isActive adminRole permissions')
      .sort({ firstName: 1, lastName: 1, email: 1 });

    const riderIds = riders.map((rider) => rider._id);
    const activeOrders = riderIds.length
      ? await Order.aggregate([
          {
            $match: {
              'assignedRider.rider': { $in: riderIds },
              orderStatus: { $in: ['awaiting_pickup', 'en_route'] }
            }
          },
          {
            $group: {
              _id: '$assignedRider.rider',
              count: { $sum: 1 }
            }
          }
        ])
      : [];

    const activeMap = new Map<string, number>(activeOrders.map((entry) => [String(entry._id), entry.count]));

    const data = riders.map((rider) => ({
      _id: rider._id,
      firstName: rider.firstName,
      lastName: rider.lastName,
      email: rider.email,
      phone: rider.phone,
      isActive: rider.isActive,
      adminRole: rider.adminRole,
      permissions: rider.permissions,
      isOnDelivery: activeMap.get(String(rider._id)) ? true : false,
      activeDeliveries: activeMap.get(String(rider._id)) || 0
    }));

    return res.json({ success: true, data });
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

// GET /api/admin/dashboard/recent-orders - Returns array of recent orders with customer details
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
      .select('_id orderNumber totalAmount createdAt user orderStatus paymentStatus')
      .populate('user', '_id firstName lastName email');

    const results = orders.map((o: any) => ({
      orderId: o._id?.toString?.() || String(o._id),
      orderNumber: o.orderNumber,
      customerName: o.user ? `${o.user.firstName || ''} ${o.user.lastName || ''}`.trim() : 'Guest',
      customerEmail: o.user?.email || null,
      amount: o.totalAmount,
      date: o.createdAt,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
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

// GET /api/admin/dashboard/conversion-rate - Returns ratio of users to purchasing users
export const getConversionRate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate } = req.query as any;

    const userMatch: any = {};
    const orderMatch: any = {};
    
    if (startDate || endDate) {
      userMatch.createdAt = {};
      orderMatch.createdAt = {};
      if (startDate) {
        userMatch.createdAt.$gte = new Date(startDate);
        orderMatch.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        userMatch.createdAt.$lte = new Date(endDate);
        orderMatch.createdAt.$lte = new Date(endDate);
      }
    }

    // Total users who joined the app
    const totalUsers = await User.countDocuments(userMatch);

    // Users who have made at least one purchase (paid order)
    const paidOrderMatch = { ...orderMatch, paymentStatus: 'paid' };
    const usersWhoPurchased = await Order.distinct('user', paidOrderMatch);
    const purchasingUsers = usersWhoPurchased.length;

    // Calculate conversion rate
    const conversionRate = totalUsers > 0 
      ? Number(((purchasingUsers / totalUsers) * 100).toFixed(2)) 
      : 0;

    return res.json({
      success: true,
      data: {
        totalUsers,
        purchasingUsers,
        conversionRate,
        conversionRatio: `${purchasingUsers}:${totalUsers}`
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/total-orders - Returns total orders count and breakdown
export const getTotalOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate } = req.query as any;

    const match: any = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    // Total orders
    const totalOrders = await Order.countDocuments(match);

    // Breakdown by payment status
    const paidOrders = await Order.countDocuments({ ...match, paymentStatus: 'paid' });
    const pendingOrders = await Order.countDocuments({ ...match, paymentStatus: 'pending' });
    const failedOrders = await Order.countDocuments({ ...match, paymentStatus: 'failed' });

    // Breakdown by order status (matching dashboard labels)
    // Delivered = 'delivered' or 'completed' status
    const deliveredOrders = await Order.countDocuments({
      ...match,
      orderStatus: { $in: ['delivered', 'completed'] }
    });
    const cancelledOrders = await Order.countDocuments({ ...match, orderStatus: 'cancelled' });
    // Pending = all orders that are not delivered/completed and not cancelled
    const pendingOrders_status = totalOrders - deliveredOrders - cancelledOrders;

    // Calculate percentages for pie chart
    const deliveredPercentage = totalOrders > 0 ? Number(((deliveredOrders / totalOrders) * 100).toFixed(1)) : 0;
    const pendingPercentage = totalOrders > 0 ? Number(((pendingOrders_status / totalOrders) * 100).toFixed(1)) : 0;
    const cancelledPercentage = totalOrders > 0 ? Number(((cancelledOrders / totalOrders) * 100).toFixed(1)) : 0;

    // Calculate revenue for each status
    const deliveredRevenue = await Order.aggregate([
      { $match: { ...match, orderStatus: { $in: ['delivered', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const pendingRevenue = await Order.aggregate([
      { $match: { ...match, orderStatus: { $nin: ['delivered', 'completed', 'cancelled'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const cancelledRevenue = await Order.aggregate([
      { $match: { ...match, orderStatus: 'cancelled' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    return res.json({
      success: true,
      data: {
        totalOrders,
        byPaymentStatus: {
          paid: paidOrders,
          pending: pendingOrders,
          failed: failedOrders
        },
        byOrderStatus: {
          delivered: {
            count: deliveredOrders,
            percentage: deliveredPercentage,
            revenue: deliveredRevenue[0]?.total || 0
          },
          pending: {
            count: pendingOrders_status,
            percentage: pendingPercentage,
            revenue: pendingRevenue[0]?.total || 0
          },
          cancelled: {
            count: cancelledOrders,
            percentage: cancelledPercentage,
            revenue: cancelledRevenue[0]?.total || 0
          }
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/revenue-trend - Returns monthly revenue data for chart
export const getRevenueTrend = async (req: Request, res: Response): Promise<Response> => {
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
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
    }

    const match: any = {
      createdAt: { $gte: start, $lte: end },
      paymentStatus: 'paid'
    };

    const agg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const revenueMap: Record<string, { revenue: number; orderCount: number }> = {};
    agg.forEach((row: any) => {
      const y = row._id.year;
      const m = String(row._id.month).padStart(2, '0');
      revenueMap[`${y}-${m}`] = { revenue: row.revenue, orderCount: row.orderCount };
    });

    const results: Array<{ month: string; revenue: number; orderCount: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      results.push({
        month: key,
        revenue: revenueMap[key]?.revenue || 0,
        orderCount: revenueMap[key]?.orderCount || 0
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/payment-methods - Returns payment method breakdown
export const getPaymentMethodsBreakdown = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate } = req.query as any;

    const match: any = { paymentStatus: 'paid' };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const agg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalOrders = agg.reduce((sum, item) => sum + item.count, 0);
    const totalRevenue = agg.reduce((sum, item) => sum + item.revenue, 0);

    // Map payment methods to display names
    const methodNames: Record<string, string> = {
      'paystack': 'Online Payment',
      'wallet': 'Digital Wallet',
      'pay_later': 'Paylater'
    };

    const breakdown = agg.map((item: any) => ({
      method: item._id,
      displayName: methodNames[item._id] || item._id,
      count: item.count,
      revenue: item.revenue,
      percentage: totalOrders > 0 ? Number(((item.count / totalOrders) * 100).toFixed(1)) : 0,
      revenuePercentage: totalRevenue > 0 ? Number(((item.revenue / totalRevenue) * 100).toFixed(1)) : 0
    }));

    // Ensure all payment methods are represented
    const allMethods = ['paystack', 'wallet', 'pay_later'];
    allMethods.forEach(method => {
      if (!breakdown.find((b: any) => b.method === method)) {
        breakdown.push({
          method,
          displayName: methodNames[method],
          count: 0,
          revenue: 0,
          percentage: 0,
          revenuePercentage: 0
        });
      }
    });

    return res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        breakdown
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/average-order-value - Returns AOV trend over time
export const getAverageOrderValue = async (req: Request, res: Response): Promise<Response> => {
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
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
    }

    const match: any = {
      createdAt: { $gte: start, $lte: end },
      paymentStatus: 'paid'
    };

    const agg = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const aovMap: Record<string, { aov: number; orderCount: number; totalRevenue: number }> = {};
    agg.forEach((row: any) => {
      const y = row._id.year;
      const m = String(row._id.month).padStart(2, '0');
      aovMap[`${y}-${m}`] = {
        aov: Number(row.avgOrderValue.toFixed(2)),
        orderCount: row.orderCount,
        totalRevenue: row.totalRevenue
      };
    });

    const results: Array<{ month: string; averageOrderValue: number; orderCount: number; totalRevenue: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      results.push({
        month: key,
        averageOrderValue: aovMap[key]?.aov || 0,
        orderCount: aovMap[key]?.orderCount || 0,
        totalRevenue: aovMap[key]?.totalRevenue || 0
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Calculate overall AOV
    const overallMatch: any = { paymentStatus: 'paid' };
    if (startDate || endDate) {
      overallMatch.createdAt = { $gte: start, $lte: end };
    }
    const overallAgg = await Order.aggregate([
      { $match: overallMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    const overall = overallAgg[0] || { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 };

    return res.json({
      success: true,
      data: {
        overall: {
          averageOrderValue: Number((overall.avgOrderValue || 0).toFixed(2)),
          totalRevenue: overall.totalRevenue || 0,
          orderCount: overall.orderCount || 0
        },
        trend: results
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// GET /api/admin/dashboard/top-products - Returns top products by revenue/orders
export const getTopProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate, limit = 10, sortBy = 'revenue' } = req.query as any;

    const match: any = { paymentStatus: 'paid' };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const agg = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: sortBy === 'orders' ? { orderCount: -1 } : { totalRevenue: -1 } },
      { $limit: Number(limit) }
    ]);

    // Populate product details
    const productIds = agg.map((item: any) => item._id);
    const products = await mongoose.model('Product').find(
      { _id: { $in: productIds } },
      'name images'
    );

    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    const results = agg.map((item: any, index: number) => {
      const product = productMap.get(item._id?.toString());
      return {
        rank: index + 1,
        productId: item._id?.toString(),
        productName: product?.name || item.productName || 'Unknown Product',
        productImage: product?.images?.[0] || null,
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
        orderCount: item.orderCount
      };
    });

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

export const downloadOrderInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    generateInvoicePDF(order.toObject(), res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate invoice' });
  }
};
