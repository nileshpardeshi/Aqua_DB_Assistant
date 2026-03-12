import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

// Types
export interface Connection {
  id: string;
  projectId: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  dialect: string;
  ssl: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectionInput {
  projectId: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  dialect: string;
  ssl: boolean;
}

export interface UpdateConnectionInput {
  name?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  dialect?: string;
  ssl?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

// Query keys
const connectionKeys = {
  all: ['connections'] as const,
  lists: () => [...connectionKeys.all, 'list'] as const,
  list: (projectId: string) => [...connectionKeys.lists(), projectId] as const,
  details: () => [...connectionKeys.all, 'detail'] as const,
  detail: (projectId: string, connectionId: string) =>
    [...connectionKeys.details(), projectId, connectionId] as const,
};

// Hooks

/**
 * Fetch all connections for a project.
 */
export function useConnections(projectId: string | undefined) {
  return useQuery({
    queryKey: connectionKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/connections`
      );
      return response as unknown as Connection[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new connection.
 */
export function useCreateConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateConnectionInput) => {
      const response = await apiClient.post(
        `/projects/${input.projectId}/connections`,
        input
      );
      return response as unknown as Connection;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: connectionKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Update a connection.
 */
export function useUpdateConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      connectionId,
      data,
    }: {
      projectId: string;
      connectionId: string;
      data: UpdateConnectionInput;
    }) => {
      const response = await apiClient.patch(
        `/projects/${projectId}/connections/${connectionId}`,
        data
      );
      return response as unknown as Connection;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: connectionKeys.detail(variables.projectId, variables.connectionId),
      });
      queryClient.invalidateQueries({
        queryKey: connectionKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Delete a connection.
 */
export function useDeleteConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      connectionId,
    }: {
      projectId: string;
      connectionId: string;
    }) => {
      await apiClient.delete(
        `/projects/${projectId}/connections/${connectionId}`
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: connectionKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Test a connection.
 */
export function useTestConnection() {
  return useMutation({
    mutationFn: async ({
      projectId,
      connectionId,
    }: {
      projectId: string;
      connectionId: string;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/connections/${connectionId}/test`
      );
      return response as unknown as TestConnectionResult;
    },
  });
}
