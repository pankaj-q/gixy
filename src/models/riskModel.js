export default class RiskModel {
  constructor(data = {}) {
    this.modelId = data.modelId || '';
    this.modelName = data.modelName || '';
    this.version = data.version || '1.0.0';
    this.riskFactors = data.riskFactors || [];
    this.metadata = data.metadata || {};
    this.riskScore = data.riskScore || 0;
    this.severity = data.severity || 'low';
    this.assessmentDate = data.assessmentDate || new Date();
    this.compliant = data.compliant !== undefined ? data.compliant : true;
  }

  toJSON() {
    return {
      modelId: this.modelId,
      modelName: this.modelName,
      version: this.version,
      riskFactors: this.riskFactors,
      metadata: this.metadata,
      riskScore: this.riskScore,
      severity: this.severity,
      assessmentDate: this.assessmentDate,
      compliant: this.compliant,
    };
  }

  isHighRisk() {
    return this.severity === 'high';
  }

  isMediumRisk() {
    return this.severity === 'medium';
  }

  isLowRisk() {
    return this.severity === 'low';
  }
}