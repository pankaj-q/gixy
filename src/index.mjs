import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import config from './config/index.js';
import { connectDB, disconnectDB } from './config/db.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';
import { authenticateToken, optionalAuth, generateToken } from './middleware/auth.js';
import { validate, assessRiskSchema, quickCheckSchema, complianceCheckSchema, registerModelSchema, updateModelSchema, listModelsQuerySchema, getAssessmentsQuerySchema, registerSchema, loginSchema, createAlertSchema, updateAlertSchema, createAlertRuleSchema, updateAlertRuleSchema, createChannelConfigSchema, updateChannelConfigSchema, listAlertsQuerySchema } from './validation/schemas.js';
import { logger, requestLogger, auditLog } from './utils/logger.js';
import RiskEngine from './engine/riskEngine.js';
import RiskModel from './models/riskModel.js';
import { RiskAssessment } from './models/RiskAssessment.js';
import { RegisteredModel } from './models/RegisteredModel.js';
import { User } from './models/User.js';
import { NotificationManager, MemoryAlertStore } from './alerts/index.js';

dotenv.config();

const app = express();
const PORT = config.port || 3000;

// Initialize risk engine
const riskEngine = new RiskEngine();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.plot.ly"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({
  origin: config.env === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { status: 'fail', message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 requests per hour
  message: { status: 'fail', message: 'Too many authentication attempts, please try again later' }
});

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use(requestLogger);

// Health check (before DB connection, no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI Risk Manager is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public, no authentication required)
const authRouter = express.Router();

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  try {
    const existingUser = await User.findByEmail(req.body.email);
    if (existingUser) {
      return res.status(409).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }

    const passwordHash = await User.hashPassword(req.body.password);
    
    const user = await User.create({
      email: req.body.email.toLowerCase(),
      passwordHash,
      name: req.body.name,
      role: req.body.role || 'viewer'
    });

    const token = generateToken({ 
      id: user._id, 
      email: user.email, 
      role: user.role,
      name: user.name
    });

    auditLog('user_registered', user._id, { email: user.email });
    
    res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      },
      message: 'Registration successful'
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    throw error;
  }
}));

authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findByEmail(req.body.email).select('+passwordHash');
  
  if (!user || !user.isActive) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid credentials'
    });
  }

  const isValid = await user.comparePassword(req.body.password);
  if (!isValid) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid credentials'
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken({ 
    id: user._id, 
    email: user.email, 
    role: user.role,
    name: user.name
  });

  auditLog('user_login', user._id, { email: user.email });
  
  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      token
    },
    message: 'Login successful'
  });
}));

// Get current user profile
authRouter.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ status: 'fail', message: 'User not found' });
  }
  res.json({ success: true, data: user.toJSON(), message: 'User profile retrieved' });
}));

app.use('/api/v1/auth', authRouter);

// Protected API routes (require authentication)
const apiRouter = express.Router();
apiRouter.use(authenticateToken);

// Risk assessment endpoints
apiRouter.post('/risk/assess', validate(assessRiskSchema), asyncHandler(async (req, res) => {
  const assessment = riskEngine.assessFullRisk(req.body);
  auditLog('risk_assessment', req.user?.id, { modelId: req.body.modelId, riskScore: assessment.riskScore });
  
  // Save assessment to database
  try {
    // Check if user ID is a valid ObjectId (for test compatibility)
    const isValidObjectId = mongoose.Types.ObjectId.isValid(req.user?.id);
    
    const savedAssessment = await RiskAssessment.create({
      modelId: assessment.modelId,
      modelName: assessment.modelName,
      version: assessment.version,
      riskFactors: assessment.riskFactors,
      riskScore: assessment.riskScore,
      severity: assessment.severity,
      compliant: assessment.compliant,
      metadata: {
        ...assessment.metadata,
        createdBy: isValidObjectId ? req.user?.id : undefined
      },
      trainingData: req.body.trainingData,
      modelConfig: req.body.modelConfig,
      metrics: req.body.metrics
    });
    
    res.json({
      success: true,
      data: savedAssessment.toJSON(),
      message: 'Risk assessment completed and saved',
    });
  } catch (dbError) {
    logger.warn('Failed to save assessment to database', { error: dbError.message });
    // Still return the assessment even if DB save fails
    res.json({
      success: true,
      data: assessment.toJSON(),
      message: 'Risk assessment completed (not saved to database)',
    });
  }
}));

