import { queues, QUEUE_NAMES, JobTypes, closeQueues } from './queues/index.js';
import { createLLMSystem } from '../llm/index.js';
import { NotificationManager, MemoryAlertStore } from '../alerts/index.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

// Initialize LLM system for background jobs
const llmSystem = createLLMSystem({ skipValidation: true });

// Initialize notification manager for alert processing
const alertStore = new MemoryAlertStore();
const notificationManager = new NotificationManager({
  alertStore,
  evaluationInterval: 0, // Disable auto-evaluation in worker
  defaultChannels: []
});

async function initializeNotificationManager() {
  await notificationManager.initialize();
}

console.log('🔧 Starting job queue workers...');

// ============================================
// LLM Risk Analysis Job Processor
// ============================================
if (queues[QUEUE_NAMES.LLM_ANALYSIS]) {
  queues[QUEUE_NAMES.LLM_ANALYSIS].process(JobTypes.LLM_RISK_ANALYSIS, async (job) => {
    const { modelInfo, options = {} } = job.data;
    
    logger.info('Processing LLM risk analysis job', { 
      jobId: job.id,
      modelId: modelInfo.modelId 
    });

    if (!llmSystem.engines.riskAnalysis) {
      throw new Error('Risk analysis engine not configured');
    }

    const result = await llmSystem.engines.riskAnalysis.analyzeModel(modelInfo, options);
    
    logger.info('LLM risk analysis job completed', { 
      jobId: job.id,
      riskScore: result.riskScore 
    });

    return result;
  });

  queues[QUEUE_NAMES.LLM_ANALYSIS].on('completed', (job) => {
    logger.debug('LLM risk analysis job completed', { jobId: job.id });
  });

  queues[QUEUE_NAMES.LLM_ANALYSIS].on('failed', (job, err) => {
    logger.error('LLM risk analysis job failed', { 
      jobId: job.id, 
      error: err.message 
    });
  });

  console.log('✅ LLM Analysis queue worker started');
}

// ============================================
// LLM Compliance Check Job Processor
// ============================================
if (queues[QUEUE_NAMES.COMPLIANCE_CHECK]) {
  queues[QUEUE_NAMES.COMPLIANCE_CHECK].process(JobTypes.LLM_COMPLIANCE, async (job) => {
    const { modelInfo, framework, options = {} } = job.data;
    
    logger.info('Processing LLM compliance check job', { 
      jobId: job.id,
      modelId: modelInfo.modelId,
      framework 
    });

    if (!llmSystem.engines.complianceChecker) {
      throw new Error('Compliance checker engine not configured');
    }

    const result = await llmSystem.engines.complianceChecker.checkCompliance(modelInfo, framework, options);
    
    logger.info('LLM compliance check job completed', { 
      jobId: job.id,
      compliant: result.compliant 
    });

    return result;
  });

  queues[QUEUE_NAMES.COMPLIANCE_CHECK].on('completed', (job) => {
    logger.debug('LLM compliance check job completed', { jobId: job.id });
  });

  queues[QUEUE_NAMES.COMPLIANCE_CHECK].on('failed', (job, err) => {
    logger.error('LLM compliance check job failed', { 
      jobId: job.id, 
      error: err.message 
    });
  });

  console.log('✅ Compliance Check queue worker started');
}

// ============================================
// LLM Model Card Generation Job Processor
// ============================================
if (queues[QUEUE_NAMES.MODEL_CARD]) {
  queues[QUEUE_NAMES.MODEL_CARD].process(JobTypes.LLM_MODEL_CARD, async (job) => {
    const { modelInfo, options = {} } = job.data;
    
    logger.info('Processing LLM model card generation job', { 
      jobId: job.id,
      modelId: modelInfo.modelId 
    });

    if (!llmSystem.engines.modelCardGenerator) {
      throw new Error('Model card generator engine not configured');
    }

    const result = await llmSystem.engines.modelCardGenerator.generateModelCard(modelInfo, options);
    
    logger.info('LLM model card generation job completed', { 
      jobId: job.id 
    });

    return result;
  });

  queues[QUEUE_NAMES.MODEL_CARD].on('completed', (job) => {
    logger.debug('LLM model card generation job completed', { jobId: job.id });
  });

  queues[QUEUE_NAMES.MODEL_CARD].on('failed', (job, err) => {
    logger.error('LLM model card generation job failed', { 
      jobId: job.id, 
      error: err.message 
    });
  });

  console.log('✅ Model Card queue worker started');
}

// ============================================
// Alert Notification Job Processor
// ============================================
if (queues[QUEUE_NAMES.ALERT_NOTIFICATION]) {
  queues[QUEUE_NAMES.ALERT_NOTIFICATION].process(JobTypes.SEND_ALERT, async (job) => {
    const { alert, channels } = job.data;
    
    logger.info('Processing alert notification job', { 
      jobId: job.id,
      alertId: alert.id,
      channels: channels?.length 
    });

    await initializeNotificationManager();
    
    const results = await notificationManager.sendNotifications(alert, channels);
    
    logger.info('Alert notification job completed', { 
      jobId: job.id,
      results 
    });

    return results;
  });

  queues[QUEUE_NAMES.ALERT_NOTIFICATION].on('completed', (job) => {
    logger.debug('Alert notification job completed', { jobId: job.id });
  });

  queues[QUEUE_NAMES.ALERT_NOTIFICATION].on('failed', (job, err) => {
    logger.error('Alert notification job failed', { 
      jobId: job.id, 
      error: err.message 
    });
  });

  console.log('✅ Alert Notification queue worker started');
}

// ============================================
// Graceful shutdown
// ============================================
async function shutdown() {
  console.log('🛑 Shutting down workers...');
  await closeQueues();
  console.log('✅ Workers shut down complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('🎉 All queue workers started successfully!');
console.log('📋 Workers running:');
Object.keys(queues).forEach(name => {
  if (queues[name]) console.log(`   - ${name}`);
});

// Keep process alive
setInterval(() => {}, 1000);