import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import config from './config/index.js';
import { connectDB, disconnectDB } from './config/db.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = config.port || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check (before DB connection)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Risk Manager is running' });
});

// API routes
import './api/routes.js';

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'fail', message: 'Not found' });
});

// Error handler (should be placed after all other middleware)
app.use(errorHandler);

// Database connection
connectDB()
  .then(() => {
    console.log('🚀 Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 AI Risk Manager running on port ${PORT}`);
      console.log(`🌐 Environment: ${config.env}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});