apiRouter.post('/risk/quick-check', validate(quickCheckSchema), asyncHandler(async (req, res) => {
  const result = riskEngine.quickRiskCheck(req.body);
  res.json({
    success: true,
    data: result,
    message: 'Quick risk check completed',
  });
}));

// Model registry endpoints
// Model registry endpoints
apiRouter.get('/models', validate(listModelsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  console.log('📝 GET /models called with query:', req.query);
  try {
    const result = await RegisteredModel.listModels(req.query);
    console.log('✅ listModels result:', result);
    res.json({ success: true, ...result, message: 'Model list retrieved' });
  } catch (err) {
    console.error('❌ Error in GET /models:', err);
    throw err;
  }
}));

apiRouter.post('/models', validate(registerModelSchema), asyncHandler(async (req, res) => {
  try {
    const isValidObjectId = mongoose.Types.ObjectId.isValid(req.user?.id);
    
    const model = await RegisteredModel.create({
      modelId: req.body.modelId,
      modelName: req.body.modelName,
      version: req.body.version || '1.0.0',
      description: req.body.description,
      tags: req.body.tags || [],
      metadata: req.body.metadata || {},
      createdBy: isValidObjectId ? req.user.id : undefined
    });
    
    auditLog('model_registered', req.user?.id, { modelId: model.modelId });
    res.status(201).json({ success: true, data: model.toJSON(), message: 'Model registered' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ 
        status: 'fail', 
        message: 'Model with this modelId already exists' 
      });
    }
    throw error;
  }
}));

apiRouter.get('/models/:modelId', asyncHandler(async (req, res) => {
  const model = await RegisteredModel.findByModelId(req.params.modelId);
  if (!model) {
    return res.status(404).json({ status: 'fail', message: 'Model not found' });
  }
  res.json({ success: true, data: model.toJSON(), message: 'Model retrieved' });
}));

apiRouter.patch('/models/:modelId', validate(updateModelSchema), asyncHandler(async (req, res) => {
  const isValidObjectId = mongoose.Types.ObjectId.isValid(req.user?.id);
  
  const model = await RegisteredModel.findOneAndUpdate(
    { modelId: req.params.modelId },
    {
      $set: {
        ...req.body,
        updatedBy: isValidObjectId ? req.user.id : undefined
      }
    },
    { new: true, runValidators: true }
  );
  
  if (!model) {
    return res.status(404).json({ status: 'fail', message: 'Model not found' });
  }
  
  auditLog('model_updated', req.user?.id, { modelId: req.params.modelId });
  res.json({ success: true, data: model.toJSON(), message: 'Model updated' });
}));

apiRouter.delete('/models/:modelId', asyncHandler(async (req, res) => {
  const model = await RegisteredModel.findOneAndDelete({ modelId: req.params.modelId });
  
  if (!model) {
    return res.status(404).json({ status: 'fail', message: 'Model not found' });
  }
  
  // Also delete associated assessments
  await RiskAssessment.deleteMany({ modelId: req.params.modelId });
  
  auditLog('model_deleted', req.user?.id, { modelId: req.params.modelId });
  res.json({ success: true, message: 'Model deleted' });
}));
// Compliance endpoints
apiRouter.post('/compliance/check', validate(complianceCheckSchema), asyncHandler(async (req, res) => {
  const { modelId, framework } = req.body;
  // TODO: Implement actual compliance checking
  res.json({
    success: true,
    data: { modelId, framework, compliant: true, violations: [] },
    message: 'Compliance check completed',
  });
}));

