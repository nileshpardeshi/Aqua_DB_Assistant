import { useState, useCallback, useRef } from 'react';
import {
  FileCode2,
  Plus,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  Download,
  Trash2,
  Play,
  Sparkles,
  Loader2,
  X,
  Save,
  ArrowRight,
  Clock,
  Shield,
  Hash,
  GitBranch,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import {
  useMigrations,
  useCreateMigration,
  useDeleteMigration,
  useUpdateMigration,
} from '@/hooks/use-migrations';
import type { Migration } from '@/hooks/use-migrations';
import { useGenerateMigrationScripts } from '@/hooks/use-migration-ai';
import { DATABASE_DIALECTS, getDialect } from '@/config/constants';
import type { MigrationScriptBundle } from '@/hooks/use-migration-ai';

// ── Status badge colors ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rolled_back: 'bg-orange-100 text-orange-700',
};

// ── AI generation progress steps ─────────────────────────────────────────────

const AI_STEPS = [
  'Analyzing',
  'Building scripts',
  'Validating',
  'Complete',
] as const;

// ── Props ────────────────────────────────────────────────────────────────────

interface MigrationScriptsPanelProps {
  projectId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextVersion(migrations: Migration[]): string {
  if (migrations.length === 0) return '001';
  const maxNum = migrations.reduce((max, m) => {
    const num = parseInt(m.version.replace(/\D/g, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return String(maxNum + 1).padStart(3, '0');
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────────

export function MigrationScriptsPanel({ projectId }: MigrationScriptsPanelProps) {
  // ---- data hooks ----
  const { data: migrations = [], isLoading } = useMigrations(projectId);
  const createMigration = useCreateMigration();
  const deleteMigration = useDeleteMigration();
  const updateMigration = useUpdateMigration();
  const generateScripts = useGenerateMigrationScripts();

  // ---- local state ----
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // create form fields
  const [formVersion, setFormVersion] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSourceDialect, setFormSourceDialect] = useState('postgresql');
  const [formTargetDialect, setFormTargetDialect] = useState('mysql');
  const [formUpSQL, setFormUpSQL] = useState('');
  const [formDownSQL, setFormDownSQL] = useState('');
  const [formDependsOn, setFormDependsOn] = useState('');

  // AI generation state
  const [aiResult, setAiResult] = useState<MigrationScriptBundle | null>(null);
  const [aiStep, setAiStep] = useState(0);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- sorted migrations ----
  const sortedMigrations = [...migrations].sort((a, b) =>
    a.version.localeCompare(b.version)
  );

  // ---- handlers ----

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
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

  const handleDelete = useCallback(
    (migration: Migration) => {
      if (!window.confirm(`Delete migration v${migration.version} "${migration.title}"?`)) return;
      deleteMigration.mutate({ projectId, migrationId: migration.id });
    },
    [projectId, deleteMigration]
  );

  const handleMarkPending = useCallback(
    (migration: Migration) => {
      updateMigration.mutate({
        projectId,
        migrationId: migration.id,
        data: { status: 'pending' },
      });
    },
    [projectId, updateMigration]
  );

  const handleDownload = useCallback((sql: string, migration: Migration) => {
    const filename = `v${migration.version}_${migration.title.replace(/\s+/g, '_').toLowerCase()}.sql`;
    downloadFile(sql, filename);
  }, []);

  const openCreateForm = useCallback(() => {
    setFormVersion(nextVersion(migrations));
    setFormTitle('');
    setFormDescription('');
    setFormSourceDialect('postgresql');
    setFormTargetDialect('mysql');
    setFormUpSQL('');
    setFormDownSQL('');
    setFormDependsOn('');
    setShowCreateForm(true);
  }, [migrations]);

  const handleCreate = useCallback(() => {
    if (!formVersion.trim() || !formTitle.trim() || !formUpSQL.trim()) return;
    createMigration.mutate(
      {
        projectId,
        version: formVersion.trim(),
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        upSQL: formUpSQL,
        downSQL: formDownSQL.trim() || undefined,
        sourceDialect: formSourceDialect,
        targetDialect: formTargetDialect,
        dependsOn: formDependsOn || undefined,
      },
      {
        onSuccess: () => setShowCreateForm(false),
      }
    );
  }, [
    projectId,
    formVersion,
    formTitle,
    formDescription,
    formUpSQL,
    formDownSQL,
    formSourceDialect,
    formTargetDialect,
    formDependsOn,
    createMigration,
  ]);

  const handleAIGenerate = useCallback(() => {
    setAiResult(null);
    setAiStep(0);

    stepIntervalRef.current = setInterval(() => {
      setAiStep((prev) => Math.min(prev + 1, AI_STEPS.length - 1));
    }, 1500);

    generateScripts.mutate(
      {
        projectId,
        sourceDialect: formSourceDialect || 'postgresql',
        targetDialect: formTargetDialect || 'mysql',
      },
      {
        onSuccess: (data) => {
          if (stepIntervalRef.current) {
            clearInterval(stepIntervalRef.current);
            stepIntervalRef.current = null;
          }
          setAiStep(AI_STEPS.length - 1);
          setAiResult(data);
        },
        onError: () => {
          if (stepIntervalRef.current) {
            clearInterval(stepIntervalRef.current);
            stepIntervalRef.current = null;
          }
          setAiStep(0);
        },
      }
    );
  }, [projectId, formSourceDialect, formTargetDialect, generateScripts]);

  const handleSaveAllAI = useCallback(async () => {
    if (!aiResult) return;
    setIsSavingAll(true);
    try {
      for (const script of aiResult.scripts) {
        await createMigration.mutateAsync({
          projectId,
          version: script.version,
          title: script.title,
          description: script.description || undefined,
          upSQL: script.upSQL,
          downSQL: script.downSQL || undefined,
          sourceDialect: formSourceDialect || 'postgresql',
          targetDialect: formTargetDialect || 'mysql',
          dependsOn: script.dependsOn || undefined,
        });
      }
      setAiResult(null);
      setAiStep(0);
    } finally {
      setIsSavingAll(false);
    }
  }, [aiResult, projectId, formSourceDialect, formTargetDialect, createMigration]);

  // ---- render ----

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileCode2 className="w-5 h-5 text-aqua-600" />
          <h3 className="text-base font-semibold text-slate-800">Migration Scripts</h3>
          {migrations.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-aqua-100 text-aqua-700 rounded-full">
              {migrations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAIGenerate}
            disabled={generateScripts.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm',
              generateScripts.isPending
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            )}
          >
            {generateScripts.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                AI Generate
              </>
            )}
          </button>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-aqua-600 text-white hover:bg-aqua-700 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Script
          </button>
        </div>
      </div>

      {/* ── AI Generation Progress ──────────────────────────────────────── */}
      {generateScripts.isPending && (
        <div className="bg-card border border-violet-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {AI_STEPS.map((step, i) => {
              const isActive = i === aiStep;
              const isCompleted = i < aiStep;
              return (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 text-xs font-bold',
                      isCompleted
                        ? 'bg-violet-500 text-white'
                        : isActive
                          ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500 animate-pulse'
                          : 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-xs whitespace-nowrap',
                      isActive ? 'text-violet-700 font-medium' : isCompleted ? 'text-violet-600' : 'text-slate-400'
                    )}
                  >
                    {step}
                  </span>
                  {i < AI_STEPS.length - 1 && (
                    <div className={cn('flex-1 h-0.5 min-w-[16px]', isCompleted ? 'bg-violet-500' : 'bg-slate-200')} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${((aiStep + 1) / AI_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── AI Generate Results ─────────────────────────────────────────── */}
      {aiResult && (
        <div className="bg-card border border-violet-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-violet-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generated Migration Scripts ({aiResult.scripts.length})
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAllAI}
                disabled={isSavingAll}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm',
                  isSavingAll
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                )}
              >
                {isSavingAll ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save All
                  </>
                )}
              </button>
              <button
                onClick={() => { setAiResult(null); setAiStep(0); }}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </button>
            </div>
          </div>

          {aiResult.scripts.map((script, idx) => (
            <div key={idx} className="bg-violet-50/50 border border-violet-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-violet-100 text-violet-700 rounded-full">
                  v{script.version}
                </span>
                <span className="text-sm font-semibold text-slate-800">{script.title}</span>
                {script.dependsOn && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded">
                    <GitBranch className="w-3 h-3" />
                    depends: {script.dependsOn}
                  </span>
                )}
              </div>
              {script.description && (
                <p className="text-xs text-slate-500">{script.description}</p>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-semibold text-green-700 mb-1">UP</p>
                  <pre className="bg-[#1e293b] text-slate-100 font-mono text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-32">
                    {script.upSQL.slice(0, 300)}{script.upSQL.length > 300 ? '...' : ''}
                  </pre>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-red-600 mb-1">DOWN</p>
                  <pre className="bg-[#1e293b] text-slate-100 font-mono text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-32">
                    {script.downSQL ? (script.downSQL.slice(0, 300) + (script.downSQL.length > 300 ? '...' : '')) : '--  No rollback script'}
                  </pre>
                </div>
              </div>
            </div>
          ))}

          {/* Warnings */}
          {aiResult.warnings && aiResult.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">Warnings</p>
              <ul className="space-y-0.5">
                {aiResult.warnings.map((warning, i) => (
                  <li key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                    <Shield className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── AI Generate Error ───────────────────────────────────────────── */}
      {generateScripts.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">AI Generation Failed</p>
            <p className="text-xs text-red-600 mt-1">
              {generateScripts.error instanceof Error
                ? generateScripts.error.message
                : 'Failed to generate migration scripts. Ensure AI provider is configured.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Create Script Form ──────────────────────────────────────────── */}
      {showCreateForm && (
        <div className="bg-card border border-aqua-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-aqua-600" />
              New Migration Script
            </h4>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Version */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Version</label>
              <input
                type="text"
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
                placeholder="001"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
              />
            </div>
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Create users table"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description of the migration..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y"
            />
          </div>

          {/* Source / Target dialects */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Source Dialect</label>
              <select
                value={formSourceDialect}
                onChange={(e) => setFormSourceDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
              >
                {DATABASE_DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Dialect</label>
              <select
                value={formTargetDialect}
                onChange={(e) => setFormTargetDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
              >
                {DATABASE_DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Depends On</label>
              <select
                value={formDependsOn}
                onChange={(e) => setFormDependsOn(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
              >
                <option value="">None</option>
                {sortedMigrations.map((m) => (
                  <option key={m.id} value={m.version}>
                    v{m.version} - {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* UP SQL */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Forward Migration (UP SQL)
            </label>
            <textarea
              value={formUpSQL}
              onChange={(e) => setFormUpSQL(e.target.value)}
              placeholder="-- Write your forward migration SQL here..."
              rows={8}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y"
            />
          </div>

          {/* DOWN SQL */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Rollback (DOWN SQL)
            </label>
            <textarea
              value={formDownSQL}
              onChange={(e) => setFormDownSQL(e.target.value)}
              placeholder="-- Write your rollback migration SQL here (optional)..."
              rows={5}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleCreate}
              disabled={createMigration.isPending || !formVersion.trim() || !formTitle.trim() || !formUpSQL.trim()}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm',
                createMigration.isPending || !formVersion.trim() || !formTitle.trim() || !formUpSQL.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-aqua-600 text-white hover:bg-aqua-700'
              )}
            >
              {createMigration.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Create
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Loading State ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-slate-200 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-6 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
                <div className="w-16 h-5 bg-slate-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {!isLoading && sortedMigrations.length === 0 && !showCreateForm && (
        <div className="text-center py-16 bg-card border border-slate-200 rounded-xl">
          <FileCode2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No migration scripts yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Create your first script or use AI to generate them
          </p>
        </div>
      )}

      {/* ── Migration List ──────────────────────────────────────────────── */}
      {!isLoading && sortedMigrations.length > 0 && (
        <div className="space-y-3">
          {sortedMigrations.map((migration) => {
            const isExpanded = expandedIds.has(migration.id);
            const sourceDialect = getDialect(migration.sourceDialect);
            const targetDialect = getDialect(migration.targetDialect);

            return (
              <div
                key={migration.id}
                className="bg-card border border-slate-200 rounded-lg overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Card Header */}
                <button
                  onClick={() => toggleExpand(migration.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
                >
                  {/* Expand chevron */}
                  <div className="flex-shrink-0 text-slate-400">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>

                  {/* Version badge */}
                  <span className="px-2.5 py-0.5 text-[11px] font-bold font-mono bg-slate-100 text-slate-700 rounded-full flex-shrink-0">
                    v{migration.version}
                  </span>

                  {/* Title & description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{migration.title}</p>
                    {migration.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{migration.description}</p>
                    )}
                  </div>

                  {/* Source -> Target */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sourceDialect?.color || '#94a3b8' }}
                      />
                      <span className="text-[10px] text-slate-500">{sourceDialect?.label || migration.sourceDialect}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: targetDialect?.color || '#94a3b8' }}
                      />
                      <span className="text-[10px] text-slate-500">{targetDialect?.label || migration.targetDialect}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold rounded-full capitalize flex-shrink-0',
                      STATUS_STYLES[migration.status] || STATUS_STYLES.draft
                    )}
                  >
                    {migration.status.replace('_', ' ')}
                  </span>

                  {/* Checksum */}
                  <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 flex items-center gap-1" title={`Checksum: ${migration.checksum}`}>
                    <Hash className="w-3 h-3" />
                    {migration.checksum.slice(0, 8)}
                  </span>

                  {/* Created date */}
                  <span className="text-[10px] text-slate-400 flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(migration.createdAt)}
                  </span>

                  {/* DependsOn badge */}
                  {migration.dependsOn && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded flex-shrink-0">
                      <GitBranch className="w-3 h-3" />
                      {migration.dependsOn}
                    </span>
                  )}
                </button>

                {/* Expanded View */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                    {/* UP SQL */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5" />
                          Forward Migration (UP)
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(migration.upSQL, `up-${migration.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            {copiedId === `up-${migration.id}` ? (
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(migration.upSQL, migration);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </div>
                      </div>
                      <pre className="bg-[#1e293b] text-slate-100 font-mono text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {migration.upSQL}
                      </pre>
                    </div>

                    {/* DOWN SQL */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                          Rollback (DOWN)
                        </p>
                        {migration.downSQL && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(migration.downSQL!, `down-${migration.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            {copiedId === `down-${migration.id}` ? (
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
                        )}
                      </div>
                      <pre className="bg-[#1e293b] text-slate-100 font-mono text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {migration.downSQL || '--  No rollback script'}
                      </pre>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(migration);
                        }}
                        disabled={deleteMigration.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>

                      {migration.status === 'draft' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkPending(migration);
                          }}
                          disabled={updateMigration.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Mark as Pending
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(migration.upSQL, `quick-${migration.id}`);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        {copiedId === `quick-${migration.id}` ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy UP SQL
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(migration.upSQL, migration);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .sql
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MigrationScriptsPanel;
