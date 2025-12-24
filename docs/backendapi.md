# Marketing System - Backend API Specification

**IMPORTANT:** All amounts are in **KOBO** (not Naira). Example: ₦1,000 = 100,000 kobo

---

## Table of Contents
1. [Authentication Endpoints](#authentication-endpoints)
2. [Marketer Management Endpoints](#marketer-management-endpoints)
3. [Coupon Management Endpoints](#coupon-management-endpoints)
4. [User Endpoints (Discount & Validation)](#user-endpoints-discount--validation)
5. [Database Schema Requirements](#database-schema-requirements)

---

## Authentication Endpoints

### 1. Validate Referral Code (Public - No Auth Required)

**Endpoint:** `POST /api/auth/validate-referral-code`

**Request Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "referralCode": "JUDE2025"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Valid referral code",
  "data": {
    "isValid": true,
    "marketerName": "Jude Okonkwo"
  }
}
```

**Invalid Code Response (200):**
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "message": "Invalid or inactive referral code"
  }
}
```

**Notes:**
- Must check if marketer exists with this code
- Must check if marketer status is "active"
- Return marketer's full name (firstName + lastName)

---

### 2. Update Signup Endpoint

**Endpoint:** `POST /api/auth/send-verification-email`

**Existing Request Body:**
```json
{
  "email": "user@example.com"
}
```

**NEW Request Body (add optional referralCode):**
```json
{
  "email": "user@example.com",
  "referralCode": "JUDE2025"  // OPTIONAL - only if user provided one
}
```

**Response:** (Keep existing response, no changes needed)

**Backend Logic:**
1. If `referralCode` is provided:
   - Find marketer with matching `marketingCode` (case-insensitive)
   - Verify marketer status is "active"
   - Store temporarily (in session/cache) until user completes verification
2. After user verifies email and creates account:
   - If referralCode was provided, update new user document:
     ```javascript
     {
       referredBy: marketer._id,
       referralCode: "JUDE2025",
       referralDate: new Date(),
       hasPlacedFirstOrder: false  // Track for first-order-only commission
     }
     ```
   - Increment marketer's `totalSignups` by 1

---

## Marketer Management Endpoints

### 3. Create Marketer

**Endpoint:** `POST /api/admin/marketers`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {admin_token}"
}
```

**Request Body:**
```json
{
  "firstName": "Jude",
  "lastName": "Okonkwo",
  "email": "jude@example.com",
  "phone": "08012345678",
  "marketingCode": "JUDE2025",          // OPTIONAL - auto-generate if not provided
  "commissionRate": 10                   // OPTIONAL - default: 10 (percentage)
}
```

**NOTE:** `attributionWindowDays` field has been **REMOVED**. Commission is now calculated on **FIRST ORDER ONLY** per referred customer, regardless of time elapsed.

**Field Validation:**
- `firstName`: Required, string, 1-100 chars
- `lastName`: Required, string, 1-100 chars
- `email`: Required, valid email, unique
- `phone`: Required, string
- `marketingCode`: Optional, 6-12 chars, uppercase alphanumeric, unique
  - If not provided: auto-generate (e.g., `FIRST4LAST2NUM` like `JUDE2025` or random)
- `commissionRate`: Optional, number, 0-100, default: 10

**Success Response (201):**
```json
{
  "success": true,
  "message": "Marketer created successfully",
  "data": {
    "marketer": {
      "_id": "64abc123def456789",
      "firstName": "Jude",
      "lastName": "Okonkwo",
      "email": "jude@example.com",
      "phone": "08012345678",
      "marketingCode": "JUDE2025",
      "status": "active",
      "commissionRate": 10,
      "totalSignups": 0,
      "totalOrders": 0,
      "totalRevenue": 0,
      "totalCommission": 0,
      "unpaidCommission": 0,
      "createdBy": "64xyz789abc123456",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Marketing code already exists"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Email already exists"
}
```

---

### 4. Get All Marketers (with pagination & filters)

**Endpoint:** `GET /api/admin/marketers`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Authorization": "Bearer {admin_token}"
}
```

**Query Parameters:**
```
?page=1&limit=20&status=active&search=jude&sortBy=totalRevenue&order=desc
```

- `page`: number, default: 1
- `limit`: number, default: 20, max: 100
- `status`: string, optional, values: "active" | "inactive" | "suspended"
- `search`: string, optional (search in firstName, lastName, email, marketingCode)
- `sortBy`: string, optional, values: "totalRevenue" | "totalOrders" | "totalSignups" | "createdAt"
- `order`: string, optional, values: "asc" | "desc", default: "desc"

**Success Response (200):**
```json
{
  "success": true,
  "message": "Marketers retrieved successfully",
  "data": {
    "marketers": [
      {
        "_id": "64abc123def456789",
        "firstName": "Jude",
        "lastName": "Okonkwo",
        "email": "jude@example.com",
        "phone": "08012345678",
        "marketingCode": "JUDE2025",
        "status": "active",
        "commissionRate": 10,
        "totalSignups": 45,
        "totalOrders": 120,
        "totalRevenue": 15000000,        // ₦150,000 in kobo
        "totalCommission": 1500000,      // ₦15,000 in kobo
        "unpaidCommission": 600000,      // ₦6,000 in kobo
        "lastPaidAt": "2025-01-01T00:00:00.000Z",
        "lastPaidAmount": 900000,        // ₦9,000 in kobo
        "createdAt": "2024-12-01T10:00:00.000Z",
        "updatedAt": "2025-01-15T10:00:00.000Z"
      }
      // ... more marketers
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

---

### 5. Get Single Marketer

**Endpoint:** `GET /api/admin/marketers/:marketerId`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Authorization": "Bearer {admin_token}"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Marketer retrieved successfully",
  "data": {
    "marketer": {
      "_id": "64abc123def456789",
      "firstName": "Jude",
      "lastName": "Okonkwo",
      "email": "jude@example.com",
      "phone": "08012345678",
      "marketingCode": "JUDE2025",
      "status": "active",
      "commissionRate": 10,
      "totalSignups": 45,
      "totalOrders": 120,
      "totalRevenue": 15000000,
      "totalCommission": 1500000,
      "unpaidCommission": 600000,
      "lastPaidAt": "2025-01-01T00:00:00.000Z",
      "lastPaidAmount": 900000,
      "createdBy": "64xyz789abc123456",
      "createdAt": "2024-12-01T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Marketer not found"
}
```

---

### 6. Update Marketer

**Endpoint:** `PUT /api/admin/marketers/:marketerId`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {admin_token}"
}
```

**Request Body (all fields optional):**
```json
{
  "firstName": "Jude",
  "lastName": "Okonkwo",
  "email": "newemail@example.com",
  "phone": "08087654321",
  "status": "inactive",
  "commissionRate": 12
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Marketer updated successfully",
  "data": {
    "marketer": {
      // ... full marketer object with updates
    }
  }
}
```

**Notes:**
- Do NOT allow updating `marketingCode` (it's permanent)
- Do NOT allow updating stats fields (totalSignups, totalOrders, etc.)

---

### 7. Delete/Deactivate Marketer

**Endpoint:** `DELETE /api/admin/marketers/:marketerId`

**Required Permission:** Super admin only

**Request Headers:**
```json
{
  "Authorization": "Bearer {admin_token}"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Marketer deactivated successfully"
}
```

**Backend Logic:**
- Do NOT actually delete from database
- Set `status` to "inactive"
- Keep all historical data intact

---

### 8. Get Marketer Performance Report

**Endpoint:** `GET /api/admin/marketers/:marketerId/report`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Authorization": "Bearer {admin_token}"
}
```

**Query Parameters:**
```
?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-31T23:59:59.999Z
```

- `startDate`: ISO date string, required
- `endDate`: ISO date string, required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "marketer": {
      "_id": "64abc123def456789",
      "firstName": "Jude",
      "lastName": "Okonkwo",
      "marketingCode": "JUDE2025"
    },
    "period": {
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-01-31T23:59:59.999Z"
    },
    "metrics": {
      "newSignups": 25,                    // Signups in this period
      "totalOrders": 80,                   // Orders in this period
      "totalRevenue": 10000000,            // ₦100,000 in kobo
      "totalCommission": 1000000,          // ₦10,000 in kobo
      "averageOrderValue": 125000,         // ₦1,250 in kobo
      "conversionRate": 68,                // Percentage (orders/total referred users * 100)
      "unpaidCommission": 500000           // ₦5,000 in kobo
    },
    "topProducts": [
      {
        "productId": "64prod123",
        "productName": "Tomatoes",
        "orderCount": 35,
        "revenue": 4500000                 // ₦45,000 in kobo
      }
      // ... top 5 products
    ],
    "recentOrders": [
      {
        "orderId": "64order123",
        "orderNumber": "FCP-2025-0001234",
        "customerName": "Mary Johnson",
        "orderDate": "2025-01-15T10:00:00.000Z",
        "orderTotal": 250000,              // ₦2,500 in kobo
        "commission": 25000,               // ₦250 in kobo
        "orderStatus": "completed"
      }
      // ... last 10 orders
    ]
  }
}
```

**Backend Calculation Logic:**
1. Find all users where `referredBy` = marketer._id
2. Find all orders by these users where:
   - `createdAt` is between startDate and endDate
   - Order was placed within attribution window (e.g., 60 days from user's referralDate)
3. Calculate metrics from these orders

---

### 9. Pay Commission

**Endpoint:** `POST /api/admin/marketers/:marketerId/pay-commission`

**Required Permission:** `manage_marketing` or super admin

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {admin_token}"
}
```

**Request Body:**
```json
{
  "periodStart": "2025-01-01T00:00:00.000Z",
  "periodEnd": "2025-01-31T23:59:59.999Z",
  "commissionAmount": 1000000,           // ₦10,000 in kobo
  "paymentMethod": "bank_transfer",      // "bank_transfer" | "cash" | "wallet"
  "paymentReference": "TRX123456",
  "notes": "January 2025 commission payment"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Commission payment recorded successfully",
  "data": {
    "payment": {
      "_id": "64pay123",
      "marketer": "64abc123def456789",
      "periodStart": "2025-01-01T00:00:00.000Z",
      "periodEnd": "2025-01-31T23:59:59.999Z",
      "totalOrders": 80,
      "totalRevenue": 10000000,
      "commissionRate": 10,
      "commissionAmount": 1000000,
      "status": "paid",
      "paidAt": "2025-02-01T10:00:00.000Z",
      "paidBy": "64admin789",
      "paymentMethod": "bank_transfer",
      "paymentReference": "TRX123456",
      "notes": "January 2025 commission payment",
      "createdAt": "2025-02-01T10:00:00.000Z"
    }
  }
}
```

**Backend Logic:**
1. Create CommissionPayment record
2. Update marketer:
   ```javascript
   {
     unpaidCommission: unpaidCommission - commissionAmount,
     lastPaidAt: new Date(),
     lastPaidAmount: commissionAmount
   }
   ```
3. Mark all orders in this period as `commissionPaid: true`

---

## Coupon Management Endpoints

### 10. Create Coupon

**Endpoint:** `POST /api/admin/coupons`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {admin_token}"
}
```

**Request Body:**
```json
{
  "code": "SAVE20",
  "description": "20% off for new year promo",
  "discountType": "percentage",           // "percentage" | "fixed_amount" | "free_delivery"
  "discountValue": 20,                    // 20% OR amount in kobo
  "maxDiscountAmount": 500000,            // ₦5,000 max (optional, for percentage only)
  "minOrderAmount": 1000000,              // ₦10,000 minimum (optional)
  "maxUsesTotal": 100,                    // Total usage limit (optional, null = unlimited)
  "maxUsesPerUser": 1,                    // Per-user limit (optional, default: 1)
  "validFrom": "2025-01-01T00:00:00.000Z", // Optional
  "validUntil": "2025-12-31T23:59:59.999Z" // Optional
}
```

**Field Validation:**
- `code`: Required, 6-12 chars, uppercase alphanumeric, unique
- `description`: Required, string
- `discountType`: Required, enum
- `discountValue`: Required, number
  - If percentage: 1-100
  - If fixed_amount: > 0 (in kobo)
- `maxDiscountAmount`: Optional, number (kobo), only for percentage type
- `minOrderAmount`: Optional, number (kobo)
- `maxUsesTotal`: Optional, number or null
- `maxUsesPerUser`: Optional, number, default: 1
- `validFrom`: Optional, ISO date
- `validUntil`: Optional, ISO date

**Success Response (201):**
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "coupon": {
      "_id": "64coupon123",
      "code": "SAVE20",
      "description": "20% off for new year promo",
      "discountType": "percentage",
      "discountValue": 20,
      "maxDiscountAmount": 500000,
      "minOrderAmount": 1000000,
      "maxUsesTotal": 100,
      "maxUsesPerUser": 1,
      "currentUses": 0,
      "validFrom": "2025-01-01T00:00:00.000Z",
      "validUntil": "2025-12-31T23:59:59.999Z",
      "status": "active",
      "usedBy": [],
      "createdBy": "64admin789",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Coupon code already exists"
}
```

---

### 11. Get All Coupons

**Endpoint:** `GET /api/admin/coupons`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Authorization": "Bearer {admin_token}"
}
```

**Query Parameters:**
```
?page=1&limit=20&status=active
```

- `page`: number, default: 1
- `limit`: number, default: 20
- `status`: string, optional, values: "active" | "inactive" | "expired"

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "_id": "64coupon123",
        "code": "SAVE20",
        "description": "20% off for new year promo",
        "discountType": "percentage",
        "discountValue": 20,
        "maxDiscountAmount": 500000,
        "minOrderAmount": 1000000,
        "maxUsesTotal": 100,
        "maxUsesPerUser": 1,
        "currentUses": 45,
        "validFrom": "2025-01-01T00:00:00.000Z",
        "validUntil": "2025-12-31T23:59:59.999Z",
        "status": "active",
        "createdAt": "2025-01-15T10:00:00.000Z",
        "updatedAt": "2025-01-15T10:00:00.000Z"
      }
      // ... more coupons
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "pages": 2
    }
  }
}
```

