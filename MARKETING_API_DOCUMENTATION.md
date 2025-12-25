# Farmchops Marketing & Discount System API Documentation

**Version:** 1.0.0
**Last Updated:** January 2025
**Base URL:** `https://api.farmchops.com`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Customer-Facing Endpoints](#customer-facing-endpoints)
4. [Admin Endpoints](#admin-endpoints)
5. [Data Models](#data-models)
6. [Frontend Integration Guide](#frontend-integration-guide)
7. [Backend Implementation Notes](#backend-implementation-notes)

---

## Overview

The Farmchops marketing system provides:
- **First-Time Buyer Discount**: Automatic 10% off (max ₦2,000) for first-time buyers
- **Coupon Codes**: Promotional codes for percentage, fixed amount, or free delivery discounts
- **Marketer Referral System**: Track sales staff performance and commissions
- **No Discount Stacking**: System automatically selects the best available discount

### Important Notes
- All amounts are in **KOBO** (1 Naira = 100 kobo)
- Discounts are **optional** - checkout works normally without them
- Only **authenticated users** can use discounts
- First-time discount applies **automatically** if eligible
- Marketer pages are **admin-only** (marketers cannot log in to view their stats)

---

## Authentication

### Customer Authentication
All customer discount endpoints require authentication via JWT token.

**Header:**
```
Authorization: Bearer <customer_jwt_token>
```

### Admin Authentication
All admin marketing endpoints require:
1. Valid JWT token
2. User role: `admin`
3. Permission: `manage_marketing`

**Roles with `manage_marketing` permission:**
- `super_admin` (has all permissions)
- `operations_officer`
- `finance`

**Header:**
```
Authorization: Bearer <admin_jwt_token>
```

---

## Customer-Facing Endpoints

### 1. Validate Referral/Marketing Code

**Endpoint:** `POST /api/auth/validate-referral-code`

**Purpose:** Validate a marketing code during signup to link customer to a marketer.

**Authentication:** Not required (used during signup)

**Request Body:**
```json
{
  "referralCode": "MARK001"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Valid referral code",
  "data": {
    "isValid": true,
    "marketerName": "John Doe"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid or inactive referral code"
}
```

---

### 2. Validate Coupon Code

**Endpoint:** `POST /api/coupons/validate`

**Purpose:** Validate a coupon code before applying it at checkout.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "couponCode": "SAVE10",
  "orderAmount": 5000000
}
```

**Parameters:**
- `couponCode` (string, required): The coupon code to validate
- `orderAmount` (number, required): Order subtotal in kobo

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "isValid": true,
    "coupon": {
      "code": "SAVE10",
      "description": "10% off your order",
      "discountType": "percentage",
      "discountValue": 10,
      "maxDiscountAmount": 200000,
      "minOrderAmount": 500000,
      "calculatedDiscount": 200000
    }
  }
}
```

**Error Responses:**

Invalid coupon (400):
```json
{
  "success": false,
  "message": "Coupon not found or inactive"
}
```

Below minimum order (400):
```json
{
  "success": false,
  "message": "Order amount below minimum required (₦5,000)"
}
```

Usage limit reached (400):
```json
{
  "success": false,
  "message": "You have already used this coupon the maximum number of times"
}
```

---

### 3. Calculate Available Discounts

**Endpoint:** `POST /api/orders/calculate-discount`

**Purpose:** Preview all available discounts for the current order.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "subtotal": 5000000,
  "couponCode": "SAVE10"
}
```

**Parameters:**
- `subtotal` (number, required): Order subtotal in kobo
- `couponCode` (string, optional): Coupon code to check

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "availableDiscounts": [
      {
        "type": "first_time",
        "description": "10% off for first-time buyers",
        "amount": 200000,
        "applied": true
      },
      {
        "type": "coupon",
        "code": "SAVE10",
        "description": "10% off your order",
        "amount": 200000,
        "applied": false
      }
    ],
    "bestDiscount": {
      "type": "first_time",
      "description": "10% off for first-time buyers",
      "amount": 200000
    },
    "subtotalBeforeDiscount": 5000000,
    "totalDiscount": 200000,
    "finalSubtotal": 4800000
  }
}
```

**Note:** Only the `bestDiscount` will be applied (no stacking).

---

### 4. Create Order (With Optional Discount)

**Endpoint:** `POST /api/orders/create`

**Purpose:** Create a new order with optional coupon code.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "deliveryInfo": {
    "address": "123 Main Street, Jabi",
    "city": "Abuja",
    "state": "FCT",
    "phoneNumber": "08012345678"
  },
  "paymentMethod": "paystack",
  "deliveryFee": 200000,
  "couponCode": "SAVE10"
}
```

**Parameters:**
- `deliveryInfo` (object, required): Delivery details
- `paymentMethod` (string, required): One of: `wallet`, `pay_later`, `paystack`
- `deliveryFee` (number, optional): Delivery fee in kobo
- `couponCode` (string, **optional**): Coupon code to apply

**Success Response (201):**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "_id": "65abc123...",
      "orderNumber": "ORD-20250125-ABC123",
      "user": "65xyz789...",
      "items": [...],
      "subtotalBeforeDiscount": 5000000,
      "discounts": [
        {
          "type": "coupon",
          "code": "SAVE10",
          "amount": 200000,
          "description": "10% off your order"
        }
      ],
      "totalDiscount": 200000,
      "subtotal": 4800000,
      "deliveryFee": 200000,
      "tax": 360000,
      "totalAmount": 5360000,
      "paymentStatus": "pending",
      "orderStatus": "pending_payment"
    },
    "handoverCode": "1234"
  }
}
```

**Important:**
- Discount is **optional** - order will be created successfully even without a coupon
- First-time discount applies **automatically** if user is eligible
- Invalid coupon codes are **silently ignored** (use validate endpoint for real-time validation)

---

### 5. Checkout Summary (With Optional Discount)

**Endpoint:** `POST /api/orders/checkout-summary`

**Purpose:** Get order summary before creating the order, including discount calculation.

**Authentication:** Optional (discount only available if authenticated)

**✅ IMPLEMENTED** - Discount calculation fully integrated

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "08012345678",
  "address": "123 Main Street, Jabi, Abuja",
  "couponCode": "SAVE10"
}
```

**Parameters:**
- `name` (string, required): Customer name
- `phone` (string, required): Customer phone
- `address` (string, required): Delivery address
- `origin` (string, optional): Warehouse coordinates
- `notes` (string, optional): Order notes
- `couponCode` (string, **optional**): Coupon code to preview

**Success Response (200) - With Discount:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [...],
      "totalAmount": 5000000
    },
    "customerInfo": {
      "name": "John Doe",
      "phone": "08012345678"
    },
    "delivery": {
      "address": "123 Main Street, Jabi, Abuja",
      "distanceKm": 5.2,
      "durationSeconds": 900,
      "distanceText": "5.2 km",
      "durationText": "15 mins",
      "fee": 200000
    },
    "discount": {
      "type": "coupon",
      "code": "SAVE10",
      "description": "10% off your order",
      "amount": 200000
    },
    "totals": {
      "subtotalBeforeDiscount": 5000000,
      "discount": 200000,
      "subtotal": 4800000,
      "deliveryFee": 200000,
      "tax": 360000,
      "grandTotal": 5360000
    }
  }
}
```

**Success Response (200) - Without Discount:**
```json
{
  "success": true,
  "data": {
    "cart": {...},
    "customerInfo": {...},
    "delivery": {...},
    "discount": null,
    "totals": {
      "subtotal": 5000000,
      "deliveryFee": 200000,
      "tax": 375000,
      "grandTotal": 5575000
    }
  }
}
```

**Note:**
- If user is not authenticated, `discount` will be `null`
- Invalid coupon codes result in `discount: null` (no error thrown)

---

## Admin Endpoints

All admin endpoints require authentication + `manage_marketing` permission.

### Marketers Management

#### 1. Create Marketer

**Endpoint:** `POST /api/admin/marketers`

**✅ IMPLEMENTED** - Welcome email automatically sent to marketer

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.marketer@example.com",
  "phone": "08012345678",
  "commissionRate": 10
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Marketer created successfully",
  "data": {
    "marketer": {
      "_id": "65abc123...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.marketer@example.com",
      "phone": "08012345678",
      "marketingCode": "MARK001",
      "commissionRate": 10,
      "status": "active",
      "totalSignups": 0,
      "totalOrders": 0,
      "totalRevenue": 0,
      "totalCommission": 0,
      "unpaidCommission": 0,
      "createdAt": "2025-01-25T10:00:00Z"
    }
  }
}
```

---

#### 2. Get All Marketers

**Endpoint:** `GET /api/admin/marketers?page=1&limit=20&status=active`

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `status` (string, optional): Filter by status (`active`, `inactive`, `suspended`)
- `search` (string, optional): Search by name, email, or marketing code

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "marketers": [
      {
        "_id": "65abc123...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.marketer@example.com",
        "phone": "08012345678",
        "marketingCode": "MARK001",
        "commissionRate": 10,
        "status": "active",
        "totalSignups": 25,
        "totalOrders": 15,
        "totalRevenue": 75000000,
        "totalCommission": 7500000,
        "unpaidCommission": 2500000,
        "lastPaidAt": "2025-01-01T00:00:00Z",
        "lastPaidAmount": 5000000,
        "createdAt": "2024-12-01T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalMarketers": 45,
      "limit": 20
    }
  }
}
```

