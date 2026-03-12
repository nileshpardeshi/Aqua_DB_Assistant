import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CSVAnalysis {
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  detectedDelimiter: string;
  fileSizeBytes: number;
}

export interface CSVUploadResult extends CSVAnalysis {
  filePath: string;
  originalName: string;
  fileSize: number;
}

export interface DependencyResolution {
  sortedTables: string[];
  circularDependencies: string[][];
  selfReferences: string[];
  graph: Record<string, string[]>;
}

export interface DataSheetMapping {
  csvHeader: string;
  sourceColumn: string;
}

export interface ColumnMapping {
  id: string;
  sourceColumn: string;
  targetColumn: string;
  transformationType: 'direct' | 'cast' | 'expression' | 'default' | 'rename';
  expression?: string;
  castTo?: string;
  defaultValue?: string;
  nullHandling: 'pass' | 'default' | 'skip';
  isValid: boolean;
}

export interface TargetColumnDef {
  name: string;
  dataType: string;
}

export interface TableMigrationConfig {
  sourceTableName: string;
  targetTableName: string;
  csvFilePath: string;
  csvDelimiter?: string;
  dataSheetMappings: DataSheetMapping[];
  columnMappings: ColumnMapping[];
  targetColumns: TargetColumnDef[];
}

export interface ScriptGenerationConfig {
  projectId: string;
  targetDialect: string;
  tables: TableMigrationConfig[];
  batchSize: number;
  disableFKConstraints: boolean;
  includeTransaction: boolean;
}

export interface GenerationProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentTable: string;
  tablesCompleted: number;
  totalTables: number;
  rowsProcessed: number;
  totalRowsEstimated: number;
  outputFilePath?: string;
  outputFileName?: string;
  fileSize?: number;
  error?: string;
  generationTimeMs?: number;
  tableStats?: Array<{
    tableName: string;
    rowCount: number;
    batchCount: number;
  }>;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const dataMigrationKeys = {
  all: ['data-migration'] as const,
  status: (projectId: string, jobId: string) =>
    [...dataMigrationKeys.all, 'status', projectId, jobId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Upload a CSV file and get analysis.
 */
export function useUploadCSV() {
  return useMutation({
    mutationFn: async ({
      projectId,
      file,
    }: {
      projectId: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await apiClient.post(
        `/projects/${projectId}/data-migration/upload-csv`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000, // 2 minutes for large files
        },
      );
      return response as unknown as CSVUploadResult;
    },
  });
}

/**
 * Re-analyze an existing CSV file.
 */
export function useAnalyzeCSV() {
  return useMutation({
    mutationFn: async ({
      projectId,
      filePath,
    }: {
      projectId: string;
      filePath: string;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/data-migration/analyze-csv`,
        { filePath },
      );
      return response as unknown as CSVAnalysis;
    },
  });
}

/**
 * Resolve table dependencies (topological sort).
 */
export function useResolveDependencies() {
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/data-migration/resolve-dependencies`,
      );
      return response as unknown as DependencyResolution;
    },
  });
}

/**
 * Start async script generation.
 */
export function useGenerateScript() {
  return useMutation({
    mutationFn: async ({
      projectId,
      config,
    }: {
      projectId: string;
      config: Omit<ScriptGenerationConfig, 'projectId'>;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/data-migration/generate-script`,
        config,
        { timeout: 60000 },
      );
      return response as unknown as { jobId: string };
    },
  });
}

/**
 * Poll generation status every 2 seconds while processing.
 */
export function useGenerationStatus(
  projectId: string | undefined,
  jobId: string | null,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: dataMigrationKeys.status(projectId!, jobId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/data-migration/generate-script/${jobId}/status`,
      );
      return response as unknown as GenerationProgress;
    },
    enabled: !!projectId && !!jobId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000;
    },
  });
}

/**
 * Get download URL for a generated script.
 */
export function getDownloadURL(
  projectId: string,
  filename: string,
): string {
  return `/api/v1/projects/${projectId}/data-migration/download/${encodeURIComponent(filename)}`;
}
