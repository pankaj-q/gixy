import { Alert, AlertRule, AlertChannelConfig } from './types.js';
import { AlertRulesEngine } from './AlertRulesEngine.js';
import { AlertStore, MongoAlertStore, MemoryAlertStore } from './AlertStore.js';
import { createChannel, CHANNEL_TYPES } from './channels/index.js';

/**
 * Notification Manager
 * High-level interface for managing alerts, rules, and notifications
 */
export class NotificationManager {
  constructor(config = {}) {
    this.config = config;
    this.alertStore = config.alertStore || new MemoryAlertStore();
    this.rulesEngine = new AlertRulesEngine({
      alertStore: this.alertStore,
      evaluationInterval: config.evaluationInterval,
    });
    this.initialized = false;
    this.defaultChannels = config.defaultChannels || [];
  }

  /**
   * Initialize the notification manager
   * @param {Object} database - Database connection
   */
  async initialize(database) {
    if (this.initialized) return;

    // Load rules from store
    const rules = await this.alertStore.findRules({ enabled: true });
    for (const rule of rules) {
      this.rulesEngine.registerRule(rule);
    }

    // Load channel configs from store
    const channelConfigs = await this.alertStore.findChannelConfigs();
    for (const channelConfig of channelConfigs) {
      if (channelConfig.enabled) {
        this.rulesEngine.registerChannel(channelConfig, database);
      }
    }

    // Create indexes if using MongoDB
    if (this.alertStore instanceof MongoAlertStore) {
      await this.alertStore.createIndexes();
    }

    // Start rules engine
    this.rulesEngine.start();

    this.initialized = true;
    return this;
  }

  /**
   * Shutdown the notification manager
   */
  async shutdown() {
    this.rulesEngine.stop();
    this.initialized = false;
  }

  // ==================== Alert Methods ====================

  /**
   * Create and trigger an alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Alert>}
   */
  async createAlert(alertData) {
    return this.rulesEngine.triggerAlert(alertData);
  }

  /**
   * Get alert by ID
   * @param {string} id - Alert ID
   * @returns {Promise<Alert|null>}
   */
  async getAlert(id) {
    return this.alertStore.findById(id);
  }

  /**
   * List alerts with filters
   * @param {Object} query - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Array<Alert>>}
   */
  async listAlerts(query = {}, options = {}) {
    return this.alertStore.find(query, options);
  }

  /**
   * Acknowledge an alert
   * @param {string} id - Alert ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async acknowledgeAlert(id, userId) {
    return this.rulesEngine.acknowledgeAlert(id, userId);
  }

  /**
   * Resolve an alert
   * @param {string} id - Alert ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async resolveAlert(id, userId) {
    return this.rulesEngine.resolveAlert(id, userId);
  }

  /**
   * Suppress an alert
   * @param {string} id - Alert ID
   * @param {Date|string} until - Suppression end time
   * @returns {Promise<boolean>}
   */
  async suppressAlert(id, until) {
    const alert = await this.alertStore.findById(id);
    if (!alert) return false;

    alert.suppress(until);
    await this.alertStore.update(alert);
    return true;
  }

  /**
   * Get alert statistics
   * @param {Object} query - Query filters
   * @returns {Promise<Object>}
   */
  async getAlertStats(query = {}) {
    const total = await this.alertStore.count(query);
    const active = await this.alertStore.count({ ...query, status: 'active' });
    const acknowledged = await this.alertStore.count({ ...query, status: 'acknowledged' });
    const resolved = await this.alertStore.count({ ...query, status: 'resolved' });
    const critical = await this.alertStore.count({ ...query, severity: 'critical' });
    const emergency = await this.alertStore.count({ ...query, severity: 'emergency' });

    return {
      total,
      active,
      acknowledged,
      resolved,
      critical,
      emergency,
      bySeverity: {
        info: await this.alertStore.count({ ...query, severity: 'info' }),
        warning: await this.alertStore.count({ ...query, severity: 'warning' }),
        critical,
        emergency,
      },
      byCategory: {
        model_risk: await this.alertStore.count({ ...query, category: 'model_risk' }),
        compliance: await this.alertStore.count({ ...query, category: 'compliance' }),
        performance: await this.alertStore.count({ ...query, category: 'performance' }),
        security: await this.alertStore.count({ ...query, category: 'security' }),
        data_quality: await this.alertStore.count({ ...query, category: 'data_quality' }),
        infrastructure: await this.alertStore.count({ ...query, category: 'infrastructure' }),
        system: await this.alertStore.count({ ...query, category: 'system' }),
      },
    };
  }

