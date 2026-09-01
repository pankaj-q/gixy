import { defaultFactory, initializeDefaultProviders } from './LLMProviderFactory.js';

/**
 * Compliance Checking Engine using LLMs
 * Checks AI models against various regulatory frameworks
 */
export class ComplianceChecker {
  constructor(config = {}) {
    this.factory = config.factory || initializeDefaultProviders();
    this.defaultProvider = config.defaultProvider || this.factory.getDefaultProvider();
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 60000;
  }

  /**
   * Check model compliance against a framework
   * @param {Object} modelInfo - Model information
   * @param {string} framework - Regulatory framework
   * @param {Object} options - Check options
   * @returns {Promise<Object>} Compliance check result
   */
  async checkCompliance(modelInfo, framework, options = {}) {
    const provider = options.provider
      ? this.factory.getProvider(options.provider)
      : this.defaultProvider;

    if (!provider) {
      throw new Error('No LLM provider available. Configure at least one provider.');
    }

    const prompt = this.buildCompliancePrompt(modelInfo, framework, options);
    const systemPrompt = this.getSystemPrompt(framework);

    const response = await this.callWithRetry(provider, {
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4096,
    });

    return this.parseComplianceResult(response.content, modelInfo, framework);
  }

  /**
   * Check compliance against multiple frameworks
   * @param {Object} modelInfo - Model information
   * @param {Array<string>} frameworks - List of frameworks
   * @param {Object} options - Check options
   * @returns {Promise<Object>} Combined compliance results
   */
  async checkMultipleFrameworks(modelInfo, frameworks, options = {}) {
    const results = {};
    for (const framework of frameworks) {
      try {
        results[framework] = await this.checkCompliance(modelInfo, framework, options);
      } catch (error) {
        results[framework] = {
          framework,
          error: error.message,
          compliant: false,
          requirements: [],
          gaps: ['Unable to complete check'],
          recommendations: ['Retry compliance check'],
        };
      }
    }
    return results;
  }

