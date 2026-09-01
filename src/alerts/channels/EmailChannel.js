import { AlertChannel } from './AlertChannel.js';

/**
 * Email Alert Channel
 * Sends alerts via email using nodemailer
 */
export class EmailChannel extends AlertChannel {
  constructor(config) {
    super(config);
    this.transporter = null;
    this.from = config.config.from || 'alerts@gixy.ai';
    this.to = config.config.to || [];
    this.cc = config.config.cc || [];
    this.bcc = config.config.bcc || [];
  }

  async initialize() {
    // Dynamic import to avoid requiring nodemailer if not used
    const nodemailer = await import('nodemailer');
    
    this.transporter = nodemailer.default.createTransport({
      host: this.config.config.host || 'localhost',
      port: this.config.config.port || 587,
      secure: this.config.config.secure || false,
      auth: this.config.config.auth || {},
      ...this.config.config.transportOptions,
    });

    // Verify connection
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      throw new Error(`Email channel initialization failed: ${error.message}`);
    }
  }

  async doSend(alert) {
    if (!this.transporter) {
      await this.initialize();
    }

    const template = this.getTemplate(alert.severity);
    const rendered = this.renderTemplate(template, alert);

    const recipients = this.getRecipients(alert);

    const mailOptions = {
      from: this.from,
      to: recipients.to.join(', '),
      cc: recipients.cc.join(', '),
      bcc: recipients.bcc.join(', '),
      subject: rendered.subject,
      text: rendered.body,
      html: rendered.html,
      headers: {
        'X-Alert-ID': alert.id,
        'X-Alert-Severity': alert.severity,
        'X-Alert-Category': alert.category,
      },
    };

    const info = await this.transporter.sendMail(mailOptions);
    
    return {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  }

  getRecipients(alert) {
    // Allow override per alert
    const alertTo = alert.metadata?.emailTo || this.to;
    const alertCc = alert.metadata?.emailCc || this.cc;
    const alertBcc = alert.metadata?.emailBcc || this.bcc;

    return {
      to: Array.isArray(alertTo) ? alertTo : [alertTo].filter(Boolean),
      cc: Array.isArray(alertCc) ? alertCc : [alertCc].filter(Boolean),
      bcc: Array.isArray(alertBcc) ? alertBcc : [alertBcc].filter(Boolean),
    };
  }

  getDefaultTemplates() {
    return {
      default: {
        subject: '🔔 [{{alert.severity | upper}}] {{alert.title}}',
        body: `
Alert: {{alert.title}}
Severity: {{alert.severity}}
Category: {{alert.category}}
Source: {{alert.source}}
Time: {{timestamp}}

{{alert.message}}

---
Alert ID: {{alert.id}}
Model: {{alert.modelId || 'N/A'}}
Assessment: {{alert.assessmentId || 'N/A'}}
Dashboard: {{alert.dashboardUrl || 'N/A'}}
Runbook: {{alert.runbookUrl || 'N/A'}}
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .alert-header { background: #f5f5f5; padding: 20px; border-radius: 8px 8px 0 0; border-left: 4px solid #007bff; }
    .alert-critical { border-left-color: #dc3545; }
    .alert-warning { border-left-color: #ffc107; }
    .alert-info { border-left-color: #17a2b8; }
    .alert-emergency { border-left-color: #6f42c1; }
    .alert-body { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
    .meta { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 0.9em; }
    .meta-row { display: flex; margin: 5px 0; }
    .meta-label { font-weight: bold; width: 120px; }
    .message { white-space: pre-wrap; margin: 15px 0; }
    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 0.85em; color: #666; }
  </style>
</head>
<body>
  <div class="alert-header alert-{{alert.severity}}">
    <h2 style="margin: 0;">{{alert.title}}</h2>
  </div>
  <div class="alert-body">
    <div class="message">{{alert.message}}</div>
    
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Severity:</span> <span class="meta-value">{{alert.severity | upper}}</span></div>
      <div class="meta-row"><span class="meta-label">Category:</span> <span class="meta-value">{{alert.category}}</span></div>
      <div class="meta-row"><span class="meta-label">Source:</span> <span class="meta-value">{{alert.source}}</span></div>
      <div class="meta-row"><span class="meta-label">Time:</span> <span class="meta-value">{{timestamp}}</span></div>
    </div>

    <div class="footer">
      <div>Alert ID: {{alert.id}}</div>
      <div>Model: {{alert.modelId || 'N/A'}}</div>
      <div>Assessment: {{alert.assessmentId || 'N/A'}}</div>
      <div><a href="{{alert.dashboardUrl}}">View Dashboard</a></div>
      <div><a href="{{alert.runbookUrl}}">View Runbook</a></div>
    </div>
  </div>
</body>
</html>
        `,
      },
      critical: {
        subject: '🚨 CRITICAL: {{alert.title}}',
      },
      emergency: {
        subject: '🔴 EMERGENCY: {{alert.title}}',
      },
    };
  }
}

export default EmailChannel;