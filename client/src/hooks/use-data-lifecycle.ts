import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

// ── Types matching backend Prisma model ─────────────────────────────────────

export interface RuleCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IS NULL' | 'IS NOT NULL' | 'LIKE' | 'IN';
  value: string;
  conjunction: 'AND' | 'OR';
}

export interface RuleConfiguration {
  retentionPeriod: number;
  retentionUnit: 'days' | 'months' | 'years';
  retentionColumn: string;
  conditions: RuleCondition[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  cascadeDelete: boolean;
  backupBeforePurge: boolean;
  notifyOnExecution: boolean;
  sqlDialect: string;
}

export interface DataLifecycleRule {
  id: string;
  projectId: string;
  ruleName: string;
  ruleType: string;
  targetTable: string;
  targetColumns: string | null;
  configuration: string; // JSON string of RuleConfiguration
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurgeScriptResult {
  ruleId: string;
  ruleName: string;
  targetTable: string;
  script: string;
  dryRun: boolean;
  batchSize: number;
  dialect: string;
}

// ── Helper to parse configuration ───────────────────────────────────────────

const DEFAULT_CONFIG: RuleConfiguration = {
  retentionPeriod: 90,
  retentionUnit: 'days',
  retentionColumn: 'created_at',
  conditions: [],
  priority: 'medium',
  cascadeDelete: false,
  backupBeforePurge: false,
  notifyOnExecution: false,
  sqlDialect: 'postgresql',
};

export function parseRuleConfig(rule: DataLifecycleRule): RuleConfiguration {
  try {
    const parsed = JSON.parse(rule.configuration);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// ── Query keys ──────────────────────────────────────────────────────────────

const lifecycleKeys = {
  all: ['data-lifecycle'] as const,
  lists: () => [...lifecycleKeys.all, 'list'] as const,
  list: (projectId: string) => [...lifecycleKeys.lists(), projectId] as const,
  details: () => [...lifecycleKeys.all, 'detail'] as const,
  detail: (projectId: string, ruleId: string) =>
    [...lifecycleKeys.details(), projectId, ruleId] as const,
};

// ── Hooks ───────────────────────────────────────────────────────────────────

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

export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      ruleName: string;
      targetTable: string;
      configuration: RuleConfiguration;
      isActive?: boolean;
    }) => {
      const response = await apiClient.post(
        `/projects/${input.projectId}/data-lifecycle`,
        {
          ruleName: input.ruleName,
          ruleType: 'retention',
          targetTable: input.targetTable,
          targetColumns: input.configuration.retentionColumn,
          configuration: JSON.stringify(input.configuration),
          isActive: input.isActive ?? true,
        }
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
      data: {
        ruleName?: string;
        targetTable?: string;
        configuration?: RuleConfiguration;
        isActive?: boolean;
      };
    }) => {
      const payload: Record<string, unknown> = {};
      if (data.ruleName !== undefined) payload.ruleName = data.ruleName;
      if (data.targetTable !== undefined) payload.targetTable = data.targetTable;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.configuration !== undefined) {
        payload.configuration = JSON.stringify(data.configuration);
        payload.targetColumns = data.configuration.retentionColumn;
      }

      const response = await apiClient.patch(
        `/projects/${projectId}/data-lifecycle/${ruleId}`,
        payload
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

export function useGeneratePurgeScript() {
  return useMutation({
    mutationFn: async ({
      projectId,
      ruleId,
      batchSize,
      dryRun,
      dialect,
    }: {
      projectId: string;
      ruleId: string;
      batchSize: number;
      dryRun: boolean;
      dialect?: string;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/data-lifecycle/${ruleId}/generate-purge-script`,
        { batchSize, dryRun, dialect }
      );
      return response as unknown as PurgeScriptResult;
    },
  });
}
