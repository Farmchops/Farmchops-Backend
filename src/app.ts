import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();
import DatabaseConnection from './config/database';
//import RedisConnection from './config/redis';

import category from './routes/categoryRoutes'
import auth from './routes/authRoutes'
import product from './routes/productsRoutes'
import cart from './routes/cartRoutes'
import emailService from './services/emailService';


// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [ 'http://localhost:5173',
    'http://localhost:3000',
    'https://farmchops.com',
    'https://www.farmchops.com',
    'https://api.farmchops.com',
    'https://staging.farmchops.com',  // ADD THIS
    'http://staging.farmchops.com'
  ], 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors())

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));



app.use('/api/categories', category)
app.use('/api/auth', auth)
app.use('/api/products', product)
app.use('/api/cart', cart)


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