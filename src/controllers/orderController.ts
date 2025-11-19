import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { getCart, clearCart } from '../utils/cartHelpers';
import { getDistanceBetween } from '../services/googleMapsService';
import { CheckoutRequest, CheckoutSummaryResponse } from '../types/order.types';
import { Order, IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { Deal } from '../models/Deal';
import paystackService from '../config/paystack';
import crypto from 'crypto';
import emailService from '../services/emailService';
import User from '../models/User';

// Fee config (NGN in kobo)
const BASE_FEE = 200; // base delivery fee
const PER_KM = 100; // per kilometer
const MIN_FEE = 300;
const FREE_THRESHOLD = 10000000; // free delivery if subtotal >= this (in kobo) - 100,000 Naira

function calculateFee(subtotal: number, distanceKm: number): number {
  if (subtotal >= FREE_THRESHOLD) return 0;
  const fee = Math.max(MIN_FEE, Math.round(BASE_FEE + PER_KM * distanceKm));
  return fee;
}

export const checkoutSummary = async (req: Request<{}, CheckoutSummaryResponse, CheckoutRequest>, res: Response<CheckoutSummaryResponse>): Promise<Response<CheckoutSummaryResponse>> => {
  try {
    const { name, phone, address, origin, notes } = req.body;
    if (!name || !phone || !address) {
      return res.status(400).json({ success: false, message: 'name, phone and address are required' });
    }

    const cart = await getCart(req);
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Server origin (warehouse) - you may want to make this configurable
    const warehouse = origin || process.env.DEFAULT_WAREHOUSE_COORDS || '6.5244,3.3792';

    // Use Google Distance Matrix to calculate distance
    const distanceResult = await getDistanceBetween(warehouse, address);
    const distanceKm = Number((distanceResult.distanceMeters / 1000).toFixed(2));

    const subtotal = cart.totalAmount; // assume stored in same currency unit as prices
    const deliveryFee = calculateFee(subtotal, distanceKm);

    const totals = {
      subtotal,
      deliveryFee,
      grandTotal: subtotal + deliveryFee
    };

    return res.json({
      success: true,
      data: {
        cart,
        customerInfo: {
          name,
          phone
        },
        delivery: {
          address,
          distanceKm,
          durationSeconds: distanceResult.durationSeconds,
          distanceText: distanceResult.distanceText,
          durationText: distanceResult.durationText,
          fee: deliveryFee
        },
        notes: notes || null,
        totals
      }
    });
  } catch (error: any) {
    console.error('Checkout summary error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to compute checkout summary' });
  }
};

/**
 * Create order from cart
 * POST /api/orders/create
 */
