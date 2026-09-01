import mongoose from 'mongoose';

export default async function globalTeardown() {
  const mongoServer = global.__MONGO_SERVER__;
  if (mongoServer) {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('🔒 Test MongoDB stopped');
  }
}