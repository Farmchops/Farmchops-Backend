jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: {
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../services/googleMapsService', () => ({
  __esModule: true,
  getDistanceBetween: jest.fn().mockResolvedValue({ distanceMeters: 5000, duration: '10 mins' }),
}));

jest.mock('../config/paystack', () => ({
  __esModule: true,
  default: {
    transaction: {
      initialize: jest.fn().mockResolvedValue({
        status: true,
        data: { authorization_url: 'https://paystack.com/pay/test', reference: 'test_ref_123' },
      }),
    },
  },
}));

import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app';
import User from '../models/User';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { Order } from '../models/Order';

const JWT_SECRET = process.env.JWT_SECRET as string;

// ─── Helpers ────────────────────────────────────────────────────────────────

const createUser = async (overrides: Record<string, unknown> = {}) => {
  const hashed = await bcrypt.hash('password123', 10);
  return User.create({
    email: 'user@example.com',
    password: hashed,
    firstName: 'Test',
    lastName: 'User',
    role: 'customer',
    isActive: true,
    profile: { isVerified: true },
    wallet: { balance: 0 },
    ...overrides,
  });
};

const tokenFor = (userId: string, role = 'customer') =>
  jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });

// ─── GET /api/orders ─────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list for a new user', async () => {
    const user = await createUser();

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${tokenFor(String(user._id))}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders).toHaveLength(0);
  });
});

// ─── GET /api/orders/:id ─────────────────────────────────────────────────────

describe('GET /api/orders/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/orders/64f1234567890abcdef12345');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent order', async () => {
    const user = await createUser();

    const res = await request(app)
      .get('/api/orders/64f1234567890abcdef12345')
      .set('Authorization', `Bearer ${tokenFor(String(user._id))}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 for user viewing their own order', async () => {
    const user = await createUser();
    const cat = await Category.create({ name: 'Fruits', slug: 'fruits', isActive: true });
    const product = await Product.create({
      name: 'Mango',
      description: 'Sweet mangos',
      slug: 'mango',
      status: 'active',
      category: cat._id,
      pricing: { retail: { price: 30000, unit: 'kg', minQuantity: 1 } },
      inventory: { availableStock: 50, lowStockThreshold: 5, unit: 'kg' },
    });

    const order = await Order.create({
      user: user._id,
      orderNumber: 'ORD-TEST-001',
      items: [{
        product: product._id,
        productName: product.name,
        quantity: 2,
        priceType: 'retail',
        unitPrice: 30000,
        totalPrice: 60000,
      }],
      subtotal: 60000,
      totalDiscount: 0,
      deliveryFee: 500,
      totalAmount: 60500,
      deliveryInfo: {
        address: 'Test Street',
        city: 'Lagos',
        state: 'Lagos',
        phoneNumber: '08012345678',
      },
      paymentMethod: 'paystack',
      paymentStatus: 'pending',
      paymentProvider: 'paystack',
      paymentReference: 'test-ref-001',
      orderStatus: 'pending_payment',
      currentStageOwnerRole: 'system',
      marketerCommission: 0,
      commissionPaid: false,
      handoverCodeActive: false,
      handoverCodeAttempts: 0,
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${tokenFor(String(user._id))}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order.orderNumber).toBe(order.orderNumber);
  });
});

// ─── POST /api/orders/checkout ────────────────────────────────────────────────

describe('POST /api/orders/checkout', () => {
  it('returns 400 when cart is empty', async () => {
    const res = await request(app)
      .post('/api/orders/checkout')
      .send({ name: 'Test User', phone: '08012345678', address: 'Test Street Lagos' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/orders/checkout')
      .send({ name: 'Test User' }); // missing phone and address

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/orders/create ─────────────────────────────────────────────────

describe('POST /api/orders/create', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/orders/create').send({});
    expect(res.status).toBe(401);
  });
});
