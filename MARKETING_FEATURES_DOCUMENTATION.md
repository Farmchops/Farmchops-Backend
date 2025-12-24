# Farmchops Marketing & Discount System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Business Rules](#business-rules)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration Guide](#frontend-integration-guide)
6. [Backend Implementation Guide](#backend-implementation-guide)
7. [Testing Scenarios](#testing-scenarios)

---

## Overview

This system adds four main features to Farmchops:
1. **First-time buyer discount** - Automatic discount for new customers
2. **Marketer management** - Admin can add marketing staff with unique codes
3. **Referral tracking** - Track which marketer brought each customer
4. **Coupon system** - Create and manage promotional discount codes
5. **Marketing reports** - View performance metrics and export data

---

## Business Rules

### First-Time Buyer Discount
- **Discount**: 10% off
- **Maximum discount**: ₦2,000 (even if 10% exceeds this)
- **Minimum order**: ₦5,000
- **Applies to**: First completed order only
- **Auto-applied**: Yes (no code needed)

### Marketer Commission
- **Commission rate**: 10% of order subtotal
- **Attribution**: First order only (one-time commission per referred customer)
- **Payment schedule**: Monthly
- **Reports**: Available anytime for any date range
- **Who qualifies**: First completed order from customers who signed up with marketer's code

### Coupon Codes
- **Usage limit**: 1 per user per coupon
- **Types supported**:
  - Percentage discount (e.g., 20% off)
  - Fixed amount (e.g., ₦1000 off)
  - Free delivery
- **Expiry**: Optional expiry date
- **Minimum order**: Optional minimum order value
- **Max redemptions**: Optional total usage limit

### Discount Stacking Rules
- **Cannot combine**: First-time discount + Coupon
- **System behavior**: Automatically picks the better discount
- **Example**: If first-time (10%) and coupon (20%), customer gets 20%

### Admin Roles
- **New role**: `marketer` (can view their own stats only)
- **Super admin**: Can manage all marketers and view all reports
- **Operations/Finance**: Can view reports and export data

---

## Database Schema

### 1. Marketer Model (`marketers` collection)

```typescript
{
  _id: ObjectId,
  firstName: String,              // Marketer's first name
  lastName: String,               // Marketer's last name
  email: String,                  // Contact email (unique)
  phone: String,                  // Contact phone
  marketingCode: String,          // Unique code (e.g., "JUDE2025") - uppercase, 6-12 chars
  status: String,                 // "active" | "inactive" | "suspended"
  commissionRate: Number,         // Default: 10 (percentage)

  // Stats (updated automatically)
  totalSignups: Number,           // Total users who used this code
  totalOrders: Number,            // Total orders from referred users
  totalRevenue: Number,           // Total sales in kobo
  totalCommission: Number,        // Total commission earned in kobo

  // Commission payment tracking
  lastPaidAt: Date,               // Last commission payment date
  lastPaidAmount: Number,         // Last payment amount in kobo
  unpaidCommission: Number,       // Commission not yet paid in kobo

  // Admin tracking
  createdBy: ObjectId,            // Admin who created this marketer
  createdAt: Date,
  updatedAt: Date,

  // Optional user account link
  userId: ObjectId                // If marketer also has a user account (optional)
}
```

**Indexes:**
- `marketingCode` (unique)
- `email` (unique)
- `status`
- `createdAt`

---

### 2. Coupon Model (`coupons` collection)

```typescript
{
  _id: ObjectId,
  code: String,                   // Coupon code (e.g., "SAVE20") - uppercase, 6-12 chars
  description: String,            // What this coupon is for

  // Discount configuration
  discountType: String,           // "percentage" | "fixed_amount" | "free_delivery"
  discountValue: Number,          // Percentage (e.g., 20) or amount in kobo (e.g., 100000 = ₦1000)
  maxDiscountAmount: Number,      // Max discount in kobo (for percentage types)

  // Usage rules
  minOrderAmount: Number,         // Minimum order in kobo (optional)
  maxUsesTotal: Number,           // Total times this code can be used (optional, null = unlimited)
  maxUsesPerUser: Number,         // Times per user (default: 1)
  currentUses: Number,            // Current total usage count (auto-incremented)

  // Validity
  validFrom: Date,                // Start date (optional)
  validUntil: Date,               // Expiry date (optional)
  status: String,                 // "active" | "inactive" | "expired"

  // Tracking
  createdBy: ObjectId,            // Admin who created this
  usedBy: [ObjectId],             // Array of user IDs who used this

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `code` (unique)
- `status`
- `validUntil`
- `usedBy` (multikey index)

---

### 3. User Model Updates

**Add these fields to existing User model:**

```typescript
{
  // ... existing fields ...

  // Referral tracking
  referredBy: ObjectId,           // Reference to Marketer who brought this user
  referralCode: String,           // The code they used during signup (for records)
  referralDate: Date,             // When they signed up with code

  // First-time discount tracking
  hasUsedFirstTimeDiscount: Boolean,  // Default: false
  firstTimeDiscountUsedAt: Date,      // When they used it
  firstTimeDiscountOrderId: ObjectId, // Which order used it
}
```

**New indexes:**
- `referredBy`
- `hasUsedFirstTimeDiscount`

---

### 4. Order Model Updates

**Add these fields to existing Order model:**

```typescript
{
  // ... existing fields ...

  // Discount tracking
  discounts: [{
    type: String,                 // "first_time" | "coupon" | "marketer_promo"
    code: String,                 // Coupon code or marketer code (if applicable)
    amount: Number,               // Discount amount in kobo
    description: String           // Human-readable description
  }],

  totalDiscount: Number,          // Sum of all discounts in kobo
  subtotalBeforeDiscount: Number, // Original subtotal before discounts

  // Coupon tracking
  couponUsed: ObjectId,           // Reference to Coupon (if used)

  // Marketer attribution
  attributedToMarketer: ObjectId, // Reference to Marketer (if user was referred)
  marketerCommission: Number,     // Commission amount for this order in kobo
  commissionEligible: Boolean,    // True if this was customer's first order (eligible for commission)
  commissionPaid: Boolean,        // Default: false
  commissionPaidAt: Date,         // When commission was paid
}
```

**New indexes:**
- `attributedToMarketer`
- `commissionPaid`
- `couponUsed`

---

### 5. Commission Payment Model (NEW - `commission_payments` collection)

```typescript
{
  _id: ObjectId,
  marketer: ObjectId,             // Reference to Marketer

  // Payment period
  periodStart: Date,              // Start of payment period
  periodEnd: Date,                // End of payment period

  // Payment details
  totalOrders: Number,            // Orders in this period
  totalRevenue: Number,           // Revenue in kobo
  commissionRate: Number,         // Commission percentage used
  commissionAmount: Number,       // Amount paid in kobo

  // Payment tracking
  status: String,                 // "pending" | "paid" | "cancelled"
  paidAt: Date,                   // When payment was made
  paidBy: ObjectId,               // Admin who processed payment
  paymentMethod: String,          // "bank_transfer" | "cash" | "wallet"
  paymentReference: String,       // Transaction reference

  // Order references
  orders: [ObjectId],             // All orders included in this payment

  notes: String,                  // Admin notes

  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `marketer`
- `periodStart`, `periodEnd`
- `status`

---

## API Endpoints

### Admin - Marketer Management

#### 1. Create Marketer
```
POST /api/admin/marketers
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer

Request Body:
{
  "firstName": "Jude",
  "lastName": "Okonkwo",
  "email": "jude@example.com",
  "phone": "08012345678",
  "marketingCode": "JUDE2025",        // Optional, auto-generated if not provided
  "commissionRate": 10                 // Optional, default: 10
}

Success Response (201):
{
  "success": true,
  "message": "Marketer created successfully",
  "data": {
    "marketer": {
      "_id": "...",
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
      "createdAt": "2025-01-15T10:00:00Z"
    }
  }
}

Error Responses:
400 - Marketing code already exists
400 - Email already exists
401 - Unauthorized
403 - Insufficient permissions
```

---

#### 2. Get All Marketers
```
GET /api/admin/marketers?status=active&page=1&limit=20
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer, finance

Query Parameters:
- status: "active" | "inactive" | "suspended" (optional)
- page: number (default: 1)
- limit: number (default: 20)
- search: string (search by name, email, or code)

Success Response (200):
{
  "success": true,
  "message": "Marketers retrieved successfully",
  "data": {
    "marketers": [...],
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

#### 3. Get Single Marketer
```
GET /api/admin/marketers/:marketerId
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer, finance

Success Response (200):
{
  "success": true,
  "message": "Marketer retrieved successfully",
  "data": {
    "marketer": {
      "_id": "...",
      "firstName": "Jude",
      "marketingCode": "JUDE2025",
      "totalSignups": 45,
      "totalOrders": 120,
      "totalRevenue": 5000000,        // ₦50,000 in kobo
      "totalCommission": 500000,      // ₦5,000 in kobo
      "unpaidCommission": 150000,     // ₦1,500 in kobo
      // ... other fields
    }
  }
}
```

---

#### 4. Update Marketer
```
PUT /api/admin/marketers/:marketerId
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer

Request Body:
{
  "firstName": "Jude",
  "lastName": "Okonkwo",
  "email": "newemail@example.com",
  "phone": "08087654321",
  "status": "inactive",              // "active" | "inactive" | "suspended"
  "commissionRate": 12
}

Success Response (200):
{
  "success": true,
  "message": "Marketer updated successfully",
  "data": {
    "marketer": { ... }
  }
}
```

---

#### 5. Delete/Deactivate Marketer
```
DELETE /api/admin/marketers/:marketerId
Authorization: Bearer {admin_token}
Roles: super_admin

Success Response (200):
{
  "success": true,
  "message": "Marketer deactivated successfully"
}

Note: This sets status to "inactive", doesn't delete the record
```

---

### Admin - Coupon Management

#### 6. Create Coupon
```
POST /api/admin/coupons
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer

Request Body:
{
  "code": "SAVE20",
  "description": "20% off for new year promo",
  "discountType": "percentage",           // "percentage" | "fixed_amount" | "free_delivery"
  "discountValue": 20,                    // 20% or amount in kobo
  "maxDiscountAmount": 500000,            // ₦5,000 max discount (optional, for percentage)
  "minOrderAmount": 1000000,              // ₦10,000 minimum order (optional)
  "maxUsesTotal": 100,                    // Only 100 people can use (optional)
  "maxUsesPerUser": 1,                    // Each user can use once (default: 1)
  "validFrom": "2025-01-01T00:00:00Z",   // Optional
  "validUntil": "2025-12-31T23:59:59Z"   // Optional
}

Success Response (201):
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "coupon": {
      "_id": "...",
      "code": "SAVE20",
      "discountType": "percentage",
      "discountValue": 20,
      "status": "active",
      "currentUses": 0,
      // ... other fields
    }
  }
}

Error Responses:
400 - Coupon code already exists
```

---

#### 7. Get All Coupons
```
GET /api/admin/coupons?status=active&page=1&limit=20
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer

Query Parameters:
- status: "active" | "inactive" | "expired" (optional)
- page: number (default: 1)
- limit: number (default: 20)

Success Response (200):
{
  "success": true,
  "data": {
    "coupons": [...],
    "pagination": { ... }
  }
}
```

---

#### 8. Update Coupon
```
PUT /api/admin/coupons/:couponId
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer

Request Body: (same as create, all fields optional)

Success Response (200):
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": { "coupon": { ... } }
}
```

---

#### 9. Delete Coupon
```
DELETE /api/admin/coupons/:couponId
Authorization: Bearer {admin_token}
Roles: super_admin

