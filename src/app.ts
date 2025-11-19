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
//import RedisConnection from './config/redis';

app.use(session({
  secret: process.env.SESSION_SECRET || '1233edhkndlfjkneinr93u943',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 7 * 24 * 60 * 60 // 7 days
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

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
// import placesRoutes from './routes/placesRoutes';


const PORT = Number(process.env.PORT) || 5000;


// CORS configuration
// In development allow the frontend origin(s) flexibly to avoid preflight issues (helps local dev).
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: (origin, cb) => cb(null, true), // allow any origin in dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  }));
  app.use((req, res, next) => {
    // Log incoming requests in dev to help debug CORS/preflight issues
    // eslint-disable-next-line no-console
    console.debug('[DEV] Incoming request:', req.method, req.originalUrl, 'Origin:', req.headers.origin);
    next();
  });
} else {
  app.use(cors({
    origin: [ 'http://localhost:5173',
      'http://localhost:5000',
      'http://localhost:3000',
      'https://farmchops.com',
      'https://www.farmchops.com',
      'https://api.farmchops.com',
      'https://staging.farmchops.com',
      'http://staging.farmchops.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  }));
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }  // Add this!
}));


app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


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
    
    await emailService.testConnection()
    // Connect to Redis (optional)
    //await RedisConnection.connect();
    
    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      //console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      //console.log(`Health check: http://localhost:${PORT}/health`);
      //console.log(`API info: http://localhost:${PORT}/api`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;