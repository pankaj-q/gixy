import OpenAI from 'openai';
import { LLMProvider } from './LLMProvider.js';

/**
 * OpenAI Provider Implementation
 * Supports GPT-4, GPT-3.5-turbo, and other OpenAI models
 */
export class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'openai';
    this.client = null;
    this.defaultModel = config.model || 'gpt-4-turbo-preview';
    this.embeddingModel = config.embeddingModel || 'text-embedding-3-small';
  }

  getAvailableModels() {
    return [
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-4-32k',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
    ];
  }

  validateConfig() {
    return !!this.config.apiKey || !!process.env.OPENAI_API_KEY;
  }

  async initialize() {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass in config.');
    }

    this.client = new OpenAI({
      apiKey,
      organization: this.config.organization || process.env.OPENAI_ORG_ID,
      baseURL: this.config.baseURL || process.env.OPENAI_BASE_URL,
      timeout: this.config.timeout || 60000,
      maxRetries: this.config.maxRetries || 3,
    });

    // Test connection
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      throw new Error(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }

  async generateCompletion({ prompt, systemPrompt, maxTokens, temperature, responseFormat, messages }) {
    if (!this.client) {
      await this.initialize();
    }

    const msgs = messages || [];
    
    if (systemPrompt && !messages) {
      msgs.push({ role: 'system', content: systemPrompt });
    }
    
    if (prompt && !messages) {
      msgs.push({ role: 'user', content: prompt });
    }

    const requestOptions = {
      model: this.defaultModel,
      messages: msgs,
      max_tokens: maxTokens || this.config.maxTokens || 4000,
      temperature: temperature ?? this.config.temperature ?? 0.7,
      top_p: this.config.topP ?? 1,
      frequency_penalty: this.config.frequencyPenalty ?? 0,
      presence_penalty: this.config.presencePenalty ?? 0,
    };

    if (responseFormat) {
      requestOptions.response_format = responseFormat;
    }

    try {
      const completion = await this.client.chat.completions.create(requestOptions);
      
      return {
        content: completion.choices[0]?.message?.content || '',
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : null,
        model: completion.model,
        finishReason: completion.choices[0]?.finish_reason,
      };
    } catch (error) {
      throw new Error(`OpenAI completion failed: ${error.message}`);
    }
  }

  async embed(input) {
    if (!this.client) {
      await this.initialize();
    }

    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: inputs,
        encoding_format: 'float',
      });

      return response.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
    } catch (error) {
      throw new Error(`OpenAI embedding failed: ${error.message}`);
    }
  }

  async listModels() {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.includes('gpt') || model.id.includes('embedding'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      throw new Error(`Failed to list OpenAI models: ${error.message}`);
    }
  }

  async isAvailable() {
    try {
      if (!this.client) {
        await this.initialize();
      }
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  estimateTokens(text) {
    // More accurate estimation for OpenAI models
    // Based on tiktoken approximation
    return Math.ceil(text.length / 3.5);
  }

  calculateCost(usage, model = this.defaultModel) {
    // Approximate pricing (as of 2024) per 1K tokens
    const pricing = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-32k': { input: 0.06, output: 0.12 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    const inputCost = (usage.promptTokens / 1000) * modelPricing.input;
    const outputCost = (usage.completionTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }
}

export default OpenAIProvider;