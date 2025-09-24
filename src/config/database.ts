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

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Database already connected');
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/farmchops';
      
      await mongoose.connect(mongoUri);
      
      this.isConnected = true;
      console.log('Mongo DB connected successfully');
      
      // Connection event listeners
      mongoose.connection.on('connected', () => {
        console.log('Mongoose connected to MongoDB');
      });

      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        this.isConnected = false;
      });


    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
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