---

### 12. Update Coupon

**Endpoint:** `PUT /api/admin/coupons/:couponId`

**Required Permission:** `manage_marketing`

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {admin_token}"
}
```

**Request Body (all fields optional):**
```json
{
  "description": "Updated description",
  "status": "inactive",
  "maxUsesTotal": 200,
  "validUntil": "2025-12-31T23:59:59.999Z"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": {
    "coupon": {
      // ... full coupon object with updates
    }
  }
}
```

**Notes:**
- Do NOT allow updating `code` (it's permanent)
- Do NOT allow updating `discountType` or `discountValue` (would affect users who already used it)
- Do NOT allow updating `currentUses` manually

---

### 13. Delete Coupon

**Endpoint:** `DELETE /api/admin/coupons/:couponId`

**Required Permission:** Super admin only

**Request Headers:**
```json
{
  "Authorization": "Bearer {admin_token}"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Coupon deleted successfully"
}
```

**Backend Logic:**
- Set `status` to "inactive" (soft delete)
- Keep historical data

---

## User Endpoints (Discount & Validation)

### 14. Validate Coupon (User - Auth Required)

**Endpoint:** `POST /api/coupons/validate`

**Authentication:** Required (user must be logged in)

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {user_token}"
}
```

**Request Body:**
```json
{
  "couponCode": "SAVE20",
  "orderAmount": 2000000           // ₦20,000 in kobo (subtotal before discount)
}
```

