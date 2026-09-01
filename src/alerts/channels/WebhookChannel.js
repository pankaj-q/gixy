import { AlertChannel } from './AlertChannel.js';

/**
 * Webhook Alert Channel
 * Sends alerts via HTTP webhook
 */
export class WebhookChannel extends AlertChannel {
  constructor(config) {
    super(config);
    this.url = config.config.url;
    this.method = config.config.method || 'POST';
    this.headers = config.config.headers || {
      'Content-Type': 'application/json',
    };
    this.timeout = config.config.timeout || 10000;
    this.signatureHeader = config.config.signatureHeader || 'X-Gixy-Signature';
    this.secret = config.config.secret;
    this.customPayload = config.config.customPayload || null;
  }

  async doSend(alert) {
    const payload = this.customPayload 
      ? this.renderCustomPayload(this.customPayload, alert)
      : this.buildDefaultPayload(alert);

    const headers = { ...this.headers };

    // Add signature if secret is configured
    if (this.secret) {
      const crypto = await import('crypto');
      const signature = crypto.default
        .createHmac('sha256', this.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers[this.signatureHeader] = `sha256=${signature}`;
    }

    // Add alert metadata headers
    headers['X-Alert-ID'] = alert.id;
    headers['X-Alert-Severity'] = alert.severity;
    headers['X-Alert-Category'] = alert.category;
    headers['X-Alert-Source'] = alert.source;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
        method: this.method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${responseText}`);
      }

      return {
        statusCode: response.status,
        response: responseData,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Webhook request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  buildDefaultPayload(alert) {
    return {
      alert: alert.toJSON(),
      timestamp: new Date().toISOString(),
      source: 'gixy-alerts',
      version: '1.0',
    };
  }

  renderCustomPayload(template, alert) {
    const context = {
      alert: alert.toJSON(),
      timestamp: new Date().toISOString(),
      ...alert.metadata,
    };

    const renderValue = (value) => {
      if (typeof value === 'string') {
        return value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
          return this.getNestedValue(context, key) || match;
        });
      } else if (Array.isArray(value)) {
        return value.map(renderValue);
      } else if (typeof value === 'object' && value !== null) {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
          result[k] = renderValue(v);
        }
        return result;
      }
      return value;
    };

    return renderValue(template);
  }
}

export default WebhookChannel;