import {
  FolderOpen, Link2, Gauge, Play, FileText, Database,
  TrendingUp, Zap, Timer, Flame, BarChart3, Settings,
} from 'lucide-react';

export type TabId = 'collections' | 'chains' | 'scenarios' | 'runs' | 'reports' | 'data-factory';

export const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'collections', label: 'Collections', icon: FolderOpen },
  { id: 'chains', label: 'Chain Designer', icon: Link2 },
  { id: 'scenarios', label: 'Load Scenarios', icon: Gauge },
  { id: 'runs', label: 'Test Runs', icon: Play },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'data-factory', label: 'Data Factory', icon: Database },
];

export const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  HEAD: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  OPTIONS: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

export const PATTERN_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string; desc: string }> = {
  ramp: { icon: TrendingUp, label: 'Ramp', color: 'text-emerald-400', desc: 'Gradual VU increase' },
  spike: { icon: Zap, label: 'Spike', color: 'text-amber-400', desc: 'Sudden traffic spike' },
  soak: { icon: Timer, label: 'Soak', color: 'text-blue-400', desc: 'Sustained duration' },
  stress: { icon: Flame, label: 'Stress', color: 'text-red-400', desc: 'Push to limits' },
  step: { icon: BarChart3, label: 'Step', color: 'text-purple-400', desc: 'Incremental steps' },
  custom: { icon: Settings, label: 'Custom', color: 'text-slate-400', desc: 'Custom ramp' },
};

export const AUTH_TYPES = ['none', 'bearer', 'apiKey', 'basic', 'oauth2'] as const;
export const BODY_TYPES = ['none', 'json', 'form', 'xml', 'raw'] as const;
export const EXTRACTOR_SOURCES = ['body', 'header', 'status', 'cookie'] as const;
export const ASSERTION_TYPES = ['status', 'body', 'header', 'responseTime', 'size'] as const;
export const ASSERTION_OPERATORS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'notContains', 'matches', 'exists', 'notExists'] as const;
export const SLA_METRICS = ['avgLatency', 'p95Latency', 'p99Latency', 'errorRate', 'tps'] as const;
export const SLA_OPERATORS = ['lt', 'gt', 'lte', 'gte'] as const;
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

// Formatters
export function fmtLatency(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function fmtTps(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function fmtPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

export function fmtNum(v: number): string {
  return v.toLocaleString();
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(0)}s`;
  const min = sec / 60;
  return `${Math.floor(min)}m ${Math.round(sec % 60)}s`;
}

export function fmtRelTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}
