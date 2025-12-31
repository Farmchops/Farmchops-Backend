import { Request, Response } from 'express';
import User from '../models/User';
import { Order } from '../models/Order';

/**
 * @desc Get all users with their purchase statistics
 * @route GET /api/admin/users
 * @access Private (admin only)
 */
export const getAllUsers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build query - only get customers, not admins
    const query: any = { role: 'customer' };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort: any = {};
    sort[sortBy as string] = sortOrder;

    // Get total count
    const total = await User.countDocuments(query);

    // Get users
    const users = await User.find(query)
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .select('firstName lastName email phone wallet createdAt profile.isVerified referredBy');

    // Enrich users with purchase statistics
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        // Get all orders for this user
        const orders = await Order.find({
          user: user._id,
          orderStatus: { $in: ['delivered', 'completed'] }
        });

        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

        // Get last order date
        const lastOrder = orders.length > 0
          ? orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
          : null;

        // Extract username from email if names are missing
        const emailUsername = user.email.split('@')[0];
        const displayFirstName = user.firstName || emailUsername;
        const displayLastName = user.lastName || '';

        return {
          _id: user._id,
          firstName: displayFirstName,
          lastName: displayLastName,
          email: user.email,
          phone: user.phone || 'N/A',
          walletBalance: user.wallet?.balance || 0,
          isVerified: user.profile?.isVerified || false,
          hasReferral: !!user.referredBy,
          joinedAt: user.createdAt,
          purchaseStats: {
            totalOrders,
            totalSpent,
            averageOrderValue: Math.round(averageOrderValue),
            lastOrderDate: lastOrder?.createdAt || null
          }
        };
      })
    );

    return res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: enrichedUsers,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving users'
    });
  }
};
