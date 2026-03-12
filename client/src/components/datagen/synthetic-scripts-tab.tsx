import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  Download,
  Database,
  Search,
  Zap,
  ChevronDown,
  ChevronRight,
  FileCode,
  ArrowRight,
  Layers,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/use-projects';
import { useTables } from '@/hooks/use-schema';
import { useCreatePerformanceRun } from '@/hooks/use-performance';
import {
  useGenerateSyntheticData,
  type SyntheticDataResult,
} from '@/hooks/use-datagen';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROW_COUNT_OPTIONS = [
  { label: '1K', value: 1_000 },
  { label: '10K', value: 10_000 },
  { label: '100K', value: 100_000 },
  { label: '1M', value: 1_000_000 },
  { label: '10M', value: 10_000_000 },
  { label: '100M', value: 100_000_000 },
];

const DISTRIBUTION_OPTIONS = [
  {
    type: 'realistic' as const,
    label: 'Realistic',
    description: 'Domain-aware patterns (names, dates, amounts)',
  },
  {
    type: 'uniform' as const,
    label: 'Uniform',
    description: 'Evenly distributed random values',
  },
  {
    type: 'gaussian' as const,
    label: 'Gaussian',
    description: 'Normal distribution (bell curve)',
  },
  {
    type: 'zipf' as const,
    label: 'Zipf',
    description: 'Power-law (few frequent, many rare)',
  },
];

