/**
 * Alerts Configuration
 * Central configuration for the alerting system
 */

export const AlertsConfig = {
  // Evaluation settings
  evaluationInterval: parseInt(process.env.ALERTS_EVALUATION_INTERVAL) || 60000, // 1 minute
  defaultCooldown: parseInt(process.env.ALERTS_DEFAULT_COOLDOWN) || 300000, // 5 minutes

  // Provider settings
  providers: {
    email: {
      enabled: !!process.env.SMTP_HOST,
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      from: process.env.ALERTS_EMAIL_FROM || 'alerts@gixy.ai',
      to: (process.env.ALERTS_EMAIL_TO || '').split(',').filter(Boolean),
      cc: (process.env.ALERTS_EMAIL_CC || '').split(',').filter(Boolean),
      bcc: (process.env.ALERTS_EMAIL_BCC || '').split(',').filter(Boolean),
    },

    webhook: {
      enabled: !!process.env.ALERTS_WEBHOOK_URL,
      url: process.env.ALERTS_WEBHOOK_URL,
      method: process.env.ALERTS_WEBHOOK_METHOD || 'POST',
      headers: process.env.ALERTS_WEBHOOK_HEADERS ? JSON.parse(process.env.ALERTS_WEBHOOK_HEADERS) : {
        'Content-Type': 'application/json',
      },
      secret: process.env.ALERTS_WEBHOOK_SECRET,
      timeout: parseInt(process.env.ALERTS_WEBHOOK_TIMEOUT) || 10000,
    },

    slack: {
      enabled: !!process.env.SLACK_WEBHOOK_URL || !!process.env.SLACK_BOT_TOKEN,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      botToken: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_ALERTS_CHANNEL || '#alerts',
      username: process.env.SLACK_BOT_USERNAME || 'Gixy Alerts',
      iconEmoji: process.env.SLACK_BOT_ICON_EMOJI || ':warning:',
      mentionUsers: (process.env.SLACK_MENTION_USERS || '').split(',').filter(Boolean),
      mentionGroups: (process.env.SLACK_MENTION_GROUPS || '').split(',').filter(Boolean),
    },

    pagerduty: {
      enabled: !!process.env.PAGERDUTY_ROUTING_KEY,
      routingKey: process.env.PAGERDUTY_ROUTING_KEY,
      apiUrl: process.env.PAGERDUTY_API_URL || 'https://events.pagerduty.com/v2/enqueue',
      source: process.env.PAGERDUTY_SOURCE || 'gixy-alerts',
    },

    opsgenie: {
      enabled: !!process.env.OPSGENIE_API_KEY,
      apiKey: process.env.OPSGENIE_API_KEY,
      apiUrl: process.env.OPSGENIE_API_URL || 'https://api.opsgenie.com/v2/alerts',
      source: process.env.OPSGENIE_SOURCE || 'gixy-alerts',
      teams: (process.env.OPSGENIE_TEAMS || '').split(',').filter(Boolean),
      tags: (process.env.OPSGENIE_TAGS || 'gixy,ai-risk').split(',').filter(Boolean),
    },

    in_app: {
      enabled: true,
      collection: process.env.ALERTS_IN_APP_COLLECTION || 'notifications',
      maxNotificationsPerUser: parseInt(process.env.ALERTS_MAX_NOTIFICATIONS_PER_USER) || 1000,
    },
  },

  // Channel defaults
  channels: {
    defaultSeverity: 'warning',
    defaultCategory: 'system',
    rateLimits: {
      email: { maxPerMinute: 5, maxPerHour: 50 },
      webhook: { maxPerMinute: 10, maxPerHour: 200 },
      slack: { maxPerMinute: 20, maxPerHour: 200 },
      pagerduty: { maxPerMinute: 10, maxPerHour: 100 },
      opsgenie: { maxPerMinute: 10, maxPerHour: 100 },
      in_app: { maxPerMinute: 100, maxPerHour: 1000 },
    },
    retryPolicy: {
      maxRetries: 3,
      retryDelay: 5000,
      backoffMultiplier: 2,
    },
  },

  // Built-in rules
  rules: {
    highRiskScore: {
      enabled: process.env.ALERTS_RULE_HIGH_RISK !== 'false',
      threshold: parseFloat(process.env.ALERTS_HIGH_RISK_THRESHOLD) || 70,
      severity: process.env.ALERTS_HIGH_RISK_SEVERITY || 'warning',
      cooldown: parseInt(process.env.ALERTS_HIGH_RISK_COOLDOWN) || 3600000,
    },

    complianceViolation: {
      enabled: process.env.ALERTS_RULE_COMPLIANCE !== 'false',
      frameworks: (process.env.ALERTS_COMPLIANCE_FRAMEWORKS || 'eu_ai_act,nist_ai_rmf').split(','),
      severity: process.env.ALERTS_COMPLIANCE_SEVERITY || 'critical',
      cooldown: parseInt(process.env.ALERTS_COMPLIANCE_COOLDOWN) || 3600000,
    },

    performanceDegradation: {
      enabled: process.env.ALERTS_RULE_PERFORMANCE !== 'false',
      accuracyThreshold: parseFloat(process.env.ALERTS_ACCURACY_THRESHOLD) || 0.85,
      severity: process.env.ALERTS_PERFORMANCE_SEVERITY || 'warning',
      cooldown: parseInt(process.env.ALERTS_PERFORMANCE_COOLDOWN) || 3600000,
    },

    dataDrift: {
      enabled: process.env.ALERTS_RULE_DATA_DRIFT !== 'false',
      threshold: parseFloat(process.env.ALERTS_DRIFT_THRESHOLD) || 0.3,
      severity: process.env.ALERTS_DRIFT_SEVERITY || 'warning',
      cooldown: parseInt(process.env.ALERTS_DRIFT_COOLDOWN) || 3600000,
    },

    securityAnomaly: {
      enabled: process.env.ALERTS_RULE_SECURITY !== 'false',
      threshold: parseFloat(process.env.ALERTS_ANOMALY_THRESHOLD) || 0.8,
      severity: process.env.ALERTS_ANOMALY_SEVERITY || 'critical',
      cooldown: parseInt(process.env.ALERTS_ANOMALY_COOLDOWN) || 1800000,
    },
  },

  // Default channels to use for alerts
  defaultChannels: (process.env.ALERTS_DEFAULT_CHANNELS || 'in_app').split(','),

  // In-app notifications
  inApp: {
    enabled: true,
    collection: 'notifications',
    maxPerUser: 1000,
  },
};

