export default class BiasDetector {
  constructor() {
    this.biasTypes = ['gender', 'racial', 'age', 'cultural', 'geographic', 'socioeconomic'];
    this.protectedAttributes = ['gender', 'race', 'age', 'disability', 'religion'];
  }

  analyze(modelOutputs, trainingDataStats) {
    const results = [];

    this.protectedAttributes.forEach((attr) => {
      const attrResults = this._analyzeAttribute(attr, modelOutputs, trainingDataStats);
      if (attrResults) results.push(attrResults);
    });

    const overallBiasScore = this._calculateOverallScore(results);
    const severity = overallBiasScore > 70 ? 'high' : overallBiasScore > 40 ? 'medium' : 'low';

    return {
      biasScore: overallBiasScore,
      severity,
      details: results,
      isBiased: overallBiasScore > 50,
    };
  }

  _analyzeAttribute(attribute, modelOutputs, trainingDataStats) {
    if (!modelOutputs || !trainingDataStats) return null;

    const { outputDistribution, inputDistribution } = trainingDataStats[attribute] || {};
    if (!outputDistribution || !inputDistribution) return null;

    const disparity = this._calculateDisparity(inputDistribution, outputDistribution);
    const score = Math.min(100, disparity * 2);

    return {
      attribute,
      biasScore: score,
      severity: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      disparity,
      description: this._getDescription(attribute, score),
    };
  }

  _calculateDisparity(inputDist, outputDist) {
    const totalInput = Object.values(inputDist).reduce((a, b) => a + b, 0);
    const totalOutput = Object.values(outputDist).reduce((a, b) => a + b, 0);

    if (totalInput === 0 || totalOutput === 0) return 0;

    const inputProportions = Object.keys(inputDist).reduce((acc, key) => {
      acc[key] = (inputDist[key] / totalInput) * 100;
      return acc;
    }, {});

    const outputProportions = Object.keys(outputDist).reduce((acc, key) => {
      acc[key] = (outputDist[key] / totalOutput) * 100;
      return acc;
    }, {});

    let maxDisparity = 0;
    const allKeys = new Set([...Object.keys(inputProportions), ...Object.keys(outputProportions)]);

    allKeys.forEach((key) => {
      const inp = inputProportions[key] || 0;
      const out = outputProportions[key] || 0;
      const disparity = Math.abs(inp - out);
      if (disparity > maxDisparity) maxDisparity = disparity;
    });

    return maxDisparity / 100;
  }

  _getDescription(attribute, score) {
    if (score > 70) {
      return `Significant ${attribute} bias detected - requires immediate attention`;
    } else if (score > 40) {
      return `Moderate ${attribute} bias detected - monitor closely`;
    }
    return `${attribute} bias within acceptable range`;
  }

  _calculateOverallScore(details) {
    if (details.length === 0) return 0;
    const total = details.reduce((sum, d) => sum + d.biasScore, 0);
    return Math.round(total / details.length);
  }
}