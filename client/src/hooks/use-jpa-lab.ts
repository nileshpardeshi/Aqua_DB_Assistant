import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface JPAPerformanceEstimate {
  rows: string; // "1K", "100K", "1M", "10M"
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

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Analyze a JPA/JPQL/HQL query for performance issues and optimization.
 */
export function useAnalyzeJPA() {
  return useMutation({
    mutationFn: async (input: JPAAnalysisInput) => {
      const response = await apiClient.post('/tools/jpa-analyze', input);
      return response as unknown as JPAAnalysisResult;
    },
  });
}
