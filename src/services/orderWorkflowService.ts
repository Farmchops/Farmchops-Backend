import crypto from 'crypto';
import mongoose from 'mongoose';
import { Order, IOrder, OrderStatus, OrderStageOwner } from '../models/Order';
import { IUser } from '../models/User';
import User from '../models/User';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

export type WorkflowAction =
  | 'mark-processing'
  | 'mark-ready-for-dispatch'
  | 'assign-rider'
  | 'confirm-pickup'
  | 'confirm-delivery'
  | 'close-order'
  | 'fail-delivery'
  | 'return-to-dispatch'
  | 'cancel-order';

const WORKFLOW_ACTIONS: WorkflowAction[] = [
  'mark-processing',
  'mark-ready-for-dispatch',
  'assign-rider',
  'confirm-pickup',
  'confirm-delivery',
  'fail-delivery',
  'return-to-dispatch',
  'close-order',
  'cancel-order'
];

interface ActionDefinition {
  from: OrderStatus[];
  to: OrderStatus;
  requiredPermission: string;
  nextOwner: OrderStageOwner;
  guard?: (order: IOrder) => boolean;
}

interface PerformActionOptions {
  orderId: string;
  action: WorkflowAction;
  user: IUser;
  payload?: Record<string, any>;
}

interface PerformActionResult {
  order: IOrder;
  previousStatus: OrderStatus;
  action: WorkflowAction;
  note?: string;
}

const WORKFLOW_STATUSES: OrderStatus[] = [
  'pending_payment',
  'ready_for_processing',
  'processing',
  'ready_for_dispatch',
  'awaiting_pickup',
  'en_route',
  'delivered',
  'completed',
  'cancelled',
  'failed_delivery'
];

const NEXT_STAGE_OWNER: Record<OrderStatus, OrderStageOwner> = {
  pending_payment: 'system',
  ready_for_processing: 'processing',
  processing: 'processing',
  ready_for_dispatch: 'logistics',
  awaiting_pickup: 'logistics',
  en_route: 'rider',
  delivered: 'support',
  completed: 'system',
  cancelled: 'support',
  failed_delivery: 'logistics'
};

const ACTION_DEFINITIONS: Record<WorkflowAction, ActionDefinition> = {
  'mark-processing': {
    from: ['ready_for_processing'],
    to: 'processing',
    requiredPermission: PERMISSIONS.ORDERS_PROCESSING_START,
    nextOwner: NEXT_STAGE_OWNER.processing,
    guard: (order) => order.paymentStatus === 'paid'
  },
  'mark-ready-for-dispatch': {
    from: ['processing'],
    to: 'ready_for_dispatch',
    requiredPermission: PERMISSIONS.ORDERS_PROCESSING_COMPLETE,
    nextOwner: NEXT_STAGE_OWNER.ready_for_dispatch,
    guard: (order) => order.paymentStatus === 'paid'
  },
  'assign-rider': {
    from: ['ready_for_dispatch', 'failed_delivery'],
    to: 'awaiting_pickup',
    requiredPermission: PERMISSIONS.ORDERS_DISPATCH_ASSIGN,
    nextOwner: NEXT_STAGE_OWNER.awaiting_pickup,
    guard: (order) => order.handoverCodeActive !== false && order.paymentStatus === 'paid'
  },
  'confirm-pickup': {
    from: ['awaiting_pickup'],
    to: 'en_route',
    requiredPermission: PERMISSIONS.ORDERS_DISPATCH_HANDOVER,
    nextOwner: NEXT_STAGE_OWNER.en_route,
    guard: (order) => Boolean(order.assignedRider?.rider) && order.paymentStatus === 'paid'
  },
  'confirm-delivery': {
    from: ['en_route'],
    to: 'delivered',
    requiredPermission: PERMISSIONS.ORDERS_DELIVERY_CONFIRM,
    nextOwner: NEXT_STAGE_OWNER.delivered,
    guard: (order) => Boolean(order.assignedRider?.rider && order.handoverCodeActive)
  },
  'close-order': {
    from: ['delivered'],
    to: 'completed',
    requiredPermission: PERMISSIONS.ORDERS_DELIVERY_CLOSE,
    nextOwner: NEXT_STAGE_OWNER.completed
  },
  'fail-delivery': {
    from: ['en_route'],
    to: 'failed_delivery',
    requiredPermission: PERMISSIONS.ORDERS_DISPATCH_FAIL,
    nextOwner: NEXT_STAGE_OWNER.failed_delivery,
    guard: (order) => Boolean(order.assignedRider?.rider)
  },
  'return-to-dispatch': {
    from: ['failed_delivery'],
    to: 'ready_for_dispatch',
    requiredPermission: PERMISSIONS.ORDERS_DISPATCH_RETURN,
    nextOwner: NEXT_STAGE_OWNER.ready_for_dispatch
  },
  'cancel-order': {
    from: ['pending_payment', 'ready_for_processing', 'processing', 'ready_for_dispatch', 'awaiting_pickup'],
    to: 'cancelled',
    requiredPermission: PERMISSIONS.ORDERS_OVERRIDE_CANCEL,
    nextOwner: NEXT_STAGE_OWNER.cancelled
  }
};

