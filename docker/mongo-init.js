// MongoDB initialization script for Gixy AI Risk Manager
// This runs on first container startup to create indexes and initial data

// Switch to gixy database
db = db.getSiblingDB('gixy');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'name', 'role'],
      properties: {
        email: { bsonType: 'string', pattern: '^.+@.+$' },
        password: { bsonType: 'string', minLength: 60 }, // bcrypt hash
        name: { bsonType: 'string' },
        role: { enum: ['admin', 'analyst', 'viewer'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
        lastLogin: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('models', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['modelId', 'name', 'type', 'framework', 'owner'],
      properties: {
        modelId: { bsonType: 'string' },
        name: { bsonType: 'string' },
        type: { enum: ['classification', 'regression', 'generative', 'clustering', 'recommendation'] },
        framework: { bsonType: 'string' },
        version: { bsonType: 'string' },
        owner: { bsonType: 'objectId' },
        deploymentContext: { bsonType: 'string' },
        riskScore: { bsonType: 'int', minimum: 0, maximum: 100 },
        status: { enum: ['active', 'review', 'deprecated', 'archived'] },
        tags: { bsonType: 'array', items: { bsonType: 'string' } },
        metadata: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('assessments', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['modelId', 'type', 'status', 'requestedBy'],
      properties: {
        modelId: { bsonType: 'objectId' },
        type: { enum: ['heuristic', 'llm'] },
        status: { enum: ['pending', 'running', 'completed', 'failed'] },
        requestedBy: { bsonType: 'objectId' },
        riskFactors: { bsonType: 'array', items: { bsonType: 'string' } },
        results: { bsonType: 'object' },
        overallScore: { bsonType: 'int', minimum: 0, maximum: 100 },
        riskLevel: { enum: ['critical', 'high', 'medium', 'low'] },
        provider: { bsonType: 'string' },
        modelConfig: { bsonType: 'object' },
        metrics: { bsonType: 'object' },
        error: { bsonType: 'string' },
        startedAt: { bsonType: 'date' },
        completedAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('alerts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'severity', 'source', 'status'],
      properties: {
        title: { bsonType: 'string' },
        message: { bsonType: 'string' },
        severity: { enum: ['critical', 'high', 'medium', 'low', 'info'] },
        source: { bsonType: 'string' },
        sourceId: { bsonType: 'objectId' },
        status: { enum: ['active', 'acknowledged', 'resolved', 'suppressed'] },
        assignee: { bsonType: 'objectId' },
        acknowledgedBy: { bsonType: 'objectId' },
        acknowledgedAt: { bsonType: 'date' },
        resolvedBy: { bsonType: 'objectId' },
        resolvedAt: { bsonType: 'date' },
        tags: { bsonType: 'array', items: { bsonType: 'string' } },
        metadata: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('alertrules', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'condition', 'severity', 'channels'],
      properties: {
        name: { bsonType: 'string' },
        description: { bsonType: 'string' },
        condition: { bsonType: 'object' },
        severity: { enum: ['critical', 'high', 'medium', 'low'] },
        channels: { bsonType: 'array', items: { bsonType: 'objectId' } },
        enabled: { bsonType: 'bool' },
        cooldownMinutes: { bsonType: 'int', minimum: 0 },
        lastTriggered: { bsonType: 'date' },
        triggerCount: { bsonType: 'int' },
        createdBy: { bsonType: 'objectId' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('alertchannels', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'type', 'config'],
      properties: {
        name: { bsonType: 'string' },
        type: { enum: ['email', 'slack', 'webhook', 'pagerduty', 'opsgenie', 'inapp'] },
        config: { bsonType: 'object' },
        enabled: { bsonType: 'bool' },
        createdBy: { bsonType: 'objectId' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

db.models.createIndex({ modelId: 1 }, { unique: true });
db.models.createIndex({ owner: 1 });
db.models.createIndex({ status: 1 });
db.models.createIndex({ riskScore: -1 });
db.models.createIndex({ 'tags': 1 });
db.models.createIndex({ createdAt: -1 });

db.assessments.createIndex({ modelId: 1, createdAt: -1 });
db.assessments.createIndex({ requestedBy: 1 });
db.assessments.createIndex({ status: 1 });
db.assessments.createIndex({ type: 1 });

db.alerts.createIndex({ status: 1, severity: 1, createdAt: -1 });
db.alerts.createIndex({ source: 1, sourceId: 1 });
db.alerts.createIndex({ assignee: 1 });
db.alerts.createIndex({ createdAt: -1 });

db.alertrules.createIndex({ enabled: 1 });
db.alertrules.createIndex({ createdBy: 1 });

db.alertchannels.createIndex({ type: 1 });
db.alertchannels.createIndex({ enabled: 1 });

// Create TTL index for old assessments (optional - keep 1 year)
// db.assessments.createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

print('Gixy database initialized successfully!');
print('Collections created: users, models, assessments, alerts, alertrules, alertchannels');
print('Indexes created for optimal query performance');