---

#### 3. Get Marketer by ID

**Endpoint:** `GET /api/admin/marketers/:marketerId`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "marketer": {
      "_id": "65abc123...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.marketer@example.com",
      "phone": "08012345678",
      "marketingCode": "MARK001",
      "commissionRate": 10,
      "status": "active",
      "totalSignups": 25,
      "totalOrders": 15,
      "totalRevenue": 75000000,
      "totalCommission": 7500000,
      "unpaidCommission": 2500000,
      "createdAt": "2024-12-01T10:00:00Z"
    }
  }
}
```

---

#### 4. Update Marketer

**Endpoint:** `PUT /api/admin/marketers/:marketerId`

**Request Body:**
```json
{
  "firstName": "Jane",
  "commissionRate": 12,
  "status": "active"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Marketer updated successfully",
  "data": {
    "marketer": {...}
  }
}
```

---

#### 5. Delete Marketer (Soft Delete)

**Endpoint:** `DELETE /api/admin/marketers/:marketerId`

**Note:** Requires `super_admin` role (not just `manage_marketing` permission)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Marketer deleted successfully"
}
```

---

#### 6. Get Marketer Performance Report

**Endpoint:** `GET /api/admin/marketers/:marketerId/report?startDate=2025-01-01&endDate=2025-01-31`

