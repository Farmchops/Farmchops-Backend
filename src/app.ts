import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import session from 'express-session';
import MongoStore from 'connect-mongo';
const app = express();

dotenv.config();
// Load environment variables
dotenv.config();

import DatabaseConnection from './config/database';
import mongoose from 'mongoose';
//import RedisConnection from './config/redis';

import category from './routes/categoryRoutes'
import auth from './routes/authRoutes'
import product from './routes/productsRoutes'
import cart from './routes/cartRoutes'
import emailService from './services/emailService';
import adminAuthRoutes from './routes/adminAuthRoutes';
import adminManagementRoutes from './routes/adminManagementRoutes';
import ordersRoutes from './routes/ordersRoutes';
import adminOrderRoutes from './routes/adminOrderRoutes';
import riderOrderRoutes from './routes/riderOrderRoutes';
import adminDealRoutes from './routes/adminDealRoutes';
import dealRoutes from './routes/dealRoutes';
import vendorRoutes from './routes/vendorRoutes';
import adminVendorRoutes from './routes/adminVendorRoutes';
import groupOrderRoutes from './routes/groupOrderRoutes';
import adminGroupOrderRoutes from './routes/adminGroupOrderRoutes';
import walletRoutes from './routes/walletRoutes';
import paymentLinkRoutes from './routes/paymentLinkRoutes';
import paylaterRoutes from './routes/paylaterRoutes';
import adminPaylaterRoutes from './routes/adminPaylaterRoutes';
import addressRoutes from './routes/addressRoutes';
import contactRoutes from './routes/contactRoutes';
import marketerRoutes from './routes/marketerRoutes';
import discountRoutes from './routes/discountRoutes';
import userRoutes from './routes/userRoutes';
import { startGroupOrderExpiryJob, startCheckoutWindowExpiryJob } from './jobs/groupOrderJobs';
import websocketService from './services/websocketService';
// import placesRoutes from './routes/placesRoutes';


const PORT = Number(process.env.PORT) || 5000;


// CORS configuration - MUST be FIRST middleware before session, helmet, etc.
const allowedOrigins = [
  'http://localhost:5172',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:3000',
  'https://farmchops.com',
  'https://www.farmchops.com',
  'https://api.farmchops.com',
  'https://staging.farmchops.com',
  'http://staging.farmchops.com',
  'https://admin.farmchops.com',
  'https://admin-staging.farmchops.com'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, check whitelist
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Log incoming requests
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[DEV] Incoming request:', req.method, req.originalUrl, 'Origin:', req.headers.origin);
  } else {
    console.log('[CORS] Request from origin:', req.headers.origin);
  }
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware - AFTER CORS
// Start with memory store, will upgrade to MongoStore after DB connects
// This prevents blocking startup if MongoDB session connection fails
let sessionStore: any = undefined; // Will use default MemoryStore initially

app.use(session({
  secret: process.env.SESSION_SECRET || '1233edhkndlfjkneinr93u943',
  resave: false,
  saveUninitialized: true, // MUST be true for guest carts - creates session even for anonymous users
  store: sessionStore, // Initially undefined = uses MemoryStore
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-domain in production, 'lax' for dev
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Serve static files (for email logo)
app.use('/public', express.static('public'));

app.use('/api/categories', category)
app.use('/api/auth', auth)
app.use('/api/products', product)
app.use('/api/cart', cart)
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/management', adminManagementRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin/deals', adminDealRoutes);
app.use('/api/admin', adminOrderRoutes);
app.use('/api/rider', riderOrderRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/admin/vendors', adminVendorRoutes);
app.use('/api/group-orders', groupOrderRoutes);
app.use('/api/admin', adminGroupOrderRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payment-links', paymentLinkRoutes);
app.use('/api/paylater', paylaterRoutes);
app.use('/api/admin/paylater', adminPaylaterRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', marketerRoutes);
app.use('/api/coupons', discountRoutes);
app.use('/api/orders', discountRoutes);
app.use('/api/admin/users', userRoutes);
// app.use('/api/places', placesRoutes);


// Health check route
app.get('/health', async (req, res) => {
  try {
    // Check database and Redis health
    const dbHealth = await DatabaseConnection.healthCheck();
    //const redisHealth = await RedisConnection.healthCheck();
    
    const overallHealth = dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
    
    res.json({
      success: true,
      message: 'Farmchops API Health Status',
      data: {
        status: overallHealth,
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
          //redis: redisHealth,
          api: {
            status: 'healthy',
            message: 'API server is running'
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Basic API info route
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Farmchops API',
    data: {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: {
      code: 'ROUTE_NOT_FOUND',
      path: req.originalUrl
    }
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: {
      code: error.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
});

// Start server function
async function startServer() {
  try {
    // Connect to database
    console.log('Starting Farmchops API...');
    await DatabaseConnection.connect();

    // Initialize MongoDB session store after DB connection succeeds
    try {
      console.log('Initializing MongoDB session store...');
      sessionStore = MongoStore.create({
        client: mongoose.connection.getClient() as any,
        touchAfter: 24 * 3600, // Lazy session update
        ttl: 7 * 24 * 60 * 60 // 7 days
      });
      console.log('MongoDB session store initialized successfully');
    } catch (sessionError) {
      console.warn('Failed to initialize MongoDB session store, using in-memory sessions:', sessionError);
      // App continues with MemoryStore - acceptable for single-server deployments
    }

    await emailService.testConnection()
    // Connect to Redis (optional)
    //await RedisConnection.connect();

    // Start cron jobs for group orders
    startGroupOrderExpiryJob();
    startCheckoutWindowExpiryJob();

    // Start Express server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      //console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      //console.log(`Health check: http://localhost:${PORT}/health`);
      //console.log(`API info: http://localhost:${PORT}/api`);
    });

    // Initialize WebSocket service
    websocketService.initialize(server);
    console.log('WebSocket service initialized for real-time admin updates');

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  websocketService.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  websocketService.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  websocketService.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  websocketService.shutdown();
  process.exit(1);
});

// Start the server
startServer();

export default app;