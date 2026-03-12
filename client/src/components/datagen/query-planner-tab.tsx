import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  Download,
  Search,
  Zap,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  Database,
  FlaskConical,
  HardDrive,
  Timer,
  Layers,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
  useSimulateQueryPlan,
  type QueryPlanResult,
  type PlanNode,
} from '@/hooks/use-datagen';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  },
};

const ANALYSIS_STEPS = [
  { label: 'Parsing query', icon: Search },
  { label: 'Building plan tree', icon: Layers },
  { label: 'Estimating costs', icon: Timer },
  { label: 'Detecting bottlenecks', icon: Sparkles },
];

const PIE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1', '#14b8a6'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPlanTree(
  nodes: PlanNode[],
  depth: number,
  maxCost: number,
): React.ReactNode {
  return nodes.map((node, idx) => {
    const costPercent = maxCost > 0 ? (node.totalCost / maxCost) * 100 : 0;
    return (
      <div key={`${depth}-${idx}`} className="space-y-1">
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/50 transition-colors"
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          <span className="text-xs font-mono font-bold text-aqua-600 dark:text-aqua-400 whitespace-nowrap">
            {node.nodeType}
          </span>
          {node.relation && (
            <span className="text-xs text-muted-foreground">
              on <span className="font-medium text-foreground">{node.relation}</span>
              {node.alias && node.alias !== node.relation ? ` (${node.alias})` : ''}
            </span>
          )}
          {node.indexUsed && (
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
              idx: {node.indexUsed}
            </span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{node.estimatedRows?.toLocaleString()} rows</span>
            <span>{node.executionTimeMs?.toFixed(1)}ms</span>
            <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  costPercent > 60
                    ? 'bg-red-500'
                    : costPercent > 30
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                )}
                style={{ width: `${Math.max(costPercent, 3)}%` }}
              />
            </div>
          </div>
        </div>
        {node.filter && (
          <div
            className="text-[10px] text-muted-foreground font-mono px-2"
            style={{ paddingLeft: `${depth * 24 + 32}px` }}
          >
            Filter: {node.filter}
          </div>
        )}
        {node.children && node.children.length > 0 && renderPlanTree(node.children, depth + 1, maxCost)}
      </div>
    );
  });
}

function getMaxCost(nodes: PlanNode[]): number {
  let max = 0;
  for (const n of nodes) {
    if (n.totalCost > max) max = n.totalCost;
    if (n.children) {
      const childMax = getMaxCost(n.children);
      if (childMax > max) max = childMax;
    }
  }
  return max;
}

