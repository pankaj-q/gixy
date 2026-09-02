import mongoose from 'mongoose';

let dbConnection = null;
let isConnecting = false;

// Allow overriding the URI via environment variable (useful for tests)
// This works across Jest's separate processes for globalSetup
function getMongoUri() {
  return process.env.MONGODB_URI_TEST_OVERRIDE || process.env.MONGODB_URI || 'mongodb://localhost:27017/gixy';
}

export async function connectDB(maxRetries = 3, retryDelay = 1000) {
  // If already connected or connecting, return existing connection
  if (dbConnection && mongoose.connection.readyState === 1) {
    return dbConnection;
  }
  
  if (isConnecting) {
    // Wait for existing connection attempt
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return dbConnection;
  }

  isConnecting = true;
  
  // Get MongoDB URI from environment (works across Jest processes)
  const uri = getMongoUri();
  
  console.log(`🔍 Connecting to MongoDB: ${uri}`);
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        bufferCommands: true, // Enable buffering for better test compatibility
      });

      dbConnection = mongoose.connection;
      console.log(`✅ MongoDB Connected: ${dbConnection.host}`);

      dbConnection.on('error', (err) => {
        console.error('❌ MongoDB error:', err);
      });

      dbConnection.on('disconnected', () => {
        console.log('📤 MongoDB disconnected');
      });

      isConnecting = false;
      return dbConnection;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ MongoDB connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.warn('⚠️ MongoDB connection failed after all retries - continuing without database');
  dbConnection = null;
  isConnecting = false;
  return null;
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