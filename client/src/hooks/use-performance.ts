import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

// Types
export interface PerformanceRun {
  id: string;
  projectId: string;
  type: 'benchmark' | 'data-generation' | 'index-analysis';
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: Record<string, unknown>;
  results?: BenchmarkResults | DataGenResults | IndexAnalysisResults;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkResults {
  iterations: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  distribution: { bucket: string; count: number }[];
}

export interface DataGenResults {
  tableName: string;
  rowsGenerated: number;
  durationMs: number;
  sizeBytes: number;
}

export interface IndexAnalysisResults {
  recommendations: IndexRecommendation[];
}

export interface IndexRecommendation {
  id: string;
  tableName: string;
  columns: string[];
  indexType: string;
  createStatement: string;
  impact: 'high' | 'medium' | 'low';
  reason: string;
  estimatedImprovement: string;
}

export interface CreatePerformanceRunInput {
  projectId: string;
  type: 'benchmark' | 'data-generation' | 'index-analysis';
  name: string;
  config: Record<string, unknown>;
}

// Query keys
const performanceKeys = {
  all: ['performance'] as const,
  lists: () => [...performanceKeys.all, 'list'] as const,
  list: (projectId: string) => [...performanceKeys.lists(), projectId] as const,
  details: () => [...performanceKeys.all, 'detail'] as const,
  detail: (projectId: string, runId: string) =>
    [...performanceKeys.details(), projectId, runId] as const,
};

// Hooks

/**
 * Fetch all performance runs for a project.
 */
export function usePerformanceRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: performanceKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/performance`
      );
      return response as unknown as PerformanceRun[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single performance run.
 */
export function usePerformanceRun(
  projectId: string | undefined,
  runId: string | undefined
) {
  return useQuery({
    queryKey: performanceKeys.detail(projectId!, runId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/performance/${runId}`
      );
      return response as unknown as PerformanceRun;
    },
    enabled: !!projectId && !!runId,
  });
}

/**
 * Create a new performance run.
 */
export function useCreatePerformanceRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePerformanceRunInput) => {
      const response = await apiClient.post(
        `/projects/${input.projectId}/performance`,
        input
      );
      return response as unknown as PerformanceRun;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: performanceKeys.list(variables.projectId),
      });
    },
  });
}
