import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Save,
  Loader2,
  Clock,
  Database,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Shield,
  CheckCircle2,
  ArrowLeft,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDataLifecycleRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  parseRuleConfig,
} from '@/hooks/use-data-lifecycle';
import type {
  DataLifecycleRule,
  RuleConfiguration,
  RuleCondition,
} from '@/hooks/use-data-lifecycle';

// ── Constants ───────────────────────────────────────────────────────────────

const RETENTION_COLUMNS = [
  'created_at',
  'updated_at',
  'deleted_at',
  'last_login_at',
  'expires_at',
  'processed_at',
  'modified_at',
  'archived_at',
  'last_accessed_at',
];

const CONDITION_OPERATORS: { value: RuleCondition['operator']; label: string }[] = [
  { value: '=', label: '= (equals)' },
  { value: '!=', label: '!= (not equals)' },
  { value: '>', label: '> (greater than)' },
  { value: '<', label: '< (less than)' },
  { value: '>=', label: '>= (greater or equal)' },
  { value: '<=', label: '<= (less or equal)' },
  { value: 'IS NULL', label: 'IS NULL' },
  { value: 'IS NOT NULL', label: 'IS NOT NULL' },
  { value: 'LIKE', label: 'LIKE (pattern)' },
  { value: 'IN', label: 'IN (list)' },
];

