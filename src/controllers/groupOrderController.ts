import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GroupOrderService, GroupOrderError } from '../services/groupOrderService';
import { GroupOrder } from '../models/GroupOrder';
import mongoose from 'mongoose';
import paystackService from '../config/paystack';
import crypto from 'crypto';

/**
 * GET /api/group-orders/active
 * Get all active groups (filling or checkout_window phase)
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
          shareableCode: g.shareableCode,
          shareableLink: g.getShareableLink(),
          product: g.product,
          minParticipants: g.minParticipants,
          maxParticipants: g.maxParticipants,
          quantityPerPerson: g.quantityPerPerson,
          bulkPricePerUnit: g.bulkPricePerUnit,
          phase: g.phase,
          reservedSlots: g.reservedSlots,
          paidSlots: g.paidSlots,
          totalQuantity: g.getTotalQuantity(),
          checkoutWindowOpensAt: g.checkoutWindowOpensAt,
          checkoutWindowClosesAt: g.checkoutWindowClosesAt,
          createdAt: g.createdAt,
          participantsCount: g.participants.filter(p => p.status !== 'removed').length,
          waitlistCount: g.waitlist.length
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
 * POST /api/group-orders/:groupId/reserve
 * Reserve a slot in a group (NO PAYMENT - just reserve)
 */
export const reserveSlot = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;
    const { quantity } = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const group = await GroupOrderService.reserveSlot({
      groupId,
      userId: req.user._id as mongoose.Types.ObjectId,
      quantity
    });

    return res.json({
      success: true,
      message: group.phase === 'checkout_window'
        ? 'Group is full! Checkout window is now open. Check your email for details.'
        : 'Successfully reserved your slot in the group',
      data: {
        groupId: group.groupId,
        shareableLink: group.getShareableLink(),
        phase: group.phase,
        reservedSlots: group.reservedSlots,
        maxParticipants: group.maxParticipants,
        checkoutWindowOpensAt: group.checkoutWindowOpensAt,
        checkoutWindowClosesAt: group.checkoutWindowClosesAt,
        yourReservation: {
          quantity,
          amount: quantity * group.bulkPricePerUnit
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
      message: error instanceof Error ? error.message : 'Failed to reserve slot'
    });
  }
};

/**
 * POST /api/group-orders/:groupId/checkout
 * Checkout - Initialize payment for reserved slot
 */
export const initiateCheckout = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;
    const { deliveryInfo, deliveryFee = 0 } = req.body;

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
        message: 'Complete delivery information required (address, city, state, phoneNumber)'
      });
    }

    // Get the group
    const { GroupOrder } = await import('../models/GroupOrder');
    const group = await GroupOrder.findOne({ groupId });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
        code: 'GROUP_NOT_FOUND'
      });
    }

    // Check if checkout window is open
    if (group.phase !== 'checkout_window') {
      return res.status(400).json({
        success: false,
        message: 'Checkout window is not open for this group',
        code: 'CHECKOUT_NOT_AVAILABLE'
      });
    }

    // Find user's reservation
    const participant = group.participants.find(p =>
      p.userId.equals(req.user!._id as mongoose.Types.ObjectId) && p.status === 'reserved'
    );

    if (!participant) {
      return res.status(400).json({
        success: false,
        message: 'You do not have a reservation in this group',
        code: 'NOT_A_PARTICIPANT'
      });
    }

    // Total amount in kobo (participant.amount is already in kobo)
    const totalAmount = participant.amount + deliveryFee;

    // Generate payment reference
    const paymentReference = `grp-${crypto.randomBytes(8).toString('hex')}`;

    // Initialize Paystack payment (amount is already in kobo, Paystack expects kobo)
    const groupCallbackUrl = `${process.env.FRONTEND_URL}/group-payment/callback`;

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
        },
        groupCallbackUrl
      );

      return res.json({
        success: true,
        message: 'Payment initialized. Complete payment to confirm your slot.',
        data: {
          groupId: group.groupId,
          product: group.product,
          quantity: participant.quantity,
          amount: participant.amount,
          deliveryFee,
          totalAmount,
          checkoutDeadline: participant.checkoutDeadline,
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
      message: error instanceof Error ? error.message : 'Failed to initiate checkout'
    });
  }
};

/**
 * POST /api/group-orders/webhook/paystack
 * Handle Paystack webhook for group order checkout payments
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

        // Process checkout
        try {
          const result = await GroupOrderService.checkout({
            groupId,
            userId: new mongoose.Types.ObjectId(userId),
            deliveryInfo: parsedDeliveryInfo,
            paymentReference: reference,
            deliveryFee: parsedDeliveryFee || 0
          });

          console.log(`User ${userId} successfully checked out for group ${groupId}`);

          // If group is confirmed (all paid), log it
          if (result.group.phase === 'confirmed') {
            console.log(`Group ${groupId} confirmed - all participants paid. Orders created.`);
          }

        } catch (checkoutError: any) {
          console.error('Error processing checkout after payment:', checkoutError);
          // Even if checkout fails, acknowledge the webhook to prevent retries
          return res.status(200).json({
            success: false,
            message: 'Payment received but checkout processing failed',
            error: checkoutError.message
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
 * POST /api/group-orders/:groupId/waitlist
 * Join waitlist for a full group
 */
export const joinWaitlist = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;
    const { quantity } = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const group = await GroupOrderService.joinWaitlist({
      groupId,
      userId: req.user._id as mongoose.Types.ObjectId,
      quantity
    });

    return res.json({
      success: true,
      message: 'Successfully joined waitlist. You will be notified if a spot opens up.',
      data: {
        groupId: group.groupId,
        waitlistPosition: group.waitlist.length,
        yourQuantity: quantity
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
      message: error instanceof Error ? error.message : 'Failed to join waitlist'
    });
  }
};

