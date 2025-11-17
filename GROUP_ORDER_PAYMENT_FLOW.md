# Group Order Payment Flow - UPDATED

## Overview
The group order payment flow has been updated to match the regular checkout flow. Users can now join groups by initializing payment first, then Paystack processes the payment, and upon success, the user is automatically added to the group.

---

## 🔄 Complete Flow

### 1. User Joins a Group

**Endpoint**: `POST /api/group-orders/:groupId/join`

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "deliveryInfo": {
    "address": "123 Main Street, Lagos, Nigeria",
    "city": "Lagos",
    "state": "Lagos",
    "phoneNumber": "09011709403"
  },
  "paymentMethod": "paystack",
  "deliveryFee": 0
}
```

**Response** (Payment Initialized):
```json
{
  "success": true,
  "message": "Payment initialized. Complete payment to join group.",
  "data": {
    "groupId": "GRP-4SR5K4",
    "product": {
      "_id": "...",
      "name": "Rice",
      "images": [...]
    },
    "totalSlots": 10,
    "filledSlots": 5,
    "pricePerSlot": 5000,
    "deliveryFee": 0,
    "totalAmount": 5000,
    "payment": {
      "authorizationUrl": "https://checkout.paystack.com/...",
      "accessCode": "...",
      "reference": "grp-abc123..."
    }
  }
}
```

### 2. Frontend Redirects User to Paystack

The frontend opens `payment.authorizationUrl` in a new window or redirects the user to complete payment.

### 3. User Completes Payment on Paystack

User enters card details and completes payment on Paystack's secure checkout page.

### 4. Paystack Sends Webhook to Backend

**Endpoint**: `POST /api/group-orders/webhook/paystack`

**Headers** (sent by Paystack):
```
x-paystack-signature: <signature>
Content-Type: application/json
```

**Webhook Payload**:
```json
{
  "event": "charge.success",
  "data": {
    "reference": "grp-abc123...",
    "amount": 500000,
    "metadata": {
      "groupId": "GRP-4SR5K4",
      "userId": "user_id_here",
      "deliveryInfo": "{\"address\":\"...\",\"city\":\"...\"}",
      "deliveryFee": "0"
    }
  }
}
```

**Backend Action**:
- Verifies webhook signature
- Extracts metadata (groupId, userId, deliveryInfo)
- Calls `GroupOrderService.joinGroup()` to add user to the group
- If group becomes full, auto-confirms and creates orders for all participants

### 5. Frontend Verifies Payment (Optional)

After user returns from Paystack, frontend can verify payment status:

**Endpoint**: `GET /api/group-orders/verify-payment/:reference`

**Headers**:
```
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "message": "Payment verified and you have joined the group",
  "data": {
    "groupId": "GRP-4SR5K4",
    "filledSlots": 6,
    "totalSlots": 10,
    "status": "active",
    "participant": {
      "amount": 5000,
      "quantity": 2,
      "joinedAt": "2025-11-17T..."
    }
  }
}
```

---

## 📋 All Group Order Endpoints

### Public Endpoints

#### Get Active Groups
```
GET /api/group-orders/active
GET /api/group-orders/active?productId=<productId>
```

#### Get Group Details
```
GET /api/group-orders/:groupId
```

### Protected Endpoints (Require Authentication)

#### Join Group (Initialize Payment)
```
POST /api/group-orders/:groupId/join
```

#### Leave Group
```
POST /api/group-orders/:groupId/leave
```

#### Get My Groups
```
GET /api/users/me/group-orders
```

#### Verify Payment
```
GET /api/group-orders/verify-payment/:reference
```

### Webhook Endpoint (NO Authentication)

#### Paystack Webhook
```
POST /api/group-orders/webhook/paystack
```

---

## 🎯 Key Changes from Previous Implementation

### Before ❌
1. Frontend had to handle Paystack initialization
2. `paymentReference` was required in join request
3. User was added to group immediately (without payment)
4. Payment verification was manual

### After ✅
1. **Backend handles Paystack initialization**
2. **No `paymentReference` required** in join request
3. **User added to group AFTER payment confirmation** (via webhook)
4. **Automatic payment verification** via webhook
5. **Matches regular checkout flow** exactly

---

## 🔐 Payment Security

1. **Webhook Signature Verification**: All webhook requests verify the `x-paystack-signature` header
2. **Transaction Verification**: Backend verifies transaction with Paystack before accepting payment
3. **Race Condition Handling**: Mongoose transactions prevent duplicate joins
4. **User Authentication**: All user-facing endpoints require valid JWT token

---

## 🚨 Error Handling

### Common Errors

| Error Code | HTTP Status | Message |
|-----------|-------------|---------|
| `GROUP_NOT_AVAILABLE` | 404 | Group not found or already full |
| `ALREADY_JOINED` | 400 | You have already joined this group |
| `GROUP_FULL` | 400 | Group is already full |
| Payment initialization failed | 500 | Payment initialization failed |

---

## 📝 Frontend Integration Example

```javascript
// 1. Call join group endpoint
const joinGroupResponse = await fetch(`/api/group-orders/${groupId}/join`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deliveryInfo: {
      address: formData.address,
      city: formData.city,
      state: formData.state,
      phoneNumber: formData.phone
    },
    paymentMethod: 'paystack',
    deliveryFee: 0
  })
});

const data = await joinGroupResponse.json();

if (data.success && data.data.payment) {
  // 2. Redirect to Paystack
  window.location.href = data.data.payment.authorizationUrl;

  // Or open in popup
  // window.open(data.data.payment.authorizationUrl, '_blank');

  // 3. After user returns, verify payment
  const verifyResponse = await fetch(`/api/group-orders/verify-payment/${data.data.payment.reference}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const verifyData = await verifyResponse.json();

  if (verifyData.success) {
    alert('Successfully joined the group!');
    // Redirect to group page or show success message
  }
}
```

---

## 🔧 Paystack Configuration

Make sure your `.env` file has:

```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
```

And configure webhook URL in Paystack Dashboard:
```
https://your-backend-url.com/api/group-orders/webhook/paystack
```

---

## ✅ Testing Checklist

- [ ] User can join a group and get payment URL
- [ ] Payment redirects to Paystack
- [ ] Webhook receives payment confirmation
- [ ] User is added to group after payment
- [ ] Group auto-confirms when full
- [ ] Orders are created for all participants when group is full
- [ ] Payment verification endpoint works
- [ ] Duplicate join attempts are prevented
- [ ] Full groups reject new joins

---

## 🐛 Debugging

### Check if webhook is being called:
```bash
# View backend logs
tail -f /path/to/backend.log | grep "webhook"
```

### Test webhook locally with ngrok:
```bash
ngrok http 5000
# Update Paystack webhook URL to ngrok URL
```

### Verify payment manually:
```bash
curl https://your-backend-url.com/api/group-orders/verify-payment/grp-abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```
