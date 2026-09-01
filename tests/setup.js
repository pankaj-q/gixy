// Test-specific setup
import mongoose from 'mongoose';
import { initializeDatabase } from '../src/index.mjs';

// Connect to database before tests
beforeAll(async () => {
  await initializeDatabase();
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.disconnect();
  process.exit(0);
});