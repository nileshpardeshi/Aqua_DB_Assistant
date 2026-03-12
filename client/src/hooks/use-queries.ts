import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// Types
export interface SavedQuery {
  id: string;
  projectId: string;
  title: string;
  sql: string;
  dialect: string;
  description?: string | null;
  category?: string | null;
  isFavorite: boolean;
  tags?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQueryInput {
  title: string;
  sql: string;
  dialect: string;
  description?: string;
  category?: string;
  isFavorite?: boolean;
  tags?: string;
}

export interface UpdateQueryInput {
  title?: string;
  sql?: string;
  dialect?: string;
  description?: string;
  category?: string;
  isFavorite?: boolean;
  tags?: string;
}

export interface ExecuteQueryInput {
  sql: string;
  dialect: string;
  savedQueryId?: string;
  status: string;
  rowsAffected?: number;
  rowsReturned?: number;
  executionTime?: number;
  resultPreview?: string;
  explainPlan?: string;
  errorMessage?: string;
}

export interface QueryExecution {
  id: string;
  projectId: string;
  savedQueryId?: string | null;
  sql: string;
  dialect: string;
  status: string;
  rowsAffected?: number | null;
  rowsReturned?: number | null;
  executionTime?: number | null;
  resultPreview?: string | null;
  explainPlan?: string | null;
  errorMessage?: string | null;
  executedAt: string;
}

export interface QueryHistoryItem extends QueryExecution {
  savedQuery?: { id: string; title: string } | null;
}

// Query keys
const queryKeys = {
  all: ['queries'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (projectId: string) => [...queryKeys.lists(), projectId] as const,
  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.details(), id] as const,
  history: (projectId: string) => ['query-history', projectId] as const,
};

/**
 * Fetch all saved queries for a project, with optional filters.
 */
export function useSavedQueries(
  projectId: string | null | undefined,
  filters?: { search?: string; category?: string; isFavorite?: boolean },
) {
  return useQuery({
    queryKey: [...queryKeys.list(projectId!), filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.isFavorite !== undefined)
        params.set('isFavorite', String(filters.isFavorite));
      const qs = params.toString();
      const response = await apiClient.get(
        `/projects/${projectId}/queries${qs ? `?${qs}` : ''}`,
      );
      return response as unknown as SavedQuery[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch query execution history for a project.
 */
export function useQueryHistory(
  projectId: string | null | undefined,
  limit?: number,
) {
  return useQuery({
    queryKey: queryKeys.history(projectId!),
    queryFn: async () => {
      const params = limit ? `?limit=${limit}` : '';
      const response = await apiClient.get(
        `/projects/${projectId}/queries/history${params}`,
      );
      return response as unknown as QueryHistoryItem[];
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
        data,
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
        data,
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
 * Toggle favorite status on a saved query.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      queryId,
      isFavorite,
    }: {
      projectId: string;
      queryId: string;
      isFavorite: boolean;
    }) => {
      const response = await apiClient.patch(
        `/projects/${projectId}/queries/${queryId}`,
        { isFavorite },
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
        `/projects/${projectId}/queries/${queryId}`,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Execute a query and record the execution on the server.
 */
export function useExecuteQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: ExecuteQueryInput;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/queries/execute`,
        data,
      );
      return response as unknown as QueryExecution;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.history(variables.projectId),
      });
    },
  });
}