Success Response (200):
{
  "success": true,
  "message": "Coupon deleted successfully"
}
```

---

### Public/User Endpoints

#### 10. Validate Referral Code (during signup)
```
POST /api/auth/validate-referral-code
Authorization: None (public endpoint)

Request Body:
{
  "referralCode": "JUDE2025"
}

Success Response (200):
{
  "success": true,
  "message": "Valid referral code",
  "data": {
    "isValid": true,
    "marketerName": "Jude Okonkwo"
  }
}

Invalid Code Response (200):
{
  "success": true,
  "data": {
    "isValid": false,
    "message": "Invalid or inactive referral code"
  }
}
```

---

#### 11. Validate Coupon Code (before checkout)
```
POST /api/coupons/validate
Authorization: Bearer {user_token}

Request Body:
{
  "couponCode": "SAVE20",
  "orderAmount": 2000000      // ₦20,000 in kobo (subtotal before discount)
}

Success Response (200):
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
    "calculatedDiscount": 400000,     // ₦4,000 discount (20% of ₦20,000)
    "finalAmount": 1600000            // ₦16,000 after discount
  }
}

Invalid Response (200):
{
  "success": true,
  "data": {
    "isValid": false,
    "message": "Order amount below minimum requirement"
  }
}

Possible validation errors:
- Coupon not found or inactive
- Coupon expired
- Already used by this user
- Max total uses reached
- Order amount below minimum
```

---

#### 12. Calculate Order Discounts
```
POST /api/orders/calculate-discounts
Authorization: Bearer {user_token}

