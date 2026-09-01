import { Alert, AlertRule, AlertChannelConfig, AlertSeverity, AlertStatus, AlertCategory, AlertChannel } from '../../src/alerts/types.js';
import { AlertChannel as BaseAlertChannel } from '../../src/alerts/channels/AlertChannel.js';
import { EmailChannel } from '../../src/alerts/channels/EmailChannel.js';
import { WebhookChannel } from '../../src/alerts/channels/WebhookChannel.js';
import { SlackChannel } from '../../src/alerts/channels/SlackChannel.js';
import { PagerDutyChannel } from '../../src/alerts/channels/PagerDutyChannel.js';
import { OpsGenieChannel } from '../../src/alerts/channels/OpsGenieChannel.js';
import { InAppChannel } from '../../src/alerts/channels/InAppChannel.js';
import { AlertRulesEngine } from '../../src/alerts/AlertRulesEngine.js';
import { AlertStore, MemoryAlertStore } from '../../src/alerts/AlertStore.js';
import { NotificationManager } from '../../src/alerts/NotificationManager.js';
import { AlertsConfig, validateAlertsConfig, getChannelConfigDefaults } from '../../src/alerts/config.js';
import { createNotificationManager, quickAlert } from '../../src/alerts/index.js';

describe('Alert Types', () => {
  describe('Alert', () => {
    test('should create alert with defaults', () => {
      const alert = new Alert({ title: 'Test Alert', message: 'Test message' });
      expect(alert.id).toBeDefined();
      expect(alert.title).toBe('Test Alert');
      expect(alert.message).toBe('Test message');
      expect(alert.severity).toBe(AlertSeverity.INFO);
      expect(alert.status).toBe(AlertStatus.ACTIVE);
      expect(alert.category).toBe(AlertCategory.SYSTEM);
      expect(alert.fingerprint).toBeDefined();
      expect(alert.createdAt).toBeDefined();
    });

    test('should acknowledge alert', () => {
      const alert = new Alert({ title: 'Test' });
      alert.acknowledge('user123');
      expect(alert.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(alert.acknowledgedBy).toBe('user123');
      expect(alert.acknowledgedAt).toBeDefined();
    });

    test('should resolve alert', () => {
      const alert = new Alert({ title: 'Test' });
      alert.resolve('user123');
      expect(alert.status).toBe(AlertStatus.RESOLVED);
      expect(alert.resolvedBy).toBe('user123');
      expect(alert.resolvedAt).toBeDefined();
    });

    test('should suppress alert', () => {
      const alert = new Alert({ title: 'Test' });
      const until = new Date(Date.now() + 3600000).toISOString();
      alert.suppress(until);
      expect(alert.status).toBe(AlertStatus.SUPPRESSED);
      expect(alert.suppressedUntil).toBe(until);
    });

    test('should escalate alert', () => {
      const alert = new Alert({ title: 'Test' });
      alert.escalate();
      expect(alert.escalationLevel).toBe(1);
    });

    test('should serialize to JSON', () => {
      const alert = new Alert({ title: 'Test', metadata: { key: 'value' } });
      const json = alert.toJSON();
      expect(json.title).toBe('Test');
      expect(json.metadata.key).toBe('value');
    });

    test('should deserialize from JSON', () => {
      const original = new Alert({ title: 'Test', severity: AlertSeverity.CRITICAL });
      const json = original.toJSON();
      const restored = Alert.fromJSON(json);
      expect(restored.title).toBe('Test');
      expect(restored.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('AlertRule', () => {
    test('should create rule with defaults', () => {
      const rule = new AlertRule({ name: 'Test Rule' });
      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Test Rule');
      expect(rule.enabled).toBe(true);
      expect(rule.cooldown).toBe(300000);
    });

    test('should evaluate conditions', () => {
      const rule = new AlertRule({
        name: 'Test',
        conditions: [
          { field: 'riskScore', operator: 'gte', value: 70 },
          { field: 'category', operator: 'eq', value: 'model_risk' },
        ],
      });

      const context = { riskScore: 80, category: 'model_risk' };
      expect(rule.evaluate(context)).toBe(true);

      const context2 = { riskScore: 50, category: 'model_risk' };
      expect(rule.evaluate(context2)).toBe(false);
    });

    test('should evaluate all operators', () => {
      const rule = new AlertRule({
        conditions: [
          { field: 'value', operator: 'eq', value: 10 },
          { field: 'value', operator: 'ne', value: 20 },
          { field: 'value', operator: 'gt', value: 5 },
          { field: 'value', operator: 'gte', value: 10 },
          { field: 'value', operator: 'lt', value: 15 },
          { field: 'value', operator: 'lte', value: 10 },
          { field: 'text', operator: 'contains', value: 'hello' },
          { field: 'text', operator: 'not_contains', value: 'world' },
          { field: 'value', operator: 'in', value: [1, 2, 3, 10] },
          { field: 'value', operator: 'not_in', value: [4, 5, 6] },
          { field: 'text', operator: 'regex', value: '^hello.*' },
          { field: 'exists', operator: 'exists' },
          { field: 'missing', operator: 'not_exists' },
        ],
      });

      const context = {
        value: 10,
        text: 'hello test',
        exists: 'present',
      };

      expect(rule.evaluate(context)).toBe(true);
    });

    test('should handle nested fields', () => {
      const rule = new AlertRule({
        conditions: [
          { field: 'metrics.accuracy', operator: 'lt', value: 0.9 },
        ],
      });

      const context = { metrics: { accuracy: 0.85 } };
      expect(rule.evaluate(context)).toBe(true);

      const context2 = { metrics: { accuracy: 0.95 } };
      expect(rule.evaluate(context2)).toBe(false);
    });

    test('should respect cooldown', () => {
      const rule = new AlertRule({
        cooldown: 1000,
      });
      rule.markTriggered();
      expect(rule.shouldTrigger()).toBe(false);
    });
  });

  describe('AlertChannelConfig', () => {
    test('should create config with defaults', () => {
      const config = new AlertChannelConfig({
        name: 'Test Channel',
        type: AlertChannel.EMAIL,
      });
      expect(config.id).toBeDefined();
      expect(config.name).toBe('Test Channel');
      expect(config.type).toBe(AlertChannel.EMAIL);
      expect(config.enabled).toBe(true);
    });

    test('should match filters', () => {
      const config = new AlertChannelConfig({
        filters: { severity: 'critical', category: 'model_risk' },
      });

      const alert1 = new Alert({ severity: 'critical', category: 'model_risk' });
      const alert2 = new Alert({ severity: 'warning', category: 'model_risk' });
      const alert3 = new Alert({ severity: 'critical', category: 'compliance' });

      expect(config.matchesFilter(alert1)).toBe(true);
      expect(config.matchesFilter(alert2)).toBe(false);
      expect(config.matchesFilter(alert3)).toBe(false);
    });
  });
});

describe('Alert Channels', () => {
  describe('BaseAlertChannel', () => {
    test('should create channel', () => {
      const channel = new BaseAlertChannel({
        id: 'test',
        name: 'Test',
        type: 'test',
        enabled: true,
      });
      expect(channel.id).toBe('test');
      expect(channel.enabled).toBe(true);
    });

    test('should check rate limits', () => {
      const channel = new BaseAlertChannel({
        rateLimit: { maxPerMinute: 2, maxPerHour: 10 },
      });
      
      expect(channel.checkRateLimit()).toBe(true);
      channel.incrementRateLimit();
      expect(channel.checkRateLimit()).toBe(true);
      channel.incrementRateLimit();
      expect(channel.checkRateLimit()).toBe(false);
    });

    test('should render templates', () => {
      const channel = new BaseAlertChannel({
        templates: {
          default: {
            subject: 'Alert: {{alert.title}}',
            body: 'Message: {{alert.message}}',
          },
        },
      });

      const alert = new Alert({ title: 'Test', message: 'Hello' });
      const rendered = channel.renderTemplate(
        channel.getTemplate('info'),
        alert
      );

      expect(rendered.subject).toBe('Alert: Test');
      expect(rendered.body).toBe('Message: Hello');
    });
  });

  describe('EmailChannel', () => {
    test('should create email channel', () => {
      const channel = new EmailChannel({
        id: 'email1',
        name: 'Email',
        type: 'email',
        config: { from: 'test@example.com', to: ['recipient@example.com'] },
      });
      expect(channel.from).toBe('test@example.com');
      expect(channel.to).toEqual(['recipient@example.com']);
    });

    test('should get default templates', () => {
      const channel = new EmailChannel({
        config: { from: 'test@example.com', to: ['recipient@example.com'] }
      });
      const templates = channel.getDefaultTemplates();
      expect(templates.default).toBeDefined();
      expect(templates.critical).toBeDefined();
      expect(templates.emergency).toBeDefined();
    });
  });

  describe('WebhookChannel', () => {
    test('should create webhook channel', () => {
      const channel = new WebhookChannel({
        config: { url: 'https://webhook.example.com', secret: 'secret123' },
      });
      expect(channel.url).toBe('https://webhook.example.com');
      expect(channel.secret).toBe('secret123');
    });

    test('should build default payload', () => {
      const channel = new WebhookChannel({ config: { url: 'https://test.com' } });
      const alert = new Alert({ title: 'Test', message: 'Test message' });
      const payload = channel.buildDefaultPayload(alert);
      
      expect(payload.alert.title).toBe('Test');
      expect(payload.source).toBe('gixy-alerts');
    });
  });

  describe('SlackChannel', () => {
    test('should create slack channel', () => {
      const channel = new SlackChannel({
        config: { webhookUrl: 'https://hooks.slack.com/test', channel: '#test' },
      });
      expect(channel.webhookUrl).toBe('https://hooks.slack.com/test');
      expect(channel.defaultChannel).toBe('#test');
    });

    test('should build slack message', () => {
      const channel = new SlackChannel({ config: { webhookUrl: 'https://test.com' } });
      const alert = new Alert({ 
        title: 'Test Alert', 
        message: 'Test message',
        severity: 'critical',
        modelId: 'model-123',
      });
      const message = channel.buildSlackMessage(alert, {});
      
      expect(message.blocks).toBeDefined();
      expect(message.blocks.length).toBeGreaterThan(0);
      expect(message.attachments).toBeDefined();
    });
  });

  describe('PagerDutyChannel', () => {
    test('should create pagerduty channel', () => {
      const channel = new PagerDutyChannel({
        config: { routingKey: 'key123' },
      });
      expect(channel.routingKey).toBe('key123');
    });

    test('should map severity', () => {
      const channel = new PagerDutyChannel({ config: { routingKey: 'key' } });
      expect(channel.mapSeverity('info')).toBe('info');
      expect(channel.mapSeverity('warning')).toBe('warning');
      expect(channel.mapSeverity('critical')).toBe('critical');
      expect(channel.mapSeverity('emergency')).toBe('critical');
    });
  });

  describe('OpsGenieChannel', () => {
    test('should create opsgenie channel', () => {
      const channel = new OpsGenieChannel({
        config: { apiKey: 'key123', teams: ['team1'] },
      });
      expect(channel.apiKey).toBe('key123');
      expect(channel.teams).toEqual(['team1']);
    });

    test('should map priority', () => {
      const channel = new OpsGenieChannel({ config: { apiKey: 'key' } });
      expect(channel.mapPriority('info')).toBe('P5');
      expect(channel.mapPriority('warning')).toBe('P3');
      expect(channel.mapPriority('critical')).toBe('P1');
      expect(channel.mapPriority('emergency')).toBe('P1');
    });
  });

  describe('InAppChannel', () => {
    test('should create in-app channel', () => {
      const mockDb = {
        collection: () => ({
          insertOne: jest.fn().mockResolvedValue({ insertedId: 'id123' }),
          countDocuments: jest.fn().mockResolvedValue(10),
          find: () => ({ 
            sort: () => ({ 
              limit: () => ({ forEach: jest.fn() }) 
            }) 
          }),
          updateOne: jest.fn(),
          deleteOne: jest.fn(),
        }),
      };

      const channel = new InAppChannel({ config: { collection: 'notifs' } }, mockDb);
      expect(channel.collection).toBe('notifs');
    });
  });
});

describe('AlertRulesEngine', () => {
  let engine;
  let mockStore;

  beforeEach(() => {
    mockStore = new MemoryAlertStore();
    engine = new AlertRulesEngine({ alertStore: mockStore });
  });

  test('should register and unregister rules', () => {
    const rule = new AlertRule({ name: 'Test Rule' });
    engine.registerRule(rule);
    expect(engine.getRule(rule.id)).toBe(rule);
    
    engine.unregisterRule(rule.id);
    expect(engine.getRule(rule.id)).toBeNull();
  });

  test('should register and unregister channels', () => {
    const channelConfig = new AlertChannelConfig({
      type: 'in_app',
      name: 'Test Channel',
    });
    
    const mockDb = { collection: () => ({ insertOne: jest.fn().mockResolvedValue({ insertedId: 'id123' }) }) };
    engine.registerChannel(channelConfig, mockDb);
    
    expect(engine.getChannel(channelConfig.id)).toBeDefined();
    
    engine.unregisterChannel(channelConfig.id);
    expect(engine.getChannel(channelConfig.id)).toBeNull();
  });

  test('should trigger alert from rule', async () => {
    const rule = new AlertRule({
      name: 'High Risk',
      conditions: [{ field: 'riskScore', operator: 'gte', value: 70 }],
      actions: [],
    });
    engine.registerRule(rule);

    const alerts = await engine.evaluate({ riskScore: 80 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('High Risk');
    expect(alerts[0].metadata.ruleId).toBe(rule.id);
  });

  test('should not trigger if cooldown active', async () => {
    const rule = new AlertRule({
      name: 'High Risk',
      conditions: [{ field: 'riskScore', operator: 'gte', value: 70 }],
      cooldown: 1000,
    });
    engine.registerRule(rule);

    await engine.evaluate({ riskScore: 80 });
    const alerts = await engine.evaluate({ riskScore: 80 });
    expect(alerts).toHaveLength(0);
  });

  test('should manually trigger alert', async () => {
    const alert = await engine.triggerAlert({
      title: 'Manual Alert',
      message: 'Manual test',
      severity: 'critical',
    });
    
    expect(alert.title).toBe('Manual Alert');
    expect(alert.severity).toBe('critical');
  });

  test('should acknowledge and resolve alerts', async () => {
    const alert = await engine.triggerAlert({ title: 'Test', message: 'Test' });
    
    await engine.acknowledgeAlert(alert.id, 'user1');
    const acknowledged = await mockStore.findById(alert.id);
    expect(acknowledged.status).toBe(AlertStatus.ACKNOWLEDGED);
    
    await engine.resolveAlert(alert.id, 'user1');
    const resolved = await mockStore.findById(alert.id);
    expect(resolved.status).toBe(AlertStatus.RESOLVED);
  });

  test('should get engine stats', () => {
    const rule = new AlertRule({ name: 'Test' });
    engine.registerRule(rule);
    
    const stats = engine.getStats();
    expect(stats.totalRules).toBe(1);
    expect(stats.enabledRules).toBe(1);
  });
});

describe('AlertStore', () => {
  let store;

  beforeEach(() => {
    store = new MemoryAlertStore();
  });

  test('should save and find alerts', async () => {
    const alert = new Alert({ title: 'Test', message: 'Test' });
    await store.save(alert);
    
    const found = await store.findById(alert.id);
    expect(found.title).toBe('Test');
  });

  test('should find alerts with query', async () => {
    const alert1 = new Alert({ title: 'Test 1', severity: 'critical' });
    const alert2 = new Alert({ title: 'Test 2', severity: 'warning' });
    await store.save(alert1);
    await store.save(alert2);

    const critical = await store.find({ severity: 'critical' });
    expect(critical).toHaveLength(1);
    expect(critical[0].title).toBe('Test 1');
  });

  test('should update alerts', async () => {
    const alert = new Alert({ title: 'Test', status: 'active' });
    await store.save(alert);
    
    alert.status = 'resolved';
    await store.update(alert);
    
    const found = await store.findById(alert.id);
    expect(found.status).toBe('resolved');
  });

  test('should delete alerts', async () => {
    const alert = new Alert({ title: 'Test' });
    await store.save(alert);
    
    await store.delete(alert.id);
    const found = await store.findById(alert.id);
    expect(found).toBeNull();
  });

  test('should count alerts', async () => {
    await store.save(new Alert({ title: '1' }));
    await store.save(new Alert({ title: '2' }));
    
    const count = await store.count({});
    expect(count).toBe(2);
  });

  test('should save and find rules', async () => {
    const rule = new AlertRule({ name: 'Test Rule' });
    await store.saveRule(rule);
    
    const found = await store.findRuleById(rule.id);
    expect(found.name).toBe('Test Rule');
  });

  test('should save and find channel configs', async () => {
    const config = new AlertChannelConfig({ name: 'Test', type: 'email' });
    await store.saveChannelConfig(config);
    
    const found = await store.findChannelConfigById(config.id);
    expect(found.name).toBe('Test');
  });

  test('should clear all data', () => {
    store.clear();
    expect(store.alerts.size).toBe(0);
    expect(store.rules.size).toBe(0);
    expect(store.channels.size).toBe(0);
  });
});

describe('NotificationManager', () => {
  let manager;
  let mockStore;

  beforeEach(async () => {
    mockStore = new MemoryAlertStore();
    manager = new NotificationManager({ alertStore: mockStore });
    await manager.initialize(null);
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test('should create and trigger alert', async () => {
    const alert = await manager.createAlert({
      title: 'Test Alert',
      message: 'Test message',
      severity: 'warning',
    });
    
    expect(alert.title).toBe('Test Alert');
    expect(alert.severity).toBe('warning');
  });

  test('should create rule', async () => {
    const rule = await manager.createRule({
      name: 'Test Rule',
      conditions: [{ field: 'value', operator: 'gt', value: 10 }],
    });
    
    expect(rule.name).toBe('Test Rule');
    const found = await manager.getRule(rule.id);
    expect(found).toBeDefined();
  });

  test('should update rule', async () => {
    const rule = await manager.createRule({ name: 'Original' });
    const updated = await manager.updateRule(rule.id, { name: 'Updated' });
    
    expect(updated.name).toBe('Updated');
  });

  test('should delete rule', async () => {
    const rule = await manager.createRule({ name: 'To Delete' });
    await manager.deleteRule(rule.id);
    
    const found = await manager.getRule(rule.id);
    expect(found).toBeNull();
  });

  test('should enable/disable rule', async () => {
    const rule = await manager.createRule({ name: 'Test', enabled: true });
    await manager.setRuleEnabled(rule.id, false);
    
    const found = await manager.getRule(rule.id);
    expect(found.enabled).toBe(false);
  });

  test('should get alert stats', async () => {
    await manager.createAlert({ title: 'Critical', severity: 'critical' });
    await manager.createAlert({ title: 'Warning', severity: 'warning' });
    await manager.createAlert({ title: 'Info', severity: 'info' });
    
    const stats = await manager.getAlertStats();
    expect(stats.total).toBe(3);
    expect(stats.critical).toBe(1);
    expect(stats.bySeverity.critical).toBe(1);
    expect(stats.bySeverity.warning).toBe(1);
    expect(stats.bySeverity.info).toBe(1);
  });

  test('should create built-in rules', () => {
    const riskRule = NotificationManager.createHighRiskRule({ threshold: 80 });
    expect(riskRule.name).toBe('High Risk Score Detected');
    expect(riskRule.conditions[0].value).toBe(80);

    const complianceRule = NotificationManager.createComplianceViolationRule({ framework: 'gdpr' });
    expect(complianceRule.conditions[1].value).toBe('gdpr');

    const perfRule = NotificationManager.createPerformanceDegradationRule({ accuracyThreshold: 0.9 });
    expect(perfRule.conditions[0].value).toBe(0.9);

    const driftRule = NotificationManager.createDataDriftRule({ threshold: 0.5 });
    expect(driftRule.conditions[0].value).toBe(0.5);

    const securityRule = NotificationManager.createSecurityAnomalyRule({ threshold: 0.9 });
    expect(securityRule.conditions[0].value).toBe(0.9);
  });
});

describe('AlertsConfig', () => {
  test('should have default config', () => {
    expect(AlertsConfig.evaluationInterval).toBe(60000);
    expect(AlertsConfig.providers).toBeDefined();
    expect(AlertsConfig.channels).toBeDefined();
    expect(AlertsConfig.rules).toBeDefined();
  });

  test('should validate config', () => {
    const config = {
      ...AlertsConfig,
      providers: { ...AlertsConfig.providers, in_app: { enabled: true } },
      defaultChannels: ['in_app'],
    };
    
    const result = validateAlertsConfig(config);
    expect(result.valid).toBe(true);
  });

  test('should get channel defaults', () => {
    const emailDefaults = getChannelConfigDefaults('email');
    expect(emailDefaults.type).toBe('email');
    expect(emailDefaults.config.from).toBe('alerts@gixy.ai');

    const slackDefaults = getChannelConfigDefaults('slack');
    expect(slackDefaults.type).toBe('slack');
    expect(slackDefaults.config.channel).toBe('#alerts');
  });
});

describe('Module Exports', () => {
  test('should export all types', () => {
    expect(Alert).toBeDefined();
    expect(AlertRule).toBeDefined();
    expect(AlertChannelConfig).toBeDefined();
    expect(AlertSeverity).toBeDefined();
    expect(AlertStatus).toBeDefined();
    expect(AlertCategory).toBeDefined();
    expect(AlertChannel).toBeDefined();
  });

  test('should export all channels', () => {
    expect(BaseAlertChannel).toBeDefined();
    expect(EmailChannel).toBeDefined();
    expect(WebhookChannel).toBeDefined();
    expect(SlackChannel).toBeDefined();
    expect(PagerDutyChannel).toBeDefined();
    expect(OpsGenieChannel).toBeDefined();
    expect(InAppChannel).toBeDefined();
  });

  test('should export engines and stores', () => {
    expect(AlertRulesEngine).toBeDefined();
    expect(AlertStore).toBeDefined();
    expect(MemoryAlertStore).toBeDefined();
  });

  test('should export manager', () => {
    expect(NotificationManager).toBeDefined();
  });

  test('should export config', () => {
    expect(AlertsConfig).toBeDefined();
    expect(validateAlertsConfig).toBeDefined();
    expect(getChannelConfigDefaults).toBeDefined();
  });

  test('should export utilities', () => {
    expect(createNotificationManager).toBeDefined();
    expect(quickAlert).toBeDefined();
  });
});