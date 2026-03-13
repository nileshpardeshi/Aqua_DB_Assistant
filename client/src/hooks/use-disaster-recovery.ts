import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import { trackAIUsage } from '@/lib/ai-usage-tracker';

// ── Types ────────────────────────────────────────────────────────────

export interface DRInfrastructure {
  provider: string;
  regions: string[];
  dbEngine: string;
  dbVersion: string;
  dbSizeGB: number;
  tableCount: number;
  avgTPS: number;
  peakTPS: number;
  haEnabled: boolean;
  clusterType: string;
}

export interface DRBackupConfig {
  strategy: string;
  fullBackupFreq: string;
  incrBackupFreq: string;
  retentionDays: number;
  backupLocation: string;
  backupEncrypted: boolean;
  lastBackupTest: string;
}

export interface DRReplicationConfig {
  type: string;
  topology: string;
  replicaCount: number;
  replicaRegions: string[];
  lagToleranceSec: number;
  autoFailover: boolean;
}

export interface DRCompliance {
  industry: string;
  regulations: string[];
  targetRTO_min: number;
  targetRPO_min: number;
  dataClassification: string;
  drTestFrequency: string;
}

export interface DRAssessment {
  id: string;
  projectId: string;
  name: string;
  infrastructure: string;
  backupConfig: string;
  replicationConfig: string;
  compliance: string;
  strategy: string | null;
  riskScore: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DRStrategy {
  executiveSummary: {
    overallRiskLevel: string;
    riskScore: number;
    headline: string;
    keyFindings: string[];
    criticalGaps: string[];
  };
  riskAssessment: {
    categories: Array<{
      name: string;
      score: number;
      level: string;
      details: string;
    }>;
    vulnerabilities: Array<{
      severity: string;
      category: string;
      description: string;
      mitigation: string;
    }>;
  };
  failoverPlan: {
    strategy: string;
    strategyJustification: string;
    steps: Array<{
      order: number;
      phase: string;
      action: string;
      estimatedTime: string;
      responsible: string;
      automated: boolean;
      details: string;
    }>;
    estimatedRTO: string;
    estimatedRPO: string;
    meetsTargetRTO: boolean;
    meetsTargetRPO: boolean;
    automationLevel: string;
    rollbackPlan: string;
  };
  backupPolicy: {
    recommended: {
      fullFrequency: string;
      incrementalFrequency: string;
      retentionDays: number;
      backupLocations: string[];
      encryption: string;
      testingFrequency: string;
      walArchiving: boolean;
    };
    gaps: Array<{
      aspect: string;
      current: string;
      recommended: string;
      priority: string;
      impact: string;
    }>;
  };
  complianceReport: {
    overallStatus: string;
    regulations: Array<{
      name: string;
      status: string;
      score: number;
      requirements: string[];
      gaps: string[];
      remediation: string[];
    }>;
  };
  architecture: {
    recommended: {
      primary: { region: string; role: string; engine: string };
      replicas: Array<{
        region: string;
        role: string;
        replicationType: string;
        purpose: string;
      }>;
      backupTargets: Array<{
        type: string;
        location: string;
        frequency: string;
        retention: string;
      }>;
    };
    dataFlow: string;
  };
  recommendations: Array<{
    priority: string;
    category: string;
    title: string;
    description: string;
    impact: string;
    effort: string;
    timeline: string;
  }>;
  drTestPlan: {
    frequency: string;
    testTypes: Array<{
      name: string;
      frequency: string;
      description: string;
      successCriteria: string[];
    }>;
  };
}

// ── Query Keys ───────────────────────────────────────────────────────

const drKeys = {
  all: ['disaster-recovery'] as const,
  lists: () => [...drKeys.all, 'list'] as const,
  list: (projectId: string) => [...drKeys.lists(), projectId] as const,
  details: () => [...drKeys.all, 'detail'] as const,
  detail: (id: string) => [...drKeys.details(), id] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────

export function useDRAssessments(projectId?: string) {
  return useQuery({
    queryKey: drKeys.list(projectId || ''),
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${projectId}/dr`);
      return res as unknown as DRAssessment[];
    },
    enabled: !!projectId,
  });
}

export function useDRAssessment(assessmentId?: string, projectId?: string) {
  return useQuery({
    queryKey: drKeys.detail(assessmentId || ''),
    queryFn: async () => {
      const res = await apiClient.get(
        `/projects/${projectId}/dr/${assessmentId}`,
      );
      return res as unknown as DRAssessment;
    },
    enabled: !!assessmentId && !!projectId,
  });
}

export function useCreateDRAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      name: string;
      infrastructure: DRInfrastructure;
      backupConfig: DRBackupConfig;
      replicationConfig: DRReplicationConfig;
      compliance: DRCompliance;
    }) => {
      const res = await apiClient.post(`/projects/${data.projectId}/dr`, {
        name: data.name,
        infrastructure: data.infrastructure,
        backupConfig: data.backupConfig,
        replicationConfig: data.replicationConfig,
        compliance: data.compliance,
      });
      return res as unknown as DRAssessment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: drKeys.list(variables.projectId),
      });
    },
  });
}

export function useUpdateDRAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      ...data
    }: Partial<{
      name: string;
      infrastructure: DRInfrastructure;
      backupConfig: DRBackupConfig;
      replicationConfig: DRReplicationConfig;
      compliance: DRCompliance;
      status: string;
    }> & { id: string; projectId: string }) => {
      const res = await apiClient.patch(`/projects/${projectId}/dr/${id}`, data);
      return res as unknown as DRAssessment;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: drKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: drKeys.list(variables.projectId),
      });
    },
  });
}

export function useDeleteDRAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      await apiClient.delete(`/projects/${projectId}/dr/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: drKeys.list(variables.projectId),
      });
    },
  });
}

export function useAnalyzeDR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assessmentId,
      projectId,
    }: {
      assessmentId: string;
      projectId: string;
    }) => {
      const res = await apiClient.post(
        `/projects/${projectId}/dr/${assessmentId}/analyze`,
      );
      const raw = res as unknown as {
        assessment: DRAssessment;
        strategy: DRStrategy;
        usage: { inputTokens: number; outputTokens: number };
        model: string;
      };
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'dr');
      return raw;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: drKeys.detail(variables.assessmentId),
      });
      queryClient.invalidateQueries({
        queryKey: drKeys.list(variables.projectId),
      });
    },
  });
}
