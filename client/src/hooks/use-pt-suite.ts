import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import type {
  PtCollection,
  PtEndpoint,
  PtChain,
  PtChainStep,
  PtScenario,
  PtTestRun,
  PtMetric,
  PtChainExecutionResult,
  PtAiReport,
  PtHeader,
  PtVariable,
  PtAuthConfig,
  PtExtractor,
  PtAssertion,
  PtQueryParam,
  PtSlaThreshold,
  PtRampStep,
} from '../types/pt-suite.types';

// ── Query Keys ──────────────────────────────────────────────────────────────

const ptKeys = {
  all: ['pt-suite'] as const,
  collections: () => [...ptKeys.all, 'collections'] as const,
  collection: (id: string) => [...ptKeys.all, 'collection', id] as const,
  chains: () => [...ptKeys.all, 'chains'] as const,
  chain: (id: string) => [...ptKeys.all, 'chain', id] as const,
  scenarios: () => [...ptKeys.all, 'scenarios'] as const,
  runs: () => [...ptKeys.all, 'runs'] as const,
  run: (id: string) => [...ptKeys.all, 'run', id] as const,
};

// ── Collection Hooks ────────────────────────────────────────────────────────

export function useCollections() {
  return useQuery({
    queryKey: ptKeys.collections(),
    queryFn: async () => {
      const response = await apiClient.get('/pt-suite/collections');
      return response as unknown as PtCollection[];
    },
  });
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ptKeys.collection(id!),
    queryFn: async () => {
      const response = await apiClient.get(`/pt-suite/collections/${id}`);
      return response as unknown as PtCollection;
    },
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      baseUrl: string;
      authConfig?: PtAuthConfig;
      headers?: PtHeader[];
      variables?: PtVariable[];
    }) => {
      const response = await apiClient.post('/pt-suite/collections', input);
      return response as unknown as PtCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        baseUrl?: string;
        authConfig?: PtAuthConfig;
        headers?: PtHeader[];
        variables?: PtVariable[];
      };
    }) => {
      const response = await apiClient.put(`/pt-suite/collections/${id}`, data);
      return response as unknown as PtCollection;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collection(variables.id) });
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/pt-suite/collections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

// ── Swagger Parsing ─────────────────────────────────────────────────────────

export function useParseSwagger() {
  return useMutation({
    mutationFn: async (input: { spec: string | object; collectionId?: string }) => {
      const response = await apiClient.post('/pt-suite/swagger/parse', input);
      return response as unknown as { endpoints: PtEndpoint[]; count: number };
    },
  });
}

// ── Endpoint Hooks ──────────────────────────────────────────────────────────

export function useCreateEndpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collectionId,
      data,
    }: {
      collectionId: string;
      data: {
        name: string;
        method: string;
        path: string;
        description?: string;
        headers?: PtHeader[];
        queryParams?: PtQueryParam[];
        bodyType?: string;
        bodyTemplate?: string;
        tags?: string[];
      };
    }) => {
      const response = await apiClient.post(
        `/pt-suite/collections/${collectionId}/endpoints`,
        data
      );
      return response as unknown as PtEndpoint;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.collection(variables.collectionId),
      });
    },
  });
}

export function useUpdateEndpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      collectionId,
      data,
    }: {
      id: string;
      collectionId: string;
      data: {
        name?: string;
        method?: string;
        path?: string;
        description?: string;
        headers?: PtHeader[];
        queryParams?: PtQueryParam[];
        bodyType?: string;
        bodyTemplate?: string;
        tags?: string[];
      };
    }) => {
      const response = await apiClient.put(`/pt-suite/endpoints/${id}`, data);
      return response as unknown as PtEndpoint;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.collection(variables.collectionId),
      });
    },
  });
}

export function useDeleteEndpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      collectionId,
    }: {
      id: string;
      collectionId: string;
    }) => {
      await apiClient.delete(`/pt-suite/endpoints/${id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.collection(variables.collectionId),
      });
    },
  });
}

// ── Chain Hooks ─────────────────────────────────────────────────────────────

export function useChains() {
  return useQuery({
    queryKey: ptKeys.chains(),
    queryFn: async () => {
      const response = await apiClient.get('/pt-suite/chains');
      return response as unknown as PtChain[];
    },
  });
}

export function useChain(id: string | undefined) {
  return useQuery({
    queryKey: ptKeys.chain(id!),
    queryFn: async () => {
      const response = await apiClient.get(`/pt-suite/chains/${id}`);
      return response as unknown as PtChain;
    },
    enabled: !!id,
  });
}

export function useCreateChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      collectionId: string;
      name: string;
      description?: string;
    }) => {
      const response = await apiClient.post('/pt-suite/chains', input);
      return response as unknown as PtChain;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chains() });
    },
  });
}

export function useUpdateChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
      };
    }) => {
      const response = await apiClient.put(`/pt-suite/chains/${id}`, data);
      return response as unknown as PtChain;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chain(variables.id) });
      queryClient.invalidateQueries({ queryKey: ptKeys.chains() });
    },
  });
}

export function useDeleteChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/pt-suite/chains/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chains() });
    },
  });
}

// ── Chain Step Hooks ────────────────────────────────────────────────────────

export function useCreateStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chainId,
      data,
    }: {
      chainId: string;
      data: {
        endpointId?: string;
        name: string;
        method: string;
        url: string;
        headers?: PtHeader[];
        body?: string;
        extractors?: PtExtractor[];
        assertions?: PtAssertion[];
        preScript?: string;
        postScript?: string;
        thinkTimeSec?: number;
        isEnabled?: boolean;
      };
    }) => {
      const response = await apiClient.post(
        `/pt-suite/chains/${chainId}/steps`,
        data
      );
      return response as unknown as PtChainStep;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.chain(variables.chainId),
      });
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      chainId,
      data,
    }: {
      id: string;
      chainId: string;
      data: {
        endpointId?: string;
        name?: string;
        method?: string;
        url?: string;
        headers?: PtHeader[];
        body?: string;
        extractors?: PtExtractor[];
        assertions?: PtAssertion[];
        preScript?: string;
        postScript?: string;
        thinkTimeSec?: number;
        isEnabled?: boolean;
      };
    }) => {
      const response = await apiClient.put(`/pt-suite/steps/${id}`, data);
      return response as unknown as PtChainStep;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.chain(variables.chainId),
      });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      chainId,
    }: {
      id: string;
      chainId: string;
    }) => {
      await apiClient.delete(`/pt-suite/steps/${id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.chain(variables.chainId),
      });
    },
  });
}

