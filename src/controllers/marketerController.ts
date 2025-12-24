import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Marketer from '../models/Marketer';
import { Order } from '../models/Order';
import User from '../models/User';
import CommissionPayment from '../models/CommissionPayment';

/**
 * Generate unique marketing code
 */
const generateMarketingCode = async (): Promise<string> => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Check if code exists
  const existing = await Marketer.findOne({ marketingCode: code });
  if (existing) {
    return generateMarketingCode(); // Retry if duplicate
  }

  return code;
};

/**
 * @desc Create a new marketer
 * @route POST /api/admin/marketers
 * @access Private (manage_marketing permission)
 */
export const createMarketer = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { firstName, lastName, email, phone, marketingCode, commissionRate } = req.body;
    const adminId = (req as any).user._id;

    // Check if email already exists
    const existingEmail = await Marketer.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Generate or validate marketing code
    let code = marketingCode;
    if (code) {
      // Check if provided code already exists
      const existingCode = await Marketer.findOne({ marketingCode: code.toUpperCase() });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: 'Marketing code already exists'
        });
      }
    } else {
      // Auto-generate code
      code = await generateMarketingCode();
    }

    // Create marketer
    const marketer = new Marketer({
      firstName,
      lastName,
      email,
      phone,
      marketingCode: code.toUpperCase(),
      commissionRate: commissionRate || 10,
      createdBy: adminId
    });

    await marketer.save();

    return res.status(201).json({
      success: true,
      message: 'Marketer created successfully',
      data: { marketer }
    });
  } catch (error: any) {
    console.error('Create marketer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating marketer'
    });
  }
};

/**
 * @desc Get all marketers with pagination and filters
 * @route GET /api/admin/marketers
 * @access Private (manage_marketing permission)
 */
export const getAllMarketers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { marketingCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort: any = {};
    sort[sortBy as string] = sortOrder;

    // Get total count
    const total = await Marketer.countDocuments(query);

    // Get marketers
    const marketers = await Marketer.find(query)
      .sort(sort)
      .limit(limitNum)
      .skip(skip);

    return res.json({
      success: true,
      message: 'Marketers retrieved successfully',
      data: {
        marketers,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get all marketers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving marketers'
    });
  }
};

/**
 * @desc Get single marketer by ID
 * @route GET /api/admin/marketers/:marketerId
 * @access Private (manage_marketing permission)
 */
export const getMarketerById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { marketerId } = req.params;

    const marketer = await Marketer.findById(marketerId);

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: 'Marketer not found'
      });
    }

    return res.json({
      success: true,
      message: 'Marketer retrieved successfully',
      data: { marketer }
    });
  } catch (error) {
    console.error('Get marketer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving marketer'
    });
  }
};

/**
 * @desc Update marketer
 * @route PUT /api/admin/marketers/:marketerId
 * @access Private (manage_marketing permission)
 */
export const updateMarketer = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { marketerId } = req.params;
    const { firstName, lastName, email, phone, status, commissionRate } = req.body;

    const marketer = await Marketer.findById(marketerId);

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: 'Marketer not found'
      });
    }

    // Check if email is being changed and if it's unique
    if (email && email !== marketer.email) {
      const existingEmail = await Marketer.findOne({ email, _id: { $ne: marketerId } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Update fields
    if (firstName) marketer.firstName = firstName;
    if (lastName) marketer.lastName = lastName;
    if (email) marketer.email = email;
    if (phone) marketer.phone = phone;
    if (status) marketer.status = status;
    if (commissionRate !== undefined) marketer.commissionRate = commissionRate;

    await marketer.save();

    return res.json({
      success: true,
      message: 'Marketer updated successfully',
      data: { marketer }
    });
  } catch (error) {
    console.error('Update marketer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating marketer'
    });
  }
};

/**
 * @desc Delete/Deactivate marketer (soft delete)
 * @route DELETE /api/admin/marketers/:marketerId
 * @access Private (super_admin only)
 */
