import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export type DiagramType = 'er-full' | 'er-compact' | 'dependency-graph' | 'schema-group';

export interface SavedDiagram {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  diagramType: DiagramType;
  includedTables?: string | null;
  nodePositions?: string | null;
  layoutDirection: string;
  showColumns: boolean;
  showLabels: boolean;
  colorBySchema: boolean;
  annotations?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiagramInput {
  name: string;
  description?: string;
  diagramType: DiagramType;
  includedTables?: string[];
  nodePositions?: Record<string, { x: number; y: number }>;
  layoutDirection?: string;
  showColumns?: boolean;
  showLabels?: boolean;
  colorBySchema?: boolean;
  annotations?: Array<{ id: string; x: number; y: number; text: string; color: string }>;
  isDefault?: boolean;
}

export interface UpdateDiagramInput {
  name?: string;
  description?: string;
  diagramType?: DiagramType;
  includedTables?: string[] | null;
  nodePositions?: Record<string, { x: number; y: number }> | null;
  layoutDirection?: string;
  showColumns?: boolean;
  showLabels?: boolean;
  colorBySchema?: boolean;
  annotations?: Array<{ id: string; x: number; y: number; text: string; color: string }> | null;
  isDefault?: boolean;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const diagramKeys = {
  all: ['saved-diagrams'] as const,
  lists: () => [...diagramKeys.all, 'list'] as const,
  list: (projectId: string) => [...diagramKeys.lists(), projectId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useSavedDiagrams(projectId: string | undefined) {
  return useQuery({
    queryKey: diagramKeys.list(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(`/projects/${projectId}/saved-diagrams`);
      return response as unknown as SavedDiagram[];
    },
    enabled: !!projectId,
  });
}

export function useCreateDiagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: CreateDiagramInput }) => {
      const response = await apiClient.post(`/projects/${projectId}/saved-diagrams`, data);
      return response as unknown as SavedDiagram;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: diagramKeys.list(variables.projectId) });
    },
  });
}

export function useUpdateDiagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId, diagramId, data,
    }: { projectId: string; diagramId: string; data: UpdateDiagramInput }) => {
      const response = await apiClient.patch(`/projects/${projectId}/saved-diagrams/${diagramId}`, data);
      return response as unknown as SavedDiagram;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: diagramKeys.list(variables.projectId) });
    },
  });
}

export function useDeleteDiagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, diagramId }: { projectId: string; diagramId: string }) => {
      await apiClient.delete(`/projects/${projectId}/saved-diagrams/${diagramId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: diagramKeys.list(variables.projectId) });
    },
  });
}

export function useDuplicateDiagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, diagramId }: { projectId: string; diagramId: string }) => {
      const response = await apiClient.post(`/projects/${projectId}/saved-diagrams/${diagramId}/duplicate`, {});
      return response as unknown as SavedDiagram;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: diagramKeys.list(variables.projectId) });
    },
  });
}