export class OrderWorkflowError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OrderWorkflowError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const hashHandoverCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

const ensureObjectId = (value: string, field: string) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new OrderWorkflowError(`${field} is required`, 400, 'INVALID_PAYLOAD');
  }
};

const getActorName = (user: IUser) => {
  const first = user.firstName || '';
  const last = user.lastName || '';
  return `${first} ${last}`.trim() || user.email;
};

const sanitizeOrderForResponse = (order: IOrder) => {
  order.set('handoverCodeHash', undefined, { strict: false });
  order.set('handoverCodeAttempts', undefined, { strict: false });
  return order;
};

const extractUserRef = (value: unknown): { id?: mongoose.Types.ObjectId; user?: IUser } => {
  if (!value) {
    return {};
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return { id: value };
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const doc = value as { _id?: mongoose.Types.ObjectId } & IUser;
    return { id: doc._id as mongoose.Types.ObjectId | undefined, user: doc };
  }

  return {};
};

export const performAction = async ({ orderId, action, payload = {}, user }: PerformActionOptions): Promise<PerformActionResult> => {
  const definition = ACTION_DEFINITIONS[action];
  if (!definition) {
    throw new OrderWorkflowError('Unsupported action', 400, 'UNSUPPORTED_ACTION');
  }

  const order = await Order.findById(orderId)
    .select('+handoverCodeHash +handoverCodeAttempts')
    .populate('assignedRider.rider', 'firstName lastName phone adminRole isActive');

  if (!order) {
    throw new OrderWorkflowError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const userPermissions = user.permissions || [];
  if (!hasPermission(userPermissions, definition.requiredPermission)) {
    throw new OrderWorkflowError('Permission denied', 403, 'FORBIDDEN');
  }

  if (!definition.from.includes(order.orderStatus)) {
    throw new OrderWorkflowError('Invalid transition', 409, 'INVALID_TRANSITION', {
      currentStatus: order.orderStatus,
      expected: definition.from
    });
  }

  if (definition.guard && !definition.guard(order)) {
    throw new OrderWorkflowError('Transition blocked by current order state', 409, 'TRANSITION_BLOCKED');
  }

  const previousStatus = order.orderStatus;
  const actorId = user._id as mongoose.Types.ObjectId;
  let note: string | undefined;
  let metadata: Record<string, unknown> | undefined;

  switch (action) {
    case 'assign-rider': {
      ensureObjectId(payload.riderId, 'riderId');
      const rider = await User.findById(payload.riderId);
      if (!rider) {
        throw new OrderWorkflowError('Rider not found', 404, 'RIDER_NOT_FOUND');
      }
      if (rider.role !== 'admin' || rider.adminRole !== 'rider') {
        throw new OrderWorkflowError('Selected user is not a rider', 400, 'INVALID_RIDER');
      }
      if (rider.isActive === false) {
        throw new OrderWorkflowError('Rider account is inactive', 400, 'INACTIVE_RIDER');
      }

      const riderId = rider._id as mongoose.Types.ObjectId;
      const assignedAt = new Date();
      order.assignedRider = {
        rider: riderId,
        assignedBy: actorId,
        assignedAt,
        note: payload.note
      };

      order.handoverCodeActive = true;

      metadata = {
        riderId,
        riderName: getActorName(rider),
        assignedBy: actorId,
        assignedByName: getActorName(user),
        assignedAt
      };
      note = payload.note || `Rider ${getActorName(rider)} assigned`;
      break;
    }
    case 'confirm-pickup': {
      if (!order.assignedRider?.rider) {
        throw new OrderWorkflowError('Order has no assigned rider', 400, 'NO_ASSIGNED_RIDER');
      }
      const { id: pickupRiderId } = extractUserRef(order.assignedRider.rider as unknown);
      metadata = {
        riderId: pickupRiderId || order.assignedRider.rider,
        pickupAt: new Date(),
        attachments: payload.proof || null
      };
      note = payload.note || 'Order handed to rider';
      break;
    }
    case 'confirm-delivery': {
      if (!payload.handoverCode || typeof payload.handoverCode !== 'string') {
        throw new OrderWorkflowError('handoverCode is required', 400, 'INVALID_PAYLOAD');
      }
      const codeHash = order.handoverCodeHash;
      if (!codeHash) {
        throw new OrderWorkflowError('Handover code not configured', 409, 'MISSING_HANDOVER');
      }

  const { id: assignedRiderId, user: assignedRiderDoc } = extractUserRef(order.assignedRider?.rider as unknown);
  const isAssignedRider = assignedRiderId ? assignedRiderId.equals(actorId) : false;
      const canOverride = hasPermission(userPermissions, PERMISSIONS.ORDERS_OVERRIDE_CHANGE);
      if (!isAssignedRider && !canOverride) {
        throw new OrderWorkflowError('Only the assigned rider can confirm delivery', 403, 'FORBIDDEN');
      }

      const hashed = hashHandoverCode(payload.handoverCode.trim());
      if (hashed !== codeHash) {
        await Order.updateOne({ _id: order._id }, { $inc: { handoverCodeAttempts: 1 } });
        throw new OrderWorkflowError('Invalid handover code', 403, 'INVALID_HANDOVER_CODE');
      }

      order.handoverCodeAttempts = 0;
      order.handoverCodeActive = false;
      order.handoverVerifiedAt = new Date();

      metadata = {
        riderId: assignedRiderId || null,
        riderName: assignedRiderDoc ? getActorName(assignedRiderDoc) : undefined,
        proof: payload.proof || null,
        location: payload.location || null,
        submittedBy: actorId,
        submittedByName: getActorName(user)
      };
      note = payload.note || 'Delivery confirmed via rider handover code';
      break;
    }
    case 'close-order': {
      note = payload.note || 'Order closed';
      metadata = { closedBy: actorId, closedByName: getActorName(user) };
      break;
    }
    case 'fail-delivery': {
      const { id: failedRiderId } = extractUserRef(order.assignedRider?.rider as unknown);
      metadata = {
        riderId: failedRiderId || order.assignedRider?.rider || null,
        reason: payload.reason || null,
        attemptedAt: new Date(),
        reportedBy: actorId,
        reportedByName: getActorName(user)
      };
      note = payload.note || 'Delivery attempt failed';
      order.handoverCodeActive = true;
      break;
    }
    case 'cancel-order': {
      metadata = {
        cancelledBy: actorId,
        cancelledByName: getActorName(user),
        reason: payload.reason || payload.note || null
      };
      note = payload.note || 'Order cancelled';
      order.handoverCodeActive = false;
      order.assignedRider = undefined;
      break;
    }
    case 'mark-processing': {
      note = payload.note || 'Processing started';
      metadata = payload.metadata || undefined;
      break;
    }
    case 'mark-ready-for-dispatch': {
      order.assignedRider = undefined;
      note = payload.note || 'Order ready for rider assignment';
      metadata = payload.metadata || undefined;
      break;
    }
    case 'return-to-dispatch': {
      metadata = {
        reroutedBy: actorId,
        reroutedByName: getActorName(user),
        reason: payload.reason || null
      };
      note = payload.note || 'Order returned to dispatch queue';
      order.assignedRider = undefined;
      order.handoverCodeActive = true;
      break;
    }
    default:
      note = payload.note;
      metadata = payload.metadata || undefined;
  }

  order.orderStatus = definition.to;
  order.currentStageOwnerRole = definition.nextOwner;
  order.addStatusHistory({
    status: definition.to,
    note,
    updatedBy: actorId,
    updatedByName: getActorName(user),
    role: user.adminRole || user.role,
    metadata
  });

  await order.save();

  await order.populate({ path: 'assignedRider.rider', select: 'firstName lastName phone adminRole isActive' });

  return {
    order: sanitizeOrderForResponse(order),
    previousStatus,
    action,
    note
  };
};

export const getWorkflowConfig = () => {
  const statuses = WORKFLOW_STATUSES;
  const actions = Object.entries(ACTION_DEFINITIONS).map(([action, definition]) => ({
    action: action as WorkflowAction,
    from: definition.from,
    to: definition.to,
    requiredPermission: definition.requiredPermission,
    nextOwner: definition.nextOwner
  }));

  return {
    statuses,
    actions
  };
};

export const getAvailableActions = (order: IOrder, user: IUser): WorkflowAction[] => {
  const userPermissions = user.permissions || [];
  return WORKFLOW_ACTIONS.filter(action => {
    const definition = ACTION_DEFINITIONS[action];
    if (!definition.from.includes(order.orderStatus)) {
      return false;
    }
    if (!hasPermission(userPermissions, definition.requiredPermission)) {
      return false;
    }
    if (definition.guard && !definition.guard(order)) {
      return false;
    }
    return true;
  });
};
