import { AlertChannel } from './AlertChannel.js';

/**
 * PagerDuty Alert Channel
 * Sends alerts to PagerDuty via Events API v2
 */
export class PagerDutyChannel extends AlertChannel {
  constructor(config) {
    super(config);
    this.routingKey = config.config.routingKey;
    this.apiUrl = config.config.apiUrl || 'https://events.pagerduty.com/v2/enqueue';
    this.source = config.config.source || 'gixy-alerts';
    this.component = config.config.component || 'ai-risk-manager';
    this.group = config.config.group || 'ai-models';
    this.class = config.config.class || 'model-risk';
    this.customDetails = config.config.customDetails || {};
  }

  async doSend(alert) {
    const severity = this.mapSeverity(alert.severity);
    const eventAction = alert.status === 'resolved' ? 'resolve' : 'trigger';

    const payload = {
      routing_key: this.routingKey,
      event_action: eventAction,
      dedup_key: alert.fingerprint,
      payload: {
        summary: alert.title,
        source: this.source,
        severity,
        component: this.component,
        group: this.group,
        class: this.class,
        custom_details: {
          ...this.customDetails,
          ...alert.metadata,
          message: alert.message,
          category: alert.category,
          modelId: alert.modelId,
          assessmentId: alert.assessmentId,
          dashboardUrl: alert.dashboardUrl,
          runbookUrl: alert.runbookUrl,
        },
      },
      links: this.buildLinks(alert),
      images: this.buildImages(alert),
    };

    // For resolve actions, we need the original dedup_key
    if (eventAction === 'resolve') {
      payload.dedup_key = alert.fingerprint;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Gixy-Alerts/1.0',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(`PagerDuty API error: ${data.message || 'Unknown error'}`);
    }

    return {
      dedupKey: data.dedup_key,
      eventAction,
    };
  }

  mapSeverity(severity) {
    const mapping = {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'critical',
    };
    return mapping[severity] || 'warning';
  }

  buildLinks(alert) {
    const links = [];
    
    if (alert.dashboardUrl) {
      links.push({
        href: alert.dashboardUrl,
        text: 'View Dashboard',
      });
    }
    
    if (alert.runbookUrl) {
      links.push({
        href: alert.runbookUrl,
        text: 'View Runbook',
      });
    }

    return links.length > 0 ? links : undefined;
  }

  buildImages(alert) {
    // Could add charts/graphs if available in metadata
    if (alert.metadata?.chartUrl) {
      return [{
        src: alert.metadata.chartUrl,
        alt: 'Metric Chart',
        href: alert.dashboardUrl,
      }];
    }
    return undefined;
  }

  getDefaultTemplates() {
    return {
      default: {},
    };
  }
}

export default PagerDutyChannel;