import { defaultFactory, initializeDefaultProviders } from './LLMProviderFactory.js';

/**
 * Model Card Generator using LLMs
 * Generates standardized model cards for AI models
 */
export class ModelCardGenerator {
  constructor(config = {}) {
    this.factory = config.factory || initializeDefaultProviders();
    this.defaultProvider = config.defaultProvider || this.factory.getDefaultProvider();
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 60000;
  }

  /**
   * Generate a model card
   * @param {Object} modelInfo - Model information
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated model card
   */
  async generateModelCard(modelInfo, options = {}) {
    const provider = options.provider
      ? this.factory.getProvider(options.provider)
      : this.defaultProvider;

    if (!provider) {
      throw new Error('No LLM provider available. Configure at least one provider.');
    }

    const prompt = this.buildModelCardPrompt(modelInfo, options);
    const systemPrompt = this.getSystemPrompt();

    const response = await this.callWithRetry(provider, {
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.4,
      maxTokens: options.maxTokens || 6000,
    });

    return this.parseModelCard(response.content, modelInfo);
  }

  /**
   * Generate model card in multiple formats
   * @param {Object} modelInfo - Model information
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Model card in multiple formats
   */
  async generateModelCardMultiFormat(modelInfo, options = {}) {
    const card = await this.generateModelCard(modelInfo, options);
    
    return {
      json: card,
      markdown: this.toMarkdown(card),
      html: this.toHtml(card),
      yaml: this.toYaml(card),
    };
  }

  /**
   * Get supported model card sections
   * @returns {Array<string>} List of sections
   */
  getSupportedSections() {
    return [
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
    ];
  }

  /**
   * Build model card prompt
   * @param {Object} modelInfo - Model information
   * @param {Object} options - Generation options
   * @returns {string} Prompt for LLM
   */
  buildModelCardPrompt(modelInfo, options) {
    const sections = options.sections || this.getSupportedSections();
    const sectionsText = sections.map(s => `- ${s.replace(/_/g, ' ')}`).join('\n');

    return `
Generate a comprehensive Model Card for the following AI model following the Model Cards for Model Reporting framework (Mitchell et al., 2019) and industry best practices.

Include these sections:
${sectionsText}

Model Information:
- Name: ${modelInfo.name || 'Unknown'}
- Version: ${modelInfo.version || '1.0.0'}
- Type: ${modelInfo.type || 'Unknown'}
- Architecture: ${modelInfo.architecture || 'Not specified'}
- Framework: ${modelInfo.framework || 'Not specified'}
- License: ${modelInfo.license || 'Not specified'}
- Purpose: ${modelInfo.purpose || 'Not specified'}
- Intended Use: ${modelInfo.intendedUse || 'Not specified'}
- Primary Users: ${modelInfo.primaryUsers || 'Not specified'}
- Out-of-Scope Use: ${modelInfo.outOfScopeUse || 'Not specified'}

Training Data:
- Datasets: ${modelInfo.datasets?.join(', ') || 'Not specified'}
- Data Sources: ${modelInfo.dataSources?.join(', ') || 'Not specified'}
- Data Size: ${modelInfo.dataSize || 'Not specified'}
- Preprocessing: ${modelInfo.preprocessing || 'Not specified'}
- Data License: ${modelInfo.dataLicense || 'Not specified'}

Model Performance:
- Metrics: ${JSON.stringify(modelInfo.metrics || {}, null, 2)}
- Evaluation Data: ${modelInfo.evaluationData || 'Not specified'}
- Benchmarks: ${modelInfo.benchmarks?.join(', ') || 'Not specified'}

Ethical & Risk Considerations:
- Risk Assessment: ${modelInfo.riskAssessment || 'Not provided'}
- Bias Analysis: ${modelInfo.biasAnalysis || 'Not provided'}
- Fairness Metrics: ${JSON.stringify(modelInfo.fairnessMetrics || {}, null, 2)}
- Privacy Considerations: ${modelInfo.privacyConsiderations || 'Not specified'}
- Security Considerations: ${modelInfo.securityConsiderations || 'Not specified'}

Deployment:
- Deployment Context: ${modelInfo.deploymentContext || 'Not specified'}
- Hardware Requirements: ${modelInfo.hardwareRequirements || 'Not specified'}
- Software Dependencies: ${modelInfo.dependencies?.join(', ') || 'Not specified'}
- API/Interface: ${modelInfo.apiInterface || 'Not specified'}

Governance:
- Model Card Authors: ${modelInfo.authors?.join(', ') || 'Not specified'}
- Contact: ${modelInfo.contact || 'Not specified'}
- Organization: ${modelInfo.organization || 'Not specified'}
- Review Date: ${modelInfo.reviewDate || new Date().toISOString().split('T')[0]}
- Approval Status: ${modelInfo.approvalStatus || 'Draft'}
${modelInfo.additionalInfo ? `- Additional Info: ${modelInfo.additionalInfo}` : ''}

Format your response as JSON with the following structure:
{
  "model_details": {
    "name": "...",
    "version": "...",
    "type": "...",
    "architecture": "...",
    "framework": "...",
    "license": "...",
    "date": "ISO date",
    "organization": "...",
    "contact": "...",
    "authors": ["..."],
    "references": ["..."]
  },
  "intended_use": {
    "primary_uses": ["..."],
    "primary_users": ["..."],
    "out_of_scope": ["..."]
  },
  "factors": {
    "relevant_factors": ["..."],
    "evaluation_factors": ["..."]
  },
  "metrics": {
    "model_performance": [...],
    "fairness_metrics": [...]
  },
  "evaluation_data": {
    "datasets": [...],
    "motivation": "...",
    "preprocessing": "..."
  },
  "training_data": {
    "datasets": [...],
    "motivation": "...",
    "preprocessing": "...",
    "caveats": "..."
  },
  "quantitative_analysis": {
    "unitary_results": [...],
    "intersectional_results": [...]
  },
  "ethical_considerations": {
    "risk_assessment": "...",
    "bias_fairness": "...",
    "privacy": "...",
    "security": "...",
    "societal_impact": "..."
  },
  "caveats_recommendations": {
    "caveats": ["..."],
    "recommendations": ["..."]
  },
  "version_history": [
    {
      "version": "...",
      "date": "ISO date",
      "changes": "...",
      "author": "..."
    }
  ]
}
`;
  }