export function useReorderSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chainId,
      stepIds,
    }: {
      chainId: string;
      stepIds: string[];
    }) => {
      const response = await apiClient.post(
        `/pt-suite/chains/${chainId}/reorder`,
        { stepIds }
      );
      return response as unknown as PtChainStep[];
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.chain(variables.chainId),
      });
    },
  });
}

export function useExecuteChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chainId,
      variables,
    }: {
      chainId: string;
      variables?: Record<string, string>;
    }) => {
      const response = await apiClient.post(
        `/pt-suite/chains/${chainId}/execute`,
        { variables }
      );
      return response as unknown as PtChainExecutionResult;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ptKeys.chain(vars.chainId),
      });
    },
  });
}

// ── Scenario Hooks ──────────────────────────────────────────────────────────

export function useScenarios() {
  return useQuery({
    queryKey: ptKeys.scenarios(),
    queryFn: async () => {
      const response = await apiClient.get('/pt-suite/scenarios');
      return response as unknown as PtScenario[];
    },
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      chainId: string;
      name: string;
      description?: string;
      pattern: PtScenario['pattern'];
      peakVU: number;
      rampUpSec: number;
      steadyStateSec: number;
      rampDownSec: number;
      thinkTimeSec?: number;
      pacingSec?: number;
      timeoutMs?: number;
      maxErrorPct?: number;
      slaThresholds?: PtSlaThreshold[];
      customRampSteps?: PtRampStep[];
    }) => {
      const response = await apiClient.post('/pt-suite/scenarios', input);
      return response as unknown as PtScenario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.scenarios() });
    },
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        pattern?: PtScenario['pattern'];
        peakVU?: number;
        rampUpSec?: number;
        steadyStateSec?: number;
        rampDownSec?: number;
        thinkTimeSec?: number;
        pacingSec?: number;
        timeoutMs?: number;
        maxErrorPct?: number;
        slaThresholds?: PtSlaThreshold[];
        customRampSteps?: PtRampStep[];
      };
    }) => {
      const response = await apiClient.put(`/pt-suite/scenarios/${id}`, data);
      return response as unknown as PtScenario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.scenarios() });
    },
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/pt-suite/scenarios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.scenarios() });
    },
  });
}

// ── Test Run Hooks ──────────────────────────────────────────────────────────

export function useStartRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { scenarioId: string }) => {
      const response = await apiClient.post('/pt-suite/runs', input);
      return response as unknown as PtTestRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.runs() });
    },
  });
}

export function useRuns() {
  return useQuery({
    queryKey: ptKeys.runs(),
    queryFn: async () => {
      const response = await apiClient.get('/pt-suite/runs');
      return response as unknown as PtTestRun[];
    },
  });
}

export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: ptKeys.run(id!),
    queryFn: async () => {
      const response = await apiClient.get(`/pt-suite/runs/${id}`);
      return response as unknown as PtTestRun;
    },
    enabled: !!id,
  });
}

export function useStopRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/pt-suite/runs/${id}/stop`);
      return response as unknown as PtTestRun;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.run(id) });
      queryClient.invalidateQueries({ queryKey: ptKeys.runs() });
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/pt-suite/runs/${id}/report`);
      return response as unknown as PtAiReport;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.run(id) });
    },
  });
}

// ── Demo Seed ───────────────────────────────────────────────────────────────

export function useSeedDemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.get('/pt-suite/demo/seed');
      return response as unknown as { message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.all });
    },
  });
}

// ── AI Hooks ────────────────────────────────────────────────────────────────

export function useAiAnalyzeChain() {
  return useMutation({
    mutationFn: async (input: { chainId: string; executionResult?: PtChainExecutionResult }) => {
      const response = await apiClient.post('/pt-suite/ai/analyze-chain', input);
      return response as unknown as { analysis: string };
    },
  });
}

export function useAiSuggestAssertions() {
  return useMutation({
    mutationFn: async (input: { stepId: string; responseBody?: string; responseHeaders?: Record<string, string> }) => {
      const response = await apiClient.post('/pt-suite/ai/suggest-assertions', input);
      return response as unknown as { assertions: PtAssertion[] };
    },
  });
}

// ── SSE Streaming Hook ──────────────────────────────────────────────────────

export function useRunStream(runId: string | undefined) {
  const [metrics, setMetrics] = useState<PtMetric[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [latestMetric, setLatestMetric] = useState<PtMetric | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!runId) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/v1/pt-suite/runs/${runId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setIsStreaming(true);

    es.addEventListener('metric', (event: MessageEvent) => {
      try {
        const metric = JSON.parse(event.data) as PtMetric;
        setMetrics((prev) => [...prev, metric]);
        setLatestMetric(metric);
      } catch {
        // Ignore malformed metric data
      }
    });

    es.addEventListener('done', () => {
      setIsStreaming(false);
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsStreaming(false);
    };
  }, [connect]);

  return { metrics, isStreaming, latestMetric };
}
