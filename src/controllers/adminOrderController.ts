import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order, IOrder } from '../models/Order';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { performAction, OrderWorkflowError, WorkflowAction, getAvailableActions, getWorkflowConfig } from '../services/orderWorkflowService';

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

    // Validate MongoDB ObjectId
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

// PATCH /api/admin/orders/:id/status - Update order status
const populateOrder = async (order: IOrder | null) => {
  if (!order) {
    return order;
  }

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

    return res.json({
      success: true,
      data: {
        riders: data,
        total: riders.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch riders'
    });
  }
};

export const getOrderWorkflowConfiguration = (_req: Request, res: Response): Response => {
  return res.json({
    success: true,
    data: getWorkflowConfig()
  });
};
