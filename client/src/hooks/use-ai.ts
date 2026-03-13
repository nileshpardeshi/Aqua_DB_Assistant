import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { trackAIUsage } from '@/lib/ai-usage-tracker';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResponse = Record<string, any>;

// ── Response Normalizers ─────────────────────────────────────────────────────
// AI providers sometimes return keys in different casing (camelCase vs snake_case)
// or slightly different structures. These normalizers ensure the UI always gets
// a consistent shape regardless of what the AI model returns.

function normalizeGeneratedSQL(raw: AnyResponse): GeneratedSQL {
  // Server wraps: { result: {...}, usage, model } → apiClient unwraps { success, data }
  const data = raw.result ?? raw;
  return {
    sql: data.sql ?? data.query ?? data.generated_sql ?? '',
    explanation: data.explanation ?? data.description ?? '',
    assumptions: data.assumptions ?? [],
    alternativeApproaches: data.alternativeApproaches ?? data.alternative_approaches ?? data.alternatives ?? [],
    warnings: data.warnings ?? [],
  };
}

function normalizeOptimization(raw: AnyResponse): QueryOptimization {
  // Server wraps: { optimization: {...}, usage, model }
  const data = raw.optimization ?? raw;
  return {
    optimizedSQL: data.optimizedSQL ?? data.optimized_sql ?? data.optimizedQuery ?? data.sql ?? '',
    changes: (data.changes ?? data.optimizations ?? []).map((c: AnyResponse) => ({
      description: c.description ?? c.change ?? '',
      impact: (c.impact ?? 'MEDIUM').toUpperCase(),
      category: c.category ?? c.type ?? 'QUERY_REWRITE',
    })),
    indexRecommendations: (data.indexRecommendations ?? data.index_recommendations ?? data.indexes ?? []).map((idx: AnyResponse) => ({
      createStatement: idx.createStatement ?? idx.create_statement ?? idx.sql ?? '',
      reason: idx.reason ?? idx.description ?? '',
      estimatedImpact: idx.estimatedImpact ?? idx.estimated_impact ?? idx.impact ?? '',
    })),
    warnings: data.warnings ?? [],
    estimatedImprovement: data.estimatedImprovement ?? data.estimated_improvement ?? data.improvement ?? '',
  };
}

function normalizeExplanation(raw: AnyResponse): QueryExplanation {
  // Server wraps: { explanation: {...}, usage, model }
  const data = raw.explanation ?? raw;
  return {
    summary: data.summary ?? data.description ?? '',
    stepByStep: (data.stepByStep ?? data.step_by_step ?? data.steps ?? []).map((s: AnyResponse) => ({
      clause: s.clause ?? s.step ?? '',
      sql: s.sql ?? s.code ?? '',
      explanation: s.explanation ?? s.description ?? '',
    })),
    tablesUsed: (data.tablesUsed ?? data.tables_used ?? data.tables ?? []).map((t: AnyResponse) => ({
      name: t.name ?? t.table_name ?? '',
      alias: t.alias ?? t.name ?? '',
      role: t.role ?? t.purpose ?? '',
    })),
    outputColumns: (data.outputColumns ?? data.output_columns ?? data.columns ?? []).map((c: AnyResponse) => ({
      expression: c.expression ?? c.column ?? '',
      alias: c.alias ?? '',
      description: c.description ?? '',
    })),
    filters: data.filters ?? data.conditions ?? [],
    performanceNotes: data.performanceNotes ?? data.performance_notes ?? data.notes ?? [],
    complexity: (data.complexity ?? 'MODERATE').toUpperCase() as QueryExplanation['complexity'],
  };
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
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'schema');
      return raw as unknown as SchemaSuggestion;
    },
  });
}

/**
 * Optimize an existing SQL query with AI.
 */
export function useOptimizeQuery() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      sql: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/optimize', input);
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'query');
      return normalizeOptimization(raw);
    },
  });
}

/**
 * Generate SQL from a natural language description.
 */
export function useGenerateSQL() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      naturalLanguage: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/generate', input);
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'query');
      return normalizeGeneratedSQL(raw);
    },
  });
}

/**
 * Explain an SQL query in plain English.
 */
export function useExplainQuery() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      sql: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/explain', input);
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'query');
      return normalizeExplanation(raw);
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
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'schema');
      return raw as unknown as SchemaReview;
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
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'schema');
      return raw.analysis as TriggerAnalysis;
    },
  });
}