Request Body:
{
  "subtotal": 2000000,           // ₦20,000 in kobo
  "couponCode": "SAVE20"         // Optional
}

Success Response (200):
{
  "success": true,
  "data": {
    "subtotal": 2000000,
    "discounts": [
      {
        "type": "first_time",
        "description": "First-time buyer discount (10%)",
        "amount": 200000,        // ₦2,000 (capped at max)
        "applied": false         // Not applied (coupon is better)
      },
      {
        "type": "coupon",
        "code": "SAVE20",
        "description": "20% off",
        "amount": 400000,        // ₦4,000
        "applied": true          // This one is applied
      }
    ],
    "bestDiscount": {
      "type": "coupon",
      "amount": 400000
    },
    "totalDiscount": 400000,
    "finalSubtotal": 1600000
  }
}

Note: System automatically picks the best discount for the user
```

---

### Marketing Reports

#### 13. Get Marketer Performance Report
```
GET /api/admin/marketers/:marketerId/report?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer, finance

Query Parameters:
- startDate: ISO date string (required)
- endDate: ISO date string (required)

Success Response (200):
{
  "success": true,
  "data": {
    "marketer": {
      "_id": "...",
      "firstName": "Jude",
      "marketingCode": "JUDE2025"
    },
    "period": {
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-01-31T23:59:59Z"
    },
    "metrics": {
      "newSignups": 25,                    // Signups in this period
      "totalOrders": 80,                   // Orders in this period
      "totalRevenue": 10000000,            // ₦100,000 in kobo
      "totalCommission": 1000000,          // ₦10,000 in kobo
      "averageOrderValue": 125000,         // ₦1,250 average
      "conversionRate": 68,                // 68% (80 orders / 118 total referred users)
      "unpaidCommission": 500000           // ₦5,000 unpaid
    },
    "topProducts": [
      {
        "productName": "Tomatoes",
        "orderCount": 35,
        "revenue": 4500000
      }
    ],
    "recentOrders": [...]                  // Last 10 orders
  }
}
```

---

#### 14. Get All Marketers Summary Report
```
GET /api/admin/reports/marketers?startDate=2025-01-01&endDate=2025-01-31&sortBy=revenue
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer, finance

Query Parameters:
- startDate: ISO date string (required)
- endDate: ISO date string (required)
- sortBy: "revenue" | "orders" | "signups" | "commission" (default: "revenue")

