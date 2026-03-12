import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  BookOpen,
  Copy,
  CheckCircle2,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Code2,
  Search,
  Database,
  FileCode2,
  Activity,
  Layers,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useGenerateSQL,
  useOptimizeQuery,
  useExplainQuery,
} from '@/hooks/use-ai';
import type {
  GeneratedSQL,
  QueryOptimization,
  QueryExplanation,
} from '@/hooks/use-ai';

// ── Props ───────────────────────────────────────────────────────────────────

interface QueryAIPanelProps {
  projectId: string;
  dialect: string;
  currentSQL: string;
  onInsertSQL: (sql: string) => void;
  className?: string;
}

// ── Step Definitions ────────────────────────────────────────────────────────

const GENERATE_STEPS = [
  { label: 'Analyzing request', icon: Search },
  { label: 'Building schema context', icon: Database },
  { label: 'Generating SQL', icon: Code2 },
  { label: 'Validating output', icon: CheckCircle2 },
];

const OPTIMIZE_STEPS = [
  { label: 'Parsing query', icon: FileCode2 },
  { label: 'Analyzing execution path', icon: Activity },
  { label: 'Finding optimizations', icon: Zap },
  { label: 'Generating recommendations', icon: Sparkles },
];

const EXPLAIN_STEPS = [
  { label: 'Parsing SQL', icon: FileCode2 },
  { label: 'Identifying clauses', icon: Layers },
  { label: 'Analyzing tables', icon: Database },
  { label: 'Building explanation', icon: BookOpen },
];

// ── Impact Config ───────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<string, { bg: string; border: string; text: string }> = {
  HIGH: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  MEDIUM: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  LOW: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
};

const COMPLEXITY_CONFIG: Record<string, string> = {
  SIMPLE: 'bg-emerald-100 text-emerald-700',
  MODERATE: 'bg-blue-100 text-blue-700',
  COMPLEX: 'bg-amber-100 text-amber-700',
  VERY_COMPLEX: 'bg-red-100 text-red-700',
};

// ── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_GENERATE: { input: string; result: GeneratedSQL } = {
  input: 'Find the top 10 customers by total order amount in the last 30 days',
  result: {
    sql: `SELECT c.id, c.name, c.email,\n       SUM(o.total_amount) AS total_spent\nFROM customers c\nINNER JOIN orders o ON c.id = o.customer_id\nWHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'\n  AND o.status = 'completed'\nGROUP BY c.id, c.name, c.email\nORDER BY total_spent DESC\nLIMIT 10;`,
    explanation:
      'This query joins the customers and orders tables, filters for completed orders within the last 30 days, aggregates order totals per customer, and returns the top 10 spenders sorted by their total spending in descending order.',
    assumptions: [
      'The "customers" table has id, name, and email columns.',
      'The "orders" table has a customer_id foreign key referencing customers.id.',
      'Only orders with status = \'completed\' should be counted toward the total.',
      'The date range is calculated relative to the current date using INTERVAL syntax.',
    ],
    alternativeApproaches: [
      {
        sql: `SELECT c.id, c.name, c.email,\n       SUM(o.total_amount) AS total_spent\nFROM customers c\nINNER JOIN orders o ON c.id = o.customer_id\nWHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY c.id, c.name, c.email\nORDER BY total_spent DESC\nFETCH FIRST 10 ROWS ONLY;`,
        description:
          'Uses SQL standard FETCH FIRST instead of LIMIT for broader database compatibility. Also includes all order statuses rather than just completed.',
      },
    ],
    warnings: [
      'If the orders table is very large, ensure an index exists on (customer_id, order_date) for optimal performance.',
    ],
  },
};

