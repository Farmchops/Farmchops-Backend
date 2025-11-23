import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PaymentLink } from '../models/PaymentLink';
import { Order } from '../models/Order';
import User from '../models/User';
import paystackService from '../config/paystack';
import walletService from '../services/walletService';

interface AuthRequest extends Request {
  user?: any;
}

// POST /api/payment-links/create - Create a payment link
export const createPaymentLink = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      amount,
      description,
      orderId,
      recipientName,
      recipientPhone,
      expiresInDays = 7
    } = req.body;

    if (!amount || typeof amount !== 'number' || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required and must be at least ₦100'
      });
    }

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    // If orderId provided, verify it belongs to the user
    if (orderId) {
      const order = await Order.findOne({ _id: orderId, user: req.user._id });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or does not belong to you'
        });
      }
    }

    // Generate unique code
    const code = await PaymentLink.generateUniqueCode();

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const paymentLink = await PaymentLink.create({
      code,
      createdBy: req.user._id,
      orderId: orderId || undefined,
      amount,
      description,
      recipientName,
      recipientPhone,
      expiresAt,
      status: 'active'
    });

    // Generate shareable URL
    const baseUrl = process.env.FRONTEND_URL || 'https://farmchops.com';
    const shareableUrl = `${baseUrl}/pay/${code}`;

    return res.status(201).json({
      success: true,
      data: {
        id: paymentLink._id,
        code: paymentLink.code,
        amount: paymentLink.amount,
        description: paymentLink.description,
        recipientName: paymentLink.recipientName,
        expiresAt: paymentLink.expiresAt,
        status: paymentLink.status,
        shareableUrl,
        createdAt: paymentLink.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create payment link'
    });
  }
};

// GET /api/payment-links/:code - Get payment link details (public)
export const getPaymentLinkByCode = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Payment link code is required' });
    }

    const paymentLink = await PaymentLink.findOne({ code: code.toUpperCase() })
      .populate('createdBy', 'firstName lastName')
      .populate('orderId', 'orderNumber items');

    if (!paymentLink) {
      return res.status(404).json({ success: false, message: 'Payment link not found' });
    }

    // Check if expired
    if (paymentLink.status === 'active' && new Date() > paymentLink.expiresAt) {
      paymentLink.status = 'expired';
      await paymentLink.save();
    }

    const creator = paymentLink.createdBy as any;

    return res.json({
      success: true,
      data: {
        code: paymentLink.code,
        amount: paymentLink.amount,
        description: paymentLink.description,
        recipientName: paymentLink.recipientName,
        status: paymentLink.status,
        expiresAt: paymentLink.expiresAt,
        isExpired: paymentLink.status === 'expired',
        isPaid: paymentLink.status === 'paid',
        createdBy: creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown',
        order: paymentLink.orderId ? {
          orderNumber: (paymentLink.orderId as any).orderNumber,
          itemCount: (paymentLink.orderId as any).items?.length || 0
        } : null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
};

// POST /api/payment-links/:code/pay - Initialize payment for a payment link
// payerName, payerEmail, payerPhone are all optional - Paystack will collect from user
export const payPaymentLink = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { code } = req.params;
    const { payerName, payerEmail, payerPhone } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Payment link code is required' });
    }

    const paymentLink = await PaymentLink.findOne({ code: code.toUpperCase() })
      .populate('createdBy', 'email firstName lastName');

    if (!paymentLink) {
      return res.status(404).json({ success: false, message: 'Payment link not found' });
    }

    // Check status
    if (paymentLink.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This payment link has already been used'
      });
    }

    if (paymentLink.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This payment link has been cancelled'
      });
    }

    if (paymentLink.status === 'expired' || new Date() > paymentLink.expiresAt) {
      paymentLink.status = 'expired';
      await paymentLink.save();
      return res.status(400).json({
        success: false,
        message: 'This payment link has expired'
      });
    }

    // Generate unique reference for this payment
    const reference = `PL-${paymentLink.code}-${Date.now()}`.toUpperCase();

    // Use provided email or fall back to creator's email for Paystack initialization
    const creator = paymentLink.createdBy as any;
    const emailForPaystack = payerEmail || creator?.email || 'customer@farmchops.com';

    // Initialize Paystack transaction
    const paystackResponse = await paystackService.initializeTransaction(
      emailForPaystack,
      paymentLink.amount,
      reference,
      {
        type: 'payment_link',
        paymentLinkId: (paymentLink._id as mongoose.Types.ObjectId).toString(),
        paymentLinkCode: paymentLink.code,
        payerName: payerName || 'Anonymous',
        payerPhone
      }
    );

    // Store pending payment info (only if provided)
    paymentLink.paymentReference = reference;
    if (payerName || payerEmail || payerPhone) {
      paymentLink.paidBy = {
        name: payerName || 'Anonymous',
        email: payerEmail || emailForPaystack,
        phone: payerPhone
      };
    }
    await paymentLink.save();

    return res.json({
      success: true,
      data: {
        reference,
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        amount: paymentLink.amount
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initialize payment'
    });
  }
};

