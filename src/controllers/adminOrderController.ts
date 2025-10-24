import { Request, Response } from 'express';
import { Order } from '../models/Order';
import mongoose from 'mongoose';

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

    // Populate user for customer name search
    let userMatch = null;
    if (search) {
      userMatch = await mongoose.model('User').find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }, '_id');
      if (userMatch.length) {
        query.$or.push({ user: { $in: userMatch.map((u: any) => u._id) } });
      }
    }

    const orders = await Order.find(query)
      .populate('user', 'name email')
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
export const getOrderById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Validate order ID exists
    if (!id) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const order = await Order.findById(id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name image');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({
      success: true,
      data: {
        order
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};

// PATCH /api/admin/orders/:id/status - Update order status
export const updateOrderStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    // Validate order ID exists
    if (!id) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status. Must be one of: pending, processing, shipped, delivered, cancelled' 
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order status
    order.orderStatus = status;

    // Add to status history
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status updated to ${status}`
    });

    // Set completion or cancellation date based on status
    if (status === 'delivered' && !order.completedAt) {
      order.completedAt = new Date();
    } else if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = new Date();
    }

    await order.save();

    return res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Server error' });
  }
};
