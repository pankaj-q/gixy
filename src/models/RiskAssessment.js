import mongoose from 'mongoose';

const riskAssessmentSchema = new mongoose.Schema({
  modelId: {
    type: String,
    required: true,
    index: true,
    maxlength: 100
  },
  modelName: {
    type: String,
    required: true,
    maxlength: 200
  },
  version: {
    type: String,
    default: '1.0.0',
    match: /^\d+\.\d+\.\d+$/
  },
  riskFactors: [{
    type: String,
    enum: ['bias', 'fairness', 'security', 'vulnerability', 'performance', 'compliance', 'safety', 'privacy']
  }],
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high']
  },
  compliant: {
    type: Boolean,
    default: true
  },
  metadata: {
    biasAssessment: mongoose.Schema.Types.Mixed,
    securityAssessment: mongoose.Schema.Types.Mixed,
    performanceAssessment: mongoose.Schema.Types.Mixed,
    assessmentTimestamp: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
      // Not required for test compatibility
    }
  },
  trainingData: mongoose.Schema.Types.Mixed,
  modelConfig: mongoose.Schema.Types.Mixed,
  metrics: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for common queries
riskAssessmentSchema.index({ modelId: 1, createdAt: -1 });
riskAssessmentSchema.index({ severity: 1 });
riskAssessmentSchema.index({ compliant: 1 });
riskAssessmentSchema.index({ createdAt: -1 });

// Virtual for assessment age
riskAssessmentSchema.virtual('ageDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

riskAssessmentSchema.set('toJSON', { virtuals: true });
riskAssessmentSchema.set('toObject', { virtuals: true });

export const RiskAssessment = mongoose.model('RiskAssessment', riskAssessmentSchema);
export default RiskAssessment;