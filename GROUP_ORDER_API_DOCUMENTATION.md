# Group Order API Documentation

## Overview

The group buying system has been completely refactored to support a **Reserve-Then-Checkout** workflow instead of the previous immediate payment system.

### New Workflow Summary

1. **Reserve Slot** - Users reserve slots WITHOUT payment
2. **Group Fills** - When minimum participants reached, 48-hour checkout window opens
3. **Email Notification** - All participants receive email to checkout
4. **Individual Checkout** - Each participant checks out with their own delivery address
5. **Non-Payment Handling** - After 48 hours, non-payers removed, waitlist promoted
6. **Order Creation** - Individual orders created for each paid participant

---

## Data Models Changes

### Group Order Schema

```typescript
{
  groupId: string;                    // e.g., "GRP-A1B2C3"

  // Product info
  product: {
    _id: ObjectId;
    name: string;
    images: string[];
    bulkPrice: number;                // Bulk price per unit
    regularPrice: number;             // Regular retail price
  };

  // Configuration
  minParticipants: number;            // e.g., 5 people minimum
  maxParticipants: number;            // e.g., 10 people maximum
  quantityPerPerson: {
    min: number;                      // e.g., 5kg minimum per person
    max: number;                      // e.g., 15kg maximum per person
  };
  targetQuantity: number;             // e.g., 50kg total target
  bulkPricePerUnit: number;           // e.g., ₦500/kg
  deadlineHours: number;              // e.g., 168 hours (7 days)
  maxActiveGroups: number;            // e.g., 3
  checkoutWindowDurationHours: number; // e.g., 48 hours

  // Phase tracking
  phase: 'filling' | 'checkout_window' | 'confirmed' | 'expired' | 'cancelled';

  // Checkout window
  checkoutWindowOpensAt?: Date;
  checkoutWindowClosesAt?: Date;

  // Participants
  participants: IGroupParticipant[];
  reservedSlots: number;              // Count of 'reserved' participants
  paidSlots: number;                  // Count of 'paid' participants

  // Waitlist
  waitlist: IWaitlistParticipant[];

  // Shareable link
  shareableCode: string;              // e.g., "abc123xyz7"

  // Status tracking
  groupFilledAt?: Date;
  confirmedAt?: Date;
  expiredAt?: Date;
  cancelledAt?: Date;
  cancelledReason?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

### Participant Schema

```typescript
{
  id: string;
  userId: ObjectId;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  quantity: number;
  amount: number;                     // Total amount for this participant

  // NEW: Status tracking
  status: 'reserved' | 'paid' | 'removed';

  // Timestamps
  reservedAt: Date;
  paidAt?: Date;
  checkoutDeadline?: Date;            // 48 hours after checkout window opens
  removedAt?: Date;

  // Payment details (only after checkout)
  paymentReference?: string;
  deliveryInfo?: {
    address: string;
    city: string;
    state: string;
    phoneNumber: string;
  };
  deliveryFee?: number;
  orderId?: ObjectId;                 // Individual order created after payment
}
```

### Waitlist Participant Schema

```typescript
{
  userId: ObjectId;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  quantity: number;
  joinedAt: Date;
  notifiedAt?: Date;
  promotionDeadline?: Date;           // 24 hours to checkout after promotion
}
```

### Product Group Config

```typescript
{
  groupBuyingEnabled: boolean;
  groupConfig?: {
    minParticipants: number;          // e.g., 5
    maxParticipants: number;          // e.g., 10
    quantityPerPerson: {
      min: number;                    // e.g., 5
      max: number;                    // e.g., 15
    };
    targetQuantity: number;           // e.g., 50
    bulkPricePerUnit: number;         // e.g., 50000 (₦500.00 in kobo)
    deadlineHours: number;            // e.g., 168 (7 days)
    maxActiveGroups: number;          // e.g., 3
    checkoutWindowHours: number;      // e.g., 48
  };
}
```

---

## Public Endpoints (No Authentication)

### 1. Get Active Groups

**GET** `/api/group-orders/active`

Get all active group orders.

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "groupId": "GRP-A1B2C3",
        "product": {
          "_id": "...",
          "name": "Fresh Chicken",
          "images": ["..."],
          "bulkPrice": 50000,
          "regularPrice": 70000
        },
        "minParticipants": 5,
        "maxParticipants": 10,
        "quantityPerPerson": { "min": 5, "max": 15 },
        "targetQuantity": 50,
        "bulkPricePerUnit": 50000,
        "phase": "filling",
        "reservedSlots": 3,
        "paidSlots": 0,
        "participantsCount": 3,
        "waitlistCount": 0,
        "spotsLeft": 7,
        "shareableCode": "abc123xyz7",
        "checkoutWindowOpensAt": null,
        "checkoutWindowClosesAt": null,
        "createdAt": "2025-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

### 2. Get Group by Shareable Code

**GET** `/api/group-orders/share/:shareableCode`

Get group details using shareable code (for invitation links).

**Parameters:**
- `shareableCode` (path) - Shareable code (e.g., "abc123xyz7")

**Response:**
```json
{
  "success": true,
  "data": {
    "group": {
      "groupId": "GRP-A1B2C3",
      "product": { ... },
      "minParticipants": 5,
      "maxParticipants": 10,
      "quantityPerPerson": { "min": 5, "max": 15 },
      "phase": "filling",
      "reservedSlots": 3,
      "participantsCount": 3,
      "spotsLeft": 7,
      "shareableLink": "https://farmchops.com/group-buy/abc123xyz7"
    }
  }
}
```

### 3. Get Group Details

**GET** `/api/group-orders/:groupId`

Get detailed information about a specific group.

**Parameters:**
- `groupId` (path) - Group ID (e.g., "GRP-A1B2C3")

**Response:**
```json
{
  "success": true,
  "data": {
    "group": {
      "groupId": "GRP-A1B2C3",
      "product": { ... },
      "minParticipants": 5,
      "maxParticipants": 10,
      "quantityPerPerson": { "min": 5, "max": 15 },
      "targetQuantity": 50,
      "bulkPricePerUnit": 50000,
      "phase": "checkout_window",
      "reservedSlots": 2,
      "paidSlots": 3,
      "participantsCount": 5,
      "waitlistCount": 2,
      "checkoutWindowOpensAt": "2025-01-15T12:00:00.000Z",
      "checkoutWindowClosesAt": "2025-01-17T12:00:00.000Z",
      "shareableCode": "abc123xyz7",
      "shareableLink": "https://farmchops.com/group-buy/abc123xyz7",
      "participants": [
        {
          "id": "...",
          "user": {
            "firstName": "John",
            "lastName": "Doe"
          },
          "quantity": 10,
          "amount": 500000,
          "status": "paid"
        }
      ]
    }
  }
}
```

---

## Protected Endpoints (Requires Authentication)

### 4. Reserve Slot (Step 1)

**POST** `/api/group-orders/:groupId/reserve`

Reserve a slot in a group WITHOUT payment.

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `groupId` (path) - Group ID

**Body:**
```json
{
  "quantity": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully reserved slot in group",
  "data": {
    "group": {
      "groupId": "GRP-A1B2C3",
      "reservedSlots": 4,
      "participantsCount": 4,
      "spotsLeft": 6
    },
    "participant": {
      "id": "...",
      "quantity": 10,
      "amount": 500000,
      "status": "reserved",
      "reservedAt": "2025-01-15T10:30:00.000Z"
    },
    "checkoutWindow": null
  }
}
```

**Response (when group fills):**
```json
{
  "success": true,
  "message": "Successfully reserved slot. Checkout window is now open!",
  "data": {
    "group": {
      "groupId": "GRP-A1B2C3",
      "phase": "checkout_window",
      "reservedSlots": 5,
      "participantsCount": 5,
      "spotsLeft": 5
    },
    "participant": {
      "id": "...",
      "quantity": 10,
      "amount": 500000,
      "status": "reserved",
      "checkoutDeadline": "2025-01-17T12:00:00.000Z"
    },
    "checkoutWindow": {
      "opensAt": "2025-01-15T12:00:00.000Z",
      "closesAt": "2025-01-17T12:00:00.000Z",
      "durationHours": 48
    }
  }
}
```

**Errors:**
- `400` - Quantity validation error
- `404` - Group not found
- `409` - Already in group / Group full / Checkout window closed

### 5. Initiate Checkout (Step 2)

**POST** `/api/group-orders/:groupId/checkout`

Initialize payment for a reserved slot. Returns Paystack authorization URL.

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `groupId` (path) - Group ID

**Body:**
```json
{
  "deliveryInfo": {
    "address": "123 Main St",
    "city": "Lagos",
    "state": "Lagos",
    "phoneNumber": "08012345678"
  },
  "deliveryFee": 250000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "payment": {
      "authorizationUrl": "https://checkout.paystack.com/...",
      "reference": "grp-abc123...",
      "amount": 750000,
      "email": "user@example.com"
    },
    "group": {
      "groupId": "GRP-A1B2C3",
      "checkoutDeadline": "2025-01-17T12:00:00.000Z"
    }
  }
}
```

**Errors:**
- `404` - Group not found / Reservation not found
- `400` - Checkout window not open / Already paid
- `409` - Checkout window expired

### 6. Verify Payment

**GET** `/api/group-orders/verify-payment/:reference`

Verify group order payment status.

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `reference` (path) - Payment reference

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "reference": "grp-abc123...",
      "status": "success",
      "amount": 750000,
      "paidAt": "2025-01-15T13:00:00.000Z"
    },
    "group": {
      "groupId": "GRP-A1B2C3",
      "phase": "checkout_window"
    },
    "order": {
      "_id": "...",
      "orderNumber": "ORD-...",
      "status": "pending"
    }
  }
}
```

