import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SandboxTableResult {
  tableName: string;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  error?: string;
}

export interface SandboxExecuteResult {
  tables: SandboxTableResult[];
  totalDurationMs: number;
}

export interface SandboxStatusResult {
  exists: boolean;
  tables: Array<{ tableName: string; rowCount: number }>;
}

export interface SandboxQueryResult {
  rows: Record<string, unknown>[];
  totalCount: number;
  columns: string[];
}

export interface SandboxPromoteResult {
  tables: Array<{ tableName: string; rowCount: number; status: string; error?: string }>;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const sandboxKeys = {
  all: (projectId: string) => ['sandbox', projectId] as const,
  status: (projectId: string) => [...sandboxKeys.all(projectId), 'status'] as const,
  table: (projectId: string, tableName: string, page: number) =>
    [...sandboxKeys.all(projectId), 'table', tableName, page] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useSandboxStatus(projectId: string | undefined) {
  return useQuery({
    queryKey: sandboxKeys.status(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/sandbox/status`
      );
      return response as unknown as SandboxStatusResult;
    },
    enabled: !!projectId,
    refetchInterval: false,
  });
}

export function useSandboxTable(
  projectId: string | undefined,
  tableName: string | undefined,
  page: number = 1,
  limit: number = 50
) {
  return useQuery({
    queryKey: sandboxKeys.table(projectId!, tableName!, page),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/sandbox/tables/${tableName}`,
        { params: { page, limit } }
      );
      return response as unknown as SandboxQueryResult;
    },
    enabled: !!projectId && !!tableName,
  });
}

export function useExecuteSandbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      sql: string;
      tableNames: string[];
      tableColumns?: Array<{
        tableName: string;
        columns: Array<{ name: string; type: string; isPrimaryKey?: boolean }>;
      }>;
    }) => {
      const response = await apiClient.post(
        `/projects/${data.projectId}/sandbox/execute`,
        { sql: data.sql, tableNames: data.tableNames, tableColumns: data.tableColumns }
      );
      return response as unknown as SandboxExecuteResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: sandboxKeys.all(variables.projectId),
      });
    },
  });
}

export function useCleanupSandbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiClient.delete(
        `/projects/${projectId}/sandbox`
      );
      return response as unknown as { dropped: boolean };
    },
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({
        queryKey: sandboxKeys.all(projectId),
      });
    },
  });
}

export interface CleanupPromotedResult {
  tables: Array<{ tableName: string; status: string; error?: string }>;
}

export function useCleanupPromoted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      tableNames: string[];
    }) => {
      const response = await apiClient.post(
        `/projects/${data.projectId}/sandbox/cleanup-promoted`,
        { tableNames: data.tableNames }
      );
      return response as unknown as CleanupPromotedResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: sandboxKeys.all(variables.projectId),
      });
    },
  });
}

export function usePromoteSandbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      tableNames: string[];
    }) => {
      const response = await apiClient.post(
        `/projects/${data.projectId}/sandbox/promote`,
        { tableNames: data.tableNames }
      );
      return response as unknown as SandboxPromoteResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: sandboxKeys.all(variables.projectId),
      });
    },
  });
}