// GET /api/payment-links/:code/verify - Verify payment link payment
export const verifyPaymentLinkPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { code } = req.params;
    const { reference } = req.query;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Payment link code is required' });
    }

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    const paymentLink = await PaymentLink.findOne({ code: code.toUpperCase() });

    if (!paymentLink) {
      return res.status(404).json({ success: false, message: 'Payment link not found' });
    }

    if (paymentLink.status === 'paid') {
      return res.json({
        success: true,
        data: {
          status: 'paid',
          paidAt: paymentLink.paidAt,
          amount: paymentLink.amount
        }
      });
    }

    // Verify with Paystack
    const paystackResponse = await paystackService.verifyTransaction(reference as string);

    if (paystackResponse.status && paystackResponse.data.status === 'success') {
      // Mark as paid
      paymentLink.status = 'paid';
      paymentLink.paidAt = new Date();
      paymentLink.paymentMethod = 'paystack';
      await paymentLink.save();

      // Credit the creator's wallet
      const creator = await User.findById(paymentLink.createdBy);
      if (creator) {
        await walletService.creditWallet(
          creator._id as mongoose.Types.ObjectId,
          paymentLink.amount,
          `Payment received via Pay-for-Me link: ${paymentLink.code}`,
          paymentLink.paymentReference
        );
      }

      // If linked to an order, update payment status
      if (paymentLink.orderId) {
        await Order.updateOne(
          { _id: paymentLink.orderId },
          {
            $set: {
              paymentStatus: 'paid',
              paymentMethod: 'payment_link',
              paymentReference: paymentLink.paymentReference
            }
          }
        );
      }

      return res.json({
        success: true,
        data: {
          status: 'paid',
          paidAt: paymentLink.paidAt,
          amount: paymentLink.amount,
          message: 'Payment successful! Thank you.'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        status: 'pending',
        message: 'Payment is still being processed'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify payment'
    });
  }
};

// GET /api/payment-links/my-links - Get user's created payment links
export const getMyPaymentLinks = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { page = 1, limit = 20, status } = req.query;

    const query: any = { createdBy: req.user._id };
    if (status && ['active', 'paid', 'expired', 'cancelled'].includes(status as string)) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [links, total] = await Promise.all([
      PaymentLink.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('orderId', 'orderNumber'),
      PaymentLink.countDocuments(query)
    ]);

    // Update expired links
    const now = new Date();
    const results = links.map((link: any) => {
      const isExpired = link.status === 'active' && now > link.expiresAt;
      if (isExpired) {
        link.status = 'expired';
        link.save(); // Background update
      }

      const baseUrl = process.env.FRONTEND_URL || 'https://farmchops.com';

      return {
        id: link._id,
        code: link.code,
        amount: link.amount,
        description: link.description,
        recipientName: link.recipientName,
        status: isExpired ? 'expired' : link.status,
        expiresAt: link.expiresAt,
        paidBy: link.paidBy,
        paidAt: link.paidAt,
        shareableUrl: `${baseUrl}/pay/${link.code}`,
        order: link.orderId ? {
          id: link.orderId._id,
          orderNumber: link.orderId.orderNumber
        } : null,
        createdAt: link.createdAt
      };
    });

    return res.json({
      success: true,
      data: {
        links: results,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit)
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Server error'
    });
  }
};

// PATCH /api/payment-links/:code/cancel - Cancel a payment link
export const cancelPaymentLink = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Payment link code is required' });
    }

    const paymentLink = await PaymentLink.findOne({
      code: code.toUpperCase(),
      createdBy: req.user._id
    });

    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        message: 'Payment link not found or does not belong to you'
      });
    }

    if (paymentLink.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a paid payment link'
      });
    }

    if (paymentLink.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Payment link is already cancelled'
      });
    }

    paymentLink.status = 'cancelled';
    await paymentLink.save();

    return res.json({
      success: true,
      message: 'Payment link cancelled successfully',
      data: {
        code: paymentLink.code,
        status: paymentLink.status
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel payment link'
    });
  }
};