const PRIORITY_OPTIONS: {
  value: RuleConfiguration['priority'];
  label: string;
  color: string;
  bg: string;
}[] = [
  { value: 'critical', label: 'Critical', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  { value: 'high', label: 'High', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
  { value: 'medium', label: 'Medium', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  { value: 'low', label: 'Low', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
];

const DIALECT_OPTIONS = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mariadb', label: 'MariaDB' },
];

const PRIORITY_BADGE: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  high: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  medium: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  low: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
};

// ── Main Component ──────────────────────────────────────────────────────────

export function RetentionPolicyEditor() {
  const { projectId } = useParams();
  const { data: rules, isLoading } = useDataLifecycleRules(projectId);

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingRule, setEditingRule] = useState<DataLifecycleRule | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const deleteRule = useDeleteRule();

  const handleNew = () => {
    setEditingRule(null);
    setView('form');
  };

  const handleEdit = (rule: DataLifecycleRule) => {
    setEditingRule(rule);
    setView('form');
  };

  const handleDuplicate = (rule: DataLifecycleRule) => {
    const config = parseRuleConfig(rule);
    const dupRule = {
      ...rule,
      id: '',
      ruleName: `${rule.ruleName} (Copy)`,
      configuration: JSON.stringify(config),
    };
    setEditingRule(dupRule);
    setView('form');
  };

  const handleBack = () => {
    setView('list');
    setEditingRule(null);
  };

  const handleDelete = async (ruleId: string) => {
    if (!projectId) return;
    await deleteRule.mutateAsync({ projectId, ruleId });
    setDeleteConfirm(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (view === 'form') {
    return (
      <RuleForm
        rule={editingRule}
        onBack={handleBack}
      />
    );
  }

  // ── List View ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading...' : `${rules?.length ?? 0} retention ${(rules?.length ?? 0) === 1 ? 'rule' : 'rules'} configured`}
        </p>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-aqua-600 text-white hover:bg-aqua-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Empty State */}
      {!isLoading && (!rules || rules.length === 0) && (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-foreground mb-1">No Retention Rules</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first data retention rule to start managing data lifecycle.
          </p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-aqua-600 text-white hover:bg-aqua-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create First Rule
          </button>
        </div>
      )}

      {/* Rules List */}
      {rules && rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => {
            const config = parseRuleConfig(rule);
            const isExpanded = expandedRules.has(rule.id);
            const prBadge = PRIORITY_BADGE[config.priority] ?? PRIORITY_BADGE.medium;

            return (
              <div
                key={rule.id}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                {/* Rule Header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(rule.id)} className="text-muted-foreground hover:text-foreground">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      rule.isActive ? 'bg-green-500' : 'bg-muted-foreground/50'
                    )}
                  />

                  <button
                    onClick={() => toggleExpand(rule.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {rule.ruleName}
                      </span>
                      <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded', prBadge.bg, prBadge.color)}>
                        {config.priority.toUpperCase()}
                      </span>
                      {!rule.isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{rule.targetTable}</span>
                      {' — '}
                      {config.retentionPeriod} {config.retentionUnit} on <span className="font-mono">{config.retentionColumn}</span>
                      {config.conditions.length > 0 && ` + ${config.conditions.length} condition${config.conditions.length > 1 ? 's' : ''}`}
                    </p>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDuplicate(rule)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {deleteConfirm === rule.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          disabled={deleteRule.isPending}
                          className="px-2 py-1 text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                          {deleteRule.isPending ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(rule.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 py-3 bg-muted/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground font-medium">Table</span>
                        <p className="font-mono font-semibold text-foreground mt-0.5">{rule.targetTable}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">Retention</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {config.retentionPeriod} {config.retentionUnit}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">Date Column</span>
                        <p className="font-mono font-semibold text-foreground mt-0.5">{config.retentionColumn}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">SQL Dialect</span>
                        <p className="font-semibold text-foreground mt-0.5 capitalize">{config.sqlDialect}</p>
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {config.cascadeDelete && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                          <AlertTriangle className="w-2.5 h-2.5" /> CASCADE DELETE
                        </span>
                      )}
                      {config.backupBeforePurge && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                          <Shield className="w-2.5 h-2.5" /> BACKUP FIRST
                        </span>
                      )}
                      {config.notifyOnExecution && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                          <CheckCircle2 className="w-2.5 h-2.5" /> NOTIFY
                        </span>
                      )}
                    </div>

                    {/* Conditions */}
                    {config.conditions.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Conditions
                        </span>
                        <div className="mt-1 space-y-1">
                          {config.conditions.map((cond, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {i > 0 && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-muted text-muted-foreground">
                                  {cond.conjunction}
                                </span>
                              )}
                              <code className="bg-card px-2 py-0.5 rounded border border-border text-foreground">
                                {cond.column} {cond.operator}{' '}
                                {cond.operator !== 'IS NULL' && cond.operator !== 'IS NOT NULL' && `'${cond.value}'`}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rule Summary */}
                    <div className="mt-3 p-2 bg-card border border-border rounded text-xs text-muted-foreground font-mono">
                      DELETE FROM {rule.targetTable} WHERE {config.retentionColumn} &lt; (NOW() - {config.retentionPeriod} {config.retentionUnit})
                      {config.conditions.map((c, i) => (
                        <span key={i}>
                          {' '}{c.conjunction} {c.column} {c.operator}
                          {c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL' && ` '${c.value}'`}
                        </span>
                      ))}
                    </div>

                    <div className="text-[10px] text-muted-foreground mt-2">
                      Created: {new Date(rule.createdAt).toLocaleDateString()} | Updated: {new Date(rule.updatedAt).toLocaleDateString()}
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

// ── Rule Form (Create / Edit) ───────────────────────────────────────────────

function RuleForm({
  rule,
  onBack,
}: {
  rule: DataLifecycleRule | null;
  onBack: () => void;
}) {
  const { projectId } = useParams();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  const isEditing = rule !== null && rule.id !== '';
  const existingConfig = rule ? parseRuleConfig(rule) : null;

  const [ruleName, setRuleName] = useState(rule?.ruleName ?? '');
  const [targetTable, setTargetTable] = useState(rule?.targetTable ?? '');
  const [retentionPeriod, setRetentionPeriod] = useState(existingConfig?.retentionPeriod ?? 90);
  const [retentionUnit, setRetentionUnit] = useState<RuleConfiguration['retentionUnit']>(existingConfig?.retentionUnit ?? 'days');
  const [retentionColumn, setRetentionColumn] = useState(existingConfig?.retentionColumn ?? 'created_at');
  const [customColumn, setCustomColumn] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>(existingConfig?.conditions ?? []);
  const [priority, setPriority] = useState<RuleConfiguration['priority']>(existingConfig?.priority ?? 'medium');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [cascadeDelete, setCascadeDelete] = useState(existingConfig?.cascadeDelete ?? false);
  const [backupBeforePurge, setBackupBeforePurge] = useState(existingConfig?.backupBeforePurge ?? true);
  const [notifyOnExecution, setNotifyOnExecution] = useState(existingConfig?.notifyOnExecution ?? false);
  const [sqlDialect, setSqlDialect] = useState(existingConfig?.sqlDialect ?? 'postgresql');
  const [saved, setSaved] = useState(false);

  const isPending = createRule.isPending || updateRule.isPending;

  // Determine if using a custom column
  const usingCustomColumn = !RETENTION_COLUMNS.includes(retentionColumn);

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { column: '', operator: '=', value: '', conjunction: 'AND' },
    ]);
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = useCallback(async () => {
    if (!ruleName.trim() || !targetTable.trim() || !projectId) return;

    const config: RuleConfiguration = {
      retentionPeriod,
      retentionUnit,
      retentionColumn: usingCustomColumn ? customColumn || retentionColumn : retentionColumn,
      conditions: conditions.filter((c) => c.column.trim() !== ''),
      priority,
      cascadeDelete,
      backupBeforePurge,
      notifyOnExecution,
      sqlDialect,
    };

    try {
      if (isEditing && rule) {
        await updateRule.mutateAsync({
          projectId,
          ruleId: rule.id,
          data: {
            ruleName: ruleName.trim(),
            targetTable: targetTable.trim(),
            configuration: config,
            isActive,
          },
        });
      } else {
        await createRule.mutateAsync({
          projectId,
          ruleName: ruleName.trim(),
          targetTable: targetTable.trim(),
          configuration: config,
          isActive,
        });
      }
      setSaved(true);
      setTimeout(() => {
        onBack();
      }, 800);
    } catch {
      // Error handled by mutation
    }
  }, [
    ruleName, targetTable, retentionPeriod, retentionUnit, retentionColumn,
    customColumn, usingCustomColumn, conditions, priority, isActive,
    cascadeDelete, backupBeforePurge, notifyOnExecution, sqlDialect,
    projectId, isEditing, rule, createRule, updateRule, onBack,
  ]);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rules
      </button>

      <h3 className="text-lg font-bold text-foreground">
        {isEditing ? 'Edit Retention Rule' : 'Create Retention Rule'}
      </h3>

      {/* Rule Name */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Rule Name
        </label>
        <input
          type="text"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          placeholder="e.g., Purge old audit logs, Clean expired sessions"
          className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
        />
      </div>

      {/* Table Name */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" />
          Target Table
        </label>
        <input
          type="text"
          value={targetTable}
          onChange={(e) => setTargetTable(e.target.value)}
          placeholder="e.g., audit_logs, user_sessions, temp_data"
          className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
        />
      </div>

      {/* Retention Period + Column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Retention Period
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="flex-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
            />
            <select
              value={retentionUnit}
              onChange={(e) => setRetentionUnit(e.target.value as RuleConfiguration['retentionUnit'])}
              className="px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Data older than {retentionPeriod} {retentionUnit} will be eligible for purging
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Date Column
          </label>
          <select
            value={usingCustomColumn ? '__custom__' : retentionColumn}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setRetentionColumn('__custom__');
              } else {
                setRetentionColumn(e.target.value);
                setCustomColumn('');
              }
            }}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          >
            {RETENTION_COLUMNS.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
            <option value="__custom__">Custom column...</option>
          </select>
          {(usingCustomColumn || retentionColumn === '__custom__') && (
            <input
              type="text"
              value={customColumn || (usingCustomColumn && retentionColumn !== '__custom__' ? retentionColumn : '')}
              onChange={(e) => {
                setCustomColumn(e.target.value);
                setRetentionColumn('__custom__');
              }}
              placeholder="Enter custom column name"
              className="w-full mt-1.5 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
            />
          )}
        </div>
      </div>

      {/* SQL Dialect */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          SQL Dialect
        </label>
        <div className="flex gap-2 flex-wrap">
          {DIALECT_OPTIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setSqlDialect(d.value)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-lg border transition-all',
                sqlDialect === d.value
                  ? 'bg-aqua-50 dark:bg-aqua-900/20 border-aqua-300 dark:border-aqua-700 text-aqua-700 dark:text-aqua-400 shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Conditions */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              WHERE Conditions ({conditions.length})
            </span>
          </div>
          <button
            onClick={addCondition}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-aqua-700 bg-aqua-50 rounded-md hover:bg-aqua-100 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Condition
          </button>
        </div>

        {conditions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No additional conditions. Only the date retention filter will be applied.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {conditions.map((cond, index) => (
              <div key={index} className="px-4 py-3 flex items-start gap-2 flex-wrap">
                {/* Conjunction */}
                {index > 0 && (
                  <select
                    value={cond.conjunction}
                    onChange={(e) => updateCondition(index, { conjunction: e.target.value as 'AND' | 'OR' })}
                    className="px-2 py-2 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 w-16"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
                {index === 0 && <span className="px-2 py-2 text-xs text-muted-foreground w-16">WHERE</span>}

                {/* Column */}
                <input
                  type="text"
                  value={cond.column}
                  onChange={(e) => updateCondition(index, { column: e.target.value })}
                  placeholder="column_name"
                  className="flex-1 min-w-[120px] px-3 py-2 text-xs font-mono border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30"
                />

                {/* Operator */}
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(index, { operator: e.target.value as RuleCondition['operator'] })}
                  className="px-2 py-2 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30"
                >
                  {CONDITION_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                {/* Value */}
                {cond.operator !== 'IS NULL' && cond.operator !== 'IS NOT NULL' && (
                  <input
                    type="text"
                    value={cond.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    placeholder={cond.operator === 'IN' ? "'a','b','c'" : 'value'}
                    className="flex-1 min-w-[100px] px-3 py-2 text-xs font-mono border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30"
                  />
                )}

                {/* Remove */}
                <button
                  onClick={() => removeCondition(index)}
                  className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Priority
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriority(opt.value)}
              className={cn(
                'px-3 py-2.5 text-sm font-medium rounded-lg border transition-all text-center',
                priority === opt.value
                  ? cn(opt.bg, opt.color, 'shadow-sm')
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Safety Options */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Safety &amp; Options</h4>

        {/* Active Toggle */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-[10px] text-muted-foreground">
              {isActive ? 'Rule is active and included in purge operations' : 'Rule is inactive and will be skipped'}
            </p>
          </div>
          <ToggleSwitch checked={isActive} onChange={setIsActive} />
        </div>

        {/* Backup Toggle */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Backup Before Purge</p>
            <p className="text-[10px] text-muted-foreground">
              Create a backup table of affected rows before deletion
            </p>
          </div>
          <ToggleSwitch checked={backupBeforePurge} onChange={setBackupBeforePurge} />
        </div>

        {/* Cascade Delete */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Cascade Delete
              <AlertTriangle className="w-3 h-3 text-red-500" />
            </p>
            <p className="text-[10px] text-muted-foreground">
              Also delete related records in dependent tables (use with caution)
            </p>
          </div>
          <ToggleSwitch checked={cascadeDelete} onChange={setCascadeDelete} color="red" />
        </div>

        {/* Notify */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Notify on Execution</p>
            <p className="text-[10px] text-muted-foreground">
              Send notification when purge script is executed
            </p>
          </div>
          <ToggleSwitch checked={notifyOnExecution} onChange={setNotifyOnExecution} />
        </div>
      </div>

      {/* Summary Preview */}
      {targetTable.trim() && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Rule Summary
          </h5>
          <p className="text-sm text-foreground">
            Delete rows from <span className="font-mono font-semibold text-aqua-700">{targetTable}</span> where{' '}
            <span className="font-mono font-semibold">
              {usingCustomColumn ? customColumn || retentionColumn : retentionColumn}
            </span> is older than{' '}
            <span className="font-semibold">{retentionPeriod} {retentionUnit}</span>
            {conditions.filter((c) => c.column.trim()).map((c, i) => (
              <span key={i}>
                {' '}<span className="text-muted-foreground">{c.conjunction}</span>{' '}
                <span className="font-mono">{c.column} {c.operator}</span>
                {c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL' && (
                  <span className="font-mono text-muted-foreground"> '{c.value}'</span>
                )}
              </span>
            ))}
          </p>
          {backupBeforePurge && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Backup will be created before deletion
            </p>
          )}
          {cascadeDelete && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Cascade delete is enabled
            </p>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!ruleName.trim() || !targetTable.trim() || isPending}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            !ruleName.trim() || !targetTable.trim() || isPending
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Update Rule' : 'Save Rule'}
            </>
          )}
        </button>

        <button
          onClick={onBack}
          className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>

        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            {isEditing ? 'Rule updated!' : 'Rule created!'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Toggle Switch ───────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  color = 'aqua',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  color?: 'aqua' | 'red';
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
        checked
          ? color === 'red' ? 'bg-red-500' : 'bg-aqua-500'
          : 'bg-muted-foreground/50'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-card transition-transform shadow-sm',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}

export default RetentionPolicyEditor;