  /**
   * Get supported frameworks
   * @returns {Array<Object>} List of supported frameworks
   */
  getSupportedFrameworks() {
    return [
      { id: 'eu_ai_act', name: 'EU AI Act', description: 'European Union Artificial Intelligence Act' },
      { id: 'nist_ai_rmf', name: 'NIST AI RMF', description: 'NIST AI Risk Management Framework' },
      { id: 'iso_42001', name: 'ISO 42001', description: 'ISO/IEC 42001 AI Management System' },
      { id: 'gdpr', name: 'GDPR', description: 'General Data Protection Regulation' },
      { id: 'ccpa', name: 'CCPA', description: 'California Consumer Privacy Act' },
      { id: 'hipaa', name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' },
      { id: 'sox', name: 'SOX', description: 'Sarbanes-Oxley Act' },
      { id: 'algorithmic_accountability', name: 'Algorithmic Accountability Act', description: 'US Algorithmic Accountability Act' },
      { id: 'canada_cpp', name: 'Canada C-27', description: 'Canada Digital Charter Implementation Act' },
      { id: 'uk_ai_regulation', name: 'UK AI Regulation', description: 'UK AI Governance Framework' },
      { id: 'oecd_ai_principles', name: 'OECD AI Principles', description: 'OECD Principles on Artificial Intelligence' },
      { id: 'ieee_ethically_aligned', name: 'IEEE Ethically Aligned Design', description: 'IEEE Ethically Aligned Design Standards' },
    ];
  }

  /**
   * Build compliance check prompt
   * @param {Object} modelInfo - Model information
   * @param {string} framework - Regulatory framework
   * @param {Object} options - Check options
   * @returns {string} Prompt for LLM
   */
  buildCompliancePrompt(modelInfo, framework, options) {
    const frameworkDetails = this.getFrameworkDetails(framework);
    const customRequirements = options.customRequirements || [];

    return `
Check the following AI model for compliance with ${frameworkDetails.name} (${frameworkDetails.description}).

Model Information:
- Name: ${modelInfo.name || 'Unknown'}
- Type: ${modelInfo.type || 'Unknown'}
- Purpose: ${modelInfo.purpose || 'Not specified'}
- Risk Level: ${modelInfo.riskLevel || 'Not assessed'}
- Training Data: ${modelInfo.trainingData || 'Not specified'}
- Data Sources: ${modelInfo.dataSources || 'Not specified'}
- Deployment Context: ${modelInfo.deploymentContext || 'Not specified'}
- Geographic Scope: ${modelInfo.geographicScope || 'Global'}
- Industry Sector: ${modelInfo.industrySector || 'Not specified'}
- Users: ${modelInfo.users || 'Not specified'}
- Processing Personal Data: ${modelInfo.processesPersonalData ? 'Yes' : 'No/Unknown'}
- Processing Sensitive Data: ${modelInfo.processesSensitiveData ? 'Yes' : 'No/Unknown'}
- Automated Decision Making: ${modelInfo.automatedDecisions ? 'Yes' : 'No/Unknown'}
- Human Oversight: ${modelInfo.humanOversight ? 'Yes' : 'No/Unknown'}
${modelInfo.additionalInfo ? `- Additional Info: ${modelInfo.additionalInfo}` : ''}

${customRequirements.length > 0 ? `Additional Requirements to Check:
${customRequirements.map(r => `- ${r}`).join('\n')}` : ''}

For ${frameworkDetails.name}, provide:
1. Overall Compliance Status: (Compliant / Partially Compliant / Non-Compliant / Cannot Determine)
2. Key Requirements Assessment: For each major requirement, provide:
   - Requirement: Description
   - Status: (Met / Partially Met / Not Met / Not Applicable)
   - Evidence: What demonstrates compliance or gap
   - Gap: What is missing (if not met)
   - Recommendation: How to achieve compliance
3. Critical Gaps: List of critical compliance gaps
4. Recommended Actions: Prioritized action items
5. Documentation Needed: Required documentation for compliance
6. Confidence Level: (High / Medium / Low)

Format your response as JSON with the following structure:
{
  "framework": "${framework}",
  "frameworkName": "${frameworkDetails.name}",
  "overallStatus": "Compliant|Partially Compliant|Non-Compliant|Cannot Determine",
  "confidence": "High|Medium|Low",
  "requirements": [
    {
      "requirement": "...",
      "status": "Met|Partially Met|Not Met|Not Applicable",
      "evidence": "...",
      "gap": "...",
      "recommendation": "..."
    }
  ],
  "criticalGaps": ["...", "..."],
  "recommendedActions": ["...", "..."],
  "documentationNeeded": ["...", "..."],
  "assessedAt": "ISO timestamp"
}
`;
  }

  /**
   * Get framework details
   * @param {string} framework - Framework ID
   * @returns {Object} Framework details
   */
  getFrameworkDetails(framework) {
    const frameworks = {
      eu_ai_act: { name: 'EU AI Act', description: 'European Union Artificial Intelligence Act' },
      nist_ai_rmf: { name: 'NIST AI RMF', description: 'NIST AI Risk Management Framework' },
      iso_42001: { name: 'ISO 42001', description: 'ISO/IEC 42001 AI Management System' },
      gdpr: { name: 'GDPR', description: 'General Data Protection Regulation' },
      ccpa: { name: 'CCPA', description: 'California Consumer Privacy Act' },
      hipaa: { name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' },
      sox: { name: 'SOX', description: 'Sarbanes-Oxley Act' },
      algorithmic_accountability: { name: 'Algorithmic Accountability Act', description: 'US Algorithmic Accountability Act' },
      canada_cpp: { name: 'Canada C-27', description: 'Canada Digital Charter Implementation Act' },
      uk_ai_regulation: { name: 'UK AI Regulation', description: 'UK AI Governance Framework' },
      oecd_ai_principles: { name: 'OECD AI Principles', description: 'OECD Principles on Artificial Intelligence' },
      ieee_ethically_aligned: { name: 'IEEE Ethically Aligned Design', description: 'IEEE Ethically Aligned Design Standards' },
    };
    return frameworks[framework] || { name: framework, description: 'Custom framework' };
  }

  /**
   * Get system prompt for compliance checking
   * @param {string} framework - Regulatory framework
   * @returns {string} System prompt
   */
  getSystemPrompt(framework) {
    const frameworkDetails = this.getFrameworkDetails(framework);
    return `You are an expert AI compliance auditor specializing in ${frameworkDetails.name}. You have deep knowledge of regulatory requirements, technical standards, and best practices for AI governance. You provide thorough, evidence-based compliance assessments. Always respond with valid JSON only.`;
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
   * Parse compliance result
   * @param {string} content - LLM response content
   * @param {Object} modelInfo - Original model info
   * @param {string} framework - Framework checked
   * @returns {Object} Parsed compliance result
   */
  parseComplianceResult(content, modelInfo, framework) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.requirements || !parsed.overallStatus) {
        throw new Error('Invalid response structure');
      }

      return {
        ...parsed,
        modelName: modelInfo.name || modelInfo.id || 'Unknown',
        assessedAt: parsed.assessedAt || new Date().toISOString(),
        requirementsCount: parsed.requirements.length,
        criticalGapsCount: parsed.criticalGaps?.length || 0,
      };
    } catch (error) {
      return this.createFallbackCompliance(content, modelInfo, framework, error.message);
    }
  }