apiRouter.get('/compliance/frameworks', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'eu-ai-act', name: 'EU AI Act', version: '2024' },
      { id: 'nist-ai-rmf', name: 'NIST AI RMF', version: '1.0' },
      { id: 'iso-42001', name: 'ISO/IEC 42001', version: '2023' }
    ],
    message: 'Available compliance frameworks'
  });
}));

// Assessment history endpoints
apiRouter.get('/assessments', validate(getAssessmentsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    startDate,
    endDate,
    severity,
    modelId
  } = req.query;

  const filter = {};
  
  if (modelId) filter.modelId = modelId;
  if (severity) filter.severity = severity;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
  
  const assessments = await RiskAssessment.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await RiskAssessment.countDocuments(filter);

  res.json({
    success: true,
    data: assessments,
    message: 'Assessment history retrieved',
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

apiRouter.get('/assessments/:assessmentId', asyncHandler(async (req, res) => {
  const assessment = await RiskAssessment.findById(req.params.assessmentId);
  if (!assessment) {
    return res.status(404).json({ status: 'fail', message: 'Assessment not found' });
  }
  res.json({ success: true, data: assessment.toJSON(), message: 'Assessment retrieved' });
}));
// Dashboard metrics endpoint (for dashboard UI)
apiRouter.get('/dashboard/metrics', asyncHandler(async (req, res) => {
  // Check if database is connected
  if (!mongoose.connection.readyState) {
    return res.json({
      success: true,
      data: {
        totalModels: 0,
        riskDistribution: { low: 0, medium: 0, high: 0 },
        averageRiskScore: 0,
        complianceRate: 100,
        recentAssessments: []
      },
      message: 'Dashboard metrics retrieved (no database connection)'
    });
  }

  // Get aggregated metrics from database
  try {
    const [
      totalModels,
      riskDistribution,
      avgRiskScoreResult,
      complianceRateResult,
      recentAssessments
    ] = await Promise.all([
      RegisteredModel.countDocuments(),
      RiskAssessment.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      RiskAssessment.aggregate([
        { $group: { _id: null, avgScore: { $avg: '$riskScore' } } }
      ]),
      RiskAssessment.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, compliant: { $sum: { $cond: ['$compliant', 1, 0] } } } }
      ]),
      RiskAssessment.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('modelId modelName riskScore severity createdAt')
        .lean()
    ]);

    const riskDist = { low: 0, medium: 0, high: 0 };
    riskDistribution.forEach(item => {
      if (item._id in riskDist) {
        riskDist[item._id] = item.count;
      }
    });

    const averageRiskScore = avgRiskScoreResult[0]?.avgScore ? Math.round(avgRiskScoreResult[0].avgScore) : 0;
    
    const complianceRate = complianceRateResult[0]?.total 
      ? Math.round((complianceRateResult[0].compliant / complianceRateResult[0].total) * 100) 
      : 100;

    res.json({
      success: true,
      data: {
        totalModels,
        riskDistribution: riskDist,
        averageRiskScore,
        complianceRate,
        recentAssessments
      },
      message: 'Dashboard metrics retrieved'
    });
  } catch (dbError) {
    logger.warn('Failed to fetch dashboard metrics from database', { error: dbError.message });
    res.json({
      success: true,
      data: {
        totalModels: 0,
        riskDistribution: { low: 0, medium: 0, high: 0 },
        averageRiskScore: 0,
        complianceRate: 100,
        recentAssessments: []
      },
      message: 'Dashboard metrics retrieved (database error)'
    });
  }
}));

app.use('/api/v1', apiRouter);

// Initialize Notification Manager
const alertStore = new MemoryAlertStore();
const notificationManager = new NotificationManager({
  alertStore,
  evaluationInterval: 60000, // 1 minute
  defaultChannels: []
});

