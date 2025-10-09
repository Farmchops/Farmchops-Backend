// src/utils/permissions.ts

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  INVENTORY_OFFICER: 'inventory_officer',
  OPERATIONS_OFFICER: 'operations_officer',
  LOGISTICS: 'logistics',
  CUSTOMER_SUPPORT: 'customer_support',
  FINANCE: 'finance',
  ADMIN: 'admin' // General admin role
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
  
  // Super admin has all permissions
  ALL: '*'
} as const;

export const ORDER_STATUS = {
  PENDING: 'pending',                    // Order placed, awaiting payment
  PROCESSING: 'processing',              // Payment confirmed, picking/packing
  OUT_FOR_DELIVERY: 'out_for_delivery', // Dispatched to customer
  DELIVERED: 'delivered',                // Customer received order
  CANCELLED: 'cancelled'                 // Order cancelled
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
    PERMISSIONS.UPDATE_ORDER_STATUS
  ],
  
  [ROLES.LOGISTICS]: [
    PERMISSIONS.VIEW_LOGISTICS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.CONFIRM_DELIVERY
  ],
  
  [ROLES.CUSTOMER_SUPPORT]: [
    PERMISSIONS.VIEW_ORDERS, // Read-only
    PERMISSIONS.VIEW_CUSTOMER_FEEDBACK,
    PERMISSIONS.RESPOND_TO_FEEDBACK
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
    PERMISSIONS.VIEW_ORDERS
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