export const deleteMarketer = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { marketerId } = req.params;

    const marketer = await Marketer.findById(marketerId);

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: 'Marketer not found'
      });
    }

    // Soft delete - set status to inactive
    marketer.status = 'inactive';
    await marketer.save();

    return res.json({
      success: true,
      message: 'Marketer deactivated successfully'
    });
  } catch (error) {
    console.error('Delete marketer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deactivating marketer'
    });
  }
};

/**
 * @desc Get marketer performance report
 * @route GET /api/admin/marketers/:marketerId/report
 * @access Private (manage_marketing permission)
 */
export const getMarketerReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { marketerId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const marketer = await Marketer.findById(marketerId);
    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: 'Marketer not found'
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Find all users referred by this marketer
    const referredUsers = await User.find({ referredBy: marketerId });
    const referredUserIds = referredUsers.map(u => u._id);

    // Get signups in period
    const newSignups = await User.countDocuments({
      referredBy: marketerId,
      createdAt: { $gte: start, $lte: end }
    });

    // Get orders in period from referred users (only first orders that are eligible for commission)
    const orders = await Order.find({
      user: { $in: referredUserIds },
      createdAt: { $gte: start, $lte: end },
      attributedToMarketer: marketerId,
      orderStatus: { $in: ['delivered', 'completed'] }
    }).populate('user', 'firstName lastName email');

    // Calculate metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.subtotal, 0);
    const totalCommission = orders.reduce((sum, order) => sum + (order.marketerCommission || 0), 0);
    const averageOrderValue = totalOrders > 0 ? Math.floor(totalRevenue / totalOrders) : 0;

    // Calculate conversion rate (orders vs total referred users)
    const totalReferredUsers = referredUsers.length;
    const conversionRate = totalReferredUsers > 0
      ? Math.floor((totalOrders / totalReferredUsers) * 100)
      : 0;

    // Get unpaid commission
    const unpaidOrders = await Order.find({
      attributedToMarketer: marketerId,
      commissionPaid: false,
      orderStatus: { $in: ['delivered', 'completed'] }
    });
    const unpaidCommission = unpaidOrders.reduce((sum, order) => sum + (order.marketerCommission || 0), 0);

    // Get top products
    const productAggregation = await Order.aggregate([
      {
        $match: {
          user: { $in: referredUserIds },
          createdAt: { $gte: start, $lte: end },
          attributedToMarketer: new mongoose.Types.ObjectId(marketerId),
          orderStatus: { $in: ['delivered', 'completed'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          orderCount: { $sum: 1 },
          revenue: { $sum: '$items.totalPrice' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);

    const topProducts = productAggregation.map(p => ({
      productId: p._id,
      productName: p.productName,
      orderCount: p.orderCount,
      revenue: p.revenue
    }));

    // Get recent orders
    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(order => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: (order.user as any).firstName + ' ' + (order.user as any).lastName,
        orderDate: order.createdAt,
        orderTotal: order.totalAmount,
        commission: order.marketerCommission,
        orderStatus: order.orderStatus
      }));

    return res.json({
      success: true,
      data: {
        marketer: {
          _id: marketer._id,
          firstName: marketer.firstName,
          lastName: marketer.lastName,
          marketingCode: marketer.marketingCode
        },
        period: {
          startDate: start,
          endDate: end
        },
        metrics: {
          newSignups,
          totalOrders,
          totalRevenue,
          totalCommission,
          averageOrderValue,
          conversionRate,
          unpaidCommission
        },
        topProducts,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Get marketer report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating report'
    });
  }
};

/**
 * @desc Pay commission to marketer
 * @route POST /api/admin/marketers/:marketerId/pay-commission
 * @access Private (manage_marketing or super_admin)
 */
export const payCommission = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { marketerId } = req.params;
    const {
      periodStart,
      periodEnd,
      commissionAmount,
      paymentMethod,
      paymentReference,
      notes
    } = req.body;

    const adminId = (req as any).user._id;

    const marketer = await Marketer.findById(marketerId);
    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: 'Marketer not found'
      });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Find all orders in this period for this marketer
    const orders = await Order.find({
      attributedToMarketer: marketerId,
      createdAt: { $gte: start, $lte: end },
      commissionPaid: false,
      orderStatus: { $in: ['delivered', 'completed'] }
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.subtotal, 0);
    const orderIds = orders.map(o => o._id);

    // Create commission payment record
    const payment = new CommissionPayment({
      marketer: marketerId,
      periodStart: start,
      periodEnd: end,
      totalOrders,
      totalRevenue,
      commissionRate: marketer.commissionRate,
      commissionAmount,
      status: 'paid',
      paidAt: new Date(),
      paidBy: adminId,
      paymentMethod,
      paymentReference,
      orders: orderIds,
      notes
    });

    await payment.save();

    // Update marketer
    await Marketer.findByIdAndUpdate(marketerId, {
      $inc: { unpaidCommission: -commissionAmount },
      lastPaidAt: new Date(),
      lastPaidAmount: commissionAmount
    });

    // Mark all orders as commission paid
    await Order.updateMany(
      { _id: { $in: orderIds } },
      {
        commissionPaid: true,
        commissionPaidAt: new Date()
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Commission payment recorded successfully',
      data: { payment }
    });
  } catch (error) {
    console.error('Pay commission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error recording commission payment'
    });
  }
};