/**
 * POST /api/group-orders/:groupId/leave
 * Leave a group (only if still in reserved status)
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

    const group = await GroupOrderService.leaveGroup(
      groupId,
      req.user._id as mongoose.Types.ObjectId
    );

    return res.json({
      success: true,
      message: 'Successfully left the group',
      data: {
        groupId: group.groupId,
        reservedSlots: group.reservedSlots
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
          const myParticipation = g.participants.find(p =>
            req.user && p.userId.equals(req.user._id as mongoose.Types.ObjectId)
          );

          return {
            groupId: g.groupId,
            shareableLink: g.getShareableLink(),
            product: g.product,
            minParticipants: g.minParticipants,
            maxParticipants: g.maxParticipants,
            quantityPerPerson: g.quantityPerPerson,
            bulkPricePerUnit: g.bulkPricePerUnit,
            phase: g.phase,
            reservedSlots: g.reservedSlots,
            paidSlots: g.paidSlots,
            createdAt: g.createdAt,
            checkoutWindowOpensAt: g.checkoutWindowOpensAt,
            checkoutWindowClosesAt: g.checkoutWindowClosesAt,
            myParticipation: myParticipation ? {
              quantity: myParticipation.quantity,
              amount: myParticipation.amount,
              status: myParticipation.status,
              reservedAt: myParticipation.reservedAt,
              paidAt: myParticipation.paidAt,
              checkoutDeadline: myParticipation.checkoutDeadline,
              orderId: myParticipation.orderId
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
    const sanitizedParticipants = group.participants
      .filter(p => p.status !== 'removed')
      .map(p => ({
        id: p.id,
        user: {
          firstName: p.user.firstName,
          lastName: p.user.lastName.charAt(0) + '***' // Hide last name
        },
        quantity: p.quantity,
        status: p.status,
        reservedAt: p.reservedAt,
        paidAt: p.paidAt
      }));

    return res.json({
      success: true,
      data: {
        group: {
          groupId: group.groupId,
          shareableCode: group.shareableCode,
          shareableLink: group.getShareableLink(),
          product: group.product,
          minParticipants: group.minParticipants,
          maxParticipants: group.maxParticipants,
          quantityPerPerson: group.quantityPerPerson,
          targetQuantity: group.targetQuantity,
          bulkPricePerUnit: group.bulkPricePerUnit,
          phase: group.phase,
          reservedSlots: group.reservedSlots,
          paidSlots: group.paidSlots,
          participants: sanitizedParticipants,
          waitlistCount: group.waitlist.length,
          totalQuantity: group.getTotalQuantity(),
          checkoutWindowOpensAt: group.checkoutWindowOpensAt,
          checkoutWindowClosesAt: group.checkoutWindowClosesAt,
          createdAt: group.createdAt,
          groupFilledAt: group.groupFilledAt,
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
 * GET /api/group-orders/share/:shareableCode
 * Get group by shareable code
 */
export const getGroupByShareableCode = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { shareableCode } = req.params;

    console.log('[getGroupByShareableCode] Looking up code:', shareableCode);

    if (!shareableCode) {
      return res.status(400).json({
        success: false,
        message: 'Shareable code is required'
      });
    }

    // Use the imported GroupOrder model directly
    const group = await GroupOrder.findOne({ shareableCode: shareableCode.trim() });

    console.log('[getGroupByShareableCode] Query result:', group ? `Found group ${group.groupId}` : 'Not found');

    if (!group) {
      // Debug: List a few existing shareable codes
      const sampleGroups = await GroupOrder.find({}, { shareableCode: 1, groupId: 1 }).limit(5);
      console.log('[getGroupByShareableCode] Sample existing codes:', sampleGroups.map(g => g.shareableCode));

      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    return res.json({
      success: true,
      data: {
        groupId: group.groupId,
        shareableCode: group.shareableCode,
        shareableLink: group.getShareableLink(),
        product: group.product,
        minParticipants: group.minParticipants,
        maxParticipants: group.maxParticipants,
        quantityPerPerson: group.quantityPerPerson,
        bulkPricePerUnit: group.bulkPricePerUnit,
        phase: group.phase,
        reservedSlots: group.reservedSlots,
        paidSlots: group.paidSlots,
        participantsCount: group.participants.filter(p => p.status !== 'removed').length,
        canJoin: group.canAcceptMoreParticipants()
      }
    });
  } catch (error) {
    console.error('[getGroupByShareableCode] Error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch group'
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

        const participantIndex = group.participants.findIndex(p =>
          p.userId.equals(req.user!._id as mongoose.Types.ObjectId)
        );

        if (participantIndex === -1) {
          return res.status(404).json({
            success: false,
            message: 'You are not a participant in this group'
          });
        }

        // Update participant status to 'paid' if payment was successful
        const participant = group.participants[participantIndex]!;

        if (participant.status !== 'paid') {
          participant.status = 'paid';
          participant.paidAt = new Date();
          participant.paymentReference = reference;
          await group.save();
        }

        return res.json({
          success: true,
          message: 'Payment verified and checkout completed',
          data: {
            groupId: group.groupId,
            phase: group.phase,
            participant: {
              amount: participant.amount,
              quantity: participant.quantity,
              status: participant.status,
              orderId: participant.orderId,
              paidAt: participant.paidAt
            }
          }
        });
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
