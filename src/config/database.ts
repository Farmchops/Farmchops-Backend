import mongoose from 'mongoose';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(retries = 10, delayMs = 3000): Promise<void> {
    if (this.isConnected) {
      console.log('Database already connected');
      return;
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/farmchops';

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      this.isConnected = false;
    });

    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await mongoose.connect(mongoUri);
        this.isConnected = true;
        console.log('Mongo DB connected successfully');
        return;
      } catch (error) {
        console.error(`MongoDB connection attempt ${attempt}/${retries} failed:`, (error as Error).message);
        if (attempt === retries) {
          console.error('All MongoDB connection attempts exhausted. Exiting.');
          process.exit(1);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  
  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        // Test the connection with a simple ping
        await mongoose.connection.db.admin().ping();
        return {
          status: 'healthy',
          message: 'Database connection is working properly'
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Database connection is not ready'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export default DatabaseConnection.getInstance();