**Success Response (200) - Valid:**
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "isValid": true,
    "coupon": {
      "code": "SAVE20",
      "discountType": "percentage",
      "discountValue": 20,
      "maxDiscountAmount": 500000
    },
    "calculatedDiscount": 400000,        // ₦4,000 (20% of ₦20,000)
    "finalAmount": 1600000               // ₦16,000 after discount
  }
}
```

**Success Response (200) - Invalid:**
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "message": "Order amount below minimum requirement"
  }
}
```

**Validation Checks:**
1. Coupon exists and status is "active"
2. Current date is between validFrom and validUntil (if set)
3. orderAmount >= minOrderAmount (if set)
4. currentUses < maxUsesTotal (if set)
5. User hasn't used this coupon before (or usage count < maxUsesPerUser)

**Possible Error Messages:**
- "Coupon not found or inactive"
- "Coupon has expired"
- "You have already used this coupon"
- "Coupon usage limit reached"
- "Order amount below minimum requirement"

---

### 15. Calculate Order Discounts (User - Auth Required)

**Endpoint:** `POST /api/orders/calculate-discounts`

**Authentication:** Required (user must be logged in)

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {user_token}"
}
```

**Request Body:**
```json
{
  "subtotal": 2000000,                   // ₦20,000 in kobo
  "couponCode": "SAVE20"                 // OPTIONAL
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "subtotal": 2000000,
    "discounts": [
      {
        "type": "first_time",
        "description": "First-time buyer discount (10%)",
        "amount": 200000,                // ₦2,000 (capped at max)
        "applied": false                 // Not applied because coupon is better
      },
      {
        "type": "coupon",
        "code": "SAVE20",
        "description": "20% off new year promo",
        "amount": 400000,                // ₦4,000
        "applied": true                  // This one is applied
      }
    ],
    "bestDiscount": {
      "type": "coupon",
      "code": "SAVE20",
      "amount": 400000
    },
    "totalDiscount": 400000,
    "finalSubtotal": 1600000
  }
}
```

**Backend Logic:**

1. **Check First-Time Discount:**
   ```javascript
   // User is first-time if:
   - No orders with status "completed" or "delivered"
   - user.hasUsedFirstTimeDiscount is false
   - subtotal >= 500000 (₦5,000 minimum)

   // Calculate:
   discount = Math.min(
     Math.floor(subtotal * 0.10),  // 10%
     200000                          // Max ₦2,000
   )
   ```

2. **Check Coupon (if provided):**
   - Validate using same logic as validate-coupon endpoint
   - Calculate discount based on coupon type

3. **Pick Best Discount:**
   - Compare amounts
   - Apply only the better one (NO STACKING)
   - Set `applied: true` for the winner

---

### 16. Create Order (Updated)

**Endpoint:** `POST /api/orders`

**Authentication:** Required

**Existing Request Body:**
```json
{
  "items": [...],
  "deliveryInfo": {...},
  "paymentMethod": "wallet"
}
```

**NEW Request Body (add optional couponCode):**
```json
{
  "items": [...],
  "deliveryInfo": {...},
  "paymentMethod": "wallet",
  "couponCode": "SAVE20"         // OPTIONAL - only if user applied one
}
```

**Backend Order Creation Logic:**

```javascript
// 1. Calculate subtotal from items
let subtotal = calculateSubtotal(items);

