export default class PerformanceMetrics {
  constructor() {
    this.requiredMetrics = ['accuracy', 'precision', 'recall', 'f1_score', 'latency', 'throughput'];
  }

  calculate(metricsData) {
    const computed = {};

    this.requiredMetrics.forEach((metric) => {
      computed[metric] = this._computeMetric(metric, metricsData);
    });

    const overallScore = this._calculateOverallPerformanceScore(computed);
    const severity = overallScore > 70 ? 'high' : overallScore > 40 ? 'medium' : 'low';

    return {
      metrics: computed,
      overallScore,
      severity,
      isPerformingWell: overallScore > 70,
      needsImprovement: overallScore < 70,
    };
  }

  _computeMetric(metric, data) {
    const dataset = data.dataset || 'test';
    const provided = data[metric];

    if (provided !== undefined && provided !== null) {
      return Math.max(0, Math.min(100, provided));
    }

    const defaults = {
      accuracy: 85,
      precision: 80,
      recall: 78,
      f1_score: 79,
      latency: 120,
      throughput: 500,
    };

    return defaults[metric] || 50;
  }

  _calculateOverallPerformanceScore(metrics) {
    const weight = {
      accuracy: 0.25,
      precision: 0.2,
      recall: 0.2,
      f1_score: 0.15,
      latency: 0.1,
      throughput: 0.1,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(weight).forEach(([metric, w]) => {
      const score = metrics[metric];
      // Invert latency/throughput (lower latency = higher score)
      if (metric === 'latency') {
        const inverted = Math.max(0, 100 - score);
        weightedSum += inverted * w;
      } else if (metric === 'throughput') {
        const inverted = Math.max(0, Math.min(100, score));
        weightedSum += inverted * w;
      } else {
        weightedSum += score * w;
      }
      totalWeight += w;
    });

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  generateReport(metricsData) {
    const result = this.calculate(metricsData);

    const report = {
      modelPerformance: {
        overallScore: result.overallScore,
        severity: result.severity,
        isPerformingWell: result.isPerformingWell,
      },
      detailedMetrics: {},
      recommendations: this._generateRecommendations(result),
    };

    Object.entries(result.metrics).forEach(([key, value]) => {
      report.detailedMetrics[key] = {
        score: value,
        severity: value > 70 ? 'good' : value > 40 ? 'fair' : 'poor',
      };
    });

    return report;
  }

  _generateRecommendations(result) {
    const recommendations = [];

    if (result.overallScore < 70) {
      recommendations.push('Overall performance below target - review model architecture and training data');
    }

    const metrics = result.metrics;
    if (metrics.recall < 70) {
      recommendations.push('Low recall - consider class imbalance or threshold adjustment');
    }
    if (metrics.precision < 70) {
      recommendations.push('Low precision - review false positives and decision boundary');
    }
    if (metrics.latency > 200) {
      recommendations.push('High latency - optimize model inference or hardware acceleration');
    }
    if (metrics.throughput < 70) {
      recommendations.push('Low throughput - batch processing or model optimization needed');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable ranges - continue monitoring');
    }

    return recommendations;
  }
}