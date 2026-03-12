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
  originalQuery: string;
  optimizedQuery: string;
  suggestions: Array<{
    type: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  estimatedImprovement: string;
}

export interface GeneratedSQL {
  query: string;
  explanation: string;
  warnings: string[];
}

export interface QueryExplanation {
  summary: string;
  steps: Array<{
    step: number;
    operation: string;
    description: string;
    tables: string[];
  }>;
  suggestedIndexes: string[];
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
 */
export function useOptimizeQuery() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      query: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/optimize', input);
      return response as unknown as QueryOptimization;
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
      prompt: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/generate', input);
      return response as unknown as GeneratedSQL;
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
      query: string;
      dialect?: string;
    }) => {
      const response = await apiClient.post('/ai/query/explain', input);
      return response as unknown as QueryExplanation;
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
