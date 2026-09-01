/**
 * Alert Types and Interfaces
 * Core types for the alerting system
 */

export const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency',
};

export const AlertStatus = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  SUPPRESSED: 'suppressed',
};

export const AlertCategory = {
  MODEL_RISK: 'model_risk',
  COMPLIANCE: 'compliance',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  DATA_QUALITY: 'data_quality',
  INFRASTRUCTURE: 'infrastructure',
  SYSTEM: 'system',
};

export const AlertChannel = {
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  SLACK: 'slack',
  PAGERDUTY: 'pagerduty',
  OPSGENIE: 'opsgenie',
  SMS: 'sms',
  IN_APP: 'in_app',
};

export class Alert {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.title = data.title || '';
    this.message = data.message || '';
    this.severity = data.severity || AlertSeverity.INFO;
    this.status = data.status || AlertStatus.ACTIVE;
    this.category = data.category || AlertCategory.SYSTEM;
    this.source = data.source || 'system';
    this.modelId = data.modelId || null;
    this.assessmentId = data.assessmentId || null;
    this.metadata = data.metadata || {};
    this.tags = data.tags || [];
    this.fingerprint = data.fingerprint || this.generateFingerprint();
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.acknowledgedAt = data.acknowledgedAt || null;
    this.acknowledgedBy = data.acknowledgedBy || null;
    this.resolvedAt = data.resolvedAt || null;
    this.resolvedBy = data.resolvedBy || null;
    this.suppressedUntil = data.suppressedUntil || null;
    this.escalationLevel = data.escalationLevel || 0;
    this.notificationSent = data.notificationSent || false;
    this.notificationChannels = data.notificationChannels || [];
    this.runbookUrl = data.runbookUrl || null;
    this.dashboardUrl = data.dashboardUrl || null;
  }

  generateId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateFingerprint() {
    const str = `${this.title}:${this.source}:${this.modelId || ''}:${this.category}`;
    return Buffer.from(str).toString('base64').substr(0, 32);
  }

  acknowledge(userId) {
    this.status = AlertStatus.ACKNOWLEDGED;
    this.acknowledgedAt = new Date().toISOString();
    this.acknowledgedBy = userId;
    this.updatedAt = new Date().toISOString();
  }

  resolve(userId) {
    this.status = AlertStatus.RESOLVED;
    this.resolvedAt = new Date().toISOString();
    this.resolvedBy = userId;
    this.updatedAt = new Date().toISOString();
  }

  suppress(until) {
    this.status = AlertStatus.SUPPRESSED;
    this.suppressedUntil = until;
    this.updatedAt = new Date().toISOString();
  }

  escalate() {
    this.escalationLevel += 1;
    this.updatedAt = new Date().toISOString();
  }

  addNotificationChannel(channel) {
    if (!this.notificationChannels.includes(channel)) {
      this.notificationChannels.push(channel);
      this.updatedAt = new Date().toISOString();
    }
  }

  markNotificationSent() {
    this.notificationSent = true;
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      message: this.message,
      severity: this.severity,
      status: this.status,
      category: this.category,
      source: this.source,
      modelId: this.modelId,
      assessmentId: this.assessmentId,
      metadata: this.metadata,
      tags: this.tags,
      fingerprint: this.fingerprint,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      acknowledgedAt: this.acknowledgedAt,
      acknowledgedBy: this.acknowledgedBy,
      resolvedAt: this.resolvedAt,
      resolvedBy: this.resolvedBy,
      suppressedUntil: this.suppressedUntil,
      escalationLevel: this.escalationLevel,
      notificationSent: this.notificationSent,
      notificationChannels: this.notificationChannels,
      runbookUrl: this.runbookUrl,
      dashboardUrl: this.dashboardUrl,
    };
  }

  static fromJSON(json) {
    return new Alert(json);
  }
}

