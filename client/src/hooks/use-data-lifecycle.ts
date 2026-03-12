import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

// Types
export interface DataLifecycleRule {
  id: string;
  projectId: string;
  tableName: string;
  retentionPeriod: number;
  retentionUnit: 'days' | 'months' | 'years';
  retentionColumn: string;
  condition?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleInput {
  projectId: string;
  tableName: string;
  retentionPeriod: number;
  retentionUnit: 'days' | 'months' | 'years';
  retentionColumn: string;
  condition?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  active: boolean;
}

export interface UpdateRuleInput {
  tableName?: string;
  retentionPeriod?: number;
  retentionUnit?: 'days' | 'months' | 'years';
  retentionColumn?: string;
  condition?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  active?: boolean;
}

export interface PurgeScript {
  sql: string;
  estimatedRows: number;
  tableName: string;
  batchSize: number;
  dryRun: boolean;
}

// Query keys
const lifecycleKeys = {
  all: ['data-lifecycle'] as const,
  lists: () => [...lifecycleKeys.all, 'list'] as const,
  list: (projectId: string) => [...lifecycleKeys.lists(), projectId] as const,
  details: () => [...lifecycleKeys.all, 'detail'] as const,
  detail: (projectId: string, ruleId: string) =>
    [...lifecycleKeys.details(), projectId, ruleId] as const,
};

// Hooks

/**
 * Fetch all data lifecycle rules for a project.
 */
export function useDataLifecycleRules(projectId: string | undefined) {
  return useQuery({
    queryKey: lifecycleKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/data-lifecycle`
      );
      return response as unknown as DataLifecycleRule[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new data lifecycle rule.
 */
export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const response = await apiClient.post(
        `/projects/${input.projectId}/data-lifecycle`,
        input
      );
      return response as unknown as DataLifecycleRule;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: lifecycleKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Update a data lifecycle rule.
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      ruleId,
      data,
    }: {
      projectId: string;
      ruleId: string;
      data: UpdateRuleInput;
    }) => {
      const response = await apiClient.patch(
        `/projects/${projectId}/data-lifecycle/${ruleId}`,
        data
      );
      return response as unknown as DataLifecycleRule;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: lifecycleKeys.detail(variables.projectId, variables.ruleId),
      });
      queryClient.invalidateQueries({
        queryKey: lifecycleKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Delete a data lifecycle rule.
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      ruleId,
    }: {
      projectId: string;
      ruleId: string;
    }) => {
      await apiClient.delete(
        `/projects/${projectId}/data-lifecycle/${ruleId}`
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: lifecycleKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Generate a purge script for a given rule.
 */
export function useGeneratePurgeScript() {
  return useMutation({
    mutationFn: async ({
      projectId,
      ruleId,
      batchSize,
      dryRun,
    }: {
      projectId: string;
      ruleId: string;
      batchSize: number;
      dryRun: boolean;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/data-lifecycle/${ruleId}/purge-script`,
        { batchSize, dryRun }
      );
      return response as unknown as PurgeScript;
    },
  });
}
