import { AIProviderFactory } from './ai/ai-provider.factory.js';
import { buildJPAAnalysisPrompt } from './ai/prompt-templates/jpa-analysis.prompt.js';

export interface JPAAnalysisResult {
  sqlTranslation: string;
  performanceEstimates: {
    rows: string; // "1K", "100K", "1M", "10M"
    estimatedTimeMs: number;
    scanType: string;
    joinsUsed: number;
    memoryMB: number;
    rating: 'good' | 'acceptable' | 'warning' | 'critical';
  }[];
  issues: {
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    impact: string;
  }[];
  recommendations: {
    title: string;
    description: string;
    before: string;
    after: string;
    estimatedImprovement: string;
  }[];
  summary: string;
}

export async function analyzeJPAQuery(params: {
  jpql: string;
  dialect: string;
  entityContext?: string;
  dataVolumes?: number[];
}): Promise<JPAAnalysisResult> {
  const provider = await AIProviderFactory.getDefault();
  const messages = buildJPAAnalysisPrompt(
    params.jpql,
    params.dialect,
    params.entityContext,
    params.dataVolumes,
  );

  const response = await provider.chat({
    messages,
    temperature: 0.3,
    maxTokens: 8192,
    jsonMode: true,
  });

  try {
    return JSON.parse(response.content) as JPAAnalysisResult;
  } catch {
    // If AI didn't return valid JSON, wrap the text response
    return {
      sqlTranslation: '',
      performanceEstimates: [],
      issues: [],
      recommendations: [],
      summary: response.content,
    };
  }
}
