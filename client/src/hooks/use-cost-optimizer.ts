import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import { trackAIUsage } from '@/lib/ai-usage-tracker';

// ── Types ────────────────────────────────────────────────────────────

export interface CloudConfig {
  provider: string;
  service: string;
  instanceType: string;
  region: string;
  monthlyCost: number;
  storageGB: number;
  computeHours: number;
  reservedInstances: boolean;
  multiAZ: boolean;
  readReplicas: number;
}

export interface QueryPatterns {
  topQueries: Array<{ description: string; frequency: string; avgDuration: string; scanType: string }>;
  avgQueryCost: number;
  fullTableScans: number;
  queryVolume: number;
  peakHours: string;
  slowQueryThreshold: string;
}

export interface StorageProfile {
  totalStorageGB: number;
  dataGrowthRateGB: number;
  unusedTables: string;
  largestTables: string;
  archiveCandidates: string;
  compressionEnabled: boolean;
}

export interface IndexProfile {
  totalIndexes: number;
  unusedIndexes: number;
  duplicateIndexes: number;
  missingIndexes: number;
  indexSizeGB: number;
}

export interface CostAssessment {
  id: string;
  projectId: string;
  name: string;
  cloudConfig: string;
  queryPatterns: string;
  storageProfile: string;
  indexProfile: string;
  analysis: string | null;
  monthlySavings: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostAnalysis {
  executiveSummary: {
    currentMonthlyCost: number;
    estimatedMonthlySavings: number;
    savingsPercentage: number;
    annualSavingsProjection: number;
    headline: string;
    topCostDrivers: Array<{ driver: string; monthlyCost: number; percentage: number; category: string }>;
    quickWins: Array<{ action: string; monthlySavings: number; effort: string; timeframe: string }>;
  };
  costBreakdown: {
    categories: Array<{ name: string; currentCost: number; optimizedCost: number; savings: number; percentage: number }>;
    byTable: Array<{ tableName: string; estimatedCost: number; costDrivers: string[]; savingsPotential: number }>;
    wasteIdentification: Array<{ type: string; description: string; monthlyCost: number; recommendation: string }>;
  };
  queryCostAnalysis: {
    expensiveQueries: Array<{
      description: string; estimatedMonthlyCost: number; frequency: string; issue: string;
      currentBehavior: string; optimization: string; estimatedSavings: number; sqlHint: string;
    }>;
    fullTableScans: Array<{ table: string; queryPattern: string; estimatedCost: number; fix: string }>;
  };
  storageOptimization: {
    currentStorageGB: number; optimizedStorageGB: number; storageSavings: number;
    recommendations: Array<{
      type: string; target: string; currentSizeGB: number; savingGB: number;
      monthlySavings: number; implementation: string; risk: string;
    }>;
    unusedTables: Array<{ tableName: string; sizeGB: number; lastAccessed: string; monthlyCost: number; recommendation: string }>;
  };
  indexOptimization: {
    unusedIndexes: Array<{ indexName: string; tableName: string; sizeGB: number; writeOverhead: string; recommendation: string; monthlySavings: number }>;
    duplicateIndexes: Array<{ indexes: string[]; tableName: string; recommendation: string; monthlySavings: number }>;
    missingIndexes: Array<{ tableName: string; columns: string[]; reason: string; createStatement: string; estimatedSavings: number }>;
  };
  rightSizing: {
    compute: { currentInstance: string; recommendedInstance: string; currentCost: number; recommendedCost: number; monthlySavings: number; justification: string; risk: string };
    reservedInstances: { currentCommitment: string; recommendedCommitment: string; monthlySavings: number; upfrontCost: number; breakEvenMonths: number; justification: string };
    storageTier: { currentTier: string; recommendation: string; monthlySavings: number; details: string };
    readReplicas: { current: number; recommended: number; monthlySavings: number; justification: string };
  };
  actionPlan: Array<{
    priority: number; category: string; title: string; description: string;
    monthlySavings: number; effort: string; risk: string; timeline: string; implementation: string;
  }>;
}

// ── Query Keys ───────────────────────────────────────────────────────

const costKeys = {
  all: ['cost-optimizer'] as const,
  lists: () => [...costKeys.all, 'list'] as const,
  list: (projectId: string) => [...costKeys.lists(), projectId] as const,
  details: () => [...costKeys.all, 'detail'] as const,
  detail: (id: string) => [...costKeys.details(), id] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────

export function useCostAssessments(projectId?: string) {
  return useQuery({
    queryKey: costKeys.list(projectId || ''),
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${projectId}/cost-optimizer`);
      return res as unknown as CostAssessment[];
    },
    enabled: !!projectId,
  });
}

export function useCreateCostAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: string; name: string;
      cloudConfig: CloudConfig; queryPatterns: QueryPatterns;
      storageProfile: StorageProfile; indexProfile: IndexProfile;
    }) => {
      const res = await apiClient.post(`/projects/${data.projectId}/cost-optimizer`, {
        name: data.name, cloudConfig: data.cloudConfig, queryPatterns: data.queryPatterns,
        storageProfile: data.storageProfile, indexProfile: data.indexProfile,
      });
      return res as unknown as CostAssessment;
    },
    onSuccess: (_, variables) => { queryClient.invalidateQueries({ queryKey: costKeys.list(variables.projectId) }); },
  });
}

export function useDeleteCostAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      await apiClient.delete(`/projects/${projectId}/cost-optimizer/${id}`);
    },
    onSuccess: (_, variables) => { queryClient.invalidateQueries({ queryKey: costKeys.list(variables.projectId) }); },
  });
}

export function useAnalyzeCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assessmentId, projectId }: { assessmentId: string; projectId: string }) => {
      const res = await apiClient.post(`/projects/${projectId}/cost-optimizer/${assessmentId}/analyze`);
      const raw = res as unknown as {
        assessment: CostAssessment; analysis: CostAnalysis;
        usage: { inputTokens: number; outputTokens: number }; model: string;
      };
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'cost-optimizer');
      return raw;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: costKeys.detail(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: costKeys.list(variables.projectId) });
    },
  });
}
