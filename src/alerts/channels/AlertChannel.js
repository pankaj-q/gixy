/**
 * Alert Channel Base Class
 * Base class for all notification channels
 */

export class AlertChannel {
  constructor(config) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.enabled = config.enabled;
    this.filters = config.filters || {};
    this.templates = config.templates || {};
    this.retryPolicy = config.retryPolicy || {
      maxRetries: 3,
      retryDelay: 5000,
      backoffMultiplier: 2,
    };
    this.rateLimit = config.rateLimit || {
      maxPerMinute: 10,
      maxPerHour: 100,
    };
    this.sentCount = { minute: 0, hour: 0 };
    this.lastReset = { minute: Date.now(), hour: Date.now() };
  }

  /**
   * Send alert through this channel
   * @param {Alert} alert - Alert to send
   * @returns {Promise<Object>} Send result
   */
  async send(alert) {
    if (!this.enabled) {
      return { success: false, reason: 'Channel disabled' };
    }

    if (!this.matchesFilter(alert)) {
      return { success: false, reason: 'Filtered out' };
    }

    if (!this.checkRateLimit()) {
      return { success: false, reason: 'Rate limited' };
    }

    try {
      const result = await this.doSend(alert);
      this.incrementRateLimit();
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Actual send implementation - must be overridden
   * @param {Alert} alert - Alert to send
   * @returns {Promise<Object>} Send result
   */
  async doSend(alert) {
    throw new Error('doSend() must be implemented by subclass');
  }

  /**
   * Check if alert matches channel filters
   * @param {Alert} alert - Alert to check
   * @returns {boolean}
   */
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

  /**
   * Check rate limits
   * @returns {boolean}
   */
  checkRateLimit() {
    const now = Date.now();

    // Reset minute counter
    if (now - this.lastReset.minute >= 60000) {
      this.sentCount.minute = 0;
      this.lastReset.minute = now;
    }

    // Reset hour counter
    if (now - this.lastReset.hour >= 3600000) {
      this.sentCount.hour = 0;
      this.lastReset.hour = now;
    }

    return (
      this.sentCount.minute < this.rateLimit.maxPerMinute &&
      this.sentCount.hour < this.rateLimit.maxPerHour
    );
  }

  /**
   * Increment rate limit counters
   */
  incrementRateLimit() {
    this.sentCount.minute += 1;
    this.sentCount.hour += 1;
  }

  /**
   * Get template for alert severity
   * @param {string} severity - Alert severity
   * @returns {Object|null}
   */
  getTemplate(severity) {
    return this.templates[severity] || this.templates.default || null;
  }

  /**
   * Render template with alert data
   * @param {Object} template - Template object
   * @param {Alert} alert - Alert data
   * @returns {Object} Rendered template
   */
  renderTemplate(template, alert) {
    if (!template) return { subject: alert.title, body: alert.message };

    const context = {
      alert: alert.toJSON(),
      timestamp: new Date().toISOString(),
      ...alert.metadata,
    };

    const render = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        return this.getNestedValue(context, key.trim()) || match;
      });
    };

    return {
      subject: render(template.subject || alert.title),
      body: render(template.body || alert.message),
      html: render(template.html || template.body || alert.message),
    };
  }

  /**
   * Get nested value from object
   * @param {Object} obj - Object to search
   * @param {string} path - Dot notation path
   * @returns {*}
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Send with retry logic
   * @param {Alert} alert - Alert to send
   * @returns {Promise<Object>} Send result
   */
  async sendWithRetry(alert) {
    let lastError;
    const { maxRetries, retryDelay, backoffMultiplier } = this.retryPolicy;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.send(alert);
      if (result.success) {
        return result;
      }

      lastError = result.error || result.reason;

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success: false, error: lastError };
  }
}

export default AlertChannel;