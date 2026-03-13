import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ───────────────────────────────────────────────────────────────────

export type ReportType = 'awr' | 'ash' | 'addm' | 'mysql_slowlog' | 'pg_stats' | 'generic';
export type DatabaseType = 'oracle' | 'mysql' | 'postgresql' | 'unknown';
export type HealthRating = 'healthy' | 'degraded' | 'critical';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AWRAnalysisSummary {
  healthScore: number;
  healthRating: HealthRating;
  headline: string;
  keyFindings: string[];
  timeRange: string;
}

export interface AWRRootCause {
  primaryCause: string;
  explanation: string;
  evidence: string[];
  severity: Severity;
  affectedArea: 'cpu' | 'io' | 'memory' | 'locking' | 'network' | 'sql' | 'config';
}

export interface AWRSQLAnalysis {
  sqlId: string;
  sqlText: string;
  problem: string;
  currentTime: string;
  recommendation: string;
  suggestedRewrite?: string;
  indexRecommendation?: string;
  estimatedImprovement: string;
}

export interface AWRWaitEventAnalysis {
  event: string;
  interpretation: string;
  severity: Severity;
  recommendation: string;
}

export interface AWRRecommendation {
  category: 'index' | 'sql' | 'config' | 'partition' | 'memory' | 'io' | 'architecture';
  priority: 'immediate' | 'short-term' | 'long-term';
  title: string;
  description: string;
  implementation: string;
  estimatedImpact: string;
}

export interface AWRIndexRecommendation {
  table: string;
  columns: string[];
  reason: string;
  createStatement: string;
  estimatedImprovement: string;
}

export interface AWRAnalysisResult {
  summary: AWRAnalysisSummary;
  rootCause: AWRRootCause[];
  sqlAnalysis: AWRSQLAnalysis[];
  waitEventAnalysis: AWRWaitEventAnalysis[];
  recommendations: AWRRecommendation[];
  indexRecommendations: AWRIndexRecommendation[];
}

export interface AWRParseInfo {
  reportType: ReportType;
  database: DatabaseType;
  fileSizeKB: number;
  parseTimeMs: number;
  fromCache: boolean;
  sectionsFound: string[];
  lineCount?: number;
}

export interface AWRFullResult {
  parseResult: AWRParseInfo;
  metrics: Record<string, unknown>;
  analysis: AWRAnalysisResult;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  analysisTimeMs?: number;
}

// ── Incident Time-Machine Types ──────────────────────────────────────────────

export type EventCategory = 'deployment' | 'schema_change' | 'performance' | 'query' | 'wait_event' | 'resource' | 'config_change' | 'error' | 'metric';
export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string;
  sortKey: number;
  category: EventCategory;
  severity: EventSeverity;
  title: string;
  description: string;
  source: string;
  sourceType: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentTimelineData {
  events: IncidentTimelineEvent[];
  sources: Array<{
    fileName: string;
    reportType: string;
    database: string;
    eventCount: number;
    fileSizeKB: number;
  }>;
  timeRange: { earliest: string; latest: string } | null;
  totalEventsBeforeDedup: number;
  totalEventsAfterDedup: number;
  compressionRatio: number;
}

export interface IncidentCausalChainStep {
  step: number;
  event: string;
  effect: string;
  timelag: string;
}

export interface IncidentAnalysis {
  incidentSummary: {
    severity: string;
    headline: string;
    duration: string;
    affectedSystems: string[];
    database: string;
  };
  timeline: Array<{
    timestamp: string;
    event: string;
    category: string;
    severity: string;
    isRootCause: boolean;
    isTrigger: boolean;
    correlatedWith: string[];
    analysis: string;
  }>;
  rootCause: {
    primaryCause: string;
    confidence: string;
    explanation: string;
    evidence: string[];
    causalChain: IncidentCausalChainStep[];
  };
  correlations: Array<{
    eventA: string;
    eventB: string;
    relationship: string;
    confidence: string;
    explanation: string;
  }>;
  impact: {
    queriesAffected: string;
    latencyIncrease: string;
    usersImpacted: string;
    dataAtRisk: string;
    businessImpact: string;
  };
  remediation: {
    immediateFix: {
      description: string;
      sql?: string;
      estimatedRecoveryTime?: string;
    };
    preventiveMeasures: Array<{
      title: string;
      description: string;
      priority: string;
      implementation: string;
    }>;
    rollbackSteps: Array<{
      step: number;
      description: string;
      sql?: string;
      risk?: string;
    }>;
  };
  lessonsLearned: string[];
}

export interface IncidentFullResult {
  timeline: IncidentTimelineData;
  analysis: IncidentAnalysis;
  tokenOptimization: {
    totalInputSizeKB: number;
    compressedContextChars: number;
    estimatedTokensSaved: number;
    compressionRatio: number;
  };
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  analysisTimeMs: number;
  totalLines: number;
}

export interface AWRCompareResult {
  reportA: { reportType: ReportType; database: DatabaseType; fileSizeKB: number };
  reportB: { reportType: ReportType; database: DatabaseType; fileSizeKB: number };
  comparison: {
    overallVerdict: 'improved' | 'regressed' | 'unchanged' | 'mixed';
    healthScoreBefore: number;
    healthScoreAfter: number;
    headline: string;
    improvements: { area: string; description: string; before: string; after: string }[];
    regressions: { area: string; description: string; before: string; after: string }[];
    persistent: { area: string; description: string }[];
    recommendations: string[];
  };
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useAWRAnalyze() {
  return useMutation({
    mutationFn: async (input: {
      content: string;
      fileName?: string;
      forceType?: ReportType;
      focusAreas?: string[];
    }) => {
      const response = await apiClient.post('/tools/awr/analyze', input);
      return response as unknown as AWRFullResult;
    },
  });
}

export function useAWRParse() {
  return useMutation({
    mutationFn: async (input: {
      content: string;
      fileName?: string;
      forceType?: ReportType;
    }) => {
      const response = await apiClient.post('/tools/awr/parse', input);
      return response as unknown as { metrics: Record<string, unknown>; reportType: ReportType; database: DatabaseType; fileSizeKB: number; parseTimeMs: number; fromCache: boolean };
    },
  });
}

export function useAWRDetectType() {
  return useMutation({
    mutationFn: async (input: { content: string; fileName?: string }) => {
      const response = await apiClient.post('/tools/awr/detect-type', input);
      return response as unknown as { type: ReportType; database: DatabaseType };
    },
  });
}

export function useAWRCompare() {
  return useMutation({
    mutationFn: async (input: {
      reportA: { content: string; fileName?: string };
      reportB: { content: string; fileName?: string };
    }) => {
      const response = await apiClient.post('/tools/awr/compare', input);
      return response as unknown as AWRCompareResult;
    },
  });
}

export function useIncidentAnalyze() {
  return useMutation({
    mutationFn: async (input: {
      sources: Array<{ content: string; fileName?: string; forceType?: ReportType }>;
      incidentWindow?: { start?: string; end?: string };
      incidentDescription?: string;
      focusAreas?: string[];
    }) => {
      const response = await apiClient.post('/tools/awr/incident-analyze', input);
      return response as unknown as IncidentFullResult;
    },
  });
}
