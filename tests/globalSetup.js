import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export default async function globalSetup() {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // Override the config mongodbUri for tests via environment variable
  // This works across Jest's separate processes
  process.env.MONGODB_URI_TEST_OVERRIDE = uri;
  
  // Store mongoServer instance for teardown
  global.__MONGO_SERVER__ = mongoServer;
  
  console.log('✅ Test MongoDB started:', uri);
}