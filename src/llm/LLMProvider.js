/**
 * Base LLM Provider Interface
 * All LLM providers must implement this interface
 */
export class LLMProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return this.name;
  }

  /**
   * Get available models
   * @returns {Array<string>} List of available models
   */
  getAvailableModels() {
    return [];
  }

  /**
   * Validate configuration
   * @returns {boolean} True if config is valid
   */
  validateConfig() {
    return false;
  }

  /**
   * Initialize the provider (e.g., set up API clients)
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Generate a completion from the LLM
   * @param {Object} options - Completion options
   * @param {string} options.prompt - The prompt to send
   * @param {string} [options.systemPrompt] - Optional system prompt
   * @param {number} [options.maxTokens] - Maximum tokens in response
   * @param {number} [options.temperature] - Sampling temperature (0-2)
   * @param {Object} [options.responseFormat] - Response format (e.g., { type: 'json_object' })
   * @returns {Promise<Object>} - The generated completion with content, usage, model, finishReason
   */
  async generateCompletion({ prompt, systemPrompt, maxTokens, temperature, responseFormat, messages }) {
    throw new Error('generateCompletion() must be implemented by subclass');
  }

  /**
   * Generate a completion from the LLM (legacy method)
   * @param {Object} options - Completion options
   * @returns {Promise<string>} - The generated completion
   */
  async complete({ prompt, systemPrompt, maxTokens, temperature, responseFormat }) {
    const result = await this.generateCompletion({ prompt, systemPrompt, maxTokens, temperature, responseFormat });
    return result.content;
  }

  /**
   * Generate embeddings for text
   * @param {string|string[]} input - Text or array of texts to embed
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async embed(input) {
    throw new Error('embed() must be implemented by subclass');
  }

  /**
   * Get available models for this provider
   * @returns {Promise<string[]>} - List of model names
   */
  async listModels() {
    throw new Error('listModels() must be implemented by subclass');
  }

  /**
   * Check if provider is available/configured
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return false;
  }

  /**
   * Estimate token count for a prompt
   * @param {string} text - Text to count tokens for
   * @returns {number} - Estimated token count
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost for a completion
   * @param {Object} usage - Token usage
   * @param {string} model - Model used
   * @returns {number} Estimated cost in USD
   */
  calculateCost(usage, model) {
    return 0;
  }
}

/**
 * Provider factory for creating LLM provider instances
 */
export class LLMProviderFactory {
  static providers = new Map();

  /**
   * Register a provider class
   * @param {string} name - Provider name
   * @param {class} ProviderClass - Provider class extending LLMProvider
   */
  static register(name, ProviderClass) {
    this.providers.set(name.toLowerCase(), ProviderClass);
  }

  /**
   * Create a provider instance
   * @param {string} name - Provider name
   * @param {Object} config - Provider configuration
   * @returns {LLMProvider} - Provider instance
   */
  static create(name, config = {}) {
    const ProviderClass = this.providers.get(name.toLowerCase());
    if (!ProviderClass) {
      throw new Error(`Unknown LLM provider: ${name}. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return new ProviderClass(config);
  }

  /**
   * Get list of registered providers
   * @returns {string[]}
   */
  static getRegisteredProviders() {
    return Array.from(this.providers.keys());
  }
}

export default LLMProvider;