**Query Parameters:**
- `startDate` (string, optional): Start date (ISO format)
- `endDate` (string, optional): End date (ISO format)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "marketer": {
      "id": "65abc123...",
      "name": "John Doe",
      "marketingCode": "MARK001",
      "email": "john.marketer@example.com"
    },
    "period": {
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-01-31T23:59:59Z"
    },
    "metrics": {
      "totalSignups": 10,
      "totalOrders": 6,
      "conversionRate": 60,
      "totalRevenue": 30000000,
      "totalCommission": 3000000,
      "unpaidCommission": 3000000,
      "averageOrderValue": 5000000
    },
    "topCustomers": [
      {
        "customerId": "65xyz789...",
        "customerName": "Jane Smith",
        "orderCount": 1,
        "totalSpent": 10000000,
        "commission": 1000000
      }
    ]
  }
}
```

---

#### 7. Record Commission Payment

**Endpoint:** `POST /api/admin/marketers/:marketerId/pay-commission`

**Request Body:**
```json
{
  "amount": 3000000,
  "paymentMethod": "bank_transfer",
  "notes": "January 2025 commission payment"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Commission payment recorded successfully",
  "data": {
    "payment": {
      "_id": "65payment123...",
      "marketer": "65abc123...",
      "amount": 3000000,
      "paymentMethod": "bank_transfer",
      "paymentDate": "2025-01-25T10:00:00Z",
      "notes": "January 2025 commission payment",
      "paidBy": "65admin456..."
    },
    "marketer": {
      "unpaidCommission": 0,
      "lastPaidAmount": 3000000,
      "lastPaidAt": "2025-01-25T10:00:00Z"
    }
  }
}
```

---

#### 8. Get All Marketers Summary Report

**Endpoint:** `GET /api/admin/reports/marketers?startDate=2025-01-01&endDate=2025-01-31`

**Query Parameters:**
- `startDate` (string, optional): Start date
- `endDate` (string, optional): End date

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-01-31T23:59:59Z"
    },
    "summary": {
      "totalMarketers": 45,
      "activeMarketers": 38,
      "totalSignups": 250,
      "totalOrders": 150,
      "totalRevenue": 750000000,
      "totalCommissionEarned": 75000000,
      "totalCommissionPaid": 50000000,
      "totalCommissionUnpaid": 25000000
    },
    "topPerformers": [
      {
        "marketerId": "65abc123...",
        "name": "John Doe",
        "marketingCode": "MARK001",
        "signups": 25,
        "orders": 15,
        "revenue": 75000000,
        "commission": 7500000
      }
    ]
  }
}
```