/**
 * Validate alerts configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 */
export function validateAlertsConfig(config) {
  const errors = [];
  const warnings = [];

  // Check if at least one notification channel is configured
  const hasEmail = config.providers.email?.enabled;
  const hasWebhook = config.providers.webhook?.enabled;
  const hasSlack = config.providers.slack?.enabled;
  const hasPagerDuty = config.providers.pagerduty?.enabled;
  const hasOpsGenie = config.providers.opsgenie?.enabled;
  const hasInApp = config.providers.in_app?.enabled;

  if (!hasEmail && !hasWebhook && !hasSlack && !hasPagerDuty && !hasOpsGenie && !hasInApp) {
    errors.push('No notification channels configured. Enable at least one provider.');
  }

  // Validate email config
  if (hasEmail) {
    if (!config.providers.email.host) {
      errors.push('Email provider enabled but SMTP_HOST not set');
    }
    if (!config.providers.email.from) {
      warnings.push('Email from address not set, using default');
    }
    if (config.providers.email.to.length === 0) {
      warnings.push('No email recipients configured');
    }
  }

  // Validate webhook config
  if (hasWebhook) {
    if (!config.providers.webhook.url) {
      errors.push('Webhook provider enabled but URL not set');
    }
  }

  // Validate Slack config
  if (hasSlack) {
    if (!config.providers.slack.webhookUrl && !config.providers.slack.botToken) {
      errors.push('Slack provider enabled but neither webhook URL nor bot token set');
    }
  }

  // Validate PagerDuty config
  if (hasPagerDuty) {
    if (!config.providers.pagerduty.routingKey) {
      errors.push('PagerDuty provider enabled but routing key not set');
    }
  }

  // Validate OpsGenie config
  if (hasOpsGenie) {
    if (!config.providers.opsgenie.apiKey) {
      errors.push('OpsGenie provider enabled but API key not set');
    }
  }

  // Validate default channels exist
  if (config.defaultChannels) {
    for (const channel of config.defaultChannels) {
      const provider = config.providers[channel];
      if (!provider || !provider.enabled) {
        warnings.push(`Default channel '${channel}' is not enabled`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get default configuration for a channel type
 * @param {string} type - Channel type
 * @returns {Object} Default configuration
 */
export function getChannelConfigDefaults(type) {
  const defaults = {
    email: {
      type: 'email',
      name: 'Email Notifications',
      enabled: true,
      config: {
        host: 'localhost',
        port: 587,
        secure: false,
        from: 'alerts@gixy.ai',
        to: [],
      },
      filters: {},
      templates: {},
    },
    webhook: {
      type: 'webhook',
      name: 'Webhook Notifications',
      enabled: true,
      config: {
        url: '',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      },
      filters: {},
      templates: {},
    },
    slack: {
      type: 'slack',
      name: 'Slack Notifications',
      enabled: true,
      config: {
        webhookUrl: '',
        channel: '#alerts',
        username: 'Gixy Alerts',
        iconEmoji: ':warning:',
      },
      filters: {},
      templates: {},
    },
    pagerduty: {
      type: 'pagerduty',
      name: 'PagerDuty Notifications',
      enabled: true,
      config: {
        routingKey: '',
        apiUrl: 'https://events.pagerduty.com/v2/enqueue',
        source: 'gixy-alerts',
      },
      filters: {},
      templates: {},
    },
    opsgenie: {
      type: 'opsgenie',
      name: 'OpsGenie Notifications',
      enabled: true,
      config: {
        apiKey: '',
        apiUrl: 'https://api.opsgenie.com/v2/alerts',
        source: 'gixy-alerts',
        tags: ['gixy', 'ai-risk'],
      },
      filters: {},
      templates: {},
    },
    in_app: {
      type: 'in_app',
      name: 'In-App Notifications',
      enabled: true,
      config: {
        collection: 'notifications',
        maxNotificationsPerUser: 1000,
      },
      filters: {},
      templates: {},
    },
  };

  return defaults[type.toLowerCase()] || null;
}

export default AlertsConfig;