# Fix quickCheckSchema Validation

## Problem
The `/api/public/risk/quick-check` endpoint uses `quickCheckSchema` which only allows 3 fields: `modelId`, `modelName`, `riskFactors`. But the dashboard sends a much richer payload with `modelConfig`, `deploymentContext`, `metrics`, and `useLLM`.

## Solution
Update `quickCheckSchema` in `/src/validation/schemas.js` to accept all fields the dashboard sends.

## Files to Change
- `src/validation/schemas.js` - Update quickCheckSchema

## Implementation Steps
- [ ] Update quickCheckSchema to include modelConfig, deploymentContext, metrics fields
- [ ] Test the fix locally
- [ ] Deploy to Render