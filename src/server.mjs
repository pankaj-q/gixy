import { app } from './index.mjs';
import config from './config/index.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = config.port || process.env.PORT || 3000;

// Database connection
await connectDB()
  .then(() => {
    logger.info('Database connected successfully');
  })
  .catch((err) => {
    logger.warn('Database connection failed - running without DB', { error: err.message });
  });

// Start server
const server = app.listen(PORT, () => {
  logger.info(`AI Risk Manager running on port ${PORT}`, { 
    environment: config.env,
    dashboard: `http://localhost:${PORT}/dashboard`
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    logger.info('SIGTERM received, shutting down gracefully');
    await disconnectDB();
    server.close();
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  try {
    logger.info('SIGINT received, shutting down gracefully');
    await disconnectDB();
    server.close();
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.message || reason, promise });
});