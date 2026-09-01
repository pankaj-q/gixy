import { AlertChannel } from './AlertChannel.js';

/**
 * OpsGenie Alert Channel
 * Sends alerts to OpsGenie via API
 */
export class OpsGenieChannel extends AlertChannel {
  constructor(config) {
    super(config);
    this.apiKey = config.config.apiKey;
    this.apiUrl = config.config.apiUrl || 'https://api.opsgenie.com/v2/alerts';
    this.source = config.config.source || 'gixy-alerts';
    this.tags = config.config.tags || ['gixy', 'ai-risk'];
    this.teams = config.config.teams || [];
    this.responders = config.config.responders || [];
    this.visibleTo = config.config.visibleTo || [];
    this.actions = config.config.actions || [];
    this.entity = config.config.entity || 'ai-model';
    this.description = config.config.description || '';
    this.priority = config.config.priority || 'P3';
  }

  async doSend(alert) {
    const priority = this.mapPriority(alert.severity);
    const isResolved = alert.status === 'resolved';

    const payload = {
      message: alert.title,
      description: this.buildDescription(alert),
      alias: alert.fingerprint,
      source: this.source,
      tags: [...this.tags, alert.category, alert.severity],
      priority,
      entity: alert.modelId || this.entity,
      actions: this.actions,
      details: {
        ...alert.metadata,
        category: alert.category,
        modelId: alert.modelId,
        assessmentId: alert.assessmentId,
        createdAt: alert.createdAt,
        dashboardUrl: alert.dashboardUrl,
        runbookUrl: alert.runbookUrl,
      },
      responders: this.responders.map(r => ({ type: r.type, name: r.name })),
      visibleTo: this.visibleTo.map(v => ({ type: v.type, name: v.name })),
      note: isResolved ? `Alert resolved by ${alert.resolvedBy || 'system'} at ${alert.resolvedAt}` : undefined,
    };

    if (isResolved) {
      // Close the alert
      const closeUrl = `${this.apiUrl}/${encodeURIComponent(alert.fingerprint)}/close`;
      const response = await fetch(closeUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ source: this.source, note: payload.note }),
      });

      const data = await response.json();
      if (!data.result || data.result !== 'Request will be processed') {
        throw new Error(`OpsGenie close failed: ${JSON.stringify(data)}`);
      }

      return { action: 'close', requestId: data.requestId };
    }

    // Create or update alert
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.result !== 'Created' && data.result !== 'Updated') {
      throw new Error(`OpsGenie API error: ${data.message || 'Unknown error'}`);
    }

    return {
      action: data.result.toLowerCase(),
      alertId: data.alertId,
      requestId: data.requestId,
    };
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `GenieKey ${this.apiKey}`,
      'User-Agent': 'Gixy-Alerts/1.0',
    };
  }

  mapPriority(severity) {
    const mapping = {
      info: 'P5',
      warning: 'P3',
      critical: 'P1',
      emergency: 'P1',
    };
    return mapping[severity] || 'P3';
  }

  buildDescription(alert) {
    let desc = `${alert.message}\n\n`;
    desc += `**Severity:** ${alert.severity.toUpperCase()}\n`;
    desc += `**Category:** ${alert.category.replace(/_/g, ' ')}\n`;
    desc += `**Source:** ${alert.source}\n`;
    desc += `**Time:** ${new Date(alert.createdAt).toLocaleString()}\n`;
    
    if (alert.modelId) desc += `**Model:** ${alert.modelId}\n`;
    if (alert.assessmentId) desc += `**Assessment:** ${alert.assessmentId}\n`;
    if (alert.dashboardUrl) desc += `**Dashboard:** ${alert.dashboardUrl}\n`;
    if (alert.runbookUrl) desc += `**Runbook:** ${alert.runbookUrl}\n`;
    if (this.description) desc += `\n${this.description}`;

    return desc;
  }

  getDefaultTemplates() {
    return {
      default: {},
    };
  }
}

export default OpsGenieChannel;