import RiskEngine from '../../src/engine/riskEngine.js';
import BiasDetector from '../../src/engine/biasDetector.js';
import SecurityAnalyzer from '../../src/engine/securityAnalyzer.js';
import PerformanceMetrics from '../../src/engine/performanceMetrics.js';
import RiskModel from '../../src/models/riskModel.js';

describe('RiskEngine', () => {
  let riskEngine;

  beforeEach(() => {
    riskEngine = new RiskEngine();
  });

  describe('assessFullRisk', () => {
    it('should return a RiskModel with all required fields', () => {
      const result = riskEngine.assessFullRisk({
        modelId: 'test-model-1',
        modelName: 'Test Model',
        riskFactors: ['bias', 'security']
      });

      expect(result).toBeInstanceOf(RiskModel);
      expect(result.modelId).toBe('test-model-1');
      expect(result.modelName).toBe('Test Model');
      expect(typeof result.riskScore).toBe('number');
      expect(['low', 'medium', 'high']).toContain(result.severity);
      expect(Array.isArray(result.riskFactors)).toBe(true);
      expect(typeof result.compliant).toBe('boolean');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.assessmentTimestamp).toBeDefined();
    });

    it('should calculate higher risk score when bias factor is present', () => {
      const resultWithBias = riskEngine.assessFullRisk({
        modelId: 'test-1',
        modelName: 'Test',
        riskFactors: ['bias']
      });

      const resultWithoutBias = riskEngine.assessFullRisk({
        modelId: 'test-2',
        modelName: 'Test',
        riskFactors: []
      });

      expect(resultWithBias.riskScore).toBeGreaterThan(resultWithoutBias.riskScore);
    });

    it('should calculate higher risk score when security factor is present', () => {
      const resultWithSecurity = riskEngine.assessFullRisk({
        modelId: 'test-1',
        modelName: 'Test',
        riskFactors: ['security']
      });

      const resultWithoutSecurity = riskEngine.assessFullRisk({
        modelId: 'test-2',
        modelName: 'Test',
        riskFactors: []
      });

      expect(resultWithSecurity.riskScore).toBeGreaterThan(resultWithoutSecurity.riskScore);
    });

    it('should include training data in bias assessment when provided', () => {
      const result = riskEngine.assessFullRisk({
        modelId: 'test-1',
        modelName: 'Test',
        trainingData: {
          stats: {
            gender: {
              inputDistribution: { male: 50, female: 50 },
              outputDistribution: { male: 60, female: 40 }
            }
          }
        }
      });

      expect(result.metadata.biasAssessment).toBeDefined();
      expect(typeof result.metadata.biasAssessment.biasScore).toBe('number');
    });

    it('should include model config in security assessment when provided', () => {
      const result = riskEngine.assessFullRisk({
        modelId: 'test-1',
        modelName: 'Test',
        modelConfig: {
          adversarialTraining: true,
          dataSanitization: true
        }
      });

      expect(result.metadata.securityAssessment).toBeDefined();
      expect(typeof result.metadata.securityAssessment.overallRiskScore).toBe('number');
    });

    it('should include metrics in performance assessment when provided', () => {
      const result = riskEngine.assessFullRisk({
        modelId: 'test-1',
        modelName: 'Test',
        metrics: {
          accuracy: 90,
          precision: 85,
          recall: 88,
          f1_score: 86,
          latency: 50,
          throughput: 1000
        }
      });

      expect(result.metadata.performanceAssessment).toBeDefined();
      expect(typeof result.metadata.performanceAssessment.overallScore).toBe('number');
    });
  });

  describe('quickRiskCheck', () => {
    it('should return quick risk summary', () => {
      const result = riskEngine.quickRiskCheck({
        modelId: 'test-1',
        modelName: 'Test',
        riskFactors: ['security']
      });

      expect(result).toHaveProperty('modelId', 'test-1');
      expect(result).toHaveProperty('modelName', 'Test');
      expect(typeof result.riskScore).toBe('number');
      expect(['low', 'medium', 'high']).toContain(result.severity);
      expect(Array.isArray(result.riskFactors)).toBe(true);
      expect(typeof result.compliant).toBe('boolean');
    });
  });

  describe('_getSeverity', () => {
    it('should return high for scores >= 70', () => {
      expect(riskEngine._getSeverity(70)).toBe('high');
      expect(riskEngine._getSeverity(85)).toBe('high');
      expect(riskEngine._getSeverity(100)).toBe('high');
    });

    it('should return medium for scores 40-69', () => {
      expect(riskEngine._getSeverity(40)).toBe('medium');
      expect(riskEngine._getSeverity(55)).toBe('medium');
      expect(riskEngine._getSeverity(69)).toBe('medium');
    });

    it('should return low for scores < 40', () => {
      expect(riskEngine._getSeverity(0)).toBe('low');
      expect(riskEngine._getSeverity(25)).toBe('low');
      expect(riskEngine._getSeverity(39)).toBe('low');
    });
  });

  describe('_calculateOverallScore', () => {
    it('should calculate average of scores', () => {
      expect(riskEngine._calculateOverallScore([50, 50, 50])).toBe(50);
      expect(riskEngine._calculateOverallScore([100, 0])).toBe(50);
      expect(riskEngine._calculateOverallScore([30, 40, 50])).toBe(40);
    });

    it('should return 50 for empty array', () => {
      expect(riskEngine._calculateOverallScore([])).toBe(50);
    });
  });
});

