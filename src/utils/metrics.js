import client from 'prom-client';

// Create a Registry which registers the metrics
export const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'ai-risk-manager',
});

// Enable collection of default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register, prefix: 'ai_risk_manager_' });

// Custom metrics
export const httpRequestsTotal = new client.Counter({
  name: 'ai_risk_manager_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'ai_risk_manager_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const activeUsers = new client.Gauge({
  name: 'ai_risk_manager_active_users',
  help: 'Number of active users',
  registers: [register],
});

export const llmRequestsTotal = new client.Counter({
  name: 'ai_risk_manager_llm_requests_total',
  help: 'Total number of LLM API requests',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
});

export const llmRequestDuration = new client.Histogram({
  name: 'ai_risk_manager_llm_request_duration_seconds',
  help: 'Duration of LLM API requests in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const riskAssessmentsTotal = new client.Counter({
  name: 'ai_risk_manager_risk_assessments_total',
  help: 'Total number of risk assessments',
  labelNames: ['severity', 'compliant'],
  registers: [register],
});

export const alertTriggeredTotal = new client.Counter({
  name: 'ai_risk_manager_alerts_triggered_total',
  help: 'Total number of alerts triggered',
  labelNames: ['severity', 'category'],
  registers: [register],
});

export const modelsRegistered = new client.Gauge({
  name: 'ai_risk_manager_models_registered',
  help: 'Number of registered models',
  registers: [register],
});

export const dbConnections = new client.Gauge({
  name: 'ai_risk_manager_db_connections',
  help: 'Number of database connections',
  labelNames: ['state'],
  registers: [register],
});

export const queueJobs = new client.Gauge({
  name: 'ai_risk_manager_queue_jobs',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'status'],
  registers: [register],
});

// Middleware to track HTTP metrics
export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.originalUrl || 'unknown';
    
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration);
  });
  
  next();
}

// Helper functions
export function recordLlmRequest(provider, model, status, durationSeconds) {
  llmRequestsTotal.inc({ provider, model, status });
  llmRequestDuration.observe({ provider, model }, durationSeconds);
}

export function recordRiskAssessment(severity, compliant) {
  riskAssessmentsTotal.inc({ severity, compliant: compliant ? 'true' : 'false' });
}

export function recordAlert(severity, category) {
  alertTriggeredTotal.inc({ severity, category });
}

export function updateModelsCount(count) {
  modelsRegistered.set(count);
}

export function updateDbConnections(state, count) {
  dbConnections.set({ state }, count);
}

export function updateQueueJobs(queue, status, count) {
  queueJobs.set({ queue, status }, count);
}

export async function getMetrics() {
  return register.metrics();
}

export async function getMetricsAsJson() {
  return register.getMetricsAsJSON();
}

export { client };