export const createOrder = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // User must be authenticated
    if (!req.user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      deliveryInfo,
      paymentMethod,
      deliveryFee
    } = req.body;

    // Validate required fields
    if (!deliveryInfo || !deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.state || !deliveryInfo.phoneNumber) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Delivery information (address, city, state, phoneNumber) is required'
      });
    }

    if (!paymentMethod || !['wallet', 'pay_later', 'paystack'].includes(paymentMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Valid payment method (wallet, pay_later, paystack) is required'
      });
    }

    // Get cart
    const cart = await getCart(req);
    if (!cart || !cart.items || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Calculate delivery fee if not provided
    let calculatedDeliveryFee = deliveryFee;
    if (!calculatedDeliveryFee || calculatedDeliveryFee === 0) {
      try {
        const warehouse = process.env.DEFAULT_WAREHOUSE_COORDS || '6.5244,3.3792';
        const distanceResult = await getDistanceBetween(warehouse, deliveryInfo.address);
        const distanceKm = Number((distanceResult.distanceMeters / 1000).toFixed(2));
        calculatedDeliveryFee = calculateFee(cart.totalAmount, distanceKm);
      } catch (error) {
        console.error('Error calculating delivery fee:', error);
        calculatedDeliveryFee = MIN_FEE;
      }
    }

    // CRITICAL: Validate and reserve deal inventory BEFORE creating order
    const dealValidations: Map<string, { deal: any; requestedQuantity: number; userPreviousQuantity: number }> = new Map();

    for (const item of cart.items) {
      if (item.dealId) {
        const dealId = String(item.dealId);
        
        // Find the deal
        const deal = await Deal.findById(dealId).session(session);
        
        if (!deal) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Deal not found for item: ${item.name}`
          });
        }

        // Check if deal is active
        const now = new Date();
        const computedStatus = Deal.determineStatus({
          startAt: deal.startAt,
          endAt: deal.endAt,
          soldUnits: deal.soldUnits,
          maxUnits: deal.maxUnits,
          status: deal.status
        });

        if (computedStatus !== 'active') {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Deal is no longer active: ${deal.title}`
          });
        }

        // Check if deal has enough inventory
        const remainingUnits = deal.maxUnits - deal.soldUnits;
        if (remainingUnits < item.quantity) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Deal sold out or insufficient quantity. Only ${remainingUnits} units remaining for: ${deal.title}`
          });
        }

        // Check per-user limit
        const userPreviousOrders = await Order.find({
          user: req.user._id,
          'items.deal': new mongoose.Types.ObjectId(dealId)
        }).session(session);

        const userPreviousQuantity = userPreviousOrders.reduce((sum, order) => {
          return sum + order.items
            .filter(orderItem => orderItem.deal?.toString() === dealId)
            .reduce((itemSum, orderItem) => itemSum + orderItem.quantity, 0);
        }, 0);

        const totalUserQuantity = userPreviousQuantity + item.quantity;

        if (totalUserQuantity > deal.perUserLimit) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Deal limit exceeded. You can only purchase ${deal.perUserLimit} units total. You've already claimed ${userPreviousQuantity} units for: ${deal.title}`
          });
        }

        // Store for later increment
        if (!dealValidations.has(dealId)) {
          dealValidations.set(dealId, {
            deal,
            requestedQuantity: item.quantity,
            userPreviousQuantity
          });
        } else {
          // Same deal appears multiple times in cart (shouldn't happen but handle it)
          const existing = dealValidations.get(dealId)!;
          existing.requestedQuantity += item.quantity;
        }
      }
    }

    // Now increment soldUnits for all deals
    for (const [dealId, validation] of dealValidations.entries()) {
      const { deal, requestedQuantity } = validation;
      
      deal.soldUnits += requestedQuantity;
      
      // Update status if needed
      const newStatus = Deal.determineStatus({
        startAt: deal.startAt,
        endAt: deal.endAt,
        soldUnits: deal.soldUnits,
        maxUnits: deal.maxUnits,
        status: deal.status
      });
      
      if (newStatus !== deal.status) {
        deal.status = newStatus;
      }
      
      await deal.save({ session });
      
      console.log(`Deal ${dealId} - Incremented soldUnits by ${requestedQuantity}. New total: ${deal.soldUnits}/${deal.maxUnits}`);
    }

    // Convert cart items to order items format
    const orderItems = cart.items.map((item) => ({
      productId: new mongoose.Types.ObjectId(item.productId),
      quantity: item.quantity,
      priceType: item.priceType as 'retail' | 'bulk',
      unitPrice: typeof item.price === 'number' ? item.price : undefined,
      totalPrice: typeof item.price === 'number' ? item.price * item.quantity : undefined,
      dealId: item.dealId ? new mongoose.Types.ObjectId(item.dealId) : undefined
    }));

    // Generate payment reference for Paystack
    let paymentReference;
    if (paymentMethod === 'paystack') {
      paymentReference = `PAY-${Date.now()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    }

    // Create the order within the transaction
    const order = await Order.createIndividualOrder({
      userId: req.user._id as mongoose.Types.ObjectId,
      items: orderItems,
      deliveryInfo,
      paymentMethod,
      deliveryFee: calculatedDeliveryFee,
      payementReference: paymentReference
    }, session);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Clear the cart after successful order creation
    await clearCart(req);

    const handoverCode = (order as any).handoverCodePlain;

    // Populate order details for response
    await order.populate('user', 'firstName lastName email');
    await order.populate('items.product', 'name images');

    // Send order confirmation email
    const user = await User.findById(req.user._id);
    if (user) {
      await emailService.sendOrderConfirmationEmail(user.email, {
        orderNumber: order.orderNumber,
        customerName: `${user.firstName} ${user.lastName}`,
        items: order.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.totalPrice
        })),
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        deliveryAddress: `${deliveryInfo.address}, ${deliveryInfo.city}, ${deliveryInfo.state}`,
        paymentMethod: paymentMethod,
        handoverCode
      });
    }

    // If payment method is Paystack, initialize payment
    if (paymentMethod === 'paystack' && user) {
      try {
        const paystackResponse = await paystackService.initializeTransaction(
          user.email,
          order.totalAmount,
          paymentReference!,
          {
            orderId: (order._id as mongoose.Types.ObjectId).toString(),
            orderNumber: order.orderNumber,
            customerId: (req.user._id as mongoose.Types.ObjectId).toString()
          }
        );

        return res.status(201).json({
          success: true,
          message: 'Order created successfully',
          data: {
            order,
            handoverCode,
            payment: {
              authorizationUrl: paystackResponse.data.authorization_url,
              accessCode: paystackResponse.data.access_code,
              reference: paystackResponse.data.reference
            }
          }
        });
      } catch (paystackError: any) {
        console.error('Paystack initialization error:', paystackError);
        return res.status(500).json({
          success: false,
          message: 'Order created but payment initialization failed',
          error: paystackError.message,
          data: { order, handoverCode }
        });
      }
    }

    // For pay_later, include payment link
    if (paymentMethod === 'pay_later') {
      const paymentLink = `${process.env.FRONTEND_URL}/pay/order/${order.orderNumber}`;

      return res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          order,
          handoverCode,
          paymentLink,
          expiresIn: '7 days'
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order, handoverCode }
    });

  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
};

// ... rest of the functions remain the same ...

export const paystackWebhook = async (req: Request, res: Response) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, metadata } = event.data;

      const order = await Order.findOne({ paymentReference: reference });

      if (!order) {
        console.error('Order not found for payment reference:', reference);
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        if (order.orderStatus !== 'ready_for_processing') {
          order.orderStatus = 'ready_for_processing';
          order.currentStageOwnerRole = 'processing';
          order.addStatusHistory({
            status: 'ready_for_processing',
            note: 'Paystack payment confirmed',
            role: 'system',
            updatedByName: 'System'
          });
        }
        order.providerResponse = event.data;
        await order.save();

        const user = await User.findById(order.user);
        if (user) {
          await emailService.sendPaymentSuccessEmail(user.email, {
            orderNumber: order.orderNumber,
            customerName: `${user.firstName} ${user.lastName}`,
            amount: order.totalAmount,
            paymentMethod: 'Paystack'
          });
        }

        console.log(`Payment confirmed for order ${order.orderNumber}`);
      }
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Paystack webhook error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Webhook processing failed'
    });
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    const paystackResponse = await paystackService.verifyTransaction(reference);

    if (paystackResponse.status && paystackResponse.data.status === 'success') {
      const order = await Order.findOne({ paymentReference: reference });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (order.user.toString() !== (req.user._id as mongoose.Types.ObjectId).toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
      }

      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        if (order.orderStatus !== 'ready_for_processing') {
          order.orderStatus = 'ready_for_processing';
          order.currentStageOwnerRole = 'processing';
          order.addStatusHistory({
            status: 'ready_for_processing',
            note: 'Paystack payment verified manually',
            role: 'system',
            updatedByName: 'System'
          });
        }
        order.providerResponse = paystackResponse.data;
        await order.save();

        const user = await User.findById(order.user);
        if (user) {
          await emailService.sendPaymentSuccessEmail(user.email, {
            orderNumber: order.orderNumber,
            customerName: `${user.firstName} ${user.lastName}`,
            amount: order.totalAmount,
            paymentMethod: 'Paystack'
          });
        }
      }

      await order.populate('items.product', 'name images');

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: { order, paymentData: paystackResponse.data }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: paystackResponse
      });
    }

  } catch (error: any) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed'
    });
  }
};

export const getUserOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Riders and other assigned users should also see orders they've been assigned to.
    const assignedTo = req.query.assignedTo as string | undefined;

    const baseFilter: any = {};
    if (assignedTo && req.user.role === 'admin') {
      // Admins can query orders assigned to a specific user
      if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        baseFilter['assignedRider.rider'] = new mongoose.Types.ObjectId(assignedTo);
      }
    } else {
      // Default: return orders placed by the user OR orders assigned to them (for riders)
      baseFilter.$or = [
        { user: req.user._id },
        { 'assignedRider.rider': req.user._id }
      ];
    }

    const orders = await Order.find(baseFilter)
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(baseFilter);

    return res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalOrders / limit),
          totalOrders,
          ordersPerPage: limit
        }
      }
    });

  } catch (error: any) {
    console.error('Get user orders error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders'
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate('items.product', 'name images pricing');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user._id.toString() !== (req.user._id as mongoose.Types.ObjectId).toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }

    return res.json({
      success: true,
      data: { order }
    });

  } catch (error: any) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order'
    });
  }
};

export const getOrderByNumber = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('user', 'firstName lastName email phone')
      .populate('items.product', 'name images pricing');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user._id.toString() !== (req.user._id as mongoose.Types.ObjectId).toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }

    return res.json({
      success: true,
      data: { order }
    });

  } catch (error: any) {
    console.error('Get order by number error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order'
    });
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { reason } = req.body;

    await order.cancelOrder(reason);

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });

  } catch (error: any) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order'
    });
  }
};