describe('BiasDetector', () => {
  let biasDetector;

  beforeEach(() => {
    biasDetector = new BiasDetector();
  });

  describe('analyze', () => {
    it('should return bias assessment with all protected attributes', () => {
      const modelOutputs = {
        outputDistribution: { male: 60, female: 40 },
        inputDistribution: { male: 50, female: 50 }
      };

      const trainingDataStats = {
        gender: {
          inputDistribution: { male: 50, female: 50 },
          outputDistribution: { male: 60, female: 40 }
        }
      };

      const result = biasDetector.analyze(modelOutputs, trainingDataStats);

      expect(result).toHaveProperty('biasScore');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('isBiased');
      expect(Array.isArray(result.details)).toBe(true);
    });

    it('should return zero bias score when no data provided', () => {
      const result = biasDetector.analyze(null, null);
      expect(result.biasScore).toBe(0);
      expect(result.severity).toBe('low');
      expect(result.isBiased).toBe(false);
    });
  });

  describe('_calculateDisparity', () => {
    it('should calculate disparity between input and output distributions', () => {
      const inputDist = { male: 50, female: 50 };
      const outputDist = { male: 70, female: 30 };

      const disparity = biasDetector._calculateDisparity(inputDist, outputDist);
      expect(disparity).toBeGreaterThan(0);
      expect(disparity).toBeLessThanOrEqual(1);
    });

    it('should return 0 for identical distributions', () => {
      const inputDist = { male: 50, female: 50 };
      const outputDist = { male: 50, female: 50 };

      const disparity = biasDetector._calculateDisparity(inputDist, outputDist);
      expect(disparity).toBe(0);
    });
  });
});

describe('SecurityAnalyzer', () => {
  let securityAnalyzer;

  beforeEach(() => {
    securityAnalyzer = new SecurityAnalyzer();
  });

  describe('assess', () => {
    it('should return security assessment with all threat categories', () => {
      const result = securityAnalyzer.assess({}, {}, {});

      expect(result).toHaveProperty('overallRiskScore');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('threatAssessments');
      expect(result).toHaveProperty('hasCriticalVulnerabilities');
      expect(Array.isArray(result.threatAssessments)).toBe(true);
      expect(result.threatAssessments.length).toBe(5);
    });

    it('should lower risk score when adversarial training is enabled', () => {
      const resultWithTraining = securityAnalyzer.assess(
        { adversarialTraining: true },
        {},
        {}
      );

      const resultWithoutTraining = securityAnalyzer.assess(
        { adversarialTraining: false },
        {},
        {}
      );

      const advWithTraining = resultWithTraining.threatAssessments.find(t => t.threat === 'adversarial_attacks');
      const advWithoutTraining = resultWithoutTraining.threatAssessments.find(t => t.threat === 'adversarial_attacks');

      expect(advWithTraining.riskScore).toBeLessThan(advWithoutTraining.riskScore);
    });

    it('should lower risk score when differential privacy is enabled', () => {
      const resultWithPrivacy = securityAnalyzer.assess(
        { differentialPrivacy: true },
        {},
        {}
      );

      const resultWithoutPrivacy = securityAnalyzer.assess(
        { differentialPrivacy: false },
        {},
        {}
      );

      const memWithPrivacy = resultWithPrivacy.threatAssessments.find(t => t.threat === 'membership_inference');
      const memWithoutPrivacy = resultWithoutPrivacy.threatAssessments.find(t => t.threat === 'membership_inference');

      expect(memWithPrivacy.riskScore).toBeLessThan(memWithoutPrivacy.riskScore);
    });
  });
});