const DEMO_OPTIMIZE: QueryOptimization = {
  optimizedSQL: `SELECT c.id, c.name, c.email,\n       SUM(o.total_amount) AS total_spent\nFROM customers c\nINNER JOIN orders o ON c.id = o.customer_id\nWHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'\n  AND o.status = 'completed'\nGROUP BY c.id, c.name, c.email\nORDER BY total_spent DESC\nLIMIT 10;`,
  changes: [
    {
      description: 'Replaced SELECT * with explicit column list to reduce I/O and network transfer.',
      impact: 'HIGH',
      category: 'Column Selection',
    },
    {
      description: 'Added filter predicate push-down hint for the date range to enable partition pruning.',
      impact: 'MEDIUM',
      category: 'Filter Optimization',
    },
    {
      description: 'Reordered JOIN predicates so the most selective condition is evaluated first.',
      impact: 'LOW',
      category: 'Join Ordering',
    },
  ],
  indexRecommendations: [
    {
      createStatement: 'CREATE INDEX idx_orders_customer_date ON orders (customer_id, order_date DESC);',
      reason: 'Composite index supports the JOIN on customer_id and ORDER BY on order_date, enabling an index-only scan.',
      estimatedImpact: '~60% reduction in query execution time',
    },
  ],
  warnings: [
    'The LIMIT clause may hide performance issues on the full dataset. Consider monitoring without LIMIT periodically.',
  ],
  estimatedImprovement: '~45% faster execution',
};

const DEMO_EXPLAIN: QueryExplanation = {
  summary:
    'This query retrieves the top 10 customers ranked by their total spending on completed orders within the last 30 days. It performs an inner join, filters by date and status, aggregates totals, and sorts the results.',
  stepByStep: [
    {
      clause: 'FROM',
      sql: 'FROM customers c',
      explanation: 'Starts with the customers table aliased as "c". This is the primary entity being queried.',
    },
    {
      clause: 'JOIN',
      sql: 'INNER JOIN orders o ON c.id = o.customer_id',
      explanation:
        'Joins the orders table (aliased "o") to customers using the foreign key relationship. INNER JOIN ensures only customers with matching orders are included.',
    },
    {
      clause: 'WHERE',
      sql: "WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days' AND o.status = 'completed'",
      explanation:
        'Filters orders to only those placed in the last 30 days with a completed status. This reduces the dataset before aggregation.',
    },
    {
      clause: 'GROUP BY',
      sql: 'GROUP BY c.id, c.name, c.email',
      explanation: 'Groups rows by customer identity so that SUM can aggregate order totals per customer.',
    },
    {
      clause: 'ORDER BY',
      sql: 'ORDER BY total_spent DESC',
      explanation: 'Sorts results by the aggregated total_spent column in descending order so the highest spenders appear first.',
    },
    {
      clause: 'LIMIT',
      sql: 'LIMIT 10',
      explanation: 'Restricts the output to the top 10 rows after sorting.',
    },
  ],
  tablesUsed: [
    { name: 'customers', alias: 'c', role: 'Primary table - source of customer identity data' },
    { name: 'orders', alias: 'o', role: 'Joined table - source of order amounts and dates' },
  ],
  outputColumns: [
    { expression: 'c.id', alias: 'id', description: 'Unique customer identifier' },
    { expression: 'c.name', alias: 'name', description: 'Customer full name' },
    { expression: 'c.email', alias: 'email', description: 'Customer email address' },
    { expression: 'SUM(o.total_amount)', alias: 'total_spent', description: 'Aggregate total of completed order amounts in the last 30 days' },
  ],
  filters: [
    "o.order_date >= CURRENT_DATE - INTERVAL '30 days' -- Only recent orders",
    "o.status = 'completed' -- Only successfully completed orders",
  ],
  performanceNotes: [
    'An index on orders(customer_id, order_date) would significantly speed up the JOIN and WHERE clause evaluation.',
    'Consider a partial index filtered on status = \'completed\' if this is the dominant query pattern.',
    'The GROUP BY + ORDER BY + LIMIT pattern is efficient when supported by a covering index.',
  ],
  complexity: 'MODERATE',
};

// ── Progress Stepper Sub-component ──────────────────────────────────────────