Success Response (200):
{
  "success": true,
  "data": {
    "period": { ... },
    "summary": {
      "totalMarketers": 15,
      "activeMarketers": 12,
      "totalSignups": 450,
      "totalOrders": 1200,
      "totalRevenue": 50000000,         // ₦500,000
      "totalCommission": 5000000,       // ₦50,000
      "totalUnpaidCommission": 2000000  // ₦20,000
    },
    "marketers": [
      {
        "marketerId": "...",
        "name": "Jude Okonkwo",
        "code": "JUDE2025",
        "signups": 45,
        "orders": 120,
        "revenue": 15000000,
        "commission": 1500000,
        "unpaidCommission": 600000
      },
      // ... more marketers
    ]
  }
}
```

---

#### 15. Export Marketer Report (CSV)
```
GET /api/admin/marketers/:marketerId/report/export?startDate=2025-01-01&endDate=2025-01-31&format=csv
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer, finance

Query Parameters:
- startDate: ISO date string (required)
- endDate: ISO date string (required)
- format: "csv" | "excel" (default: "csv")

Success Response (200):
Content-Type: text/csv (or application/vnd.ms-excel)
Content-Disposition: attachment; filename="marketer_JUDE2025_2025-01-01_to_2025-01-31.csv"

CSV Format:
Order Number,Customer Name,Order Date,Order Total,Commission,Status,Payment Date
FCP-2025-0001234,Mary Johnson,2025-01-05,₦25000,₦2500,Paid,2025-02-01
FCP-2025-0001245,Peter Eze,2025-01-08,₦18000,₦1800,Unpaid,-
...
```

---

#### 16. Get Coupon Usage Report
```
GET /api/admin/coupons/:couponId/report
Authorization: Bearer {admin_token}
Roles: super_admin, operations_officer, finance

Success Response (200):
{
  "success": true,
  "data": {
    "coupon": {
      "code": "SAVE20",
      "discountType": "percentage",
      "discountValue": 20
    },
    "metrics": {
      "totalUses": 85,
      "totalDiscount": 12500000,        // ₦125,000 total discounts given
      "totalRevenue": 50000000,         // ₦500,000 total from orders using this coupon
      "averageDiscount": 147058,        // ₦1,471 average discount
      "uniqueUsers": 85
    },
    "recentUses": [...]                 // Last 10 uses
  }
}
```

---

#### 17. Record Commission Payment
```
POST /api/admin/marketers/:marketerId/pay-commission
Authorization: Bearer {admin_token}
Roles: super_admin, finance

Request Body:
{
  "periodStart": "2025-01-01T00:00:00Z",
  "periodEnd": "2025-01-31T23:59:59Z",
  "commissionAmount": 1000000,          // ₦10,000 in kobo
  "paymentMethod": "bank_transfer",     // "bank_transfer" | "cash" | "wallet"
  "paymentReference": "TRX123456",
  "notes": "January 2025 commission payment"
}

Success Response (201):
{
  "success": true,
  "message": "Commission payment recorded successfully",
  "data": {
    "payment": {
      "_id": "...",
      "marketer": "...",
      "commissionAmount": 1000000,
      "status": "paid",
      "paidAt": "2025-02-01T10:00:00Z",
      // ... other fields
    }
  }
}

Note: This updates marketer's unpaidCommission and lastPaidAt
```

---

## Frontend Integration Guide

### User Signup Flow (with referral code)

**Step 1: Email Verification Screen**
- Add optional field: "Referral Code (Optional)"
- As user types, validate in real-time:

```javascript
// Frontend validation call
const validateReferralCode = async (code) => {
  const response = await fetch('/api/auth/validate-referral-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referralCode: code })
  });
  const data = await response.json();

  if (data.data.isValid) {
    // Show success: "Referred by Jude Okonkwo ✓"
  } else {
    // Show error: "Invalid code"
  }
};
```

**Step 2: Submit Signup**
- Include referralCode in signup request:

```javascript
// Update existing signup endpoint
POST /api/auth/send-verification-email
{
  "email": "customer@example.com",
  "referralCode": "JUDE2025"    // Add this field
}
```

---

### Checkout Flow (with coupons and discounts)

**Step 1: Cart/Checkout Screen**

```javascript
// Calculate initial discount (first-time check is automatic)
const calculateDiscounts = async (subtotal, couponCode = null) => {
  const response = await fetch('/api/orders/calculate-discounts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subtotal: subtotal,          // In kobo
      couponCode: couponCode       // Optional
    })
  });

  const data = await response.json();
  return data.data;
};
```

**Step 2: Display Discounts**

```jsx
// Example React component
<div className="discount-section">
  <input
    type="text"
    placeholder="Enter coupon code"
    value={couponCode}
    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
  />
  <button onClick={handleApplyCoupon}>Apply</button>

  {discountData && (
    <div>
      {/* Show all available discounts */}
      {discountData.discounts.map(discount => (
        <div key={discount.type}>
          <span>{discount.description}</span>
          <span>-₦{(discount.amount / 100).toLocaleString()}</span>
          {discount.applied && <span>✓ Applied</span>}
        </div>
      ))}

      {/* Show best discount message */}
      <div className="best-discount">
        You're getting the best discount: ₦{(discountData.totalDiscount / 100).toLocaleString()} off!
      </div>
    </div>
  )}