/**
 * @desc Get all marketers summary report
 * @route GET /api/admin/reports/marketers
 * @access Private (manage_marketing permission)
 */
export const getMarketersSummaryReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate, sortBy = 'revenue' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Get all active marketers
    const marketers = await Marketer.find({ status: 'active' });

    const marketersData = await Promise.all(
      marketers.map(async (marketer) => {
        // Get signups in period
        const signups = await User.countDocuments({
          referredBy: marketer._id,
          createdAt: { $gte: start, $lte: end }
        });

        // Get orders in period
        const orders = await Order.find({
          attributedToMarketer: marketer._id,
          createdAt: { $gte: start, $lte: end },
          orderStatus: { $in: ['delivered', 'completed'] }
        });

        const totalOrders = orders.length;
        const revenue = orders.reduce((sum, order) => sum + order.subtotal, 0);
        const commission = orders.reduce((sum, order) => sum + (order.marketerCommission || 0), 0);

        // Get unpaid commission
        const unpaidOrders = await Order.find({
          attributedToMarketer: marketer._id,
          commissionPaid: false,
          orderStatus: { $in: ['delivered', 'completed'] }
        });
        const unpaidCommission = unpaidOrders.reduce((sum, order) => sum + (order.marketerCommission || 0), 0);

        return {
          marketerId: marketer._id,
          name: `${marketer.firstName} ${marketer.lastName}`,
          code: marketer.marketingCode,
          signups,
          orders: totalOrders,
          revenue,
          commission,
          unpaidCommission
        };
      })
    );

    // Sort
    if (sortBy === 'revenue') {
      marketersData.sort((a, b) => b.revenue - a.revenue);
    } else if (sortBy === 'orders') {
      marketersData.sort((a, b) => b.orders - a.orders);
    } else if (sortBy === 'signups') {
      marketersData.sort((a, b) => b.signups - a.signups);
    } else if (sortBy === 'commission') {
      marketersData.sort((a, b) => b.commission - a.commission);
    }

    // Calculate summary
    const summary = {
      totalMarketers: marketers.length,
      activeMarketers: marketers.filter(m => m.status === 'active').length,
      totalSignups: marketersData.reduce((sum, m) => sum + m.signups, 0),
      totalOrders: marketersData.reduce((sum, m) => sum + m.orders, 0),
      totalRevenue: marketersData.reduce((sum, m) => sum + m.revenue, 0),
      totalCommission: marketersData.reduce((sum, m) => sum + m.commission, 0),
      totalUnpaidCommission: marketersData.reduce((sum, m) => sum + m.unpaidCommission, 0)
    };

    return res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        summary,
        marketers: marketersData
      }
    });
  } catch (error) {
    console.error('Get marketers summary report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating summary report'
    });
  }
};
