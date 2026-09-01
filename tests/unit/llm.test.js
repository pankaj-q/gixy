import { LLMProvider } from '../../src/llm/LLMProvider.js';
import { OpenAIProvider } from '../../src/llm/OpenAIProvider.js';
import { AnthropicProvider } from '../../src/llm/AnthropicProvider.js';
import { LLMProviderFactory, defaultFactory, initializeDefaultProviders } from '../../src/llm/LLMProviderFactory.js';
import { RiskAnalysisEngine } from '../../src/llm/RiskAnalysisEngine.js';
import { ComplianceChecker } from '../../src/llm/ComplianceChecker.js';
import { ModelCardGenerator } from '../../src/llm/ModelCardGenerator.js';
import { LLMConfig, validateConfig, getProviderConfig, getEngineConfig } from '../../src/llm/config.js';
import { createLLMSystem, quickRiskAnalysis, quickComplianceCheck, quickModelCard } from '../../src/llm/index.js';

describe('LLMProvider', () => {
  test('should be instantiable but methods throw', () => {
    const provider = new LLMProvider();
    expect(provider).toBeInstanceOf(LLMProvider);
    expect(provider.getName()).toBe('base');
  });

  test('should require implementation of abstract methods', () => {
    class TestProvider extends LLMProvider {
      getName() { return 'test'; }
      getAvailableModels() { return []; }
      validateConfig() { return true; }
      async generateCompletion() { return {}; }
    }
    const provider = new TestProvider();
    expect(provider.getName()).toBe('test');
  });
});

describe('OpenAIProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new OpenAIProvider({
      apiKey: 'test-key',
      defaultModel: 'gpt-4',
    });
  });

  test('should have correct name', () => {
    expect(provider.getName()).toBe('openai');
  });

  test('should return available models', () => {
    const models = provider.getAvailableModels();
    expect(models).toContain('gpt-4');
    expect(models).toContain('gpt-3.5-turbo');
  });

  test('should validate config with API key', () => {
    expect(provider.validateConfig()).toBe(true);
  });

  test('should invalidate config without API key', () => {
    const noKeyProvider = new OpenAIProvider({});
    expect(noKeyProvider.validateConfig()).toBe(false);
  });

  test('should estimate tokens correctly', () => {
    const tokens = provider.estimateTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  test('should calculate cost', () => {
    const cost = provider.calculateCost({ promptTokens: 1000, completionTokens: 500 }, 'gpt-4');
    expect(cost).toBeGreaterThan(0);
  });
});

describe('AnthropicProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new AnthropicProvider({
      apiKey: 'test-key',
      defaultModel: 'claude-3-opus-20240229',
    });
  });

  test('should have correct name', () => {
    expect(provider.getName()).toBe('anthropic');
  });

  test('should return available models', () => {
    const models = provider.getAvailableModels();
    expect(models).toContain('claude-3-opus-20240229');
    expect(models).toContain('claude-3-sonnet-20240229');
  });

  test('should validate config with API key', () => {
    expect(provider.validateConfig()).toBe(true);
  });

  test('should invalidate config without API key', () => {
    const noKeyProvider = new AnthropicProvider({});
    expect(noKeyProvider.validateConfig()).toBe(false);
  });

  test('should estimate tokens correctly', () => {
    const tokens = provider.estimateTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  test('should calculate cost', () => {
    const cost = provider.calculateCost({ promptTokens: 1000, completionTokens: 500 }, 'claude-3-opus-20240229');
    expect(cost).toBeGreaterThan(0);
  });
});

