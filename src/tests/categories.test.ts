// Bypass ALL Cloudinary upload middleware so no upload routes crash in tests
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
import { Category } from '../models/Category';
import User from '../models/User';
import { jest, describe, it, expect } from '@jest/globals';

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

const createCategory = (overrides: Record<string, unknown> = {}) =>
  Category.create({
    name: 'Vegetables',
    slug: 'vegetables',
    isActive: true,
    ...overrides,
  });

const adminToken = (userId: string) =>
  jwt.sign({ userId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

const customerToken = (userId: string) =>
  jwt.sign({ userId, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });

// ─── GET /api/categories ─────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  it('returns 200 and only active categories for public users', async () => {
    await createCategory({ name: 'Vegetables', slug: 'vegetables', isActive: true });
    await createCategory({ name: 'Hidden', slug: 'hidden', isActive: false });

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categories.length).toBe(1);
    expect(res.body.data.categories[0].name).toBe('Vegetables');
  });

  it('returns 200 with empty list when no categories exist', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });
});

// ─── GET /api/categories/:slug ───────────────────────────────────────────────

describe('GET /api/categories/:slug', () => {
  it('returns 200 and category for valid slug', async () => {
    await createCategory();

    const res = await request(app).get('/api/categories/vegetables');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('vegetables');
  });

  it('returns 404 for non-existent slug', async () => {
    const res = await request(app).get('/api/categories/ghost-category');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for inactive category when accessed by public user', async () => {
    await createCategory({ name: 'Inactive', slug: 'inactive-cat', isActive: false });

    const res = await request(app).get('/api/categories/inactive-cat');

    expect(res.status).toBe(404);
  });
});

// ─── Admin routes — auth protection ─────────────────────────────────────────

describe('DELETE /api/categories/admin/categories/:id — auth protection', () => {
  it('returns 401 with no token', async () => {
    const cat = await createCategory();

    const res = await request(app).delete(`/api/categories/admin/categories/${cat._id}`);

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const cat = await createCategory();
    const user = await User.create({
      email: 'customer@example.com',
      password: await bcrypt.hash('pass', 10),
      role: 'customer',
      isActive: true,
      profile: { isVerified: true },
      wallet: { balance: 0 },
    });

    const res = await request(app)
      .delete(`/api/categories/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${customerToken(String(user._id))}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 for admin user', async () => {
    const admin = await createAdminUser();
    const cat = await createCategory();

    const res = await request(app)
      .delete(`/api/categories/admin/categories/${cat._id}`)
      .set('Authorization', `Bearer ${adminToken(String(admin._id))}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

