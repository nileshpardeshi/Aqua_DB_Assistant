import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

// Types
export interface Migration {
  id: string;
  projectId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sourceDialect: string;
  targetDialect: string;
  sourceSql: string;
  targetSql?: string;
  changesLog?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMigrationInput {
  projectId: string;
  name: string;
  sourceDialect: string;
  targetDialect: string;
  sourceSql: string;
}

export interface UpdateMigrationInput {
  name?: string;
  status?: string;
  targetSql?: string;
}

export interface ConvertDialectInput {
  projectId: string;
  sourceDialect: string;
  targetDialect: string;
  sourceSql: string;
}

export interface ConvertDialectResult {
  targetSql: string;
  changesLog: string[];
}

// Query keys
const migrationKeys = {
  all: ['migrations'] as const,
  lists: () => [...migrationKeys.all, 'list'] as const,
  list: (projectId: string) => [...migrationKeys.lists(), projectId] as const,
  details: () => [...migrationKeys.all, 'detail'] as const,
  detail: (projectId: string, migrationId: string) =>
    [...migrationKeys.details(), projectId, migrationId] as const,
};

// Hooks

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
        input
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
        input
      );
      return response as unknown as ConvertDialectResult;
    },
  });
}