function ProgressStepper({
  steps,
  currentStep,
}: {
  steps: { label: string; icon: React.ComponentType<{ className?: string }> }[];
  currentStep: number;
}) {
  return (
    <div className="bg-card border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;
          return (
            <React.Fragment key={i}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0',
                    isCompleted
                      ? 'bg-aqua-500 text-white'
                      : isActive
                        ? 'bg-aqua-100 text-aqua-700 animate-pulse ring-2 ring-aqua-500'
                        : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    isActive
                      ? 'text-aqua-700 font-medium'
                      : isCompleted
                        ? 'text-aqua-600'
                        : 'text-slate-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 min-w-[20px]',
                    isCompleted ? 'bg-aqua-500' : 'bg-slate-200'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-aqua-500 to-cyan-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function QueryAIPanel({
  projectId,
  dialect,
  currentSQL,
  onInsertSQL,
  className,
}: QueryAIPanelProps) {
  // Section toggle state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['generate'])
  );
  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── NL-to-SQL state ─────────────────────────────────────────────────────
  const [nlInput, setNlInput] = useState('');
  const [generateResult, setGenerateResult] = useState<GeneratedSQL | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateStep, setGenerateStep] = useState(0);
  const generateStepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generateMutation = useGenerateSQL();
  const [expandedGenSubs, setExpandedGenSubs] = useState<Set<string>>(new Set());

  const toggleGenSub = useCallback((id: string) => {
    setExpandedGenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!nlInput.trim() || !projectId) return;
    setGenerateError(null);
    setGenerateResult(null);
    setGenerateStep(0);

    generateStepRef.current = setInterval(() => {
      setGenerateStep((prev) => Math.min(prev + 1, GENERATE_STEPS.length - 1));
    }, 1200);

    try {
      const result = await generateMutation.mutateAsync({
        projectId,
        naturalLanguage: nlInput,
        dialect,
      });
      setGenerateResult(result);
    } catch (err) {
      setGenerateError(
        err instanceof Error
          ? err.message
          : 'Failed to generate SQL. Ensure AI provider is configured in Settings.'
      );
    } finally {
      if (generateStepRef.current) {
        clearInterval(generateStepRef.current);
        generateStepRef.current = null;
      }
      setGenerateStep(0);
    }
  }, [nlInput, projectId, dialect, generateMutation]);

  const handleLoadGenerateDemo = useCallback(() => {
    setNlInput(DEMO_GENERATE.input);
    setGenerateResult(DEMO_GENERATE.result);
    setGenerateError(null);
  }, []);

  // ── Optimizer state ─────────────────────────────────────────────────────
  const [optimizeResult, setOptimizeResult] = useState<QueryOptimization | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [optimizeStep, setOptimizeStep] = useState(0);
  const optimizeStepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optimizeMutation = useOptimizeQuery();

  const handleOptimize = useCallback(async () => {
    if (!currentSQL.trim() || !projectId) return;
    setOptimizeError(null);
    setOptimizeResult(null);
    setOptimizeStep(0);

    optimizeStepRef.current = setInterval(() => {
      setOptimizeStep((prev) => Math.min(prev + 1, OPTIMIZE_STEPS.length - 1));
    }, 1200);

    try {
      const result = await optimizeMutation.mutateAsync({
        projectId,
        sql: currentSQL,
        dialect,
      });
      setOptimizeResult(result);
    } catch (err) {
      setOptimizeError(
        err instanceof Error
          ? err.message
          : 'Failed to optimize query. Ensure AI provider is configured in Settings.'
      );
    } finally {
      if (optimizeStepRef.current) {
        clearInterval(optimizeStepRef.current);
        optimizeStepRef.current = null;
      }
      setOptimizeStep(0);
    }
  }, [currentSQL, projectId, dialect, optimizeMutation]);

  const handleLoadOptimizeDemo = useCallback(() => {
    setOptimizeResult(DEMO_OPTIMIZE);
    setOptimizeError(null);
  }, []);

  // ── Explainer state ─────────────────────────────────────────────────────
  const [explainResult, setExplainResult] = useState<QueryExplanation | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainStep, setExplainStep] = useState(0);
  const explainStepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const explainMutation = useExplainQuery();
  const [expandedExplainSteps, setExpandedExplainSteps] = useState<Set<number>>(new Set());

  const toggleExplainStep = useCallback((idx: number) => {
    setExpandedExplainSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleExplain = useCallback(async () => {
    if (!currentSQL.trim() || !projectId) return;
    setExplainError(null);
    setExplainResult(null);
    setExplainStep(0);

    explainStepRef.current = setInterval(() => {
      setExplainStep((prev) => Math.min(prev + 1, EXPLAIN_STEPS.length - 1));
    }, 1200);

    try {
      const result = await explainMutation.mutateAsync({
        projectId,
        sql: currentSQL,
        dialect,
      });
      setExplainResult(result);
    } catch (err) {
      setExplainError(
        err instanceof Error
          ? err.message
          : 'Failed to explain query. Ensure AI provider is configured in Settings.'
      );
    } finally {
      if (explainStepRef.current) {
        clearInterval(explainStepRef.current);
        explainStepRef.current = null;
      }
      setExplainStep(0);
    }
  }, [currentSQL, projectId, dialect, explainMutation]);

  const handleLoadExplainDemo = useCallback(() => {
    setExplainResult(DEMO_EXPLAIN);
    setExplainError(null);
    setExpandedExplainSteps(new Set([0, 1]));
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (generateStepRef.current) clearInterval(generateStepRef.current);
      if (optimizeStepRef.current) clearInterval(optimizeStepRef.current);
      if (explainStepRef.current) clearInterval(explainStepRef.current);
    };
  }, []);

  // ── Copy Button helper ────────────────────────────────────────────────────
  const CopyButton = useCallback(
    ({ text, id, label = 'Copy' }: { text: string; id: string; label?: string }) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleCopy(text, id);
        }}
        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
      >
        {copiedId === id ? (
          <>
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            {label}
          </>
        )}
      </button>
    ),
    [copiedId, handleCopy]
  );

  // ── Section Header helper ─────────────────────────────────────────────────
  const SectionHeader = useCallback(
    ({
      id,
      icon: Icon,
      iconBg,
      title,
      subtitle,
    }: {
      id: string;
      icon: React.ComponentType<{ className?: string }>;
      iconBg: string;
      title: string;
      subtitle: string;
    }) => (
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform duration-200',
            expandedSections.has(id) && 'rotate-180'
          )}
        />
      </button>
    ),
    [expandedSections]
  );

  // ── Error display helper ──────────────────────────────────────────────────
  const ErrorBox = ({ message }: { message: string }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-red-800">Analysis Failed</p>
        <p className="text-xs text-red-600 mt-1">{message}</p>
      </div>
    </div>
  );

  // ── Dark code block helper ────────────────────────────────────────────────
  const CodeBlock = ({
    sql,
    copyId,
    label,
    action,
  }: {
    sql: string;
    copyId: string;
    label?: string;
    action?: { text: string; onClick: () => void };
  }) => (
    <div>
      {(label || action) && (
        <div className="flex items-center justify-between mb-1">
          {label && <p className="text-xs font-medium text-slate-600">{label}</p>}
          <div className="flex items-center gap-2">
            <CopyButton text={sql} id={copyId} />
            {action && (
              <button
                onClick={action.onClick}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-aqua-600 hover:text-aqua-700 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                {action.text}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {sql}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── Section 1: NL-to-SQL Generator ──────────────────────────────── */}
      <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
        <SectionHeader
          id="generate"
          icon={Sparkles}
          iconBg="bg-aqua-500"
          title="NL-to-SQL Generator"
          subtitle="Generate SQL from natural language descriptions"
        />

        {expandedSections.has('generate') && (
          <div className="border-t border-slate-100 px-4 py-4 space-y-4">
            {/* Input */}
            <textarea
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder="Describe what you want to query... e.g., 'Find the top 10 customers by total order amount in the last 30 days'"
              rows={4}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
            />

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !nlInput.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  generateMutation.isPending || !nlInput.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-aqua-600 text-white hover:bg-aqua-700'
                )}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate SQL
                  </>
                )}
              </button>
              <button
                onClick={handleLoadGenerateDemo}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Database className="w-4 h-4" />
                Load Demo
              </button>
            </div>

            {/* Progress */}
            {generateMutation.isPending && (
              <ProgressStepper steps={GENERATE_STEPS} currentStep={generateStep} />
            )}

            {/* Error */}
            {generateError && <ErrorBox message={generateError} />}

            {/* Results */}
            {generateResult && (
              <div className="space-y-4">
                {/* Main SQL */}
                <CodeBlock
                  sql={generateResult.sql}
                  copyId="gen-main"
                  label="Generated SQL"
                  action={{ text: 'Copy to Editor', onClick: () => onInsertSQL(generateResult.sql) }}
                />

                {/* Explanation */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Explanation</p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {generateResult.explanation}
                  </p>
                </div>

                {/* Assumptions */}
                {generateResult.assumptions && generateResult.assumptions.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleGenSub('assumptions')}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 transition-transform duration-200',
                          expandedGenSubs.has('assumptions') && 'rotate-180'
                        )}
                      />
                      Assumptions ({generateResult.assumptions.length})
                    </button>
                    {expandedGenSubs.has('assumptions') && (
                      <ul className="mt-2 space-y-1.5 pl-5 list-disc">
                        {generateResult.assumptions.map((a, i) => (
                          <li key={i} className="text-xs text-slate-600 leading-relaxed">
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Alternative Approaches */}
                {generateResult.alternativeApproaches && generateResult.alternativeApproaches.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleGenSub('alternatives')}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 transition-transform duration-200',
                          expandedGenSubs.has('alternatives') && 'rotate-180'
                        )}
                      />
                      Alternative Approaches ({generateResult.alternativeApproaches.length})
                    </button>
                    {expandedGenSubs.has('alternatives') && (
                      <div className="mt-2 space-y-3">
                        {generateResult.alternativeApproaches.map((alt, i) => (
                          <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs text-slate-600">{alt.description}</p>
                            <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              {alt.sql}
                            </div>
                            <button
                              onClick={() => onInsertSQL(alt.sql)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-lg hover:bg-aqua-100 transition-colors"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              Use This
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Warnings */}
                {generateResult.warnings && generateResult.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {generateResult.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-700">{w}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Query Optimizer ──────────────────────────────────── */}
      <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
        <SectionHeader
          id="optimize"
          icon={Zap}
          iconBg="bg-amber-500"
          title="Query Optimizer"
          subtitle="AI-powered query optimization and index recommendations"
        />

        {expandedSections.has('optimize') && (
          <div className="border-t border-slate-100 px-4 py-4 space-y-4">
            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleOptimize}
                disabled={optimizeMutation.isPending || !currentSQL.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  optimizeMutation.isPending || !currentSQL.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                )}
              >
                {optimizeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Optimize Current Query
                  </>
                )}
              </button>
              <button
                onClick={handleLoadOptimizeDemo}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Database className="w-4 h-4" />
                Load Demo
              </button>
              {!currentSQL.trim() && (
                <span className="text-xs text-slate-400">
                  Write or paste SQL in the editor first
                </span>
              )}
            </div>

            {/* Progress */}
            {optimizeMutation.isPending && (
              <ProgressStepper steps={OPTIMIZE_STEPS} currentStep={optimizeStep} />
            )}

            {/* Error */}
            {optimizeError && <ErrorBox message={optimizeError} />}

            {/* Results */}
            {optimizeResult && (
              <div className="space-y-4">
                {/* Estimated Improvement */}
                {optimizeResult.estimatedImprovement && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                    <Zap className="w-3.5 h-3.5" />
                    Estimated Improvement: {optimizeResult.estimatedImprovement}
                  </div>
                )}

                {/* Before / After */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-600">Original</p>
                    </div>
                    <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {currentSQL}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-600">Optimized</p>
                      <CopyButton text={optimizeResult.optimizedSQL} id="opt-sql" />
                    </div>
                    <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {optimizeResult.optimizedSQL}
                    </div>
                  </div>
                </div>

                {/* Changes */}
                {optimizeResult.changes && optimizeResult.changes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">
                      Changes ({optimizeResult.changes.length})
                    </p>
                    {optimizeResult.changes.map((change, i) => {
                      const impact = IMPACT_CONFIG[change.impact] || IMPACT_CONFIG.MEDIUM;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'border rounded-lg p-3 flex items-start gap-3',
                            impact.bg,
                            impact.border
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium', impact.text)}>
                              {change.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {change.category}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                                impact.text,
                                impact.bg
                              )}
                            >
                              {change.impact}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Index Recommendations */}
                {optimizeResult.indexRecommendations && optimizeResult.indexRecommendations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">
                      Index Recommendations ({optimizeResult.indexRecommendations.length})
                    </p>
                    {optimizeResult.indexRecommendations.map((idx, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-600">{idx.reason}</p>
                          <CopyButton text={idx.createStatement} id={`opt-idx-${i}`} />
                        </div>
                        <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                          {idx.createStatement}
                        </div>
                        {idx.estimatedImpact && (
                          <p className="text-[11px] text-emerald-600 font-medium">
                            Estimated impact: {idx.estimatedImpact}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {optimizeResult.warnings && optimizeResult.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {optimizeResult.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-700">{w}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apply Button */}
                <button
                  onClick={() => onInsertSQL(optimizeResult.optimizedSQL)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-aqua-600 text-white hover:bg-aqua-700 transition-all shadow-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  Apply Optimized Query
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 3: Query Explainer ──────────────────────────────────── */}
      <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
        <SectionHeader
          id="explain"
          icon={BookOpen}
          iconBg="bg-violet-500"
          title="Query Explainer"
          subtitle="Understand what your SQL query does step by step"
        />

        {expandedSections.has('explain') && (
          <div className="border-t border-slate-100 px-4 py-4 space-y-4">
            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleExplain}
                disabled={explainMutation.isPending || !currentSQL.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  explainMutation.isPending || !currentSQL.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-violet-500 text-white hover:bg-violet-600'
                )}
              >
                {explainMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Explaining...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    Explain Current Query
                  </>
                )}
              </button>
              <button
                onClick={handleLoadExplainDemo}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Database className="w-4 h-4" />
                Load Demo
              </button>
              {!currentSQL.trim() && (
                <span className="text-xs text-slate-400">
                  Write or paste SQL in the editor first
                </span>
              )}
            </div>

            {/* Progress */}
            {explainMutation.isPending && (
              <ProgressStepper steps={EXPLAIN_STEPS} currentStep={explainStep} />
            )}

            {/* Error */}
            {explainError && <ErrorBox message={explainError} />}

            {/* Results */}
            {explainResult && (
              <div className="space-y-4">
                {/* Summary + Complexity */}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {explainResult.summary}
                    </p>
                  </div>
                  {explainResult.complexity && (
                    <span
                      className={cn(
                        'px-2.5 py-1 text-[10px] font-bold rounded-full uppercase flex-shrink-0',
                        COMPLEXITY_CONFIG[explainResult.complexity] || COMPLEXITY_CONFIG.MODERATE
                      )}
                    >
                      {explainResult.complexity.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Step-by-step breakdown */}
                {explainResult.stepByStep && explainResult.stepByStep.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">
                      Step-by-Step Breakdown
                    </p>
                    {explainResult.stepByStep.map((step, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleExplainStep(i)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50/50 transition-colors"
                        >
                          <span className="text-xs font-bold text-slate-800 flex-shrink-0">
                            {step.clause}
                          </span>
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs text-slate-600 truncate">
                            {step.sql}
                          </span>
                          <ChevronDown
                            className={cn(
                              'w-3.5 h-3.5 text-slate-400 ml-auto flex-shrink-0 transition-transform duration-200',
                              expandedExplainSteps.has(i) && 'rotate-180'
                            )}
                          />
                        </button>
                        {expandedExplainSteps.has(i) && (
                          <div className="border-t border-slate-100 px-3 py-2.5">
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {step.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tables Used */}
                {explainResult.tablesUsed && explainResult.tablesUsed.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">Tables Used</p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-3 gap-px bg-slate-200">
                        <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">
                          Name
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">
                          Alias
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">
                          Role
                        </div>
                        {explainResult.tablesUsed.map((t, i) => (
                          <React.Fragment key={i}>
                            <div className="bg-card px-3 py-2 text-xs font-mono text-slate-700">
                              {t.name}
                            </div>
                            <div className="bg-card px-3 py-2 text-xs font-mono text-slate-500">
                              {t.alias}
                            </div>
                            <div className="bg-card px-3 py-2 text-xs text-slate-600">
                              {t.role}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Output Columns */}
                {explainResult.outputColumns && explainResult.outputColumns.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">Output Columns</p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-3 gap-px bg-slate-200">
                        <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">
                          Expression
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">
                          Alias
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">
                          Description
                        </div>
                        {explainResult.outputColumns.map((col, i) => (
                          <React.Fragment key={i}>
                            <div className="bg-card px-3 py-2 text-xs font-mono text-slate-700">
                              {col.expression}
                            </div>
                            <div className="bg-card px-3 py-2 text-xs font-mono text-slate-500">
                              {col.alias}
                            </div>
                            <div className="bg-card px-3 py-2 text-xs text-slate-600">
                              {col.description}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters */}
                {explainResult.filters && explainResult.filters.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1.5">Filters</p>
                    <ul className="space-y-1 pl-5 list-disc">
                      {explainResult.filters.map((f, i) => (
                        <li key={i} className="text-xs text-slate-600 font-mono leading-relaxed">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Performance Notes */}
                {explainResult.performanceNotes && explainResult.performanceNotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Performance Notes</p>
                    {explainResult.performanceNotes.map((note, i) => (
                      <div
                        key={i}
                        className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5"
                      >
                        <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">{note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default QueryAIPanel;
