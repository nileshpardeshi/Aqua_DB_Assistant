import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowRight,
  X,
  Trash2,
  Search,
  Play,
  FileCode2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import {
  useMigrations,
  useCreateMigration,
  useDeleteMigration,
  useUpdateMigration,
} from '@/hooks/use-migrations';
import type { Migration } from '@/hooks/use-migrations';
import { DATABASE_DIALECTS } from '@/config/constants';

// ── Status configuration ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  {
    icon: typeof Clock;
    label: string;
    color: string;
    bg: string;
    border: string;
    line: string;
  }
> = {
  draft: {
    icon: FileCode2,
    label: 'Draft',
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    border: 'border-border',
    line: 'bg-slate-300',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    line: 'bg-amber-300',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    line: 'bg-blue-300',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'text-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200',
    line: 'bg-green-400',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    line: 'bg-red-300',
  },
  rolled_back: {
    icon: ArrowRight,
    label: 'Rolled Back',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    line: 'bg-orange-300',
  },
};

const DEFAULT_STATUS = STATUS_CONFIG['pending'];

const DIALECTS = DATABASE_DIALECTS.filter((d) =>
  ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb', 'snowflake', 'bigquery'].includes(d.value)
);

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

// ── Component ───────────────────────────────────────────────────────────────

export function MigrationTimeline() {
  const { projectId } = useParams();
  const { data: apiMigrations, isLoading } = useMigrations(projectId);
  const createMigration = useCreateMigration();
  const deleteMigration = useDeleteMigration();
  const updateMigration = useUpdateMigration();

  const migrations = apiMigrations ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [newVersion, setNewVersion] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSourceDialect, setNewSourceDialect] = useState('postgresql');
  const [newTargetDialect, setNewTargetDialect] = useState('mysql');
  const [newUpSQL, setNewUpSQL] = useState('');
  const [newDownSQL, setNewDownSQL] = useState('');

  // Filtered migrations
  const filteredMigrations = useMemo(() => {
    let result = migrations;

    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q));
    }

    return result;
  }, [migrations, statusFilter, searchQuery]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const resetCreateForm = useCallback(() => {
    setShowCreateForm(false);
    setNewVersion('');
    setNewTitle('');
    setNewDescription('');
    setNewUpSQL('');
    setNewDownSQL('');
  }, []);

  const handleCreateMigration = useCallback(async () => {
    if (!newTitle.trim() || !newVersion.trim() || !newUpSQL.trim() || !projectId) return;
    try {
      await createMigration.mutateAsync({
        projectId,
        version: newVersion.trim(),
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        upSQL: newUpSQL,
        downSQL: newDownSQL.trim() || undefined,
        sourceDialect: newSourceDialect,
        targetDialect: newTargetDialect,
      });
      resetCreateForm();
    } catch {
      // Error handled by mutation
    }
  }, [
    newVersion,
    newTitle,
    newDescription,
    newSourceDialect,
    newTargetDialect,
    newUpSQL,
    newDownSQL,
    projectId,
    createMigration,
    resetCreateForm,
  ]);

  const handleDeleteMigration = useCallback(
    async (migration: Migration) => {
      if (!projectId) return;
      const confirmed = window.confirm(
        `Are you sure you want to delete migration "${migration.title}" (${migration.version})?`
      );
      if (!confirmed) return;
      try {
        await deleteMigration.mutateAsync({
          projectId,
          migrationId: migration.id,
        });
        if (expandedId === migration.id) {
          setExpandedId(null);
        }
      } catch {
        // Error handled by mutation
      }
    },
    [projectId, deleteMigration, expandedId]
  );

  const handleApplyMigration = useCallback(
    async (migration: Migration) => {
      if (!projectId) return;
      try {
        await updateMigration.mutateAsync({
          projectId,
          migrationId: migration.id,
          data: { status: 'pending' },
        });
      } catch {
        // Error handled by mutation
      }
    },
    [projectId, updateMigration]
  );

  const getDialectLabel = (value: string) =>
    DATABASE_DIALECTS.find((d) => d.value === value)?.label || value;

  const getDialectColor = (value: string) =>
    DATABASE_DIALECTS.find((d) => d.value === value)?.color || '#64748b';

  const canCreate = newTitle.trim() && newVersion.trim() && newUpSQL.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Migration History ({migrations.length})
        </h4>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New Migration
        </button>
      </div>

      {/* Status Filter Bar + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Status filter buttons */}
        <div className="inline-flex items-center bg-muted rounded-lg p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                statusFilter === f.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          />
        </div>
      </div>

      {/* Create Migration Form */}
      {showCreateForm && (
        <div className="bg-card border border-aqua-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground">
              Create New Migration
            </h5>
            <button
              onClick={resetCreateForm}
              className="p-1 text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                Version *
              </label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="e.g. V001, 1.0.0"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Migration title..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
              Description
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Optional description of what this migration does..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                Source Dialect
              </label>
              <select
                value={newSourceDialect}
                onChange={(e) => setNewSourceDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
              >
                {DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
                Target Dialect
              </label>
              <select
                value={newTargetDialect}
                onChange={(e) => setNewTargetDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
              >
                {DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
              Up SQL (migration) *
            </label>
            <textarea
              value={newUpSQL}
              onChange={(e) => setNewUpSQL(e.target.value)}
              placeholder="SQL to apply this migration..."
              rows={4}
              spellCheck={false}
              className="w-full px-3 py-2 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-muted-foreground uppercase mb-1">
              Down SQL (rollback)
            </label>
            <textarea
              value={newDownSQL}
              onChange={(e) => setNewDownSQL(e.target.value)}
              placeholder="SQL to rollback this migration (optional)..."
              rows={3}
              spellCheck={false}
              className="w-full px-3 py-2 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 resize-y"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={resetCreateForm}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateMigration}
              disabled={!canCreate || createMigration.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors',
                canCreate
                  ? 'text-white bg-aqua-600 hover:bg-aqua-700'
                  : 'text-muted-foreground bg-muted cursor-not-allowed'
              )}
            >
              {createMigration.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 bg-muted rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {!isLoading && filteredMigrations.length > 0 && (
        <div className="relative">
          {filteredMigrations.map((migration, idx) => {
            const status = STATUS_CONFIG[migration.status] ?? DEFAULT_STATUS;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === migration.id;
            const isLast = idx === filteredMigrations.length - 1;
            const isDraft = migration.status === 'draft';

            return (
              <div key={migration.id} className="relative flex gap-4">
                {/* Timeline line */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute left-[15px] top-[36px] w-[2px] bottom-0',
                      status.line
                    )}
                  />
                )}

                {/* Status icon */}
                <div
                  className={cn(
                    'relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2',
                    status.bg,
                    status.border
                  )}
                >
                  <StatusIcon
                    className={cn(
                      'w-4 h-4',
                      status.color,
                      migration.status === 'running' && 'animate-spin'
                    )}
                  />
                </div>

                {/* Content */}
                <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
                  <button
                    onClick={() => handleToggleExpand(migration.id)}
                    className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-border hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        {/* Version badge */}
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-aqua-700 bg-aqua-50 border border-aqua-200 rounded">
                          {migration.version}
                        </span>
                        <h5 className="text-sm font-semibold text-foreground">
                          {migration.title}
                        </h5>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Dialect badge */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: getDialectColor(migration.sourceDialect) }}
                          />
                          <span style={{ color: getDialectColor(migration.sourceDialect) }}>
                            {getDialectLabel(migration.sourceDialect)}
                          </span>
                          <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: getDialectColor(migration.targetDialect) }}
                          />
                          <span style={{ color: getDialectColor(migration.targetDialect) }}>
                            {getDialectLabel(migration.targetDialect)}
                          </span>
                        </span>

                        {/* Status badge */}
                        <span
                          className={cn(
                            'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                            status.bg,
                            status.color
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-1 ml-5">
                      {formatDate(migration.createdAt)}
                      {migration.appliedAt && (
                        <span className="ml-2 text-green-600">
                          Applied {formatDate(migration.appliedAt)}
                        </span>
                      )}
                    </p>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-2 bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                      {/* Description */}
                      {migration.description && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                            Description
                          </p>
                          <p className="text-xs text-muted-foreground">{migration.description}</p>
                        </div>
                      )}

                      {/* Up SQL */}
                      {migration.upSQL && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                            Up SQL (Migration)
                          </p>
                          <pre className="text-xs font-mono bg-[#1e293b] text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                            {migration.upSQL}
                          </pre>
                        </div>
                      )}

                      {/* Down SQL (Rollback) */}
                      {migration.downSQL && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                            Rollback SQL
                          </p>
                          <pre className="text-xs font-mono bg-[#1e293b] text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                            {migration.downSQL}
                          </pre>
                        </div>
                      )}

                      {/* Checksum */}
                      {migration.checksum && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                            Checksum
                          </p>
                          <p className="text-xs font-mono text-muted-foreground">{migration.checksum}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        {/* Apply button for draft migrations */}
                        {isDraft && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApplyMigration(migration);
                            }}
                            disabled={updateMigration.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            {updateMigration.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            Apply
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMigration(migration);
                          }}
                          disabled={deleteMigration.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          {deleteMigration.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredMigrations.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {migrations.length === 0
              ? 'No migrations yet'
              : 'No migrations match your filters'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {migrations.length === 0
              ? 'Create your first migration to get started'
              : 'Try adjusting the status filter or search query'}
          </p>
        </div>
      )}
    </div>
  );
}

export default MigrationTimeline;
