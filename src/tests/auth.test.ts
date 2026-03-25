// Mock the email service before any imports so no real SMTP calls are made.
// __esModule: true is required so TypeScript's __importDefault helper doesn't
// double-wrap the mock (i.e. emailService.default.sendX vs emailService.sendX).
jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: {
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(true),
  },
}));

import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../app';
import User from '../models/User';

// ─── Helpers ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET as string;

/** Creates a fully verified, active customer in the DB. */
const createVerifiedUser = async (overrides: Record<string, unknown> = {}) => {
  const hashedPassword = await bcrypt.hash('password123', 10);
  return User.create({
    email: 'test@example.com',
    password: hashedPassword,
    firstName: 'Test',
    lastName: 'User',
    phone: '08012345678',
    role: 'customer',
    isActive: true,
    profile: { isVerified: true },
    wallet: { balance: 0 },
    ...overrides,
  });
};

/** Generates a valid JWT for a user. */
const tokenFor = (userId: string, role = 'customer') =>
  jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });

// ─── POST /api/auth/login ────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 200 and a token for valid credentials', async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('returns 401 for wrong password', async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for deactivated account', async () => {
    await createVerifiedUser({ isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /api/auth/profile ───────────────────────────────────────────────────

describe('GET /api/auth/profile', () => {
  it('returns 200 and user data for authenticated user', async () => {
    const user = await createVerifiedUser();
    const token = tokenFor(String(user._id));

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/profile');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer this.is.not.valid');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── PUT /api/auth/profile ───────────────────────────────────────────────────

describe('PUT /api/auth/profile', () => {
  it('returns 200 and updates firstName/lastName', async () => {
    const user = await createVerifiedUser();
    const token = tokenFor(String(user._id));

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated', lastName: 'Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.firstName).toBe('Updated');
  });

  it('returns 400 when phone is already taken by another user', async () => {
    await createVerifiedUser({ phone: '08012345678' });
    const user2 = await createVerifiedUser({
      email: 'user2@example.com',
      phone: '08099999999',
    });
    const token = tokenFor(String(user2._id));

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '08012345678' }); // already taken

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 for authenticated user', async () => {
    const user = await createVerifiedUser();
    const token = tokenFor(String(user._id));

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/auth/signup ───────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('returns 200 and sends a verification email for a new address', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'newuser@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when email is already verified', async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/auth/signup/complete ─────────────────────────────────────────

describe('POST /api/auth/signup/complete', () => {
  it('returns 201 and a token when code is valid', async () => {
    const verificationCode = '123456';
    await User.create({
      email: 'pending@example.com',
      emailVerificationCode: verificationCode,
      emailVerificationExpires: new Date(Date.now() + 15 * 60 * 1000),
      profile: { isVerified: false },
      isActive: false,
      wallet: { balance: 0 },
    });

    const res = await request(app)
      .post('/api/auth/signup/complete')
      .send({
        email: 'pending@example.com',
        verificationCode,
        password: 'newpassword123',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
  });

  it('returns 400 for an invalid verification code', async () => {
    const res = await request(app)
      .post('/api/auth/signup/complete')
      .send({
        email: 'pending@example.com',
        verificationCode: '000000',
        password: 'newpassword123',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an expired verification code', async () => {
    const verificationCode = '654321';
    await User.create({
      email: 'expired@example.com',
      emailVerificationCode: verificationCode,
      emailVerificationExpires: new Date(Date.now() - 1000), // already expired
      profile: { isVerified: false },
      isActive: false,
      wallet: { balance: 0 },
    });

    const res = await request(app)
      .post('/api/auth/signup/complete')
      .send({
        email: 'expired@example.com',
        verificationCode,
        password: 'newpassword123',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 for a registered email', async () => {
    await createVerifiedUser();

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 even for an unregistered email (no info leak)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('returns 200 and resets the password with a valid code', async () => {
    const resetCode = '654321';
    const user = await createVerifiedUser();
    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: resetCode,
      passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: 'test@example.com',
        resetCode,
        newPassword: 'newpassword456',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for an invalid reset code', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: 'test@example.com',
        resetCode: '000000',
        newPassword: 'newpassword456',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