  // ==================== Rule Methods ====================

  /**
   * Create a new alert rule
   * @param {Object} ruleData - Rule data
   * @returns {Promise<AlertRule>}
   */
  async createRule(ruleData) {
    const rule = new AlertRule(ruleData);
    await this.alertStore.saveRule(rule);
    this.rulesEngine.registerRule(rule);
    return rule;
  }

  /**
   * Get rule by ID
   * @param {string} id - Rule ID
   * @returns {Promise<AlertRule|null>}
   */
  async getRule(id) {
    return this.alertStore.findRuleById(id);
  }

  /**
   * List rules
   * @param {Object} query - Query filters
   * @returns {Promise<Array<AlertRule>>}
   */
  async listRules(query = {}) {
    return this.alertStore.findRules(query);
  }

  /**
   * Update a rule
   * @param {string} id - Rule ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<AlertRule|null>}
   */
  async updateRule(id, updates) {
    const rule = await this.alertStore.findRuleById(id);
    if (!rule) return null;

    Object.assign(rule, updates);
    rule.updatedAt = new Date().toISOString();
    
    await this.alertStore.saveRule(rule);
    this.rulesEngine.unregisterRule(id);
    this.rulesEngine.registerRule(rule);
    
    return rule;
  }

  /**
   * Delete a rule
   * @param {string} id - Rule ID
   * @returns {Promise<boolean>}
   */
  async deleteRule(id) {
    this.rulesEngine.unregisterRule(id);
    return this.alertStore.deleteRule(id);
  }

  /**
   * Enable/disable a rule
   * @param {string} id - Rule ID
   * @param {boolean} enabled - Enabled state
   * @returns {Promise<AlertRule|null>}
   */
  async setRuleEnabled(id, enabled) {
    return this.updateRule(id, { enabled });
  }

  // ==================== Channel Methods ====================

  /**
   * Create a notification channel
   * @param {Object} channelData - Channel configuration
   * @param {Object} database - Database connection
   * @returns {Promise<AlertChannelConfig>}
   */
  async createChannel(channelData, database) {
    const config = new AlertChannelConfig(channelData);
    await this.alertStore.saveChannelConfig(config);
    
    if (config.enabled) {
      this.rulesEngine.registerChannel(config, database);
    }
    
    return config;
  }

  /**
   * Get channel config by ID
   * @param {string} id - Channel config ID
   * @returns {Promise<AlertChannelConfig|null>}
   */
  async getChannel(id) {
    return this.alertStore.findChannelConfigById(id);
  }

  /**
   * List channel configs
   * @returns {Promise<Array<AlertChannelConfig>>}
   */
  async listChannels() {
    return this.alertStore.findChannelConfigs();
  }

  /**
   * Update a channel config
   * @param {string} id - Channel config ID
   * @param {Object} updates - Updates to apply
   * @param {Object} database - Database connection
   * @returns {Promise<AlertChannelConfig|null>}
   */
  async updateChannel(id, updates, database) {
    const config = await this.alertStore.findChannelConfigById(id);
    if (!config) return null;

    Object.assign(config, updates);
    config.updatedAt = new Date().toISOString();
    
    await this.alertStore.saveChannelConfig(config);
    
    // Re-register if enabled state changed
    this.rulesEngine.unregisterChannel(id);
    if (config.enabled) {
      this.rulesEngine.registerChannel(config, database);
    }
    
    return config;
  }

  /**
   * Delete a channel config
   * @param {string} id - Channel config ID
   * @returns {Promise<boolean>}
   */
  async deleteChannel(id) {
    this.rulesEngine.unregisterChannel(id);
    return this.alertStore.deleteChannelConfig(id);
  }

