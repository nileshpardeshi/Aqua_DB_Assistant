import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedColumnMapping {
  id: string;
  projectId: string;
  name: string;
  sourceTableName: string;
  targetTableName: string;
  sourceDialect: string;
  targetDialect: string;
  mappings: string; // JSON string of ColumnMapping[]
  createdAt: string;
  updatedAt: string;
}

export interface CreateColumnMappingInput {
  name: string;
  sourceTableName: string;
  targetTableName: string;
  sourceDialect: string;
  targetDialect: string;
  mappings: string;
}

export interface UpdateColumnMappingInput {
  name?: string;
  sourceTableName?: string;
  targetTableName?: string;
  sourceDialect?: string;
  targetDialect?: string;
  mappings?: string;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const columnMappingKeys = {
  all: ['column-mappings'] as const,
  lists: () => [...columnMappingKeys.all, 'list'] as const,
  list: (projectId: string) =>
    [...columnMappingKeys.lists(), projectId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch all saved column mappings for a project.
 */
export function useColumnMappings(projectId: string | undefined) {
  return useQuery({
    queryKey: columnMappingKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/column-mappings`,
      );
      return response as unknown as SavedColumnMapping[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new column mapping configuration.
 */
export function useCreateColumnMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateColumnMappingInput;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/column-mappings`,
        data,
      );
      return response as unknown as SavedColumnMapping;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: columnMappingKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Update an existing column mapping configuration.
 */
export function useUpdateColumnMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      mappingId,
      data,
    }: {
      projectId: string;
      mappingId: string;
      data: UpdateColumnMappingInput;
    }) => {
      const response = await apiClient.patch(
        `/projects/${projectId}/column-mappings/${mappingId}`,
        data,
      );
      return response as unknown as SavedColumnMapping;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: columnMappingKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Delete a column mapping configuration.
 */
export function useDeleteColumnMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      mappingId,
    }: {
      projectId: string;
      mappingId: string;
    }) => {
      await apiClient.delete(
        `/projects/${projectId}/column-mappings/${mappingId}`,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: columnMappingKeys.list(variables.projectId),
      });
    },
  });
}