</div>
```

**Step 3: Create Order**

```javascript
// Update order creation to include discount info
const createOrder = async (orderData) => {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: [...],
      deliveryInfo: {...},
      paymentMethod: 'wallet',
      couponCode: 'SAVE20'        // Add this if coupon was used
    })
  });

  return response.json();
};
```

---

### Admin Dashboard - Marketer Management

**Screen 1: Marketers List**

```jsx
// Fetch marketers
const fetchMarketers = async (filters = {}) => {
  const query = new URLSearchParams({
    status: filters.status || 'active',
    page: filters.page || 1,
    limit: 20,
    search: filters.search || ''
  });

  const response = await fetch(`/api/admin/marketers?${query}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  return response.json();
};

// Display table
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Code</th>
      <th>Signups</th>
      <th>Revenue</th>
      <th>Commission</th>
      <th>Unpaid</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {marketers.map(m => (
      <tr key={m._id}>
        <td>{m.firstName} {m.lastName}</td>
        <td>{m.marketingCode}</td>
        <td>{m.totalSignups}</td>
        <td>₦{(m.totalRevenue / 100).toLocaleString()}</td>
        <td>₦{(m.totalCommission / 100).toLocaleString()}</td>
        <td>₦{(m.unpaidCommission / 100).toLocaleString()}</td>
        <td>
          <button onClick={() => viewDetails(m._id)}>View</button>
          <button onClick={() => editMarketer(m._id)}>Edit</button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Screen 2: Create Marketer Form**

```jsx
const CreateMarketerForm = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    marketingCode: '',           // Optional, auto-generated if empty
    commissionRate: 10,
    attributionWindowDays: 60
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch('/api/admin/marketers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (data.success) {
      alert(`Marketer created! Code: ${data.data.marketer.marketingCode}`);
      // Navigate to marketers list
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="firstName" required placeholder="First Name" />
      <input name="lastName" required placeholder="Last Name" />
      <input name="email" type="email" required placeholder="Email" />
      <input name="phone" required placeholder="Phone" />
      <input name="marketingCode" placeholder="Code (auto-generated if empty)" />
      <input name="commissionRate" type="number" placeholder="Commission %" />
      <button type="submit">Create Marketer</button>
    </form>
  );
};
```

**Screen 3: Marketer Details & Reports**

```jsx
const MarketerDetails = ({ marketerId }) => {
  const [report, setReport] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '2025-01-01',
    endDate: '2025-01-31'
  });

  const fetchReport = async () => {
    const response = await fetch(
      `/api/admin/marketers/${marketerId}/report?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
      { headers: { 'Authorization': `Bearer ${adminToken}` } }
    );

    const data = await response.json();
    setReport(data.data);
  };

  const exportReport = () => {
    window.location.href = `/api/admin/marketers/${marketerId}/report/export?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&format=csv`;
  };

  return (
    <div>
      <h2>{report?.marketer.firstName} - Performance Report</h2>

      {/* Date Range Picker */}
      <div>
        <input
          type="date"
          value={dateRange.startDate}
          onChange={e => setDateRange({...dateRange, startDate: e.target.value})}
        />
        <input
          type="date"
          value={dateRange.endDate}
          onChange={e => setDateRange({...dateRange, endDate: e.target.value})}
        />
        <button onClick={fetchReport}>Generate Report</button>
        <button onClick={exportReport}>Export CSV</button>
      </div>

      {/* Metrics Dashboard */}
      {report && (
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>New Signups</h3>
            <p>{report.metrics.newSignups}</p>
          </div>
          <div className="metric-card">
            <h3>Total Orders</h3>
            <p>{report.metrics.totalOrders}</p>
          </div>
          <div className="metric-card">
            <h3>Revenue</h3>
            <p>₦{(report.metrics.totalRevenue / 100).toLocaleString()}</p>
          </div>
          <div className="metric-card">
            <h3>Commission</h3>
            <p>₦{(report.metrics.totalCommission / 100).toLocaleString()}</p>
          </div>
          <div className="metric-card">
            <h3>Unpaid Commission</h3>
            <p>₦{(report.metrics.unpaidCommission / 100).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Recent Orders Table */}
      {/* ... */}
    </div>
  );
};
```

**Screen 4: Pay Commission**

```jsx
const PayCommissionModal = ({ marketer }) => {
  const [paymentData, setPaymentData] = useState({
    periodStart: '2025-01-01',
    periodEnd: '2025-01-31',
    commissionAmount: marketer.unpaidCommission,
    paymentMethod: 'bank_transfer',
    paymentReference: '',
    notes: ''
  });

  const handleSubmit = async () => {
    const response = await fetch(`/api/admin/marketers/${marketer._id}/pay-commission`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();

    if (data.success) {
      alert('Commission payment recorded!');
      // Refresh marketer data
    }
  };

  return (
    <div className="modal">
      <h3>Pay Commission - {marketer.firstName}</h3>
      <p>Unpaid: ₦{(marketer.unpaidCommission / 100).toLocaleString()}</p>

      <form>
        <label>Period Start</label>
        <input type="date" value={paymentData.periodStart} />

        <label>Period End</label>
        <input type="date" value={paymentData.periodEnd} />

        <label>Amount (₦)</label>
        <input
          type="number"
          value={paymentData.commissionAmount / 100}
          onChange={e => setPaymentData({
            ...paymentData,
            commissionAmount: e.target.value * 100
          })}
        />

        <label>Payment Method</label>
        <select value={paymentData.paymentMethod}>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cash">Cash</option>
          <option value="wallet">Wallet</option>
        </select>

        <label>Payment Reference</label>
        <input placeholder="e.g., TRX123456" />

        <label>Notes</label>
        <textarea placeholder="January 2025 commission" />

        <button type="button" onClick={handleSubmit}>Record Payment</button>
      </form>
    </div>
  );
};
```

---

### Admin Dashboard - Coupon Management

**Screen 1: Coupons List**

```jsx
const CouponsList = () => {
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    fetch('/api/admin/coupons', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    })
    .then(res => res.json())
    .then(data => setCoupons(data.data.coupons));
  }, []);

  return (
    <div>
      <button onClick={() => openCreateModal()}>Create Coupon</button>

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Value</th>
            <th>Uses</th>
            <th>Valid Until</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map(c => (
            <tr key={c._id}>
              <td>{c.code}</td>
              <td>{c.discountType}</td>
              <td>
                {c.discountType === 'percentage'
                  ? `${c.discountValue}%`
                  : `₦${c.discountValue / 100}`
                }
              </td>
              <td>{c.currentUses} / {c.maxUsesTotal || '∞'}</td>
              <td>{c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'No expiry'}</td>
              <td>{c.status}</td>
              <td>
                <button onClick={() => editCoupon(c._id)}>Edit</button>
                <button onClick={() => viewReport(c._id)}>Report</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Screen 2: Create Coupon Form**

```jsx
const CreateCouponForm = () => {
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: null,
    minOrderAmount: null,
    maxUsesTotal: null,
    maxUsesPerUser: 1,
    validFrom: null,
    validUntil: null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...formData,
        code: formData.code.toUpperCase()
      })
    });

    const data = await response.json();
    if (data.success) {
      alert('Coupon created successfully!');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="code"
        required
        placeholder="Coupon Code (e.g., SAVE20)"
        style={{textTransform: 'uppercase'}}
      />

      <textarea name="description" placeholder="Description" />

      <select name="discountType">
        <option value="percentage">Percentage Discount</option>
        <option value="fixed_amount">Fixed Amount</option>
        <option value="free_delivery">Free Delivery</option>
      </select>

      <input
        name="discountValue"
        type="number"
        required
        placeholder={formData.discountType === 'percentage' ? 'Percentage (e.g., 20)' : 'Amount in Naira'}
      />

      {formData.discountType === 'percentage' && (
        <input
          name="maxDiscountAmount"
          type="number"
          placeholder="Max discount in Naira (optional)"
        />
      )}

      <input
        name="minOrderAmount"
        type="number"
        placeholder="Minimum order in Naira (optional)"
      />

      <input
        name="maxUsesTotal"
        type="number"
        placeholder="Total uses limit (optional)"
      />

      <input
        name="maxUsesPerUser"
        type="number"
        placeholder="Uses per user (default: 1)"
      />

      <label>Valid From (optional)</label>
      <input name="validFrom" type="datetime-local" />

      <label>Valid Until (optional)</label>
      <input name="validUntil" type="datetime-local" />

      <button type="submit">Create Coupon</button>
    </form>
  );
};
```

---

## Backend Implementation Guide

### Implementation Order

1. **Create Models** (in order):
   - Marketer model
   - Coupon model
   - Update User model
   - Update Order model
   - Commission Payment model

2. **Create Services**:
   - Discount calculation service
   - Coupon validation service
   - Marketing analytics service
   - CSV export service

3. **Update Existing Endpoints**:
   - Auth signup (add referral code)
   - Order creation (add discount calculation)

4. **Create New Endpoints**:
   - Marketer management (CRUD)
   - Coupon management (CRUD)
   - Reports and analytics
   - Commission payments

5. **Add Middleware**:
   - Validate admin roles for marketing routes
   - Rate limiting for public validation endpoints

---

### Key Business Logic

#### Discount Calculation Service

```typescript
// src/services/discountService.ts

