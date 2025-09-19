import session from 'express-session';
import MongoStore from 'connect-mongo';

export const sessionConfig = session({
  secret: process.env.SESSION_SECRET || 'farmchops-cart-secret-key-2024',
  name: 'farmchops.cart.sid',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/farmchops',
    touchAfter: 24 * 3600, // Update session only once per 24 hours unless data changes
    ttl: 14 * 24 * 60 * 60 // Session TTL: 14 days
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    sameSite: 'lax'
  }
});