const ANALYSIS_STEPS = [
  { label: 'Analyzing schema', icon: Search },
  { label: 'Resolving dependencies', icon: Layers },
  { label: 'Generating scripts', icon: FileCode },
  { label: 'Optimizing batches', icon: Sparkles },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function SyntheticScriptsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const { data: tables } = useTables(projectId);
  const generateMutation = useGenerateSyntheticData();
  const createRun = useCreatePerformanceRun();

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(10_000);
  const [distribution, setDistribution] = useState<'uniform' | 'gaussian' | 'zipf' | 'realistic'>('realistic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SyntheticDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedScripts, setExpandedScripts] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleTable = (tableName: string) => {
    setSelectedTables((prev) =>
      prev.includes(tableName)
        ? prev.filter((t) => t !== tableName)
        : [...prev, tableName],
    );
  };

  const selectAllTables = () => {
    if (!tables) return;
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map((t) => t.name));
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!projectId || !project || selectedTables.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    setAnalysisStep(0);
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 1500);

    try {
      const data = await generateMutation.mutateAsync({
        projectId,
        dialect: project.dialect ?? 'PostgreSQL',
        selectedTables,
        rowCount,
        distributionConfig: { type: distribution },
      });
      setResult(data);

      // Track in performance history
      try {
        await createRun.mutateAsync({
          projectId,
          type: 'synthetic-data-gen',
          name: `Generate ${rowCount.toLocaleString()} rows for ${selectedTables.length} tables`,
          config: { selectedTables, rowCount, distribution },
        });
      } catch {
        // Non-critical
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate synthetic data. Check AI provider configuration.',
      );
    } finally {
      setIsGenerating(false);
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
    }
  }, [projectId, project, selectedTables, rowCount, distribution, generateMutation, createRun]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadAll = () => {
    if (!result) return;
    const allSql = result.scripts
      .sort((a, b) => a.insertOrder - b.insertOrder)
      .map((s) => `-- Table: ${s.tableName} (Order: ${s.insertOrder})\n-- Rows: ${s.rowCount.toLocaleString()}\n\n${s.sqlScript}`)
      .join('\n\n-- ═══════════════════════════════════════════\n\n');

    const header = `-- Synthetic Data Generation Script\n-- Generated by Aqua DB Copilot\n-- Tables: ${result.insertOrder.join(', ')}\n-- Total estimated size: ${result.totalEstimatedSize}\n\n`;

    const blob = new Blob([header + allSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthetic_data_${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleScript = (idx: number) => {
    setExpandedScripts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleLoadDemo = () => {
    setResult({
      scripts: [
        {
          tableName: 'customers',
          insertOrder: 1,
          rowCount: 10000,
          batchSize: 1000,
          sqlScript:
            "INSERT INTO customers (first_name, last_name, email, created_at) VALUES\n('John', 'Smith', 'john.smith@example.com', '2024-01-15 10:30:00'),\n('Jane', 'Doe', 'jane.doe@example.com', '2024-02-20 14:15:00'),\n('Robert', 'Johnson', 'r.johnson@example.com', '2024-03-10 09:45:00');\n\n-- For 10,000 rows, use generate_series:\n-- INSERT INTO customers (first_name, last_name, email, created_at)\n-- SELECT\n--   (ARRAY['John','Jane','Robert','Emily','Michael'])[1 + floor(random()*5)::int],\n--   (ARRAY['Smith','Doe','Johnson','Williams','Brown'])[1 + floor(random()*5)::int],\n--   'user_' || g || '@example.com',\n--   timestamp '2023-01-01' + (random() * 730 || ' days')::interval\n-- FROM generate_series(1, 10000) AS g;",
          sampleRows: [
            ['John', 'Smith', 'john.smith@example.com', '2024-01-15'],
            ['Jane', 'Doe', 'jane.doe@example.com', '2024-02-20'],
            ['Robert', 'Johnson', 'r.johnson@example.com', '2024-03-10'],
          ],
          columnsUsed: ['first_name', 'last_name', 'email', 'created_at'],
          generatorStrategies: {
            first_name: 'Random selection from common first names',
            last_name: 'Random selection from common last names',
            email: 'Pattern: user_{id}@example.com',
            created_at: 'Random timestamp in 2023-2024 range',
          },
          estimatedSizeBytes: 512000,
          referentialIntegrityNotes: 'Root table — no FK dependencies',
        },
        {
          tableName: 'orders',
          insertOrder: 2,
          rowCount: 10000,
          batchSize: 1000,
          sqlScript:
            "INSERT INTO orders (customer_id, total_amount, status, created_at) VALUES\n(1, 129.99, 'completed', '2024-01-20 11:00:00'),\n(2, 59.50, 'pending', '2024-02-25 16:30:00'),\n(1, 249.00, 'completed', '2024-03-15 08:20:00');\n\n-- For 10,000 rows:\n-- INSERT INTO orders (customer_id, total_amount, status, created_at)\n-- SELECT\n--   1 + floor(random() * 10000)::int,\n--   round((random() * 500 + 10)::numeric, 2),\n--   (ARRAY['pending','completed','cancelled','refunded'])[1 + floor(random()*4)::int],\n--   timestamp '2023-06-01' + (random() * 365 || ' days')::interval\n-- FROM generate_series(1, 10000) AS g;",
          sampleRows: [
            ['1', '129.99', 'completed', '2024-01-20'],
            ['2', '59.50', 'pending', '2024-02-25'],
            ['1', '249.00', 'completed', '2024-03-15'],
          ],
          columnsUsed: ['customer_id', 'total_amount', 'status', 'created_at'],
          generatorStrategies: {
            customer_id: 'Random FK reference to customers.id (1-N)',
            total_amount: 'Gaussian distribution, mean=$100, stddev=$80',
            status: 'Weighted: completed(60%), pending(25%), cancelled(10%), refunded(5%)',
            created_at: 'Realistic timestamp distribution over 12 months',
          },
          estimatedSizeBytes: 768000,
          referentialIntegrityNotes: 'References customers.id via customer_id FK',
        },
      ],
      insertOrder: ['customers', 'orders'],
      totalEstimatedSize: '1.2 MB',
      dialectNotes:
        'PostgreSQL: For best performance on large datasets, consider using COPY instead of INSERT. Also consider disabling indexes and triggers during bulk load, then rebuilding them.',
      summary:
        'Generated synthetic data scripts for 2 tables with referential integrity. Insert order: customers → orders. Total estimated size: 1.2 MB for 20,000 rows.',
    });
    setSelectedTables(['customers', 'orders']);
    setRowCount(10000);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Generate Synthetic Data
          </h3>
          <button
            onClick={handleLoadDemo}
            className="text-xs text-aqua-600 hover:text-aqua-700 dark:text-aqua-400 dark:hover:text-aqua-300 font-medium"
          >
            <FlaskConical className="w-3.5 h-3.5 inline mr-1" />
            Load Demo
          </button>
        </div>

        {/* Table Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">
              Select Tables
            </label>
            {tables && tables.length > 0 && (
              <button
                onClick={selectAllTables}
                className="text-xs text-aqua-600 hover:text-aqua-700 dark:text-aqua-400"
              >
                {selectedTables.length === tables.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            )}
          </div>
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
                        : 'bg-card border-border text-muted-foreground hover:border-aqua-300 hover:text-foreground',
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

        {/* Row Count */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Row Count per Table
          </label>
          <div className="flex flex-wrap gap-2">
            {ROW_COUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRowCount(opt.value)}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg border font-medium transition-colors',
                  rowCount === opt.value
                    ? 'bg-aqua-500 border-aqua-500 text-white'
                    : 'bg-card border-border text-muted-foreground hover:border-aqua-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Distribution */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Data Distribution
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {DISTRIBUTION_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => setDistribution(opt.type)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-colors',
                  distribution === opt.type
                    ? 'bg-aqua-50 dark:bg-aqua-900/30 border-aqua-300 dark:border-aqua-700'
                    : 'bg-card border-border hover:border-aqua-300',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-medium',
                    distribution === opt.type
                      ? 'text-aqua-700 dark:text-aqua-300'
                      : 'text-foreground',
                  )}
                >
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {opt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || selectedTables.length === 0}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            isGenerating || selectedTables.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-gradient-to-r from-aqua-500 to-aqua-600 hover:from-aqua-600 hover:to-aqua-700 text-white shadow-lg shadow-aqua-500/20',
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate {rowCount.toLocaleString()} Rows ×{' '}
              {selectedTables.length} Tables
            </>
          )}
        </button>
      </div>

      {/* Progress Stepper */}
      {isGenerating && (
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
                          ? 'bg-aqua-100 dark:bg-aqua-900/30 text-aqua-600 animate-pulse'
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
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Generation Results
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.summary}
                </p>
              </div>
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-2 px-4 py-2 bg-aqua-500 hover:bg-aqua-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download All
              </button>
            </div>

            {/* Insert Order */}
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Insert Order (FK Dependencies)
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {result.insertOrder.map((table, idx) => (
                  <div key={table} className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-secondary rounded-lg text-sm font-medium text-foreground">
                      <span className="text-aqua-500 mr-1.5">{idx + 1}.</span>
                      {table}
                    </span>
                    {idx < result.insertOrder.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Tables</p>
                <p className="text-lg font-bold text-foreground">
                  {result.scripts.length}
                </p>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total Size</p>
                <p className="text-lg font-bold text-foreground">
                  {result.totalEstimatedSize}
                </p>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Distribution</p>
                <p className="text-lg font-bold text-foreground capitalize">
                  {distribution}
                </p>
              </div>
            </div>
          </div>

          {/* Per-table Scripts */}
          {result.scripts
            .sort((a, b) => a.insertOrder - b.insertOrder)
            .map((script, idx) => {
              const isExpanded = expandedScripts.has(idx);
              const copyKey = `script-${idx}`;
              return (
                <div
                  key={idx}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  {/* Script Header */}
                  <button
                    onClick={() => toggleScript(idx)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <span className="font-semibold text-foreground">
                          {script.tableName}
                        </span>
                        <span className="text-sm text-muted-foreground ml-2">
                          (Order: {script.insertOrder})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{script.rowCount.toLocaleString()} rows</span>
                      <span>
                        {(script.estimatedSizeBytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </button>

                  {/* Script Body */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* FK Notes */}
                      {script.referentialIntegrityNotes && (
                        <div className="px-6 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-border">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            <Layers className="w-3 h-3 inline mr-1" />
                            {script.referentialIntegrityNotes}
                          </p>
                        </div>
                      )}

                      {/* Generator Strategies */}
                      <div className="px-6 py-3 border-b border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                          Generator Strategies
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(script.generatorStrategies).map(
                            ([col, strategy]) => (
                              <span
                                key={col}
                                className="px-2 py-1 bg-secondary rounded text-xs"
                              >
                                <span className="font-medium text-foreground">
                                  {col}:
                                </span>{' '}
                                <span className="text-muted-foreground">
                                  {strategy}
                                </span>
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      {/* SQL Script */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            handleCopy(script.sqlScript, copyKey)
                          }
                          className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors z-10"
                        >
                          {copiedId === copyKey ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <pre className="bg-[#1e293b] text-slate-100 p-4 text-xs font-mono overflow-x-auto max-h-72 leading-relaxed">
                          {script.sqlScript}
                        </pre>
                      </div>

                      {/* Sample Rows */}
                      {script.sampleRows && script.sampleRows.length > 0 && (
                        <div className="px-6 py-3 border-t border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            Sample Rows
                          </p>
                          <div className="overflow-x-auto">
                            <table className="text-xs w-full">
                              <thead>
                                <tr className="border-b border-border">
                                  {script.columnsUsed.map((col) => (
                                    <th
                                      key={col}
                                      className="text-left py-1.5 px-2 font-medium text-muted-foreground"
                                    >
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {script.sampleRows.slice(0, 5).map((row, ri) => (
                                  <tr
                                    key={ri}
                                    className="border-b border-border/50"
                                  >
                                    {row.map((val, ci) => (
                                      <td
                                        key={ci}
                                        className="py-1.5 px-2 text-foreground font-mono"
                                      >
                                        {val}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Dialect Notes */}
          {result.dialectNotes && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                Dialect Notes
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                {result.dialectNotes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
