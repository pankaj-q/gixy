import Queue from 'bull';
import { getRedisClient } from '../config/redis.js';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

const redisClient = getRedisClient();

if (!redisClient) {
  console.warn('⚠️ Redis not configured - job queues disabled');
}

// Queue names
export const QUEUE_NAMES = {
  LLM_ANALYSIS: 'llm-analysis',
  COMPLIANCE_CHECK: 'compliance-check',
  MODEL_CARD: 'model-card',
  ALERT_NOTIFICATION: 'alert-notification',
};

// Create queues
function createQueue(name) {
  if (!redisClient) return null;
  return new Queue(name, {
    redis: redisClient,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });
}

export const queues = {
  [QUEUE_NAMES.LLM_ANALYSIS]: createQueue(QUEUE_NAMES.LLM_ANALYSIS),
  [QUEUE_NAMES.COMPLIANCE_CHECK]: createQueue(QUEUE_NAMES.COMPLIANCE_CHECK),
  [QUEUE_NAMES.MODEL_CARD]: createQueue(QUEUE_NAMES.MODEL_CARD),
  [QUEUE_NAMES.ALERT_NOTIFICATION]: createQueue(QUEUE_NAMES.ALERT_NOTIFICATION),
};

// Job data types
export const JobTypes = {
  LLM_RISK_ANALYSIS: 'llm-risk-analysis',
  LLM_COMPLIANCE: 'llm-compliance',
  LLM_MODEL_CARD: 'llm-model-card',
  SEND_ALERT: 'send-alert',
};

// Add jobs to queues
export async function addLlmRiskAnalysisJob(data) {
  if (!queues[QUEUE_NAMES.LLM_ANALYSIS]) throw new Error('LLM Analysis queue not available');
  return queues[QUEUE_NAMES.LLM_ANALYSIS].add(JobTypes.LLM_RISK_ANALYSIS, data);
}

export async function addLlmComplianceJob(data) {
  if (!queues[QUEUE_NAMES.COMPLIANCE_CHECK]) throw new Error('Compliance Check queue not available');
  return queues[QUEUE_NAMES.COMPLIANCE_CHECK].add(JobTypes.LLM_COMPLIANCE, data);
}

export async function addLlmModelCardJob(data) {
  if (!queues[QUEUE_NAMES.MODEL_CARD]) throw new Error('Model Card queue not available');
  return queues[QUEUE_NAMES.MODEL_CARD].add(JobTypes.LLM_MODEL_CARD, data);
}

export async function addAlertNotificationJob(data) {
  if (!queues[QUEUE_NAMES.ALERT_NOTIFICATION]) throw new Error('Alert Notification queue not available');
  return queues[QUEUE_NAMES.ALERT_NOTIFICATION].add(JobTypes.SEND_ALERT, data);
}

// Get queue stats
export async function getQueueStats() {
  const stats = {};
  for (const [name, queue] of Object.entries(queues)) {
    if (queue) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      stats[name] = { waiting: waiting.length, active: active.length, completed: completed.length, failed: failed.length };
    }
  }
  return stats;
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all(Object.values(queues).filter(q => q).map(q => q.close()));
}

export { queues as jobQueues };