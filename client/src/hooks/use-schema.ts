import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Column {
  id: string;
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  defaultValue?: string | null;
  comment?: string | null;
  ordinalPosition: number;
  referencesTable?: string | null;
  referencesColumn?: string | null;
}

export interface Index {
  id: string;
  name: string;
  type: string;
  columns: string[];
  isUnique: boolean;
}

export interface Constraint {
  id: string;
  name: string;
  type: string;
  columns: string[];
  referencesTable?: string | null;
  referencesColumns?: string[] | null;
}

export interface Table {
  id: string;
  name: string;
  schema?: string;
  type: string;
  description?: string | null;
  estimatedRows?: number | null;
  columns: Column[];
  indexes: Index[];
  constraints: Constraint[];
}

export interface Relationship {
  id: string;
  name: string;
  sourceTable: string;
  sourceTableName?: string;
  sourceColumn: string;
  targetTable: string;
  targetTableName?: string;
  targetColumn: string;
  type: string;
  isInferred: boolean;
}

export interface ERDiagramData {
  tables: Table[];
  relationships: Relationship[];
}

export interface SchemaSnapshot {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  tableCount: number;
}

export interface ParseFileResult {
  tablesCreated: number;
  tablesUpdated: number;
  errors: string[];
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const schemaKeys = {
  all: (projectId: string) => ['schema', projectId] as const,
  tables: (projectId: string) => [...schemaKeys.all(projectId), 'tables'] as const,
  table: (projectId: string, tableId: string) =>
    [...schemaKeys.tables(projectId), tableId] as const,
  relationships: (projectId: string) =>
    [...schemaKeys.all(projectId), 'relationships'] as const,
  erDiagram: (projectId: string) =>
    [...schemaKeys.all(projectId), 'er-diagram'] as const,
  snapshots: (projectId: string) =>
    [...schemaKeys.all(projectId), 'snapshots'] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch all tables for a project.
 */
export function useTables(projectId: string | undefined) {
  return useQuery({
    queryKey: schemaKeys.tables(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/schema/tables`
      );
      return response as unknown as Table[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single table by ID.
 */
export function useTable(
  projectId: string | undefined,
  tableId: string | undefined
) {
  return useQuery({
    queryKey: schemaKeys.table(projectId!, tableId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/schema/tables/${tableId}`
      );
      return response as unknown as Table;
    },
    enabled: !!projectId && !!tableId,
  });
}

/**
 * Fetch all relationships for a project.
 */
export function useRelationships(projectId: string | undefined) {
  return useQuery({
    queryKey: schemaKeys.relationships(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/schema/relationships`
      );
      return response as unknown as Relationship[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch the full ER diagram data (tables + relationships).
 */
export function useERDiagram(projectId: string | undefined) {
  return useQuery({
    queryKey: schemaKeys.erDiagram(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/schema/er-diagram`
      );
      return response as unknown as ERDiagramData;
    },
    enabled: !!projectId,
  });
}

/**
 * Parse an uploaded SQL file to extract schema.
 */
export function useParseFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      fileId,
    }: {
      projectId: string;
      fileId: string;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/schema/parse`,
        { fileId }
      );
      return response as unknown as ParseFileResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: schemaKeys.all(variables.projectId),
      });
    },
  });
}

/**
 * Fetch all schema snapshots for a project.
 */
export function useSchemaSnapshots(projectId: string | undefined) {
  return useQuery({
    queryKey: schemaKeys.snapshots(projectId!),
    queryFn: async () => {
      const response = await apiClient.get(
        `/projects/${projectId}/schema/snapshots`
      );
      return response as unknown as SchemaSnapshot[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new schema snapshot.
 */
export function useCreateSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      name,
      description,
    }: {
      projectId: string;
      name: string;
      description?: string;
    }) => {
      const response = await apiClient.post(
        `/projects/${projectId}/schema/snapshots`,
        { name, description }
      );
      return response as unknown as SchemaSnapshot;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: schemaKeys.snapshots(variables.projectId),
      });
    },
  });
}
