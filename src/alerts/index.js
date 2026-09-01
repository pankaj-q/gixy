/**
 * Alerts Module - Main Entry Point
 * Exports all alert types, channels, engines, and utilities
 */

// Types
import {
  Alert,
  AlertRule,
  AlertChannelConfig,
  AlertSeverity,
  AlertStatus,
  AlertCategory,
  AlertChannel,
} from './types.js';

// Channels
import {
  EmailChannel,
  WebhookChannel,
  SlackChannel,
  PagerDutyChannel,
  OpsGenieChannel,
  InAppChannel,
  CHANNEL_TYPES,
  createChannel,
} from './channels/index.js';

// Engines
import { AlertRulesEngine } from './AlertRulesEngine.js';

// Storage
import {
  AlertStore,
  MongoAlertStore,
  MemoryAlertStore,
} from './AlertStore.js';

// Manager
import { NotificationManager } from './NotificationManager.js';

// Configuration
import { AlertsConfig, validateAlertsConfig, getChannelConfigDefaults } from './config.js';

// Re-export for convenience
export {
  Alert,
  AlertRule,
  AlertChannelConfig,
  AlertSeverity,
  AlertStatus,
  AlertCategory,
  AlertChannel,
};

export {
  EmailChannel,
  WebhookChannel,
  SlackChannel,
  PagerDutyChannel,
  OpsGenieChannel,
  InAppChannel,
  CHANNEL_TYPES,
  createChannel,
};

export { AlertRulesEngine };

export {
  AlertStore,
  MongoAlertStore,
  MemoryAlertStore,
};

export { NotificationManager };

export { AlertsConfig, validateAlertsConfig, getChannelConfigDefaults };

/**
 * Create a fully configured notification manager
 * @param {Object} customConfig - Custom configuration
 * @param {Object} database - Database connection
 * @returns {Promise<NotificationManager>}
 */
export async function createNotificationManager(customConfig = {}, database = null) {
  const config = {
    ...AlertsConfig,
    ...customConfig,
    providers: { ...AlertsConfig.providers, ...customConfig.providers },
    channels: { ...AlertsConfig.channels, ...customConfig.channels },
    rules: { ...AlertsConfig.rules, ...customConfig.rules },
  };

  const validation = validateAlertsConfig(config);
  if (!validation.valid && !customConfig.skipValidation) {
    throw new Error(`Alerts Configuration invalid: ${validation.errors.join(', ')}`);
  }

  const alertStore = config.alertStore || new MemoryAlertStore();
  
  const manager = new NotificationManager({
    alertStore,
    evaluationInterval: config.evaluationInterval,
    defaultChannels: config.defaultChannels,
  });

  await manager.initialize(database);

  return {
    manager,
    config,
    validation,
  };
}

/**
 * Quick alert creation
 * @param {Object} alertData - Alert data
 * @param {Object} managerConfig - Manager configuration
 * @param {Object} database - Database connection
 * @returns {Promise<Alert>}
 */
export async function quickAlert(alertData, managerConfig = {}, database = null) {
  const { manager } = await createNotificationManager(managerConfig, database);
  return manager.createAlert(alertData);
}

export default {
  // Types
  Alert,
  AlertRule,
  AlertChannelConfig,
  AlertSeverity,
  AlertStatus,
  AlertCategory,
  AlertChannel,
  
  // Channels
  EmailChannel,
  WebhookChannel,
  SlackChannel,
  PagerDutyChannel,
  OpsGenieChannel,
  InAppChannel,
  CHANNEL_TYPES,
  createChannel,
  
  // Engines
  AlertRulesEngine,
  
  // Storage
  AlertStore,
  MongoAlertStore,
  MemoryAlertStore,
  
  // Manager
  NotificationManager,
  
  // Configuration
  AlertsConfig,
  validateAlertsConfig,
  getChannelConfigDefaults,
  
  // Utilities
  createNotificationManager,
  quickAlert,
};