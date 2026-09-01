import { LLMProvider } from './LLMProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';

/**
 * LLM Provider Factory - Creates and manages LLM provider instances
 */
export class LLMProviderFactory {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  /**
   * Register a provider
   * @param {string} name - Provider name
   * @param {LLMProvider} provider - Provider instance
   * @param {boolean} isDefault - Whether this is the default provider
   */
  registerProvider(name, provider, isDefault = false) {
    if (!(provider instanceof LLMProvider)) {
      throw new Error('Provider must be an instance of LLMProvider');
    }
    this.providers.set(name.toLowerCase(), provider);
    if (isDefault || !this.defaultProvider) {
      this.defaultProvider = name.toLowerCase();
    }
  }

  /**
   * Get a provider by name
   * @param {string} name - Provider name
   * @returns {LLMProvider|null} Provider instance or null
   */
  getProvider(name) {
    return this.providers.get(name.toLowerCase()) || null;
  }

  /**
   * Get the default provider
   * @returns {LLMProvider|null} Default provider instance
   */
  getDefaultProvider() {
    if (!this.defaultProvider) {
      return null;
    }
    return this.providers.get(this.defaultProvider);
  }

  /**
   * Set default provider
   * @param {string} name - Provider name
   */
  setDefaultProvider(name) {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`Provider ${name} not registered`);
    }
    this.defaultProvider = name.toLowerCase();
  }

  /**
   * Get all registered providers
   * @returns {Array<{name: string, provider: LLMProvider}>} List of providers
   */
  getAllProviders() {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      provider,
    }));
  }

  /**
   * Create provider from configuration
   * @param {Object} config - Provider configuration
   * @returns {LLMProvider} Provider instance
   */
  static createFromConfig(config) {
    const { type, ...providerConfig } = config;

    switch (type.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(providerConfig);
      case 'anthropic':
        return new AnthropicProvider(providerConfig);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Initialize providers from configuration object
   * @param {Object} config - Configuration object with providers
   * @returns {LLMProviderFactory} Factory instance
   */
  static initializeFromConfig(config) {
    const factory = new LLMProviderFactory();

    if (config.providers) {
      for (const [name, providerConfig] of Object.entries(config.providers)) {
        const provider = LLMProviderFactory.createFromConfig({
          type: providerConfig.type,
          ...providerConfig.config,
        });
        factory.registerProvider(name, provider, providerConfig.isDefault);
      }
    }

    return factory;
  }
}

/**
 * Default factory instance
 */
export const defaultFactory = new LLMProviderFactory();

/**
 * Initialize default providers from environment
 */
export function initializeDefaultProviders() {
  // Register OpenAI if API key is available
  if (process.env.OPENAI_API_KEY) {
    defaultFactory.registerProvider('openai', new OpenAIProvider(), true);
  }

  // Register Anthropic if API key is available
  if (process.env.ANTHROPIC_API_KEY) {
    const isDefault = !process.env.OPENAI_API_KEY;
    defaultFactory.registerProvider('anthropic', new AnthropicProvider(), isDefault);
  }

  return defaultFactory;
}

export default LLMProviderFactory;