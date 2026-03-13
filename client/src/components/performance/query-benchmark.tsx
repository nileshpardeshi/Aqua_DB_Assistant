import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Play,
  Loader2,
  Timer,
  Copy,
  ArrowRightLeft,
  X,
  FlaskConical,
  Sparkles,
  Wand2,
  Zap,
  ArrowDown,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  ClipboardCopy,
  RotateCcw,
  MessageSquare,
  Search,
  ListChecks,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useCreatePerformanceRun } from '@/hooks/use-performance';
import { useProject } from '@/hooks/use-projects';
import {
  useGenerateSQL,
  useOptimizeQuery,
  useExplainQuery,
  type QueryOptimization,
  type GeneratedSQL,
  type QueryExplanation,
} from '@/hooks/use-ai';

// ── Constants ──────────────────────────────────────────────────────────────────

const ITERATION_OPTIONS = [10, 50, 100, 500];

const SAMPLE_DESCRIPTIONS = [
  'Get top 10 customers by total order amount in the last 30 days',
  'Find all products that have never been ordered',
  'List users who signed up this month but haven\'t made any purchases',
  'Show monthly revenue trend for the current year grouped by category',
  'Find duplicate email addresses across all user accounts',
];

type ActiveMode = 'benchmark' | 'generate' | 'optimize' | 'explain';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  iterations: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  stdDev: number;
  throughputQps: number;
  distribution: { bucket: string; count: number; countB?: number }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateSimulatedResults(
  iterations: number,
  complexity: 'simple' | 'moderate' | 'complex' = 'moderate',
): BenchmarkResult {
  const baseMap = { simple: 5, moderate: 25, complex: 80 };
  const base = baseMap[complexity] + Math.random() * 20;
  const variance = base * 0.35;
  const times: number[] = Array.from({ length: iterations }, () => {
    const jitter = (Math.random() - 0.5) * 2 * variance;
    const spike = Math.random() > 0.95 ? base * (1 + Math.random() * 2) : 0;
    return Math.max(0.5, base + jitter + spike);
  });
  times.sort((a, b) => a - b);

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const stdDev = Math.sqrt(
    times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / times.length,
  );

  const buckets = ['0-5ms', '5-15ms', '15-30ms', '30-60ms', '60-120ms', '120ms+'];
  const thresholds = [5, 15, 30, 60, 120, Infinity];
  const distribution = buckets.map((bucket, i) => ({
    bucket,
    count: times.filter(
      (t) => t <= thresholds[i] && (i === 0 || t > thresholds[i - 1]),
    ).length,
  }));

  return {
    iterations,
    minMs: round(times[0]),
    maxMs: round(times[times.length - 1]),
    avgMs: round(avg),
    medianMs: round(times[Math.floor(times.length / 2)]),
    p95Ms: round(times[Math.floor(times.length * 0.95)]),
    p99Ms: round(times[Math.floor(times.length * 0.99)]),
    stdDev: round(stdDev),
    throughputQps: round(1000 / avg),
    distribution,
  };
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}

