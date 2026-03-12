import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

// Types
export interface SavedQuery {
  id: string;
  projectId: string;
  title: string;
  sql: string;
  dialect: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQueryInput {
  title: string;
  sql: string;
  dialect: string;
  description?: string;
}

export interface UpdateQueryInput {
  title?: string;
  sql?: string;
  dialect?: string;
  description?: string;
}

// Query keys
const queryKeys = {
  all: ['queries'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (projectId: string) => [...queryKeys.lists(), projectId] as const,
  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.details(), id] as const,
};

/**
 * Fetch all saved queries for a project.
 */
export function useSavedQueries(projectId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/queries`
      );
      return response as unknown as SavedQuery[];
    },
    enabled: !!projectId,
  });
}

/**
 * Save a new query to a project.
 */
export function useSaveQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateQueryInput;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/queries`,
        data
      );
      return response as unknown as SavedQuery;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Update an existing query.
 */
export function useUpdateQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      queryId,
      data,
    }: {
      projectId: string;
      queryId: string;
      data: UpdateQueryInput;
    }) => {
      const response = await apiClient.patch(
        `/projects/${projectId}/queries/${queryId}`,
        data
      );
      return response as unknown as SavedQuery;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.list(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.detail(variables.queryId),
      });
    },
  });
}

/**
 * Delete a saved query.
 */
export function useDeleteQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      queryId,
    }: {
      projectId: string;
      queryId: string;
    }) => {
      await apiClient.delete(
        `/projects/${projectId}/queries/${queryId}`
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.list(variables.projectId),
      });
    },
  });
}
