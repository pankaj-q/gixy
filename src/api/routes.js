import { Router } from 'express';
import RiskEngine from '../engine/riskEngine.js';
import RiskModel from '../models/riskModel.js';

const router = Router();
const riskEngine = new RiskEngine();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Risk assessment endpoint
router.post('/risk/assess', asyncHandler(async (req, res) => {
  const { modelId, modelName, riskFactors, trainingData, modelConfig, metrics } = req.body;

  const riskModel = riskEngine.assessFullRisk({
    modelId,
    modelName,
    riskFactors,
    trainingData,
    modelConfig,
    metrics,
  });

  res.json({
    success: true,
    data: riskModel.toJSON(),
    message: 'Risk assessment completed',
  });
}));

// Model registry endpoint
router.get('/models', asyncHandler(async (req, res) => {
  const { modelId } = req.query;
  const model = new RiskModel({ modelId, modelName: 'Sample Model' });

  res.json({
    success: true,
    data: model.toJSON(),
    message: modelId ? 'Model retrieved' : 'Model list retrieved',
  });
}));

// Quick risk check endpoint
router.post('/risk/quick-check', asyncHandler(async (req, res) => {
  const { modelId, modelName, riskFactors } = req.body;

  const quickCheck = riskEngine.quickRiskCheck({
    modelId,
    modelName,
    riskFactors,
  });

  res.json({
    success: true,
    data: quickCheck,
    message: 'Quick risk check completed',
  });
}));

// Compliance check endpoint
router.post('/compliance/check', asyncHandler(async (req, res) => {
  const { modelId, framework = 'eu-ai-act' } = req.body;

  // Basic compliance validation based on risk score
  const riskAssessment = riskEngine.quickRiskCheck({
    modelId,
    modelName: `model-${modelId}`,
    riskFactors: [],
  });

  const compliant = riskAssessment.riskScore < 70;

  res.json({
    success: true,
    data: {
      modelId,
      framework,
      compliant,
      violations: compliant ? [] : ['Risk score exceeds threshold of 70'],
    },
    message: compliant ? 'Model compliant with framework' : 'Model does not comply with framework',
  });
}));

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default router;