import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import { trackAIUsage } from '@/lib/ai-usage-tracker';

// ── Types (aligned with Prisma Migration model) ─────────────────────────────

export interface Migration {
  id: string;
  projectId: string;
  version: string;
  title: string;
  description: string | null;
  upSQL: string;
  downSQL: string | null;
  status: string; // draft | pending | running | completed | failed | rolled_back
  appliedAt: string | null;
  sourceDialect: string;
  targetDialect: string;
  checksum: string;
  dependsOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMigrationInput {
  projectId: string;
  version: string;
  title: string;
  description?: string;
  upSQL: string;
  downSQL?: string;
  status?: string;
  sourceDialect: string;
  targetDialect: string;
  dependsOn?: string;
}

export interface UpdateMigrationInput {
  title?: string;
  description?: string;
  upSQL?: string;
  downSQL?: string;
  status?: string;
  appliedAt?: string;
  dependsOn?: string;
}

export interface ConvertDialectInput {
  projectId: string;
  sourceDialect: string;
  targetDialect: string;
  sql: string;
}

export interface ConversionChange {
  original: string;
  converted: string;
  reason: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'data_type' | 'syntax' | 'feature' | 'naming' | 'constraint';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export interface AIValidationResult {
  valid: boolean;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    line?: number;
    suggestion?: string;
  }>;
  overallAssessment: string;
  compatibilityScore: number;
  correctedSql?: string;
}

export interface ConvertDialectResult {
  sql: string;
  changes: ConversionChange[];
  sourceDialect: string;
  targetDialect: string;
  validation?: ValidationResult;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const migrationKeys = {
  all: ['migrations'] as const,
  lists: () => [...migrationKeys.all, 'list'] as const,
  list: (projectId: string) => [...migrationKeys.lists(), projectId] as const,
  details: () => [...migrationKeys.all, 'detail'] as const,
  detail: (projectId: string, migrationId: string) =>
    [...migrationKeys.details(), projectId, migrationId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch all migrations for a project.
 */
export function useMigrations(projectId: string | undefined) {
  return useQuery({
    queryKey: migrationKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/migrations`
      );
      return response as unknown as Migration[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single migration.
 */
export function useMigration(
  projectId: string | undefined,
  migrationId: string | undefined
) {
  return useQuery({
    queryKey: migrationKeys.detail(projectId!, migrationId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/migrations/${migrationId}`
      );
      return response as unknown as Migration;
    },
    enabled: !!projectId && !!migrationId,
  });
}

/**
 * Create a new migration.
 */
export function useCreateMigration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMigrationInput) => {
      const response = await apiClient.post(
        `/projects/${input.projectId}/migrations`,
        {
          version: input.version,
          title: input.title,
          description: input.description,
          upSQL: input.upSQL,
          downSQL: input.downSQL,
          status: input.status,
          sourceDialect: input.sourceDialect,
          targetDialect: input.targetDialect,
          dependsOn: input.dependsOn,
        }
      );
      return response as unknown as Migration;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: migrationKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Update a migration.
 */
export function useUpdateMigration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      migrationId,
      data,
    }: {
      projectId: string;
      migrationId: string;
      data: UpdateMigrationInput;
    }) => {
      const response = await apiClient.patch(
        `/projects/${projectId}/migrations/${migrationId}`,
        data
      );
      return response as unknown as Migration;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: migrationKeys.detail(variables.projectId, variables.migrationId),
      });
      queryClient.invalidateQueries({
        queryKey: migrationKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Delete a migration.
 */
export function useDeleteMigration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      migrationId,
    }: {
      projectId: string;
      migrationId: string;
    }) => {
      await apiClient.delete(
        `/projects/${projectId}/migrations/${migrationId}`
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: migrationKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Convert SQL between dialects.
 */
export function useConvertDialect() {
  return useMutation({
    mutationFn: async (input: ConvertDialectInput) => {
      const response = await apiClient.post(
        `/projects/${input.projectId}/migrations/convert`,
        {
          sql: input.sql,
          sourceDialect: input.sourceDialect,
          targetDialect: input.targetDialect,
        }
      );
      return response as unknown as ConvertDialectResult;
    },
  });
}

/**
 * AI-powered validation of converted SQL.
 */
export function useAIValidateConversion() {
  return useMutation({
    mutationFn: async (input: {
      sql: string;
      sourceDialect: string;
      targetDialect: string;
    }) => {
      const response = await apiClient.post(
        '/ai/migration/validate-conversion',
        input,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = response as unknown as Record<string, any>;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'migration');
      const v = (raw.validation ?? {}) as Partial<AIValidationResult>;
      return {
        valid: v.valid ?? false,
        issues: Array.isArray(v.issues) ? v.issues : [],
        overallAssessment: v.overallAssessment ?? 'Unable to parse AI response',
        compatibilityScore: v.compatibilityScore ?? 0,
        correctedSql: typeof v.correctedSql === 'string' ? v.correctedSql : undefined,
      } as AIValidationResult;
    },
  });
}
