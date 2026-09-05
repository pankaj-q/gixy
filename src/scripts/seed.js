// Database seeding script for Gixy AI Risk Manager
// Run with: npm run db:seed

import { connectDB, disconnectDB } from '../config/db.js';
import { User, Model, Assessment, Alert, AlertRule, AlertChannel } from '../models/index.js';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

async function seedDatabase() {
  try {
    await connectDB();
    logger.info('Connected to database, starting seed...');

    // Clear existing data (optional - comment out for production)
    // await User.deleteMany({});
    // await Model.deleteMany({});
    // await Assessment.deleteMany({});
    // await Alert.deleteMany({});
    // await AlertRule.deleteMany({});
    // await AlertChannel.deleteMany({});

    // Create admin user
    const adminPassword = await bcrypt.hash('Admin123!', 12);
    const admin = await User.findOneAndUpdate(
      { email: 'admin@gixy.ai' },
      {
        email: 'admin@gixy.ai',
        password: adminPassword,
        name: 'System Administrator',
        role: 'admin',
        isActive: true,
      },
      { upsert: true, new: true }
    );
    logger.info('Admin user created/updated', { id: admin._id });

    // Create analyst user
    const analystPassword = await bcrypt.hash('Analyst123!', 12);
    const analyst = await User.findOneAndUpdate(
      { email: 'analyst@gixy.ai' },
      {
        email: 'analyst@gixy.ai',
        password: analystPassword,
        name: 'Risk Analyst',
        role: 'analyst',
        isActive: true,
      },
      { upsert: true, new: true }
    );
    logger.info('Analyst user created/updated', { id: analyst._id });

    // Create viewer user
    const viewerPassword = await bcrypt.hash('Viewer123!', 12);
    const viewer = await User.findOneAndUpdate(
      { email: 'viewer@gixy.ai' },
      {
        email: 'viewer@gixy.ai',
        password: viewerPassword,
        name: 'Compliance Viewer',
        role: 'viewer',
        isActive: true,
      },
      { upsert: true, new: true }
    );
    logger.info('Viewer user created/updated', { id: viewer._id });

    // Create sample models
    const models = [
      {
        modelId: 'fraud-detector-v3',
        name: 'Fraud Detection Model v3',
        type: 'classification',
        framework: 'xgboost',
        version: '1.3.0',
        owner: admin._id,
        deploymentContext: 'Real-time transaction scoring for payment processing',
        riskScore: 42,
        status: 'active',
        tags: ['finance', 'fraud', 'production'],
        metadata: {
          trainingData: { size: 500000, features: 45 },
          metrics: { accuracy: 0.94, precision: 0.91, recall: 0.89, f1: 0.90, aucRoc: 0.96 },
        },
      },
      {
        modelId: 'credit-scoring-v2',
        name: 'Credit Scoring Model v2',
        type: 'classification',
        framework: 'lightgbm',
        version: '2.1.0',
        owner: admin._id,
        deploymentContext: 'Loan approval decisions for consumer lending',
        riskScore: 65,
        status: 'review',
        tags: ['finance', 'credit', 'high-risk'],
        metadata: {
          trainingData: { size: 200000, features: 38 },
          metrics: { accuracy: 0.87, precision: 0.84, recall: 0.82, f1: 0.83, aucRoc: 0.91 },
        },
      },
      {
        modelId: 'llm-chat-assistant',
        name: 'Customer Support LLM Assistant',
        type: 'generative',
        framework: 'pytorch',
        version: '1.0.0',
        owner: analyst._id,
        deploymentContext: 'Automated customer support chatbot',
        riskScore: 58,
        status: 'active',
        tags: ['nlp', 'generative', 'customer-service'],
        metadata: {
          trainingData: { size: 1000000, features: 'N/A' },
          metrics: { perplexity: 12.5, bleu: 0.42, rouge: 0.38 },
        },
      },
      {
        modelId: 'medical-image-classifier',
        name: 'Medical Image Classifier',
        type: 'classification',
        framework: 'tensorflow',
        version: '3.2.1',
        owner: analyst._id,
        deploymentContext: 'Radiology image classification for diagnostic assistance',
        riskScore: 72,
        status: 'review',
        tags: ['healthcare', 'medical', 'high-risk', 'regulated'],
        metadata: {
          trainingData: { size: 50000, features: 'N/A' },
          metrics: { accuracy: 0.93, precision: 0.91, recall: 0.88, f1: 0.89, aucRoc: 0.97 },
        },
      },
      {
        modelId: 'recommendation-engine',
        name: 'Product Recommendation Engine',
        type: 'recommendation',
        framework: 'pytorch',
        version: '2.0.0',
        owner: viewer._id,
        deploymentContext: 'E-commerce product recommendations',
        riskScore: 31,
        status: 'active',
        tags: ['ecommerce', 'recommendation', 'personalization'],
        metadata: {
          trainingData: { size: 10000000, features: 128 },
          metrics: { ndcg: 0.72, map: 0.45, recall_at_10: 0.68 },
        },
      },
    ];

    for (const modelData of models) {
      await Model.findOneAndUpdate(
        { modelId: modelData.modelId },
        modelData,
        { upsert: true, new: true }
      );
      logger.info('Model created/updated', { modelId: modelData.modelId });
    }

    // Create sample alert channels
    const emailChannel = await AlertChannel.findOneAndUpdate(
      { name: 'Default Email Alerts' },
      {
        name: 'Default Email Alerts',
        type: 'email',
        config: {
          host: process.env.SMTP_HOST || 'smtp.example.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER || 'alerts@example.com',
            pass: process.env.SMTP_PASS || 'password',
          },
          from: process.env.ALERT_FROM_EMAIL || 'alerts@example.com',
        },
        enabled: false, // Disabled until configured
        createdBy: admin._id,
      },
      { upsert: true, new: true }
    );
    logger.info('Email alert channel created/updated', { id: emailChannel._id });

    const slackChannel = await AlertChannel.findOneAndUpdate(
      { name: 'Slack Alerts' },
      {
        name: 'Slack Alerts',
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        },
        enabled: false,
        createdBy: admin._id,
      },
      { upsert: true, new: true }
    );
    logger.info('Slack alert channel created/updated', { id: slackChannel._id });

    // Create sample alert rules
    const highRiskRule = await AlertRule.findOneAndUpdate(
      { name: 'High Risk Model Alert' },
      {
        name: 'High Risk Model Alert',
        description: 'Trigger when a model risk score exceeds 70',
        condition: {
          type: 'modelRiskScore',
          operator: 'gt',
          threshold: 70,
        },
        severity: 'high',
        channels: [emailChannel._id, slackChannel._id],
        enabled: true,
        cooldownMinutes: 60,
        createdBy: admin._id,
      },
      { upsert: true, new: true }
    );
    logger.info('High risk alert rule created/updated', { id: highRiskRule._id });

    const criticalRiskRule = await AlertRule.findOneAndUpdate(
      { name: 'Critical Risk Model Alert' },
      {
        name: 'Critical Risk Model Alert',
        description: 'Trigger when a model risk score exceeds 85',
        condition: {
          type: 'modelRiskScore',
          operator: 'gt',
          threshold: 85,
        },
        severity: 'critical',
        channels: [emailChannel._id, slackChannel._id],
        enabled: true,
        cooldownMinutes: 30,
        createdBy: admin._id,
      },
      { upsert: true, new: true }
    );
    logger.info('Critical risk alert rule created/updated', { id: criticalRiskRule._id });

    const driftRule = await AlertRule.findOneAndUpdate(
      { name: 'Data Drift Detection' },
      {
        name: 'Data Drift Detection',
        description: 'Trigger when data drift is detected in production models',
        condition: {
          type: 'dataDrift',
          operator: 'gt',
          threshold: 0.3,
        },
        severity: 'medium',
        channels: [emailChannel._id],
        enabled: true,
        cooldownMinutes: 120,
        createdBy: analyst._id,
      },
      { upsert: true, new: true }
    );
    logger.info('Data drift alert rule created/updated', { id: driftRule._id });

    // Create sample assessments
    const sampleModels = await Model.find({}).lean();
    for (const model of sampleModels.slice(0, 3)) {
      const assessment = await Assessment.findOneAndUpdate(
        { modelId: model._id, type: 'llm', status: 'completed' },
        {
          modelId: model._id,
          type: 'llm',
          status: 'completed',
          requestedBy: admin._id,
          riskFactors: ['bias', 'security', 'performance', 'privacy', 'robustness'],
          results: {
            bias: { score: Math.floor(Math.random() * 40) + 20, level: 'medium', findings: ['Gender parity: 0.72', 'Racial parity: 0.68'] },
            security: { score: Math.floor(Math.random() * 30) + 10, level: 'low', findings: ['No prompt injection vulnerabilities detected'] },
            performance: { score: Math.floor(Math.random() * 20) + 5, level: 'low', findings: ['Latency within SLA'] },
            privacy: { score: Math.floor(Math.random() * 50) + 30, level: 'medium', findings: ['PII detection in training data'] },
            robustness: { score: Math.floor(Math.random() * 35) + 15, level: 'low', findings: ['Adversarial robustness acceptable'] },
          },
          overallScore: Math.floor(Math.random() * 40) + 30,
          riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          provider: 'gemini',
          modelConfig: { type: model.type, framework: model.framework },
          metrics: model.metadata?.metrics || {},
          completedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      logger.info('Sample assessment created/updated', { id: assessment._id, modelId: model.modelId });
    }

    // Create sample alerts
    const alerts = [
      {
        title: 'High Risk Score Detected',
        message: 'Model "credit-scoring-v2" has risk score of 65 (threshold: 60)',
        severity: 'high',
        source: 'modelRiskScore',
        sourceId: (await Model.findOne({ modelId: 'credit-scoring-v2' }))?._id,
        status: 'active',
        tags: ['risk-threshold', 'credit-model'],
        metadata: { riskScore: 65, threshold: 60 },
      },
      {
        title: 'Data Drift Alert',
        message: 'Significant data drift detected in "fraud-detector-v3" (PSI: 0.35)',
        severity: 'medium',
        source: 'dataDrift',
        sourceId: (await Model.findOne({ modelId: 'fraud-detector-v3' }))?._id,
        status: 'acknowledged',
        acknowledgedBy: analyst._id,
        acknowledgedAt: new Date(Date.now() - 3600000),
        tags: ['drift', 'fraud-model'],
        metadata: { psi: 0.35, threshold: 0.3 },
      },
      {
        title: 'Critical Risk - Medical Model',
        message: 'Model "medical-image-classifier" risk score 72 exceeds critical threshold for healthcare',
        severity: 'critical',
        source: 'modelRiskScore',
        sourceId: (await Model.findOne({ modelId: 'medical-image-classifier' }))?._id,
        status: 'resolved',
        resolvedBy: admin._id,
        resolvedAt: new Date(Date.now() - 86400000),
        tags: ['critical', 'healthcare', 'compliance'],
        metadata: { riskScore: 72, regulatoryFramework: 'HIPAA' },
      },
    ];

    for (const alertData of alerts) {
      await Alert.findOneAndUpdate(
        { title: alertData.title, sourceId: alertData.sourceId },
        alertData,
        { upsert: true, new: true }
      );
      logger.info('Sample alert created/updated', { title: alertData.title });
    }

    logger.info('Database seeding completed successfully!');
    logger.info('Created users: admin@gixy.ai / Admin123!, analyst@gixy.ai / Analyst123!, viewer@gixy.ai / Viewer123!');
    logger.info('Created models: 5 sample models');
    logger.info('Created alert channels: Email, Slack (disabled - configure in .env)');
    logger.info('Created alert rules: High Risk, Critical Risk, Data Drift');
    logger.info('Created assessments: 3 sample LLM assessments');
    logger.info('Created alerts: 3 sample alerts (active, acknowledged, resolved)');

  } catch (error) {
    logger.error('Seeding failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seedDatabase();