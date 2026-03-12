import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '../lib/api-client';

// Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  dialect: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tableCount?: number;
  queryCount?: number;
  fileCount?: number;
  conversationCount?: number;
}

export interface GlobalStats {
  projects: number;
  tables: number;
  queries: number;
  conversations: number;
}

export interface ProjectStats {
  projectId: string;
  tables: number;
  queries: number;
  files: number;
  conversations: number;
}

export interface ProjectFilters {
  search?: string;
  dialect?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  dialect: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  dialect?: string;
  status?: string;
}

// Query keys
const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  stats: (id: string) => [...projectKeys.all, 'stats', id] as const,
  globalStats: () => [...projectKeys.all, 'global-stats'] as const,
};

// Hooks

/**
 * Fetch all projects with optional filters.
 */
export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.dialect) params.set('dialect', filters.dialect);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.sortBy) params.set('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

      const query = params.toString();
      const url = query ? `/projects?${query}` : '/projects';
      const response = await apiClient.get(url);
      return response as unknown as Project[];
    },
  });
}

/**
 * Fetch global stats across all active projects.
 */
export function useGlobalStats() {
  return useQuery({
    queryKey: projectKeys.globalStats(),
    queryFn: async () => {
      const response = await apiClient.get('/projects/stats/global');
      return response as unknown as GlobalStats;
    },
  });
}

/**
 * Fetch stats for a specific project.
 */
export function useProjectStats(projectId: string | null | undefined) {
  return useQuery({
    queryKey: projectKeys.stats(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(`/projects/${projectId}/stats`);
      return response as unknown as ProjectStats;
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single project by ID.
 */
export function useProject(id: string | null | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id!),
    queryFn: async () => {
      const response = await apiClient.get(`/projects/${id}`);
      return response as unknown as Project;
    },
    enabled: !!id,
  });
}

/**
 * Create a new project.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const response = await apiClient.post('/projects', input);
      return response as unknown as Project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.globalStats() });
      toast.success(`Project "${project.name}" created`);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Failed to create project');
    },
  });
}

/**
 * Update an existing project.
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateProjectInput;
    }) => {
      const response = await apiClient.patch(`/projects/${id}`, data);
      return response as unknown as Project;
    },
    onSuccess: (project, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.globalStats() });
      toast.success(`Project "${project.name}" updated`);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Failed to update project');
    },
  });
}

/**
 * Archive (soft-delete) a project.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/projects/${id}`);
      return response as unknown as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.globalStats() });
      toast.success('Project archived');
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Failed to archive project');
    },
  });
}
