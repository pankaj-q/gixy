/**
 * LLM Module - Main entry point
 * Exports all LLM providers, engines, and utilities
 */

// Providers
import { LLMProvider } from './LLMProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { LLMProviderFactory, defaultFactory, initializeDefaultProviders } from './LLMProviderFactory.js';

export { LLMProvider, OpenAIProvider, AnthropicProvider, GeminiProvider, LLMProviderFactory, defaultFactory, initializeDefaultProviders };

// Engines
import { RiskAnalysisEngine } from './RiskAnalysisEngine.js';
import { ComplianceChecker } from './ComplianceChecker.js';
import { ModelCardGenerator } from './ModelCardGenerator.js';

export { RiskAnalysisEngine, ComplianceChecker, ModelCardGenerator };

// Configuration
import { LLMConfig, validateConfig, getProviderConfig, getEngineConfig } from './config.js';

export { LLMConfig, validateConfig, getProviderConfig, getEngineConfig };

/**
 * Create a fully configured LLM system
 * @param {Object} customConfig - Optional custom configuration
 * @returns {Object} Configured LLM system
 */
export function createLLMSystem(customConfig = {}) {
  // Merge configurations
  const config = {
    providers: { ...LLMConfig.providers, ...customConfig.providers },
    engines: { ...LLMConfig.engines, ...customConfig.engines },
    global: { ...LLMConfig.global, ...customConfig.global },
  };

  // Validate
  const validation = validateConfig();
  if (!validation.valid && !customConfig.skipValidation) {
    throw new Error(`LLM Configuration invalid: ${validation.errors.join(', ')}`);
  }

  // Create factory with providers
  const factory = new LLMProviderFactory();

  // Register OpenAI provider
  if (config.providers.openai.enabled) {
    factory.registerProvider('openai', new OpenAIProvider(config.providers.openai), 
      config.global.defaultProvider === 'openai');
  }

  // Register Anthropic provider
  if (config.providers.anthropic.enabled) {
    factory.registerProvider('anthropic', new AnthropicProvider(config.providers.anthropic), 
      config.global.defaultProvider === 'anthropic');
  }

  // Register Gemini provider
  if (config.providers.gemini.enabled) {
    factory.registerProvider('gemini', new GeminiProvider(config.providers.gemini), 
      config.global.defaultProvider === 'gemini');
  }

  // Create engines
  const engines = {};

  if (config.engines.riskAnalysis.enabled) {
    engines.riskAnalysis = new RiskAnalysisEngine({
      factory,
      defaultProvider: factory.getProvider(config.engines.riskAnalysis.defaultProvider),
      maxRetries: config.engines.riskAnalysis.maxRetries,
      timeout: config.engines.riskAnalysis.timeout,
    });
  }

  if (config.engines.complianceChecker.enabled) {
    engines.complianceChecker = new ComplianceChecker({
      factory,
      defaultProvider: factory.getProvider(config.engines.complianceChecker.defaultProvider),
      maxRetries: config.engines.complianceChecker.maxRetries,
      timeout: config.engines.complianceChecker.timeout,
    });
  }

  if (config.engines.modelCardGenerator.enabled) {
    engines.modelCardGenerator = new ModelCardGenerator({
      factory,
      defaultProvider: factory.getProvider(config.engines.modelCardGenerator.defaultProvider),
      maxRetries: config.engines.modelCardGenerator.maxRetries,
      timeout: config.engines.modelCardGenerator.timeout,
    });
  }

  return {
    factory,
    engines,
    config,
    validation,
  };
}

/**
 * Quick risk analysis using default configuration
 * @param {Object} modelInfo - Model information
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Risk analysis result
 */
export async function quickRiskAnalysis(modelInfo, options = {}) {
  const system = createLLMSystem({ skipValidation: true });
  if (!system.engines.riskAnalysis) {
    throw new Error('Risk analysis engine not configured');
  }
  return system.engines.riskAnalysis.analyzeModel(modelInfo, options);
}

/**
 * Quick compliance check using default configuration
 * @param {Object} modelInfo - Model information
 * @param {string} framework - Regulatory framework
 * @param {Object} options - Check options
 * @returns {Promise<Object>} Compliance check result
 */
export async function quickComplianceCheck(modelInfo, framework, options = {}) {
  const system = createLLMSystem({ skipValidation: true });
  if (!system.engines.complianceChecker) {
    throw new Error('Compliance checker engine not configured');
  }
  return system.engines.complianceChecker.checkCompliance(modelInfo, framework, options);
}

/**
 * Quick model card generation using default configuration
 * @param {Object} modelInfo - Model information
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated model card
 */
export async function quickModelCard(modelInfo, options = {}) {
  const system = createLLMSystem({ skipValidation: true });
  if (!system.engines.modelCardGenerator) {
    throw new Error('Model card generator engine not configured');
  }
  return system.engines.modelCardGenerator.generateModelCard(modelInfo, options);
}

export default {
  // Providers
  LLMProvider,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  LLMProviderFactory,
  defaultFactory,
  initializeDefaultProviders,
  
  // Engines
  RiskAnalysisEngine,
  ComplianceChecker,
  ModelCardGenerator,
  
  // Configuration
  LLMConfig,
  validateConfig,
  getProviderConfig,
  getEngineConfig,
  
  // Utilities
  createLLMSystem,
  quickRiskAnalysis,
  quickComplianceCheck,
  quickModelCard,
};