// src/utils/permissions.ts

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  INVENTORY_OFFICER: 'inventory_officer',
  OPERATIONS_OFFICER: 'operations_officer',
  LOGISTICS: 'logistics',
  CUSTOMER_SUPPORT: 'customer_support',
  FINANCE: 'finance',
  ADMIN: 'admin', // General admin role
  RIDER: 'rider'
} as const;

export const PERMISSIONS = {
  // Inventory permissions
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_INVENTORY: 'manage_inventory',
  REQUEST_PAYMENT: 'request_payment',
  
  // Product/Category permissions
  VIEW_PRODUCTS: 'view_products',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_CATEGORIES: 'manage_categories',
  
  // Order permissions
  VIEW_ORDERS: 'view_orders',
  APPROVE_ORDERS: 'approve_orders',
  UPDATE_ORDER_STATUS: 'update_order_status',
  
  // Logistics permissions
  VIEW_LOGISTICS: 'view_logistics',
  CONFIRM_DELIVERY: 'confirm_delivery',
  
  // Customer Support permissions
  VIEW_CUSTOMER_FEEDBACK: 'view_customer_feedback',
  RESPOND_TO_FEEDBACK: 'respond_to_feedback',
  
  // Finance permissions
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',
  APPROVE_PAYMENTS: 'approve_payments',
  PROCESS_PAYMENTS: 'process_payments',
  VIEW_PAYMENT_DETAILS: 'view_payment_details',
  
  // Admin management (super admin only)
  MANAGE_ADMINS: 'manage_admins',

  // Order workflow permissions
  ORDERS_PROCESSING_START: 'orders.processing.start',
  ORDERS_PROCESSING_COMPLETE: 'orders.processing.complete',
  ORDERS_DISPATCH_ASSIGN: 'orders.dispatch.assign',
  ORDERS_DISPATCH_HANDOVER: 'orders.dispatch.handover',
  ORDERS_DISPATCH_FAIL: 'orders.dispatch.fail',
  ORDERS_DISPATCH_RETURN: 'orders.dispatch.return',
  ORDERS_DELIVERY_CONFIRM: 'orders.delivery.confirm',
  ORDERS_DELIVERY_CLOSE: 'orders.delivery.close',
  ORDERS_OVERRIDE_CANCEL: 'orders.override.cancel',
  ORDERS_OVERRIDE_CHANGE: 'orders.override.change',
  ORDERS_WORKFLOW_VIEW: 'orders.workflow.view',
  
  // Super admin has all permissions
  ALL: '*'
} as const;

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  READY_FOR_PROCESSING: 'ready_for_processing',
  PROCESSING: 'processing',
  READY_FOR_DISPATCH: 'ready_for_dispatch',
  AWAITING_PICKUP: 'awaiting_pickup',
  EN_ROUTE: 'en_route',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED_DELIVERY: 'failed_delivery'
} as const;

// Map each role to its permissions
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: [PERMISSIONS.ALL],
  
  [ROLES.INVENTORY_OFFICER]: [
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_CATEGORIES,
    PERMISSIONS.REQUEST_PAYMENT
  ],
  
  [ROLES.OPERATIONS_OFFICER]: [
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.APPROVE_ORDERS,
    PERMISSIONS.UPDATE_ORDER_STATUS,
    PERMISSIONS.ORDERS_PROCESSING_START,
    PERMISSIONS.ORDERS_PROCESSING_COMPLETE,
    PERMISSIONS.ORDERS_WORKFLOW_VIEW,
    PERMISSIONS.ORDERS_OVERRIDE_CANCEL
  ],
  
  [ROLES.LOGISTICS]: [
    PERMISSIONS.VIEW_LOGISTICS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.CONFIRM_DELIVERY,
    PERMISSIONS.ORDERS_DISPATCH_ASSIGN,
    PERMISSIONS.ORDERS_DISPATCH_HANDOVER,
    PERMISSIONS.ORDERS_DISPATCH_FAIL,
    PERMISSIONS.ORDERS_DISPATCH_RETURN,
    PERMISSIONS.ORDERS_WORKFLOW_VIEW,
    PERMISSIONS.ORDERS_OVERRIDE_CANCEL
  ],
  
  [ROLES.CUSTOMER_SUPPORT]: [
    PERMISSIONS.VIEW_ORDERS, // Read-only
    PERMISSIONS.VIEW_CUSTOMER_FEEDBACK,
    PERMISSIONS.RESPOND_TO_FEEDBACK,
    PERMISSIONS.ORDERS_DELIVERY_CLOSE,
    PERMISSIONS.ORDERS_WORKFLOW_VIEW,
    PERMISSIONS.ORDERS_OVERRIDE_CANCEL
  ],
  
  [ROLES.FINANCE]: [
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_PAYMENT_DETAILS,
    PERMISSIONS.APPROVE_PAYMENTS,
    PERMISSIONS.PROCESS_PAYMENTS
  ],
  
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_CATEGORIES,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.ORDERS_WORKFLOW_VIEW
  ],

  [ROLES.RIDER]: [
    PERMISSIONS.ORDERS_DELIVERY_CONFIRM,
    PERMISSIONS.ORDERS_WORKFLOW_VIEW
  ]
};

// Helper function to get permissions for a role
export const getPermissionsForRole = (adminRole: string): string[] => {
  return ROLE_PERMISSIONS[adminRole] || [];
};

// Helper function to check if a user has a specific permission
export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  // Super admin has all permissions
  if (userPermissions.includes(PERMISSIONS.ALL)) {
    return true;
  }
  
  return userPermissions.includes(requiredPermission);
};