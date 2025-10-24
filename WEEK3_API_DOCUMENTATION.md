# Week 3: Payment Processing & Order Management API Documentation

## Overview
This document describes all the endpoints implemented for Week 3, covering payment integration (Paystack), order creation, order confirmation, and order history.

## Base URL
```
http://localhost:5000/api
```

---

## Table of Contents
1. [Order Creation & Management](#order-creation--management)
2. [Payment Processing (Paystack)](#payment-processing-paystack)
3. [Order History](#order-history)
4. [Email Notifications](#email-notifications)

---

## Order Creation & Management

### 1. Checkout Summary
**Endpoint:** `POST /api/orders/checkout`

**Description:** Calculate delivery fee and get checkout summary before creating an order.

**Authentication:** Optional (supports both authenticated and anonymous users)

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "08012345678",
  "address": "123 Main St, Lekki, Lagos",
  "origin": "6.5244,3.3792",  // Optional: warehouse coordinates
  "notes": "Please call before delivery"  // Optional
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [...],
      "totalItems": 5,
      "totalAmount": 45000
    },
    "customerInfo": {
      "name": "John Doe",
      "phone": "08012345678"
    },
    "delivery": {
      "address": "123 Main St, Lekki, Lagos",
      "distanceKm": 12.5,
      "durationSeconds": 1800,
      "distanceText": "12.5 km",
      "durationText": "30 mins",
      "fee": 1450
    },
    "notes": "Please call before delivery",
    "totals": {
      "subtotal": 45000,
      "deliveryFee": 1450,
      "grandTotal": 46450
    }
  }
}
```

**Delivery Fee Calculation:**
- Base fee: ₦2.00
- Per km: ₦1.00
- Minimum fee: ₦3.00
- Free delivery for orders ≥ ₦500.00

---

### 2. Create Order
**Endpoint:** `POST /api/orders/create`

**Description:** Create an order from the current cart.

**Authentication:** Required (JWT Token)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "deliveryInfo": {
    "address": "123 Main St, Lekki",
    "city": "Lagos",
    "state": "Lagos",
    "phoneNumber": "08012345678",
    "deliveryNotes": "Call on arrival"  // Optional
  },
  "paymentMethod": "paystack",  // Options: "wallet", "pay_later", "paystack"
  "deliveryFee": 1450
}
```

**Response (201 Created) - For Wallet/Pay Later:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "_id": "65f1234567890abcdef12345",
      "orderNumber": "FCP-2025-0000123",
      "user": {...},
      "items": [...],
      "subtotal": 45000,
      "deliveryFee": 1450,
      "totalAmount": 46450,
      "paymentMethod": "wallet",
      "paymentStatus": "paid",
      "orderStatus": "pending",
      "deliveryInfo": {...},
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Response (201 Created) - For Paystack:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {...},
    "payment": {
      "authorizationUrl": "https://checkout.paystack.com/xxx",
      "accessCode": "xxx",
      "reference": "PAY-1705315800000-ABCD1234"
    }
  }
}
```

**Order Creation Flow:**
1. Validates cart is not empty
2. Converts cart items to order items
3. Creates order in database
4. For **wallet** payment: Debits wallet immediately
5. For **pay_later**: Sets due date (7 days from now)
6. For **paystack**: Initializes payment and returns checkout URL
7. Clears the cart
8. Sends order confirmation email

---

### 3. Get User Orders
**Endpoint:** `GET /api/orders`

**Description:** Get all orders for the authenticated user with pagination.

**Authentication:** Required (JWT Token)

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Orders per page

**Example:**
```
GET /api/orders?page=1&limit=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "65f1234567890abcdef12345",
        "orderNumber": "FCP-2025-0000123",
        "items": [
          {
            "product": {
              "_id": "...",
              "name": "Fresh Tomatoes",
              "images": [...]
            },
            "productName": "Fresh Tomatoes",
            "quantity": 10,
            "unitPrice": 3000,
            "totalPrice": 30000
          }
        ],
        "subtotal": 45000,
        "deliveryFee": 1450,
        "totalAmount": 46450,
        "paymentMethod": "paystack",
        "paymentStatus": "paid",
        "orderStatus": "processing",
        "deliveryInfo": {...},
        "createdAt": "2025-01-15T10:30:00.000Z",
        "totalItems": 15
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalOrders": 28,
      "ordersPerPage": 10
    }
  }
}
```

**Order Status Values:**
- `pending` - Order created, awaiting processing
- `processing` - Payment confirmed, order being prepared
- `shipped` - Order dispatched for delivery
- `delivered` - Order delivered successfully
- `cancelled` - Order cancelled

**Payment Status Values:**
- `pending` - Payment not yet received (pay_later orders remain pending until fully paid)
- `paid` - Payment completed successfully
- `failed` - Payment attempt failed (Paystack declined, wallet insufficient funds)

**Note:** For pay_later orders with partial payments, the order remains in `pending` status. Track partial payments using `payLaterInfo.repaymentTransactions` array.

---

### 4. Get Order by ID
**Endpoint:** `GET /api/orders/:id`

**Description:** Get detailed information about a specific order.

**Authentication:** Required (JWT Token)

**Example:**
```
GET /api/orders/65f1234567890abcdef12345
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "65f1234567890abcdef12345",
      "orderNumber": "FCP-2025-0000123",
      "user": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "08012345678"
      },
      "items": [...],
      "subtotal": 45000,
      "deliveryFee": 1450,
      "totalAmount": 46450,
      "paymentMethod": "paystack",
      "paymentStatus": "paid",
      "orderStatus": "processing",
      "paymentReference": "PAY-1705315800000-ABCD1234",
      "deliveryInfo": {
        "address": "123 Main St, Lekki",
        "city": "Lagos",
        "state": "Lagos",
        "phoneNumber": "08012345678"
      },
      "statusHistory": [
        {
          "status": "pending",
          "timestamp": "2025-01-15T10:30:00.000Z",
          "note": "Order created"
        },
        {
          "status": "processing",
          "timestamp": "2025-01-15T10:35:00.000Z",
          "note": "Payment confirmed"
        }
      ],
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:35:00.000Z"
    }
  }
}
```

---

### 5. Get Order by Order Number
**Endpoint:** `GET /api/orders/number/:orderNumber`

**Description:** Get order details using the order number (e.g., FCP-2025-0000123).

**Authentication:** Required (JWT Token)

**Example:**
```
GET /api/orders/number/FCP-2025-0000123
```

**Response:** Same as "Get Order by ID"

---

### 6. Cancel Order
**Endpoint:** `POST /api/orders/:id/cancel`

**Description:** Cancel an order (only pending or confirmed orders).

**Authentication:** Required (JWT Token)

**Request Body:**
```json
{
  "reason": "Changed my mind"  // Optional
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": {
      "_id": "65f1234567890abcdef12345",
      "orderNumber": "FCP-2025-0000123",
      "orderStatus": "cancelled",
      "cancelledAt": "2025-01-15T11:00:00.000Z",
      ...
    }
  }
}
```

**Cancellation Flow:**
1. Validates order can be cancelled (only pending/confirmed orders)
2. Updates order status to "cancelled"
3. Restores product stock
4. Issues refund if payment was made via wallet

---

## Payment Processing (Paystack)

### 7. Paystack Webhook
**Endpoint:** `POST /api/orders/paystack/webhook`

**Description:** Webhook endpoint for Paystack to notify of payment events.

**Authentication:** None (verified by signature)

**Headers:**
```
x-paystack-signature: <hmac_signature>
```

**Webhook Payload (from Paystack):**
```json
{
  "event": "charge.success",
  "data": {
    "reference": "PAY-1705315800000-ABCD1234",
    "amount": 4645000,
    "status": "success",
    "metadata": {
      "orderId": "65f1234567890abcdef12345",
      "orderNumber": "FCP-2025-0000123",
      "customerId": "..."
    }
  }
}
```

**Webhook Flow:**
1. Verifies signature using PAYSTACK_SECRET_KEY
2. Finds order by payment reference
3. Updates order payment status to "paid"
4. Updates order status to "processing"
5. Sends payment success email to customer

**Webhook Configuration:**
- Set this webhook URL in your Paystack dashboard
- URL: `https://yourdomain.com/api/orders/paystack/webhook`

