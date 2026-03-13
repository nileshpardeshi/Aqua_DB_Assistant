import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Extracted Query Types ───────────────────────────────────────────────────

export interface ExtractedJPAQuery {
  id: string;
  query: string;
  type: 'jpql' | 'hql' | 'native' | 'criteria';
  methodName: string;
  className: string;
  fileName: string;
  lineNumber: number;
  annotations: string[];
  hasNPlusOne: boolean;
  hasFetchJoin: boolean;
  hasAggregation: boolean;
  hasSubquery: boolean;
  hasPagination: boolean;
  complexity: 'simple' | 'moderate' | 'complex' | 'critical';
}

export interface JPAParseResult {
  fileName: string;
  className: string;
  packageName: string;
  queries: ExtractedJPAQuery[];
  entityImports: string[];
  sourcePreview: string;
}

// ── Analysis Types ──────────────────────────────────────────────────────────

export interface JPAPerformanceEstimate {
  rows: string;
  estimatedTimeMs: number;
  scanType: string;
  joinsUsed: number;
  memoryMB: number;
  rating: 'good' | 'acceptable' | 'warning' | 'critical';
}

export interface JPAIssue {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: string;
}

export interface JPARecommendation {
  title: string;
  description: string;
  before: string;
  after: string;
  estimatedImprovement: string;
}

export interface JPAAnalysisResult {
  sqlTranslation: string;
  performanceEstimates: JPAPerformanceEstimate[];
  issues: JPAIssue[];
  recommendations: JPARecommendation[];
  summary: string;
}

export interface JPAAnalysisInput {
  jpql: string;
  dialect: string;
  entityContext?: string;
  dataVolumes?: number[];
}

// ── Batch Analysis Types ────────────────────────────────────────────────────

export interface BatchQueryResult {
  queryId: string;
  methodName: string;
  sqlTranslation: string;
  performanceEstimates: JPAPerformanceEstimate[];
  issues: JPAIssue[];
  recommendations: JPARecommendation[];
  overallRating: 'good' | 'acceptable' | 'warning' | 'critical';
  executionPlan: string;
}

export interface BatchAnalysisResult {
  analysis: {
    results: BatchQueryResult[];
    summary: string;
  };
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/** Analyze a single JPA/JPQL/HQL query for performance. */
export function useAnalyzeJPA() {
  return useMutation({
    mutationFn: async (input: JPAAnalysisInput) => {
      const response = await apiClient.post('/tools/jpa-analyze', input);
      return response as unknown as JPAAnalysisResult;
    },
  });
}

/** Parse uploaded Java files and extract JPA queries. */
export function useParseJPAFiles() {
  return useMutation({
    mutationFn: async (files: { name: string; content: string }[]) => {
      const response = await apiClient.post('/tools/jpa-parse', { files });
      return response as unknown as JPAParseResult[];
    },
  });
}

/** Load built-in sample JPA files from the server. */
export function useSampleJPAFiles() {
  return useQuery({
    queryKey: ['jpa-samples'],
    queryFn: async () => {
      const response = await apiClient.get('/tools/jpa-samples');
      return response as unknown as { name: string; content: string }[];
    },
    staleTime: Infinity,
  });
}

/** Batch-analyze multiple JPA queries at once. */
export function useBatchAnalyzeJPA() {
  return useMutation({
    mutationFn: async (input: {
      queries: ExtractedJPAQuery[];
      dialect: string;
      entityContext?: string;
    }) => {
      const response = await apiClient.post('/tools/jpa-batch-analyze', input);
      return response as unknown as BatchAnalysisResult;
    },
  });
}
