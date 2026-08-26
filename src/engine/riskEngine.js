import RiskModel from '../models/riskModel.js';
import BiasDetector from './biasDetector.js';
import SecurityAnalyzer from './securityAnalyzer.js';
import PerformanceMetrics from './performanceMetrics.js';

const biasDetector = new BiasDetector();
const securityAnalyzer = new SecurityAnalyzer();
const performanceMetrics = new PerformanceMetrics();

/**
 * Main risk assessment engine
 * Takes model data and returns comprehensive risk assessment
 */
export default class RiskEngine {
  constructor() {
    this.riskCategories = ['bias', 'security', 'performance', 'compliance', 'safety'];
    this.categoryWeights = {
      bias: 0.25,
      security: 0.3,
      performance: 0.2,
      compliance: 0.15,
      safety: 0.1,
    };
  }

  /**
   * Full risk assessment for an AI model
   * @param {Object} options - Assessment options
   * @param {String} options.modelId - Model identifier
   * @param {String} options.modelName - Model name
   * @param {Object} options.riskFactors - Pre-identified risk factors
   * @param {Object} options.trainingData - Training dataset statistics
   * @param {Object} options.modelConfig - Model configuration
   * @param {Object} options.metrics - Performance metrics
   * @returns {RiskModel} - Comprehensive risk assessment
   */
  assessFullRisk(options = {}) {
    const {
      modelId,
      modelName,
      riskFactors = [],
      trainingData,
      modelConfig,
      metrics,
    } = options;

    // 1. Bias Assessment
    const biasResult = trainingData
      ? biasDetector.analyze(
          this._getModelOutputs(modelConfig),
          trainingData.stats
        )
      : this._baselineBiasAssessment(riskFactors);

    // 2. Security Assessment
    const securityResult = modelConfig
      ? securityAnalyzer.assess(modelConfig, trainingData, null)
      : this._baselineSecurityAssessment(riskFactors);

    // 3. Performance Assessment
    const performanceResult = metrics
      ? performanceMetrics.calculate(metrics)
      : this._baselinePerformanceAssessment();

    // 4. Calculate overall risk score
    const overallScore = this._calculateOverallScore([
      biasResult.biasScore,
      securityResult.overallRiskScore,
      performanceResult.overallScore,
    ]);

    // 5. Determine severity
    const severity = this._getSeverity(overallScore);

    // 6. Identify high-priority risk factors
    const primaryRiskFactors = this._identifyPrimaryRiskFactors([
      biasResult,
      securityResult,
      performanceResult,
    ]);

    // 7. Create risk model
    const riskModel = new RiskModel({
      modelId: modelId || 'unknown',
      modelName: modelName || 'Unnamed Model',
      riskFactors: [...riskFactors, ...primaryRiskFactors],
      riskScore: overallScore,
      severity,
      metadata: {
        biasAssessment: biasResult,
        securityAssessment: securityResult,
        performanceAssessment: performanceResult,
        assessmentTimestamp: new Date().toISOString(),
      },
      compliant: overallScore < 70,
    });

    return riskModel;
  }

  _getModelOutputs(modelConfig) {
    if (!modelConfig) return {};
    return {
      outputDistribution: modelConfig.outputDistribution || {},
      inputDistribution: modelConfig.inputDistribution || {},
    };
  }

  _baselineBiasAssessment(riskFactors) {
    const hasBiasFactor = riskFactors.includes('bias') || riskFactors.includes('fairness');
    const score = hasBiasFactor ? 65 : 25;
    const severity = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';
    return { biasScore: score, severity, details: [] };
  }

  _baselineSecurityAssessment(riskFactors) {
    const hasSecurityFactor = riskFactors.includes('security') || riskFactors.includes('vulnerability');
    const score = hasSecurityFactor ? 75 : 30;
    const severity = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';
    return { overallRiskScore: score, severity, threatAssessments: [] };
  }

  _baselinePerformanceAssessment() {
    return {
      overallScore: 65,
      severity: 'medium',
      metrics: {
        accuracy: 85,
        precision: 80,
        recall: 78,
        f1_score: 79,
        latency: 120,
        throughput: 500,
      },
    };
  }

  _calculateOverallScore(scores) {
    if (scores.length === 0) return 50;
    const total = scores.reduce((sum, s) => sum + s, 0);
    return Math.round(total / scores.length);
  }

  _getSeverity(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  _identifyPrimaryRiskFactors(assessments) {
    const factors = [];

    // From bias assessment
    if (assessments[0].biasScore > 50) {
      factors.push('bias');
    }

    // From security assessment
    if (assessments[1].overallRiskScore > 50) {
      factors.push('security');
    }

    // From performance assessment
    if (assessments[2].overallScore < 70) {
      factors.push('performance');
    }

    return factors;
  }

  /**
   * Quick risk check for a model
   * @param {Object} modelData - Model data
   * @returns {Object} - Quick risk summary
   */
  quickRiskCheck(modelData) {
    const model = new RiskModel(modelData);

    const biasScore = model.riskFactors.includes('bias') ? 65 : 20;
    const securityScore = model.riskFactors.includes('security') ? 70 : 25;
    const performanceScore = 60;

    const overall = Math.round((biasScore + securityScore + performanceScore) / 3);
    const severity = overall > 70 ? 'high' : overall > 40 ? 'medium' : 'low';

    return {
      modelId: model.modelId,
      modelName: model.modelName,
      riskScore: overall,
      severity,
      riskFactors: model.riskFactors,
      compliant: overall < 70,
    };
  }
}