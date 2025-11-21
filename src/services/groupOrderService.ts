import mongoose from 'mongoose';
import { GroupOrder, IGroupOrder, IGroupParticipant } from '../models/GroupOrder';
import { Product, IProduct } from '../models/Product';
import { Order } from '../models/Order';
import User, { IUser } from '../models/User';
import crypto from 'crypto';
import emailService from './emailService';

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

interface ReserveSlotParams {
  groupId: string;
  userId: mongoose.Types.ObjectId;
  quantity: number;
}

interface CheckoutParams {
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

interface JoinWaitlistParams {
  groupId: string;
  userId: mongoose.Types.ObjectId;
  quantity: number;
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
      phase: { $in: ['filling', 'checkout_window'] }
    });

    if (activeGroupsCount >= product.groupConfig.maxActiveGroups) {
      throw new GroupOrderError('Maximum active groups reached for this product', 400, 'MAX_GROUPS_REACHED');
    }

    // Generate unique group ID and shareable code
    const groupId = await GroupOrder.generateGroupId();
    const shareableCode = GroupOrder.generateShareableCode();

    // Create the group
    const group = await GroupOrder.create({
      groupId,
      shareableCode,
      product: {
        _id: product._id,
        name: product.name,
        images: product.images
      },
      minParticipants: product.groupConfig.minParticipants,
      maxParticipants: product.groupConfig.maxParticipants,
      quantityPerPerson: product.groupConfig.quantityPerPerson,
      targetQuantity: product.groupConfig.targetQuantity || product.groupConfig.maxParticipants * product.groupConfig.quantityPerPerson.max,
      bulkPricePerUnit: product.groupConfig.bulkPricePerUnit,
      deadlineHours: product.groupConfig.deadlineHours,
      maxActiveGroups: product.groupConfig.maxActiveGroups,
      checkoutWindowDurationHours: product.groupConfig.checkoutWindowHours,
      phase: 'filling',
      participants: [],
      waitlist: [],
      reservedSlots: 0,
      paidSlots: 0
    });

    return group;
  }

  /**
   * Reserve a slot in a group (NO PAYMENT YET)
   */
  static async reserveSlot(params: ReserveSlotParams): Promise<IGroupOrder> {
    const { groupId, userId, quantity } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user details
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new GroupOrderError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Find group
      const group = await GroupOrder.findOne({
        groupId,
        phase: 'filling'
      }).session(session);

      if (!group) {
        throw new GroupOrderError('Group not found or no longer accepting participants', 404, 'GROUP_NOT_AVAILABLE');
      }

      // Check if user already reserved
      const alreadyReserved = group.participants.some(p =>
        p.userId.equals(userId) && p.status !== 'removed'
      );
      if (alreadyReserved) {
        throw new GroupOrderError('You have already joined this group', 400, 'ALREADY_JOINED');
      }

      // Check if group is full
      if (!group.canAcceptMoreParticipants()) {
        throw new GroupOrderError('Group is full', 400, 'GROUP_FULL');
      }

      // Validate quantity
      if (quantity < group.quantityPerPerson.min || quantity > group.quantityPerPerson.max) {
        throw new GroupOrderError(
          `Quantity must be between ${group.quantityPerPerson.min} and ${group.quantityPerPerson.max}`,
          400,
          'INVALID_QUANTITY'
        );
      }

      // Calculate amount
      const amount = quantity * group.bulkPricePerUnit;

      // Create participant
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
        quantity,
        amount,
        status: 'reserved',
        reservedAt: new Date()
      };

      // Add participant
      group.participants.push(participant);

      // Check if group should open checkout window
      if (group.shouldOpenCheckoutWindow()) {
        await this.openCheckoutWindow(group, session);
      }

      await group.save({ session });
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
   * Open checkout window for a filled group
   */
  private static async openCheckoutWindow(group: IGroupOrder, session?: mongoose.ClientSession): Promise<void> {
    const now = new Date();
    const checkoutDeadline = new Date(now.getTime() + group.checkoutWindowDurationHours * 60 * 60 * 1000);

    group.phase = 'checkout_window';
    group.groupFilledAt = now;
    group.checkoutWindowOpensAt = now;
    group.checkoutWindowClosesAt = checkoutDeadline;

    // Set checkout deadline for each participant
    group.participants.forEach(p => {
      if (p.status === 'reserved') {
        p.checkoutDeadline = checkoutDeadline;
      }
    });

    // Send email to all participants
    for (const participant of group.participants) {
      if (participant.status === 'reserved') {
        try {
          await emailService.sendGroupReadyEmail(participant.user.email, {
            groupId: group.groupId,
            productName: group.product.name,
            quantity: participant.quantity,
            amount: participant.amount,
            checkoutDeadline: checkoutDeadline.toISOString(),
            checkoutLink: group.getShareableLink()
          });
        } catch (emailError) {
          console.error(`Failed to send email to ${participant.user.email}:`, emailError);
        }
      }
    }

    console.log(`Checkout window opened for group ${group.groupId}. Deadline: ${checkoutDeadline}`);
  }

  /**
   * Checkout - User pays for their reserved slot
   */
  static async checkout(params: CheckoutParams): Promise<{ group: IGroupOrder; order: any }> {
    const { groupId, userId, deliveryInfo, paymentReference, deliveryFee } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const group = await GroupOrder.findOne({ groupId }).session(session);

      if (!group) {
        throw new GroupOrderError('Group not found', 404, 'GROUP_NOT_FOUND');
      }

      if (group.phase !== 'checkout_window') {
        throw new GroupOrderError('Checkout window is not open', 400, 'CHECKOUT_NOT_AVAILABLE');
      }

      // Find participant
      const participant = group.participants.find(p =>
        p.userId.equals(userId) && p.status === 'reserved'
      );

      if (!participant) {
        throw new GroupOrderError('You are not a participant in this group or already checked out', 400, 'NOT_A_PARTICIPANT');
      }

      // Update participant status
      participant.status = 'paid';
      participant.paidAt = new Date();
      participant.paymentReference = paymentReference;
      participant.deliveryInfo = deliveryInfo;
      participant.deliveryFee = deliveryFee;

      // Create individual order
      const order = await Order.create([{
        user: userId,
        items: [{
          product: group.product._id,
          productName: group.product.name,
          quantity: participant.quantity,
          priceType: 'retail' as 'retail' | 'bulk',
          unitPrice: group.bulkPricePerUnit,
          totalPrice: participant.amount
        }],
        subtotal: participant.amount,
        deliveryFee,
        totalAmount: participant.amount + deliveryFee,
        paymentMethod: 'paystack' as 'wallet' | 'pay_later' | 'paystack',
        paymentStatus: 'paid' as 'pending' | 'paid' | 'failed',
        orderStatus: 'ready_for_processing' as any,
        currentStageOwnerRole: 'processing' as any,
        paymentReference,
        paymentProvider: 'paystack' as 'paystack',
        deliveryInfo,
        groupOrder: {
          isGroupOrder: true,
          groupId: group.groupId,
          initiator: group.participants[0]?.userId || userId,
          participants: group.participants
            .filter(p => p.status !== 'removed')
            .map(p => ({
              user: p.userId,
              joinedAt: p.reservedAt,
              items: [{
                product: group.product._id,
                productName: group.product.name,
                quantity: p.quantity,
                priceType: 'retail' as 'retail' | 'bulk',
                unitPrice: group.bulkPricePerUnit,
                totalPrice: p.amount
              }],
              subtotal: p.amount
            }))
        }
      }], { session });

      if (!order[0]) {
        throw new Error('Failed to create order');
      }

      participant.orderId = order[0]._id as mongoose.Types.ObjectId;

      // Check if all participants have paid
      const allPaid = group.participants.every(p => p.status === 'paid' || p.status === 'removed');
      if (allPaid) {
        group.phase = 'confirmed';
        group.confirmedAt = new Date();
        console.log(`Group ${group.groupId} confirmed - all participants paid`);
      }

      await group.save({ session});
      await session.commitTransaction();

      // Decrease product stock
      const product = await Product.findById(group.product._id);
      if (product && typeof (product as any).updateStock === 'function') {
        await (product as any).updateStock(participant.quantity, 'decrease');
      }

      return { group, order: order[0] };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Join waitlist
   */
  static async joinWaitlist(params: JoinWaitlistParams): Promise<IGroupOrder> {
    const { groupId, userId, quantity } = params;

    const user = await User.findById(userId);
    if (!user) {
      throw new GroupOrderError('User not found', 404, 'USER_NOT_FOUND');
    }

    const group = await GroupOrder.findOne({ groupId });
    if (!group) {
      throw new GroupOrderError('Group not found', 404, 'GROUP_NOT_FOUND');
    }

    // Check if already in waitlist
    const alreadyInWaitlist = group.waitlist.some(w => w.userId.equals(userId));
    if (alreadyInWaitlist) {
      throw new GroupOrderError('You are already in the waitlist', 400, 'ALREADY_IN_WAITLIST');
    }

    // Add to waitlist
    group.waitlist.push({
      userId: userId as mongoose.Types.ObjectId,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || ''
      },
      quantity,
      joinedAt: new Date()
    });

    await group.save();

    return group;
  }

  /**
   * Remove non-payers and promote waitlist
   */
  static async removeNonPayersAndPromoteWaitlist(groupId: string): Promise<IGroupOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const group = await GroupOrder.findOne({ groupId }).session(session);
      if (!group) {
        throw new GroupOrderError('Group not found', 404, 'GROUP_NOT_FOUND');
      }

      // Remove participants who didn't pay
      const removedParticipants: IGroupParticipant[] = [];
      group.participants.forEach(p => {
        if (p.status === 'reserved' && group.isCheckoutWindowExpired()) {
          p.status = 'removed';
          p.removedAt = new Date();
          removedParticipants.push(p);
        }
      });

      // Promote waitlist members
      let promoted = 0;
      while (group.canAcceptMoreParticipants() && group.waitlist.length > 0 && promoted < removedParticipants.length) {
        const waitlistMember = group.waitlist.shift();
        if (!waitlistMember) break;

        // Calculate amount
        const amount = waitlistMember.quantity * group.bulkPricePerUnit;

        // Create participant
        const participantId = crypto.randomBytes(8).toString('hex');
        const checkoutDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const participant: IGroupParticipant = {
          id: participantId,
          userId: waitlistMember.userId,
          user: waitlistMember.user,
          quantity: waitlistMember.quantity,
          amount,
          status: 'reserved',
          reservedAt: new Date(),
          checkoutDeadline
        };

        group.participants.push(participant);
        promoted++;

        // Send notification email
        try {
          await emailService.sendWaitlistPromotionEmail(waitlistMember.user.email, {
            groupId: group.groupId,
            productName: group.product.name,
            quantity: waitlistMember.quantity,
            amount,
            checkoutDeadline: checkoutDeadline.toISOString(),
            checkoutLink: group.getShareableLink()
          });
        } catch (emailError) {
          console.error(`Failed to send promotion email to ${waitlistMember.user.email}:`, emailError);
        }
      }

      await group.save({ session });
      await session.commitTransaction();

      console.log(`Removed ${removedParticipants.length} non-payers from group ${groupId}, promoted ${promoted} waitlist members`);

      return group;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
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

      if (group.phase === 'confirmed' || group.phase === 'cancelled') {
        throw new GroupOrderError('Cannot cancel confirmed or already cancelled group', 400, 'INVALID_STATUS');
      }

      group.phase = 'cancelled';
      group.cancelledAt = new Date();
      group.cancelledReason = reason;

      // Process refunds for paid participants
      for (const participant of group.participants) {
        if (participant.status === 'paid') {
          const refundAmount = participant.amount + (participant.deliveryFee || 0);
          // TODO: Process refund via Paystack
          console.log(`Processing refund: ${participant.paymentReference} - ₦${refundAmount / 100}`);
        }
      }

      await group.save({ session });
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
   * Get groups in filling phase
   */
  static async getActiveGroupsForProduct(productId: mongoose.Types.ObjectId): Promise<IGroupOrder[]> {
    return await GroupOrder.find({
      'product._id': productId,
      phase: { $in: ['filling', 'checkout_window'] }
    }).sort({ createdAt: -1 });
  }

  /**
   * Get all active groups
   */
  static async getAllActiveGroups(): Promise<IGroupOrder[]> {
    return await GroupOrder.find({
      phase: { $in: ['filling', 'checkout_window'] }
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
   * Leave a group (only if still in reserved status)
   */
  static async leaveGroup(groupId: string, userId: mongoose.Types.ObjectId): Promise<IGroupOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const group = await GroupOrder.findOne({ groupId }).session(session);

      if (!group) {
        throw new GroupOrderError('Group not found', 404, 'GROUP_NOT_FOUND');
      }

      const participant = group.participants.find(p => p.userId.equals(userId) && p.status === 'reserved');
      if (!participant) {
        throw new GroupOrderError('You are not a reserved participant in this group', 400, 'NOT_A_PARTICIPANT');
      }

      // Remove participant
      participant.status = 'removed';
      participant.removedAt = new Date();

      await group.save({ session });
      await session.commitTransaction();

      return group;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