describe('PerformanceMetrics', () => {
  let performanceMetrics;

  beforeEach(() => {
    performanceMetrics = new PerformanceMetrics();
  });

  describe('calculate', () => {
    it('should return computed metrics with overall score', () => {
      const result = performanceMetrics.calculate({
        accuracy: 90,
        precision: 85,
        recall: 88,
        f1_score: 86,
        latency: 50,
        throughput: 1000
      });

      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('isPerformingWell');
      expect(result).toHaveProperty('needsImprovement');
    });

    it('should use defaults when metrics not provided', () => {
      const result = performanceMetrics.calculate({});

      expect(result.metrics.accuracy).toBe(85);
      expect(result.metrics.precision).toBe(80);
      expect(result.metrics.recall).toBe(78);
      expect(result.metrics.f1_score).toBe(79);
      expect(result.metrics.latency).toBe(120);
      expect(result.metrics.throughput).toBe(500);
    });

    it('should clamp metric values to 0-100 range', () => {
      const result = performanceMetrics.calculate({
        accuracy: 150,
        precision: -10
      });

      expect(result.metrics.accuracy).toBe(100);
      expect(result.metrics.precision).toBe(0);
    });

    it('should invert latency for scoring (lower latency = higher score)', () => {
      const resultLowLatency = performanceMetrics.calculate({ latency: 50 });
      const resultHighLatency = performanceMetrics.calculate({ latency: 500 });

      expect(resultLowLatency.metrics.latency).toBeLessThan(resultHighLatency.metrics.latency);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report with recommendations', () => {
      const result = performanceMetrics.generateReport({
        accuracy: 60,
        precision: 65,
        recall: 55,
        f1_score: 60,
        latency: 300,
        throughput: 200
      });

      expect(result).toHaveProperty('modelPerformance');
      expect(result).toHaveProperty('detailedMetrics');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should return positive recommendation when performance is good', () => {
      const result = performanceMetrics.generateReport({
        accuracy: 95,
        precision: 90,
        recall: 92,
        f1_score: 91,
        latency: 50,
        throughput: 1000
      });

      expect(result.recommendations.some(r => r.includes('acceptable ranges'))).toBe(true);
    });
  });
});

describe('RiskModel', () => {
  it('should create model with all fields', () => {
    const model = new RiskModel({
      modelId: 'test-1',
      modelName: 'Test Model',
      version: '1.0.0',
      riskFactors: ['bias', 'security'],
      riskScore: 75,
      severity: 'high',
      compliant: false
    });

    expect(model.modelId).toBe('test-1');
    expect(model.modelName).toBe('Test Model');
    expect(model.version).toBe('1.0.0');
    expect(model.riskFactors).toEqual(['bias', 'security']);
    expect(model.riskScore).toBe(75);
    expect(model.severity).toBe('high');
    expect(model.compliant).toBe(false);
  });

  it('should use defaults for missing fields', () => {
    const model = new RiskModel({});

    expect(model.modelId).toBe('');
    expect(model.modelName).toBe('');
    expect(model.version).toBe('1.0.0');
    expect(model.riskFactors).toEqual([]);
    expect(model.riskScore).toBe(0);
    expect(model.severity).toBe('low');
    expect(model.compliant).toBe(true);
  });

  it('should return correct JSON representation', () => {
    const model = new RiskModel({
      modelId: 'test-1',
      modelName: 'Test',
      riskScore: 50,
      severity: 'medium'
    });

    const json = model.toJSON();

    expect(json).toHaveProperty('modelId', 'test-1');
    expect(json).toHaveProperty('modelName', 'Test');
    expect(json).toHaveProperty('riskScore', 50);
    expect(json).toHaveProperty('severity', 'medium');
    expect(json).toHaveProperty('compliant', true);
  });

  it('should correctly identify risk levels', () => {
    const highRisk = new RiskModel({ severity: 'high' });
    const mediumRisk = new RiskModel({ severity: 'medium' });
    const lowRisk = new RiskModel({ severity: 'low' });

    expect(highRisk.isHighRisk()).toBe(true);
    expect(highRisk.isMediumRisk()).toBe(false);
    expect(highRisk.isLowRisk()).toBe(false);

    expect(mediumRisk.isHighRisk()).toBe(false);
    expect(mediumRisk.isMediumRisk()).toBe(true);
    expect(mediumRisk.isLowRisk()).toBe(false);

    expect(lowRisk.isHighRisk()).toBe(false);
    expect(lowRisk.isMediumRisk()).toBe(false);
    expect(lowRisk.isLowRisk()).toBe(true);
  });
});