### 7. Join Waitlist

**POST** `/api/group-orders/:groupId/waitlist`

Join waitlist when group is full.

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `groupId` (path) - Group ID

**Body:**
```json
{
  "quantity": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully joined waitlist",
  "data": {
    "group": {
      "groupId": "GRP-A1B2C3",
      "waitlistPosition": 3
    },
    "waitlistEntry": {
      "quantity": 10,
      "joinedAt": "2025-01-15T14:00:00.000Z"
    }
  }
}
```

### 8. Leave Group

**POST** `/api/group-orders/:groupId/leave`

Leave a group (before payment).

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `groupId` (path) - Group ID

**Response:**
```json
{
  "success": true,
  "message": "Successfully left the group",
  "data": {
    "groupId": "GRP-A1B2C3"
  }
}
```

### 9. Get My Groups

**GET** `/api/group-orders/user/my-groups`

Get all groups the authenticated user is part of.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional) - Filter by participant status: `reserved`, `paid`, `removed`

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "groupId": "GRP-A1B2C3",
        "product": { ... },
        "phase": "checkout_window",
        "myParticipation": {
          "quantity": 10,
          "amount": 500000,
          "status": "reserved",
          "checkoutDeadline": "2025-01-17T12:00:00.000Z",
          "reservedAt": "2025-01-15T10:30:00.000Z"
        },
        "checkoutWindowOpensAt": "2025-01-15T12:00:00.000Z",
        "checkoutWindowClosesAt": "2025-01-17T12:00:00.000Z"
      }
    ]
  }
}
```

---

## Admin Endpoints

### 10. Configure Group Buying

**POST** `/api/admin/products/:productId/group-config`

Enable/configure group buying for a product.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Parameters:**
- `productId` (path) - Product ID

**Body:**
```json
{
  "groupBuyingEnabled": true,
  "minParticipants": 5,
  "maxParticipants": 10,
  "quantityPerPerson": {
    "min": 5,
    "max": 15
  },
  "targetQuantity": 50,
  "bulkPricePerUnit": 50000,
  "deadlineHours": 168,
  "maxActiveGroups": 3,
  "checkoutWindowHours": 48
}
```

**Response:**
```json
{
  "success": true,
  "message": "Group buying enabled successfully",
  "data": {
    "product": {
      "_id": "...",
      "name": "Fresh Chicken",
      "groupBuyingEnabled": true,
      "groupConfig": { ... }
    }
  }
}
```

**Note:** When enabled, a first group is automatically created.

### 11. Get All Groups (Admin)

**GET** `/api/admin/group-orders`

Get all groups with admin statistics.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `phase` (optional) - Filter by phase: `filling`, `checkout_window`, `confirmed`, `expired`, `cancelled`
- `productId` (optional) - Filter by product ID

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [ ... ],
    "stats": {
      "totalFillingGroups": 5,
      "totalCheckoutWindowGroups": 2,
      "totalConfirmedGroups": 10,
      "totalExpiredGroups": 3,
      "totalCancelledGroups": 1,
      "totalRevenue": 50000000
    }
  }
}
```