function estimateComplexity(sql: string): 'simple' | 'moderate' | 'complex' {
  const upper = sql.toUpperCase();
  const joins = (upper.match(/\bJOIN\b/g) || []).length;
  const subqueries = (upper.match(/\bSELECT\b/g) || []).length - 1;
  const hasWindow = /\bOVER\s*\(/i.test(sql);
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
  const score = joins * 2 + subqueries * 3 + (hasWindow ? 3 : 0) + (hasGroupBy ? 1 : 0);
  if (score >= 6) return 'complex';
  if (score >= 2) return 'moderate';
  return 'simple';
}

function mergeDistributions(
  a: BenchmarkResult,
  b: BenchmarkResult,
): { bucket: string; countA: number; countB: number }[] {
  return a.distribution.map((d, i) => ({
    bucket: d.bucket,
    countA: d.count,
    countB: b.distribution[i]?.count ?? 0,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────────

export function QueryBenchmark() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);
  const dialect = project?.dialect || 'postgresql';
  const createRun = useCreatePerformanceRun();

  // --- State ---
  const [sql, setSql] = useState('');
  const [comparisonSql, setComparisonSql] = useState('');
  const [iterations, setIterations] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<BenchmarkResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // AI states
  const [activeMode, setActiveMode] = useState<ActiveMode>('benchmark');
  const [nlDescription, setNlDescription] = useState('');
  const [generatedResult, setGeneratedResult] = useState<GeneratedSQL | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<QueryOptimization | null>(null);
  const [explanationResult, setExplanationResult] = useState<QueryExplanation | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = useCallback((text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {
      // Fallback for non-HTTPS contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

  // AI hooks
  const generateSQL = useGenerateSQL();
  const optimizeQuery = useOptimizeQuery();
  const explainQuery = useExplainQuery();

  // --- Handlers ---

  const handleRunBenchmark = useCallback(async () => {
    if (!sql.trim() || !projectId) return;
    setIsRunning(true);
    setResult(null);
    setComparisonResult(null);

    try {
      await createRun.mutateAsync({
        projectId,
        type: 'benchmark',
        name: `Benchmark: ${iterations} iterations`,
        config: { sql, iterations, comparisonSql: showComparison ? comparisonSql : undefined },
      });

      // Simulate benchmark with complexity-aware timing
      await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 800));
      const complexity = estimateComplexity(sql);
      setResult(generateSimulatedResults(iterations, complexity));

      if (showComparison && comparisonSql.trim()) {
        await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));
        const compComplexity = estimateComplexity(comparisonSql);
        setComparisonResult(generateSimulatedResults(iterations, compComplexity));
      }
    } catch {
      // Error handled by mutation
    } finally {
      setIsRunning(false);
    }
  }, [sql, comparisonSql, iterations, projectId, showComparison, createRun]);

  const handleGenerateSQL = useCallback(async () => {
    if (!nlDescription.trim() || !projectId) return;
    setGeneratedResult(null);
    try {
      const res = await generateSQL.mutateAsync({
        projectId,
        naturalLanguage: nlDescription,
        dialect,
      });
      setGeneratedResult(res);
    } catch {
      // handled by mutation
    }
  }, [nlDescription, projectId, dialect, generateSQL]);

  const handleOptimizeQuery = useCallback(async () => {
    if (!sql.trim() || !projectId) return;
    setOptimizationResult(null);
    try {
      const res = await optimizeQuery.mutateAsync({
        projectId,
        sql,
        dialect,
      });
      setOptimizationResult(res);
    } catch {
      // handled by mutation
    }
  }, [sql, projectId, dialect, optimizeQuery]);

  const handleExplainQuery = useCallback(async () => {
    if (!sql.trim() || !projectId) return;
    setExplanationResult(null);
    try {
      const res = await explainQuery.mutateAsync({
        projectId,
        sql,
        dialect,
      });
      setExplanationResult(res);
    } catch {
      // handled by mutation
    }
  }, [sql, projectId, dialect, explainQuery]);

  const handleUseGeneratedSQL = useCallback(
    (sqlText: string) => {
      setSql(sqlText);
      setActiveMode('benchmark');
    },
    [],
  );

  const handleApplyOptimized = useCallback(() => {
    if (!optimizationResult?.optimizedSQL) return;
    // Keep original in comparison mode
    setShowComparison(true);
    setComparisonSql(sql);
    setSql(optimizationResult.optimizedSQL);
    setActiveMode('benchmark');
  }, [optimizationResult, sql]);

  const handleCopyStats = useCallback(() => {
    if (!result) return;
    const lines = [
      `Benchmark Results (${result.iterations} iterations)`,
      `Min: ${result.minMs}ms | Max: ${result.maxMs}ms`,
      `Avg: ${result.avgMs}ms | Median: ${result.medianMs}ms`,
      `P95: ${result.p95Ms}ms | P99: ${result.p99Ms}ms`,
      `StdDev: ${result.stdDev}ms | Throughput: ${result.throughputQps} QPS`,
    ];
    if (comparisonResult) {
      lines.push('', `Comparison Query:`,
        `Avg: ${comparisonResult.avgMs}ms | Median: ${comparisonResult.medianMs}ms`,
        `P95: ${comparisonResult.p95Ms}ms | P99: ${comparisonResult.p99Ms}ms`,
      );
    }
    navigator.clipboard.writeText(lines.join('\n'));
  }, [result, comparisonResult]);

  // Merged chart data for comparison
  const chartData = useMemo(() => {
    if (!result) return [];
    if (showComparison && comparisonResult) {
      return mergeDistributions(result, comparisonResult);
    }
    return result.distribution;
  }, [result, comparisonResult, showComparison]);

  // Improvement percentage for optimization
  const improvementPct = useMemo(() => {
    if (!optimizationResult?.estimatedImprovement) return null;
    const match = optimizationResult.estimatedImprovement.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }, [optimizationResult]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: 'benchmark' as const, label: 'Benchmark', icon: Timer, desc: 'Run query benchmarks' },
          { id: 'generate' as const, label: 'AI Generate', icon: Sparkles, desc: 'Generate SQL from description' },
          { id: 'optimize' as const, label: 'AI Optimize', icon: Zap, desc: 'Optimize your query' },
          { id: 'explain' as const, label: 'AI Explain', icon: Search, desc: 'Explain query step-by-step' },
        ] as const).map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all',
                isActive
                  ? mode.id === 'generate'
                    ? 'bg-gradient-to-r from-violet-50 to-purple-50 border-violet-300 text-violet-700 shadow-sm'
                    : mode.id === 'optimize'
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-700 shadow-sm'
                    : mode.id === 'explain'
                    ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300 text-blue-700 shadow-sm'
                    : 'bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-300 text-emerald-700 shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
              title={mode.desc}
            >
              <Icon className="w-4 h-4" />
              {mode.label}
            </button>
          );
        })}

        <span className="ml-auto text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 px-2.5 py-1 rounded-md">
          {dialect}
        </span>
      </div>

      {/* ═══════════════════ AI GENERATE MODE ═══════════════════ */}
      {activeMode === 'generate' && (
        <div className="space-y-5">
          {/* Description Input */}
          <div className="bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h4 className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Describe Your Query
              </h4>
              {nlDescription.trim() && (
                <button
                  onClick={() => { setNlDescription(''); setGeneratedResult(null); }}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={nlDescription}
              onChange={(e) => setNlDescription(e.target.value)}
              placeholder="Describe what data you want to retrieve in plain English..."
              rows={3}
              className="w-full px-4 py-3 text-sm bg-card rounded-lg border border-violet-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-y"
            />

            {/* Sample Descriptions */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase mr-1 self-center">
                Try:
              </span>
              {SAMPLE_DESCRIPTIONS.map((desc, i) => (
                <button
                  key={i}
                  onClick={() => setNlDescription(desc)}
                  className="text-[11px] px-2.5 py-1 bg-card border border-violet-200 rounded-full text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-colors truncate max-w-[280px]"
                  title={desc}
                >
                  {desc}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleGenerateSQL}
                disabled={generateSQL.isPending || !nlDescription.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  generateSQL.isPending || !nlDescription.trim()
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700',
                )}
              >
                {generateSQL.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate SQL
                  </>
                )}
              </button>
              {generateSQL.isError && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {generateSQL.error?.message || 'Failed to generate SQL'}
                </span>
              )}
            </div>
          </div>

          {/* Generated SQL Results */}
          {generatedResult && (
            <div className="space-y-4">
              {/* Main Generated SQL */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                  <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    Generated SQL
                  </h5>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyText(generatedResult.sql, 'generated')}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedField === 'generated' ? (
                        <><Check className="w-3 h-3 text-green-600" /> Copied!</>
                      ) : (
                        <><ClipboardCopy className="w-3 h-3" /> Copy</>
                      )}
                    </button>
                    <button
                      onClick={() => handleUseGeneratedSQL(generatedResult.sql)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3" />
                      Use in Benchmark
                    </button>
                  </div>
                </div>
                <pre className="px-4 py-4 text-sm font-mono bg-[#1e293b] text-slate-100 overflow-x-auto whitespace-pre-wrap min-h-[120px] max-h-[400px] overflow-y-auto leading-relaxed">
                  {generatedResult.sql || '-- No SQL was generated. Try rephrasing your description.'}
                </pre>
              </div>

              {/* Explanation */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h6 className="text-xs font-semibold text-blue-800 mb-1">Explanation</h6>
                    <p className="text-sm text-blue-700">{generatedResult.explanation}</p>
                  </div>
                </div>
              </div>

              {/* Assumptions */}
              {generatedResult.assumptions?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h6 className="text-xs font-semibold text-amber-800 mb-1">Assumptions</h6>
                      <ul className="text-sm text-amber-700 space-y-0.5">
                        {generatedResult.assumptions.map((a, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400 mt-1">&#8226;</span>
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {generatedResult.warnings?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h6 className="text-xs font-semibold text-red-800 mb-1">Warnings</h6>
                      <ul className="text-sm text-red-700 space-y-0.5">
                        {generatedResult.warnings.map((w, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-red-400 mt-1">&#8226;</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Alternative Approaches */}
              {generatedResult.alternativeApproaches?.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowAlternatives(!showAlternatives)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-muted-foreground" />
                      Alternative Approaches ({generatedResult.alternativeApproaches.length})
                    </span>
                    {showAlternatives ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {showAlternatives && (
                    <div className="divide-y divide-border/50">
                      {generatedResult.alternativeApproaches.map((alt, i) => (
                        <div key={i} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              {alt.description}
                            </p>
                            <button
                              onClick={() => handleUseGeneratedSQL(alt.sql)}
                              className="text-[11px] px-2.5 py-1 font-medium text-emerald-600 border border-emerald-200 rounded-md hover:bg-emerald-50 transition-colors"
                            >
                              Use This
                            </button>
                          </div>
                          <pre className="px-3 py-2 text-xs font-mono bg-[#1e293b] text-slate-200 rounded-md overflow-x-auto whitespace-pre-wrap">
                            {alt.sql}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ AI OPTIMIZE MODE ═══════════════════ */}
      {activeMode === 'optimize' && (
        <div className="space-y-5">
          {/* SQL Input for Optimization */}
          <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-semibold text-amber-800">
                Query to Optimize
              </h4>
              {sql.trim() && (
                <button
                  onClick={() => { setSql(''); setOptimizationResult(null); }}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="Paste your SQL query here for AI-powered optimization..."
              rows={6}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-y selection:bg-amber-500/30 caret-amber-400"
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleOptimizeQuery}
                disabled={optimizeQuery.isPending || !sql.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  optimizeQuery.isPending || !sql.trim()
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600',
                )}
              >
                {optimizeQuery.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Optimize Query
                  </>
                )}
              </button>
              {optimizeQuery.isError && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {optimizeQuery.error?.message || 'Optimization failed'}
                </span>
              )}
            </div>
          </div>

          {/* Optimization Results */}
          {optimizationResult && (
            <div className="space-y-4">
              {/* Improvement Banner */}
              <div className={cn(
                'rounded-xl p-4 flex items-center justify-between',
                improvementPct && improvementPct >= 30
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                  : improvementPct && improvementPct >= 10
                  ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200'
                  : 'bg-gradient-to-r from-muted/50 to-muted/30 border border-border',
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    improvementPct && improvementPct >= 30 ? 'bg-green-100' : improvementPct && improvementPct >= 10 ? 'bg-blue-100' : 'bg-muted',
                  )}>
                    <TrendingDown className={cn(
                      'w-5 h-5',
                      improvementPct && improvementPct >= 30 ? 'text-green-600' : improvementPct && improvementPct >= 10 ? 'text-blue-600' : 'text-muted-foreground',
                    )} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Estimated Improvement: {optimizationResult.estimatedImprovement}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {optimizationResult.changes?.length ?? 0} optimization(s) applied
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleApplyOptimized}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Apply & Compare
                </button>
              </div>

              {/* Optimized SQL */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                  <h5 className="text-sm font-semibold text-foreground">
                    Optimized SQL
                  </h5>
                  <button
                    onClick={() => handleCopyText(optimizationResult.optimizedSQL, 'optimized')}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === 'optimized' ? (
                      <><Check className="w-3 h-3 text-green-600" /> Copied!</>
                    ) : (
                      <><ClipboardCopy className="w-3 h-3" /> Copy</>
                    )}
                  </button>
                </div>
                <pre className="px-4 py-3 text-sm font-mono bg-[#1e293b] text-green-300 overflow-x-auto whitespace-pre-wrap">
                  {optimizationResult.optimizedSQL}
                </pre>
              </div>

              {/* Changes List */}
              {optimizationResult.changes?.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-muted/50 border-b border-border">
                    <h5 className="text-sm font-semibold text-foreground">
                      Optimization Details
                    </h5>
                  </div>
                  <div className="divide-y divide-border/50">
                    {optimizationResult.changes.map((change, i) => (
                      <div key={i} className="px-4 py-3 flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full',
                            change.impact === 'HIGH'
                              ? 'bg-green-100 text-green-700'
                              : change.impact === 'MEDIUM'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {change.impact}
                        </span>
                        <div>
                          <p className="text-sm text-foreground">{change.description}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{change.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Index Recommendations */}
              {optimizationResult.indexRecommendations?.length > 0 && (
                <div className="bg-card border border-amber-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                    <h5 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      Recommended Indexes
                    </h5>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {optimizationResult.indexRecommendations.map((idx, i) => (
                      <div key={i} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">{idx.reason}</p>
                          <span className="text-[10px] text-amber-600 font-medium">
                            {idx.estimatedImpact}
                          </span>
                        </div>
                        <pre className="px-3 py-2 text-xs font-mono bg-[#1e293b] text-amber-300 rounded-md overflow-x-auto">
                          {idx.createStatement}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {optimizationResult.warnings?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h6 className="text-xs font-semibold text-red-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warnings
                  </h6>
                  <ul className="space-y-1">
                    {optimizationResult.warnings.map((w, i) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                        <span className="text-red-400 mt-1">&#8226;</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ AI EXPLAIN MODE ═══════════════════ */}
      {activeMode === 'explain' && (
        <div className="space-y-5">
          {/* SQL Input for Explanation */}
          <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-800">
                Query to Explain
              </h4>
              {sql.trim() && (
                <button
                  onClick={() => { setSql(''); setExplanationResult(null); }}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="Paste your SQL query here for AI-powered explanation..."
              rows={6}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-y selection:bg-blue-500/30 caret-blue-400"
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleExplainQuery}
                disabled={explainQuery.isPending || !sql.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  explainQuery.isPending || !sql.trim()
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700',
                )}
              >
                {explainQuery.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Explain Query
                  </>
                )}
              </button>
              {explainQuery.isError && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {explainQuery.error?.message || 'Explanation failed'}
                </span>
              )}
            </div>
          </div>

          {/* Explanation Results */}
          {explanationResult && (
            <div className="space-y-4">
              {/* Summary + Complexity */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    Summary
                  </h5>
                  <span
                    className={cn(
                      'px-2.5 py-1 text-[10px] font-bold uppercase rounded-full',
                      explanationResult.complexity === 'SIMPLE'
                        ? 'bg-green-100 text-green-700'
                        : explanationResult.complexity === 'MODERATE'
                        ? 'bg-blue-100 text-blue-700'
                        : explanationResult.complexity === 'COMPLEX'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700',
                    )}
                  >
                    {explanationResult.complexity}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {explanationResult.summary}
                </p>
              </div>

              {/* Step by Step */}
              {explanationResult.stepByStep?.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSteps(!expandedSteps)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-blue-500" />
                      Step-by-Step Breakdown ({explanationResult.stepByStep.length} steps)
                    </span>
                    {expandedSteps ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {expandedSteps && (
                    <div className="divide-y divide-border/50">
                      {explanationResult.stepByStep.map((step, i) => (
                        <div key={i} className="p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                              {step.clause}
                            </span>
                          </div>
                          <pre className="px-3 py-2 text-xs font-mono bg-[#1e293b] text-slate-200 rounded-md mb-2 overflow-x-auto whitespace-pre-wrap">
                            {step.sql}
                          </pre>
                          <p className="text-sm text-muted-foreground pl-9">
                            {step.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tables Used + Output Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {explanationResult.tablesUsed?.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <h6 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                      Tables Referenced
                    </h6>
                    <div className="space-y-2">
                      {explanationResult.tablesUsed.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {t.name}
                          </span>
                          {t.alias && t.alias !== t.name && (
                            <span className="text-muted-foreground text-xs">as {t.alias}</span>
                          )}
                          <span className="text-muted-foreground text-xs ml-auto">{t.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {explanationResult.outputColumns?.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <h6 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                      Output Columns
                    </h6>
                    <div className="space-y-2">
                      {explanationResult.outputColumns.map((col, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-mono text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                            {col.alias || col.expression}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5 pl-1">
                            {col.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Performance Notes */}
              {explanationResult.performanceNotes?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h6 className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Performance Notes
                  </h6>
                  <ul className="space-y-1">
                    {explanationResult.performanceNotes.map((note, i) => (
                      <li key={i} className="text-sm text-amber-700 flex items-start gap-1.5">
                        <span className="text-amber-400 mt-1">&#8226;</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Filters */}
              {explanationResult.filters?.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h6 className="text-xs font-semibold text-foreground mb-2">
                    Active Filters
                  </h6>
                  <div className="flex flex-wrap gap-2">
                    {explanationResult.filters.map((f, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 text-xs font-mono bg-muted text-foreground rounded-md border border-border"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ BENCHMARK MODE ═══════════════════ */}
      {activeMode === 'benchmark' && (
        <>
          {/* SQL Input Section */}
          <div className={cn('grid gap-4', showComparison ? 'grid-cols-2' : 'grid-cols-1')}>
            {/* Primary Query */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  {showComparison ? 'Query A' : 'SQL Query'}
                </label>
                <div className="flex items-center gap-2">
                  {sql.trim() && (
                    <button
                      onClick={() => { setSql(''); setResult(null); setComparisonResult(null); }}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                  {!showComparison && (
                    <button
                      onClick={() => setShowComparison(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-aqua-600 hover:text-aqua-700 transition-colors"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      Compare Mode
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="SELECT * FROM users WHERE active = true ORDER BY created_at DESC;"
                rows={6}
                spellCheck={false}
                className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
              />
            </div>

            {/* Comparison Query */}
            {showComparison && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Query B</label>
                  <button
                    onClick={() => {
                      setShowComparison(false);
                      setComparisonSql('');
                      setComparisonResult(null);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Remove
                  </button>
                </div>
                <textarea
                  value={comparisonSql}
                  onChange={(e) => setComparisonSql(e.target.value)}
                  placeholder="Paste optimized or alternative query here..."
                  rows={6}
                  spellCheck={false}
                  className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
                />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Iterations:</label>
              <div className="flex gap-1">
                {ITERATION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setIterations(opt)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                      iterations === opt
                        ? 'bg-aqua-50 border-aqua-300 text-aqua-700'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={isRunning || !sql.trim()}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                isRunning || !sql.trim()
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700',
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Benchmarking...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Benchmark
                </>
              )}
            </button>

            {/* Quick AI actions from benchmark mode */}
            {sql.trim() && (
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => { setActiveMode('optimize'); handleOptimizeQuery(); }}
                  disabled={optimizeQuery.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  {optimizeQuery.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Optimize
                </button>
                <button
                  onClick={() => { setActiveMode('explain'); handleExplainQuery(); }}
                  disabled={explainQuery.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {explainQuery.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  Explain
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setSql(
                  "SELECT o.id, o.total, u.name, u.email\nFROM orders o\nJOIN users u ON u.id = o.customer_id\nWHERE o.created_at > '2025-01-01'\n  AND o.status = 'completed'\nORDER BY o.created_at DESC\nLIMIT 100;",
                );
                setShowComparison(true);
                setComparisonSql(
                  "SELECT o.id, o.total, u.name, u.email\nFROM orders o\nJOIN users u ON u.id = o.customer_id\nWHERE o.created_at > '2025-01-01'\n  AND o.status = 'completed'\n  AND o.customer_id IN (SELECT id FROM users WHERE active = true)\nORDER BY o.created_at DESC\nLIMIT 100;",
                );
                setIterations(100);
                const r1 = generateSimulatedResults(100, 'moderate');
                const r2 = generateSimulatedResults(100, 'complex');
                setResult(r1);
                setComparisonResult(r2);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <FlaskConical className="w-4 h-4" />
              Load Demo
            </button>
          </div>

          {/* Benchmark Results */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Timer className="w-4 h-4 text-aqua-600" />
                  Benchmark Results
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({result.iterations} iterations)
                  </span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setResult(null);
                      setComparisonResult(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear
                  </button>
                  <button
                    onClick={handleCopyStats}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy Stats
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className={cn(
                'grid gap-3',
                showComparison && comparisonResult ? 'grid-cols-1' : 'grid-cols-4 md:grid-cols-8',
              )}>
                {showComparison && comparisonResult ? (
                  /* Side by side comparison */
                  <div className="col-span-full">
                    <div className="grid grid-cols-9 gap-2 text-center">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase" />
                      {(['Min', 'Max', 'Avg', 'Median', 'P95', 'P99', 'StdDev', 'QPS'] as const).map(
                        (label) => (
                          <div
                            key={label}
                            className="text-[10px] font-semibold text-muted-foreground uppercase"
                          >
                            {label}
                          </div>
                        ),
                      )}

                      {/* Query A row */}
                      <div className="text-xs font-semibold text-aqua-700 bg-aqua-50 rounded-lg py-2 flex items-center justify-center">
                        Query A
                      </div>
                      {[
                        result.minMs,
                        result.maxMs,
                        result.avgMs,
                        result.medianMs,
                        result.p95Ms,
                        result.p99Ms,
                        result.stdDev,
                        result.throughputQps,
                      ].map((val, i) => (
                        <div
                          key={i}
                          className="bg-card border border-border rounded-lg py-2 text-sm font-bold text-foreground"
                        >
                          {val}
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            {i === 7 ? '/s' : 'ms'}
                          </span>
                        </div>
                      ))}

                      {/* Query B row */}
                      <div className="text-xs font-semibold text-purple-700 bg-purple-50 rounded-lg py-2 flex items-center justify-center">
                        Query B
                      </div>
                      {[
                        comparisonResult.minMs,
                        comparisonResult.maxMs,
                        comparisonResult.avgMs,
                        comparisonResult.medianMs,
                        comparisonResult.p95Ms,
                        comparisonResult.p99Ms,
                        comparisonResult.stdDev,
                        comparisonResult.throughputQps,
                      ].map((val, i) => {
                        const refVal = [
                          result.minMs,
                          result.maxMs,
                          result.avgMs,
                          result.medianMs,
                          result.p95Ms,
                          result.p99Ms,
                          result.stdDev,
                          result.throughputQps,
                        ][i];
                        // For QPS (i===7), higher is better; for all others, lower is better
                        const isBetter = i === 7 ? val > refVal : val < refVal;
                        const isWorse = i === 7 ? val < refVal : val > refVal;
                        return (
                          <div
                            key={i}
                            className={cn(
                              'border rounded-lg py-2 text-sm font-bold',
                              isBetter
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : isWorse
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-card border-border text-foreground',
                            )}
                          >
                            {val}
                            <span className="text-[10px] ml-0.5 opacity-60">
                              {i === 7 ? '/s' : 'ms'}
                            </span>
                          </div>
                        );
                      })}

                      {/* Delta row */}
                      <div className="text-xs font-semibold text-muted-foreground bg-muted/50 rounded-lg py-2 flex items-center justify-center">
                        Delta
                      </div>
                      {[
                        result.minMs,
                        result.maxMs,
                        result.avgMs,
                        result.medianMs,
                        result.p95Ms,
                        result.p99Ms,
                        result.stdDev,
                        result.throughputQps,
                      ].map((refVal, i) => {
                        const bVal = [
                          comparisonResult.minMs,
                          comparisonResult.maxMs,
                          comparisonResult.avgMs,
                          comparisonResult.medianMs,
                          comparisonResult.p95Ms,
                          comparisonResult.p99Ms,
                          comparisonResult.stdDev,
                          comparisonResult.throughputQps,
                        ][i];
                        const diff = round(bVal - refVal);
                        const pct = refVal !== 0 ? round((diff / refVal) * 100) : 0;
                        const isPositive = diff > 0;
                        // For QPS, positive diff is better; for latency, negative diff is better
                        const isGood = i === 7 ? isPositive : !isPositive;
                        return (
                          <div
                            key={i}
                            className={cn(
                              'rounded-lg py-2 text-xs font-bold border',
                              diff === 0
                                ? 'bg-muted/50 border-border text-muted-foreground'
                                : isGood
                                ? 'bg-green-50 border-green-200 text-green-600'
                                : 'bg-red-50 border-red-200 text-red-600',
                            )}
                          >
                            {diff > 0 ? '+' : ''}
                            {pct}%
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Single result stats */
                  [
                    { label: 'Min', value: result.minMs, unit: 'ms' },
                    { label: 'Max', value: result.maxMs, unit: 'ms' },
                    { label: 'Avg', value: result.avgMs, unit: 'ms' },
                    { label: 'Median', value: result.medianMs, unit: 'ms' },
                    { label: 'P95', value: result.p95Ms, unit: 'ms' },
                    { label: 'P99', value: result.p99Ms, unit: 'ms' },
                    { label: 'StdDev', value: result.stdDev, unit: 'ms' },
                    { label: 'Throughput', value: result.throughputQps, unit: 'QPS' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-card border border-border rounded-lg p-3 text-center"
                    >
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                        {stat.label}
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {stat.value}
                        <span className="text-xs text-muted-foreground ml-0.5">
                          {stat.unit}
                        </span>
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Distribution Chart */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h5 className="text-xs font-semibold text-foreground mb-3">
                  Execution Time Distribution
                </h5>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        label={{
                          value: 'Count',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 11, fill: '#94a3b8' },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        }}
                      />
                      {showComparison && comparisonResult ? (
                        <>
                          <Legend
                            wrapperStyle={{ fontSize: 12 }}
                            formatter={(value) =>
                              value === 'countA' ? 'Query A' : 'Query B'
                            }
                          />
                          <Bar
                            dataKey="countA"
                            fill="#0891b2"
                            radius={[4, 4, 0, 0]}
                            name="countA"
                          />
                          <Bar
                            dataKey="countB"
                            fill="#9333ea"
                            radius={[4, 4, 0, 0]}
                            name="countB"
                          />
                        </>
                      ) : (
                        <Bar
                          dataKey="count"
                          fill="#0891b2"
                          radius={[4, 4, 0, 0]}
                          name="Executions"
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick insight after benchmark */}
              {result && !optimizationResult && sql.trim() && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Want to improve this query?
                      </p>
                      <p className="text-xs text-amber-600">
                        Let AI analyze and optimize your SQL for better performance
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveMode('optimize');
                      handleOptimizeQuery();
                    }}
                    disabled={optimizeQuery.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    {optimizeQuery.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Optimize with AI
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default QueryBenchmark;
