import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { trackAIUsage } from '@/lib/ai-usage-tracker';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataVolumeEntry {
  table: string;
  estimatedRows: string;
  batchSize: number;
  estimatedBatches: number;
  estimatedTime: string;
  notes?: string;
}

export interface Incompatibility {
  type: string; // DATA_TYPE | FUNCTION | TRIGGER | CONSTRAINT | SEQUENCE | SYNTAX
  source: string;
  target: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  resolution: string;
}

export interface MigrationStep {
  phase: number;
  title: string;
  description: string;
  estimatedTime: string;
}

export interface BatchStrategy {
  recommendedChunkSize: number;
  parallelism: number;
  estimatedTotalTime: string;
  notes?: string;
}

export interface MigrationAssessment {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedEffort: string;
  summary: string;
  dataVolumeAnalysis: DataVolumeEntry[];
  incompatibilities: Incompatibility[];
  migrationSteps: MigrationStep[];
  batchStrategy: BatchStrategy;
  recommendations: string[];
}

export interface MigrationScript {
  version: string;
  title: string;
  description: string;
  upSQL: string;
  downSQL: string;
  dependsOn: string | null;
}

export interface MigrationScriptBundle {
  scripts: MigrationScript[];
  executionOrder: string[];
  warnings: string[];
  rollbackStrategy: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResponse = Record<string, any>;

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * AI-powered migration risk assessment and planning.
 */
export function useAssessMigration() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      sourceDialect: string;
      targetDialect: string;
    }) => {
      const response = await apiClient.post('/ai/migration/assess', input);
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'migration');
      return raw.assessment as MigrationAssessment;
    },
  });
}

/**
 * AI-powered migration script generation.
 */
export function useGenerateMigrationScripts() {
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      sourceDialect: string;
      targetDialect: string;
      tables?: string[];
    }) => {
      const response = await apiClient.post('/ai/migration/generate-scripts', input);
      const raw = response as unknown as AnyResponse;
      trackAIUsage({ usage: raw.usage, model: raw.model }, 'migration');
      return raw.scripts as MigrationScriptBundle;
    },
  });
}
