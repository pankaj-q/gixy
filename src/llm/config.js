/**
 * LLM Configuration
 * Central configuration for all LLM providers and engines
 */

export const LLMConfig = {
  // Default provider settings
  providers: {
    openai: {
      enabled: !!process.env.OPENAI_API_KEY,
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4-turbo-preview',
      organization: process.env.OPENAI_ORGANIZATION,
      timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
    },
    anthropic: {
      enabled: !!process.env.ANTHROPIC_API_KEY,
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-opus-20240229',
      version: process.env.ANTHROPIC_VERSION || '2023-06-01',
      timeout: parseInt(process.env.ANTHROPIC_TIMEOUT) || 60000,
      maxRetries: parseInt(process.env.ANTHROPIC_MAX_RETRIES) || 3,
    },
    gemini: {
      enabled: !!process.env.GEMINI_API_KEY,
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-1.5-flash',
      timeout: parseInt(process.env.GEMINI_TIMEOUT) || 60000,
      maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES) || 3,
    },
  },

  // Engine settings
  engines: {
    riskAnalysis: {
      enabled: true,
      defaultProvider: process.env.RISK_ANALYSIS_PROVIDER || 'openai',
      temperature: parseFloat(process.env.RISK_ANALYSIS_TEMPERATURE) || 0.3,
      maxTokens: parseInt(process.env.RISK_ANALYSIS_MAX_TOKENS) || 4096,
      timeout: parseInt(process.env.RISK_ANALYSIS_TIMEOUT) || 60000,
      maxRetries: parseInt(process.env.RISK_ANALYSIS_MAX_RETRIES) || 3,
    },
    complianceChecker: {
      enabled: true,
      defaultProvider: process.env.COMPLIANCE_CHECKER_PROVIDER || 'openai',
      temperature: parseFloat(process.env.COMPLIANCE_TEMPERATURE) || 0.2,
      maxTokens: parseInt(process.env.COMPLIANCE_MAX_TOKENS) || 4096,
      timeout: parseInt(process.env.COMPLIANCE_TIMEOUT) || 60000,
      maxRetries: parseInt(process.env.COMPLIANCE_MAX_RETRIES) || 3,
    },
    modelCardGenerator: {
      enabled: true,
      defaultProvider: process.env.MODEL_CARD_PROVIDER || 'openai',
      temperature: parseFloat(process.env.MODEL_CARD_TEMPERATURE) || 0.4,
      maxTokens: parseInt(process.env.MODEL_CARD_MAX_TOKENS) || 6000,
      timeout: parseInt(process.env.MODEL_CARD_TIMEOUT) || 60000,
      maxRetries: parseInt(process.env.MODEL_CARD_MAX_RETRIES) || 3,
    },
  },

  // Global settings
  global: {
    defaultProvider: process.env.LLM_DEFAULT_PROVIDER || 'openai',
    fallbackProvider: process.env.LLM_FALLBACK_PROVIDER || 'anthropic',
    requestTimeout: parseInt(process.env.LLM_REQUEST_TIMEOUT) || 60000,
    maxConcurrentRequests: parseInt(process.env.LLM_MAX_CONCURRENT) || 5,
    enableCache: process.env.LLM_ENABLE_CACHE === 'true',
    cacheTTL: parseInt(process.env.LLM_CACHE_TTL) || 3600000,
    logLevel: process.env.LLM_LOG_LEVEL || 'info',
  },

  // Supported frameworks for compliance
  complianceFrameworks: [
    'eu_ai_act',
    'nist_ai_rmf',
    'iso_42001',
    'gdpr',
    'ccpa',
    'hipaa',
    'sox',
    'algorithmic_accountability',
    'canada_cpp',
    'uk_ai_regulation',
    'oecd_ai_principles',
    'ieee_ethically_aligned',
  ],

  // Risk categories for analysis
  riskCategories: [
    'bias_fairness',
    'privacy_data_protection',
    'security_robustness',
    'transparency_explainability',
    'accountability_governance',
    'safety_harm_prevention',
    'environmental_impact',
    'societal_impact',
    'legal_regulatory_compliance',
    'operational_reliability',
  ],

  // Model card sections
  modelCardSections: [
    'model_details',
    'intended_use',
    'factors',
    'metrics',
    'evaluation_data',
    'training_data',
    'quantitative_analysis',
    'ethical_considerations',
    'caveats_recommendations',
    'model_card_authors',
    'model_card_contact',
    'version_history',
    'references',
  ],
};

/**
 * Validate configuration
 * @returns {Object} Validation result
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];

  // Check if at least one provider is configured
  const hasOpenAI = LLMConfig.providers.openai.enabled;
  const hasAnthropic = LLMConfig.providers.anthropic.enabled;
  const hasGemini = LLMConfig.providers.gemini.enabled;

  if (!hasOpenAI && !hasAnthropic && !hasGemini) {
    errors.push('No LLM provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY');
  }

  // Check engine configurations
  for (const [engineName, engineConfig] of Object.entries(LLMConfig.engines)) {
    if (engineConfig.enabled) {
      const provider = LLMConfig.providers[engineConfig.defaultProvider];
      if (!provider || !provider.enabled) {
        errors.push(`${engineName}: Default provider '${engineConfig.defaultProvider}' is not configured`);
      }
    }
  }

  // Warnings for missing optional configurations
  if (!hasOpenAI) {
    warnings.push('OpenAI not configured - some features may be limited');
  }
  if (!hasAnthropic) {
    warnings.push('Anthropic not configured - no fallback provider available');
  }
  if (!hasGemini) {
    warnings.push('Gemini not configured - consider adding for free tier access');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get provider configuration
 * @param {string} providerName - Provider name
 * @returns {Object|null} Provider config or null
 */
export function getProviderConfig(providerName) {
  return LLMConfig.providers[providerName.toLowerCase()] || null;
}

/**
 * Get engine configuration
 * @param {string} engineName - Engine name
 * @returns {Object|null} Engine config or null
 */
export function getEngineConfig(engineName) {
  return LLMConfig.engines[engineName] || null;
}

export default LLMConfig;