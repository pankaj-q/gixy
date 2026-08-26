import mongoose from 'mongoose';
import config from './index.js';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongodbUri);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
}

export function disconnectDB() {
  mongoose.connection.close()
    .then(() => console.log('🔒 MongoDB disconnected'))
    .catch(err => console.error('Error disconnecting MongoDB:', err));
}

// Connection event listeners
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📤 Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});