  /**
   * Get system prompt for model card generation
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are an expert in AI documentation and model card creation. You follow the Model Cards for Model Reporting framework (Mitchell et al., 2019) and industry standards for responsible AI documentation. You create comprehensive, transparent, and actionable model cards. Always respond with valid JSON only.`;
  }

  /**
   * Call LLM with retry logic
   * @param {LLMProvider} provider - LLM provider
   * @param {Object} params - Completion parameters
   * @returns {Promise<Object>} Completion response
   */
  async callWithRetry(provider, params) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          provider.generateCompletion(params),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), this.timeout)
          ),
        ]);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Parse model card response
   * @param {string} content - LLM response content
   * @param {Object} modelInfo - Original model info
   * @returns {Object} Parsed model card
   */
  parseModelCard(content, modelInfo) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required sections
      if (!parsed.model_details || !parsed.intended_use) {
        throw new Error('Invalid model card structure');
      }

      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
        generator: 'gixy-model-card-generator',
      };
    } catch (error) {
      return this.createFallbackModelCard(content, modelInfo, error.message);
    }
  }

  /**
   * Create fallback model card
   * @param {string} content - Raw response
   * @param {Object} modelInfo - Model info
   * @param {string} error - Parse error
   * @returns {Object} Fallback model card
   */
  createFallbackModelCard(content, modelInfo, error) {
    return {
      model_details: {
        name: modelInfo.name || 'Unknown',
        version: modelInfo.version || '1.0.0',
        type: modelInfo.type || 'Unknown',
        generatedAt: new Date().toISOString(),
        parseError: error,
      },
      intended_use: {
        primary_uses: [modelInfo.purpose || 'Not specified'],
        primary_users: [modelInfo.primaryUsers || 'Not specified'],
        out_of_scope: [modelInfo.outOfScopeUse || 'Not specified'],
      },
      ethical_considerations: {
        risk_assessment: 'Model card generation failed - manual creation required',
      },
      caveats_recommendations: {
        caveats: ['Automated generation failed'],
        recommendations: ['Create model card manually', 'Review raw output'],
      },
      rawResponse: content,
    };
  }

  /**
   * Convert model card to Markdown
   * @param {Object} card - Model card object
   * @returns {string} Markdown format
   */
  toMarkdown(card) {
    let md = `# Model Card: ${card.model_details?.name || 'Unknown'}\n\n`;
    
    md += `## Model Details\n`;
    md += `| Field | Value |\n|-------|-------|\n`;
    for (const [key, value] of Object.entries(card.model_details || {})) {
      if (Array.isArray(value)) {
        md += `| ${key} | ${value.join(', ')} |\n`;
      } else if (value !== undefined && value !== null) {
        md += `| ${key} | ${value} |\n`;
      }
    }
    md += `\n`;

    md += `## Intended Use\n`;
    if (card.intended_use?.primary_uses) {
      md += `### Primary Uses\n`;
      for (const use of card.intended_use.primary_uses) {
        md += `- ${use}\n`;
      }
    }
    if (card.intended_use?.primary_users) {
      md += `\n### Primary Users\n`;
      for (const user of card.intended_use.primary_users) {
        md += `- ${user}\n`;
      }
    }
    if (card.intended_use?.out_of_scope) {
      md += `\n### Out-of-Scope Uses\n`;
      for (const oos of card.intended_use.out_of_scope) {
        md += `- ${oos}\n`;
      }
    }
    md += `\n`;

    if (card.factors) {
      md += `## Factors\n`;
      if (card.factors.relevant_factors) {
        md += `### Relevant Factors\n`;
        for (const f of card.factors.relevant_factors) md += `- ${f}\n`;
      }
      if (card.factors.evaluation_factors) {
        md += `\n### Evaluation Factors\n`;
        for (const f of card.factors.evaluation_factors) md += `- ${f}\n`;
      }
      md += `\n`;
    }

    if (card.metrics) {
      md += `## Metrics\n`;
      if (card.metrics.model_performance) {
        md += `### Model Performance\n`;
        for (const m of card.metrics.model_performance) {
          md += `- ${m.name || m}: ${m.value || ''} ${m.unit || ''}\n`;
        }
      }
      if (card.metrics.fairness_metrics) {
        md += `\n### Fairness Metrics\n`;
        for (const m of card.metrics.fairness_metrics) {
          md += `- ${m.name || m}: ${m.value || ''} ${m.unit || ''}\n`;
        }
      }
      md += `\n`;
    }

    if (card.training_data) {
      md += `## Training Data\n`;
      if (card.training_data.datasets) {
        md += `### Datasets\n`;
        for (const d of card.training_data.datasets) md += `- ${d}\n`;
      }
      if (card.training_data.motivation) md += `\n**Motivation:** ${card.training_data.motivation}\n`;
      if (card.training_data.preprocessing) md += `\n**Preprocessing:** ${card.training_data.preprocessing}\n`;
      if (card.training_data.caveats) md += `\n**Caveats:** ${card.training_data.caveats}\n`;
      md += `\n`;
    }

    if (card.ethical_considerations) {
      md += `## Ethical Considerations\n`;
      for (const [key, value] of Object.entries(card.ethical_considerations)) {
        if (value) md += `### ${key.replace(/_/g, ' ')}\n${value}\n\n`;
      }
    }

    if (card.caveats_recommendations) {
      md += `## Caveats and Recommendations\n`;
      if (card.caveats_recommendations.caveats) {
        md += `### Caveats\n`;
        for (const c of card.caveats_recommendations.caveats) md += `- ${c}\n`;
      }
      if (card.caveats_recommendations.recommendations) {
        md += `\n### Recommendations\n`;
        for (const r of card.caveats_recommendations.recommendations) md += `- ${r}\n`;
      }
      md += `\n`;
    }

    if (card.version_history) {
      md += `## Version History\n`;
      for (const v of card.version_history) {
        md += `### v${v.version} (${v.date})\n`;
        md += `**Author:** ${v.author || 'Unknown'}\n\n`;
        md += `${v.changes}\n\n`;
      }
    }

    return md;
  }

  /**
   * Convert model card to HTML
   * @param {Object} card - Model card object
   * @returns {string} HTML format
   */
  toHtml(card) {
    const markdown = this.toMarkdown(card);
    // Simple markdown to HTML conversion
    return markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^\| (.*?) \| (.*?) \|$/gm, '<tr><td>$1</td><td>$2</td></tr>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Convert model card to YAML
   * @param {Object} card - Model card object
   * @returns {string} YAML format
   */
  toYaml(card) {
    // Simple object to YAML conversion
    function toYaml(obj, indent = 0) {
      let yaml = '';
      const spaces = '  '.repeat(indent);
      
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;
        
        if (Array.isArray(value)) {
          if (value.length === 0) {
            yaml += `${spaces}${key}: []\n`;
          } else if (typeof value[0] === 'object') {
            yaml += `${spaces}${key}:\n`;
            for (const item of value) {
              yaml += `${spaces}  - `;
              if (typeof item === 'object') {
                yaml += '\n' + toYaml(item, indent + 2).replace(/^/gm, '    ');
              } else {
                yaml += `${item}\n`;
              }
            }
          } else {
            yaml += `${spaces}${key}: [${value.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]\n`;
          }
        } else if (typeof value === 'object') {
          yaml += `${spaces}${key}:\n${toYaml(value, indent + 1)}`;
        } else if (typeof value === 'string') {
          yaml += `${spaces}${key}: "${value}"\n`;
        } else {
          yaml += `${spaces}${key}: ${value}\n`;
        }
      }
      return yaml;
    }

    return toYaml(card);
  }
}

export default ModelCardGenerator;