---

### Coupons Management

#### 1. Create Coupon

**Endpoint:** `POST /api/admin/coupons`

**Request Body:**
```json
{
  "code": "SAVE10",
  "description": "10% off your order",
  "discountType": "percentage",
  "discountValue": 10,
  "maxDiscountAmount": 200000,
  "minOrderAmount": 500000,
  "maxUsesTotal": 100,
  "maxUsesPerUser": 1,
  "validFrom": "2025-01-01",
  "validUntil": "2025-12-31"
}
```

**Parameters:**
- `code` (string, required): Unique coupon code (auto-converted to uppercase)
- `description` (string, required): Coupon description
- `discountType` (string, required): One of: `percentage`, `fixed_amount`, `free_delivery`
- `discountValue` (number, required): Percentage (1-100) or fixed amount in kobo
- `maxDiscountAmount` (number, optional): Max discount in kobo (for percentage type)
- `minOrderAmount` (number, optional): Minimum order amount in kobo
- `maxUsesTotal` (number, optional): Total usage limit
- `maxUsesPerUser` (number, required): Per-user usage limit
- `validFrom` (string, optional): Start date (ISO format)
- `validUntil` (string, optional): End date (ISO format)

**Success Response (201):**
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "coupon": {
      "_id": "65coupon123...",
      "code": "SAVE10",
      "description": "10% off your order",
      "discountType": "percentage",
      "discountValue": 10,
      "maxDiscountAmount": 200000,
      "minOrderAmount": 500000,
      "maxUsesTotal": 100,
      "maxUsesPerUser": 1,
      "currentUses": 0,
      "validFrom": "2025-01-01T00:00:00Z",
      "validUntil": "2025-12-31T23:59:59Z",
      "status": "active",
      "createdAt": "2025-01-25T10:00:00Z"
    }
  }
}
```

---

#### 2. Get All Coupons

**Endpoint:** `GET /api/admin/coupons?page=1&limit=20&status=active`

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `status` (string, optional): Filter by status
- `search` (string, optional): Search by code or description

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "_id": "65coupon123...",
        "code": "SAVE10",
        "description": "10% off your order",
        "discountType": "percentage",
        "discountValue": 10,
        "maxDiscountAmount": 200000,
        "minOrderAmount": 500000,
        "maxUsesTotal": 100,
        "maxUsesPerUser": 1,
        "currentUses": 45,
        "status": "active",
        "validFrom": "2025-01-01T00:00:00Z",
        "validUntil": "2025-12-31T23:59:59Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCoupons": 25,
      "limit": 20
    }
  }
}
```

---

#### 3. Get Coupon Usage Report

**Endpoint:** `GET /api/admin/coupons/:couponId/report?startDate=2025-01-01&endDate=2025-01-31`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "coupon": {
      "code": "SAVE10",
      "description": "10% off your order",
      "status": "active"
    },
    "period": {
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-01-31T23:59:59Z"
    },
    "metrics": {
      "totalUses": 45,
      "uniqueUsers": 45,
      "totalDiscount": 9000000,
      "totalRevenue": 225000000,
      "averageOrderValue": 5000000
    },
    "recentOrders": [
      {
        "orderNumber": "ORD-20250125-ABC123",
        "customerName": "John Doe",
        "orderDate": "2025-01-25T10:00:00Z",
        "orderAmount": 5000000,
        "discountApplied": 200000
      }
    ]
  }
}
```

---

## Data Models

### Discount Types

**First-Time Discount:**
- Type: `first_time`
- Rate: 10%
- Max discount: ₦2,000 (200,000 kobo)
- Min order: ₦5,000 (500,000 kobo)
- Applied automatically if eligible

**Coupon Discount:**
- Type: `coupon`
- Discount types: `percentage`, `fixed_amount`, `free_delivery`
- Applied when user provides valid coupon code

**Marketer Commission:**
- Rate: Configurable per marketer (default 10%)
- Applied on: First order only from referred customer
- Calculated on: Subtotal before discount

---

## Frontend Integration Guide

### Signup Flow (Referral Code)

```javascript
// Step 1: User enters referral code
const referralCode = "MARK001";

