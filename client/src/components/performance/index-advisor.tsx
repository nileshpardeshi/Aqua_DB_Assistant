import React, { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  ArrowRight,
  Search,
  Zap,
  TrendingDown,
  Minus,
  AlertTriangle,
  Download,
  RefreshCw,
  Database,
  FlaskConical,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import { useProject } from '@/hooks/use-projects';

interface IndexRecommendation {
  createStatement: string;
  dropStatement?: string;
  table: string;
  columns: string[];
  type: string;
  isUnique: boolean;
  isPartial: boolean;
  partialCondition?: string | null;
  reason: string;
  queryPatterns?: string[];
  estimatedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  writeOverheadImpact?: string;
}

interface RedundantIndex {
  indexName: string;
  reason: string;
  recommendation: string;
}

interface IndexAnalysisResult {
  recommendations: IndexRecommendation[];
  redundantIndexes?: RedundantIndex[];
  summary: string;
}

const IMPACT_CONFIG = {
  HIGH: {
    label: 'High Impact',
    icon: Zap,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  MEDIUM: {
    label: 'Medium Impact',
    icon: TrendingDown,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  LOW: {
    label: 'Low Impact',
    icon: Minus,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
};

const ANALYSIS_STEPS = [
  { label: 'Parsing query patterns', icon: Search },
  { label: 'Analyzing table structures', icon: Database },
  { label: 'Evaluating index candidates', icon: Zap },
  { label: 'Generating recommendations', icon: Sparkles },
];

export function IndexAdvisor() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);

  const [slowQueries, setSlowQueries] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<IndexAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedIndexes, setAppliedIndexes] = useState<Set<number>>(new Set());
  const [reanalysisResult, setReanalysisResult] = useState<IndexAnalysisResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!projectId) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setAppliedIndexes(new Set());
    setReanalysisResult(null);

    setAnalysisStep(0);
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep(prev => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 1200);

    try {
      const queryPatterns = slowQueries
        .split(';')
        .map((q) => q.trim())
        .filter(Boolean);

      const response = await apiClient.post('/ai/performance/recommend-indexes', {
        projectId,
        dialect: project?.dialect || 'postgresql',
        queryPatterns,
      });

      const data = response as unknown as {
        recommendations: IndexAnalysisResult;
      };

      const analysisResult = data.recommendations as unknown as IndexAnalysisResult;
      if (analysisResult?.recommendations) {
        setResult(analysisResult);
      } else {
        setResult({
          recommendations: [],
          summary: 'Analysis complete but no recommendations returned.',
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to analyze. Ensure AI provider is configured in Settings.'
      );
    } finally {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setAnalysisStep(0);
      setIsAnalyzing(false);
    }
  }, [slowQueries, projectId, project?.dialect]);

  const handleReanalyze = useCallback(async () => {
    if (!projectId || !result) return;
    setIsAnalyzing(true);

    setAnalysisStep(0);
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep(prev => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 1200);

    try {
      const appliedDDL = result.recommendations
        .filter((_, i) => appliedIndexes.has(i))
        .map((r) => r.createStatement)
        .join('\n');

      const queryPatterns = slowQueries
        .split(';')
        .map((q) => q.trim())
        .filter(Boolean);

      // Append applied indexes context to query patterns
      const enrichedPatterns = [
        ...queryPatterns,
        `-- The following indexes have been applied:\n${appliedDDL}`,
      ];

      const response = await apiClient.post('/ai/performance/recommend-indexes', {
        projectId,
        dialect: project?.dialect || 'postgresql',
        queryPatterns: enrichedPatterns,
      });

      const data = response as unknown as {
        recommendations: IndexAnalysisResult;
      };

      const analysisResult = data.recommendations as unknown as IndexAnalysisResult;
      if (analysisResult?.recommendations) {
        setReanalysisResult(analysisResult);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to re-analyze.'
      );
    } finally {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setAnalysisStep(0);
      setIsAnalyzing(false);
    }
  }, [slowQueries, projectId, project?.dialect, result, appliedIndexes]);

  const handleLoadDemo = useCallback(() => {
    setSlowQueries(
      `SELECT o.*, u.name FROM orders o\nJOIN users u ON u.id = o.customer_id\nWHERE o.created_at > '2025-01-01'\nORDER BY o.created_at DESC;\n\nSELECT * FROM products\nWHERE category_id = 5 AND price BETWEEN 10 AND 100;\n\nSELECT COUNT(*) FROM events\nWHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days';`
    );
    setResult({
      recommendations: [
        {
          createStatement: 'CREATE INDEX idx_orders_customer_created ON orders (customer_id, created_at DESC);',
          table: 'orders',
          columns: ['customer_id', 'created_at'],
          type: 'btree',
          isUnique: false,
          isPartial: false,
          reason: 'Composite index supports the JOIN on customer_id and ORDER BY on created_at, enabling an index-only scan for the most frequent query pattern.',
          queryPatterns: [
            'JOIN users u ON u.id = o.customer_id',
            'WHERE o.created_at > ... ORDER BY o.created_at DESC',
          ],
          estimatedImpact: 'HIGH',
          writeOverheadImpact: 'Minimal - read-heavy table',
        },
        {
          createStatement: "CREATE INDEX idx_orders_created_completed ON orders (created_at DESC) WHERE status = 'completed';",
          table: 'orders',
          columns: ['created_at'],
          type: 'btree',
          isUnique: false,
          isPartial: true,
          partialCondition: "status = 'completed'",
          reason: 'Partial index on created_at filtered to completed orders reduces index size and speeds up queries that only target completed orders.',
          queryPatterns: [
            "WHERE status = 'completed' AND created_at > ...",
          ],
          estimatedImpact: 'MEDIUM',
          writeOverheadImpact: 'Low',
        },
        {
          createStatement: 'CREATE INDEX idx_products_category_price ON products (category_id, price);',
          table: 'products',
          columns: ['category_id', 'price'],
          type: 'btree',
          isUnique: false,
          isPartial: false,
          reason: 'Composite index covers the equality filter on category_id and range scan on price, avoiding a full table scan on the products table.',
          queryPatterns: [
            'WHERE category_id = ? AND price BETWEEN ? AND ?',
          ],
          estimatedImpact: 'HIGH',
          writeOverheadImpact: 'Moderate - frequent inserts',
        },
        {
          createStatement: 'CREATE INDEX idx_events_type_created ON events (event_type, created_at);',
          table: 'events',
          columns: ['event_type', 'created_at'],
          type: 'btree',
          isUnique: false,
          isPartial: false,
          reason: 'Composite index enables efficient COUNT aggregation by filtering on event_type and scanning the created_at range without touching the heap.',
          queryPatterns: [
            "WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days'",
          ],
          estimatedImpact: 'HIGH',
          writeOverheadImpact: 'Low - append-only table',
        },
        {
          createStatement: 'CREATE UNIQUE INDEX idx_users_email ON users (email);',
          table: 'users',
          columns: ['email'],
          type: 'btree',
          isUnique: true,
          isPartial: false,
          reason: 'Unique index on email enforces data integrity and accelerates lookups used in authentication and JOIN operations.',
          queryPatterns: [
            'WHERE email = ?',
            'JOIN users u ON u.id = o.customer_id (benefits user lookup)',
          ],
          estimatedImpact: 'LOW',
          writeOverheadImpact: 'Minimal',
        },
      ],
      redundantIndexes: [
        {
          indexName: 'idx_orders_customer',
          reason: 'Covered by the composite index on (customer_id, created_at)',
          recommendation: 'DROP INDEX idx_orders_customer;',
        },
        {
          indexName: 'idx_events_type',
          reason: 'Covered by the composite index on (event_type, created_at)',
          recommendation: 'DROP INDEX idx_events_type;',
        },
      ],
      summary:
        'Analysis identified 5 index recommendations across 4 tables. 3 high-impact indexes should be prioritized. 2 existing indexes are potentially redundant and can be dropped to reduce write overhead.',
    });
    setExpandedIds(new Set([0]));
    setReanalysisResult(null);
  }, []);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleCopyAll = useCallback(() => {
    if (!result) return;
    const allStatements = result.recommendations
      .map((r) => `-- ${r.reason}\n${r.createStatement}`)
      .join('\n\n');
    navigator.clipboard.writeText(allStatements);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  }, [result]);

  const handleExportDDL = useCallback(() => {
    if (!result) return;
    const allStatements = result.recommendations
      .map((r) => `-- Table: ${r.table} (${r.estimatedImpact} impact)\n-- ${r.reason}\n${r.createStatement}`)
      .join('\n\n');
    const blob = new Blob([allStatements], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index_recommendations.sql';
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const toggleExpand = useCallback((idx: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleApply = useCallback((idx: number) => {
    setAppliedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const displayResult = reanalysisResult || result;

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" />
          Paste Slow Queries
        </label>
        <textarea
          value={slowQueries}
          onChange={(e) => setSlowQueries(e.target.value)}
          placeholder={`-- Paste one or more slow queries here\nSELECT o.*, u.name FROM orders o\nJOIN users u ON u.id = o.customer_id\nWHERE o.created_at > '2025-01-01'\nORDER BY o.created_at DESC;\n\n-- Another slow query\nSELECT * FROM products\nWHERE category_id = 5 AND price BETWEEN 10 AND 100;`}
          rows={8}
          spellCheck={false}
          className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
        />
      </div>

      {/* Analyze Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !projectId}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            isAnalyzing || !projectId
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analyze Queries
            </>
          )}
        </button>

        <button
          onClick={handleLoadDemo}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <FlaskConical className="w-4 h-4" />
          Load Demo
        </button>

        {isAnalyzing && (
          <span className="text-xs text-muted-foreground">
            AI is analyzing query patterns and table structures...
          </span>
        )}
      </div>

      {/* Analysis Progress Stepper */}
      {isAnalyzing && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {ANALYSIS_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = i === analysisStep;
              const isCompleted = i < analysisStep;
              return (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0',
                      isCompleted ? 'bg-aqua-500 text-white' :
                      isActive ? 'bg-aqua-100 text-aqua-700 ring-2 ring-aqua-500 animate-pulse' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                    </div>
                    <span className={cn('text-xs whitespace-nowrap', isActive ? 'text-aqua-700 font-medium' : isCompleted ? 'text-aqua-600' : 'text-muted-foreground')}>
                      {step.label}
                    </span>
                  </div>
                  {i < ANALYSIS_STEPS.length - 1 && (
                    <div className={cn('flex-1 h-0.5 min-w-[20px]', isCompleted ? 'bg-aqua-500' : 'bg-muted')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-aqua-500 to-cyan-500 h-1.5 rounded-full transition-all duration-500"
                 style={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Analysis Failed</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {displayResult && displayResult.recommendations.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          {displayResult.summary && (
            <div className="bg-aqua-50 border border-aqua-200 rounded-lg p-4">
              <p className="text-sm text-aqua-800">{displayResult.summary}</p>
            </div>
          )}

          {/* Summary Stat Cards */}
          {(() => {
            const highCount = displayResult.recommendations.filter(r => r.estimatedImpact === 'HIGH').length;
            const mediumCount = displayResult.recommendations.filter(r => r.estimatedImpact === 'MEDIUM').length;
            const lowCount = displayResult.recommendations.filter(r => r.estimatedImpact === 'LOW').length;
            const tablesAffected = new Set(displayResult.recommendations.map(r => r.table)).size;
            const redundantCount = displayResult.redundantIndexes?.length ?? 0;

            const impactChartData = [
              { name: 'High', value: highCount, fill: '#ef4444' },
              { name: 'Medium', value: mediumCount, fill: '#f59e0b' },
              { name: 'Low', value: lowCount, fill: '#3b82f6' },
            ].filter(d => d.value > 0);

            const tableChartData = Object.entries(
              displayResult.recommendations.reduce((acc, r) => {
                acc[r.table] = (acc[r.table] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([table, count]) => ({ table, count })).sort((a, b) => b.count - a.count);

            return (
              <>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Total Indexes', value: displayResult.recommendations.length, color: 'text-aqua-600' },
                    { label: 'High Impact', value: highCount, color: 'text-red-600' },
                    { label: 'Medium Impact', value: mediumCount, color: 'text-amber-600' },
                    { label: 'Low Impact', value: lowCount, color: 'text-blue-600' },
                    { label: 'Tables Affected', value: tablesAffected, color: 'text-violet-600' },
                    { label: 'Redundant', value: redundantCount, color: 'text-orange-600' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-card border border-border rounded-lg p-3 text-center">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{stat.label}</p>
                      <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Impact Distribution Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h5 className="text-xs font-semibold text-foreground mb-3">Impact Distribution</h5>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={impactChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                            {impactChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      {impactChartData.map(d => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="text-xs text-muted-foreground">{d.name} ({d.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4">
                    <h5 className="text-xs font-semibold text-foreground mb-3">Indexes per Table</h5>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tableChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="table" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} allowDecimals={false} />
                          <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                          <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} name="Indexes" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Re-analysis Comparison Panel */}
          {reanalysisResult && result && (
            <div className="bg-card border border-aqua-200 rounded-lg p-4 space-y-3">
              <h5 className="text-xs font-semibold text-aqua-700 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Re-analysis Comparison
              </h5>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <div />
                <div className="font-semibold text-muted-foreground uppercase text-[10px]">Total</div>
                <div className="font-semibold text-muted-foreground uppercase text-[10px]">High</div>
                <div className="font-semibold text-muted-foreground uppercase text-[10px]">Medium</div>
                <div className="font-semibold text-muted-foreground uppercase text-[10px]">Low</div>

                <div className="text-xs font-semibold text-muted-foreground bg-muted/50 rounded-lg py-2">Before</div>
                <div className="bg-card border border-border rounded-lg py-2 font-bold text-foreground">{result.recommendations.length}</div>
                <div className="bg-card border border-border rounded-lg py-2 font-bold text-red-600">{result.recommendations.filter(r => r.estimatedImpact === 'HIGH').length}</div>
                <div className="bg-card border border-border rounded-lg py-2 font-bold text-amber-600">{result.recommendations.filter(r => r.estimatedImpact === 'MEDIUM').length}</div>
                <div className="bg-card border border-border rounded-lg py-2 font-bold text-blue-600">{result.recommendations.filter(r => r.estimatedImpact === 'LOW').length}</div>

                <div className="text-xs font-semibold text-aqua-700 bg-aqua-50 rounded-lg py-2">After</div>
                {(() => {
                  const afterTotal = reanalysisResult.recommendations.length;
                  const afterHigh = reanalysisResult.recommendations.filter(r => r.estimatedImpact === 'HIGH').length;
                  const afterMed = reanalysisResult.recommendations.filter(r => r.estimatedImpact === 'MEDIUM').length;
                  const afterLow = reanalysisResult.recommendations.filter(r => r.estimatedImpact === 'LOW').length;
                  const beforeTotal = result.recommendations.length;
                  const beforeHigh = result.recommendations.filter(r => r.estimatedImpact === 'HIGH').length;
                  const beforeMed = result.recommendations.filter(r => r.estimatedImpact === 'MEDIUM').length;
                  const beforeLow = result.recommendations.filter(r => r.estimatedImpact === 'LOW').length;
                  return [
                    { val: afterTotal, ref: beforeTotal },
                    { val: afterHigh, ref: beforeHigh },
                    { val: afterMed, ref: beforeMed },
                    { val: afterLow, ref: beforeLow },
                  ].map((item, i) => (
                    <div key={i} className={cn(
                      'border rounded-lg py-2 font-bold',
                      item.val < item.ref ? 'bg-green-50 border-green-200 text-green-700' :
                      item.val > item.ref ? 'bg-red-50 border-red-200 text-red-700' :
                      'bg-card border-border text-foreground'
                    )}>
                      {item.val}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Recommended Indexes ({displayResult.recommendations.length})
            </h4>
            <div className="flex items-center gap-2">
              {appliedIndexes.size > 0 && (
                <button
                  onClick={handleReanalyze}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-lg hover:bg-aqua-100 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-analyze with Applied ({appliedIndexes.size})
                </button>
              )}
              <button
                onClick={handleExportDDL}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export DDL
              </button>
              <button
                onClick={handleCopyAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                {copiedId === 'all' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Copied All
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy All
                  </>
                )}
              </button>
            </div>
          </div>

          {displayResult.recommendations.map((rec, idx) => {
            const impactKey = rec.estimatedImpact || 'MEDIUM';
            const impact = IMPACT_CONFIG[impactKey] || IMPACT_CONFIG.MEDIUM;
            const ImpactIcon = impact.icon;
            const isExpanded = expandedIds.has(idx);
            const isApplied = appliedIndexes.has(idx);

            return (
              <div
                key={idx}
                className={cn(
                  'bg-card border rounded-lg overflow-hidden transition-all',
                  isApplied ? 'border-green-300 ring-1 ring-green-200' : impact.border
                )}
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpand(idx)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50/50 transition-colors"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      isApplied ? 'bg-green-50' : impact.bg
                    )}
                  >
                    {isApplied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <ImpactIcon className={cn('w-4 h-4', impact.text)} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {rec.table}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-mono">
                        ({rec.columns.join(', ')})
                      </span>
                      {rec.isUnique && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 rounded">
                          UNIQUE
                        </span>
                      )}
                      {rec.isPartial && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cyan-100 text-cyan-700 rounded">
                          PARTIAL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {rec.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {rec.type}
                    </span>
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                        impact.badge
                      )}
                    >
                      {impactKey}
                    </span>
                    {/* Impact progress bar */}
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full',
                        impactKey === 'HIGH' ? 'bg-red-500 w-full' :
                        impactKey === 'MEDIUM' ? 'bg-amber-500 w-3/5' :
                        'bg-blue-500 w-1/3'
                      )} />
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Why this index helps:
                      </p>
                      <p className="text-sm text-foreground">{rec.reason}</p>
                    </div>

                    {rec.writeOverheadImpact && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground flex-shrink-0">Write Overhead:</span>
                        <div className="flex-1 h-2 bg-muted rounded-full max-w-[200px]">
                          <div className={cn('h-2 rounded-full',
                            rec.writeOverheadImpact.toLowerCase().includes('minimal') || rec.writeOverheadImpact.toLowerCase().includes('low') ? 'bg-green-400 w-1/5' :
                            rec.writeOverheadImpact.toLowerCase().includes('moderate') || rec.writeOverheadImpact.toLowerCase().includes('medium') ? 'bg-amber-400 w-1/2' :
                            'bg-red-400 w-4/5'
                          )} />
                        </div>
                        <span className="text-xs text-amber-700 font-medium flex-shrink-0">{rec.writeOverheadImpact}</span>
                      </div>
                    )}

                    {rec.queryPatterns && rec.queryPatterns.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Benefits these query patterns:
                        </p>
                        <ul className="space-y-1">
                          {rec.queryPatterns.map((qp, i) => (
                            <li key={i} className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                              {qp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          CREATE INDEX Statement:
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rec.createStatement, `idx-${idx}`);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === `idx-${idx}` ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto">
                        {rec.createStatement}
                      </div>
                    </div>

                    {/* Apply / Unapply for re-analysis */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleApply(idx);
                        }}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                          isApplied
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-card text-muted-foreground border border-border hover:bg-muted/50'
                        )}
                      >
                        {isApplied ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Applied (click to undo)
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            Mark as Applied
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        Mark indexes as applied, then re-analyze to see updated impact
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Redundant Indexes */}
          {displayResult.redundantIndexes && displayResult.redundantIndexes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                Potentially Redundant Indexes ({displayResult.redundantIndexes.length})
              </h4>
              {displayResult.redundantIndexes.map((ri, idx) => (
                <div
                  key={idx}
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 font-mono">
                      {ri.indexName}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700">{ri.reason}</p>
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    {ri.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default IndexAdvisor;