// Initialize notification manager with default rules (async, will be called on first use)
let notificationManagerInitialized = false;
async function ensureNotificationManagerInitialized() {
  if (!notificationManagerInitialized) {
    await notificationManager.initialize();
    notificationManagerInitialized = true;
  }
}

// Alert API routes
const alertRouter = express.Router();
alertRouter.use(authenticateToken);

// Alert endpoints
alertRouter.get('/', validate(listAlertsQuerySchema, 'query'), asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    severity,
    status,
    category,
    modelId,
    startDate,
    endDate
  } = req.query;

  const filter = {};
  if (severity) filter.severity = severity;
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (modelId) filter.modelId = modelId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const alerts = await alertStore.findAlerts(filter, {
    sort,
    page: parseInt(page),
    limit: parseInt(limit)
  });

  const total = await alertStore.countAlerts(filter);

  res.json({
    success: true,
    data: alerts,
    message: 'Alerts retrieved',
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

alertRouter.post('/', validate(createAlertSchema), asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const alert = await notificationManager.createAlert(req.body);
  auditLog('alert_created', req.user?.id, { alertId: alert.id, title: alert.title });
  res.status(201).json({ success: true, data: alert.toJSON(), message: 'Alert created' });
}));

alertRouter.get('/:alertId', asyncHandler(async (req, res) => {
  const alert = await alertStore.findAlertById(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ status: 'fail', message: 'Alert not found' });
  }
  res.json({ success: true, data: alert.toJSON(), message: 'Alert retrieved' });
}));

alertRouter.patch('/:alertId', validate(updateAlertSchema), asyncHandler(async (req, res) => {
  const alert = await alertStore.findAlertById(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ status: 'fail', message: 'Alert not found' });
  }

  // Update alert properties
  Object.assign(alert, req.body);
  alert.updatedAt = new Date().toISOString();

  const updated = await alertStore.updateAlert(alert);
  auditLog('alert_updated', req.user?.id, { alertId: alert.id });
  res.json({ success: true, data: updated.toJSON(), message: 'Alert updated' });
}));

alertRouter.post('/:alertId/acknowledge', asyncHandler(async (req, res) => {
  const alert = await alertStore.findAlertById(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ status: 'fail', message: 'Alert not found' });
  }

  alert.acknowledge(req.user?.id || 'unknown');
  await alertStore.updateAlert(alert);
  auditLog('alert_acknowledged', req.user?.id, { alertId: alert.id });
  res.json({ success: true, data: alert.toJSON(), message: 'Alert acknowledged' });
}));

alertRouter.post('/:alertId/resolve', asyncHandler(async (req, res) => {
  const alert = await alertStore.findAlertById(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ status: 'fail', message: 'Alert not found' });
  }

  alert.resolve(req.user?.id || 'unknown');
  await alertStore.updateAlert(alert);
  auditLog('alert_resolved', req.user?.id, { alertId: alert.id });
  res.json({ success: true, data: alert.toJSON(), message: 'Alert resolved' });
}));

alertRouter.post('/:alertId/suppress', asyncHandler(async (req, res) => {
  const alert = await alertStore.findAlertById(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ status: 'fail', message: 'Alert not found' });
  }

  const { until } = req.body;
  alert.suppress(until || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  await alertStore.updateAlert(alert);
  auditLog('alert_suppressed', req.user?.id, { alertId: alert.id });
  res.json({ success: true, data: alert.toJSON(), message: 'Alert suppressed' });
}));

alertRouter.delete('/:alertId', asyncHandler(async (req, res) => {
  const deleted = await alertStore.deleteAlert(req.params.alertId);
  if (!deleted) {
    return res.status(404).json({ status: 'fail', message: 'Alert not found' });
  }
  auditLog('alert_deleted', req.user?.id, { alertId: req.params.alertId });
  res.json({ success: true, message: 'Alert deleted' });
}));

