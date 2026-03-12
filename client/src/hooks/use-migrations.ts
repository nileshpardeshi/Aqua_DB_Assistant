import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

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

export interface ConvertDialectResult {
  sql: string;
  changes: ConversionChange[];
  sourceDialect: string;
  targetDialect: string;
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
