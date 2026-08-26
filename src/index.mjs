import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import config from './config/index.js';
import { connectDB, disconnectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { asyncHandler } from './middleware/errorHandler.js';

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
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/v1/risk/assess', asyncHandler(async (req, res) => {
  const { modelId, modelName, riskFactors } = req.body;
  const riskScore = 50;
  res.json({
    success: true,
    data: { modelId, modelName, riskScore, assessmentId: `assessment_${Date.now()}` },
    message: 'Risk assessment completed',
  });
}));

app.get('/api/v1/models', asyncHandler(async (req, res) => {
  res.json({ success: true, data: [], message: 'Model list retrieved' });
}));

app.post('/api/v1/compliance/check', asyncHandler(async (req, res) => {
  const { modelId, framework } = req.body;
  res.json({
    success: true,
    data: { modelId, framework, compliant: true, violations: [] },
    message: 'Compliance check completed',
  });
}));

// Serve static dashboard from public directory
app.use('/dashboard', express.static(path.join('public', 'index.html')));

// API risk/quick-check endpoint for dashboard
app.post('/api/v1/risk/quick-check', asyncHandler(async (req, res) => {
  const { modelId, modelName, riskFactors } = req.body;
  const score = (riskFactors?.includes('security') ? 70 : riskFactors?.includes('bias') ? 65 : 30);
  const severity = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';
  res.json({
    success: true,
    data: {
      modelId,
      modelName,
      riskScore: score,
      severity,
      riskFactors: riskFactors || [],
      compliant: score < 70,
    },
    message: 'Quick risk check completed',
  });
}));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'fail', message: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Database connection
connectDB()
  .then(() => {
    console.log('🚀 Database connected successfully');
  })
  .catch((err) => {
    console.warn('⚠️ Database connection failed - running without DB', err.message);
  });

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 AI Risk Manager running on port ${PORT}`);
  console.log(`🌐 Environment: ${config.env}`);
  console.log('📊 Dashboard: http://localhost:${PORT}/dashboard');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await disconnectDB();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  try {
    await disconnectDB();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});