### 12. Get Group Details (Admin)

**GET** `/api/admin/group-orders/:groupId`

Get detailed group information with full participant details.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Parameters:**
- `groupId` (path) - Group ID

**Response:**
```json
{
  "success": true,
  "data": {
    "group": {
      "groupId": "GRP-A1B2C3",
      "product": { ... },
      "minParticipants": 5,
      "maxParticipants": 10,
      "phase": "checkout_window",
      "reservedSlots": 2,
      "paidSlots": 3,
      "participants": [
        {
          "id": "...",
          "userId": "...",
          "user": {
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com",
            "phone": "08012345678"
          },
          "quantity": 10,
          "amount": 500000,
          "status": "paid",
          "paymentReference": "grp-abc...",
          "reservedAt": "2025-01-15T10:30:00.000Z",
          "paidAt": "2025-01-15T13:00:00.000Z",
          "checkoutDeadline": "2025-01-17T12:00:00.000Z",
          "deliveryInfo": { ... },
          "deliveryFee": 250000,
          "orderId": "..."
        }
      ],
      "waitlist": [
        {
          "userId": "...",
          "user": { ... },
          "quantity": 8,
          "joinedAt": "2025-01-15T14:00:00.000Z"
        }
      ],
      "shareableCode": "abc123xyz7",
      "shareableLink": "https://farmchops.com/group-buy/abc123xyz7",
      "totalRevenue": 3750000
    }
  }
}
```

