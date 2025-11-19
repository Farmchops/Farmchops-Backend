import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GroupOrderService, GroupOrderError } from '../services/groupOrderService';
import mongoose from 'mongoose';
import paystackService from '../config/paystack';
import crypto from 'crypto';

/**
 * GET /api/group-orders/active
 * Get all active groups
 */
export const getActiveGroups = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { productId } = req.query;

    let groups;
    if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
      groups = await GroupOrderService.getActiveGroupsForProduct(new mongoose.Types.ObjectId(String(productId)));
    } else {
      groups = await GroupOrderService.getAllActiveGroups();
    }

    return res.json({
      success: true,
      data: {
        groups: groups.map(g => ({
          groupId: g.groupId,
          product: g.product,
          totalSlots: g.totalSlots,
          filledSlots: g.filledSlots,
          quantityPerSlot: g.quantityPerSlot,
          pricePerSlot: g.pricePerSlot,
          status: g.status,
          createdAt: g.createdAt,
          participantsCount: g.participants.length
        }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch active groups'
    });
  }
};

/**
 * POST /api/group-orders/:groupId/join
 * Join a group - Initialize payment flow (matches regular checkout)
 */
export const joinGroup = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;
    const { deliveryInfo, paymentMethod = 'paystack', deliveryFee = 0 } = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // Validate delivery info
    if (!deliveryInfo || !deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.state || !deliveryInfo.phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Complete delivery information required'
      });
    }

    // Validate payment method
    if (!paymentMethod || !['wallet', 'paystack'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment method (wallet, paystack) is required'
      });
    }

    // Get the group to get price information
    const { GroupOrder } = await import('../models/GroupOrder');
    const group = await GroupOrder.findOne({ groupId, status: 'active' });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or already full',
        code: 'GROUP_NOT_AVAILABLE'
      });
    }

    // Check if user already joined
    const alreadyJoined = group.participants.some(p => p.userId.equals(req.user!._id as mongoose.Types.ObjectId));
    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this group',
        code: 'ALREADY_JOINED'
      });
    }

    // Check if group is full
    if (group.filledSlots >= group.totalSlots) {
      return res.status(400).json({
        success: false,
        message: 'Group is already full',
        code: 'GROUP_FULL'
      });
    }

    const totalAmount = group.pricePerSlot + deliveryFee;

    // Generate payment reference
    const paymentReference = `grp-${crypto.randomBytes(8).toString('hex')}`;

    // If payment method is Paystack, initialize payment and return authorization URL
    if (paymentMethod === 'paystack') {
      try {
        const paystackResponse = await paystackService.initializeTransaction(
          req.user.email,
          totalAmount,
          paymentReference,
          {
            groupId,
            userId: (req.user._id as mongoose.Types.ObjectId).toString(),
            deliveryInfo: JSON.stringify(deliveryInfo),
            deliveryFee: deliveryFee.toString()
          }
        );

        return res.json({
          success: true,
          message: 'Payment initialized. Complete payment to join group.',
          data: {
            groupId: group.groupId,
            product: group.product,
            totalSlots: group.totalSlots,
            filledSlots: group.filledSlots,
            pricePerSlot: group.pricePerSlot,
            deliveryFee,
            totalAmount,
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
          message: 'Payment initialization failed',
          error: paystackError.message
        });
      }
    }

    // If payment method is wallet, process immediately
    // TODO: Implement wallet payment logic
    return res.status(400).json({
      success: false,
      message: 'Wallet payment not yet implemented for group orders'
    });

  } catch (error) {
    if (error instanceof GroupOrderError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to join group'
    });
  }
};

/**
 * POST /api/group-orders/:groupId/leave
 * Leave a group
 */
export const leaveGroup = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const result = await GroupOrderService.leaveGroup({
      groupId,
      userId: req.user._id as mongoose.Types.ObjectId
    });

    return res.json({
      success: true,
      message: 'Successfully left the group. Refund is being processed.',
      data: {
        refund: {
          amount: result.refundAmount,
          status: 'processing'
        },
        group: {
          groupId: result.group.groupId,
          filledSlots: result.group.filledSlots,
          totalSlots: result.group.totalSlots
        }
      }
    });
  } catch (error) {
    if (error instanceof GroupOrderError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to leave group'
    });
  }
};

/**
 * GET /api/users/me/group-orders
 * Get current user's group participations
 */