// Alert Rule endpoints
alertRouter.get('/rules', asyncHandler(async (req, res) => {
  const rules = await alertStore.findRules({});
  res.json({ success: true, data: rules, message: 'Alert rules retrieved' });
}));

alertRouter.post('/rules', validate(createAlertRuleSchema), asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const rule = await notificationManager.createRule(req.body);
  auditLog('alert_rule_created', req.user?.id, { ruleId: rule.id, name: rule.name });
  res.status(201).json({ success: true, data: rule.toJSON(), message: 'Alert rule created' });
}));

alertRouter.get('/rules/:ruleId', asyncHandler(async (req, res) => {
  const rule = await alertStore.findRuleById(req.params.ruleId);
  if (!rule) {
    return res.status(404).json({ status: 'fail', message: 'Alert rule not found' });
  }
  res.json({ success: true, data: rule.toJSON(), message: 'Alert rule retrieved' });
}));

alertRouter.patch('/rules/:ruleId', validate(updateAlertRuleSchema), asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const rule = await notificationManager.updateRule(req.params.ruleId, req.body);
  if (!rule) {
    return res.status(404).json({ status: 'fail', message: 'Alert rule not found' });
  }
  auditLog('alert_rule_updated', req.user?.id, { ruleId: rule.id });
  res.json({ success: true, data: rule.toJSON(), message: 'Alert rule updated' });
}));

alertRouter.delete('/rules/:ruleId', asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const deleted = await notificationManager.deleteRule(req.params.ruleId);
  if (!deleted) {
    return res.status(404).json({ status: 'fail', message: 'Alert rule not found' });
  }
  auditLog('alert_rule_deleted', req.user?.id, { ruleId: req.params.ruleId });
  res.json({ success: true, message: 'Alert rule deleted' });
}));

alertRouter.post('/rules/:ruleId/enable', asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const rule = await notificationManager.enableRule(req.params.ruleId, true);
  if (!rule) {
    return res.status(404).json({ status: 'fail', message: 'Alert rule not found' });
  }
  auditLog('alert_rule_enabled', req.user?.id, { ruleId: rule.id });
  res.json({ success: true, data: rule.toJSON(), message: 'Alert rule enabled' });
}));

alertRouter.post('/rules/:ruleId/disable', asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const rule = await notificationManager.enableRule(req.params.ruleId, false);
  if (!rule) {
    return res.status(404).json({ status: 'fail', message: 'Alert rule not found' });
  }
  auditLog('alert_rule_disabled', req.user?.id, { ruleId: rule.id });
  res.json({ success: true, data: rule.toJSON(), message: 'Alert rule disabled' });
}));

alertRouter.post('/rules/:ruleId/trigger', asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const alert = await notificationManager.triggerRule(req.params.ruleId, req.body || {});
  if (!alert) {
    return res.status(404).json({ status: 'fail', message: 'Alert rule not found or not triggered' });
  }
  auditLog('alert_rule_triggered', req.user?.id, { ruleId: req.params.ruleId, alertId: alert.id });
  res.json({ success: true, data: alert.toJSON(), message: 'Alert rule triggered manually' });
}));

// Channel Config endpoints
alertRouter.get('/channels', asyncHandler(async (req, res) => {
  const channels = await alertStore.findChannelConfigs({});
  res.json({ success: true, data: channels, message: 'Channel configs retrieved' });
}));

alertRouter.post('/channels', validate(createChannelConfigSchema), asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const channelConfig = await notificationManager.createChannelConfig(req.body);
  auditLog('channel_config_created', req.user?.id, { channelId: channelConfig.id, name: channelConfig.name });
  res.status(201).json({ success: true, data: channelConfig.toJSON(), message: 'Channel config created' });
}));