// Step 2: Validate referral code
const response = await fetch('/api/auth/validate-referral-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ referralCode })
});

const data = await response.json();

if (data.success && data.data.isValid) {
  // Show success message: "Referral code valid! Linked to John Doe"
  // Include referralCode in signup form
} else {
  // Show error: "Invalid referral code"
}

// Step 3: Include in signup
await fetch('/api/auth/send-verification-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: "user@example.com",
    referralCode: "MARK001" // Include here
  })
});
```

---

### Checkout Flow (Coupon Code)

```javascript
// Step 1: User enters coupon code
const couponCode = "SAVE10";

// Step 2: Validate coupon (real-time)
const validateResponse = await fetch('/api/coupons/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    couponCode,
    orderAmount: cartTotal // in kobo
  })
});

const validateData = await validateResponse.json();

if (validateData.success) {
  // Show success: "Coupon applied! You save ₦2,000"
  // Update UI to show discount
} else {
  // Show error: validateData.message
}

// Step 3: Get checkout summary with discount
const summaryResponse = await fetch('/api/orders/checkout-summary', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    name: "John Doe",
    phone: "08012345678",
    address: "123 Main Street",
    couponCode: "SAVE10" // Optional
  })
});

const summaryData = await summaryResponse.json();

// Display totals:
// Subtotal: ₦50,000
// Discount (SAVE10): -₦5,000
// Subtotal after discount: ₦45,000
// Delivery: ₦2,000
// Tax: ₦3,375
// Total: ₦50,375

// Step 4: Create order with coupon
const orderResponse = await fetch('/api/orders/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    deliveryInfo: {...},
    paymentMethod: "paystack",
    couponCode: "SAVE10" // Optional - can be omitted
  })
});
```

---

### UI Components

#### Coupon Input Field
```jsx
<div className="coupon-section">
  <label>Have a coupon code?</label>
  <div className="coupon-input-group">
    <input
      type="text"
      placeholder="Enter code"
      value={couponCode}
      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
    />
    <button onClick={applyCoupon}>Apply</button>
  </div>
  {couponError && <p className="error">{couponError}</p>}
  {couponSuccess && <p className="success">✓ Coupon applied!</p>}
</div>
```

#### Order Summary with Discount
```jsx
<div className="order-summary">
  <div className="line-item">
    <span>Subtotal</span>
    <span>₦{(totals.subtotalBeforeDiscount / 100).toLocaleString()}</span>
  </div>

  {totals.discount > 0 && (
    <div className="line-item discount">
      <span>Discount ({discount?.code || 'First-time buyer'})</span>
      <span className="savings">-₦{(totals.discount / 100).toLocaleString()}</span>
    </div>
  )}

  <div className="line-item">
    <span>Delivery</span>
    <span>₦{(totals.deliveryFee / 100).toLocaleString()}</span>
  </div>

  <div className="line-item">
    <span>Tax</span>
    <span>₦{(totals.tax / 100).toLocaleString()}</span>
  </div>

  <div className="line-item total">
    <span>Total</span>
    <span>₦{(totals.grandTotal / 100).toLocaleString()}</span>
  </div>
