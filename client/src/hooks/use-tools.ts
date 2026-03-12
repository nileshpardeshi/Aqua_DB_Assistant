import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// Types

interface ConversionChange {
  original: string;
  converted: string;
  reason: string;
}

interface ConversionResult {
  sql: string;
  changes: ConversionChange[];
  sourceDialect: string;
  targetDialect: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  tablesFound: number;
  dialect: string;
}

interface DialectDetectionResult {
  dialect: string;
  confidence: number;
  scores: Record<string, number>;
}

// Hooks

export function useConvertSQL() {
  return useMutation({
    mutationFn: async (input: { sql: string; sourceDialect: string; targetDialect: string }) => {
      const response = await apiClient.post('/tools/convert-sql', input);
      return response as unknown as ConversionResult;
    },
  });
}

export function useValidateSQL() {
  return useMutation({
    mutationFn: async (input: { sql: string; dialect?: string }) => {
      const response = await apiClient.post('/tools/validate-sql', input);
      return response as unknown as ValidationResult;
    },
  });
}

export function useDetectDialect() {
  return useMutation({
    mutationFn: async (input: { sql: string }) => {
      const response = await apiClient.post('/tools/detect-dialect', input);
      return response as unknown as DialectDetectionResult;
    },
  });
}

// Export types
export type { ConversionResult, ConversionChange, ValidationResult, DialectDetectionResult };
