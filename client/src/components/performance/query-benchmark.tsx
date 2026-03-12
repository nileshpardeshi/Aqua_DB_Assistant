import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Play,
  Loader2,
  Timer,
  Copy,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useCreatePerformanceRun } from '@/hooks/use-performance';

const ITERATION_OPTIONS = [10, 50, 100, 500];

interface BenchmarkResult {
  iterations: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  distribution: { bucket: string; count: number }[];
}

// Generate mock benchmark results for demonstration
function generateMockResults(iterations: number): BenchmarkResult {
  const base = 10 + Math.random() * 50;
  const variance = base * 0.4;
  const times: number[] = Array.from({ length: iterations }, () =>
    Math.max(1, base + (Math.random() - 0.5) * 2 * variance)
  );
  times.sort((a, b) => a - b);

  const buckets = ['0-10ms', '10-25ms', '25-50ms', '50-100ms', '100-200ms', '200ms+'];
  const thresholds = [10, 25, 50, 100, 200, Infinity];
  const distribution = buckets.map((bucket, i) => ({
    bucket,
    count: times.filter(
      (t) => t <= thresholds[i] && (i === 0 || t > thresholds[i - 1])
    ).length,
  }));

  return {
    iterations,
    minMs: Math.round(times[0] * 100) / 100,
    maxMs: Math.round(times[times.length - 1] * 100) / 100,
    avgMs: Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100,
    medianMs: Math.round(times[Math.floor(times.length / 2)] * 100) / 100,
    p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 100) / 100,
    p99Ms: Math.round(times[Math.floor(times.length * 0.99)] * 100) / 100,
    distribution,
  };
}

export function QueryBenchmark() {
  const { projectId } = useParams();
  const createRun = useCreatePerformanceRun();

  const [sql, setSql] = useState('');
  const [comparisonSql, setComparisonSql] = useState('');
  const [iterations, setIterations] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<BenchmarkResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);

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

      // Simulate results
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setResult(generateMockResults(iterations));

      if (showComparison && comparisonSql.trim()) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setComparisonResult(generateMockResults(iterations));
      }
    } catch {
      // Error handled by mutation
    } finally {
      setIsRunning(false);
    }
  }, [sql, comparisonSql, iterations, projectId, showComparison, createRun]);

  const handleCopyStats = useCallback(() => {
    if (!result) return;
    const stats = `Benchmark Results (${result.iterations} iterations)\nMin: ${result.minMs}ms\nMax: ${result.maxMs}ms\nAvg: ${result.avgMs}ms\nMedian: ${result.medianMs}ms\nP95: ${result.p95Ms}ms\nP99: ${result.p99Ms}ms`;
    navigator.clipboard.writeText(stats);
  }, [result]);

  return (
    <div className="space-y-6">
      {/* SQL Input Section */}
      <div className={cn('grid gap-4', showComparison ? 'grid-cols-2' : 'grid-cols-1')}>
        {/* Primary Query */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-700">
              {showComparison ? 'Query A' : 'SQL Query'}
            </label>
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
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="SELECT * FROM users WHERE active = true ORDER BY created_at DESC;"
            rows={6}
            spellCheck={false}
            className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
          />
        </div>

        {/* Comparison Query */}
        {showComparison && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-700">Query B</label>
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
              placeholder="SELECT * FROM users WHERE active = true AND role = 'admin' ORDER BY created_at DESC;"
              rows={6}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Iterations:</label>
          <div className="flex gap-1">
            {ITERATION_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setIterations(opt)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                  iterations === opt
                    ? 'bg-aqua-50 border-aqua-300 text-aqua-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
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
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Timer className="w-4 h-4 text-aqua-600" />
              Benchmark Results
            </h4>
            <button
              onClick={handleCopyStats}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy Stats
            </button>
          </div>

          {/* Stats Cards */}
          <div className={cn('grid gap-3', showComparison && comparisonResult ? 'grid-cols-1' : 'grid-cols-3 md:grid-cols-6')}>
            {showComparison && comparisonResult ? (
              /* Side by side comparison */
              <div className="col-span-full">
                <div className="grid grid-cols-7 gap-2 text-center">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase" />
                  {(['Min', 'Max', 'Avg', 'Median', 'P95', 'P99'] as const).map((label) => (
                    <div key={label} className="text-[10px] font-semibold text-slate-500 uppercase">
                      {label}
                    </div>
                  ))}

                  {/* Query A row */}
                  <div className="text-xs font-semibold text-aqua-700 bg-aqua-50 rounded-lg py-2 flex items-center justify-center">
                    Query A
                  </div>
                  {[result.minMs, result.maxMs, result.avgMs, result.medianMs, result.p95Ms, result.p99Ms].map(
                    (val, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-200 rounded-lg py-2 text-sm font-bold text-slate-800"
                      >
                        {val}
                        <span className="text-[10px] text-slate-400 ml-0.5">ms</span>
                      </div>
                    )
                  )}

                  {/* Query B row */}
                  <div className="text-xs font-semibold text-purple-700 bg-purple-50 rounded-lg py-2 flex items-center justify-center">
                    Query B
                  </div>
                  {[comparisonResult.minMs, comparisonResult.maxMs, comparisonResult.avgMs, comparisonResult.medianMs, comparisonResult.p95Ms, comparisonResult.p99Ms].map(
                    (val, i) => {
                      const refVal = [result.minMs, result.maxMs, result.avgMs, result.medianMs, result.p95Ms, result.p99Ms][i];
                      const isBetter = val < refVal;
                      const isWorse = val > refVal;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'border rounded-lg py-2 text-sm font-bold',
                            isBetter
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : isWorse
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-white border-slate-200 text-slate-800'
                          )}
                        >
                          {val}
                          <span className="text-[10px] ml-0.5 opacity-60">ms</span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            ) : (
              /* Single result stats */
              [
                { label: 'Min', value: result.minMs },
                { label: 'Max', value: result.maxMs },
                { label: 'Avg', value: result.avgMs },
                { label: 'Median', value: result.medianMs },
                { label: 'P95', value: result.p95Ms },
                { label: 'P99', value: result.p99Ms },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white border border-slate-200 rounded-lg p-3 text-center"
                >
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    {stat.label}
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {stat.value}
                    <span className="text-xs text-slate-400 ml-0.5">ms</span>
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Chart */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h5 className="text-xs font-semibold text-slate-700 mb-3">
              Execution Time Distribution
            </h5>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.distribution}>
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
                  <Bar
                    dataKey="count"
                    fill="#0891b2"
                    radius={[4, 4, 0, 0]}
                    name="Executions"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QueryBenchmark;