---

### 8. Verify Payment
**Endpoint:** `GET /api/orders/paystack/verify/:reference`

**Description:** Manually verify a payment with Paystack (useful for order success page).

**Authentication:** Required (JWT Token)

**Example:**
```
GET /api/orders/paystack/verify/PAY-1705315800000-ABCD1234
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "order": {...},
    "paymentData": {
      "reference": "PAY-1705315800000-ABCD1234",
      "amount": 4645000,
      "status": "success",
      "paid_at": "2025-01-15T10:35:00.000Z",
      "channel": "card",
      "currency": "NGN"
    }
  }
}
```

**Use Case:**
Call this endpoint on the order success page after Paystack redirects the user back to your frontend.

---

## Order History

Orders are retrieved with the following features:
- **Pagination**: Pages through large order lists
- **Sorting**: Most recent orders first
- **Populated Data**: Includes product details and user information
- **Status Tracking**: Full order and payment status history

---

## Email Notifications

Three types of emails are automatically sent:

### 1. Order Confirmation Email
**Sent when:** Order is created
**Contents:**
- Order number
- Order summary (items, quantities, prices)
- Subtotal, delivery fee, and total
- Delivery address
- Payment method

### 2. Payment Success Email
**Sent when:** Payment is confirmed (for Paystack)
**Contents:**
- Payment confirmation
- Amount paid
- Order number
- Payment method

