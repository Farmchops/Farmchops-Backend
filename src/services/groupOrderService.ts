import mongoose from 'mongoose';
import { GroupOrder, IGroupOrder, IGroupParticipant } from '../models/GroupOrder';
import { Product, IProduct } from '../models/Product';
import { Order } from '../models/Order';
import User, { IUser } from '../models/User';
import crypto from 'crypto';

export class GroupOrderError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number = 400, code: string = 'GROUP_ORDER_ERROR') {
    super(message);
    this.name = 'GroupOrderError';
    this.status = status;
    this.code = code;
  }
}

interface CreateGroupParams {
  productId: mongoose.Types.ObjectId;
}

interface JoinGroupParams {
  groupId: string;
  userId: mongoose.Types.ObjectId;
  deliveryInfo: {
    address: string;
    city: string;
    state: string;
    phoneNumber: string;
  };
  paymentReference: string;
  deliveryFee: number;
}

interface LeaveGroupParams {
  groupId: string;
  userId: mongoose.Types.ObjectId;
}

export class GroupOrderService {
  /**
   * Create a new group for a product
   */
  static async createGroup(params: CreateGroupParams): Promise<IGroupOrder> {
    const { productId } = params;

    const product = await Product.findById(productId);
    if (!product) {
      throw new GroupOrderError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    if (!product.groupBuyingEnabled || !product.groupConfig) {
      throw new GroupOrderError('Group buying not enabled for this product', 400, 'GROUP_BUYING_DISABLED');
    }

    // Check if max active groups reached
    const activeGroupsCount = await GroupOrder.countDocuments({
      'product._id': productId,
      status: 'active'
    });

    if (activeGroupsCount >= product.groupConfig.maxActiveGroups) {
      throw new GroupOrderError('Maximum active groups reached for this product', 400, 'MAX_GROUPS_REACHED');
    }

    // Generate unique group ID
    const groupId = await GroupOrder.generateGroupId();

    // Create the group
    const group = await GroupOrder.create({
      groupId,
      product: {
        _id: product._id,
        name: product.name,
        images: product.images
      },
      totalSlots: product.groupConfig.totalSlots,
      quantityPerSlot: product.groupConfig.quantityPerSlot,
      pricePerSlot: product.groupConfig.pricePerSlot,
      participants: [],
      filledSlots: 0,
      status: 'active'
    });

    return group;
  }

  /**
   * Join an existing group - with race condition handling
   */
  static async joinGroup(params: JoinGroupParams): Promise<{ group: IGroupOrder; autoConfirmed: boolean; orders?: any[] }> {
    const { groupId, userId, deliveryInfo, paymentReference, deliveryFee } = params;

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user details
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new GroupOrderError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Find and update group atomically (prevents race condition)
      const group = await GroupOrder.findOne({
        groupId,
        status: 'active',
        filledSlots: { $lt: mongoose.connection.db ? await GroupOrder.findOne({ groupId }).then(g => g?.totalSlots || 0) : 0 }
      }).session(session);

      if (!group) {
        throw new GroupOrderError('Group not found or already full', 404, 'GROUP_NOT_AVAILABLE');
      }

      // Check if user already joined
      const alreadyJoined = group.participants.some(p => p.userId.equals(userId));
      if (alreadyJoined) {
        throw new GroupOrderError('You have already joined this group', 400, 'ALREADY_JOINED');
      }

      // Verify payment (in production, verify with Paystack API)
      // For now, we'll assume payment is verified

      // Create participant data
      const participantId = crypto.randomBytes(8).toString('hex');
      const participant: IGroupParticipant = {
        id: participantId,
        userId: userId as mongoose.Types.ObjectId,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || ''
        },
        quantity: group.quantityPerSlot,
        amount: group.pricePerSlot,
        paymentStatus: 'paid',
        paymentReference,
        paidAt: new Date(),
        deliveryInfo,
        deliveryFee,
        joinedAt: new Date()
      };

      // Add participant and increment filled slots
      group.participants.push(participant);
      group.filledSlots += 1;

      let autoConfirmed = false;
      let orders: any[] = [];

      // Check if group is now full - auto-confirm
      if (group.filledSlots === group.totalSlots) {
        autoConfirmed = true;
        group.status = 'confirmed';
        group.confirmedAt = new Date();

        // Create individual orders for all participants
        orders = await this.createOrdersFromGroup(group, session);

        // Update participants with order IDs
        for (let i = 0; i < group.participants.length; i++) {
          const participant = group.participants[i];
          const order = orders[i];
          if (participant && order) {
            participant.orderId = order._id;
          }
        }
      }

      await group.save({ session });
      await session.commitTransaction();

      return { group, autoConfirmed, orders: autoConfirmed ? orders : undefined };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Leave a group and process refund
   */
  static async leaveGroup(params: LeaveGroupParams): Promise<{ group: IGroupOrder; refundAmount: number }> {
    const { groupId, userId } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const group = await GroupOrder.findOne({ groupId, status: 'active' }).session(session);

      if (!group) {
        throw new GroupOrderError('Group not found or already confirmed', 404, 'GROUP_NOT_AVAILABLE');
      }

      // Find participant
      const participantIndex = group.participants.findIndex(p => p.userId.equals(userId));
      if (participantIndex === -1) {
        throw new GroupOrderError('You are not a participant in this group', 400, 'NOT_A_PARTICIPANT');
      }

      const participant = group.participants[participantIndex];
      if (!participant) {
        throw new GroupOrderError('Participant data not found', 404, 'PARTICIPANT_NOT_FOUND');
      }

      const refundAmount = participant.amount + participant.deliveryFee;

      // Remove participant
      group.participants.splice(participantIndex, 1);
      group.filledSlots -= 1;

      await group.save({ session });

      // Process refund (in production, use Paystack refund API)
      // TODO: Integrate with Paystack refund API
      // await this.processRefund(participant.paymentReference, refundAmount);

      await session.commitTransaction();

      return { group, refundAmount };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Create individual orders from a confirmed group
   */
  private static async createOrdersFromGroup(group: IGroupOrder, session: mongoose.ClientSession): Promise<any[]> {
    const orders = [];

    for (const participant of group.participants) {
      const order = await Order.create([{
        user: participant.userId,
        items: [{
          product: group.product._id,
          productName: group.product.name,
          quantity: participant.quantity,
          priceType: 'retail' as 'retail' | 'bulk',
          unitPrice: participant.amount / participant.quantity,
          totalPrice: participant.amount
        }],
        subtotal: participant.amount,
        deliveryFee: participant.deliveryFee,
        totalAmount: participant.amount + participant.deliveryFee,
        paymentMethod: 'paystack' as 'wallet' | 'pay_later' | 'paystack',
        paymentStatus: 'paid' as 'pending' | 'paid' | 'failed',
        orderStatus: 'ready_for_processing' as any,
        currentStageOwnerRole: 'processing' as any,
        paymentReference: participant.paymentReference,
        paymentProvider: 'paystack' as 'paystack',
        deliveryInfo: participant.deliveryInfo,
        groupOrder: {
          isGroupOrder: true,
          groupId: group.groupId,
          initiator: group.participants[0]?.userId || participant.userId,
          participants: group.participants.map(p => ({
            user: p.userId,
            joinedAt: p.joinedAt,
            items: [{
              product: group.product._id,
              productName: group.product.name,
              quantity: p.quantity,
              priceType: 'retail' as 'retail' | 'bulk',
              unitPrice: p.amount / p.quantity,
              totalPrice: p.amount
            }],
            subtotal: p.amount
          }))
        }
      }], { session });

      orders.push(order[0]);

      // Decrease product stock
      const product = await Product.findById(group.product._id).session(session);
      if (product && typeof (product as any).updateStock === 'function') {
        await (product as any).updateStock(participant.quantity, 'decrease');
      }
    }

    return orders;
  }

  /**
   * Get active groups for a product
   */
  static async getActiveGroupsForProduct(productId: mongoose.Types.ObjectId): Promise<IGroupOrder[]> {
    return await GroupOrder.find({
      'product._id': productId,
      status: 'active'
    }).sort({ createdAt: -1 });
  }

  /**
   * Get all active groups
   */
  static async getAllActiveGroups(): Promise<IGroupOrder[]> {
    return await GroupOrder.find({
      status: 'active'
    }).sort({ createdAt: -1 });
  }

  /**
   * Get user's group participations
   */
  static async getUserGroups(userId: mongoose.Types.ObjectId): Promise<IGroupOrder[]> {
    return await GroupOrder.find({
      'participants.userId': userId
    }).sort({ createdAt: -1 });
  }

  /**
   * Cancel a group (admin only)
   */
  static async cancelGroup(groupId: string, reason: string): Promise<IGroupOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const group = await GroupOrder.findOne({ groupId }).session(session);

      if (!group) {
        throw new GroupOrderError('Group not found', 404, 'GROUP_NOT_FOUND');
      }

      if (group.status !== 'active') {
        throw new GroupOrderError('Only active groups can be cancelled', 400, 'INVALID_STATUS');
      }

      group.status = 'cancelled';
      group.cancelledAt = new Date();
      group.cancelledReason = reason;

      await group.save({ session });

      // Process refunds for all participants
      for (const participant of group.participants) {
        const refundAmount = participant.amount + participant.deliveryFee;
        // TODO: Process refund via Paystack
        // await this.processRefund(participant.paymentReference, refundAmount);
      }

      await session.commitTransaction();

      return group;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Process refund via Paystack (placeholder)
   */
  private static async processRefund(paymentReference: string, amount: number): Promise<void> {
    // TODO: Implement Paystack refund API integration
    console.log(`Processing refund: ${paymentReference} - ₦${amount / 100}`);
  }
}
