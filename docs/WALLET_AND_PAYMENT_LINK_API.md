# Wallet & Pay-for-Me API Documentation

This document provides comprehensive API documentation for the Wallet and Pay-for-Me (Payment Links) features.

---

## Table of Contents

1. [Wallet Feature](#wallet-feature)
   - [Get Wallet Balance](#1-get-wallet-balance)
   - [Get Transaction History](#2-get-transaction-history)
   - [Fund Wallet (Initialize)](#3-fund-wallet-initialize)
   - [Verify Wallet Funding](#4-verify-wallet-funding)
   - [Debit Wallet](#5-debit-wallet)

2. [Pay-for-Me Feature (Payment Links)](#pay-for-me-feature-payment-links)
   - [Create Payment Link](#1-create-payment-link)
   - [Get Payment Link Details (Public)](#2-get-payment-link-details-public)
   - [Pay via Payment Link](#3-pay-via-payment-link)
   - [Verify Payment Link Payment](#4-verify-payment-link-payment)
   - [Get My Payment Links](#5-get-my-payment-links)
   - [Cancel Payment Link](#6-cancel-payment-link)

3. [TypeScript Interfaces](#typescript-interfaces)

---

## Wallet Feature

Base URL: `/api/wallet`

All wallet endpoints require authentication via Bearer token.

### 1. Get Wallet Balance

Get the authenticated user's wallet balance.

**Endpoint:** `GET /api/wallet/balance`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 50000,
    "currency": "NGN",
    "user": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  }
}
```

---

### 2. Get Transaction History

Get the authenticated user's wallet transaction history with pagination and filtering.

**Endpoint:** `GET /api/wallet/transactions`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page |
| type | string | No | - | Filter by type: `credit`, `debit`, `refund` |
| status | string | No | - | Filter by status: `pending`, `completed`, `failed` |
| startDate | string | No | - | Filter from date (ISO format) |
| endDate | string | No | - | Filter to date (ISO format) |

**Example Request:**
```
GET /api/wallet/transactions?page=1&limit=10&type=credit
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j1",
        "type": "credit",
        "amount": 10000,
        "description": "Wallet funding via Paystack",
        "reference": "WLT-1234567890-ABCDE",
        "balanceBefore": 40000,
        "balanceAfter": 50000,
        "status": "completed",
        "order": null,
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j2",
        "type": "debit",
        "amount": 5000,
        "description": "Payment for order #FC-12345",
        "reference": "TXN-1234567890-FGHIJ",
        "balanceBefore": 45000,
        "balanceAfter": 40000,
        "status": "completed",
        "order": {
          "id": "64f1a2b3c4d5e6f7g8h9i0j3",
          "orderNumber": "FC-12345",
          "amount": 5000
        },
        "createdAt": "2024-01-14T15:45:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 45,
      "itemsPerPage": 10
    }
  }
}
```

---

### 3. Fund Wallet (Initialize)

Initialize wallet funding via Paystack. Returns a Paystack authorization URL.

**Endpoint:** `POST /api/wallet/fund`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 10000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Amount in Naira (minimum ₦100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "WLT-1234567890-ABCDE",
    "authorizationUrl": "https://checkout.paystack.com/abc123",
    "accessCode": "abc123xyz",
    "amount": 10000,
    "transactionId": "64f1a2b3c4d5e6f7g8h9i0j1"
  }
}
```

**Frontend Flow:**
1. Call this endpoint with the amount
2. Redirect user to `authorizationUrl`
3. After payment, Paystack redirects to callback URL
4. Call verify endpoint to confirm funding

---

### 4. Verify Wallet Funding

Verify a wallet funding transaction after Paystack payment.

**Endpoint:** `GET /api/wallet/verify/:reference`

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reference | string | Yes | Payment reference from fund endpoint |

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "amount": 10000,
    "reference": "WLT-1234567890-ABCDE",
    "newBalance": 50000
  }
}
```

**Response (Pending):**
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "reference": "WLT-1234567890-ABCDE",
    "message": "Payment is still being processed"
  }
}
```

**Response (Failed):**
```json
{
  "success": false,
  "message": "Payment verification failed",
  "data": {
    "status": "failed",
    "reference": "WLT-1234567890-ABCDE"
  }
}
```

---

### 5. Debit Wallet

Debit the user's wallet (typically used for order payment).

**Endpoint:** `POST /api/wallet/debit`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 5000,
  "orderId": "64f1a2b3c4d5e6f7g8h9i0j3",
  "description": "Payment for order #FC-12345"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Amount to debit |
| orderId | string | No | Associated order ID |
| description | string | No | Transaction description |

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "transactionId": "64f1a2b3c4d5e6f7g8h9i0j4",
    "reference": "TXN-1234567890-KLMNO",
    "amount": 5000,
    "newBalance": 45000
  }
}
```

**Response (Insufficient Balance):**
```json
{
  "success": false,
  "message": "Insufficient wallet balance",
  "data": {
    "currentBalance": 3000,
    "requiredAmount": 5000
  }
}
```

---

## Pay-for-Me Feature (Payment Links)

Base URL: `/api/payment-links`

This feature allows users to create shareable payment links that others can use to pay on their behalf.

### 1. Create Payment Link

Create a new payment link. Requires authentication.

**Endpoint:** `POST /api/payment-links/create`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 25000,
  "description": "Help me pay for my groceries order",
  "orderId": "64f1a2b3c4d5e6f7g8h9i0j5",
  "recipientName": "Mom",
  "recipientPhone": "+234801234567",
  "expiresInDays": 7
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| amount | number | Yes | - | Amount in Naira (minimum ₦100) |
| description | string | Yes | - | Description shown to payer |
| orderId | string | No | - | Link to specific order |
| recipientName | string | No | - | Name of intended payer |
| recipientPhone | string | No | - | Phone of intended payer |
| expiresInDays | number | No | 7 | Days until link expires |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j6",
    "code": "PAY-ABC12345",
    "amount": 25000,
    "description": "Help me pay for my groceries order",
    "recipientName": "Mom",
    "expiresAt": "2024-01-22T10:30:00.000Z",
    "status": "active",
    "shareableUrl": "https://farmchops.com/pay/PAY-ABC12345",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Get Payment Link Details (Public)

Get payment link details. This endpoint is public (no authentication required).

**Endpoint:** `GET /api/payment-links/:code`

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Payment link code (e.g., PAY-ABC12345) |

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "PAY-ABC12345",
    "amount": 25000,
    "description": "Help me pay for my groceries order",
    "recipientName": "Mom",
    "status": "active",
    "expiresAt": "2024-01-22T10:30:00.000Z",
    "isExpired": false,
    "isPaid": false,
    "createdBy": "John Doe",
    "order": {
      "orderNumber": "FC-12345",
      "itemCount": 5
    }
  }
}
```

**Status Values:**
- `active` - Link is available for payment
- `paid` - Link has been paid
- `expired` - Link has expired
- `cancelled` - Link was cancelled by creator

---

### 3. Pay via Payment Link

Initialize payment for a payment link. This endpoint is public.

**Endpoint:** `POST /api/payment-links/:code/pay`

**Headers:**
```
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Payment link code |

**Request Body:**
```json
{
  "payerName": "Jane Smith",
  "payerEmail": "jane@example.com",
  "payerPhone": "+234807654321"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| payerName | string | Yes | Name of the person paying |
| payerEmail | string | Yes | Email of the person paying |
| payerPhone | string | No | Phone of the person paying |

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "PL-PAY-ABC12345-1234567890",
    "authorizationUrl": "https://checkout.paystack.com/xyz789",
    "accessCode": "xyz789abc",
    "amount": 25000
  }
}
```

**Error Responses:**

Already Paid:
```json
{
  "success": false,
  "message": "This payment link has already been used"
}
```

Expired:
```json
{
  "success": false,
  "message": "This payment link has expired"
}
```

Cancelled:
```json
{
  "success": false,
  "message": "This payment link has been cancelled"
}
```

---

### 4. Verify Payment Link Payment

Verify payment after Paystack redirect.

**Endpoint:** `GET /api/payment-links/:code/verify`

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Payment link code |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reference | string | Yes | Payment reference from pay endpoint |

**Example Request:**
```
GET /api/payment-links/PAY-ABC12345/verify?reference=PL-PAY-ABC12345-1234567890
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "status": "paid",
    "paidAt": "2024-01-15T11:00:00.000Z",
    "amount": 25000,
    "message": "Payment successful! Thank you."
  }
}
```

**Response (Pending):**
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "message": "Payment is still being processed"
  }
}
```

---

### 5. Get My Payment Links

Get all payment links created by the authenticated user.

**Endpoint:** `GET /api/payment-links/user/my-links`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page |
| status | string | No | - | Filter: `active`, `paid`, `expired`, `cancelled` |

**Response:**
```json
{
  "success": true,
  "data": {
    "links": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j6",
        "code": "PAY-ABC12345",
        "amount": 25000,
        "description": "Help me pay for my groceries order",
        "recipientName": "Mom",
        "status": "paid",
        "expiresAt": "2024-01-22T10:30:00.000Z",
        "paidBy": {
          "name": "Jane Smith",
          "email": "jane@example.com",
          "phone": "+234807654321"
        },
        "paidAt": "2024-01-15T11:00:00.000Z",
        "shareableUrl": "https://farmchops.com/pay/PAY-ABC12345",
        "order": {
          "id": "64f1a2b3c4d5e6f7g8h9i0j5",
          "orderNumber": "FC-12345"
        },
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j7",
        "code": "PAY-XYZ67890",
        "amount": 15000,
        "description": "Birthday gift contribution",
        "recipientName": "Friends",
        "status": "active",
        "expiresAt": "2024-01-25T10:30:00.000Z",
        "paidBy": null,
        "paidAt": null,
        "shareableUrl": "https://farmchops.com/pay/PAY-XYZ67890",
        "order": null,
        "createdAt": "2024-01-18T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 15,
      "itemsPerPage": 20
    }
  }
}
```

---

### 6. Cancel Payment Link

Cancel an active payment link. Only the creator can cancel.

**Endpoint:** `PATCH /api/payment-links/:code/cancel`

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Payment link code |

**Response:**
```json
{
  "success": true,
  "message": "Payment link cancelled successfully",
  "data": {
    "code": "PAY-XYZ67890",
    "status": "cancelled"
  }
}
```

**Error Responses:**

Already Paid:
```json
{
  "success": false,
  "message": "Cannot cancel a paid payment link"
}
```

Not Found/Not Owner:
```json
{
  "success": false,
  "message": "Payment link not found or does not belong to you"
}
```

---

## TypeScript Interfaces

```typescript
// Wallet Types
interface WalletBalance {
  balance: number;
  currency: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'refund';
  amount: number;
  description: string;
  reference: string;
  balanceBefore: number;
  balanceAfter: number;
  status: 'pending' | 'completed' | 'failed';
  order: {
    id: string;
    orderNumber: string;
    amount: number;
  } | null;
  createdAt: string;
}

interface WalletFundingResponse {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amount: number;
  transactionId: string;
}

interface WalletVerifyResponse {
  status: 'completed' | 'pending' | 'failed';
  amount?: number;
  reference: string;
  newBalance?: number;
  message?: string;
}

// Payment Link Types
interface PaymentLink {
  id: string;
  code: string;
  amount: number;
  description: string;
  recipientName?: string;
  status: 'active' | 'paid' | 'expired' | 'cancelled';
  expiresAt: string;
  shareableUrl: string;
  createdAt: string;
}

interface PaymentLinkDetails {
  code: string;
  amount: number;
  description: string;
  recipientName?: string;
  status: 'active' | 'paid' | 'expired' | 'cancelled';
  expiresAt: string;
  isExpired: boolean;
  isPaid: boolean;
  createdBy: string;
  order: {
    orderNumber: string;
    itemCount: number;
  } | null;
}

interface PaymentLinkPayResponse {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amount: number;
}

interface MyPaymentLink {
  id: string;
  code: string;
  amount: number;
  description: string;
  recipientName?: string;
  status: 'active' | 'paid' | 'expired' | 'cancelled';
  expiresAt: string;
  paidBy: {
    name: string;
    email: string;
    phone?: string;
  } | null;
  paidAt: string | null;
  shareableUrl: string;
  order: {
    id: string;
    orderNumber: string;
  } | null;
  createdAt: string;
}

// Pagination
interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}
```

---

## Flow Diagrams

### Wallet Funding Flow

```
1. User requests to fund wallet
   POST /api/wallet/fund { amount: 10000 }

2. Backend creates pending transaction
   Returns: { authorizationUrl, reference }

3. Frontend redirects to authorizationUrl
   User completes Paystack payment

4. Paystack sends webhook to backend
   Backend credits wallet automatically

5. User redirected back to app
   Frontend calls: GET /api/wallet/verify/:reference
   Confirms balance updated
```

### Pay-for-Me Flow

```
1. User A creates payment link
   POST /api/payment-links/create { amount, description }
   Returns: { code, shareableUrl }

2. User A shares link with User B (friend/family)
   Link: https://farmchops.com/pay/PAY-ABC12345

3. User B opens link, sees payment details
   GET /api/payment-links/PAY-ABC12345

4. User B initiates payment
   POST /api/payment-links/PAY-ABC12345/pay { payerName, payerEmail }
   Returns: { authorizationUrl }

5. User B completes Paystack payment
   Redirected back to app

6. Webhook updates payment link status
   Credits User A's wallet with the amount

7. User B verifies payment
   GET /api/payment-links/PAY-ABC12345/verify?reference=...
```

---

## Error Codes

| HTTP Code | Description |
|-----------|-------------|
| 200 | Success |
| 201 | Created (new resource) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (not owner) |
| 404 | Not Found |
| 500 | Server Error |

All error responses follow this format:
```json
{
  "success": false,
  "message": "Error description here",
  "data": { } // Optional additional error data
}
```
