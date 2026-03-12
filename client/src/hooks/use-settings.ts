import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// Types

export interface AIProviderConfig {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isDefault: boolean;
  maxTokens: number;
  temperature: number;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAIProviderInput {
  id?: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  isDefault?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface TestAIProviderResult {
  status: string;
  provider: string;
  model: string;
  latencyMs: number;
  response: string;
}

// Query keys
const settingsKeys = {
  all: ['settings'] as const,
  aiProviders: () => [...settingsKeys.all, 'ai-providers'] as const,
};

/**
 * Fetch all configured AI providers.
 */
export function useAIProviders() {
  return useQuery({
    queryKey: settingsKeys.aiProviders(),
    queryFn: async () => {
      const response = await apiClient.get('/settings/ai-providers');
      return response as unknown as AIProviderConfig[];
    },
  });
}

/**
 * Add or update an AI provider configuration.
 */
export function useUpsertAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertAIProviderInput) => {
      const response = await apiClient.post('/settings/ai-providers', input);
      return response as unknown as AIProviderConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsKeys.aiProviders(),
      });
    },
  });
}

/**
 * Delete an AI provider configuration.
 */
export function useDeleteAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/settings/ai-providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsKeys.aiProviders(),
      });
    },
  });
}

/**
 * Test an AI provider connection.
 */
export function useTestAIProvider() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(
        `/settings/ai-providers/${id}/test`
      );
      return response as unknown as TestAIProviderResult;
    },
  });
}
