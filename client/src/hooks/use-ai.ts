import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SchemaSuggestion {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      dataType: string;
      nullable: boolean;
      isPrimaryKey: boolean;
    }>;
    description: string;
  }>;
  relationships: Array<{
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    type: string;
  }>;
  explanation: string;
}

export interface QueryOptimization {
  optimizedSQL: string;
  changes: Array<{
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
  }>;
  indexRecommendations: Array<{
    createStatement: string;
    reason: string;
    estimatedImpact: string;
  }>;
  warnings: string[];
  estimatedImprovement: string;
}

export interface GeneratedSQL {
  sql: string;
  explanation: string;
  assumptions: string[];
  alternativeApproaches: Array<{
    sql: string;
    description: string;
  }>;
  warnings: string[];
}

export interface QueryExplanation {
  summary: string;
  stepByStep: Array<{
    clause: string;
    sql: string;
    explanation: string;
  }>;
  tablesUsed: Array<{
    name: string;
    alias: string;
    role: string;
  }>;
  outputColumns: Array<{
    expression: string;
    alias: string;
    description: string;
  }>;
  filters: string[];
  performanceNotes: string[];
  complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'VERY_COMPLEX';
}

export interface TriggerAnalysis {
  isValid: boolean;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion: string;
  }>;
  optimizedBody: string | null;
  explanation: string;
  dialectNotes: string;
  bestPractices: string[];
}

export interface SchemaReview {
  score: number;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    table?: string;
    column?: string;
    suggestion: string;
  }>;
  summary: string;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Get AI-powered schema suggestions from a natural language description.
 */
export function useSuggestSchema() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      prompt: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/schema/suggest', input);
      return response as unknown as SchemaSuggestion;
    },
  });
}

/**
 * Optimize an existing SQL query with AI.
 * Backend expects { sql, dialect, projectId }, returns { optimization, usage, model }
 */
export function useOptimizeQuery() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      sql: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/optimize', input);
      const wrapper = response as unknown as { optimization: QueryOptimization };
      return wrapper.optimization;
    },
  });
}

/**
 * Generate SQL from a natural language description.
 * Backend expects { naturalLanguage, dialect, projectId }, returns { result, usage, model }
 */
export function useGenerateSQL() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      naturalLanguage: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/generate', input);
      const wrapper = response as unknown as { result: GeneratedSQL };
      return wrapper.result;
    },
  });
}

/**
 * Explain an SQL query in plain English.
 * Backend expects { sql, dialect, projectId }, returns { explanation, usage, model }
 */
export function useExplainQuery() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      sql: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/explain', input);
      const wrapper = response as unknown as { explanation: QueryExplanation };
      return wrapper.explanation;
    },
  });
}

/**
 * Review a schema for issues and best practices.
 */
export function useReviewSchema() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
    }) => {
      const response = await apiClient.post('/ai/schema/review', input);
      return response as unknown as SchemaReview;
    },
  });
}

/**
 * Analyze a trigger with AI for validation, optimization, and best practices.
 */
export function useAnalyzeTrigger() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      tableId: string;
      triggerName: string;
      timing: string;
      event: string;
      triggerBody: string;
      description?: string;
      dialect: string;
    }) => {
      const response = await apiClient.post('/ai/schema/trigger-analysis', input);
      return (response as unknown as { analysis: TriggerAnalysis }).analysis;
    },
  });
}
