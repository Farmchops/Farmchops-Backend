import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  PayLaterApplication,
  PayLaterAccount,
  PayLaterOrder,
  PayLaterSettings
} from '../models/PayLater';
import paylaterService from '../services/paylaterService';

interface AuthRequest extends Request {
  user?: any;
}

// GET /api/admin/paylater/applications - Get all applications
export const getApplications = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
      query.status = status;
    }

    const [applications, total, stats] = await Promise.all([
      PayLaterApplication.find(query)
        .populate('userId', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PayLaterApplication.countDocuments(query),
      paylaterService.getApplicationStats()
    ]);

    return res.json({
      success: true,
      data: {
        applications: applications.map(app => ({
          _id: app._id,
          user: app.userId,
          firstName: app.firstName,
          lastName: app.lastName,
          email: app.email,
          phoneNumber: app.phoneNumber,
          ippis: app.ippis,
          bvn: app.bvn,
          nin: app.nin,
          ninCardImage: app.ninCardImage,
          passportPhoto: app.passportPhoto,
          verificationScore: app.verificationScore,
          verificationStatus: app.verificationStatus,
          verificationResults: app.verificationResults,
          status: app.status,
          creditLimit: app.creditLimit,
          createdAt: app.createdAt
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        },
        stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get applications'
    });
  }
};

// GET /api/admin/paylater/applications/:id - Get single application
export const getApplicationById = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const application = await PayLaterApplication.findById(id)
      .populate('userId', 'email firstName lastName createdAt')
      .populate('reviewedBy', 'firstName lastName');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    return res.json({
      success: true,
      data: { application }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get application'
    });
  }
};

