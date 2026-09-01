import request from 'supertest';
import { app } from '../../src/index.mjs';
import jwt from 'jsonwebtoken';
import config from '../../src/config/index.js';

// Generate test tokens
const generateTestToken = (payload = { id: 'test-user', role: 'admin' }) => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
};

const adminToken = generateTestToken({ id: 'admin-1', role: 'admin' });
const userToken = generateTestToken({ id: 'user-1', role: 'user' });
const expiredToken = jwt.sign({ id: 'expired-user', role: 'user' }, config.jwtSecret, { expiresIn: '-1h' });

describe('API Endpoints', () => {
  describe('Health Checks', () => {
    it('GET /health should return 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.message).toBe('AI Risk Manager is running');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.version).toBe('1.0.0');
    });

    it('GET /api/v1/health should return 200', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const res = await request(app).post('/api/v1/risk/assess').send({
        modelId: 'test-1',
        modelName: 'Test Model'
      });
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Access token required');
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/risk/assess')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          modelId: 'test-1',
          modelName: 'Test Model'
        });
      expect(res.status).toBe(403);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Invalid token');
    });

    it('should reject requests with expired token', async () => {
      const res = await request(app)
        .post('/api/v1/risk/assess')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          modelId: 'test-1',
          modelName: 'Test Model'
        });
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should accept valid token', async () => {
      const res = await request(app)
        .post('/api/v1/risk/assess')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'test-1',
          modelName: 'Test Model'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    it('POST /api/v1/risk/assess should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v1/risk/assess')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.some(e => e.field === 'modelId')).toBe(true);
      expect(res.body.errors.some(e => e.field === 'modelName')).toBe(true);
    });

    it('POST /api/v1/risk/assess should reject invalid modelId', async () => {
      const res = await request(app)
        .post('/api/v1/risk/assess')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'invalid@model!',
          modelName: 'Test Model'
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some(e => e.field === 'modelId')).toBe(true);
    });

    it('POST /api/v1/risk/assess should accept valid request', async () => {
      const res = await request(app)
        .post('/api/v1/risk/assess')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'test-model-1',
          modelName: 'Test Model',
          riskFactors: ['bias', 'security'],
          version: '1.0.0'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('modelId', 'test-model-1');
      expect(res.body.data).toHaveProperty('modelName', 'Test Model');
      expect(res.body.data).toHaveProperty('riskScore');
      expect(res.body.data).toHaveProperty('severity');
      expect(res.body.data).toHaveProperty('compliant');
      expect(res.body.data.metadata).toBeDefined();
    });

    it('POST /api/v1/risk/assess should work with training data', async () => {
      const res = await request(app)
        .post('/api/v1/risk/assess')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'test-model-2',
          modelName: 'Test Model 2',
          trainingData: {
            stats: {
              gender: {
                inputDistribution: { male: 50, female: 50 },
                outputDistribution: { male: 60, female: 40 }
              }
            }
          }
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metadata.biasAssessment).toBeDefined();
    });
  });

  describe('Quick Risk Check', () => {
    it('POST /api/v1/risk/quick-check should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v1/risk/quick-check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/risk/quick-check should work with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/risk/quick-check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'quick-test-1',
          modelName: 'Quick Test',
          riskFactors: ['security']
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('riskScore');
      expect(res.body.data).toHaveProperty('severity');
    });

    it('POST /api/public/risk/quick-check should work without auth', async () => {
      const res = await request(app)
        .post('/api/public/risk/quick-check')
        .send({
          modelId: 'public-test-1',
          modelName: 'Public Test',
          riskFactors: ['bias']
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Model Registry', () => {
    it('GET /api/v1/models should return empty array', async () => {
      const res = await request(app)
        .get('/api/v1/models')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/models should accept query parameters', async () => {
      const res = await request(app)
        .get('/api/v1/models?page=1&limit=10&sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });

    it('POST /api/v1/models should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v1/models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/models should create model with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'new-model-1',
          modelName: 'New Model',
          version: '1.0.0',
          description: 'A test model',
          tags: ['nlp', 'classification']
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('modelId', 'new-model-1');
    });
  });

  describe('Compliance', () => {
    it('POST /api/v1/compliance/check should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v1/compliance/check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/compliance/check should reject invalid framework', async () => {
      const res = await request(app)
        .post('/api/v1/compliance/check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'test-1',
          framework: 'invalid-framework'
        });
      expect(res.status).toBe(400);
      expect(res.body.errors.some(e => e.field === 'framework')).toBe(true);
    });

    it('POST /api/v1/compliance/check should accept valid framework', async () => {
      const res = await request(app)
        .post('/api/v1/compliance/check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          modelId: 'test-1',
          framework: 'eu-ai-act'
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('compliant', true);
    });

    it('GET /api/v1/compliance/frameworks should return available frameworks', async () => {
      const res = await request(app)
        .get('/api/v1/compliance/frameworks')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data.map(f => f.id)).toEqual(['eu-ai-act', 'nist-ai-rmf', 'iso-42001']);
    });
  });

  describe('Dashboard Metrics', () => {
    it('GET /api/v1/dashboard/metrics should return metrics', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/metrics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalModels');
      expect(res.body.data).toHaveProperty('riskDistribution');
      expect(res.body.data).toHaveProperty('averageRiskScore');
      expect(res.body.data).toHaveProperty('complianceRate');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit after 100 requests', async () => {
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/v1/health')
          .set('Authorization', `Bearer ${adminToken}`);
      }

      // 101st request should be rate limited
      const res = await request(app)
        .get('/api/v1/health')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(429);
    });
  });
});