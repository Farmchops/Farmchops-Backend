import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  PayLaterApplication,
  PayLaterAccount,
  PayLaterOrder,
  PayLaterCart
} from '../models/PayLater';
import { Product } from '../models/Product';
import paylaterService from '../services/paylaterService';
import premblyService from '../services/premblyService';
import { convertCloudinaryUrlToBase64 } from '../middleware/uploadMiddleware';

interface AuthRequest extends Request {
  user?: any;
}

// POST /api/paylater/apply - Submit PayLater application with Prembly verification
export const submitApplication = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { email, firstName, lastName, gender, phoneNumber, ippis, bvn } = req.body;

    // Validate uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.ninCardImage || !files.ninCardImage[0]) {
      return res.status(400).json({
        success: false,
        message: 'NIN card image (front) is required'
      });
    }

    if (!files.passportPhoto || !files.passportPhoto[0]) {
      return res.status(400).json({
        success: false,
        message: 'Passport photograph is required'
      });
    }

    // Validate required fields
    if (!email || !firstName || !lastName || !gender || !phoneNumber || !ippis || !bvn) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: email, firstName, lastName, gender, phoneNumber, ippis, bvn'
      });
    }

    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ success: false, message: 'Gender must be male or female' });
    }

    if (!/^\d+$/.test(ippis)) {
      return res.status(400).json({ success: false, message: 'IPPIS must contain only digits' });
    }

    if (bvn.length !== 11 || !/^\d+$/.test(bvn)) {
      return res.status(400).json({ success: false, message: 'BVN must be 11 digits' });
    }

    // Check for existing application
    const existing = await paylaterService.hasExistingApplication(req.user._id);
    if (existing.hasApplication) {
      return res.status(409).json({
        success: false,
        message: existing.status === 'pending'
          ? 'You already have a pending application'
          : 'You already have an approved PayLater account'
      });
    }

    // Get uploaded file URLs from Cloudinary
    const ninCardImageUrl = (files.ninCardImage[0] as any).path; // Cloudinary URL
    const passportPhotoUrl = (files.passportPhoto[0] as any).path; // Cloudinary URL

    console.log(`[PayLater] Starting verification for ${email}...`);
    console.log(`[PayLater] NIN Card URL: ${ninCardImageUrl}`);
    console.log(`[PayLater] Passport Photo URL: ${passportPhotoUrl}`);

    // Convert images to base64 for Prembly
    const ninCardBase64 = await convertCloudinaryUrlToBase64(ninCardImageUrl);
    const passportPhotoBase64 = await convertCloudinaryUrlToBase64(passportPhotoUrl);

    // Verify with Prembly
    const verificationResults = await premblyService.verifyPaylaterApplicant({
      ippis,
      bvn,
      ninCardImageBase64: ninCardBase64,
      passportPhotoBase64: passportPhotoBase64,
      firstName,
      lastName
    });

    // Create application with verification results
    const application = await PayLaterApplication.create({
      userId: req.user._id,
      email,
      firstName,
      lastName,
      gender,
      phoneNumber,
      ippis,
      bvn,
      nin: verificationResults.nin.extractedNumber || null, // Auto-populated from OCR
      ninCardImage: ninCardImageUrl,
      passportPhoto: passportPhotoUrl,
      status: 'pending', // Always pending, requires manual admin approval
      verificationStatus: verificationResults.overallVerified ? 'verified' : 'failed',
      verificationResults: {
        ippis: {
          verified: verificationResults.ippis.verified,
          confidence: verificationResults.ippis.confidence,
          verifiedAt: verificationResults.ippis.verified ? new Date() : undefined,
          error: verificationResults.ippis.error,
          premblyResponse: verificationResults.ippis.data
        },
        bvn: {
          verified: verificationResults.bvn.verified,
          confidence: verificationResults.bvn.confidence,
          verifiedAt: verificationResults.bvn.verified ? new Date() : undefined,
          error: verificationResults.bvn.error,
          premblyResponse: verificationResults.bvn.data
        },
        nin: {
          verified: verificationResults.nin.verified,
          extractedNumber: verificationResults.nin.extractedNumber,
          verifiedAt: verificationResults.nin.verified ? new Date() : undefined,
          error: verificationResults.nin.error
        },
        faceMatch: verificationResults.faceMatch ? {
          matched: verificationResults.faceMatch.matched,
          confidence: verificationResults.faceMatch.confidence,
          verifiedAt: verificationResults.faceMatch.matched ? new Date() : undefined,
          error: verificationResults.faceMatch.error
        } : {
          matched: false
        }
      },
      verificationScore: verificationResults.verificationScore,
      verifiedAt: verificationResults.overallVerified ? new Date() : undefined
    });

    console.log(`[PayLater] Application created: ${application._id}, Score: ${verificationResults.verificationScore}/100`);

    return res.status(201).json({
      success: true,
      message: verificationResults.overallVerified
        ? 'Application submitted and verified successfully! Awaiting admin approval.'
        : 'Application submitted. Verification incomplete - admin review required.',
      data: {
        applicationId: application._id,
        status: application.status,
        verificationStatus: application.verificationStatus,
        verificationScore: application.verificationScore,
        submittedAt: application.createdAt,
        details: {
          ippisVerified: verificationResults.ippis.verified,
          bvnVerified: verificationResults.bvn.verified,
          ninExtracted: verificationResults.nin.extracted,
          ninVerified: verificationResults.nin.verified,
          faceMatched: verificationResults.faceMatch?.matched || false
        }
      }
    });
  } catch (error) {
    console.error('[PayLater] Application error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit application'
    });
  }
};