### 13. Cancel Group (Admin)

**POST** `/api/admin/group-orders/:groupId/cancel`

Cancel a group and process refunds.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Parameters:**
- `groupId` (path) - Group ID

**Body:**
```json
{
  "reason": "Product unavailable due to supply chain issues"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Group cancelled successfully. Refunds are being processed for all paid participants.",
  "data": {
    "group": {
      "groupId": "GRP-A1B2C3",
      "phase": "cancelled",
      "cancelledAt": "2025-01-15T15:00:00.000Z",
      "cancelledReason": "Product unavailable...",
      "participantsCount": 5,
      "paidParticipantsCount": 3,
      "totalRefunds": 1500000
    }
  }
}
```

### 14. Create Group (Admin)

**POST** `/api/admin/products/:productId/create-group`

Manually create a new group for a product.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Parameters:**
- `productId` (path) - Product ID

**Response:**
```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "group": {
      "groupId": "GRP-XYZ789",
      "product": { ... },
      "minParticipants": 5,
      "maxParticipants": 10,
      "phase": "filling",
      "shareableCode": "xyz789abc1",
      "shareableLink": "https://farmchops.com/group-buy/xyz789abc1",
      "createdAt": "2025-01-15T16:00:00.000Z"
    }
  }
}
```

---

## Webhook

### Paystack Webhook

**POST** `/api/group-orders/webhook/paystack`

Receives payment confirmation from Paystack. This endpoint is called by Paystack, not your frontend.

**Headers:**
- `x-paystack-signature` - Paystack webhook signature

**Body:**
```json
{
  "event": "charge.success",
  "data": {
    "reference": "grp-abc123...",
    "amount": 750000,
    "metadata": {
      "groupId": "GRP-A1B2C3",
      "userId": "...",
      "deliveryInfo": { ... },
      "deliveryFee": 250000
    }
  }
}
```

---

## Phase Lifecycle

### Phase: `filling`
- Initial state when group is created
- Users can reserve slots
- No payment required yet
- Transitions to `checkout_window` when `minParticipants` reached

