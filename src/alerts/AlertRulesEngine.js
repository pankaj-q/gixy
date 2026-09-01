import { Alert, AlertRule, AlertChannelConfig } from './types.js';
import { createChannel } from './channels/index.js';

/**
 * Alert Rules Engine
 * Evaluates rules and triggers alerts based on conditions
 */
export class AlertRulesEngine {
  constructor(config = {}) {
    this.rules = new Map();
    this.channels = new Map();
    this.alertStore = config.alertStore;
    this.channelConfigs = new Map();
    this.evaluationInterval = config.evaluationInterval || 60000; // 1 minute
    this.evaluationTimer = null;
    this.running = false;
    this.eventHandlers = new Map();
  }

  /**
   * Register an alert rule
   * @param {AlertRule} rule - Rule to register
   */
  registerRule(rule) {
    if (!(rule instanceof AlertRule)) {
      rule = AlertRule.fromJSON(rule);
    }
    this.rules.set(rule.id, rule);
    this.emit('ruleRegistered', rule);
  }

  /**
   * Unregister a rule
   * @param {string} ruleId - Rule ID
   */
  unregisterRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.emit('ruleUnregistered', rule);
    }
  }

  /**
   * Get a rule by ID
   * @param {string} ruleId - Rule ID
   * @returns {AlertRule|null}
   */
  getRule(ruleId) {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Get all rules
   * @returns {Array<AlertRule>}
   */
  getAllRules() {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules
   * @returns {Array<AlertRule>}
   */
  getEnabledRules() {
    return Array.from(this.rules.values()).filter(r => r.enabled);
  }

  /**
   * Register a notification channel
   * @param {AlertChannelConfig} channelConfig - Channel configuration
   * @param {Object} database - Database connection (for in-app channel)
   */
  registerChannel(channelConfig, database) {
    if (!(channelConfig instanceof AlertChannelConfig)) {
      channelConfig = AlertChannelConfig.fromJSON(channelConfig);
    }
    
    const channel = createChannel(channelConfig.type, channelConfig.toJSON(), database);
    this.channels.set(channelConfig.id, channel);
    this.channelConfigs.set(channelConfig.id, channelConfig);
    this.emit('channelRegistered', channelConfig);
  }

  /**
   * Unregister a channel
   * @param {string} channelId - Channel ID
   */
  unregisterChannel(channelId) {
    const channel = this.channels.get(channelId);
    const config = this.channelConfigs.get(channelId);
    if (channel && config) {
      this.channels.delete(channelId);
      this.channelConfigs.delete(channelId);
      this.emit('channelUnregistered', config);
    }
  }

  /**
   * Get a channel by ID
   * @param {string} channelId - Channel ID
   * @returns {AlertChannel|null}
   */
  getChannel(channelId) {
    return this.channels.get(channelId) || null;
  }

  /**
   * Get all channels
   * @returns {Array<AlertChannel>}
   */
  getAllChannels() {
    return Array.from(this.channels.values());
  }

  /**
   * Get enabled channels
   * @returns {Array<AlertChannel>}
   */
  getEnabledChannels() {
    return Array.from(this.channels.values()).filter(c => c.enabled);
  }

  /**
   * Evaluate all rules against a context
   * @param {Object} context - Evaluation context
   * @returns {Promise<Array<Alert>>} Triggered alerts
   */
  async evaluate(context) {
    const triggeredAlerts = [];

    for (const rule of this.getEnabledRules()) {
      if (!rule.shouldEvaluate()) continue;

      rule.markEvaluated();

      if (rule.evaluate(context)) {
        if (!rule.shouldTrigger()) continue;

        const alert = this.createAlertFromRule(rule, context);
        triggeredAlerts.push(alert);
        rule.markTriggered();

        // Process alert
        await this.processAlert(alert, rule);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Create alert from rule
   * @param {AlertRule} rule - Triggered rule
   * @param {Object} context - Evaluation context
   * @returns {Alert}
   */
  createAlertFromRule(rule, context) {
    const alert = new Alert({
      title: rule.name,
      message: rule.description || `Rule '${rule.name}' triggered`,
      severity: rule.severity,
      category: rule.category,
      source: 'rules_engine',
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        triggerContext: this.sanitizeContext(context),
        conditions: rule.conditions,
      },
      tags: [...rule.tags, 'auto-generated'],
      runbookUrl: rule.metadata?.runbookUrl,
      dashboardUrl: rule.metadata?.dashboardUrl,
    });

    return alert;
  }

  /**
   * Sanitize context for storage
   * @param {Object} context - Context object
   * @returns {Object} Sanitized context
   */
  sanitizeContext(context) {
    // Remove sensitive data
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Process an alert (send notifications, store, etc.)
   * @param {Alert} alert - Alert to process
   * @param {AlertRule} rule - Triggering rule
   */
  async processAlert(alert, rule) {
    // Store alert
    if (this.alertStore) {
      await this.alertStore.save(alert);
    }

    // Determine channels to use
    const channelIds = rule.actions
      .filter(a => a.type === 'notify')
      .map(a => a.channelId)
      .filter(Boolean);

    const channelsToUse = channelIds.length > 0
      ? channelIds.map(id => this.channels.get(id)).filter(Boolean)
      : this.getEnabledChannels();

    // Send notifications
    for (const channel of channelsToUse) {
      if (channel && channelConfigMatches(channel, alert)) {
        try {
          const result = await channel.sendWithRetry(alert);
          alert.addNotificationChannel(channel.id);
          
          if (result.success) {
            alert.markNotificationSent();
            this.emit('notificationSent', { alert, channel: channel.id, result });
          } else {
            this.emit('notificationFailed', { alert, channel: channel.id, error: result.error });
          }
        } catch (error) {
          this.emit('notificationError', { alert, channel: channel.id, error: error.message });
        }
      }
    }

    this.emit('alertTriggered', { alert, rule });
  }

  /**
   * Manually trigger an alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Alert>}
   */
  async triggerAlert(alertData) {
    const alert = new Alert(alertData);
    
    if (this.alertStore) {
      await this.alertStore.save(alert);
    }

    const channelsToUse = this.getEnabledChannels();
    
    for (const channel of channelsToUse) {
      if (channelConfigMatches(channel, alert)) {
        try {
          await channel.sendWithRetry(alert);
          alert.addNotificationChannel(channel.id);
        } catch (error) {
          this.emit('notificationError', { alert, channel: channel.id, error: error.message });
        }
      }
    }

    alert.markNotificationSent();
    this.emit('alertTriggered', { alert, rule: null });

    return alert;
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async acknowledgeAlert(alertId, userId) {
    if (!this.alertStore) return false;
    
    const alert = await this.alertStore.findById(alertId);
    if (!alert) return false;

    alert.acknowledge(userId);
    await this.alertStore.update(alert);
    
    this.emit('alertAcknowledged', { alert, userId });
    return true;
  }

  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async resolveAlert(alertId, userId) {
    if (!this.alertStore) return false;
    
    const alert = await this.alertStore.findById(alertId);
    if (!alert) return false;

    alert.resolve(userId);
    await this.alertStore.update(alert);
    
    // Send resolution notifications
    for (const channel of this.getEnabledChannels()) {
      if (channelConfigMatches(channel, alert)) {
        try {
          await channel.sendWithRetry(alert);
        } catch (error) {
          this.emit('notificationError', { alert, channel: channel.id, error: error.message });
        }
      }
    }
    
    this.emit('alertResolved', { alert, userId });
    return true;
  }

  /**
   * Start the evaluation loop
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.evaluationTimer = setInterval(() => {
      this.evaluate({}).catch(error => {
        this.emit('evaluationError', { error: error.message });
      });
    }, this.evaluationInterval);
    
    this.emit('started');
  }

  /**
   * Stop the evaluation loop
   */
  stop() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Event emitter methods
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (!this.eventHandlers.has(event)) return;
    const handlers = this.eventHandlers.get(event);
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
  }

  emit(event, data) {
    if (!this.eventHandlers.has(event)) return;
    for (const handler of this.eventHandlers.get(event)) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  /**
   * Get engine statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalRules: this.rules.size,
      enabledRules: this.getEnabledRules().length,
      totalChannels: this.channels.size,
      enabledChannels: this.getEnabledChannels().length,
      running: this.running,
      evaluationInterval: this.evaluationInterval,
    };
  }
}

/**
 * Check if channel config matches alert
 * @param {AlertChannel} channel - Channel
 * @param {Alert} alert - Alert
 * @returns {boolean}
 */
function channelConfigMatches(channel, alert) {
  return channel.matchesFilter(alert);
}

export default AlertRulesEngine;