### 3. Delivery Notification
**Future Implementation:** Sent when order status changes to "shipped"

---

## Environment Variables

Add these to your `.env` file:

```env
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
PAYSTACK_CALLBACK_URL=http://localhost:3000/order/success
FRONTEND_URL=http://localhost:3000

# Email Configuration (already configured)
EMAIL_HOST=mail.privateemail.com
EMAIL_PORT=465
EMAIL_USER=admin@farmchops.com
EMAIL_PASS=your_password
EMAIL_FROM="Farmchops" <admin@farmchops.com>
```

---

## Testing the Flow

### Test Scenario 1: Wallet Payment
```bash
# 1. Login and get token
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# 2. Add items to cart
POST /api/cart/add
{
  "productId": "...",
  "quantity": 5,
  "priceType": "retail"
}

# 3. Get checkout summary
POST /api/orders/checkout
{
  "name": "John Doe",
  "phone": "08012345678",
  "address": "123 Main St, Lekki, Lagos"
}

# 4. Create order with wallet payment
POST /api/orders/create
{
  "deliveryInfo": {...},
  "paymentMethod": "wallet",
  "deliveryFee": 1450
}

# 5. Check order details
GET /api/orders/{orderId}
```

### Test Scenario 2: Paystack Payment
```bash
# 1-3: Same as above

# 4. Create order with Paystack
POST /api/orders/create
{
  "deliveryInfo": {...},
  "paymentMethod": "paystack",
  "deliveryFee": 1450
}

# Response includes authorization URL:
{
  "success": true,
  "data": {
    "order": {...},
    "payment": {
      "authorizationUrl": "https://checkout.paystack.com/xxx",
      "reference": "PAY-1705315800000-ABCD1234"
    }
  }
}

# 5. Redirect user to authorizationUrl
# User completes payment on Paystack

# 6. After redirect back, verify payment
GET /api/orders/paystack/verify/PAY-1705315800000-ABCD1234

# 7. Display order success page with order details
```

### Test Scenario 3: Pay Later
```bash
# 1-3: Same as above

# 4. Create order with pay later
POST /api/orders/create
{
  "deliveryInfo": {...},
  "paymentMethod": "pay_later",
  "deliveryFee": 1450
}

# Order is created with:
# - paymentStatus: "pending"
# - payLaterInfo.dueDate: 7 days from now
# - payLaterInfo.amountDue: totalAmount
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

**Common Error Codes:**
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (accessing another user's order)
- `404` - Not Found (order doesn't exist)
- `500` - Server Error

---

## Payment Methods Comparison

| Feature | Wallet | Pay Later | Paystack |
|---------|--------|-----------|----------|
| Immediate Payment | ✓ | ✗ | ✓ |
| Requires Balance | ✓ | ✗ | ✗ |
| Card Payment | ✗ | ✗ | ✓ |
| Due Date | - | 7 days | - |
| Auto Stock Update | ✓ | ✓ | ✓ |
| Email Confirmation | ✓ | ✓ | ✓ |
| Payment Email | - | - | ✓ |

---

## Next Steps for Full Production

1. **Get Paystack API Keys:**
   - Sign up at https://paystack.com
   - Get your test and live keys
   - Update `.env` file

2. **Configure Webhook:**
   - Set webhook URL in Paystack dashboard
   - Test with Paystack test cards

3. **Frontend Integration:**
   - Redirect to Paystack checkout URL
   - Handle callback on success/failure
   - Verify payment on success page

4. **Testing:**
   - Use Paystack test cards for testing
   - Test card: `4084 0840 8408 4081`
   - CVV: `408`, Expiry: any future date
   - PIN: `0000`

---

## Support

For issues or questions:
- Check the console logs for detailed error messages
- Verify environment variables are set correctly
- Ensure Paystack keys are valid
- Test with Paystack test mode first

---

**Implementation Complete!** ✅

All Week 3 features are now implemented:
- ✓ Paystack payment integration
- ✓ Order creation and management
- ✓ Order confirmation emails
- ✓ Payment success notifications
- ✓ Order history with pagination
- ✓ Order details retrieval
- ✓ Order cancellation with refunds
