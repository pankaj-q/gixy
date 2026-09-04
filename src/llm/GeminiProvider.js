import { LLMProvider } from './LLMProvider.js';

/**
 * Google Gemini provider implementation
 * Uses Google Generative AI API (gemini-pro, gemini-1.5-flash, etc.)
 */
export class GeminiProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = config.defaultModel || 'gemini-3.6-flash';
  }

  getName() {
    return 'gemini';
  }

  getAvailableModels() {
    return [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];
  }

  validateConfig() {
    return !!this.apiKey;
  }

  async initialize() {
    // No initialization needed for REST API
    return true;
  }

  async generateCompletion({ prompt, systemPrompt, maxTokens = 4096, temperature = 0.7, responseFormat, messages }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }

    // Convert messages to Gemini format
    const geminiMessages = this.convertMessages(messages || [], systemPrompt);
    
    // Add user prompt if provided separately
    if (prompt && (!messages || messages.length === 0)) {
      geminiMessages.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
        ...(responseFormat?.type === 'json_object' && { responseMimeType: 'application/json' }),
      },
    };

    const model = this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Extract content from response
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};

    return {
      content,
      model,
      usage: {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      },
      finishReason: data.candidates?.[0]?.finishReason || 'STOP',
      rawResponse: data,
    };
  }

  convertMessages(messages, systemPrompt) {
    const geminiMessages = [];

    // Add system prompt as first user message if provided
    if (systemPrompt) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `System: ${systemPrompt}` }]
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }]
      });
    }

    // Convert standard messages to Gemini format
    for (const msg of messages) {
      if (msg.role === 'system') continue; // Already handled above
      
      const role = msg.role === 'assistant' ? 'model' : 'user';
      geminiMessages.push({
        role,
        parts: [{ text: msg.content }]
      });
    }

    return geminiMessages;
  }

  async generateStreamingCompletion({ prompt, systemPrompt, maxTokens = 4096, temperature = 0.7, responseFormat, messages }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }

    const geminiMessages = this.convertMessages(messages || [], systemPrompt);
    if (prompt && (!messages || messages.length === 0)) {
      geminiMessages.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
        ...(responseFormat?.type === 'json_object' && { responseMimeType: 'application/json' }),
      },
    };

    const model = this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    async function* stream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                  yield {
                    content,
                    done: false,
                  };
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
        
        yield { content: '', done: true };
      } finally {
        reader.releaseLock();
      }
    }

    return stream();
  }

  async embed(input) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }

    const texts = Array.isArray(input) ? input : [input];
    const model = 'text-embedding-004';
    const url = `${this.baseUrl}/models/${model}:embedContent?key=${this.apiKey}`;

    const embeddings = [];
    for (const text of texts) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Gemini embedding error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding?.values || []);
    }

    return embeddings;
  }

  async listModels() {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured.');
    }

    const url = `${this.baseUrl}/models?key=${this.apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = await response.json();
    return data.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
  }

  async isAvailable() {
    if (!this.apiKey) return false;
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  calculateCost(usage, model = this.defaultModel) {
    // Gemini pricing (as of 2024) per 1M tokens
    const pricing = {
      'gemini-3.6-flash': { input: 0.075, output: 0.30 },
      'gemini-3.5-flash': { input: 0.075, output: 0.30 },
      'gemini-2.5-flash': { input: 0.075, output: 0.30 },
      'gemini-2.5-pro': { input: 3.50, output: 10.50 },
      'gemini-2.0-flash': { input: 0.075, output: 0.30 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'gemini-1.5-pro': { input: 3.50, output: 10.50 },
    };

    const modelPricing = pricing[model] || pricing['gemini-1.5-flash'];
    const inputCost = (usage.promptTokens / 1_000_000) * modelPricing.input;
    const outputCost = (usage.completionTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }
}

export default GeminiProvider;