### Phase: `checkout_window`
- Triggered when minimum participants reached
- 48-hour window opens (configurable)
- Email sent to all participants
- Each participant has individual checkout deadline
- Users can still join if spots available
- Participants must complete payment before deadline

### Phase: `confirmed`
- All participants have paid
- Individual orders created for each participant
- Product stock decreased
- Group is complete

### Phase: `expired`
- Checkout window deadline passed
- Non-payers removed
- Waitlist members promoted (if any)
- May transition back to `filling` or `checkout_window`

### Phase: `cancelled`
- Admin cancelled the group
- Refunds processed for paid participants
- Terminal state

---

## Email Notifications

### 1. Group Ready Email
**Trigger:** When group reaches minimum participants

**Sent To:** All reserved participants

**Content:**
- Group has reached minimum participants
- Checkout window is now open (48 hours)
- Checkout deadline
- Link to checkout page
- Warning about removal if not paid

### 2. Waitlist Promotion Email
**Trigger:** When participant removed and waitlist member promoted

**Sent To:** Promoted waitlist member

**Content:**
- Promoted from waitlist
- Checkout deadline (24 hours)
- Link to checkout page
- Warning about removal if not paid

---

## Error Codes

### Common Error Responses

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

**Error Codes:**
- `GROUP_NOT_FOUND` - Group doesn't exist
- `GROUP_FULL` - Group has reached max participants
- `ALREADY_IN_GROUP` - User already has a reservation
- `INVALID_QUANTITY` - Quantity outside allowed range
- `CHECKOUT_WINDOW_CLOSED` - Cannot reserve after deadline
- `CHECKOUT_WINDOW_NOT_OPEN` - Cannot checkout yet
- `RESERVATION_NOT_FOUND` - User has no reservation
- `ALREADY_PAID` - User already completed payment
- `PAYMENT_FAILED` - Payment verification failed
- `PRODUCT_NOT_CONFIGURED` - Product doesn't have group config

---

## Testing Checklist

### Reserve Flow
- [ ] Reserve slot with valid quantity
- [ ] Try to reserve when already in group (should fail)
- [ ] Try to reserve when group is full (should fail)
- [ ] Verify group fills when minParticipants reached
- [ ] Verify checkout window opens automatically

### Checkout Flow
- [ ] Initialize checkout with delivery info
- [ ] Receive Paystack authorization URL
- [ ] Complete payment on Paystack
- [ ] Verify webhook processes payment
- [ ] Verify individual order created
- [ ] Verify participant status updated to 'paid'

### Waitlist Flow
- [ ] Join waitlist when group is full
- [ ] Verify waitlist position
- [ ] Verify promotion when slot opens
- [ ] Verify 24-hour checkout deadline for promoted users

### Admin Flow
- [ ] Configure group buying for product
- [ ] Verify first group auto-created
- [ ] View all groups with filters
- [ ] View detailed group information
- [ ] Cancel group and verify refunds
- [ ] Manually create additional groups

---

## Migration Notes

### Old API vs New API

| Old Endpoint | New Endpoint | Changes |
|--------------|--------------|---------|
| `POST /:groupId/join` | `POST /:groupId/reserve` | Now reserves without payment |
| N/A | `POST /:groupId/checkout` | New endpoint for payment |
| N/A | `POST /:groupId/waitlist` | New waitlist feature |
| N/A | `GET /share/:shareableCode` | New shareable links |

### Schema Changes

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `totalSlots` | `maxParticipants` | Now participant-based |
| `filledSlots` | `reservedSlots` + `paidSlots` | Separate tracking |
| `quantityPerSlot` | `quantityPerPerson.min/max` | Range instead of fixed |
| `pricePerSlot` | `bulkPricePerUnit` | Renamed for clarity |
| `status` | `phase` | More accurate naming |
| N/A | `checkoutWindow*` | New checkout window fields |

---

## Support

For questions or issues, contact the backend team or refer to the codebase:
- Models: `src/models/GroupOrder.ts`, `src/models/Product.ts`
- Service: `src/services/groupOrderService.ts`
- Controllers: `src/controllers/groupOrderController.ts`, `src/controllers/adminGroupOrderController.ts`
- Routes: `src/routes/groupOrderRoutes.ts`
