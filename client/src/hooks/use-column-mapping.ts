import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIColumnMappingSuggestion {
  sourceColumn: string;
  targetColumn: string;
  confidence: number;
  transformationType: 'direct' | 'cast' | 'expression' | 'default';
  expression?: string;
  castTo?: string;
  reasoning: string;
}

export interface AIColumnMappingResult {
  mappings: AIColumnMappingSuggestion[];
  unmappedSource: string[];
  unmappedTarget: string[];
  warnings: string[];
  summary: string;
}

interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * AI-powered column mapping suggestions between source and target tables.
 */
export function useSuggestColumnMapping() {
  return useMutation({
    mutationFn: async (input: {
      projectId?: string;
      sourceTable: { name: string; columns: ColumnInfo[] };
      targetTable: { name: string; columns: ColumnInfo[] };
      sourceDialect: string;
      targetDialect: string;
    }) => {
      const response = await apiClient.post(
        '/ai/migration/suggest-column-mapping',
        input,
      );
      const wrapper = response as unknown as { result: AIColumnMappingResult };
      return wrapper.result;
    },
  });
}
