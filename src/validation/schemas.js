import Joi from 'joi';

/**
 * Validation schemas for API endpoints
 */

import { AlertSeverity, AlertStatus, AlertCategory, AlertChannel } from '../alerts/types.js';

// Common schemas
export const modelIdSchema = Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(1).max(100).required()
  .messages({
    'string.pattern.base': 'modelId can only contain alphanumeric characters, underscores, and hyphens',
    'string.min': 'modelId cannot be empty',
    'string.max': 'modelId cannot exceed 100 characters',
    'any.required': 'modelId is required'
  });

export const modelNameSchema = Joi.string().min(1).max(200).required()
  .messages({
    'string.min': 'modelName cannot be empty',
    'string.max': 'modelName cannot exceed 200 characters',
    'any.required': 'modelName is required'
  });

export const versionSchema = Joi.string().pattern(/^\d+\.\d+\.\d+$/).optional()
  .messages({
    'string.pattern.base': 'version must be in semver format (x.y.z)'
  });

export const riskFactorsSchema = Joi.array().items(
  Joi.string().valid('bias', 'fairness', 'security', 'vulnerability', 'performance', 'compliance', 'safety', 'privacy')
).min(0).max(20).optional();

export const trainingDataSchema = Joi.object({
  stats: Joi.object().pattern(Joi.string(), Joi.object({
    inputDistribution: Joi.object().pattern(Joi.string(), Joi.number().min(0)).required(),
    outputDistribution: Joi.object().pattern(Joi.string(), Joi.number().min(0)).required()
  })).optional(),
  sensitivityLabel: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  size: Joi.number().min(0).optional()
}).optional();

export const modelConfigSchema = Joi.object({
  outputDistribution: Joi.object().pattern(Joi.string(), Joi.number().min(0)).optional(),
  inputDistribution: Joi.object().pattern(Joi.string(), Joi.number().min(0)).optional(),
  dataSanitization: Joi.boolean().optional(),
  adversarialTraining: Joi.boolean().optional(),
  apiRateLimits: Joi.boolean().optional(),
  differentialPrivacy: Joi.boolean().optional(),
  privacyBudget: Joi.number().min(0).max(1).optional()
}).optional();

export const metricsSchema = Joi.object({
  accuracy: Joi.number().min(0).max(100).optional(),
  precision: Joi.number().min(0).max(100).optional(),
  recall: Joi.number().min(0).max(100).optional(),
  f1_score: Joi.number().min(0).max(100).optional(),
  latency: Joi.number().min(0).optional(),
  throughput: Joi.number().min(0).optional(),
  dataset: Joi.string().valid('train', 'test', 'validation').optional()
}).optional();

export const frameworkSchema = Joi.string().valid('eu-ai-act', 'nist-ai-rmf', 'iso-42001', 'custom').required()
  .messages({
    'any.only': 'framework must be one of: eu-ai-act, nist-ai-rmf, iso-42001, custom',
    'any.required': 'framework is required'
  });

// Request body schemas
export const assessRiskSchema = Joi.object({
  modelId: modelIdSchema,
  modelName: modelNameSchema,
  version: versionSchema,
  riskFactors: riskFactorsSchema,
  trainingData: trainingDataSchema,
  modelConfig: modelConfigSchema,
  metrics: metricsSchema
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const quickCheckSchema = Joi.object({
  modelId: modelIdSchema,
  modelName: modelNameSchema,
  modelConfig: Joi.object({
    type: Joi.string().valid('classification', 'regression', 'generative', 'clustering', 'recommendation', 'anomaly_detection', 'other').optional(),
    framework: Joi.string().valid('xgboost', 'lightgbm', 'pytorch', 'tensorflow', 'sklearn', 'onnx', 'other').optional(),
    algorithm: Joi.string().optional(),
    hyperparameters: Joi.object().optional()
  }).optional(),
  deploymentContext: Joi.string().max(2000).optional(),
  riskFactors: riskFactorsSchema,
  metrics: Joi.object({
    accuracy: Joi.number().min(0).max(1).optional(),
    precision: Joi.number().min(0).max(1).optional(),
    recall: Joi.number().min(0).max(1).optional(),
    f1: Joi.number().min(0).max(1).optional(),
    f1Score: Joi.number().min(0).max(1).optional(),
    f1_score: Joi.number().min(0).max(1).optional(),
    aucRoc: Joi.number().min(0).max(1).optional(),
    rmse: Joi.number().min(0).optional(),
    mae: Joi.number().min(0).optional(),
    r2: Joi.number().min(0).max(1).optional()
  }).optional(),
  useLLM: Joi.boolean().optional()
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const complianceCheckSchema = Joi.object({
  modelId: modelIdSchema,
  framework: frameworkSchema
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const registerModelSchema = Joi.object({
  modelId: modelIdSchema,
  modelName: modelNameSchema,
  version: versionSchema,
  description: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  metadata: Joi.object().optional()
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const updateModelSchema = Joi.object({
  modelName: modelNameSchema.optional(),
  version: versionSchema,
  description: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  metadata: Joi.object().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
  'object.unknown': 'Unknown field: {{#key}}'
});

// Auth schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  name: Joi.string().min(1).max(100).required(),
  role: Joi.string().valid('admin', 'analyst', 'viewer').optional()
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

// Query parameter schemas
export const listModelsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'modelName', 'riskScore').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  severity: Joi.string().valid('low', 'medium', 'high').optional(),
  search: Joi.string().max(100).optional()
}).optional().messages({
  'object.unknown': 'Unknown query parameter: {{#key}}'
});

export const getAssessmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'riskScore', 'severity').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  severity: Joi.string().valid('low', 'medium', 'high').optional(),
  modelId: Joi.string().max(100).optional()
}).optional();

// Validation middleware factory
export function validate(schema, property = 'body') {
  return (req, res, next) => {
    console.log(`🔍 [validate] Validating ${property} for ${req.method} ${req.path}:`, req[property]);
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      console.log('❌ [validate] Validation error:', details);
      return res.status(400).json({
        status: 'fail',
        message: 'Validation error',
        errors: details
      });
    }

    console.log('✅ [validate] Validation passed, value:', value);
    req[property] = value;
    next();
  };
}

// Alert validation schemas
export const severitySchema = Joi.string().valid(...Object.values(AlertSeverity)).optional()
  .messages({
    'any.only': 'severity must be one of: info, warning, critical, emergency'
  });

export const statusSchema = Joi.string().valid(...Object.values(AlertStatus)).optional()
  .messages({
    'any.only': 'status must be one of: active, acknowledged, resolved, suppressed'
  });

export const categorySchema = Joi.string().valid(...Object.values(AlertCategory)).optional()
  .messages({
    'any.only': 'category must be one of: model_risk, compliance, performance, security, data_quality, infrastructure, system'
  });

export const channelTypeSchema = Joi.string().valid(...Object.values(AlertChannel)).optional()
  .messages({
    'any.only': 'channel type must be one of: email, webhook, slack, pagerduty, opsgenie, sms, in_app'
  });

export const createAlertSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  message: Joi.string().min(1).max(2000).required(),
  severity: severitySchema,
  status: statusSchema,
  category: categorySchema,
  source: Joi.string().max(100).optional(),
  modelId: Joi.string().max(100).optional(),
  assessmentId: Joi.string().max(100).optional(),
  metadata: Joi.object().optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  runbookUrl: Joi.string().uri().optional(),
  dashboardUrl: Joi.string().uri().optional()
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const updateAlertSchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  message: Joi.string().min(1).max(2000).optional(),
  severity: severitySchema,
  status: statusSchema,
  metadata: Joi.object().optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  runbookUrl: Joi.string().uri().optional(),
  dashboardUrl: Joi.string().uri().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
  'object.unknown': 'Unknown field: {{#key}}'
});