alertRouter.get('/channels/:channelId', asyncHandler(async (req, res) => {
  const channelConfig = await alertStore.findChannelConfigById(req.params.channelId);
  if (!channelConfig) {
    return res.status(404).json({ status: 'fail', message: 'Channel config not found' });
  }
  res.json({ success: true, data: channelConfig.toJSON(), message: 'Channel config retrieved' });
}));

alertRouter.patch('/channels/:channelId', validate(updateChannelConfigSchema), asyncHandler(async (req, res) => {
  const channelConfig = await alertStore.findChannelConfigById(req.params.channelId);
  if (!channelConfig) {
    return res.status(404).json({ status: 'fail', message: 'Channel config not found' });
  }

  Object.assign(channelConfig, req.body);
  channelConfig.updatedAt = new Date().toISOString();

  const updated = await alertStore.updateChannelConfig(channelConfig);
  auditLog('channel_config_updated', req.user?.id, { channelId: channelConfig.id });
  res.json({ success: true, data: updated.toJSON(), message: 'Channel config updated' });
}));

alertRouter.delete('/channels/:channelId', asyncHandler(async (req, res) => {
  const deleted = await alertStore.deleteChannelConfig(req.params.channelId);
  if (!deleted) {
    return res.status(404).json({ status: 'fail', message: 'Channel config not found' });
  }
  auditLog('channel_config_deleted', req.user?.id, { channelId: req.params.channelId });
  res.json({ success: true, message: 'Channel config deleted' });
}));

// Alert stats endpoint
alertRouter.get('/stats/summary', asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const stats = await notificationManager.getAlertStats();
  res.json({ success: true, data: stats, message: 'Alert statistics retrieved' });
}));

alertRouter.post('/test', asyncHandler(async (req, res) => {
  await ensureNotificationManagerInitialized();
  const alert = await notificationManager.createAlert({
    title: 'Test Alert',
    message: 'This is a test alert from the API',
    severity: 'info',
    category: 'system',
    source: 'api-test'
  });
  auditLog('test_alert_triggered', req.user?.id, { alertId: alert.id });
  res.json({ success: true, data: alert.toJSON(), message: 'Test alert created and sent' });
}));

app.use('/api/v1/alerts', alertRouter);

// Public API routes (optional auth for dashboard)
const publicRouter = express.Router();
publicRouter.use(optionalAuth);

publicRouter.post('/risk/quick-check', validate(quickCheckSchema), asyncHandler(async (req, res) => {
  const result = riskEngine.quickRiskCheck(req.body);
  res.json({
    success: true,
    data: result,
    message: 'Quick risk check completed',
  });
}));

app.use('/api/public', publicRouter);

// Serve static dashboard from public directory
app.use('/dashboard', express.static(path.join('public', 'index.html')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'fail', message: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Database connection function - can be called after config is set
let dbConnected = false;

async function initializeDatabase() {
  if (dbConnected) return;
  try {
    await connectDB();
    logger.info('Database connected successfully');
    dbConnected = true;
  } catch (err) {
    logger.warn('Database connection failed - running without DB', { error: err.message });
  }
}

// Start server based on environment
// Use environment variable to detect test mode
const isTestMode = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
let server;
let serverStarted = false;

async function startServer() {
  if (serverStarted) return server;
  
  if (!isTestMode) {
    // For direct execution, connect DB and start server
    await initializeDatabase();
    server = app.listen(PORT, () => {
      logger.info(`AI Risk Manager running on port ${PORT}`, { 
        environment: config.env,
        dashboard: `http://localhost:${PORT}/dashboard`
      });
    });
  } else {
    // For testing, DON'T connect to DB immediately - only when needed
    server = app.listen(0); // Use port 0 for testing
  }
  serverStarted = true;
  return server;
}

// Auto-start server for non-test environments
if (!isTestMode) {
  startServer();
}

// Export both app and server for testing
export { app, server, initializeDatabase };

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