export const getMyGroups = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const groups = await GroupOrderService.getUserGroups(req.user._id as mongoose.Types.ObjectId);

    return res.json({
      success: true,
      data: {
        groups: groups.map(g => {
          const myParticipation = g.participants.find(p => req.user && p.userId.equals(req.user._id as mongoose.Types.ObjectId));
          return {
            groupId: g.groupId,
            product: g.product,
            filledSlots: g.filledSlots,
            totalSlots: g.totalSlots,
            status: g.status,
            createdAt: g.createdAt,
            confirmedAt: g.confirmedAt,
            myParticipation: myParticipation ? {
              amount: myParticipation.amount,
              quantity: myParticipation.quantity,
              paymentStatus: myParticipation.paymentStatus,
              orderId: myParticipation.orderId,
              joinedAt: myParticipation.joinedAt
            } : null
          };
        })
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch your groups'
    });
  }
};

/**
 * GET /api/group-orders/:groupId
 * Get group details
 */
export const getGroupDetails = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const { GroupOrder } = await import('../models/GroupOrder');
    const group = await GroupOrder.findOne({ groupId });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Hide sensitive participant data
    const sanitizedParticipants = group.participants.map(p => ({
      id: p.id,
      user: {
        firstName: p.user.firstName,
        lastName: p.user.lastName.charAt(0) + '***' // Hide last name
      },
      joinedAt: p.joinedAt
    }));

    return res.json({
      success: true,
      data: {
        group: {
          groupId: group.groupId,
          product: group.product,
          totalSlots: group.totalSlots,
          filledSlots: group.filledSlots,
          quantityPerSlot: group.quantityPerSlot,
          pricePerSlot: group.pricePerSlot,
          status: group.status,
          participants: sanitizedParticipants,
          createdAt: group.createdAt,
          confirmedAt: group.confirmedAt
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch group details'
    });
  }
};

/**
 * POST /api/group-orders/webhook/paystack
 * Handle Paystack webhook for group order payments
 */
export const groupOrderPaystackWebhook = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // Verify webhook signature
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

      // Check if this is a group order payment
      if (metadata && metadata.groupId) {
        const { groupId, userId, deliveryInfo, deliveryFee } = metadata;

        // Parse deliveryInfo if it's a string
        const parsedDeliveryInfo = typeof deliveryInfo === 'string'
          ? JSON.parse(deliveryInfo)
          : deliveryInfo;

        const parsedDeliveryFee = typeof deliveryFee === 'string'
          ? parseFloat(deliveryFee)
          : deliveryFee;

        // Add user to the group
        try {
          const result = await GroupOrderService.joinGroup({
            groupId,
            userId: new mongoose.Types.ObjectId(userId),
            deliveryInfo: parsedDeliveryInfo,
            paymentReference: reference,
            deliveryFee: parsedDeliveryFee || 0
          });

          console.log(`User ${userId} successfully joined group ${groupId} after payment confirmation`);

          // If group was auto-confirmed (full), log it
          if (result.autoConfirmed) {
            console.log(`Group ${groupId} is now full and confirmed. Orders created for all participants.`);
          }

        } catch (joinError: any) {
          console.error('Error joining group after payment:', joinError);
          // Even if joining fails, acknowledge the webhook to prevent retries
          return res.status(200).json({
            success: false,
            message: 'Payment received but failed to join group',
            error: joinError.message
          });
        }
      }
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Group order Paystack webhook error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Webhook processing failed'
    });
  }
};

/**
 * GET /api/group-orders/verify-payment/:reference
 * Verify group order payment (for frontend to poll/check)
 */
export const verifyGroupOrderPayment = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    // Verify with Paystack
    const paystackResponse = await paystackService.verifyTransaction(reference);

    if (paystackResponse.status && paystackResponse.data.status === 'success') {
      const metadata = paystackResponse.data.metadata;

      if (metadata && metadata.groupId) {
        // Check if user is now in the group
        const { GroupOrder } = await import('../models/GroupOrder');
        const group = await GroupOrder.findOne({ groupId: metadata.groupId });

        if (!group) {
          return res.status(404).json({
            success: false,
            message: 'Group not found'
          });
        }

        const participant = group.participants.find(p =>
          p.userId.equals(req.user!._id as mongoose.Types.ObjectId)
        );

        if (participant) {
          return res.json({
            success: true,
            message: 'Payment verified and you have joined the group',
            data: {
              groupId: group.groupId,
              filledSlots: group.filledSlots,
              totalSlots: group.totalSlots,
              status: group.status,
              participant: {
                amount: participant.amount,
                quantity: participant.quantity,
                joinedAt: participant.joinedAt
              }
            }
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'Payment verified but you are not in the group yet. Please try again.'
          });
        }
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Payment verification failed'
    });

  } catch (error: any) {
    console.error('Verify group order payment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment'
    });
  }
};
