import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Brain,
  ArrowRight,
  Shield,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  Loader2,
  Play,
  Save,
  Database,
  Layers,
  Zap,
  BarChart3,
  Clock,
  Sparkles,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import {
  useAssessMigration,
  useGenerateMigrationScripts,
} from '@/hooks/use-migration-ai';
import type {
  MigrationAssessment,
  MigrationScriptBundle,
} from '@/hooks/use-migration-ai';
import { useCreateMigration } from '@/hooks/use-migrations';

// ── Props ───────────────────────────────────────────────────────────────────

interface MigrationPlannerProps {
  projectId: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const SUPPORTED_DIALECTS = DATABASE_DIALECTS.filter((d) =>
  ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb', 'snowflake', 'bigquery'].includes(d.value)
);

const ANALYSIS_STEPS = [
  'Analyzing schema',
  'Evaluating compatibility',
  'Estimating volumes',
  'Generating plan',
];

const SCRIPT_GEN_STEPS = [
  'Parsing source schema',
  'Mapping data types',
  'Generating UP scripts',
  'Generating DOWN scripts',
];

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
  CRITICAL: 'bg-purple-100 text-purple-700',
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-blue-100 text-blue-700',
};

const DEMO_ASSESSMENT: MigrationAssessment = {
  overallRisk: 'MEDIUM',
  estimatedEffort: '4-6 hours',
  summary:
    'Migration from PostgreSQL to MySQL involves 8 tables with moderate complexity. Key challenges include JSONB\u2192JSON conversion, SERIAL\u2192AUTO_INCREMENT mapping, and handling of array types. Estimated 2.3M total rows across all tables.',
  dataVolumeAnalysis: [
    { table: 'users', estimatedRows: '500K', batchSize: 50000, estimatedBatches: 10, estimatedTime: '8 min' },
    { table: 'orders', estimatedRows: '1.2M', batchSize: 25000, estimatedBatches: 48, estimatedTime: '35 min', notes: 'Has JSONB columns, requires special handling' },
    { table: 'products', estimatedRows: '50K', batchSize: 50000, estimatedBatches: 1, estimatedTime: '1 min' },
    { table: 'order_items', estimatedRows: '500K', batchSize: 50000, estimatedBatches: 10, estimatedTime: '12 min' },
  ],
  incompatibilities: [
    { type: 'DATA_TYPE', source: 'JSONB', target: 'JSON', severity: 'MEDIUM', resolution: 'MySQL JSON supports read/write but lacks PostgreSQL JSONB indexing operators. Migrate data as-is, adjust queries to use JSON_EXTRACT().' },
    { type: 'DATA_TYPE', source: 'SERIAL', target: 'INT AUTO_INCREMENT', severity: 'LOW', resolution: 'Direct mapping. Ensure AUTO_INCREMENT values start after max existing ID.' },
    { type: 'FUNCTION', source: 'NOW()', target: 'CURRENT_TIMESTAMP', severity: 'LOW', resolution: 'Replace NOW() with CURRENT_TIMESTAMP in default values.' },
    { type: 'DATA_TYPE', source: 'UUID', target: 'CHAR(36)', severity: 'MEDIUM', resolution: 'Store as CHAR(36). Consider BINARY(16) for better performance if UUIDs are indexed.' },
    { type: 'SYNTAX', source: 'ILIKE', target: 'LIKE + LOWER()', severity: 'LOW', resolution: 'Replace ILIKE with LOWER(column) LIKE LOWER(pattern) in queries.' },
  ],
  migrationSteps: [
    { phase: 1, title: 'Create target schema', description: 'Generate and execute DDL statements for all tables in MySQL format', estimatedTime: '10 min' },
    { phase: 2, title: 'Migrate lookup tables', description: 'Migrate small reference tables (products, categories) first', estimatedTime: '5 min' },
    { phase: 3, title: 'Migrate users table', description: 'Batch migrate users with UUID\u2192CHAR(36) conversion', estimatedTime: '8 min' },
    { phase: 4, title: 'Migrate transactional data', description: 'Batch migrate orders and order_items with JSONB\u2192JSON conversion', estimatedTime: '45 min' },
    { phase: 5, title: 'Create indexes and constraints', description: 'Add foreign keys, indexes after data migration for performance', estimatedTime: '5 min' },
    { phase: 6, title: 'Verify data integrity', description: 'Run row count comparisons, checksum verification, sample data spot checks', estimatedTime: '15 min' },
  ],
  batchStrategy: {
    recommendedChunkSize: 50000,
    parallelism: 4,
    estimatedTotalTime: '1.5 hours',
    notes: 'Use parallel workers for independent tables. Migrate parent tables before child tables with FKs.',
  },
  recommendations: [
    'Disable foreign key checks during data loading for better performance',
    'Use multi-row INSERT statements (batches of 1000 rows per INSERT) for optimal MySQL throughput',
    'Create indexes AFTER data migration to avoid slow index rebuilds during INSERT',
    'Test JSONB\u2192JSON migration on a sample set first to verify JSON_EXTRACT() compatibility',
    'Consider using mysqldump format for bulk loading with LOAD DATA INFILE',
    'Set up replication monitoring to validate data consistency post-migration',
  ],
};

