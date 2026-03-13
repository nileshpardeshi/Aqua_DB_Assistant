import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsageFilters {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  module?: string;
  provider?: string;
}

export interface UsageSummary {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  avgTokensPerCall: number;
}

export interface ModuleUsage {
  module: string;
  totalTokens: number;
  totalCost: number;
  totalCalls: number;
}

export interface ProviderUsage {
  provider: string;
  model: string;
  totalTokens: number;
  totalCost: number;
  totalCalls: number;
}

export interface ProjectUsage {
  projectId: string | null;
  projectName?: string | null;
  totalTokens: number;
  totalCost: number;
  totalCalls: number;
}

export interface TopCall {
  id: string;
  module: string;
  endpoint: string;
  provider: string;
  model: string;
  totalTokens: number;
  estimatedCost: number;
  durationMs: number;
  status: string;
  createdAt: string;
}

export interface TrendPoint {
  date: string;
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
}

export interface BudgetConfig {
  id: string;
  projectId: string | null;
  monthlyTokenLimit: number;
  warningThreshold: number;
  isHardLimit: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  project?: { name: string } | null;
}

export interface BudgetStatus {
  allowed: boolean;
  percentUsed: number;
  warning: boolean;
  limit: number;
  used: number;
}

export interface CurrentMonthData {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  budget: BudgetStatus | null;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

function buildParams(filters?: UsageFilters) {
  const params: Record<string, string> = {};
  if (filters?.startDate) params.startDate = filters.startDate;
  if (filters?.endDate) params.endDate = filters.endDate;
  if (filters?.projectId) params.projectId = filters.projectId;
  if (filters?.module) params.module = filters.module;
  if (filters?.provider) params.provider = filters.provider;
  return params;
}

const usageKeys = {
  all: ['ai-usage'] as const,
  summary: (f?: UsageFilters) => [...usageKeys.all, 'summary', f] as const,
  byModule: (f?: UsageFilters) => [...usageKeys.all, 'by-module', f] as const,
  byProvider: (f?: UsageFilters) => [...usageKeys.all, 'by-provider', f] as const,
  byProject: (f?: UsageFilters) => [...usageKeys.all, 'by-project', f] as const,
  topCalls: (limit?: number) => [...usageKeys.all, 'top-calls', limit] as const,
  trend: (days?: number) => [...usageKeys.all, 'trend', days] as const,
  budget: () => [...usageKeys.all, 'budget'] as const,
  currentMonth: (projectId?: string) => [...usageKeys.all, 'current-month', projectId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useAIUsageSummary(filters?: UsageFilters) {
  return useQuery({
    queryKey: usageKeys.summary(filters),
    queryFn: async () => {
      const res = await apiClient.get('/ai-usage/summary', { params: buildParams(filters) });
      return res as unknown as UsageSummary;
    },
  });
}

export function useAIUsageByModule(filters?: UsageFilters) {
  return useQuery({
    queryKey: usageKeys.byModule(filters),
    queryFn: async () => {
      const res = await apiClient.get('/ai-usage/by-module', { params: buildParams(filters) });
      return res as unknown as ModuleUsage[];
    },
  });
}

export function useAIUsageByProvider(filters?: UsageFilters) {
  return useQuery({
    queryKey: usageKeys.byProvider(filters),
    queryFn: async () => {
      const res = await apiClient.get('/ai-usage/by-provider', { params: buildParams(filters) });
      return res as unknown as ProviderUsage[];
    },
  });
}

export function useAIUsageByProject(filters?: UsageFilters) {
  return useQuery({
    queryKey: usageKeys.byProject(filters),
    queryFn: async () => {
      const res = await apiClient.get('/ai-usage/by-project', { params: buildParams(filters) });
      return res as unknown as ProjectUsage[];
    },
  });
}

export function useAIUsageTopCalls(limit = 10) {
  return useQuery({
    queryKey: usageKeys.topCalls(limit),
    queryFn: async () => {
      const res = await apiClient.get('/ai-usage/top-calls', { params: { limit: String(limit) } });
      return res as unknown as TopCall[];
    },
  });
}

export function useAIUsageTrend(days = 30) {
  return useQuery({
    queryKey: usageKeys.trend(days),
    queryFn: async () => {
      const res = await apiClient.get('/ai-usage/trend', { params: { days: String(days) } });
      return res as unknown as TrendPoint[];
    },
  });
}

export function useAIBudget() {
  return useQuery({
    queryKey: usageKeys.budget(),
    queryFn: async () => {
      const res = await apiClient.get('/ai-usage/budget');
      return res as unknown as BudgetConfig[];
    },
  });
}

export function useUpdateAIBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId?: string | null;
      monthlyTokenLimit: number;
      warningThreshold?: number;
      isHardLimit?: boolean;
      isActive?: boolean;
    }) => {
      const res = await apiClient.put('/ai-usage/budget', data);
      return res as unknown as BudgetConfig;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usageKeys.budget() });
      qc.invalidateQueries({ queryKey: usageKeys.all });
    },
  });
}

export function useDeleteAIBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ai-usage/budget/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usageKeys.budget() });
    },
  });
}

export function useCurrentMonthUsage(projectId?: string) {
  return useQuery({
    queryKey: usageKeys.currentMonth(projectId),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (projectId) params.projectId = projectId;
      const res = await apiClient.get('/ai-usage/current-month', { params });
      return res as unknown as CurrentMonthData;
    },
  });
}
