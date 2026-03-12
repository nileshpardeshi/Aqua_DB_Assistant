import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  Download,
  Search,
  Database,
  ArrowRight,
  BarChart3,
  AlertTriangle,
  AlertCircle,
  Info,
  Layers,
  FlaskConical,
  Hash,
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
import { useProject } from '@/hooks/use-projects';
import { useTables } from '@/hooks/use-schema';
import { useCreatePerformanceRun } from '@/hooks/use-performance';
import {
  useSimulateDataDistribution,
  type DataDistributionResult,
  type ColumnDistribution,
} from '@/hooks/use-datagen';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  high: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  },
  medium: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  },
  low: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  },
};

const ANALYSIS_STEPS = [
  { label: 'Analyzing columns', icon: Search },
  { label: 'Estimating cardinality', icon: Hash },
  { label: 'Detecting skew', icon: BarChart3 },
  { label: 'Building histograms', icon: Sparkles },
];

const DIST_TYPE_COLORS: Record<string, string> = {
  uniform: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  skewed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  bimodal: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  zipfian: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  normal: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

const BAR_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899'];

// ── Component ─────────────────────────────────────────────────────────────────

export function DataDistributionTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const { data: tables } = useTables(projectId);
  const simulateMutation = useSimulateDataDistribution();
  const createRun = useCreatePerformanceRun();

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DataDistributionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleTable = (tableName: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableName)
        ? prev.filter((t) => t !== tableName)
        : [...prev, tableName],
    );
  };

  const handleAnalyze = useCallback(async () => {
    if (!projectId || !project || selectedTables.length === 0) return;

    // Ensure all selected tables have row counts
    const counts: Record<string, number> = {};
    for (const t of selectedTables) {
      counts[t] = rowCounts[t] || 100000;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    setAnalysisStep(0);
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 1200);

    try {
      const data = await simulateMutation.mutateAsync({
        projectId,
        dialect: project.dialect ?? 'PostgreSQL',
        selectedTables,
        estimatedRowCounts: counts,
      });
      setResult(data);

      try {
        await createRun.mutateAsync({
          projectId,
          type: 'data-dist-sim',
          name: `Distribution analysis for ${selectedTables.length} tables`,
          config: { selectedTables, rowCounts: counts },
        });
      } catch {
        // Non-critical
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to simulate distribution. Check AI provider configuration.',
      );
    } finally {
      setIsAnalyzing(false);
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
    }
  }, [projectId, project, selectedTables, rowCounts, simulateMutation, createRun]);

  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_distribution_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadDemo = () => {
    setSelectedTables(['orders', 'customers']);
    setRowCounts({ orders: 1000000, customers: 100000 });
    setResult({
      distributions: [
        {
          tableName: 'orders',
          columnName: 'status',
          dataType: 'VARCHAR(20)',
          estimatedCardinality: 5,
          totalRows: 1000000,
          selectivity: 0.000005,
          distributionType: 'skewed',
          skewFactor: 0.85,
          histogram: [
            { bucket: 'completed', frequency: 450000, cumulativePercent: 45.0 },
            { bucket: 'active', frequency: 300000, cumulativePercent: 75.0 },
            { bucket: 'pending', frequency: 150000, cumulativePercent: 90.0 },
            { bucket: 'cancelled', frequency: 80000, cumulativePercent: 98.0 },
            { bucket: 'refunded', frequency: 20000, cumulativePercent: 100.0 },
          ],
          topNValues: [
            { value: 'completed', frequency: 450000, percentage: 45.0 },
            { value: 'active', frequency: 300000, percentage: 30.0 },
            { value: 'pending', frequency: 150000, percentage: 15.0 },
          ],
          nullPercentage: 0.0,
          statistics: {
            min: 'active',
            max: 'refunded',
            avg: 'N/A',
            stddev: 'N/A',
            median: 'completed',
          },
        },
        {
          tableName: 'orders',
          columnName: 'total_amount',
          dataType: 'DECIMAL(10,2)',
          estimatedCardinality: 850000,
          totalRows: 1000000,
          selectivity: 0.85,
          distributionType: 'normal',
          skewFactor: 0.15,
          histogram: [
            { bucket: '$0-$25', frequency: 120000, cumulativePercent: 12.0 },
            { bucket: '$25-$50', frequency: 220000, cumulativePercent: 34.0 },
            { bucket: '$50-$100', frequency: 310000, cumulativePercent: 65.0 },
            { bucket: '$100-$200', frequency: 200000, cumulativePercent: 85.0 },
            { bucket: '$200-$500', frequency: 120000, cumulativePercent: 97.0 },
            { bucket: '$500+', frequency: 30000, cumulativePercent: 100.0 },
          ],
          topNValues: [
            { value: '49.99', frequency: 8500, percentage: 0.85 },
            { value: '99.99', frequency: 7200, percentage: 0.72 },
            { value: '29.99', frequency: 6800, percentage: 0.68 },
          ],
          nullPercentage: 0.1,
          statistics: {
            min: '0.01',
            max: '9999.99',
            avg: '87.45',
            stddev: '65.20',
            median: '72.50',
          },
        },
        {
          tableName: 'customers',
          columnName: 'email',
          dataType: 'VARCHAR(255)',
          estimatedCardinality: 99500,
          totalRows: 100000,
          selectivity: 0.995,
          distributionType: 'uniform',
          skewFactor: 0.02,
          histogram: [
            { bucket: 'gmail.com', frequency: 35000, cumulativePercent: 35.0 },
            { bucket: 'yahoo.com', frequency: 20000, cumulativePercent: 55.0 },
            { bucket: 'hotmail.com', frequency: 15000, cumulativePercent: 70.0 },
            { bucket: 'outlook.com', frequency: 12000, cumulativePercent: 82.0 },
            { bucket: 'company domains', frequency: 18000, cumulativePercent: 100.0 },
          ],
          topNValues: [
            { value: '@gmail.com', frequency: 35000, percentage: 35.0 },
            { value: '@yahoo.com', frequency: 20000, percentage: 20.0 },
          ],
          nullPercentage: 0.5,
          statistics: {
            min: 'a.aaron@example.com',
            max: 'z.zulu@example.com',
            avg: 'N/A',
            stddev: 'N/A',
            median: 'N/A',
          },
        },
      ],
      skewAlerts: [
        {
          tableName: 'orders',
          columnName: 'status',
          severity: 'high',
          message: "Heavy skew: 45% of rows have status='completed'",
          impact:
            "B-tree index on status alone has poor selectivity (0.000005). Queries for 'completed' orders will scan 450K rows even with an index.",
          recommendation:
            "Use partial indexes: CREATE INDEX idx_orders_pending ON orders(id) WHERE status = 'pending'",
        },
        {
          tableName: 'orders',
          columnName: 'total_amount',
          severity: 'low',
          message: 'Slight right skew — 3% of orders exceed $500',
          impact:
            'Queries filtering on high amounts will benefit from B-tree index due to good selectivity',
          recommendation:
            'Standard B-tree index is effective for range queries on this column',
        },
      ],
      cardinalityMatrix: {
        'orders.status': { uniqueValues: 5, totalRows: 1000000, ratio: 0.000005 },
        'orders.total_amount': { uniqueValues: 850000, totalRows: 1000000, ratio: 0.85 },
        'customers.email': { uniqueValues: 99500, totalRows: 100000, ratio: 0.995 },
      },
      summary:
        'Analyzed 3 columns across 2 tables. Found 1 high-skew column (orders.status) that may impact index effectiveness. orders.total_amount follows a normal distribution suitable for range queries. customers.email has near-unique cardinality (99.5%).',
    });
  };

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Data Distribution Analysis
          </h3>
          <button
            onClick={handleLoadDemo}
            className="text-xs text-aqua-600 hover:text-aqua-700 dark:text-aqua-400 font-medium"
          >
            <FlaskConical className="w-3.5 h-3.5 inline mr-1" />
            Load Demo
          </button>
        </div>

        {/* Table Selection */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Select Tables
          </label>
          {!tables || tables.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No tables found. Import a schema first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tables.map((table) => {
                const selected = selectedTables.includes(table.name);
                return (
                  <button
                    key={table.id}
                    onClick={() => toggleTable(table.name)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      selected
                        ? 'bg-aqua-50 dark:bg-aqua-900/30 border-aqua-300 dark:border-aqua-700 text-aqua-700 dark:text-aqua-300'
                        : 'bg-card border-border text-muted-foreground hover:border-aqua-300',
                    )}
                  >
                    <Database className="w-3.5 h-3.5 inline mr-1" />
                    {table.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Row Count Inputs */}
        {selectedTables.length > 0 && (
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Estimated Row Counts
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {selectedTables.map((table) => (
                <div key={table} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{table}</span>
                  <input
                    type="number"
                    value={rowCounts[table] || ''}
                    onChange={(e) =>
                      setRowCounts((prev) => ({
                        ...prev,
                        [table]: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="100000"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/40"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || selectedTables.length === 0}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            isAnalyzing || selectedTables.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20',
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <BarChart3 className="w-4 h-4" />
              Analyze Distribution ({selectedTables.length} tables)
            </>
          )}
        </button>
      </div>

      {/* Progress Stepper */}
      {isAnalyzing && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            {ANALYSIS_STEPS.map((step, idx) => {
              const isActive = idx === analysisStep;
              const isDone = idx < analysisStep;
              return (
                <div key={idx} className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                      isDone
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        : isActive
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 animate-pulse'
                          : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs hidden sm:inline',
                      isActive
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  {idx < ANALYSIS_STEPS.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground/30 ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between">
              <p className="text-sm text-foreground flex-1">{result.summary}</p>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors ml-4"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>

          {/* Cardinality Matrix */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">
                Cardinality Matrix
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                      Column
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                      Unique Values
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                      Total Rows
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">
                      Selectivity
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">
                      Selectivity Bar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.cardinalityMatrix).map(
                    ([key, stats]) => (
                      <tr
                        key={key}
                        className="border-b border-border/50 hover:bg-secondary/20"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-foreground">
                          {key}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-foreground">
                          {stats.uniqueValues.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                          {stats.totalRows.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-medium text-foreground">
                          {stats.ratio < 0.001
                            ? stats.ratio.toExponential(1)
                            : (stats.ratio * 100).toFixed(1) + '%'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                stats.ratio > 0.5
                                  ? 'bg-emerald-500'
                                  : stats.ratio > 0.1
                                    ? 'bg-amber-500'
                                    : 'bg-red-500',
                              )}
                              style={{
                                width: `${Math.max(stats.ratio * 100, 2)}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Skew Alerts */}
          {result.skewAlerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Skew Alerts</h3>
              {result.skewAlerts.map((alert, idx) => {
                const config = SEVERITY_CONFIG[alert.severity];
                const Icon = config.icon;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-xl border p-4',
                      config.bg,
                      config.border,
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={cn(
                          'w-4 h-4 mt-0.5 flex-shrink-0',
                          config.text,
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            {alert.tableName}.{alert.columnName}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium',
                              config.badge,
                            )}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className={cn('text-sm font-medium', config.text)}>
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.impact}
                        </p>
                        <p className="text-xs mt-1.5 text-foreground font-medium">
                          {alert.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Column Distributions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">
              Column Distributions
            </h3>
            {result.distributions.map((dist, idx) => {
              const key = `${dist.tableName}.${dist.columnName}`;
              const isExpanded = expandedColumn === key;
              const distColor =
                DIST_TYPE_COLORS[dist.distributionType] ||
                'bg-secondary text-foreground';

              return (
                <div
                  key={idx}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  {/* Header */}
                  <button
                    onClick={() =>
                      setExpandedColumn(isExpanded ? null : key)
                    }
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {dist.tableName}.{dist.columnName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dist.dataType}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium',
                          distColor,
                        )}
                      >
                        {dist.distributionType}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Cardinality:{' '}
                        <span className="font-medium text-foreground">
                          {dist.estimatedCardinality.toLocaleString()}
                        </span>
                      </span>
                      <span>
                        Null:{' '}
                        <span className="font-medium text-foreground">
                          {dist.nullPercentage}%
                        </span>
                      </span>
                      <span>
                        Skew:{' '}
                        <span
                          className={cn(
                            'font-medium',
                            dist.skewFactor > 0.5
                              ? 'text-red-600 dark:text-red-400'
                              : dist.skewFactor > 0.2
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400',
                          )}
                        >
                          {(dist.skewFactor * 100).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border p-6 space-y-6">
                      {/* Histogram */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                          Frequency Distribution
                        </p>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dist.histogram}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--color-border)"
                              />
                              <XAxis
                                dataKey="bucket"
                                tick={{
                                  fontSize: 10,
                                  fill: 'var(--color-muted-foreground)',
                                }}
                              />
                              <YAxis
                                tick={{
                                  fontSize: 10,
                                  fill: 'var(--color-muted-foreground)',
                                }}
                                tickFormatter={(v) =>
                                  v >= 1000000
                                    ? `${(v / 1000000).toFixed(1)}M`
                                    : v >= 1000
                                      ? `${(v / 1000).toFixed(0)}K`
                                      : String(v)
                                }
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--color-card)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                }}
                                formatter={(value: number) => [
                                  value.toLocaleString(),
                                  'Frequency',
                                ]}
                              />
                              <Bar
                                dataKey="frequency"
                                fill={
                                  BAR_COLORS[idx % BAR_COLORS.length]
                                }
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top-N Values */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            Top Values
                          </p>
                          <div className="space-y-1.5">
                            {dist.topNValues.map((tv, vi) => (
                              <div
                                key={vi}
                                className="flex items-center gap-2"
                              >
                                <span className="text-xs font-mono text-foreground w-32 truncate">
                                  {tv.value}
                                </span>
                                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-aqua-500"
                                    style={{
                                      width: `${tv.percentage}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground w-16 text-right">
                                  {tv.percentage.toFixed(1)}% (
                                  {tv.frequency.toLocaleString()})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Statistics */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            Statistics
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(dist.statistics).map(
                              ([stat, val]) => (
                                <div
                                  key={stat}
                                  className="bg-secondary rounded-lg px-3 py-2"
                                >
                                  <p className="text-[10px] text-muted-foreground uppercase">
                                    {stat}
                                  </p>
                                  <p className="text-xs font-mono font-medium text-foreground truncate">
                                    {val}
                                  </p>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Null distribution bar */}
                      {dist.nullPercentage > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            NULL Distribution: {dist.nullPercentage}%
                          </p>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-400 rounded-full"
                              style={{
                                width: `${dist.nullPercentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