// ── Component ───────────────────────────────────────────────────────────────

export function MigrationPlanner({ projectId }: MigrationPlannerProps) {
  // ---- State ----
  const [sourceDialect, setSourceDialect] = useState('postgresql');
  const [targetDialect, setTargetDialect] = useState('mysql');
  const [assessment, setAssessment] = useState<MigrationAssessment | null>(null);
  const [scriptBundle, setScriptBundle] = useState<MigrationScriptBundle | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['risk']));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [scriptGenStep, setScriptGenStep] = useState(0);
  const [savingScripts, setSavingScripts] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptStepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Hooks ----
  const assessMigration = useAssessMigration();
  const generateScripts = useGenerateMigrationScripts();
  const createMigration = useCreateMigration();

  // ---- Cleanup intervals on unmount ----
  useEffect(() => {
    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (scriptStepIntervalRef.current) clearInterval(scriptStepIntervalRef.current);
    };
  }, []);

  // ---- Helpers ----
  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ---- Assess ----
  const handleAssess = useCallback(async () => {
    if (!projectId) return;
    setAssessment(null);
    setScriptBundle(null);
    setSavedCount(0);

    setAnalysisStep(0);
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 1200);

    try {
      const result = await assessMigration.mutateAsync({
        projectId,
        sourceDialect,
        targetDialect,
      });
      setAssessment(result);
      setExpandedSections(new Set(['risk']));
    } catch {
      // Error is surfaced via assessMigration.error
    } finally {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setAnalysisStep(0);
    }
  }, [projectId, sourceDialect, targetDialect, assessMigration]);

  // ---- Generate Scripts ----
  const handleGenerateScripts = useCallback(async () => {
    if (!projectId) return;
    setScriptBundle(null);
    setSavedCount(0);

    setScriptGenStep(0);
    scriptStepIntervalRef.current = setInterval(() => {
      setScriptGenStep((prev) => Math.min(prev + 1, SCRIPT_GEN_STEPS.length - 1));
    }, 1200);

    try {
      const result = await generateScripts.mutateAsync({
        projectId,
        sourceDialect,
        targetDialect,
      });
      setScriptBundle(result);
    } catch {
      // Error is surfaced via generateScripts.error
    } finally {
      if (scriptStepIntervalRef.current) {
        clearInterval(scriptStepIntervalRef.current);
        scriptStepIntervalRef.current = null;
      }
      setScriptGenStep(0);
    }
  }, [projectId, sourceDialect, targetDialect, generateScripts]);

  // ---- Save All as Migrations ----
  const handleSaveAll = useCallback(async () => {
    if (!scriptBundle || !projectId) return;
    setSavingScripts(true);
    setSavedCount(0);

    try {
      for (const script of scriptBundle.scripts) {
        await createMigration.mutateAsync({
          projectId,
          version: script.version,
          title: script.title,
          description: script.description,
          upSQL: script.upSQL,
          downSQL: script.downSQL,
          status: 'draft',
          sourceDialect,
          targetDialect,
          dependsOn: script.dependsOn ?? undefined,
        });
        setSavedCount((prev) => prev + 1);
      }
    } catch {
      // Error surfaced via createMigration.error
    } finally {
      setSavingScripts(false);
    }
  }, [scriptBundle, projectId, sourceDialect, targetDialect, createMigration]);

  // ---- Load Demo ----
  const handleLoadDemo = useCallback(() => {
    setSourceDialect('postgresql');
    setTargetDialect('mysql');
    setAssessment(DEMO_ASSESSMENT);
    setScriptBundle(null);
    setSavedCount(0);
    setExpandedSections(new Set(['risk']));
  }, []);

  // ---- Progress Stepper Renderer ----
  const renderProgressStepper = (steps: string[], currentStep: number) => (
    <div className="bg-card border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, i) => {
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
                        ? 'bg-aqua-100 text-aqua-700 ring-2 ring-aqua-500 animate-pulse'
                        : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
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
                  {step}
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

  // ---- Collapsible Section Renderer ----
  const renderSection = (
    id: string,
    title: string,
    icon: React.ReactNode,
    children: React.ReactNode,
    badge?: React.ReactNode
  ) => {
    const isOpen = expandedSections.has(id);
    return (
      <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          {icon}
          <span className="text-sm font-semibold text-slate-800 flex-1">{title}</span>
          {badge}
        </button>
        {isOpen && (
          <div className="border-t border-slate-100 px-4 py-4">{children}</div>
        )}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Configuration Section ───────────────────────────────────────── */}
      <div className="bg-card border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-5 h-5 text-aqua-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            Migration Assessment & Planning
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Dialect */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Source Dialect
            </label>
            <select
              value={sourceDialect}
              onChange={(e) => setSourceDialect(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
            >
              {SUPPORTED_DIALECTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Dialect */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Target Dialect
            </label>
            <select
              value={targetDialect}
              onChange={(e) => setTargetDialect(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
            >
              {SUPPORTED_DIALECTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAssess}
            disabled={!projectId || assessMigration.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
              !projectId || assessMigration.isPending
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-aqua-600 text-white hover:bg-aqua-700'
            )}
          >
            {assessMigration.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Assessing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Assess Migration
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

          {assessMigration.isPending && (
            <span className="text-xs text-slate-500">
              AI is analyzing schema and evaluating migration risks...
            </span>
          )}
        </div>

        {/* Error */}
        {assessMigration.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Assessment Failed</p>
              <p className="text-xs text-red-600 mt-1">
                {assessMigration.error instanceof Error
                  ? assessMigration.error.message
                  : 'Failed to assess migration. Ensure AI provider is configured in Settings.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Progress Stepper (Assessment) ───────────────────────────────── */}
      {assessMigration.isPending && renderProgressStepper(ANALYSIS_STEPS, analysisStep)}

      {/* ── Assessment Results ──────────────────────────────────────────── */}
      {assessment && (
        <div className="space-y-4">
          {/* 1. Risk Dashboard (always open) */}
          {renderSection(
            'risk',
            'Risk Dashboard',
            <Shield className="w-4 h-4 text-aqua-600 flex-shrink-0" />,
            <div className="space-y-4">
              {/* Badges Row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={cn(
                    'px-3 py-1 text-xs font-bold rounded-full uppercase',
                    RISK_COLORS[assessment.overallRisk] ?? RISK_COLORS.MEDIUM
                  )}
                >
                  Risk: {assessment.overallRisk}
                </span>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700">
                  <Clock className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                  Effort: {assessment.estimatedEffort}
                </span>
              </div>

              {/* Summary */}
              <p className="text-sm text-slate-700 leading-relaxed">
                {assessment.summary}
              </p>
            </div>
          )}

          {/* 2. Data Volume Analysis */}
          {renderSection(
            'volumes',
            'Data Volume Analysis',
            <BarChart3 className="w-4 h-4 text-aqua-600 flex-shrink-0" />,
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-600">Table</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-600">Est. Rows</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Batch Size</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Batches</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Est. Time</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {assessment.dataVolumeAnalysis.map((row, i) => (
                    <tr
                      key={row.table}
                      className={cn(
                        'border-b border-slate-100',
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      )}
                    >
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">
                        {row.table}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{row.estimatedRows}</td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {row.batchSize.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {row.estimatedBatches}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {row.estimatedTime}
                      </td>
                      <td className="py-2 px-3 text-slate-500 italic">
                        {row.notes ?? '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>,
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {assessment.dataVolumeAnalysis.length} tables
            </span>
          )}

          {/* 3. Incompatibilities */}
          {renderSection(
            'incompatibilities',
            'Incompatibilities',
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
            <div className="space-y-3">
              {assessment.incompatibilities.map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                        SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.MEDIUM
                      )}
                    >
                      {item.severity}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 uppercase">
                      {item.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <code className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-mono">
                      {item.source}
                    </code>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <code className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-mono">
                      {item.target}
                    </code>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.resolution}
                  </p>
                </div>
              ))}
            </div>,
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {assessment.incompatibilities.length} issues
            </span>
          )}

          {/* 4. Migration Steps */}
          {renderSection(
            'steps',
            'Migration Steps',
            <Layers className="w-4 h-4 text-aqua-600 flex-shrink-0" />,
            <div className="space-y-3">
              {assessment.migrationSteps.map((step) => (
                <div key={step.phase} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-aqua-100 text-aqua-700 flex items-center justify-center text-xs font-bold">
                    {step.phase}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {step.title}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {step.estimatedTime}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>,
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {assessment.migrationSteps.length} phases
            </span>
          )}

          {/* 5. Batch Strategy */}
          {renderSection(
            'batch',
            'Batch Strategy',
            <Zap className="w-4 h-4 text-aqua-600 flex-shrink-0" />,
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Chunk Size
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {assessment.batchStrategy.recommendedChunkSize.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Parallelism
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {assessment.batchStrategy.parallelism}x
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Total Time
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {assessment.batchStrategy.estimatedTotalTime}
                  </p>
                </div>
              </div>
              {assessment.batchStrategy.notes && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  {assessment.batchStrategy.notes}
                </p>
              )}
            </div>
          )}

          {/* 6. Recommendations */}
          {renderSection(
            'recommendations',
            'Recommendations',
            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />,
            <ul className="space-y-2">
              {assessment.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-700 leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>,
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {assessment.recommendations.length} tips
            </span>
          )}

          {/* ── Generate Scripts Section ────────────────────────────────── */}
          <div className="bg-card border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-5 h-5 text-aqua-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Generate Migration Scripts
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateScripts}
                disabled={!projectId || generateScripts.isPending}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
                  !projectId || generateScripts.isPending
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                )}
              >
                {generateScripts.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generate Migration Scripts
                  </>
                )}
              </button>

              {generateScripts.isPending && (
                <span className="text-xs text-slate-500">
                  AI is generating versioned migration scripts...
                </span>
              )}
            </div>

            {/* Error */}
            {generateScripts.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Script Generation Failed</p>
                  <p className="text-xs text-red-600 mt-1">
                    {generateScripts.error instanceof Error
                      ? generateScripts.error.message
                      : 'Failed to generate scripts. Ensure AI provider is configured in Settings.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Progress Stepper (Script Generation) ───────────────────── */}
          {generateScripts.isPending && renderProgressStepper(SCRIPT_GEN_STEPS, scriptGenStep)}

          {/* ── Script Bundle Results ──────────────────────────────────── */}
          {scriptBundle && (
            <div className="space-y-4">
              {/* Warnings */}
              {scriptBundle.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warnings ({scriptBundle.warnings.length})
                  </h4>
                  <ul className="space-y-1">
                    {scriptBundle.warnings.map((warn, i) => (
                      <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5">&#8226;</span>
                        {warn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rollback Strategy */}
              {scriptBundle.rollbackStrategy && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5" />
                    Rollback Strategy
                  </h4>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    {scriptBundle.rollbackStrategy}
                  </p>
                </div>
              )}

              {/* Scripts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Migration Scripts ({scriptBundle.scripts.length})
                  </h4>
                  <button
                    onClick={handleSaveAll}
                    disabled={savingScripts || savedCount === scriptBundle.scripts.length}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                      savingScripts || savedCount === scriptBundle.scripts.length
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-aqua-600 text-white hover:bg-aqua-700'
                    )}
                  >
                    {savingScripts ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving ({savedCount}/{scriptBundle.scripts.length})...
                      </>
                    ) : savedCount === scriptBundle.scripts.length ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        All Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save All as Migrations
                      </>
                    )}
                  </button>
                </div>

                {scriptBundle.scripts.map((script, i) => (
                  <div
                    key={script.version}
                    className="bg-card border border-slate-200 rounded-xl overflow-hidden"
                  >
                    {/* Script Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-aqua-100 text-aqua-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 font-mono">
                            {script.version}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {script.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {script.description}
                        </p>
                      </div>
                      {script.dependsOn && (
                        <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                          depends on: {script.dependsOn}
                        </span>
                      )}
                    </div>

                    {/* UP SQL */}
                    <div className="px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                          UP (migrate)
                        </span>
                        <button
                          onClick={() => handleCopy(script.upSQL, `up-${i}`)}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          {copiedId === `up-${i}` ? (
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
                      <div className="bg-[#1e293b] text-slate-100 font-mono text-xs p-3 rounded-lg overflow-x-auto whitespace-pre">
                        {script.upSQL}
                      </div>
                    </div>

                    {/* DOWN SQL */}
                    <div className="px-4 py-3 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                          DOWN (rollback)
                        </span>
                        <button
                          onClick={() => handleCopy(script.downSQL, `down-${i}`)}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          {copiedId === `down-${i}` ? (
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
                      <div className="bg-[#1e293b] text-slate-100 font-mono text-xs p-3 rounded-lg overflow-x-auto whitespace-pre">
                        {script.downSQL}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Error */}
              {createMigration.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Failed to Save Migrations</p>
                    <p className="text-xs text-red-600 mt-1">
                      {createMigration.error instanceof Error
                        ? createMigration.error.message
                        : 'An error occurred while saving migration scripts.'}
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      Successfully saved {savedCount} of {scriptBundle.scripts.length} scripts before the error.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MigrationPlanner;
