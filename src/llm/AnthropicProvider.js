import { LLMProvider } from './LLMProvider.js';

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.defaultModel = config.defaultModel || 'claude-3-opus-20240229';
    this.version = config.version || '2023-06-01';
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return 'anthropic';
  }

  /**
   * Get available models
   * @returns {Array<string>} List of available models
   */
  getAvailableModels() {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2',
    ];
  }

  /**
   * Validate configuration
   * @returns {boolean} True if config is valid
   */
  validateConfig() {
    return !!this.apiKey;
  }

  /**
   * Generate completion using Anthropic API
   * @param {Object} params - Completion parameters
   * @returns {Promise<Object>} Completion response
   */
  async generateCompletion(params) {
    const {
      model = this.defaultModel,
      messages,
      maxTokens = 4096,
      temperature = 0.7,
      systemPrompt,
      ...restParams
    } = params;

    if (!messages || messages.length === 0) {
      throw new Error('Messages are required for completion');
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));

    // Extract system prompt if present
    const systemMessage = messages.find(m => m.role === 'system');
    const finalSystemPrompt = systemPrompt || (systemMessage ? systemMessage.content : null);

    const requestBody = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: anthropicMessages.filter(m => m.role !== 'system'),
      ...restParams,
    };

    if (finalSystemPrompt) {
      requestBody.system = finalSystemPrompt;
    }

    const response = await this.makeRequest('/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.version,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      content: data.content[0]?.text || '',
      model: data.model,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      finishReason: data.stop_reason,
      rawResponse: data,
    };
  }

  /**
   * Generate streaming completion
   * @param {Object} params - Completion parameters
   * @returns {AsyncGenerator<Object>} Stream of completion chunks
   */
  async *generateStreamingCompletion(params) {
    const {
      model = this.defaultModel,
      messages,
      maxTokens = 4096,
      temperature = 0.7,
      systemPrompt,
      ...restParams
    } = params;

    if (!messages || messages.length === 0) {
      throw new Error('Messages are required for completion');
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content,
    }));

    const systemMessage = messages.find(m => m.role === 'system');
    const finalSystemPrompt = systemPrompt || (systemMessage ? systemMessage.content : null);

    const requestBody = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: anthropicMessages.filter(m => m.role !== 'system'),
      stream: true,
      ...restParams,
    };

    if (finalSystemPrompt) {
      requestBody.system = finalSystemPrompt;
    }

    const response = await this.makeRequest('/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.version,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield {
                  content: parsed.delta.text,
                  done: false,
                };
              } else if (parsed.type === 'message_stop') {
                yield {
                  content: '',
                  done: true,
                  usage: {
                    promptTokens: parsed.usage?.input_tokens || 0,
                    completionTokens: parsed.usage?.output_tokens || 0,
                    totalTokens: (parsed.usage?.input_tokens || 0) + (parsed.usage?.output_tokens || 0),
                  },
                };
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Estimate token count for a prompt
   * @param {string} text - Text to estimate tokens for
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost for a completion
   * @param {Object} usage - Token usage
   * @param {string} model - Model used
   * @returns {number} Estimated cost in USD
   */
  calculateCost(usage, model = this.defaultModel) {
    // Approximate pricing (as of 2024) per 1K tokens
    const pricing = {
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      'claude-2.1': { input: 0.008, output: 0.024 },
      'claude-2.0': { input: 0.008, output: 0.024 },
      'claude-instant-1.2': { input: 0.0008, output: 0.0024 },
    };

    const modelPricing = pricing[model] || pricing['claude-3-sonnet-20240229'];
    const inputCost = (usage.promptTokens / 1000) * modelPricing.input;
    const outputCost = (usage.completionTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }
}

export default AnthropicProvider;