  /**
   * Test a channel
   * @param {string} id - Channel config ID
   * @param {Object} testAlert - Test alert data
   * @param {Object} database - Database connection
   * @returns {Promise<Object>}
   */
  async testChannel(id, testAlert, database) {
    const config = await this.alertStore.findChannelConfigById(id);
    if (!config) {
      return { success: false, error: 'Channel not found' };
    }

    const channel = createChannel(config.type, config.toJSON(), database);
    const alert = new Alert({
      ...testAlert,
      title: testAlert.title || 'Test Alert',
      message: testAlert.message || 'This is a test alert from Gixy',
      severity: testAlert.severity || 'info',
    });

    try {
      const result = await channel.sendWithRetry(alert);
      return { success: result.success, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== Evaluation Methods ====================

  /**
   * Manually evaluate rules against a context
   * @param {Object} context - Evaluation context
   * @returns {Promise<Array<Alert>>}
   */
  async evaluateRules(context) {
    return this.rulesEngine.evaluate(context);
  }

  /**
   * Get rules engine stats
   * @returns {Object}
   */
  getEngineStats() {
    return this.rulesEngine.getStats();
  }

  // ==================== Event Handling ====================

  /**
   * Subscribe to events
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    this.rulesEngine.on(event, handler);
  }

  /**
   * Unsubscribe from events
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    this.rulesEngine.off(event, handler);
  }

  // ==================== Built-in Rule Creators ====================

  /**
   * Create a high risk score alert rule
   * @param {Object} options - Rule options
   * @returns {AlertRule}
   */
  static createHighRiskRule(options = {}) {
    return new AlertRule({
      name: options.name || 'High Risk Score Detected',
      description: options.description || 'Model risk score exceeds threshold',
      category: 'model_risk',
      severity: options.severity || 'warning',
      conditions: [
        { field: 'riskScore', operator: 'gte', value: options.threshold || 70 },
      ],
      actions: [
        { type: 'notify', channelId: options.channelId },
      ],
      cooldown: options.cooldown || 3600000, // 1 hour
      tags: options.tags || ['risk', 'automated'],
    });
  }

  /**
   * Create a compliance violation rule
   * @param {Object} options - Rule options
   * @returns {AlertRule}
   */
  static createComplianceViolationRule(options = {}) {
    return new AlertRule({
      name: options.name || 'Compliance Violation Detected',
      description: options.description || 'Model fails compliance check',
      category: 'compliance',
      severity: options.severity || 'critical',
      conditions: [
        { field: 'complianceStatus', operator: 'eq', value: 'non-compliant' },
        { field: 'framework', operator: 'eq', value: options.framework || 'eu_ai_act' },
      ],
      actions: [
        { type: 'notify', channelId: options.channelId },
      ],
      cooldown: options.cooldown || 3600000,
      tags: options.tags || ['compliance', 'automated'],
    });
  }

  /**
   * Create a model performance degradation rule
   * @param {Object} options - Rule options
   * @returns {AlertRule}
   */
  static createPerformanceDegradationRule(options = {}) {
    return new AlertRule({
      name: options.name || 'Model Performance Degradation',
      description: options.description || 'Model performance metrics below threshold',
      category: 'performance',
      severity: options.severity || 'warning',
      conditions: [
        { field: 'metrics.accuracy', operator: 'lt', value: options.accuracyThreshold || 0.85 },
      ],
      actions: [
        { type: 'notify', channelId: options.channelId },
      ],
      cooldown: options.cooldown || 3600000,
      tags: options.tags || ['performance', 'automated'],
    });
  }

  /**
   * Create a data drift alert rule
   * @param {Object} options - Rule options
   * @returns {AlertRule}
   */
  static createDataDriftRule(options = {}) {
    return new AlertRule({
      name: options.name || 'Data Drift Detected',
      description: options.description || 'Significant data drift detected in model inputs',
      category: 'data_quality',
      severity: options.severity || 'warning',
      conditions: [
        { field: 'driftScore', operator: 'gte', value: options.threshold || 0.3 },
      ],
      actions: [
        { type: 'notify', channelId: options.channelId },
      ],
      cooldown: options.cooldown || 3600000,
      tags: options.tags || ['data-quality', 'drift', 'automated'],
    });
  }

  /**
   * Create a security anomaly rule
   * @param {Object} options - Rule options
   * @returns {AlertRule}
   */
  static createSecurityAnomalyRule(options = {}) {
    return new AlertRule({
      name: options.name || 'Security Anomaly Detected',
      description: options.description || 'Unusual security event detected',
      category: 'security',
      severity: options.severity || 'critical',
      conditions: [
        { field: 'anomalyScore', operator: 'gte', value: options.threshold || 0.8 },
      ],
      actions: [
        { type: 'notify', channelId: options.channelId },
      ],
      cooldown: options.cooldown || 1800000, // 30 minutes
      tags: options.tags || ['security', 'anomaly', 'automated'],
    });
  }
}

export default NotificationManager;