describe('LLMProviderFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new LLMProviderFactory();
  });

  test('should register and retrieve providers', () => {
    const provider = new OpenAIProvider({ apiKey: 'test' });
    factory.registerProvider('openai', provider);
    
    const retrieved = factory.getProvider('openai');
    expect(retrieved).toBe(provider);
  });

  test('should return null for unknown provider', () => {
    expect(factory.getProvider('unknown')).toBeNull();
  });

  test('should set and get default provider', () => {
    const provider = new OpenAIProvider({ apiKey: 'test' });
    factory.registerProvider('openai', provider);
    factory.setDefaultProvider('openai');
    
    expect(factory.getDefaultProvider()).toBe(provider);
  });

  test('should get all providers', () => {
    const openai = new OpenAIProvider({ apiKey: 'test' });
    const anthropic = new AnthropicProvider({ apiKey: 'test' });
    
    factory.registerProvider('openai', openai);
    factory.registerProvider('anthropic', anthropic);
    
    const all = factory.getAllProviders();
    expect(all).toHaveLength(2);
  });

  test('should create provider from config', () => {
    const provider = LLMProviderFactory.createFromConfig({
      type: 'openai',
      apiKey: 'test-key',
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  test('should throw for unknown provider type', () => {
    expect(() => {
      LLMProviderFactory.createFromConfig({ type: 'unknown' });
    }).toThrow('Unknown provider type');
  });
});

describe('RiskAnalysisEngine', () => {
  let engine;

  beforeEach(() => {
    const factory = new LLMProviderFactory();
    factory.registerProvider('openai', new OpenAIProvider({ apiKey: 'test' }));
    engine = new RiskAnalysisEngine({ factory });
  });

  test('should get risk categories', () => {
    const categories = engine.getRiskCategories();
    expect(categories).toContain('bias_fairness');
    expect(categories).toContain('privacy_data_protection');
    expect(categories).toContain('security_robustness');
  });

  test('should build risk analysis prompt', () => {
    const modelInfo = { name: 'Test Model', type: 'LLM' };
    const prompt = engine.buildRiskAnalysisPrompt(modelInfo, {});
    expect(prompt).toContain('Test Model');
    expect(prompt).toContain('bias fairness');
  });

  test('should parse valid risk analysis response', () => {
    const content = JSON.stringify({
      overallRiskLevel: 'Medium',
      summary: 'Test summary',
      categories: {
        bias_fairness: {
          riskLevel: 'Low',
          description: 'Low bias risk',
          evidence: 'Test evidence',
          mitigation: 'Test mitigation',
          confidence: 'High',
        },
      },
      recommendations: ['Test recommendation'],
      requiresHumanReview: false,
    });

    const result = engine.parseRiskAnalysis(content, { name: 'Test' });
    expect(result.overallRiskLevel).toBe('Medium');
    expect(result.modelName).toBe('Test');
  });

  test('should handle invalid response gracefully', () => {
    const result = engine.parseRiskAnalysis('Invalid JSON', { name: 'Test' });
    expect(result.overallRiskLevel).toBe('Unknown');
    expect(result.requiresHumanReview).toBe(true);
    expect(result.parseError).toBeDefined();
  });
});

describe('ComplianceChecker', () => {
  let checker;

  beforeEach(() => {
    const factory = new LLMProviderFactory();
    factory.registerProvider('openai', new OpenAIProvider({ apiKey: 'test' }));
    checker = new ComplianceChecker({ factory });
  });

  test('should get supported frameworks', () => {
    const frameworks = checker.getSupportedFrameworks();
    expect(frameworks.length).toBeGreaterThan(0);
    expect(frameworks[0]).toHaveProperty('id');
    expect(frameworks[0]).toHaveProperty('name');
  });

  test('should get framework details', () => {
    const details = checker.getFrameworkDetails('eu_ai_act');
    expect(details.name).toBe('EU AI Act');
  });

  test('should build compliance prompt', () => {
    const modelInfo = { name: 'Test Model', processesPersonalData: true };
    const prompt = checker.buildCompliancePrompt(modelInfo, 'eu_ai_act', {});
    expect(prompt).toContain('Test Model');
    expect(prompt).toContain('EU AI Act');
  });

  test('should parse valid compliance response', () => {
    const content = JSON.stringify({
      framework: 'eu_ai_act',
      frameworkName: 'EU AI Act',
      overallStatus: 'Partially Compliant',
      confidence: 'High',
      requirements: [
        {
          requirement: 'Risk assessment',
          status: 'Met',
          evidence: 'Done',
          gap: '',
          recommendation: 'Continue',
        },
      ],
      criticalGaps: [],
      recommendedActions: [],
      documentationNeeded: [],
    });

    const result = checker.parseComplianceResult(content, { name: 'Test' }, 'eu_ai_act');
    expect(result.overallStatus).toBe('Partially Compliant');
    expect(result.modelName).toBe('Test');
  });
});

describe('ModelCardGenerator', () => {
  let generator;

  beforeEach(() => {
    const factory = new LLMProviderFactory();
    factory.registerProvider('openai', new OpenAIProvider({ apiKey: 'test' }));
    generator = new ModelCardGenerator({ factory });
  });

  test('should get supported sections', () => {
    const sections = generator.getSupportedSections();
    expect(sections).toContain('model_details');
    expect(sections).toContain('intended_use');
    expect(sections).toContain('ethical_considerations');
  });

  test('should build model card prompt', () => {
    const modelInfo = { name: 'Test Model', purpose: 'Testing' };
    const prompt = generator.buildModelCardPrompt(modelInfo, {});
    expect(prompt).toContain('Test Model');
    expect(prompt).toContain('model_details');
  });

  test('should parse valid model card response', () => {
    const content = JSON.stringify({
      model_details: {
        name: 'Test Model',
        version: '1.0.0',
        type: 'LLM',
      },
      intended_use: {
        primary_uses: ['Testing'],
        primary_users: ['Developers'],
        out_of_scope: ['Production'],
      },
    });

    const result = generator.parseModelCard(content, { name: 'Test' });
    expect(result.model_details.name).toBe('Test Model');
    expect(result.generatedAt).toBeDefined();
  });

  test('should convert to markdown', () => {
    const card = {
      model_details: { name: 'Test', version: '1.0' },
      intended_use: { primary_uses: ['Test'], primary_users: ['Devs'], out_of_scope: [] },
    };
    const markdown = generator.toMarkdown(card);
    expect(markdown).toContain('# Model Card: Test');
    expect(markdown).toContain('## Model Details');
  });

  test('should convert to HTML', () => {
    const card = { model_details: { name: 'Test' } };
    const html = generator.toHtml(card);
    expect(html).toContain('<h1>Model Card: Test</h1>');
  });

  test('should convert to YAML', () => {
    const card = { model_details: { name: 'Test', version: '1.0' } };
    const yaml = generator.toYaml(card);
    expect(yaml).toContain('model_details:');
    expect(yaml).toContain('name: "Test"');
  });
});

describe('LLMConfig', () => {
  test('should have provider configs', () => {
    expect(LLMConfig.providers.openai).toBeDefined();
    expect(LLMConfig.providers.anthropic).toBeDefined();
  });

  test('should have engine configs', () => {
    expect(LLMConfig.engines.riskAnalysis).toBeDefined();
    expect(LLMConfig.engines.complianceChecker).toBeDefined();
    expect(LLMConfig.engines.modelCardGenerator).toBeDefined();
  });

  test('should have compliance frameworks', () => {
    expect(LLMConfig.complianceFrameworks).toContain('eu_ai_act');
    expect(LLMConfig.complianceFrameworks).toContain('nist_ai_rmf');
  });

  test('should have risk categories', () => {
    expect(LLMConfig.riskCategories).toContain('bias_fairness');
    expect(LLMConfig.riskCategories).toContain('privacy_data_protection');
  });

  test('should get provider config', () => {
    const config = getProviderConfig('openai');
    expect(config).toBeDefined();
    expect(config.defaultModel).toBeDefined();
  });

  test('should get engine config', () => {
    const config = getEngineConfig('riskAnalysis');
    expect(config).toBeDefined();
    expect(config.temperature).toBeDefined();
  });
});

describe('createLLMSystem', () => {
  test('should create system with default config', () => {
    // This will fail validation without API keys, so we skip validation
    const system = createLLMSystem({ skipValidation: true });
    expect(system.factory).toBeInstanceOf(LLMProviderFactory);
    expect(system.engines).toBeDefined();
  });

  test('should throw on invalid config without skipValidation', () => {
    // Clear env to force invalid config
    const originalOpenAI = process.env.OPENAI_API_KEY;
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    expect(() => createLLMSystem()).toThrow();
    
    // Restore
    if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
    if (originalAnthropic) process.env.ANTHROPIC_API_KEY = originalAnthropic;
  });
});