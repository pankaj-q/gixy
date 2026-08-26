export default class SecurityAnalyzer {
  constructor() {
    this.threatCategories = ['data_poisoning', 'adversarial_attacks', 'model_extraction', 'membership_inference', 'privacy_violation'];
  }

  assess(modelConfig, trainingData, validationData) {
    const results = this.threatCategories.map((threat) => this._assessThreat(threat, modelConfig, trainingData, validationData));

    const overallRiskScore = this._calculateOverallRisk(results);
    const severity = overallRiskScore > 70 ? 'high' : overallRiskScore > 40 ? 'medium' : 'low';

    return {
      overallRiskScore,
      severity,
      threatAssessments: results,
      hasCriticalVulnerabilities: overallRiskScore > 70,
    };
  }

  _assessThreat(threat, modelConfig, trainingData, validationData) {
    switch (threat) {
      case 'data_poisoning':
        return this._assessDataPoisoning(trainingData, modelConfig);
      case 'adversarial_attacks':
        return this._assessAdversarialAttacks(modelConfig);
      case 'model_extraction':
        return this._assessModelExtraction(modelConfig);
      case 'membership_inference':
        return this._assessMembershipInference(validationData, modelConfig);
      case 'privacy_violation':
        return this._assessPrivacyViolation(trainingData, modelConfig);
      default:
        return this._baselineAssessment(threat);
    }
  }

  _assessDataPoisoning(trainingData, modelConfig) {
    const dataQuality = this._assessDataQuality(trainingData);
    const configRisk = modelConfig.dataSanitization ? 20 : 50;
    const score = Math.min(100, configRisk + (100 - dataQuality));
    return { threat: 'data_poisoning', riskScore: score, severity: score > 70 ? 'high' : score > 40 ? 'medium' : 'low' };
  }

  _assessAdversarialAttacks(modelConfig) {
    const hasAdversarialTraining = modelConfig.adversarialTraining || false;
    const score = hasAdversarialTraining ? 15 : 65;
    return { threat: 'adversarial_attacks', riskScore: score, severity: score > 70 ? 'high' : score > 40 ? 'medium' : 'low' };
  }

  _assessModelExtraction(modelConfig) {
    const modelAccess = modelConfig.apiRateLimits ? 20 : 80;
    return { threat: 'model_extraction', riskScore: modelAccess, severity: modelAccess > 70 ? 'high' : modelAccess > 40 ? 'medium' : 'low' };
  }

  _assessMembershipInference(validationData, modelConfig) {
    const hasPrivacyGuarantees = modelConfig.differentialPrivacy ? true : false;
    const score = hasPrivacyGuarantees ? 25 : 75;
    return { threat: 'membership_inference', riskScore: score, severity: score > 70 ? 'high' : score > 40 ? 'medium' : 'low' };
  }

  _assessPrivacyViolation(trainingData, modelConfig) {
    const dataSensitivity = trainingData.sensitivityLabel ? trainingData.sensitivityLabel : 'medium';
    const sensitivityScores = { low: 15, medium: 50, high: 80, critical: 95 };
    const baseScore = sensitivityScores[dataSensitivity] || 50;
    const configMitigation = modelConfig.privacyBudget ? 20 : 0;
    const score = Math.min(100, baseScore + configMitigation);
    return { threat: 'privacy_violation', riskScore: score, severity: score > 70 ? 'high' : score > 40 ? 'medium' : 'low' };
  }

  _baselineAssessment(threat) {
    const baselineScores = {
      data_poisoning: 50,
      adversarial_attacks: 60,
      model_extraction: 70,
      membership_inference: 65,
      privacy_violation: 55,
    };
    const score = (baselineScores[threat] || 50);
    return { threat, riskScore: score, severity: score > 70 ? 'high' : score > 40 ? 'medium' : 'low' };
  }

  _calculateOverallRisk(threatAssessments) {
    const totalScore = threatAssessments.reduce((sum, t) => sum + t.riskScore, 0);
    return Math.round(totalScore / threatAssessments.length);
  }
}