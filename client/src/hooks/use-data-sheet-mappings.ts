import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedDataSheetMapping {
  id: string;
  projectId: string;
  name: string;
  sourceTableName: string;
  csvFileName: string;
  mappings: string; // JSON string of DataSheetMapping[]
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataSheetMappingInput {
  name: string;
  sourceTableName: string;
  csvFileName: string;
  mappings: string;
}

export interface UpdateDataSheetMappingInput {
  name?: string;
  sourceTableName?: string;
  csvFileName?: string;
  mappings?: string;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const dataSheetMappingKeys = {
  all: ['data-sheet-mappings'] as const,
  lists: () => [...dataSheetMappingKeys.all, 'list'] as const,
  list: (projectId: string) =>
    [...dataSheetMappingKeys.lists(), projectId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch all saved data sheet mappings for a project.
 */
export function useDataSheetMappings(projectId: string | undefined) {
  return useQuery({
    queryKey: dataSheetMappingKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/data-sheet-mappings`,
      );
      return response as unknown as SavedDataSheetMapping[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new data sheet mapping configuration.
 */
export function useCreateDataSheetMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateDataSheetMappingInput;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/data-sheet-mappings`,
        data,
      );
      return response as unknown as SavedDataSheetMapping;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: dataSheetMappingKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Update an existing data sheet mapping configuration.
 */
export function useUpdateDataSheetMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      mappingId,
      data,
    }: {
      projectId: string;
      mappingId: string;
      data: UpdateDataSheetMappingInput;
    }) => {
      const response = await apiClient.patch(
        `/projects/${projectId}/data-sheet-mappings/${mappingId}`,
        data,
      );
      return response as unknown as SavedDataSheetMapping;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: dataSheetMappingKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Delete a data sheet mapping configuration.
 */
export function useDeleteDataSheetMapping() {
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
        `/projects/${projectId}/data-sheet-mappings/${mappingId}`,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: dataSheetMappingKeys.list(variables.projectId),
      });
    },
  });
}