</div>
```

---

## Backend Implementation Notes

### Important Business Rules

1. **Discount Selection**: System automatically picks the best discount (highest amount)
2. **No Stacking**: Only ONE discount can be applied per order
3. **First Order Commission**: Marketer commission only on customer's first order
4. **Commission Calculation**: Based on subtotal BEFORE discount
5. **Tax Calculation**: Applied on subtotal AFTER discount
6. **Soft Deletes**: Marketers and coupons use status field (never hard delete)

### Discount Priority Logic

```javascript
// System compares all available discounts and picks the best one
const availableDiscounts = [
  { type: 'first_time', amount: 200000 },  // ₦2,000
  { type: 'coupon', amount: 500000 }       // ₦5,000
];

// Best discount = Coupon (₦5,000 > ₦2,000)
const bestDiscount = availableDiscounts.reduce((best, current) =>
  current.amount > best.amount ? current : best
);
```

### Order Creation Flow

```
1. Get cart items
2. Validate deal inventory
3. Calculate discounts (optional)
   ├─ Check first-time eligibility
   ├─ Validate coupon (if provided)
   └─ Pick best discount
4. Create order with discount
5. Update coupon usage (if used)
6. Update user first-time flag (if used)
7. Calculate marketer commission (if referred + first order)
8. Update marketer stats
9. Commit transaction
```

### Database Updates on Order

When an order is created with discounts:
1. **Order**: Stores discount details, commission info
2. **Coupon** (if used): Increments `currentUses`, adds user to `usedBy`
3. **User**: Sets `hasUsedFirstTimeDiscount`, `hasPlacedFirstOrder`
4. **Marketer** (if applicable): Increments stats, adds to `unpaidCommission`

---

## Marketer Information Access

### Important: Marketers Cannot View Their Own Stats

**Current Implementation:**
- Marketer pages are **admin-only**
- Marketers do NOT have login credentials
- Only admins with `manage_marketing` permission can view marketer stats

### How Marketers Get Their Information

**Option 1: Admin Portal (Current)**
- Admin logs in
- Views marketer performance reports
- Manually shares information with marketer (email, print, etc.)

**Option 2: Future Enhancement (Not Implemented)**
If you want marketers to view their own stats, you would need to:
1. Create separate marketer authentication system
2. Create marketer-specific frontend pages
3. Add new endpoints: `GET /api/marketer/my-stats` (authenticated as marketer)
4. Update Marketer model to include login credentials

**Recommendation:**
Keep current admin-only approach for now. Admins can:
- Generate PDF reports
- Export to CSV
- Email stats to marketers monthly

---

## Error Codes Reference

| Code | Message | Description |
|------|---------|-------------|
| 400 | Invalid or inactive referral code | Referral code doesn't exist or marketer is inactive |
| 400 | Coupon not found or inactive | Coupon doesn't exist or is expired/inactive |
| 400 | Order amount below minimum required | Order doesn't meet coupon's minimum order amount |
| 400 | You have already used this coupon | User exceeded per-user usage limit |
| 400 | Coupon has reached maximum uses | Coupon exceeded total usage limit |
| 401 | Access token required | No authorization header provided |
| 401 | User not found | Token is invalid or user deleted |
| 403 | Admin access required | User is not an admin |
| 403 | Insufficient permissions | Admin doesn't have `manage_marketing` permission |
| 404 | Marketer not found | Marketer ID doesn't exist |
| 404 | Coupon not found | Coupon ID doesn't exist |

---

## Testing Checklist

### Customer Flow Testing
- [ ] Signup with valid referral code
- [ ] Signup with invalid referral code
- [ ] Signup without referral code
- [ ] Apply valid coupon at checkout
- [ ] Apply invalid coupon at checkout
- [ ] Checkout without coupon
- [ ] First-time buyer gets automatic discount
- [ ] Returning buyer doesn't get first-time discount
- [ ] Best discount is selected when multiple available
- [ ] Order totals calculated correctly with discount
- [ ] Commission tracked on first order from referral

### Admin Flow Testing
- [ ] Create marketer
- [ ] View all marketers
- [ ] View marketer performance report
- [ ] Record commission payment
- [ ] Create coupon (percentage type)
- [ ] Create coupon (fixed amount type)
- [ ] Create coupon (free delivery type)
- [ ] View coupon usage report
- [ ] Update coupon status
- [ ] Filter marketers by status
- [ ] Search marketers by name/code

---

## Support

For questions or issues, contact the backend team.

**Last Updated:** January 2025
**Maintained By:** Farmchops Development Team