export class AlertRule {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.description = data.description || '';
    this.enabled = data.enabled !== false;
    this.category = data.category || AlertCategory.SYSTEM;
    this.severity = data.severity || AlertSeverity.WARNING;
    this.conditions = data.conditions || [];
    this.actions = data.actions || [];
    this.cooldown = data.cooldown || 300000; // 5 minutes
    this.evaluationInterval = data.evaluationInterval || 60000; // 1 minute
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastEvaluated = data.lastEvaluated || null;
    this.lastTriggered = data.lastTriggered || null;
    this.triggerCount = data.triggerCount || 0;
  }

  generateId() {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  evaluate(context) {
    if (!this.enabled) return false;

    return this.conditions.every(condition => this.evaluateCondition(condition, context));
  }

  evaluateCondition(condition, context) {
    const { field, operator, value } = condition;
    const contextValue = this.getNestedValue(context, field);

    switch (operator) {
      case 'eq': return contextValue === value;
      case 'ne': return contextValue !== value;
      case 'gt': return contextValue > value;
      case 'gte': return contextValue >= value;
      case 'lt': return contextValue < value;
      case 'lte': return contextValue <= value;
      case 'contains': return String(contextValue).includes(String(value));
      case 'not_contains': return !String(contextValue).includes(String(value));
      case 'in': return Array.isArray(value) && value.includes(contextValue);
      case 'not_in': return Array.isArray(value) && !value.includes(contextValue);
      case 'regex': return new RegExp(value).test(String(contextValue));
      case 'exists': return contextValue !== undefined && contextValue !== null;
      case 'not_exists': return contextValue === undefined || contextValue === null;
      default: return false;
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  shouldEvaluate() {
    if (!this.lastEvaluated) return true;
    return Date.now() - new Date(this.lastEvaluated).getTime() >= this.evaluationInterval;
  }

  shouldTrigger() {
    if (!this.lastTriggered) return true;
    return Date.now() - new Date(this.lastTriggered).getTime() >= this.cooldown;
  }

  markEvaluated() {
    this.lastEvaluated = new Date().toISOString();
  }

  markTriggered() {
    this.lastTriggered = new Date().toISOString();
    this.triggerCount += 1;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      category: this.category,
      severity: this.severity,
      conditions: this.conditions,
      actions: this.actions,
      cooldown: this.cooldown,
      evaluationInterval: this.evaluationInterval,
      tags: this.tags,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastEvaluated: this.lastEvaluated,
      lastTriggered: this.lastTriggered,
      triggerCount: this.triggerCount,
    };
  }

  static fromJSON(json) {
    return new AlertRule(json);
  }
}

export class AlertChannelConfig {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.type = data.type || AlertChannel.EMAIL;
    this.enabled = data.enabled !== false;
    this.config = data.config || {};
    this.filters = data.filters || {};
    this.templates = data.templates || {};
    this.retryPolicy = data.retryPolicy || {
      maxRetries: 3,
      retryDelay: 5000,
      backoffMultiplier: 2,
    };
    this.rateLimit = data.rateLimit || {
      maxPerMinute: 10,
      maxPerHour: 100,
    };
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    return `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  matchesFilter(alert) {
    if (Object.keys(this.filters).length === 0) return true;

    for (const [key, value] of Object.entries(this.filters)) {
      const alertValue = this.getNestedValue(alert, key);
      if (Array.isArray(value)) {
        if (!value.includes(alertValue)) return false;
      } else if (alertValue !== value) {
        return false;
      }
    }
    return true;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getTemplate(severity) {
    return this.templates[severity] || this.templates.default || null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      enabled: this.enabled,
      config: this.config,
      filters: this.filters,
      templates: this.templates,
      retryPolicy: this.retryPolicy,
      rateLimit: this.rateLimit,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(json) {
    return new AlertChannelConfig(json);
  }
}

export default {
  Alert,
  AlertRule,
  AlertChannelConfig,
  AlertSeverity,
  AlertStatus,
  AlertCategory,
  AlertChannel,
};