// GET /api/paylater/status - Get user's PayLater status
export const getStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const application = await PayLaterApplication.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 });

    if (!application) {
      return res.json({
        success: true,
        data: {
          hasApplication: false,
          status: null,
          account: null
        }
      });
    }

    if (application.status === 'pending') {
      return res.json({
        success: true,
        data: {
          hasApplication: true,
          status: 'pending',
          application: {
            applicationId: application._id,
            submittedAt: application.createdAt
          },
          account: null
        }
      });
    }

    if (application.status === 'rejected') {
      return res.json({
        success: true,
        data: {
          hasApplication: true,
          status: 'rejected',
          application: {
            applicationId: application._id,
            submittedAt: application.createdAt,
            rejectionReason: application.rejectionReason
          },
          account: null
        }
      });
    }

    // Approved - get account details
    const account = await paylaterService.getAccount(req.user._id);

    return res.json({
      success: true,
      data: {
        hasApplication: true,
        status: 'approved',
        account: account ? {
          creditLimit: account.creditLimit,
          availableCredit: account.availableCredit,
          hasActiveLoan: account.hasActiveLoan,
          activeLoan: account.hasActiveLoan ? {
            orderId: account.activeLoanOrderId,
            amount: account.activeLoanAmount,
            dueDate: account.activeLoanDueDate,
            repaymentStatus: 'pending'
          } : null
        } : null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
};

// GET /api/paylater/products - Get products with PayLater pricing
export const getProducts = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const canUse = await paylaterService.canUsePaylater(req.user._id);
    if (!canUse.canUse && !canUse.account) {
      return res.status(403).json({
        success: false,
        message: 'You need an approved PayLater account to view PayLater products'
      });
    }

    const { page = 1, limit = 20, category, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = { status: 'active', 'inventory.availableStock': { $gt: 0 } };
    if (category && mongoose.Types.ObjectId.isValid(category as string)) {
      query.category = new mongoose.Types.ObjectId(category as string);
    }
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select('name slug images category pricing inventory')
        .populate('category', 'name')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(query)
    ]);

    const settings = await paylaterService.getSettings();

    const productsWithPaylaterPricing = products.map((product: any) => ({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      images: product.images,
      category: product.category,
      pricing: {
        regularPrice: product.pricing.retail.price,
        paylaterPrice: Math.round(product.pricing.retail.price * (1 + settings.markupPercentage / 100)),
        markup: settings.markupPercentage,
        unit: product.inventory.unit || 'unit'
      },
      inventory: {
        availableStock: product.inventory.availableStock,
        unit: product.inventory.unit || 'unit'
      },
      status: product.inventory.availableStock > 0 ? 'in_stock' : 'out_of_stock'
    }));

    return res.json({
      success: true,
      data: {
        products: productsWithPaylaterPricing,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        },
        paylaterInfo: {
          markupPercentage: settings.markupPercentage,
          availableCredit: canUse.account?.availableCredit || 0
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get products'
    });
  }
};