interface DiscountCalculation {
  type: 'first_time' | 'coupon' | 'marketer_promo';
  code?: string;
  description: string;
  amount: number;
  applied: boolean;
}

export const calculateOrderDiscounts = async (
  userId: ObjectId,
  subtotal: number,
  couponCode?: string
): Promise<{
  discounts: DiscountCalculation[];
  bestDiscount: DiscountCalculation;
  totalDiscount: number;
  finalSubtotal: number;
}> => {
  const discounts: DiscountCalculation[] = [];

  // 1. Check first-time discount eligibility
  const user = await User.findById(userId);
  const hasCompletedOrder = await Order.findOne({
    user: userId,
    orderStatus: { $in: ['delivered', 'completed'] }
  });

  if (!hasCompletedOrder && !user.hasUsedFirstTimeDiscount && subtotal >= 500000) {
    // ₦5,000 minimum
    const discount = Math.min(
      Math.floor(subtotal * 0.10),  // 10%
      200000                          // Max ₦2,000
    );

    discounts.push({
      type: 'first_time',
      description: 'First-time buyer discount (10%)',
      amount: discount,
      applied: false  // Will be set later
    });
  }

  // 2. Check coupon if provided
  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      status: 'active'
    });

    if (coupon) {
      const validation = await validateCoupon(coupon, userId, subtotal);

      if (validation.isValid) {
        let discount = 0;

        if (coupon.discountType === 'percentage') {
          discount = Math.floor(subtotal * (coupon.discountValue / 100));
          if (coupon.maxDiscountAmount) {
            discount = Math.min(discount, coupon.maxDiscountAmount);
          }
        } else if (coupon.discountType === 'fixed_amount') {
          discount = coupon.discountValue;
        }

        discounts.push({
          type: 'coupon',
          code: coupon.code,
          description: `${coupon.description}`,
          amount: discount,
          applied: false
        });
      }
    }
  }

  // 3. Determine best discount (no stacking)
  let bestDiscount = discounts.reduce((best, current) =>
    current.amount > best.amount ? current : best
  , discounts[0]);

  if (bestDiscount) {
    bestDiscount.applied = true;
  }

  return {
    discounts,
    bestDiscount,
    totalDiscount: bestDiscount?.amount || 0,
    finalSubtotal: subtotal - (bestDiscount?.amount || 0)
  };
};
```

---

#### Coupon Validation

```typescript
// src/services/couponService.ts

