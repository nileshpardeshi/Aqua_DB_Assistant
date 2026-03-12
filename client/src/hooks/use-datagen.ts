import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Synthetic Data Types ──────────────────────────────────────────────────────

export interface SyntheticDataConfig {
  projectId: string;
  dialect: string;
  selectedTables: string[];
  rowCount: number;
  distributionConfig?: {
    type: 'uniform' | 'gaussian' | 'zipf' | 'realistic';
    params?: Record<string, unknown>;
  };
}

export interface SyntheticScript {
  tableName: string;
  insertOrder: number;
  rowCount: number;
  batchSize: number;
  sqlScript: string;
  sampleRows: string[][];
  columnsUsed: string[];
  generatorStrategies: Record<string, string>;
  estimatedSizeBytes: number;
  referentialIntegrityNotes: string;
}

export interface SyntheticDataResult {
  scripts: SyntheticScript[];
  insertOrder: string[];
  totalEstimatedSize: string;
  dialectNotes: string;
  summary: string;
}

// ── Query Planner Types ───────────────────────────────────────────────────────

export interface QueryPlanConfig {
  projectId: string;
  dialect: string;
  sql: string;
  estimatedRowCounts?: Record<string, number>;
}

export interface PlanNode {
  nodeType: string;
  relation?: string | null;
  alias?: string | null;
  startupCost: number;
  totalCost: number;
  estimatedRows: number;
  actualRows?: number;
  estimatedWidth?: number;
  executionTimeMs: number;
  filter?: string | null;
  indexUsed?: string | null;
  bufferHits?: number;
  bufferReads?: number;
  children?: PlanNode[];
}

export interface Bottleneck {
  severity: 'critical' | 'warning' | 'info';
  nodeIndex: number;
  issue: string;
  impact: string;
  recommendation: string;
}

export interface QueryPlanResult {
  executionPlan: {
    planTree: PlanNode[];
    totalExecutionTimeMs: number;
    planningTimeMs: number;
    peakMemoryKB: number;
    rowsReturned: number;
  };
  bottlenecks: Bottleneck[];
  indexRecommendations: Array<{
    createStatement: string;
    estimatedImprovement: string;
    reason: string;
  }>;
  joinAnalysis: {
    joinCount: number;
    joinTypes: string[];
    costliestJoin: string;
    recommendation: string;
  };
  memoryAnalysis: {
    estimatedWorkMem: string;
    sortSpillToDisk: boolean;
    hashBuckets: number;
  };
  dialectSpecificNotes: string;
  summary: string;
}

// ── Data Distribution Types ───────────────────────────────────────────────────

export interface DataDistributionConfig {
  projectId: string;
  dialect: string;
  selectedTables: string[];
  estimatedRowCounts: Record<string, number>;
}

export interface ColumnDistribution {
  tableName: string;
  columnName: string;
  dataType: string;
  estimatedCardinality: number;
  totalRows: number;
  selectivity: number;
  distributionType: string;
  skewFactor: number;
  histogram: Array<{
    bucket: string;
    frequency: number;
    cumulativePercent: number;
  }>;
  topNValues: Array<{
    value: string;
    frequency: number;
    percentage: number;
  }>;
  nullPercentage: number;
  statistics: {
    min: string;
    max: string;
    avg: string;
    stddev: string;
    median: string;
  };
}

export interface SkewAlert {
  tableName: string;
  columnName: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  impact: string;
  recommendation: string;
}

export interface DataDistributionResult {
  distributions: ColumnDistribution[];
  skewAlerts: SkewAlert[];
  cardinalityMatrix: Record<
    string,
    { uniqueValues: number; totalRows: number; ratio: number }
  >;
  summary: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useGenerateSyntheticData() {
  return useMutation({
    mutationFn: async (input: SyntheticDataConfig) => {
      const response = await apiClient.post(
        '/ai/datagen/synthetic-scripts',
        input,
      );
      return (response as unknown as { generation: SyntheticDataResult })
        .generation;
    },
  });
}

export function useSimulateQueryPlan() {
  return useMutation({
    mutationFn: async (input: QueryPlanConfig) => {
      const response = await apiClient.post(
        '/ai/datagen/query-planner',
        input,
      );
      return (response as unknown as { simulation: QueryPlanResult })
        .simulation;
    },
  });
}

export function useSimulateDataDistribution() {
  return useMutation({
    mutationFn: async (input: DataDistributionConfig) => {
      const response = await apiClient.post(
        '/ai/datagen/data-distribution',
        input,
      );
      return (response as unknown as { simulation: DataDistributionResult })
        .simulation;
    },
  });
}