  /**
   * Create fallback compliance result
   * @param {string} content - Raw response
   * @param {Object} modelInfo - Model info
   * @param {string} framework - Framework
   * @param {string} error - Parse error
   * @returns {Object} Fallback result
   */
  createFallbackCompliance(content, modelInfo, framework, error) {
    const frameworkDetails = this.getFrameworkDetails(framework);
    return {
      framework,
      frameworkName: frameworkDetails.name,
      overallStatus: 'Cannot Determine',
      confidence: 'Low',
      requirements: [],
      criticalGaps: ['Unable to parse compliance assessment'],
      recommendedActions: ['Review raw output manually', 'Re-run compliance check'],
      documentationNeeded: ['Complete compliance assessment'],
      modelName: modelInfo.name || modelInfo.id || 'Unknown',
      assessedAt: new Date().toISOString(),
      parseError: error,
      rawResponse: content,
    };
  }

  /**
   * Generate compliance report
   * @param {Object} result - Compliance result
   * @returns {string} Formatted report
   */
  generateReport(result) {
    let report = `# Compliance Assessment Report\n\n`;
    report += `**Model:** ${result.modelName}\n`;
    report += `**Framework:** ${result.frameworkName} (${result.framework})\n`;
    report += `**Date:** ${new Date(result.assessedAt).toLocaleString()}\n`;
    report += `**Overall Status:** ${result.overallStatus}\n`;
    report += `**Confidence:** ${result.confidence}\n\n`;
    
    report += `## Requirements Assessment\n\n`;
    for (const req of result.requirements) {
      report += `### ${req.requirement}\n`;
      report += `**Status:** ${req.status}\n`;
      report += `**Evidence:** ${req.evidence}\n`;
      if (req.gap) report += `**Gap:** ${req.gap}\n`;
      report += `**Recommendation:** ${req.recommendation}\n\n`;
    }

    if (result.criticalGaps.length > 0) {
      report += `## Critical Gaps\n`;
      for (const gap of result.criticalGaps) {
        report += `- ${gap}\n`;
      }
      report += `\n`;
    }

    report += `## Recommended Actions\n`;
    for (const action of result.recommendedActions) {
      report += `- ${action}\n`;
    }

    report += `\n## Documentation Needed\n`;
    for (const doc of result.documentationNeeded) {
      report += `- ${doc}\n`;
    }

    return report;
  }
}

export default ComplianceChecker;