export const createAlertRuleSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).optional(),
  enabled: Joi.boolean().optional(),
  category: categorySchema,
  severity: severitySchema,
  conditions: Joi.array().items(
    Joi.object({
      field: Joi.string().required(),
      operator: Joi.string().valid('eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'in', 'not_in', 'regex', 'exists', 'not_exists').required(),
      value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array()).optional()
    })
  ).min(1).required(),
  actions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('notify', 'webhook', 'escalate').required(),
      config: Joi.object().optional()
    })
  ).optional(),
  cooldown: Joi.number().integer().min(0).optional(),
  evaluationInterval: Joi.number().integer().min(1000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  metadata: Joi.object().optional()
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const updateAlertRuleSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  enabled: Joi.boolean().optional(),
  category: categorySchema,
  severity: severitySchema,
  conditions: Joi.array().items(
    Joi.object({
      field: Joi.string().required(),
      operator: Joi.string().valid('eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'in', 'not_in', 'regex', 'exists', 'not_exists').required(),
      value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array()).optional()
    })
  ).min(1).optional(),
  actions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('notify', 'webhook', 'escalate').required(),
      config: Joi.object().optional()
    })
  ).optional(),
  cooldown: Joi.number().integer().min(0).optional(),
  evaluationInterval: Joi.number().integer().min(1000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  metadata: Joi.object().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
  'object.unknown': 'Unknown field: {{#key}}'
});

export const createChannelConfigSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  type: channelTypeSchema.required(),
  enabled: Joi.boolean().optional(),
  config: Joi.object().optional(),
  filters: Joi.object().optional(),
  templates: Joi.object().optional(),
  retryPolicy: Joi.object({
    maxRetries: Joi.number().integer().min(0).max(10).optional(),
    retryDelay: Joi.number().integer().min(100).optional(),
    backoffMultiplier: Joi.number().min(1).optional()
  }).optional(),
  rateLimit: Joi.object({
    maxPerMinute: Joi.number().integer().min(1).optional(),
    maxPerHour: Joi.number().integer().min(1).optional()
  }).optional()
}).messages({
  'object.unknown': 'Unknown field: {{#key}}'
});

export const updateChannelConfigSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  type: channelTypeSchema,
  enabled: Joi.boolean().optional(),
  config: Joi.object().optional(),
  filters: Joi.object().optional(),
  templates: Joi.object().optional(),
  retryPolicy: Joi.object({
    maxRetries: Joi.number().integer().min(0).max(10).optional(),
    retryDelay: Joi.number().integer().min(100).optional(),
    backoffMultiplier: Joi.number().min(1).optional()
  }).optional(),
  rateLimit: Joi.object({
    maxPerMinute: Joi.number().integer().min(1).optional(),
    maxPerHour: Joi.number().integer().min(1).optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
  'object.unknown': 'Unknown field: {{#key}}'
});

export const listAlertsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'severity', 'status', 'title').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  severity: Joi.string().valid(...Object.values(AlertSeverity)).optional(),
  status: Joi.string().valid(...Object.values(AlertStatus)).optional(),
  category: Joi.string().valid(...Object.values(AlertCategory)).optional(),
  modelId: Joi.string().max(100).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
}).optional().messages({
  'object.unknown': 'Unknown query parameter: {{#key}}'
});