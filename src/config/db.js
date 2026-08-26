import mongoose from 'mongoose';
import config from './index.js';

let dbConnection = null;

export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });

    dbConnection = conn;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    conn.on('error', (err) => {
      console.error('❌ MongoDB error:', err);
    });

    conn.on('disconnected', () => {
      console.log('📤 MongoDB disconnected');
    });

    return conn;
  } catch (error) {
    console.warn('� MongoDB connection failed - continuing without database');
    dbConnection = null;
    return null;
  }
}

export function disconnectDB() {
  if (dbConnection) {
    mongoose.connection.close()
      .then(() => console.log('🔒 MongoDB disconnected'))
      .catch(err => console.error('Error disconnecting MongoDB:', err));
  }
}

// Export the connection state for use elsewhere
export { dbConnection };

// Do not auto-exit on connection failure - let the app continue