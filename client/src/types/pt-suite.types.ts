// ── Performance Testing Suite Types ──────────────────────────────────────────

export interface PtCollection {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  swaggerSpec: unknown | null;
  authConfig: PtAuthConfig | null;
  headers: PtHeader[] | null;
  variables: PtVariable[] | null;
  createdAt: string;
  updatedAt: string;
  endpoints?: PtEndpoint[];
  chains?: PtChain[];
}

export interface PtAuthConfig {
  type: 'none' | 'bearer' | 'apiKey' | 'basic';
  token?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
  username?: string;
  password?: string;
}

export interface PtHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface PtVariable {
  key: string;
  value: string;
  env: string;
}

export interface PtEndpoint {
  id: string;
  collectionId: string;
  name: string;
  method: string;
  path: string;
  description: string | null;
  headers: PtHeader[] | null;
  queryParams: PtQueryParam[] | null;
  bodyType: string | null;
  bodyTemplate: string | null;
  tags: string[] | null;
  createdAt: string;
}

export interface PtQueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

export interface PtChain {
  id: string;
  collectionId: string;
  name: string;
  description: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  steps?: PtChainStep[];
  scenarios?: PtScenario[];
}

export interface PtChainStep {
  id: string;
  chainId: string;
  endpointId: string | null;
  sortOrder: number;
  name: string;
  method: string;
  url: string;
  headers: PtHeader[] | null;
  body: string | null;
  extractors: PtExtractor[] | null;
  assertions: PtAssertion[] | null;
  preScript: string | null;
  postScript: string | null;
  thinkTimeSec: number;
  isEnabled: boolean;
}

export interface PtExtractor {
  name: string;
  source: 'body' | 'header' | 'status';
  path: string; // JSONPath expression
}

export interface PtAssertion {
  type: 'status' | 'body' | 'header' | 'responseTime';
  target: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches';
  value: string;
}

export interface PtScenario {
  id: string;
  chainId: string;
  name: string;
  description: string | null;
  pattern: 'ramp' | 'spike' | 'soak' | 'stress' | 'step' | 'custom';
  peakVU: number;
  rampUpSec: number;
  steadyStateSec: number;
  rampDownSec: number;
  thinkTimeSec: number;
  pacingSec: number;
  timeoutMs: number;
  maxErrorPct: number;
  slaThresholds: PtSlaThreshold[] | null;
  customRampSteps: PtRampStep[] | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  chain?: PtChain;
}

export interface PtSlaThreshold {
  metric: 'avgLatency' | 'p95Latency' | 'p99Latency' | 'errorRate' | 'tps';
  operator: 'lt' | 'gt' | 'lte' | 'gte';
  value: number;
  severity: 'warn' | 'fail';
}

export interface PtRampStep {
  atSec: number;
  targetVU: number;
}

export interface PtTestRun {
  id: string;
  scenarioId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: string;
  completedAt: string | null;
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  peakTps: number;
  avgTps: number;
  errorRate: number;
  slaResults: PtSlaResult[] | null;
  aiAnalysis: string | null;
  reportData: unknown | null;
  scenario?: PtScenario;
  metrics?: PtMetric[];
  stepMetrics?: PtStepMetric[];
}

export interface PtSlaResult {
  metric: string;
  target: number;
  actual: number;
  passed: boolean;
}

export interface PtMetric {
  id: string;
  runId: string;
  timestamp: string;
  activeVU: number;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  tps: number;
}

export interface PtStepMetric {
  id: string;
  runId: string;
  stepName: string;
  method: string;
  url: string;
  totalCalls: number;
  totalErrors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorsByStatus: Record<string, number> | null;
}

export interface PtChainExecutionResult {
  steps: PtStepExecutionResult[];
  totalDurationMs: number;
  success: boolean;
  variables: Record<string, string>;
}

export interface PtStepExecutionResult {
  stepName: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  responseSize: number;
  extractedVariables: Record<string, string>;
  assertionResults: { assertion: PtAssertion; passed: boolean; actual: string }[];
  error: string | null;
}

export interface PtAiReport {
  executiveSummary: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  bottlenecks: Array<{
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    affectedStep: string;
    recommendation: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    expectedImprovement: string;
  }>;
  capacityEstimate: {
    maxSafeVU: number;
    maxTps: number;
    limitingFactor: string;
  };
  slaCompliance: Array<{
    metric: string;
    target: string;
    actual: string;
    status: 'pass' | 'fail' | 'warn';
  }>;
}
