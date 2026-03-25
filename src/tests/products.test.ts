jest.mock('../middleware/uploadMiddleware', () => {
  const noop = () => (_req: any, _res: any, next: any) => next();
  const mockUploader = { single: noop, array: noop, none: noop, fields: noop };
  return {
    __esModule: true,
    uploadCategoryImage: mockUploader,
    uploadProductImages: mockUploader,
    uploadVendorDoc: mockUploader,
    uploadPaylaterImages: mockUploader,
    convertCloudinaryUrlToBase64: () => Promise.resolve('base64string'),
  };
});

import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import User from '../models/User';
import { describe, it, expect } from '@jest/globals';

const JWT_SECRET = process.env.JWT_SECRET as string;

// ─── Helpers ────────────────────────────────────────────────────────────────

const createAdminUser = async () => {
  const hashed = await bcrypt.hash('password123', 10);
  return User.create({
    email: 'admin@example.com',
    password: hashed,
    role: 'admin',
    adminRole: 'super_admin',
    isActive: true,
    profile: { isVerified: true },
    wallet: { balance: 0 },
    permissions: ['all'],
  });
};

const createCategory = () =>
  Category.create({ name: 'Vegetables', slug: 'vegetables', isActive: true });

const createProduct = async (categoryId: unknown, overrides: Record<string, unknown> = {}) =>
  Product.create({
    name: 'Fresh Tomatoes',
    description: 'Locally grown red tomatoes',
    slug: 'fresh-tomatoes',
    status: 'active',
    category: categoryId,
    pricing: {
      retail: { price: 50000, unit: 'kg', minQuantity: 1 },
    },
    inventory: { availableStock: 100, lowStockThreshold: 10, unit: 'kg' },
    ...overrides,
  });

const adminToken = (userId: string) =>
  jwt.sign({ userId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

// ─── GET /api/products ───────────────────────────────────────────────────────

describe('GET /api/products', () => {
  it('returns 200 and only active products for public users', async () => {
    const cat = await createCategory();
    await createProduct(cat._id, { status: 'active' });
    await createProduct(cat._id, {
      name: 'Out of stock item',
      slug: 'out-of-stock-item',
      status: 'out_of_stock',
    });

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products.length).toBe(1);
  });

  it('returns 200 with empty list when no products exist', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.totalProducts).toBe(0);
  });

  it('filters products by category slug', async () => {
    const cat = await createCategory();
    await createProduct(cat._id);

    const res = await request(app).get('/api/products?category=vegetables');

    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBe(1);
  });
});

// ─── GET /api/products/search ────────────────────────────────────────────────

describe('GET /api/products/search', () => {
  it('returns 200 and matching products', async () => {
    const cat = await createCategory();
    await createProduct(cat._id);

    const res = await request(app).get('/api/products/search?q=tomato');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns empty results for no match', async () => {
    const res = await request(app).get('/api/products/search?q=xyznonexistent');

    expect(res.status).toBe(200);
    expect(res.body.data.products.length).toBe(0);
  });
});

// ─── GET /api/products/:slug ─────────────────────────────────────────────────

describe('GET /api/products/:slug', () => {
  it('returns 200 and product for valid slug', async () => {
    const cat = await createCategory();
    await createProduct(cat._id);

    const res = await request(app).get('/api/products/fresh-tomatoes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('fresh-tomatoes');
  });

  it('returns 404 for non-existent slug', async () => {
    const res = await request(app).get('/api/products/ghost-product');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Admin routes — auth protection ─────────────────────────────────────────

describe('GET /api/products/admin/stats — auth protection', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/products/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const user = await User.create({
      email: 'customer@example.com',
      password: await bcrypt.hash('pass', 10),
      role: 'customer',
      isActive: true,
      profile: { isVerified: true },
      wallet: { balance: 0 },
    });
    const token = jwt.sign({ userId: String(user._id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });

    const res = await request(app)
      .get('/api/products/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 for admin user', async () => {
    const admin = await createAdminUser();

    const res = await request(app)
      .get('/api/products/admin/stats')
      .set('Authorization', `Bearer ${adminToken(String(admin._id))}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('DELETE /api/products/:id — admin only', () => {
  it('returns 401 with no token', async () => {
    const cat = await createCategory();
    const product = await createProduct(cat._id);

    const res = await request(app).delete(`/api/products/${product._id}`);

    expect(res.status).toBe(401);
  });

  it('returns 200 for admin deleting a product', async () => {
    const admin = await createAdminUser();
    const cat = await createCategory();
    const product = await createProduct(cat._id);

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Authorization', `Bearer ${adminToken(String(admin._id))}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