// 2. Calculate discounts
const discountResult = await calculateDiscounts(userId, subtotal, couponCode);

// 3. Create order with discount info
const order = {
  ...existingOrderFields,
  subtotalBeforeDiscount: subtotal,
  discounts: discountResult.discounts.filter(d => d.applied),
  totalDiscount: discountResult.totalDiscount,
  subtotal: discountResult.finalSubtotal,  // Discounted subtotal
  // ... calculate delivery, total, etc.
};

// 4. If coupon was used, update coupon
if (couponCode && discountResult.bestDiscount?.type === 'coupon') {
  await Coupon.findOneAndUpdate(
    { code: couponCode.toUpperCase() },
    {
      $inc: { currentUses: 1 },
      $push: { usedBy: userId }
    }
  );
}

// 5. If first-time discount was used, mark user
if (discountResult.bestDiscount?.type === 'first_time') {
  await User.findByIdAndUpdate(userId, {
    hasUsedFirstTimeDiscount: true,
    firstTimeDiscountUsedAt: new Date(),
    firstTimeDiscountOrderId: order._id
  });
}

// 6. Add marketer attribution (if user was referred)
const user = await User.findById(userId);
// FIRST ORDER ONLY COMMISSION MODEL
if (user.referredBy && !user.hasPlacedFirstOrder) {
  const marketer = await Marketer.findById(user.referredBy);

  if (marketer && marketer.status === 'active') {
    const commission = Math.floor(subtotal * (marketer.commissionRate / 100));

    order.attributedToMarketer = marketer._id;
    order.marketerCommission = commission;
    order.isFirstOrderForUser = true;  // Flag for reporting

    // Update marketer stats
    await Marketer.findByIdAndUpdate(marketer._id, {
      $inc: {
        totalOrders: 1,
        totalRevenue: subtotal,
        totalCommission: commission,
        unpaidCommission: commission
      }
    });

    // Mark user as having placed first order (no more commissions)
    await User.findByIdAndUpdate(user._id, {
      hasPlacedFirstOrder: true
    });
  }
}
```

---

## Database Schema Requirements

### User Model Updates

**Add these fields to User schema:**
```javascript
{
  // Referral tracking
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Marketer',
    default: null
  },
  referralCode: {
    type: String,
    default: null
  },
  referralDate: {
    type: Date,
    default: null
  },

  // First order tracking (for marketer commission - FIRST ORDER ONLY)
  hasPlacedFirstOrder: {
    type: Boolean,
    default: false
  },

  // First-time discount tracking
  hasUsedFirstTimeDiscount: {
    type: Boolean,
    default: false
  },
  firstTimeDiscountUsedAt: {
    type: Date,
    default: null
  },
  firstTimeDiscountOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  }
}
```

**Indexes:**
```javascript
userSchema.index({ referredBy: 1 });
userSchema.index({ hasPlacedFirstOrder: 1 });
userSchema.index({ hasUsedFirstTimeDiscount: 1 });
```

---

### Order Model Updates

**Add these fields to Order schema:**
```javascript
{
  // Discount tracking
  discounts: [{
    type: {
      type: String,
      enum: ['first_time', 'coupon', 'marketer_promo']
    },
    code: String,
    amount: Number,        // in kobo
    description: String
  }],

  totalDiscount: {
    type: Number,
    default: 0             // in kobo
  },

  subtotalBeforeDiscount: {
    type: Number           // in kobo
  },

  // Coupon tracking
  couponUsed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
  },

  // Marketer attribution
  attributedToMarketer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Marketer',
    default: null
  },
  marketerCommission: {
    type: Number,
    default: 0             // in kobo
  },
  commissionPaid: {
    type: Boolean,
    default: false
  },
  commissionPaidAt: {
    type: Date,
    default: null
  }
}
```

**Indexes:**
```javascript
orderSchema.index({ attributedToMarketer: 1 });
orderSchema.index({ commissionPaid: 1 });
orderSchema.index({ couponUsed: 1 });
```

---

## Important Notes

### 1. Currency Format
**ALL amounts must be in KOBO, not Naira!**
- Frontend sends: 2000000 (₦20,000)
- Backend stores: 2000000
- Backend returns: 2000000
- Frontend displays: ₦20,000 (divide by 100)

### 2. Case Sensitivity
- All codes (marketingCode, couponCode) should be **case-insensitive** in queries
- Store them in **UPPERCASE** in database
- Convert to uppercase before querying

### 3. Commission Attribution (FIRST ORDER ONLY)
- **CRITICAL CHANGE:** Marketers get commission on **FIRST ORDER ONLY**
- No time window - applies to the very first order the customer ever places
- Check `user.hasPlacedFirstOrder` flag before attributing commission
- Set flag to `true` after first order is placed
- Subsequent orders from same customer generate NO commission
- More sustainable model and easier to track

### 4. Discount Stacking Rules
**NEVER allow stacking!**
- User can have first-time discount OR coupon, not both
- Always pick the better discount automatically

### 5. Commission Calculation
- Calculate commission on **subtotalBeforeDiscount** (the original amount)
- Even if user got a discount, marketer still gets commission on full amount

### 6. Soft Deletes
- Never hard-delete marketers or coupons
- Always use status field: "active" | "inactive" | "suspended" | "expired"

### 7. Security
- Validate all permissions on backend (don't trust frontend)
- Rate limit public endpoints (validate-referral-code)
- Sanitize all code inputs (prevent injection)

---

## Testing Checklist

### Signup Flow
- [ ] Valid referral code links user to marketer
- [ ] Invalid referral code is rejected
- [ ] Signup without referral code works normally
- [ ] Case-insensitive code matching works

### Discount Flow
- [ ] First-time discount applies correctly
- [ ] First-time discount capped at ₦2,000
- [ ] Minimum order ₦5,000 enforced
- [ ] Coupon validation works
- [ ] Better discount is auto-selected
- [ ] Cannot use same coupon twice

### Attribution Flow (FIRST ORDER ONLY)
- [ ] First order from referred user is attributed to marketer
- [ ] Second and subsequent orders are NOT attributed
- [ ] `hasPlacedFirstOrder` flag updates correctly
- [ ] Commission calculated correctly on first order only
- [ ] Marketer stats update properly

### Admin Flow
- [ ] Can create marketer with/without code
- [ ] Code uniqueness enforced
- [ ] Email uniqueness enforced
- [ ] Can list/filter/search marketers
- [ ] Permissions work correctly

---

## Error Codes Summary

```javascript
// Success
200 - OK
201 - Created

// Client Errors
400 - Bad Request (validation error, duplicate code, etc.)
401 - Unauthorized (no auth token)
403 - Forbidden (no permission)
404 - Not Found

// Server Errors
500 - Internal Server Error
```

---

**End of Specification**

For any questions or clarifications, please refer to the original [MARKETING_IMPLEMENTATION_SUMMARY.md](MARKETING_IMPLEMENTATION_SUMMARY.md) document.
