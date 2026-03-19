import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
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
    queryFn: () => api.get<PtCollection[]>('/pt-suite/collections'),
  });
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ptKeys.collection(id!),
    queryFn: () => api.get<PtCollection>(`/pt-suite/collections/${id}`),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      baseUrl: string;
      authConfig?: PtAuthConfig;
      headers?: PtHeader[];
      variables?: PtVariable[];
    }) => api.post<PtCollection>('/pt-suite/collections', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
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
    }) => api.put<PtCollection>(`/pt-suite/collections/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collection(variables.id) });
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/pt-suite/collections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

// ── Swagger Parsing ─────────────────────────────────────────────────────────

export function useParseSwagger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { specText: string; name?: string }) =>
      api.post<{ collection: PtCollection; parsed: { title: string; version: string; baseUrl: string; endpointCount: number } }>(
        '/pt-suite/swagger/parse',
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

// ── Endpoint Hooks ──────────────────────────────────────────────────────────

export function useCreateEndpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
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
    }) => api.post<PtEndpoint>(`/pt-suite/collections/${collectionId}/endpoints`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collection(variables.collectionId) });
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

export function useUpdateEndpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
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
    }) => api.put<PtEndpoint>(`/pt-suite/endpoints/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collection(variables.collectionId) });
    },
  });
}

export function useDeleteEndpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      collectionId,
    }: {
      id: string;
      collectionId: string;
    }) => api.delete<void>(`/pt-suite/endpoints/${id}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.collection(variables.collectionId) });
      queryClient.invalidateQueries({ queryKey: ptKeys.collections() });
    },
  });
}

// ── Chain Hooks ─────────────────────────────────────────────────────────────

export function useChains() {
  return useQuery({
    queryKey: ptKeys.chains(),
    queryFn: () => api.get<PtChain[]>('/pt-suite/chains'),
  });
}

export function useChain(id: string | undefined) {
  return useQuery({
    queryKey: ptKeys.chain(id!),
    queryFn: () => api.get<PtChain>(`/pt-suite/chains/${id}`),
    enabled: !!id,
  });
}

export function useCreateChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      collectionId: string;
      name: string;
      description?: string;
    }) => api.post<PtChain>('/pt-suite/chains', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chains() });
    },
  });
}

export function useUpdateChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string };
    }) => api.put<PtChain>(`/pt-suite/chains/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chain(variables.id) });
      queryClient.invalidateQueries({ queryKey: ptKeys.chains() });
    },
  });
}

export function useDeleteChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/pt-suite/chains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chains() });
    },
  });
}

// ── Chain Step Hooks ────────────────────────────────────────────────────────

export function useCreateStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
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
    }) => api.post<PtChainStep>(`/pt-suite/chains/${chainId}/steps`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chain(variables.chainId) });
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
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
    }) => api.put<PtChainStep>(`/pt-suite/steps/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chain(variables.chainId) });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      chainId,
    }: {
      id: string;
      chainId: string;
    }) => api.delete<void>(`/pt-suite/steps/${id}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chain(variables.chainId) });
    },
  });
}

export function useReorderSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chainId,
      stepIds,
    }: {
      chainId: string;
      stepIds: string[];
    }) => api.post<PtChainStep[]>(`/pt-suite/chains/${chainId}/reorder`, { stepIds }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chain(variables.chainId) });
    },
  });
}

export function useExecuteChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chainId,
      variables,
    }: {
      chainId: string;
      variables?: Record<string, string>;
    }) => api.post<PtChainExecutionResult>(`/pt-suite/chains/${chainId}/execute`, { variables }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.chain(vars.chainId) });
    },
  });
}

// ── Scenario Hooks ──────────────────────────────────────────────────────────

export function useScenarios() {
  return useQuery({
    queryKey: ptKeys.scenarios(),
    queryFn: () => api.get<PtScenario[]>('/pt-suite/scenarios'),
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
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
    }) => api.post<PtScenario>('/pt-suite/scenarios', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.scenarios() });
    },
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
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
    }) => api.put<PtScenario>(`/pt-suite/scenarios/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.scenarios() });
    },
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/pt-suite/scenarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.scenarios() });
    },
  });
}

// ── Test Run Hooks ──────────────────────────────────────────────────────────

export function useStartRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { scenarioId: string }) =>
      api.post<PtTestRun>('/pt-suite/runs', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.runs() });
    },
  });
}

export function useRuns() {
  return useQuery({
    queryKey: ptKeys.runs(),
    queryFn: () => api.get<PtTestRun[]>('/pt-suite/runs'),
  });
}

export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: ptKeys.run(id!),
    queryFn: () => api.get<PtTestRun>(`/pt-suite/runs/${id}`),
    enabled: !!id,
  });
}

export function useStopRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<PtTestRun>(`/pt-suite/runs/${id}/stop`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.run(id) });
      queryClient.invalidateQueries({ queryKey: ptKeys.runs() });
    },
  });
}

export function useDeleteRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/pt-suite/runs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.runs() });
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<PtAiReport>(`/pt-suite/runs/${id}/report`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ptKeys.run(id) });
      queryClient.invalidateQueries({ queryKey: ptKeys.runs() });
    },
  });
}

// ── Demo Seed ───────────────────────────────────────────────────────────────

export function useSeedDemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.get<{ message: string }>('/pt-suite/demo/seed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptKeys.all });
    },
  });
}

// ── AI Hooks ────────────────────────────────────────────────────────────────

export function useAiAnalyzeChain() {
  return useMutation({
    mutationFn: (input: { chainId: string; executionResult?: PtChainExecutionResult }) =>
      api.post<{ analysis: unknown }>('/pt-suite/ai/analyze-chain', input),
  });
}

export function useAiSuggestAssertions() {
  return useMutation({
    mutationFn: (input: { stepId: string; responseBody?: string; responseHeaders?: Record<string, string> }) =>
      api.post<{ assertions: PtAssertion[] }>('/pt-suite/ai/suggest-assertions', input),
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
    setMetrics([]); // Reset on new connection

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
