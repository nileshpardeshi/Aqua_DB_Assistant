import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  Zap,
  TrendingDown,
  Minus,
  Download,
  ArrowRight,
  Activity,
  FlaskConical,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import { useProject } from '@/hooks/use-projects';

interface PartitionMetrics {
  estimatedScanRows: string;
  estimatedTime: string;
  scanType: string;
}

interface PartitionDetail {
  name: string;
  condition: string;
  estimatedRows: string;
}

interface PartitionRecommendation {
  tableName: string;
  strategy: 'RANGE' | 'LIST' | 'HASH';
  partitionKey: string;
  reason: string;
  estimatedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  queryImprovement: string;
  partitions: PartitionDetail[];
  ddl: string;
  beforeMetrics: PartitionMetrics;
  afterMetrics: PartitionMetrics;
  warnings: string[];
}

interface PartitionAnalysisResult {
  partitionRecommendations: PartitionRecommendation[];
  generalAdvice: string;
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

const STRATEGY_COLORS: Record<string, string> = {
  RANGE: 'bg-purple-100 text-purple-700',
  LIST: 'bg-cyan-100 text-cyan-700',
  HASH: 'bg-orange-100 text-orange-700',
};

const DATA_VOLUMES = [
  { value: '100K rows', label: '100K rows' },
  { value: '1M rows', label: '1M rows' },
  { value: '10M rows', label: '10M rows' },
  { value: '100M rows', label: '100M rows' },
  { value: '1B rows', label: '1B+ rows' },
];

const ANALYSIS_STEPS = [
  { label: 'Parsing query patterns', icon: Layers },
  { label: 'Estimating data distribution', icon: Activity },
  { label: 'Evaluating partition strategies', icon: Zap },
  { label: 'Generating DDL & metrics', icon: Sparkles },
];

export function PartitionAdvisor() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);

  const [queries, setQueries] = useState('');
  const [dataVolume, setDataVolume] = useState('10M rows');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PartitionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!projectId) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setAnalysisStep(0);

    // Start the analysis step progression
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 1200);

    try {
      const queryPatterns = queries
        .split(';')
        .map((q) => q.trim())
        .filter(Boolean);

      const response = await apiClient.post('/ai/performance/recommend-partitions', {
        projectId,
        dialect: project?.dialect || 'postgresql',
        queryPatterns,
        dataVolume,
      });

      const data = response as unknown as {
        recommendations: PartitionAnalysisResult;
      };

      // Handle both wrapped and unwrapped response formats
      const analysisResult = data.recommendations as unknown as PartitionAnalysisResult;
      if (analysisResult?.partitionRecommendations) {
        setResult(analysisResult);
      } else {
        // AI might return in a slightly different format, normalize it
        setResult({
          partitionRecommendations: (analysisResult as unknown as { partitionRecommendations?: PartitionRecommendation[] })?.partitionRecommendations || [],
          generalAdvice: (analysisResult as unknown as { generalAdvice?: string })?.generalAdvice || '',
          summary: (analysisResult as unknown as { summary?: string })?.summary || 'Analysis complete.',
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
      setIsAnalyzing(false);
      setAnalysisStep(0);
    }
  }, [queries, projectId, project?.dialect, dataVolume]);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleCopyAllDDL = useCallback(() => {
    if (!result) return;
    const allDDL = result.partitionRecommendations
      .map((r) => `-- Partition ${r.tableName} (${r.strategy} on ${r.partitionKey})\n${r.ddl}`)
      .join('\n\n');
    navigator.clipboard.writeText(allDDL);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  }, [result]);

  const handleExportDDL = useCallback(() => {
    if (!result) return;
    const allDDL = result.partitionRecommendations
      .map((r) => `-- Partition ${r.tableName} (${r.strategy} on ${r.partitionKey})\n-- Reason: ${r.reason}\n${r.ddl}`)
      .join('\n\n');
    const blob = new Blob([allDDL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'partition_recommendations.sql';
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleLoadDemo = useCallback(() => {
    setQueries(
      `SELECT * FROM orders WHERE created_at BETWEEN '2025-01-01' AND '2025-03-31';\n\nSELECT COUNT(*) FROM events WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days';\n\nSELECT * FROM logs WHERE log_level = 'ERROR' AND timestamp > '2025-01-01';`
    );
    setDataVolume('10M rows');
    setResult({
      partitionRecommendations: [
        {
          tableName: 'orders',
          strategy: 'RANGE',
          partitionKey: 'created_at',
          reason: 'Orders table has 10M+ rows with heavy date-range queries. Range partitioning on created_at will enable partition pruning.',
          estimatedImpact: 'HIGH',
          queryImprovement: 'Date-range queries will scan only relevant quarterly partitions instead of the full table, reducing I/O by ~75%.',
          beforeMetrics: { estimatedScanRows: '10,000,000', estimatedTime: '2,450ms', scanType: 'Full Table Scan' },
          afterMetrics: { estimatedScanRows: '2,500,000', estimatedTime: '380ms', scanType: 'Partition Pruned Scan' },
          partitions: [
            { name: 'orders_q1_2025', condition: "created_at >= '2025-01-01' AND created_at < '2025-04-01'", estimatedRows: '2,500,000' },
            { name: 'orders_q2_2025', condition: "created_at >= '2025-04-01' AND created_at < '2025-07-01'", estimatedRows: '2,500,000' },
            { name: 'orders_q3_2025', condition: "created_at >= '2025-07-01' AND created_at < '2025-10-01'", estimatedRows: '2,500,000' },
            { name: 'orders_q4_2025', condition: "created_at >= '2025-10-01' AND created_at < '2026-01-01'", estimatedRows: '2,500,000' },
          ],
          ddl: `CREATE TABLE orders (\n    id BIGSERIAL,\n    customer_id BIGINT NOT NULL,\n    total DECIMAL(12,2) NOT NULL,\n    status VARCHAR(20) NOT NULL,\n    created_at TIMESTAMP NOT NULL\n) PARTITION BY RANGE (created_at);\n\nCREATE TABLE orders_q1_2025 PARTITION OF orders\n    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');\n\nCREATE TABLE orders_q2_2025 PARTITION OF orders\n    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');\n\nCREATE TABLE orders_q3_2025 PARTITION OF orders\n    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');\n\nCREATE TABLE orders_q4_2025 PARTITION OF orders\n    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');`,
          warnings: [
            'Existing foreign keys referencing this table must be updated',
            'Requires data migration for existing rows',
          ],
        },
        {
          tableName: 'events',
          strategy: 'LIST',
          partitionKey: 'event_type',
          reason: 'Events table filtered frequently by event_type. List partitioning groups related events for faster access.',
          estimatedImpact: 'MEDIUM',
          queryImprovement: 'Queries filtering by event_type will scan only the relevant partition, improving performance by ~60%.',
          beforeMetrics: { estimatedScanRows: '8,000,000', estimatedTime: '1,800ms', scanType: 'Full Table Scan' },
          afterMetrics: { estimatedScanRows: '1,200,000', estimatedTime: '420ms', scanType: 'Single Partition Scan' },
          partitions: [
            { name: 'events_auth', condition: "event_type IN ('login', 'logout', 'signup')", estimatedRows: '3,000,000' },
            { name: 'events_activity', condition: "event_type IN ('page_view', 'click', 'scroll')", estimatedRows: '3,500,000' },
            { name: 'events_system', condition: "event_type IN ('error', 'warning', 'info')", estimatedRows: '1,500,000' },
          ],
          ddl: `CREATE TABLE events (\n    id BIGSERIAL,\n    user_id BIGINT,\n    event_type VARCHAR(50) NOT NULL,\n    payload JSONB,\n    created_at TIMESTAMP NOT NULL\n) PARTITION BY LIST (event_type);\n\nCREATE TABLE events_auth PARTITION OF events\n    FOR VALUES IN ('login', 'logout', 'signup');\n\nCREATE TABLE events_activity PARTITION OF events\n    FOR VALUES IN ('page_view', 'click', 'scroll');\n\nCREATE TABLE events_system PARTITION OF events\n    FOR VALUES IN ('error', 'warning', 'info');`,
          warnings: [
            'New event types will need a default partition or schema update',
          ],
        },
        {
          tableName: 'logs',
          strategy: 'HASH',
          partitionKey: 'id',
          reason: 'Logs table is very large but queries are not filtered by a specific column consistently. Hash partitioning distributes data evenly.',
          estimatedImpact: 'LOW',
          queryImprovement: 'Even data distribution across partitions improves parallel query performance by ~30%.',
          beforeMetrics: { estimatedScanRows: '15,000,000', estimatedTime: '3,200ms', scanType: 'Full Table Scan' },
          afterMetrics: { estimatedScanRows: '3,750,000', estimatedTime: '1,850ms', scanType: 'Hash Distributed Scan' },
          partitions: [
            { name: 'logs_p0', condition: 'MODULUS 4 REMAINDER 0', estimatedRows: '3,750,000' },
            { name: 'logs_p1', condition: 'MODULUS 4 REMAINDER 1', estimatedRows: '3,750,000' },
            { name: 'logs_p2', condition: 'MODULUS 4 REMAINDER 2', estimatedRows: '3,750,000' },
            { name: 'logs_p3', condition: 'MODULUS 4 REMAINDER 3', estimatedRows: '3,750,000' },
          ],
          ddl: `CREATE TABLE logs (\n    id BIGSERIAL,\n    log_level VARCHAR(10) NOT NULL,\n    message TEXT,\n    source VARCHAR(100),\n    timestamp TIMESTAMP NOT NULL\n) PARTITION BY HASH (id);\n\nCREATE TABLE logs_p0 PARTITION OF logs\n    FOR VALUES WITH (MODULUS 4, REMAINDER 0);\n\nCREATE TABLE logs_p1 PARTITION OF logs\n    FOR VALUES WITH (MODULUS 4, REMAINDER 1);\n\nCREATE TABLE logs_p2 PARTITION OF logs\n    FOR VALUES WITH (MODULUS 4, REMAINDER 2);\n\nCREATE TABLE logs_p3 PARTITION OF logs\n    FOR VALUES WITH (MODULUS 4, REMAINDER 3);`,
          warnings: [
            'Hash partitioning does not support partition pruning for range queries',
          ],
        },
      ],
      generalAdvice: 'For tables exceeding 10M rows with predictable query patterns, partitioning can significantly reduce query times. Always test partition strategies in a staging environment before applying to production.',
      summary: 'Analysis identified 3 partition opportunities across 3 tables. The orders table benefits most from RANGE partitioning on created_at (75% I/O reduction). Events table benefits from LIST partitioning by event_type.',
    });
    setExpandedIds(new Set([0]));
    setError(null);
  }, []);

  const toggleExpand = useCallback((idx: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // Derived chart data (computed when result is available)
  const totalPartitions = result
    ? result.partitionRecommendations.reduce((sum, r) => sum + (r.partitions?.length || 0), 0)
    : 0;

  const strategyCounts: Record<string, number> = { RANGE: 0, LIST: 0, HASH: 0 };
  if (result) {
    result.partitionRecommendations.forEach((r) => {
      if (strategyCounts[r.strategy] !== undefined) strategyCounts[r.strategy]++;
    });
  }

  const highImpactCount = result
    ? result.partitionRecommendations.filter((r) => r.estimatedImpact === 'HIGH').length
    : 0;

  const strategyChartData = [
    { name: 'RANGE', value: strategyCounts.RANGE, fill: '#8b5cf6' },
    { name: 'LIST', value: strategyCounts.LIST, fill: '#06b6d4' },
    { name: 'HASH', value: strategyCounts.HASH, fill: '#f97316' },
  ].filter((d) => d.value > 0);

  const partitionCountData = result
    ? result.partitionRecommendations.map((r) => ({
        table: r.tableName,
        partitions: r.partitions?.length || 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          Paste Queries for Partition Analysis
        </label>
        <textarea
          value={queries}
          onChange={(e) => setQueries(e.target.value)}
          placeholder={`-- Paste queries that are slow on large tables\nSELECT * FROM orders WHERE created_at BETWEEN '2025-01-01' AND '2025-03-31';\n\nSELECT COUNT(*) FROM events WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days';\n\nSELECT * FROM logs WHERE log_level = 'ERROR' AND timestamp > '2025-01-01';`}
          rows={8}
          spellCheck={false}
          className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">
            Data Volume
          </label>
          <select
            value={dataVolume}
            onChange={(e) => setDataVolume(e.target.value)}
            className="px-3 py-2 text-sm bg-card border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400"
          >
            {DATA_VOLUMES.map((vol) => (
              <option key={vol.value} value={vol.value}>
                {vol.label}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !projectId}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
              isAnalyzing || !projectId
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
                Analyze for Partitioning
              </>
            )}
          </button>
          <button
            onClick={handleLoadDemo}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FlaskConical className="w-4 h-4" />
            Load Demo
          </button>
        </div>

        {isAnalyzing && (
          <span className="text-xs text-slate-500 pt-4">
            AI is analyzing table structures and query patterns for partition opportunities...
          </span>
        )}
      </div>

      {/* Analysis Progress Stepper */}
      {isAnalyzing && (
        <div className="bg-card border border-slate-200 rounded-lg p-5">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-4">
            {ANALYSIS_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = idx < analysisStep;
              const isActive = idx === analysisStep;
              const isPending = idx > analysisStep;

              return (
                <div key={step.label} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                        isCompleted && 'bg-aqua-500 text-white',
                        isActive && 'bg-aqua-100 text-aqua-600 animate-pulse ring-2 ring-aqua-500',
                        isPending && 'bg-slate-100 text-slate-400'
                      )}
                    >
                      <StepIcon className="w-4 h-4" />
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium text-center max-w-[100px]',
                        isCompleted && 'text-aqua-600',
                        isActive && 'text-aqua-700 font-semibold',
                        isPending && 'text-slate-400'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < ANALYSIS_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-3 mt-[-18px] rounded-full transition-all',
                        idx < analysisStep ? 'bg-aqua-500' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Gradient progress bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-aqua-400 via-aqua-500 to-aqua-600 transition-all duration-500 ease-out"
              style={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }}
            />
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

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <div className="bg-aqua-50 border border-aqua-200 rounded-lg p-4">
              <p className="text-sm text-aqua-800">{result.summary}</p>
            </div>
          )}

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Tables', value: result.partitionRecommendations.length, color: 'text-aqua-600' },
              { label: 'Total Partitions', value: totalPartitions, color: 'text-violet-600' },
              { label: 'High Impact', value: highImpactCount, color: 'text-red-600' },
              { label: 'RANGE', value: strategyCounts.RANGE, color: 'text-purple-600' },
              { label: 'LIST', value: strategyCounts.LIST, color: 'text-cyan-600' },
              { label: 'HASH', value: strategyCounts.HASH, color: 'text-orange-600' },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">{stat.label}</p>
                <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Strategy Distribution PieChart + Partitions per Table BarChart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left - PieChart donut */}
            <div className="bg-card border border-slate-200 rounded-lg p-4">
              <h5 className="text-xs font-semibold text-slate-700 mb-3">Strategy Distribution</h5>
              {strategyChartData.length > 0 ? (
                <>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={strategyChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          stroke="none"
                        >
                          {strategyChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    {strategyChartData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: entry.fill }}
                        />
                        <span className="text-[10px] font-medium text-slate-600">
                          {entry.name} ({entry.value})
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10">No strategy data</p>
              )}
            </div>

            {/* Right - BarChart */}
            <div className="bg-card border border-slate-200 rounded-lg p-4">
              <h5 className="text-xs font-semibold text-slate-700 mb-3">Partitions per Table</h5>
              {partitionCountData.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={partitionCountData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="table"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <Tooltip
                        contentStyle={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="partitions" fill="#0891b2" radius={[4, 4, 0, 0]} name="Partitions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10">No partition data</p>
              )}
            </div>
          </div>

          {/* Header with actions */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">
              Partition Recommendations ({result.partitionRecommendations.length})
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportDDL}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export DDL
              </button>
              <button
                onClick={handleCopyAllDDL}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {copiedId === 'all' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Copied All
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy All DDL
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recommendation Cards */}
          {result.partitionRecommendations.map((rec, idx) => {
            const impact = IMPACT_CONFIG[rec.estimatedImpact] || IMPACT_CONFIG.MEDIUM;
            const ImpactIcon = impact.icon;
            const isExpanded = expandedIds.has(idx);
            const stratColor = STRATEGY_COLORS[rec.strategy] || 'bg-slate-100 text-slate-700';

            return (
              <div
                key={idx}
                className={cn(
                  'bg-card border rounded-lg overflow-hidden transition-all',
                  impact.border
                )}
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpand(idx)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      impact.bg
                    )}
                  >
                    <ImpactIcon className={cn('w-4 h-4', impact.text)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {rec.tableName}
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-[10px] font-bold rounded uppercase',
                          stratColor
                        )}
                      >
                        {rec.strategy}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        on {rec.partitionKey}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {rec.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                        impact.badge
                      )}
                    >
                      {rec.estimatedImpact}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-4">
                    {/* Query Improvement */}
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">
                        Expected Improvement:
                      </p>
                      <p className="text-sm text-slate-700">{rec.queryImprovement}</p>
                    </div>

                    {/* Enhanced Before / After Metrics - Visual Comparison Bars */}
                    <div className="bg-card border border-slate-200 rounded-lg p-4 space-y-4">
                      <h5 className="text-xs font-semibold text-slate-700">Performance Comparison</h5>

                      {/* Rows Scanned */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">Rows Scanned</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-red-600 font-mono w-20 text-right flex-shrink-0">
                            {rec.beforeMetrics?.estimatedScanRows || 'All'}
                          </span>
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 bg-red-200 rounded-full" style={{ width: '100%' }} />
                            <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all" style={{ width: '25%' }} />
                          </div>
                          <span className="text-[10px] text-emerald-600 font-mono w-20 flex-shrink-0">
                            {rec.afterMetrics?.estimatedScanRows || 'Reduced'}
                          </span>
                        </div>
                      </div>

                      {/* Estimated Time */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">Estimated Time</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-red-600 font-mono w-20 text-right flex-shrink-0">
                            {rec.beforeMetrics?.estimatedTime || 'N/A'}
                          </span>
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 bg-red-200 rounded-full" style={{ width: '100%' }} />
                            <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all" style={{ width: '15%' }} />
                          </div>
                          <span className="text-[10px] text-emerald-600 font-mono w-20 flex-shrink-0">
                            {rec.afterMetrics?.estimatedTime || 'Faster'}
                          </span>
                        </div>
                      </div>

                      {/* Scan Type Change */}
                      <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Before:</span>
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
                            {rec.beforeMetrics?.scanType || 'Full Table Scan'}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">After:</span>
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                            {rec.afterMetrics?.scanType || 'Partition Pruned'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Partition Distribution Chart + Partition Details Table */}
                    {rec.partitions && rec.partitions.length > 0 && (() => {
                      const chartData = rec.partitions.map((p) => ({
                        name: p.name,
                        rows: parseInt(String(p.estimatedRows).replace(/[^0-9]/g, '')) || 0,
                      }));
                      return (
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-2">
                            Partition Layout ({rec.partitions.length} partitions)
                          </p>
                          {chartData.some((d) => d.rows > 0) && (
                            <div className="bg-card border border-slate-200 rounded-lg p-3 mb-3">
                              <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={120} axisLine={{ stroke: '#e2e8f0' }} />
                                    <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                                    <Bar dataKey="rows" fill="#0891b2" radius={[0, 4, 4, 0]} name="Est. Rows" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                          {/* Partition Details Table */}
                          <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-100">
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Name
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600">
                                    Condition
                                  </th>
                                  <th className="px-3 py-2 text-right font-medium text-slate-600">
                                    Est. Rows
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {rec.partitions.map((p, i) => (
                                  <tr
                                    key={i}
                                    className="border-b border-slate-100 last:border-0"
                                  >
                                    <td className="px-3 py-2 font-mono text-slate-700">
                                      {p.name}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {p.condition}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600">
                                      {p.estimatedRows}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* DDL */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-slate-600">
                          Partition DDL:
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rec.ddl, `ddl-${idx}`);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          {copiedId === `ddl-${idx}` ? (
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
                      <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {rec.ddl}
                      </div>
                    </div>

                    {/* Warnings */}
                    {rec.warnings && rec.warnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1.5">
                          Considerations
                        </p>
                        <ul className="space-y-1">
                          {rec.warnings.map((w, i) => (
                            <li
                              key={i}
                              className="text-xs text-amber-700 flex items-start gap-1.5"
                            >
                              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* General Advice */}
          {result.generalAdvice && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-600 uppercase mb-1.5">
                General Partitioning Advice
              </p>
              <p className="text-sm text-slate-700">{result.generalAdvice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PartitionAdvisor;
