# Admin Dashboard API Documentation

Complete API reference for frontend developers building the Farmchops admin dashboard.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard Overview Endpoints](#dashboard-overview-endpoints)
   - [Total Orders Statistics](#1-total-orders-statistics)
   - [Conversion Rate](#2-conversion-rate)
   - [Dashboard Summary](#3-dashboard-summary)
   - [Order Trend](#4-order-trend)
   - [Users Trend](#5-users-trend)
   - [Recent Orders](#6-recent-orders)
3. [Orders Management Endpoints](#orders-management-endpoints)
   - [List All Orders](#7-list-all-orders)
   - [Get Single Order](#8-get-single-order)
   - [Order Actions](#9-order-actions)
   - [List Riders](#10-list-riders)
   - [Order Workflow Config](#11-order-workflow-configuration)
4. [TypeScript Interfaces](#typescript-interfaces)
5. [Frontend Integration Examples](#frontend-integration-examples)
6. [Error Handling](#error-handling)

---

## Authentication

**Base URL:** `/api/admin`

**Required Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** Admin (any admin role: `super_admin`, `operations_officer`, `logistics`, `customer_support`, `rider`)

---

## Dashboard Overview Endpoints

### 1. Total Orders Statistics

Get total orders count with breakdown by status for the **Order Status pie chart** and **Total Orders** card.

```
GET /api/admin/dashboard/total-orders
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | string | No | - | Filter start date (ISO format: `YYYY-MM-DD`) |
| endDate | string | No | - | Filter end date (ISO format: `YYYY-MM-DD`) |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalOrders": 294,
    "byPaymentStatus": {
      "paid": 185,
      "pending": 89,
      "failed": 20
    },
    "byOrderStatus": {
      "delivered": {
        "count": 143,
        "percentage": 48.6,
        "revenue": 830030
      },
      "pending": {
        "count": 106,
        "percentage": 36.1,
        "revenue": 620050
      },
      "cancelled": {
        "count": 45,
        "percentage": 15.3,
        "revenue": 180020
      }
    }
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `totalOrders` | number | Total count of all orders |
| `byPaymentStatus.paid` | number | Orders with payment completed |
| `byPaymentStatus.pending` | number | Orders awaiting payment |
| `byPaymentStatus.failed` | number | Orders with failed payment |
| `byOrderStatus.delivered.count` | number | Orders delivered or completed |
| `byOrderStatus.delivered.percentage` | number | Percentage of delivered orders |
| `byOrderStatus.delivered.revenue` | number | Total revenue from delivered orders |
| `byOrderStatus.pending.count` | number | Orders in progress (not delivered/cancelled) |
| `byOrderStatus.pending.percentage` | number | Percentage of pending orders |
| `byOrderStatus.pending.revenue` | number | Total revenue from pending orders |
| `byOrderStatus.cancelled.count` | number | Cancelled orders |
| `byOrderStatus.cancelled.percentage` | number | Percentage of cancelled orders |
| `byOrderStatus.cancelled.revenue` | number | Total revenue from cancelled orders |

**Dashboard Mapping:**
- `totalOrders` → **Total Orders** card
- `byOrderStatus.delivered` → **Delivered** (green) in pie chart
- `byOrderStatus.pending` → **Pending** (orange) in pie chart
- `byOrderStatus.cancelled` → **Cancelled** (red) in pie chart

---

### 2. Conversion Rate

Get user-to-customer conversion rate for the **Conversion Rate** and **Total Users** cards.

```
GET /api/admin/dashboard/conversion-rate
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | string | No | - | Filter start date (ISO format) |
| endDate | string | No | - | Filter end date (ISO format) |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalUsers": 294,
    "purchasingUsers": 185,
    "conversionRate": 62.93,
    "conversionRatio": "185:294"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `totalUsers` | number | Total registered users |
| `purchasingUsers` | number | Users who made at least one paid purchase |
| `conversionRate` | number | Percentage of users who purchased (0-100) |
| `conversionRatio` | string | Ratio format "purchasingUsers:totalUsers" |

**Dashboard Mapping:**
- `conversionRate` → **Conversion Rate** card (display as `63%`)
- `totalUsers` → **Total Users** card

---

### 3. Dashboard Summary

Get combined summary metrics (alternative endpoint for overview cards).

```
GET /api/admin/dashboard/summary
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | string | No | - | Filter start date (ISO format) |
| endDate | string | No | - | Filter end date (ISO format) |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 2500000,
    "totalOrders": 294,
    "conversionRate": 62.93
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `totalRevenue` | number | Total revenue from paid orders (in kobo/naira) |
| `totalOrders` | number | Total count of all orders |
| `conversionRate` | number | Paid orders / Total orders percentage |

---

### 4. Order Trend

Get monthly order counts for the **Order Trend overtime** bar chart.

```
GET /api/admin/dashboard/order-trend
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | string | No | 11 months ago | Filter start date |
| endDate | string | No | End of current month | Filter end date |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    { "month": "2025-01", "orderCount": 120 },
    { "month": "2025-02", "orderCount": 245 },
    { "month": "2025-03", "orderCount": 380 },
    { "month": "2025-04", "orderCount": 290 },
    { "month": "2025-05", "orderCount": 156 },
    { "month": "2025-06", "orderCount": 420 },
    { "month": "2025-07", "orderCount": 189 },
    { "month": "2025-08", "orderCount": 267 },
    { "month": "2025-09", "orderCount": 534 },
    { "month": "2025-10", "orderCount": 312 },
    { "month": "2025-11", "orderCount": 278 },
    { "month": "2025-12", "orderCount": 145 }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `data` | array | Array of monthly data points |
| `data[].month` | string | Month in `YYYY-MM` format |
| `data[].orderCount` | number | Number of orders in that month |

**Dashboard Mapping:**
- `month` → X-axis labels (convert to "Jan", "Feb", etc.)
- `orderCount` → Bar heights

---

### 5. Users Trend

Get monthly user registration counts for the **Users** line chart.

```
GET /api/admin/dashboard/users-trend
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | string | No | 11 months ago | Filter start date |
| endDate | string | No | End of current month | Filter end date |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    { "month": "2025-01", "userCount": 45 },
    { "month": "2025-02", "userCount": 67 },
    { "month": "2025-03", "userCount": 89 },
    { "month": "2025-04", "userCount": 112 },
    { "month": "2025-05", "userCount": 134 },
    { "month": "2025-06", "userCount": 178 },
    { "month": "2025-07", "userCount": 201 },
    { "month": "2025-08", "userCount": 223 },
    { "month": "2025-09", "userCount": 256 },
    { "month": "2025-10", "userCount": 278 },
    { "month": "2025-11", "userCount": 294 },
    { "month": "2025-12", "userCount": 310 }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `data` | array | Array of monthly data points |
| `data[].month` | string | Month in `YYYY-MM` format |
| `data[].userCount` | number | Number of new users registered in that month |

**Dashboard Mapping:**
- `month` → X-axis labels
- `userCount` → Line chart data points

---

### 6. Recent Orders

Get recent orders for the **Recent Orders** table.

```
GET /api/admin/dashboard/recent-orders
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | number | No | 10 | Number of orders to return |
| startDate | string | No | - | Filter start date (ISO format) |
| endDate | string | No | - | Filter end date (ISO format) |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "orderId": "6745abc123def456",
      "orderNumber": "#7FA4C2",
      "customerName": "Ezekiel Dominic",
      "customerEmail": "ezekiel@example.com",
      "amount": 1400,
      "date": "2025-11-22T10:30:00.000Z",
      "orderStatus": "delivered",
      "paymentStatus": "paid",
      "userId": "user123abc"
    },
    {
      "orderId": "6745abc123def457",
      "orderNumber": "#7FA4C3",
      "customerName": "Ada Johnson",
      "customerEmail": "ada@example.com",
      "amount": 2800,
      "date": "2025-11-21T14:20:00.000Z",
      "orderStatus": "processing",
      "paymentStatus": "paid",
      "userId": "user456def"
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `orderId` | string | MongoDB ObjectId of the order |
| `orderNumber` | string | Human-readable order number (e.g., "#7FA4C2") |
| `customerName` | string | Customer's full name (firstName + lastName) |
| `customerEmail` | string \| null | Customer's email address |
| `amount` | number | Total order amount |
| `date` | string | Order creation date (ISO format) |
| `orderStatus` | string | Current order status (see [Order Statuses](#order-statuses)) |
| `paymentStatus` | string | Payment status: `pending`, `paid`, `failed` |
| `userId` | string | MongoDB ObjectId of the customer |

**Dashboard Mapping:**
- `customerName` + `orderNumber` → **Order Name & ID** column
- `amount` → **Amount** column (format as `₦1,400`)

---

## Orders Management Endpoints

### 7. List All Orders

Get paginated list of orders with filters.

```
GET /api/admin/orders
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| search | string | No | - | Search by order number, customer name, or email |
| status | string | No | all | Filter by order status (see [Order Statuses](#order-statuses)) |
| page | number | No | 1 | Page number for pagination |
| limit | number | No | 20 | Results per page |
| sort | string | No | `-createdAt` | Sort field (prefix with `-` for descending) |
| date | string | No | - | Filter by specific date (`YYYY-MM-DD`) |
| ownerRole | string | No | - | Filter by order stage owner role |
| includeAssigned | string | No | `false` | Include orders assigned to current user |
| assignedTo | string | No | - | Filter by assigned rider ID |

**Request Body:** None

#### Order Statuses

| Status | Description |
|--------|-------------|
| `pending_payment` | Awaiting payment confirmation |
| `ready_for_processing` | Payment confirmed, ready to process |
| `processing` | Order is being prepared |
| `ready_for_dispatch` | Ready to be assigned to rider |
| `awaiting_pickup` | Assigned to rider, waiting for pickup |
| `en_route` | Rider is delivering |
| `delivered` | Successfully delivered to customer |
| `completed` | Order fully completed |
| `cancelled` | Order was cancelled |
| `failed_delivery` | Delivery attempt failed |

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "6745abc123def456",
        "orderNumber": "#7FA4C2",
        "user": {
          "_id": "user123",
          "firstName": "Ezekiel",
          "lastName": "Dominic",
          "email": "ezekiel@example.com"
        },
        "items": [
          {
            "product": {
              "_id": "prod123",
              "name": "Fresh Tomatoes",
              "images": ["https://cdn.farmchops.com/tomatoes.jpg"]
            },
            "productName": "Fresh Tomatoes",
            "quantity": 5,
            "priceType": "retail",
            "unitPrice": 200,
            "totalPrice": 1000
          }
        ],
        "subtotal": 1000,
        "deliveryFee": 400,
        "totalAmount": 1400,
        "paymentMethod": "wallet",
        "paymentStatus": "paid",
        "orderStatus": "delivered",
        "currentStageOwnerRole": "system",
        "deliveryInfo": {
          "address": "123 Main Street",
          "city": "Lagos",
          "state": "Lagos",
          "phoneNumber": "+2348012345678"
        },
        "createdAt": "2025-11-22T10:30:00.000Z",
        "updatedAt": "2025-11-22T15:45:00.000Z",
        "assignedRider": {
          "rider": {
            "_id": "rider123",
            "firstName": "John",
            "lastName": "Rider",
            "phone": "+2348098765432",
            "adminRole": "rider"
          },
          "assignedAt": "2025-11-22T11:00:00.000Z"
        }
      }
    ],
    "total": 294,
    "page": 1,
    "pageSize": 20
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `orders` | array | Array of order objects |
| `orders[]._id` | string | Order MongoDB ObjectId |
| `orders[].orderNumber` | string | Human-readable order number |
| `orders[].user` | object | Customer details (populated) |
| `orders[].items` | array | Array of order items |
| `orders[].items[].product` | object | Product details (populated) |
| `orders[].items[].productName` | string | Product name snapshot |
| `orders[].items[].quantity` | number | Quantity ordered |
| `orders[].items[].priceType` | string | `retail` or `bulk` |
| `orders[].items[].unitPrice` | number | Price per unit |
| `orders[].items[].totalPrice` | number | quantity × unitPrice |
| `orders[].subtotal` | number | Sum of item totals |
| `orders[].deliveryFee` | number | Delivery fee |
| `orders[].totalAmount` | number | subtotal + deliveryFee |
| `orders[].paymentMethod` | string | `wallet`, `pay_later`, or `paystack` |
| `orders[].paymentStatus` | string | `pending`, `paid`, or `failed` |
| `orders[].orderStatus` | string | Current status (see [Order Statuses](#order-statuses)) |
| `orders[].deliveryInfo` | object | Delivery address details |
| `orders[].assignedRider` | object \| null | Assigned rider details |
| `total` | number | Total count of matching orders |
| `page` | number | Current page number |
| `pageSize` | number | Results per page |

---

### 8. Get Single Order

Get detailed order information by ID.

```
GET /api/admin/orders/:id
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Order MongoDB ObjectId |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "6745abc123def456",
      "orderNumber": "#7FA4C2",
      "user": {
        "_id": "user123",
        "firstName": "Ezekiel",
        "lastName": "Dominic",
        "email": "ezekiel@example.com",
        "phone": "+2348012345678"
      },
      "items": [
        {
          "product": {
            "_id": "prod123",
            "name": "Fresh Tomatoes",
            "images": ["https://cdn.farmchops.com/tomatoes.jpg"]
          },
          "productName": "Fresh Tomatoes",
          "quantity": 5,
          "priceType": "retail",
          "unitPrice": 200,
          "totalPrice": 1000
        }
      ],
      "subtotal": 1000,
      "deliveryFee": 400,
      "totalAmount": 1400,
      "paymentMethod": "wallet",
      "paymentStatus": "paid",
      "orderStatus": "ready_for_dispatch",
      "currentStageOwnerRole": "logistics",
      "deliveryInfo": {
        "address": "123 Main Street",
        "city": "Lagos",
        "state": "Lagos",
        "phoneNumber": "+2348012345678",
        "deliveryNote": "Please call on arrival"
      },
      "statusHistory": [
        {
          "status": "pending_payment",
          "timestamp": "2025-11-22T10:00:00.000Z",
          "note": "Order created",
          "updatedBy": null
        },
        {
          "status": "ready_for_processing",
          "timestamp": "2025-11-22T10:05:00.000Z",
          "note": "Payment confirmed via wallet",
          "updatedBy": null
        },
        {
          "status": "processing",
          "timestamp": "2025-11-22T10:30:00.000Z",
          "updatedBy": {
            "_id": "admin123",
            "firstName": "Admin",
            "lastName": "User",
            "email": "admin@farmchops.com",
            "adminRole": "operations_officer"
          }
        },
        {
          "status": "ready_for_dispatch",
          "timestamp": "2025-11-22T11:00:00.000Z",
          "updatedBy": {
            "_id": "admin123",
            "firstName": "Admin",
            "lastName": "User",
            "email": "admin@farmchops.com",
            "adminRole": "operations_officer"
          }
        }
      ],
      "assignedRider": null,
      "createdAt": "2025-11-22T10:00:00.000Z",
      "updatedAt": "2025-11-22T11:00:00.000Z"
    },
    "availableActions": ["assign-rider", "cancel-order"]
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `order` | object | Complete order object |
| `order.statusHistory` | array | History of status changes |
| `order.statusHistory[].status` | string | Status at that point |
| `order.statusHistory[].timestamp` | string | When status changed |
| `order.statusHistory[].note` | string | Optional note |
| `order.statusHistory[].updatedBy` | object | Admin who made the change |
| `availableActions` | array | Actions the current user can perform |

**Available Actions:**
| Action | Description |
|--------|-------------|
| `mark-processing` | Start processing the order |
| `mark-ready-for-dispatch` | Mark as ready for dispatch |
| `assign-rider` | Assign a rider |
| `confirm-pickup` | Confirm rider picked up |
| `fail-delivery` | Mark delivery as failed |
| `return-to-dispatch` | Return to dispatch stage |
| `cancel-order` | Cancel the order |
| `close-order` | Close/complete the order |

---

### 9. Order Actions

Perform workflow actions on orders. All action endpoints follow the same pattern.

#### 9.1 Mark as Processing

Start processing an order.

```
PATCH /api/admin/orders/:id/actions/mark-processing
```

**Request Body:** None (or optional metadata)

```json
{}
```

**Required Permission:** `ORDERS_PROCESSING_START`

---

#### 9.2 Mark Ready for Dispatch

Mark order as ready for dispatch after processing.

```
PATCH /api/admin/orders/:id/actions/mark-ready-for-dispatch
```

**Request Body:** None

```json
{}
```

**Required Permission:** `ORDERS_PROCESSING_COMPLETE`

---

#### 9.3 Assign Rider

Assign one or more riders to deliver the order.

```
PATCH /api/admin/orders/:id/actions/assign-rider
```

**Request Body:**

```json
{
  "riderIds": ["rider123objectid"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `riderIds` | array | Yes | Array of rider user IDs |

**Required Permission:** `ORDERS_DISPATCH_ASSIGN`

---

#### 9.4 Confirm Pickup

Confirm rider has picked up the order.

```
PATCH /api/admin/orders/:id/actions/confirm-pickup
```

**Request Body:** None

```json
{}
```

**Required Permission:** `ORDERS_DISPATCH_HANDOVER`

---

#### 9.5 Fail Delivery

Mark delivery attempt as failed.

```
PATCH /api/admin/orders/:id/actions/fail-delivery
```

**Request Body:**

```json
{
  "reason": "Customer not available"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Reason for failed delivery |

**Required Permission:** `ORDERS_DISPATCH_FAIL`

---

#### 9.6 Return to Dispatch

Return order to dispatch stage.

```
PATCH /api/admin/orders/:id/actions/return-to-dispatch
```

**Request Body:**

```json
{
  "reason": "Wrong address provided"
}
```

**Required Permission:** `ORDERS_DISPATCH_RETURN`

---

#### 9.7 Cancel Order

Cancel the order.

```
PATCH /api/admin/orders/:id/actions/cancel
```

**Request Body:**

```json
{
  "reason": "Customer requested cancellation"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Reason for cancellation |

**Required Permission:** `ORDERS_OVERRIDE_CANCEL`

---

#### 9.8 Close Order

Close/complete the order after delivery.

```
PATCH /api/admin/orders/:id/actions/close
```

**Request Body:** None

```json
{}
```

**Required Permission:** `ORDERS_DELIVERY_CLOSE`

---

#### Action Response (All Actions)

**Success (200 OK):**
```json
{
  "success": true,
  "message": "Order updated successfully",
  "data": {
    "order": {
      "_id": "6745abc123def456",
      "orderNumber": "#7FA4C2",
      "orderStatus": "awaiting_pickup",
      "... (full order object)"
    },
    "transition": {
      "from": "ready_for_dispatch",
      "to": "awaiting_pickup",
      "action": "assign-rider"
    },
    "availableActions": ["confirm-pickup", "fail-delivery", "cancel-order"]
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `order` | object | Updated order object |
| `transition.from` | string | Previous status |
| `transition.to` | string | New status |
| `transition.action` | string | Action that was performed |
| `availableActions` | array | Next available actions |

**Error Response (Workflow Error):**
```json
{
  "success": false,
  "message": "Cannot perform this action on the current order status",
  "code": "INVALID_TRANSITION",
  "details": {
    "currentStatus": "pending_payment",
    "requestedAction": "assign-rider"
  }
}
```

---

### 10. List Riders

Get available riders for order assignment.

```
GET /api/admin/riders
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| search | string | No | - | Search by name, email, or phone |
| status | string | No | `active` | Filter: `active`, `inactive`, or `all` |

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "rider123",
      "firstName": "John",
      "lastName": "Rider",
      "email": "john@example.com",
      "phone": "+2348012345678",
      "isActive": true,
      "adminRole": "rider",
      "permissions": ["ORDERS_DISPATCH_HANDOVER", "ORDERS_DISPATCH_FAIL"],
      "isOnDelivery": true,
      "activeDeliveries": 2
    },
    {
      "_id": "rider456",
      "firstName": "Jane",
      "lastName": "Driver",
      "email": "jane@example.com",
      "phone": "+2348087654321",
      "isActive": true,
      "adminRole": "rider",
      "permissions": ["ORDERS_DISPATCH_HANDOVER", "ORDERS_DISPATCH_FAIL"],
      "isOnDelivery": false,
      "activeDeliveries": 0
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Rider user ID |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `email` | string | Email address |
| `phone` | string | Phone number |
| `isActive` | boolean | Whether rider account is active |
| `adminRole` | string | Always `rider` |
| `permissions` | array | Rider's permissions |
| `isOnDelivery` | boolean | Whether rider is currently delivering |
| `activeDeliveries` | number | Number of active deliveries |

---

### 11. Order Workflow Configuration

Get order workflow configuration (statuses, transitions, etc.).

```
GET /api/admin/orders/workflow/config
```

#### Request

**Method:** `GET`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:** None

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "statuses": [
      "pending_payment",
      "ready_for_processing",
      "processing",
      "ready_for_dispatch",
      "awaiting_pickup",
      "en_route",
      "delivered",
      "completed",
      "cancelled",
      "failed_delivery"
    ],
    "transitions": {
      "ready_for_processing": {
        "mark-processing": "processing"
      },
      "processing": {
        "mark-ready-for-dispatch": "ready_for_dispatch"
      },
      "ready_for_dispatch": {
        "assign-rider": "awaiting_pickup"
      }
    }
  }
}
```

---

## TypeScript Interfaces

```typescript
// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  details?: Record<string, any>;
}

// Dashboard Types
interface TotalOrdersResponse {
  totalOrders: number;
  byPaymentStatus: {
    paid: number;
    pending: number;
    failed: number;
  };
  byOrderStatus: {
    delivered: OrderStatusBreakdown;
    pending: OrderStatusBreakdown;
    cancelled: OrderStatusBreakdown;
  };
}

interface OrderStatusBreakdown {
  count: number;
  percentage: number;
  revenue: number;
}

interface ConversionRateResponse {
  totalUsers: number;
  purchasingUsers: number;
  conversionRate: number;
  conversionRatio: string;
}

interface DashboardSummaryResponse {
  totalRevenue: number;
  totalOrders: number;
  conversionRate: number;
}

interface OrderTrendItem {
  month: string; // "YYYY-MM"
  orderCount: number;
}

interface UsersTrendItem {
  month: string; // "YYYY-MM"
  userCount: number;
}

interface RecentOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  amount: number;
  date: string; // ISO date
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  userId: string;
}

// Order Types
type OrderStatus =
  | 'pending_payment'
  | 'ready_for_processing'
  | 'processing'
  | 'ready_for_dispatch'
  | 'awaiting_pickup'
  | 'en_route'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'failed_delivery';

type PaymentStatus = 'pending' | 'paid' | 'failed';
type PaymentMethod = 'wallet' | 'pay_later' | 'paystack';

interface Order {
  _id: string;
  orderNumber: string;
  user: User;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  currentStageOwnerRole: string;
  deliveryInfo: DeliveryInfo;
  statusHistory: StatusHistoryEntry[];
  assignedRider?: AssignedRider;
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  product: Product;
  productName: string;
  quantity: number;
  priceType: 'retail' | 'bulk';
  unitPrice: number;
  totalPrice: number;
}

interface DeliveryInfo {
  address: string;
  city: string;
  state: string;
  phoneNumber: string;
  deliveryDate?: string;
  deliveryNote?: string;
}

interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  updatedBy?: User;
}

interface AssignedRider {
  rider: User;
  assignedBy?: string;
  assignedAt: string;
  note?: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  adminRole?: string;
}

interface Product {
  _id: string;
  name: string;
  images: string[];
}

interface Rider {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  adminRole: 'rider';
  permissions: string[];
  isOnDelivery: boolean;
  activeDeliveries: number;
}

// Pagination
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface OrdersListResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}

// Action Types
type WorkflowAction =
  | 'mark-processing'
  | 'mark-ready-for-dispatch'
  | 'assign-rider'
  | 'confirm-pickup'
  | 'fail-delivery'
  | 'return-to-dispatch'
  | 'cancel-order'
  | 'close-order';

interface ActionResponse {
  order: Order;
  transition: {
    from: OrderStatus;
    to: OrderStatus;
    action: WorkflowAction;
  };
  availableActions: WorkflowAction[];
}
```

---

## Frontend Integration Examples

### Dashboard Data Fetching

```typescript
const API_BASE = '/api/admin';

// Fetch all dashboard data in parallel
async function fetchDashboardData(dateFilter?: { startDate: string; endDate: string }) {
  const params = new URLSearchParams();
  if (dateFilter?.startDate) params.append('startDate', dateFilter.startDate);
  if (dateFilter?.endDate) params.append('endDate', dateFilter.endDate);

  const queryString = params.toString() ? `?${params.toString()}` : '';

  const headers = {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  };

  const [
    totalOrdersRes,
    conversionRes,
    orderTrendRes,
    usersTrendRes,
    recentOrdersRes
  ] = await Promise.all([
    fetch(`${API_BASE}/dashboard/total-orders${queryString}`, { headers }),
    fetch(`${API_BASE}/dashboard/conversion-rate${queryString}`, { headers }),
    fetch(`${API_BASE}/dashboard/order-trend${queryString}`, { headers }),
    fetch(`${API_BASE}/dashboard/users-trend${queryString}`, { headers }),
    fetch(`${API_BASE}/dashboard/recent-orders?limit=5${queryString ? '&' + params.toString() : ''}`, { headers })
  ]);

  return {
    totalOrders: await totalOrdersRes.json() as ApiResponse<TotalOrdersResponse>,
    conversion: await conversionRes.json() as ApiResponse<ConversionRateResponse>,
    orderTrend: await orderTrendRes.json() as ApiResponse<OrderTrendItem[]>,
    usersTrend: await usersTrendRes.json() as ApiResponse<UsersTrendItem[]>,
    recentOrders: await recentOrdersRes.json() as ApiResponse<RecentOrder[]>
  };
}
```

### Order Actions

```typescript
async function performOrderAction(
  orderId: string,
  action: WorkflowAction,
  payload?: Record<string, any>
): Promise<ApiResponse<ActionResponse>> {
  const response = await fetch(`${API_BASE}/orders/${orderId}/actions/${action}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  return response.json();
}

// Usage examples
await performOrderAction('order123', 'mark-processing');
await performOrderAction('order123', 'assign-rider', { riderIds: ['rider456'] });
await performOrderAction('order123', 'cancel-order', { reason: 'Customer request' });
```

### Component Mapping

```tsx
// Total Orders Card
<StatCard
  title="Total Orders"
  value={data.totalOrders.data.totalOrders}
  icon={<OrderIcon />}
/>

// Conversion Rate Card
<StatCard
  title="Conversion rate"
  value={`${data.conversion.data.conversionRate}%`}
  trend={data.conversion.data.conversionRate > 50 ? 'up' : 'down'}
/>

// Total Users Card
<StatCard
  title="Total Users"
  value={data.conversion.data.totalUsers}
  icon={<UsersIcon />}
/>

// Order Status Pie Chart
<PieChart
  data={[
    {
      label: 'Delivered',
      value: data.totalOrders.data.byOrderStatus.delivered.count,
      percentage: data.totalOrders.data.byOrderStatus.delivered.percentage,
      color: '#4CAF50',
      revenue: formatCurrency(data.totalOrders.data.byOrderStatus.delivered.revenue)
    },
    {
      label: 'Pending',
      value: data.totalOrders.data.byOrderStatus.pending.count,
      percentage: data.totalOrders.data.byOrderStatus.pending.percentage,
      color: '#FF9800',
      revenue: formatCurrency(data.totalOrders.data.byOrderStatus.pending.revenue)
    },
    {
      label: 'Cancelled',
      value: data.totalOrders.data.byOrderStatus.cancelled.count,
      percentage: data.totalOrders.data.byOrderStatus.cancelled.percentage,
      color: '#F44336',
      revenue: formatCurrency(data.totalOrders.data.byOrderStatus.cancelled.revenue)
    }
  ]}
/>

// Order Trend Bar Chart
<BarChart
  data={data.orderTrend.data.map(item => ({
    label: formatMonth(item.month), // "Jan", "Feb", etc.
    value: item.orderCount
  }))}
  xAxisLabel="Month"
  yAxisLabel="Orders"
/>

// Users Trend Line Chart
<LineChart
  data={data.usersTrend.data.map(item => ({
    label: formatMonth(item.month),
    value: item.userCount
  }))}
  color="#FF9800"
/>

// Recent Orders Table
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Order Name & ID</TableHead>
      <TableHead>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.recentOrders.data.map(order => (
      <TableRow key={order.orderId}>
        <TableCell>
          <div className="font-medium">{order.customerName}</div>
          <div className="text-sm text-gray-500">{order.orderNumber}</div>
        </TableCell>
        <TableCell>₦{order.amount.toLocaleString()}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>

// Helper functions
function formatMonth(monthString: string): string {
  const [year, month] = monthString.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short' });
}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "message": "Error description"
}
```

### Workflow Error Response

```json
{
  "success": false,
  "message": "Cannot perform this action",
  "code": "INVALID_TRANSITION",
  "details": {
    "currentStatus": "pending_payment",
    "requestedAction": "assign-rider",
    "allowedActions": ["cancel-order"]
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid parameters or validation error |
| `401` | Unauthorized - Missing or invalid token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Workflow transition not allowed |
| `500` | Server Error |

### Error Handling Example

```typescript
async function handleApiCall<T>(
  apiCall: () => Promise<Response>
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await apiCall();
    const json = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401) {
        // Redirect to login
        window.location.href = '/login';
        return { error: 'Session expired' };
      }

      if (response.status === 403) {
        return { error: 'You do not have permission to perform this action' };
      }

      return { error: json.message || 'An error occurred' };
    }

    if (!json.success) {
      return { error: json.message };
    }

    return { data: json.data };
  } catch (error) {
    return { error: 'Network error. Please try again.' };
  }
}
```

---

## Date Filtering

All dashboard endpoints support date filtering.

### Query Parameters

| Parameter | Format | Example |
|-----------|--------|---------|
| `startDate` | `YYYY-MM-DD` | `2025-04-01` |
| `endDate` | `YYYY-MM-DD` | `2025-04-30` |

### Examples

**Filter by specific month (April 2025):**
```
GET /api/admin/dashboard/total-orders?startDate=2025-04-01&endDate=2025-04-30
```

**Filter by year:**
```
GET /api/admin/dashboard/order-trend?startDate=2025-01-01&endDate=2025-12-31
```

**Filter by date range:**
```
GET /api/admin/dashboard/recent-orders?startDate=2025-11-01&endDate=2025-11-22&limit=20
```

### Date Filter Component Example

```tsx
function DateFilter({ onFilterChange }: { onFilterChange: (filter: DateFilter) => void }) {
  const presets = [
    { label: 'Today', getValue: () => ({ startDate: today(), endDate: today() }) },
    { label: 'This Week', getValue: () => ({ startDate: startOfWeek(), endDate: today() }) },
    { label: 'This Month', getValue: () => ({ startDate: startOfMonth(), endDate: today() }) },
    { label: 'Last 30 Days', getValue: () => ({ startDate: daysAgo(30), endDate: today() }) },
    { label: 'This Year', getValue: () => ({ startDate: startOfYear(), endDate: today() }) },
  ];

  return (
    <Select onChange={(preset) => onFilterChange(preset.getValue())}>
      {presets.map(preset => (
        <Option key={preset.label} value={preset}>{preset.label}</Option>
      ))}
    </Select>
  );
}
```
