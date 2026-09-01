import { AlertChannel } from './AlertChannel.js';

/**
 * Slack Alert Channel
 * Sends alerts to Slack via webhook or bot token
 */
export class SlackChannel extends AlertChannel {
  constructor(config) {
    super(config);
    this.webhookUrl = config.config.webhookUrl;
    this.botToken = config.config.botToken;
    this.defaultChannel = config.config.channel || '#alerts';
    this.username = config.config.username || 'Gixy Alerts';
    this.iconEmoji = config.config.iconEmoji || ':warning:';
    this.iconUrl = config.config.iconUrl;
    this.mentionUsers = config.config.mentionUsers || [];
    this.mentionGroups = config.config.mentionGroups || [];
  }

  async doSend(alert) {
    const template = this.getTemplate(alert.severity);
    const message = this.buildSlackMessage(alert, template);

    if (this.webhookUrl) {
      return this.sendViaWebhook(message);
    } else if (this.botToken) {
      return this.sendViaBot(message);
    } else {
      throw new Error('Slack channel requires either webhookUrl or botToken');
    }
  }

  buildSlackMessage(alert, template) {
    const severityEmoji = {
      info: ':information_source:',
      warning: ':warning:',
      critical: ':rotating_light:',
      emergency: ':fire:',
    };

    const severityColor = {
      info: '#17a2b8',
      warning: '#ffc107',
      critical: '#dc3545',
      emergency: '#6f42c1',
    };

    const mentions = [
      ...this.mentionUsers.map(u => `<@${u}>`),
      ...this.mentionGroups.map(g => `<!subteam^${g}>`),
    ];

    // Add severity-based mentions
    if (alert.severity === 'critical' || alert.severity === 'emergency') {
      mentions.push('<!channel>');
    }

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji[alert.severity] || ':bell:'} ${alert.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alert.message,
        },
      },
      {
        type: 'divider',
      },
    ];

    // Add metadata fields
    const fields = [
      {
        type: 'mrkdwn',
        text: `*Severity:*\n${alert.severity.toUpperCase()}`,
      },
      {
        type: 'mrkdwn',
        text: `*Category:*\n${alert.category.replace(/_/g, ' ')}`,
      },
      {
        type: 'mrkdwn',
        text: `*Source:*\n${alert.source}`,
      },
      {
        type: 'mrkdwn',
        text: `*Time:*\n${new Date(alert.createdAt).toLocaleString()}`,
      },
    ];

    if (alert.modelId) {
      fields.push({
        type: 'mrkdwn',
        text: `*Model:*\n${alert.modelId}`,
      });
    }

    if (alert.assessmentId) {
      fields.push({
        type: 'mrkdwn',
        text: `*Assessment:*\n${alert.assessmentId}`,
      });
    }

    blocks.push({
      type: 'section',
      fields,
    });

    // Add action buttons
    const actions = [];
    if (alert.dashboardUrl) {
      actions.push({
        type: 'button',
        text: { type: 'plain_text', text: 'View Dashboard', emoji: true },
        url: alert.dashboardUrl,
        style: alert.severity === 'critical' || alert.severity === 'emergency' ? 'danger' : 'primary',
      });
    }
    if (alert.runbookUrl) {
      actions.push({
        type: 'button',
        text: { type: 'plain_text', text: 'View Runbook', emoji: true },
        url: alert.runbookUrl,
      });
    }
    if (actions.length > 0) {
      blocks.push({ type: 'actions', elements: actions });
    }

    // Add context
    const contextElements = [
      {
        type: 'mrkdwn',
        text: `Alert ID: \`${alert.id}\``,
      },
    ];
    if (mentions.length > 0) {
      contextElements.unshift({
        type: 'mrkdwn',
        text: mentions.join(' '),
      });
    }
    blocks.push({
      type: 'context',
      elements: contextElements,
    });

    return {
      channel: alert.metadata?.slackChannel || this.defaultChannel,
      username: this.username,
      icon_emoji: this.iconEmoji,
      icon_url: this.iconUrl,
      blocks,
      attachments: [
        {
          color: severityColor[alert.severity] || '#17a2b8',
          blocks: blocks.slice(1), // Exclude header from attachment
        },
      ],
    };
  }

  async sendViaWebhook(message) {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}: ${await response.text()}`);
    }

    return { method: 'webhook', ts: await response.text() };
  }

  async sendViaBot(message) {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.botToken}`,
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return { method: 'bot', ts: data.ts, channel: data.channel };
  }

  getDefaultTemplates() {
    return {
      default: {},
      critical: {
        // Additional critical-specific formatting handled in buildSlackMessage
      },
      emergency: {
        // Additional emergency-specific formatting handled in buildSlackMessage
      },
    };
  }
}

export default SlackChannel;