export const validateCoupon = async (
  coupon: ICoupon,
  userId: ObjectId,
  orderAmount: number
): Promise<{ isValid: boolean; message?: string }> => {

  // 1. Check status
  if (coupon.status !== 'active') {
    return { isValid: false, message: 'Coupon is not active' };
  }

  // 2. Check dates
  if (coupon.validFrom && new Date() < coupon.validFrom) {
    return { isValid: false, message: 'Coupon is not yet valid' };
  }

  if (coupon.validUntil && new Date() > coupon.validUntil) {
    // Auto-expire
    coupon.status = 'expired';
    await coupon.save();
    return { isValid: false, message: 'Coupon has expired' };
  }

  // 3. Check minimum order
  if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
    return {
      isValid: false,
      message: `Order must be at least ₦${coupon.minOrderAmount / 100}`
    };
  }

  // 4. Check total uses
  if (coupon.maxUsesTotal && coupon.currentUses >= coupon.maxUsesTotal) {
    return { isValid: false, message: 'Coupon usage limit reached' };
  }

  // 5. Check per-user limit
  if (coupon.usedBy && coupon.usedBy.includes(userId)) {
    const userUses = coupon.usedBy.filter(id => id.equals(userId)).length;
    if (userUses >= coupon.maxUsesPerUser) {
      return { isValid: false, message: 'You have already used this coupon' };
    }
  }

  return { isValid: true };
};
```

---

#### Order Creation with Discounts

```typescript
// Update src/controllers/orderController.ts

export const createOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, deliveryInfo, paymentMethod, couponCode } = req.body;
    const userId = (req as any).user._id;

    // 1. Calculate subtotal (existing logic)
    let subtotal = 0;
    // ... calculate subtotal from items ...

    // 2. Calculate discounts
    const discountCalculation = await calculateOrderDiscounts(
      userId,
      subtotal,
      couponCode
    );

    // 3. Create order with discount info
    const order = await Order.createIndividualOrder({
      userId,
      items,
      deliveryInfo,
      paymentMethod,
      subtotalBeforeDiscount: subtotal,
      discounts: discountCalculation.discounts.filter(d => d.applied),
      totalDiscount: discountCalculation.totalDiscount,
      subtotal: discountCalculation.finalSubtotal,  // Discounted subtotal
      couponCode: discountCalculation.bestDiscount?.code
    }, session);

    // 4. If coupon was used, update coupon
    if (couponCode && discountCalculation.bestDiscount?.type === 'coupon') {
      await Coupon.findOneAndUpdate(
        { code: couponCode.toUpperCase() },
        {
          $inc: { currentUses: 1 },
          $push: { usedBy: userId }
        },
        { session }
      );
    }

    // 5. If first-time discount was used, mark user
    if (discountCalculation.bestDiscount?.type === 'first_time') {
      await User.findByIdAndUpdate(
        userId,
        {
          hasUsedFirstTimeDiscount: true,
          firstTimeDiscountUsedAt: new Date(),
          firstTimeDiscountOrderId: order._id
        },
        { session }
      );
    }

    // 6. Add marketer attribution (FIRST ORDER ONLY)
    const user = await User.findById(userId);
    if (user.referredBy) {
      // Check if this is the user's first completed/delivered order
      const previousOrders = await Order.countDocuments({
        user: userId,
        orderStatus: { $in: ['delivered', 'completed'] }
      });

      const isFirstOrder = previousOrders === 0;

      if (isFirstOrder) {
        const marketer = await Marketer.findById(user.referredBy);
        if (marketer && marketer.status === 'active') {
          const commission = Math.floor(subtotal * (marketer.commissionRate / 100));

          order.attributedToMarketer = marketer._id;
          order.marketerCommission = commission;
          order.commissionEligible = true;

          // Update marketer stats
          await Marketer.findByIdAndUpdate(
            marketer._id,
            {
              $inc: {
                totalOrders: 1,
                totalRevenue: subtotal,
                totalCommission: commission,
                unpaidCommission: commission
              }
            },
            { session }
          );
        }
      } else {
        // Not first order, no commission
        order.commissionEligible = false;
      }
    }

    await order.save({ session });
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
```

---

## Testing Scenarios

### Test Case 1: First-Time Discount

**Scenario**: New user places first order

```
User: john@example.com (no previous orders)
Cart subtotal: ₦15,000 (1,500,000 kobo)
Expected discount: 10% = ₦1,500 (150,000 kobo)
Final subtotal: ₦13,500
```

**Steps**:
1. Create new user
2. Add items to cart (₦15,000 total)
3. Proceed to checkout
4. System auto-applies 10% discount
5. Verify order shows discount
6. Verify user.hasUsedFirstTimeDiscount = true

---

### Test Case 2: First-Time Discount (Capped)

**Scenario**: New user with large order

```
User: mary@example.com (no previous orders)
Cart subtotal: ₦50,000 (5,000,000 kobo)
Calculated discount: 10% = ₦5,000
Max discount cap: ₦2,000
Expected discount: ₦2,000 (200,000 kobo)
Final subtotal: ₦48,000
```

---

### Test Case 3: Coupon Beats First-Time Discount

**Scenario**: New user with better coupon

```
User: peter@example.com (no previous orders, eligible for 10%)
Cart subtotal: ₦20,000
Coupon: SAVE20 (20% off)