// PUT /api/admin/paylater/applications/:id - Approve or reject application
export const reviewApplication = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;
    const { action, creditLimit, rejectionReason } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be "approve" or "reject"'
      });
    }

    const application = await PayLaterApplication.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`
      });
    }

    const settings = await paylaterService.getSettings();

    if (action === 'approve') {
      if (!creditLimit || typeof creditLimit !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Credit limit is required for approval'
        });
      }

      if (creditLimit < settings.minCreditLimit || creditLimit > settings.maxCreditLimit) {
        return res.status(400).json({
          success: false,
          message: `Credit limit must be between ₦${settings.minCreditLimit.toLocaleString()} and ₦${settings.maxCreditLimit.toLocaleString()}`
        });
      }

      // Update application
      application.status = 'approved';
      application.creditLimit = creditLimit;
      application.reviewedBy = req.user._id;
      application.reviewedAt = new Date();
      await application.save();

      // Create PayLater account
      await PayLaterAccount.create({
        userId: application.userId,
        applicationId: application._id,
        creditLimit,
        availableCredit: creditLimit,
        hasActiveLoan: false,
        status: 'active'
      });

      return res.json({
        success: true,
        message: 'Application approved successfully',
        data: {
          application: {
            _id: application._id,
            status: application.status,
            creditLimit: application.creditLimit,
            reviewedAt: application.reviewedAt
          }
        }
      });
    } else {
      // Reject
      application.status = 'rejected';
      application.rejectionReason = rejectionReason || 'Application rejected';
      application.reviewedBy = req.user._id;
      application.reviewedAt = new Date();
      await application.save();

      return res.json({
        success: true,
        message: 'Application rejected',
        data: {
          application: {
            _id: application._id,
            status: application.status,
            rejectionReason: application.rejectionReason,
            reviewedAt: application.reviewedAt
          }
        }
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to review application'
    });
  }
};

// GET /api/admin/paylater/users - Get all PayLater users
export const getUsers = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { hasActiveLoan, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { status: 'active' };
    if (hasActiveLoan === 'true') {
      query.hasActiveLoan = true;
    } else if (hasActiveLoan === 'false') {
      query.hasActiveLoan = false;
    }

    const [accounts, total, stats] = await Promise.all([
      PayLaterAccount.find(query)
        .populate('userId', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PayLaterAccount.countDocuments(query),
      paylaterService.getLoanStats()
    ]);

    // Get order counts for each user
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        const [totalOrders, totalRepaid] = await Promise.all([
          PayLaterOrder.countDocuments({ accountId: account._id }),
          PayLaterOrder.aggregate([
            { $match: { accountId: account._id, repaymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$repaidAmount' } } }
          ])
        ]);

        const now = new Date();
        const isOverdue = account.hasActiveLoan && account.activeLoanDueDate && account.activeLoanDueDate < now;

        return {
          _id: account._id,
          user: account.userId,
          creditLimit: account.creditLimit,
          availableCredit: account.availableCredit,
          hasActiveLoan: account.hasActiveLoan,
          activeLoan: account.hasActiveLoan ? {
            orderId: account.activeLoanOrderId,
            amount: account.activeLoanAmount,
            dueDate: account.activeLoanDueDate,
            repaymentStatus: isOverdue ? 'overdue' : 'pending',
            isOverdue
          } : null,
          totalOrders,
          totalRepaid: totalRepaid[0]?.total || 0
        };
      })
    );

    return res.json({
      success: true,
      data: {
        users: accountsWithStats,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        },
        stats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get users'
    });
  }
};

// GET /api/admin/paylater/users/:userId - Get user details
export const getUserById = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;

    const account = await PayLaterAccount.findOne({ userId })
      .populate('userId', 'email firstName lastName');

    if (!account) {
      return res.status(404).json({ success: false, message: 'PayLater account not found' });
    }

    const [application, orders, stats] = await Promise.all([
      PayLaterApplication.findById(account.applicationId),
      PayLaterOrder.find({ accountId: account._id }).sort({ createdAt: -1 }).limit(20),
      PayLaterOrder.aggregate([
        { $match: { accountId: account._id } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalBorrowed: { $sum: '$totalAmount' },
            totalRepaid: {
              $sum: {
                $cond: [{ $eq: ['$repaymentStatus', 'paid'] }, '$repaidAmount', 0]
              }
            }
          }
        }
      ])
    ]);

    const orderStats = stats[0] || { totalOrders: 0, totalBorrowed: 0, totalRepaid: 0 };
    const currentOutstanding = account.hasActiveLoan ? account.activeLoanAmount : 0;

    return res.json({
      success: true,
      data: {
        account,
        application,
        orders,
        stats: {
          ...orderStats,
          currentOutstanding
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get user details'
    });
  }
};

// PUT /api/admin/paylater/users/:userId/credit-limit - Update credit limit
export const updateCreditLimit = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { creditLimit } = req.body;

    if (!creditLimit || typeof creditLimit !== 'number' || creditLimit < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid credit limit is required'
      });
    }

    const settings = await paylaterService.getSettings();
    if (creditLimit < settings.minCreditLimit || creditLimit > settings.maxCreditLimit) {
      return res.status(400).json({
        success: false,
        message: `Credit limit must be between ₦${settings.minCreditLimit.toLocaleString()} and ₦${settings.maxCreditLimit.toLocaleString()}`
      });
    }

    const account = await PayLaterAccount.findOne({ userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'PayLater account not found' });
    }

    const previousLimit = account.creditLimit;

    // Update credit limit and available credit proportionally
    const usedCredit = account.creditLimit - account.availableCredit;
    account.creditLimit = creditLimit;
    account.availableCredit = Math.max(0, creditLimit - usedCredit);
    await account.save();

    return res.json({
      success: true,
      message: 'Credit limit updated',
      data: {
        previousLimit,
        newLimit: creditLimit,
        availableCredit: account.availableCredit
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update credit limit'
    });
  }
};

// POST /api/admin/paylater/orders/:id/repaid - Mark loan as repaid
export const markAsRepaid = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { repaidAmount, notes } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    if (!repaidAmount || typeof repaidAmount !== 'number' || repaidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid repaid amount is required'
      });
    }

    const result = await paylaterService.markAsRepaid(id, repaidAmount, notes);

    return res.json({
      success: true,
      message: 'Loan marked as repaid',
      data: {
        order: {
          _id: result.order._id,
          orderNumber: result.order.orderNumber,
          repaymentStatus: result.order.repaymentStatus,
          repaidAt: result.order.repaidAt,
          repaidAmount: result.order.repaidAmount
        },
        account: {
          hasActiveLoan: result.account.hasActiveLoan,
          availableCredit: result.account.availableCredit
        }
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to mark as repaid'
    });
  }
};

// GET /api/admin/paylater/orders - Get all orders
export const getAllOrders = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { repaymentStatus, orderStatus, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = {};
    if (repaymentStatus && ['pending', 'paid', 'overdue'].includes(repaymentStatus as string)) {
      query.repaymentStatus = repaymentStatus;
    }
    if (orderStatus && ['processing', 'shipped', 'delivered', 'cancelled'].includes(orderStatus as string)) {
      query.orderStatus = orderStatus;
    }

    const [orders, total] = await Promise.all([
      PayLaterOrder.find(query)
        .populate('userId', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PayLaterOrder.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get orders'
    });
  }
};

// GET /api/admin/paylater/settings - Get settings
export const getSettings = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const settings = await paylaterService.getSettings();

    return res.json({
      success: true,
      data: {
        markupPercentage: settings.markupPercentage,
        defaultRepaymentDays: settings.defaultRepaymentDays,
        minCreditLimit: settings.minCreditLimit,
        maxCreditLimit: settings.maxCreditLimit,
        deliveryFee: settings.deliveryFee
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get settings'
    });
  }
};

// PUT /api/admin/paylater/settings - Update settings
export const updateSettings = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { markupPercentage, defaultRepaymentDays, minCreditLimit, maxCreditLimit, deliveryFee } = req.body;

    const settings = await paylaterService.getSettings();

    if (markupPercentage !== undefined) {
      if (typeof markupPercentage !== 'number' || markupPercentage < 0 || markupPercentage > 100) {
        return res.status(400).json({ success: false, message: 'Markup percentage must be between 0 and 100' });
      }
      settings.markupPercentage = markupPercentage;
    }

    if (defaultRepaymentDays !== undefined) {
      if (typeof defaultRepaymentDays !== 'number' || defaultRepaymentDays < 1 || defaultRepaymentDays > 365) {
        return res.status(400).json({ success: false, message: 'Repayment days must be between 1 and 365' });
      }
      settings.defaultRepaymentDays = defaultRepaymentDays;
    }

    if (minCreditLimit !== undefined) {
      if (typeof minCreditLimit !== 'number' || minCreditLimit < 0) {
        return res.status(400).json({ success: false, message: 'Min credit limit must be a positive number' });
      }
      settings.minCreditLimit = minCreditLimit;
    }

    if (maxCreditLimit !== undefined) {
      if (typeof maxCreditLimit !== 'number' || maxCreditLimit < 0) {
        return res.status(400).json({ success: false, message: 'Max credit limit must be a positive number' });
      }
      settings.maxCreditLimit = maxCreditLimit;
    }

    if (deliveryFee !== undefined) {
      if (typeof deliveryFee !== 'number' || deliveryFee < 0) {
        return res.status(400).json({ success: false, message: 'Delivery fee must be a positive number' });
      }
      settings.deliveryFee = deliveryFee;
    }

    settings.updatedBy = req.user._id;
    await settings.save();

    return res.json({
      success: true,
      message: 'Settings updated',
      data: {
        markupPercentage: settings.markupPercentage,
        defaultRepaymentDays: settings.defaultRepaymentDays,
        minCreditLimit: settings.minCreditLimit,
        maxCreditLimit: settings.maxCreditLimit,
        deliveryFee: settings.deliveryFee
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update settings'
    });
  }
};

// PUT /api/admin/paylater/orders/:orderId/status - Update order status
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    if (!orderStatus || !['processing', 'shipped', 'delivered', 'cancelled'].includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Valid order status is required (processing, shipped, delivered, cancelled)'
      });
    }

    const order = await PayLaterOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.orderStatus = orderStatus;
    await order.save();

    return res.json({
      success: true,
      message: 'Order status updated',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update order status'
    });
  }
};