function flattenNodes(nodes: PlanNode[]): PlanNode[] {
  const flat: PlanNode[] = [];
  for (const n of nodes) {
    flat.push(n);
    if (n.children) flat.push(...flattenNodes(n.children));
  }
  return flat;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QueryPlannerTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const { data: tables } = useTables(projectId);
  const simulateMutation = useSimulateQueryPlan();
  const createRun = useCreatePerformanceRun();

  const [sql, setSql] = useState('');
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<QueryPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['plan', 'bottlenecks', 'indexes']),
  );
  const [analysisStep, setAnalysisStep] = useState(0);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSimulate = useCallback(async () => {
    if (!projectId || !project || !sql.trim()) return;
    setIsSimulating(true);
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
        sql: sql.trim(),
        estimatedRowCounts:
          Object.keys(rowCounts).length > 0 ? rowCounts : undefined,
      });
      setResult(data);

      try {
        await createRun.mutateAsync({
          projectId,
          type: 'query-plan-sim',
          name: `Query plan simulation`,
          config: { sql: sql.trim().slice(0, 200), rowCounts },
        });
      } catch {
        // Non-critical
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to simulate query plan. Check AI provider configuration.',
      );
    } finally {
      setIsSimulating(false);
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
    }
  }, [projectId, project, sql, rowCounts, simulateMutation, createRun]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_plan_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadDemo = () => {
    setSql(
      "SELECT o.id, o.total_amount, c.first_name, c.last_name, c.email\nFROM orders o\nJOIN customers c ON o.customer_id = c.id\nWHERE o.status = 'completed'\n  AND o.created_at >= '2024-01-01'\nORDER BY o.total_amount DESC\nLIMIT 100;",
    );
    setRowCounts({ customers: 100000, orders: 1000000 });
    setResult({
      executionPlan: {
        planTree: [
          {
            nodeType: 'Limit',
            relation: null,
            alias: null,
            startupCost: 25000.0,
            totalCost: 25100.5,
            estimatedRows: 100,
            actualRows: 100,
            executionTimeMs: 0.5,
            children: [
              {
                nodeType: 'Sort',
                relation: null,
                alias: null,
                startupCost: 24500.0,
                totalCost: 25000.0,
                estimatedRows: 35000,
                actualRows: 34872,
                executionTimeMs: 12.3,
                filter: 'Sort Key: o.total_amount DESC',
                children: [
                  {
                    nodeType: 'Hash Join',
                    relation: null,
                    alias: null,
                    startupCost: 3500.0,
                    totalCost: 22000.0,
                    estimatedRows: 35000,
                    actualRows: 34872,
                    executionTimeMs: 45.2,
                    filter: 'o.customer_id = c.id',
                    bufferHits: 2500,
                    bufferReads: 400,
                    children: [
                      {
                        nodeType: 'Seq Scan',
                        relation: 'orders',
                        alias: 'o',
                        startupCost: 0.0,
                        totalCost: 18500.0,
                        estimatedRows: 350000,
                        actualRows: 348721,
                        executionTimeMs: 85.6,
                        filter: "o.status = 'completed' AND o.created_at >= '2024-01-01'",
                        indexUsed: null,
                        bufferHits: 1200,
                        bufferReads: 350,
                        children: [],
                      },
                      {
                        nodeType: 'Hash',
                        relation: 'customers',
                        alias: 'c',
                        startupCost: 2100.0,
                        totalCost: 3500.0,
                        estimatedRows: 100000,
                        actualRows: 100000,
                        executionTimeMs: 15.4,
                        indexUsed: null,
                        bufferHits: 800,
                        bufferReads: 50,
                        children: [
                          {
                            nodeType: 'Seq Scan',
                            relation: 'customers',
                            alias: 'c',
                            startupCost: 0.0,
                            totalCost: 2100.0,
                            estimatedRows: 100000,
                            actualRows: 100000,
                            executionTimeMs: 12.1,
                            children: [],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        totalExecutionTimeMs: 158.7,
        planningTimeMs: 0.8,
        peakMemoryKB: 8192,
        rowsReturned: 100,
      },
      bottlenecks: [
        {
          severity: 'critical',
          nodeIndex: 0,
          issue: 'Sequential scan on orders table (1M rows)',
          impact: '54% of total query time (85.6ms)',
          recommendation:
            "Create composite index on orders(status, created_at) to eliminate full table scan",
        },
        {
          severity: 'warning',
          nodeIndex: 1,
          issue: 'Sort operation on 35K rows without index',
          impact: '8% of total query time (12.3ms)',
          recommendation:
            'Add total_amount to the composite index for index-only sort',
        },
        {
          severity: 'info',
          nodeIndex: 2,
          issue: 'Hash build on entire customers table',
          impact: '10% of total query time (15.4ms)',
          recommendation:
            'Consider adding index on customers(id) if not already primary key',
        },
      ],
      indexRecommendations: [
        {
          createStatement:
            'CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC) INCLUDE (customer_id, total_amount)',
          estimatedImprovement:
            '85% reduction in scan rows (1M → 150K)',
          reason:
            'Composite index covers WHERE clause filters and includes columns needed for join and sort',
        },
        {
          createStatement:
            'CREATE INDEX idx_orders_total_desc ON orders(total_amount DESC) WHERE status = \'completed\'',
          estimatedImprovement: 'Eliminates sort step for top-N queries',
          reason:
            'Partial index on completed orders sorted by amount for LIMIT queries',
        },
      ],
      joinAnalysis: {
        joinCount: 1,
        joinTypes: ['Hash Join'],
        costliestJoin:
          'Hash Join on orders.customer_id = customers.id (45.2ms)',
        recommendation:
          'Current Hash Join is efficient for this data volume. With the recommended index, a Nested Loop with Index Scan may be faster.',
      },
      memoryAnalysis: {
        estimatedWorkMem: '8 MB',
        sortSpillToDisk: false,
        hashBuckets: 16384,
      },
      dialectSpecificNotes:
        'PostgreSQL: Use EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) for actual runtime. Consider setting work_mem = 16MB for this query to avoid sort spill. The INCLUDE clause in the index requires PostgreSQL 11+.',
      summary:
        'Query scans 1M orders rows sequentially — this is the primary bottleneck (54% of runtime). Adding a composite index on orders(status, created_at) would reduce the scan from 1M to ~150K rows, improving total execution time by approximately 60-70%.',
    });
  };

  // Chart data
  const flatNodes = result ? flattenNodes(result.executionPlan.planTree) : [];
  const timingData = flatNodes
    .filter((n) => n.executionTimeMs > 0)
    .map((n) => ({
      name: `${n.nodeType}${n.relation ? ` (${n.relation})` : ''}`,
      value: n.executionTimeMs,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Query Planner Simulation
          </h3>
          <button
            onClick={handleLoadDemo}
            className="text-xs text-aqua-600 hover:text-aqua-700 dark:text-aqua-400 font-medium"
          >
            <FlaskConical className="w-3.5 h-3.5 inline mr-1" />
            Load Demo
          </button>
        </div>

        {/* SQL Input */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            SQL Query
          </label>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="Paste your SQL query here..."
            rows={6}
            className="w-full rounded-lg border border-border bg-[#1e293b] text-slate-100 px-4 py-3 text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-aqua-500/40"
          />
        </div>

        {/* Row Count Estimation */}
        {tables && tables.length > 0 && (
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Estimated Row Counts (optional)
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {tables.slice(0, 8).map((table) => (
                <div key={table.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate w-20">
                    {table.name}
                  </span>
                  <input
                    type="number"
                    value={rowCounts[table.name] || ''}
                    onChange={(e) =>
                      setRowCounts((prev) => ({
                        ...prev,
                        [table.name]: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="rows"
                    className="flex-1 px-2 py-1 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/40"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulate Button */}
        <button
          onClick={handleSimulate}
          disabled={isSimulating || !sql.trim()}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            isSimulating || !sql.trim()
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white shadow-lg shadow-violet-500/20',
          )}
        >
          {isSimulating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Simulating...
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" />
              Simulate Execution Plan
            </>
          )}
        </button>
      </div>

      {/* Progress Stepper */}
      {isSimulating && (
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
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 animate-pulse'
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
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="w-4 h-4 text-violet-500" />
                <p className="text-xs text-muted-foreground">Total Time</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {result.executionPlan.totalExecutionTimeMs.toFixed(1)}ms
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-4 h-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">Peak Memory</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {result.executionPlan.peakMemoryKB >= 1024
                  ? `${(result.executionPlan.peakMemoryKB / 1024).toFixed(1)} MB`
                  : `${result.executionPlan.peakMemoryKB} KB`}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-emerald-500" />
                <p className="text-xs text-muted-foreground">Rows Returned</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {result.executionPlan.rowsReturned.toLocaleString()}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p className="text-xs text-muted-foreground">Bottlenecks</p>
              </div>
              <p className="text-xl font-bold text-foreground">
                {result.bottlenecks.length}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-foreground">{result.summary}</p>
          </div>

          {/* Execution Plan Tree */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('plan')}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('plan') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <h3 className="font-semibold text-foreground">
                  Execution Plan Tree
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {flatNodes.length} nodes
              </span>
            </button>
            {expandedSections.has('plan') && (
              <div className="border-t border-border px-4 py-3 overflow-x-auto">
                {renderPlanTree(
                  result.executionPlan.planTree,
                  0,
                  getMaxCost(result.executionPlan.planTree),
                )}
              </div>
            )}
          </div>

          {/* Timing Chart */}
          {timingData.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">
                Time Distribution by Node
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timingData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} unit="ms" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                        width={130}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-card)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Time']}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={timingData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        label={({ name, percent }) =>
                          `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {timingData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-card)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Time']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Bottlenecks */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('bottlenecks')}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('bottlenecks') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <h3 className="font-semibold text-foreground">
                  Bottlenecks
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {result.bottlenecks.length} found
              </span>
            </button>
            {expandedSections.has('bottlenecks') && (
              <div className="border-t border-border p-4 space-y-3">
                {result.bottlenecks.map((b, idx) => {
                  const config = SEVERITY_CONFIG[b.severity];
                  const Icon = config.icon;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-lg border p-4',
                        config.bg,
                        config.border,
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.text)} />
                        <div className="flex-1">
                          <p className={cn('text-sm font-medium', config.text)}>
                            {b.issue}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Impact: {b.impact}
                          </p>
                          <p className="text-xs mt-1 text-foreground">
                            <Zap className="w-3 h-3 inline mr-1 text-amber-500" />
                            {b.recommendation}
                          </p>
                        </div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', config.badge)}>
                          {b.severity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Index Recommendations */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('indexes')}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('indexes') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <h3 className="font-semibold text-foreground">
                  Index Recommendations
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {result.indexRecommendations.length} recommended
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport();
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </button>
            {expandedSections.has('indexes') && (
              <div className="border-t border-border p-4 space-y-3">
                {result.indexRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border p-4 space-y-2"
                  >
                    <p className="text-sm text-foreground">{rec.reason}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      <Zap className="w-3 h-3 inline mr-1" />
                      {rec.estimatedImprovement}
                    </p>
                    <div className="relative">
                      <button
                        onClick={() =>
                          handleCopy(rec.createStatement, `idx-${idx}`)
                        }
                        className="absolute top-2 right-2 p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                      >
                        {copiedId === `idx-${idx}` ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <pre className="bg-[#1e293b] text-slate-100 p-3 text-xs font-mono rounded-lg overflow-x-auto">
                        {rec.createStatement}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Join & Memory Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Join Analysis */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h4 className="font-medium text-foreground text-sm mb-3">
                Join Analysis
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Join Count</span>
                  <span className="font-medium text-foreground">
                    {result.joinAnalysis.joinCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Join Types</span>
                  <span className="font-medium text-foreground">
                    {result.joinAnalysis.joinTypes.join(', ')}
                  </span>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-muted-foreground mb-1">Costliest Join</p>
                  <p className="text-foreground">
                    {result.joinAnalysis.costliestJoin}
                  </p>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-aqua-600 dark:text-aqua-400">
                    {result.joinAnalysis.recommendation}
                  </p>
                </div>
              </div>
            </div>

            {/* Memory Analysis */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h4 className="font-medium text-foreground text-sm mb-3">
                Memory Analysis
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Work Memory</span>
                  <span className="font-medium text-foreground">
                    {result.memoryAnalysis.estimatedWorkMem}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spill to Disk</span>
                  <span
                    className={cn(
                      'font-medium',
                      result.memoryAnalysis.sortSpillToDisk
                        ? 'text-red-600'
                        : 'text-emerald-600',
                    )}
                  >
                    {result.memoryAnalysis.sortSpillToDisk ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hash Buckets</span>
                  <span className="font-medium text-foreground">
                    {result.memoryAnalysis.hashBuckets.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dialect Notes */}
          {result.dialectSpecificNotes && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                Dialect-Specific Notes
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                {result.dialectSpecificNotes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