Available discounts:
- First-time: 10% = ₦2,000
- Coupon SAVE20: 20% = ₦4,000

Expected: System picks SAVE20 (better)
Final subtotal: ₦16,000
User still eligible for first-time discount on next order
```

---

### Test Case 4: Referral Tracking

**Scenario**: User signs up with marketer code

```
Marketer: Jude (code: JUDE2025, commission: 10%)
New user: sarah@example.com signs up with JUDE2025

Day 1: Sarah places FIRST order = ₦10,000
  - Jude gets ₦1,000 commission ✓
  - Order marked: commissionEligible = true

Day 5: Sarah places SECOND order = ₦15,000
  - Jude gets NOTHING (only first order counts) ✗
  - Order marked: commissionEligible = false

Day 30: Sarah places THIRD order = ₦20,000
  - Jude gets NOTHING ✗

Jude's total commission from Sarah: ₦1,000 (first order only)
```

---

### Test Case 5: Coupon Usage Limits

**Scenario**: Coupon with limits

```
Coupon: NEWYEAR (20% off)
- maxUsesTotal: 100
- maxUsesPerUser: 1
- currentUses: 99

User A (first time using): ✓ Can use (currentUses → 100)
User A (second attempt): ✗ Already used
User B (trying to use): ✗ Max uses reached (100/100)
```

---

### Test Case 6: Commission Payment

**Scenario**: Monthly commission payout

```
Period: January 2025
Marketer: Jude

Orders attributed to Jude in January:
- Order 1: ₦10,000 → ₦1,000 commission
- Order 2: ₦15,000 → ₦1,500 commission
- Order 3: ₦25,000 → ₦2,500 commission

Total: ₦5,000 commission

Admin records payment:
- Amount: ₦5,000
- Method: Bank transfer
- Reference: TRX123456

System updates:
- Jude.unpaidCommission: ₦5,000 → ₦0
- Jude.lastPaidAmount: ₦5,000
- Jude.lastPaidAt: 2025-02-01
- All orders marked: commissionPaid = true
```

---

## Error Handling

### Common Error Scenarios

1. **Invalid referral code during signup**
   - Return 200 with `isValid: false`
   - Don't block signup, just don't attribute to marketer

2. **Invalid coupon at checkout**
   - Return 200 with `isValid: false` and reason
   - Let user proceed without coupon

3. **Coupon expired mid-checkout**
   - Auto-update status to 'expired'
   - Return validation error
   - Recalculate without coupon

4. **Race condition on coupon usage**
   - Use atomic operations: `$inc` for currentUses
   - Check availability in transaction

5. **Marketer deleted but users still attributed**
   - Soft delete marketers (status: 'inactive')
   - Keep attribution for historical records

---

## Performance Considerations

1. **Indexes**: All mentioned indexes must be created
2. **Caching**: Cache active coupons (Redis)
3. **Batch updates**: Update marketer stats in background job
4. **Report generation**: Use aggregation pipeline, consider caching
5. **CSV export**: Stream large datasets, don't load all in memory

---

## Security Notes

1. **Rate limiting**:
   - Validate coupon endpoint: 10 req/min per IP
   - Validate referral code: 20 req/min per IP

2. **Code generation**:
   - Ensure uniqueness check before creating
   - Use uppercase only for consistency

3. **Permission checks**:
   - Only super_admin can delete marketers/coupons
   - Finance/operations can view reports only
   - Marketers can only view their own stats (future feature)

4. **Input validation**:
   - Sanitize all codes (uppercase, alphanumeric only)
   - Validate all amounts are positive integers
   - Validate dates are in correct format

---

## Future Enhancements (Not in v1)

1. Multiple coupons stacking with rules
2. Marketer self-service portal
3. Automated commission payouts via wallet
4. Tiered commission rates (more sales = higher %)
5. Referral bonuses for users (not just marketers)
6. Product-specific coupons
7. Category-specific discounts
8. Time-based flash sales
9. Email notifications for marketers
10. Real-time dashboard analytics

---

## Changelog

**Version 1.0** - Initial implementation
- First-time buyer discount (10%, max ₦2,000)
- Marketer management and tracking
- Coupon system
- Commission tracking and payment
- Reports and CSV export