// GET /api/paylater/cart - Get PayLater cart
export const getCart = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const canUse = await paylaterService.canUsePaylater(req.user._id);
    if (!canUse.account) {
      return res.status(403).json({
        success: false,
        message: 'You need an approved PayLater account'
      });
    }

    const cartData = await paylaterService.getCartWithTotals(req.user._id);

    return res.json({
      success: true,
      data: {
        cart: {
          items: cartData.cart.items,
          totalItems: cartData.totalItems,
          subtotal: cartData.subtotal,
          estimatedDelivery: cartData.deliveryFee,
          totalAmount: cartData.totalAmount
        },
        creditInfo: {
          availableCredit: canUse.account.availableCredit,
          canCheckout: canUse.canUse && cartData.totalAmount <= canUse.account.availableCredit
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get cart'
    });
  }
};

// POST /api/paylater/cart/add - Add to PayLater cart
export const addToCart = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const canUse = await paylaterService.canUsePaylater(req.user._id);
    if (!canUse.canUse) {
      return res.status(403).json({
        success: false,
        message: canUse.reason || 'Cannot add to PayLater cart'
      });
    }

    const { productId, quantity = 1 } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Valid productId is required' });
    }

    if (typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const cartData = await paylaterService.addToCart(req.user._id, productId, quantity);

    return res.json({
      success: true,
      message: 'Item added to PayLater cart',
      data: {
        cart: {
          items: cartData.cart.items,
          totalItems: cartData.totalItems,
          subtotal: cartData.subtotal,
          totalAmount: cartData.totalAmount
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add to cart'
    });
  }
};

// PUT /api/paylater/cart/update - Update cart item
export const updateCartItem = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { productId, quantity } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Valid productId is required' });
    }

    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be 0 or greater' });
    }

    const cartData = await paylaterService.updateCartItem(req.user._id, productId, quantity);

    return res.json({
      success: true,
      data: {
        cart: {
          items: cartData.cart.items,
          totalItems: cartData.totalItems,
          subtotal: cartData.subtotal,
          totalAmount: cartData.totalAmount
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update cart'
    });
  }
};

// DELETE /api/paylater/cart/remove/:productId - Remove from cart
export const removeFromCart = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Valid productId is required' });
    }

    const cartData = await paylaterService.removeFromCart(req.user._id, productId);

    return res.json({
      success: true,
      message: 'Item removed from cart',
      data: {
        cart: {
          items: cartData.cart.items,
          totalItems: cartData.totalItems,
          subtotal: cartData.subtotal,
          totalAmount: cartData.totalAmount
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove from cart'
    });
  }
};

// DELETE /api/paylater/cart/clear - Clear cart
export const clearCart = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    await paylaterService.clearCart(req.user._id);

    return res.json({
      success: true,
      message: 'Cart cleared'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear cart'
    });
  }
};

// POST /api/paylater/checkout - Process checkout
export const checkout = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { deliveryAddress } = req.body;

    if (!deliveryAddress || !deliveryAddress.street || !deliveryAddress.city ||
        !deliveryAddress.state || !deliveryAddress.phone) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required (street, city, state, phone)'
      });
    }

    const result = await paylaterService.checkout(req.user._id, deliveryAddress);

    return res.status(201).json({
      success: true,
      message: 'PayLater order placed successfully',
      data: {
        order: {
          orderId: result.order._id,
          orderNumber: result.order.orderNumber,
          totalAmount: result.order.totalAmount,
          dueDate: result.order.dueDate,
          orderStatus: result.order.orderStatus
        },
        account: {
          previousCredit: result.account.creditLimit,
          amountUsed: result.order.totalAmount,
          remainingCredit: result.account.availableCredit,
          hasActiveLoan: result.account.hasActiveLoan
        }
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Checkout failed'
    });
  }
};

// GET /api/paylater/orders - Get order history
export const getOrders = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      PayLaterOrder.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('orderNumber totalAmount orderStatus repaymentStatus createdAt dueDate repaidAt'),
      PayLaterOrder.countDocuments({ userId: req.user._id })
    ]);

    return res.json({
      success: true,
      data: {
        orders: orders.map(o => ({
          _id: o._id,
          orderNumber: o.orderNumber,
          totalAmount: o.totalAmount,
          orderStatus: o.orderStatus,
          repaymentStatus: o.repaymentStatus,
          createdAt: o.createdAt,
          dueDate: o.dueDate,
          repaidAt: o.repaidAt
        })),
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

// GET /api/paylater/orders/:id - Get single order details
export const getOrderById = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;

    const order = await PayLaterOrder.findOne({ _id: id, userId: req.user._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get order'
    });
  }
};
