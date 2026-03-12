import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Table2,
  Columns3,
  ListTree,
  ShieldCheck,
  GitFork,
  ArrowRight,
  ArrowLeft,
  Key,
  Link,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Check,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Bot,
  Sparkles,
  Copy,
  Zap,
  Power,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, formatNumber } from '@/lib/utils';
import { useTable, useRelationships, useUpdateTable, useDeleteTable, useTriggers, useCreateTrigger, useUpdateTrigger, useDeleteTrigger, useToggleTrigger } from '@/hooks/use-schema';
import { useProject } from '@/hooks/use-projects';
import { useReviewSchema, useAnalyzeTrigger } from '@/hooks/use-ai';
import type { TriggerAnalysis } from '@/hooks/use-ai';
import type { Table, Column, Relationship, SchemaReview, Trigger } from '@/hooks/use-schema';
import { getDialectDataTypes } from '@/config/constants';

// ── Constants ────────────────────────────────────────────────────────────────

// Data types are loaded dynamically per dialect

const INDEX_TYPES = ['BTREE', 'HASH', 'GIN', 'GIST', 'BRIN'];

const CONSTRAINT_TYPES = ['PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK'];

const TRIGGER_TIMINGS = ['BEFORE', 'AFTER', 'INSTEAD OF'];
const TRIGGER_EVENTS = ['INSERT', 'UPDATE', 'DELETE'];

const MOCK_TABLE_REVIEW: SchemaReview = {
  score: 78,
  issues: [
    { severity: 'warning', category: 'Indexing', message: 'No index on frequently queried columns', suggestion: 'Add indexes on columns used in WHERE clauses' },
    { severity: 'info', category: 'Naming', message: 'Consider using snake_case consistently', suggestion: 'Rename columns to follow naming conventions' },
    { severity: 'warning', category: 'Data Types', message: 'VARCHAR without explicit length limit', suggestion: 'Specify max length for VARCHAR columns' },
  ],
  summary: 'Table structure is good but needs optimization for query performance.',
};

// ── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'columns' | 'indexes' | 'constraints' | 'relationships' | 'triggers';

interface TableDetailPanelProps {
  tableId: string;
  onBack?: () => void;
}

interface ColumnEditRow {
  id: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string;
  comment: string;
}

interface NewIndexForm {
  indexName: string;
  indexType: string;
  isUnique: boolean;
  columns: string[];
}

interface NewConstraintForm {
  constraintName: string;
  constraintType: string;
  columns: string[];
}

interface NewTriggerForm {
  triggerName: string;
  timing: string;
  event: string;
  triggerBody: string;
  description: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getHealthBadge(table: Table): { label: string; color: string } {
  const hasPK = table.columns.some((c) => c.isPrimaryKey);
  const hasIndexes = table.indexes.length > 0;
  const hasDescription = !!table.description;
  let score = 0;
  if (hasPK) score += 40;
  if (hasIndexes) score += 30;
  if (hasDescription) score += 15;
  if (table.columns.length > 0) score += 15;

  if (score >= 85) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700' };
  if (score >= 60) return { label: 'Good', color: 'bg-aqua-100 text-aqua-700' };
  if (score >= 40) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Needs Work', color: 'bg-red-100 text-red-700' };
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />;
    default:
      return <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;
  }
}

function getSeverityBg(severity: string): string {
  switch (severity) {
    case 'error':
      return 'bg-red-50 border-red-100';
    case 'warning':
      return 'bg-yellow-50 border-yellow-100';
    default:
      return 'bg-blue-50 border-blue-100';
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TableDetailPanel({ tableId, onBack }: TableDetailPanelProps) {
  const { projectId } = useParams();
  const { data: table, isLoading } = useTable(projectId, tableId);
  const { data: project } = useProject(projectId);
  const { data: allRelationships } = useRelationships(projectId);
  const dialectDataTypes = useMemo(
    () => getDialectDataTypes(project?.dialect ?? 'postgresql'),
    [project?.dialect]
  );
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();
  const reviewSchema = useReviewSchema();

  const [activeTab, setActiveTab] = useState<TabKey>('columns');
  const [isEditing, setIsEditing] = useState(false);
  const [editColumns, setEditColumns] = useState<ColumnEditRow[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [reviewResult, setReviewResult] = useState<SchemaReview | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showAddIndex, setShowAddIndex] = useState(false);
  const [newIndex, setNewIndex] = useState<NewIndexForm>({ indexName: '', indexType: 'BTREE', isUnique: false, columns: [] });
  const [showAddConstraint, setShowAddConstraint] = useState(false);
  const [newConstraint, setNewConstraint] = useState<NewConstraintForm>({ constraintName: '', constraintType: 'UNIQUE', columns: [] });

  // Trigger state
  const { data: triggers } = useTriggers(projectId, tableId);
  const createTrigger = useCreateTrigger();
  const updateTriggerMut = useUpdateTrigger();
  const deleteTrigger = useDeleteTrigger();
  const toggleTrigger = useToggleTrigger();
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [newTrigger, setNewTrigger] = useState<NewTriggerForm>({
    triggerName: '', timing: 'BEFORE', event: 'INSERT', triggerBody: '', description: '',
  });
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
  const [editTrigger, setEditTrigger] = useState<NewTriggerForm>({
    triggerName: '', timing: 'BEFORE', event: 'INSERT', triggerBody: '', description: '',
  });
  const analyzeTriggerMut = useAnalyzeTrigger();
  const [triggerAnalysisResult, setTriggerAnalysisResult] = useState<TriggerAnalysis | null>(null);

  // Filter relationships for this table
  const incomingRels = (allRelationships ?? []).filter((r) => r.targetTable === tableId);
  const outgoingRels = (allRelationships ?? []).filter((r) => r.sourceTable === tableId);

  // ── Edit mode handlers ───────────────────────────────────────────────────

  const handleStartEdit = useCallback(() => {
    if (!table) return;
    setEditColumns(
      table.columns.map((col) => ({
        id: col.id,
        columnName: col.name,
        dataType: col.dataType,
        isNullable: col.nullable,
        isPrimaryKey: col.isPrimaryKey,
        isUnique: col.isUnique,
        defaultValue: col.defaultValue || '',
        comment: col.comment || '',
      }))
    );
    setIsEditing(true);
    setActiveTab('columns');
  }, [table]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditColumns([]);
  }, []);

  const handleSaveColumns = useCallback(() => {
    if (!projectId || !table) return;
    updateTable.mutate(
      {
        projectId,
        tableId: table.id,
        data: {
          columns: editColumns.map((col) => ({
            columnName: col.columnName,
            dataType: col.dataType,
            isNullable: col.isNullable,
            isPrimaryKey: col.isPrimaryKey,
            isUnique: col.isUnique,
            defaultValue: col.defaultValue || undefined,
            comment: col.comment || undefined,
          })),
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          setEditColumns([]);
          toast.success('Columns updated successfully');
        },
        onError: () => toast.error('Failed to update columns'),
      }
    );
  }, [projectId, table, editColumns, updateTable]);

  const handleAddColumn = useCallback(() => {
    setEditColumns((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        columnName: '',
        dataType: 'VARCHAR(255)',
        isNullable: true,
        isPrimaryKey: false,
        isUnique: false,
        defaultValue: '',
        comment: '',
      },
    ]);
  }, []);

  const handleRemoveColumn = useCallback((id: string) => {
    setEditColumns((prev) => prev.filter((col) => col.id !== id));
  }, []);

  const handleColumnChange = useCallback(
    (id: string, field: keyof ColumnEditRow, value: string | boolean) => {
      setEditColumns((prev) =>
        prev.map((col) => (col.id === id ? { ...col, [field]: value } : col))
      );
    },
    []
  );

  // ── Name / description edit ──────────────────────────────────────────────

  const handleSaveName = useCallback(() => {
    if (!projectId || !table || !editName.trim()) return;
    updateTable.mutate(
      { projectId, tableId: table.id, data: { tableName: editName.trim() } },
      {
        onSuccess: () => {
          setIsEditingName(false);
          toast.success('Table name updated');
        },
        onError: () => toast.error('Failed to update table name'),
      }
    );
  }, [projectId, table, editName, updateTable]);

  const handleSaveDesc = useCallback(() => {
    if (!projectId || !table) return;
    updateTable.mutate(
      { projectId, tableId: table.id, data: { description: editDesc.trim() } },
      {
        onSuccess: () => {
          setIsEditingDesc(false);
          toast.success('Description updated');
        },
        onError: () => toast.error('Failed to update description'),
      }
    );
  }, [projectId, table, editDesc, updateTable]);

  // ── Delete table ─────────────────────────────────────────────────────────

  const handleDeleteTable = useCallback(() => {
    if (!projectId || !table) return;
    deleteTable.mutate(
      { projectId, tableId: table.id },
      {
        onSuccess: () => {
          toast.success(`Table "${table.name}" deleted`);
          onBack?.();
        },
        onError: () => toast.error('Failed to delete table'),
      }
    );
  }, [projectId, table, deleteTable, onBack]);

  // ── AI Review ────────────────────────────────────────────────────────────

  const handleAIReview = useCallback(() => {
    if (!projectId) return;
    setShowReview(true);
    reviewSchema.mutate(
      { projectId },
      {
        onSuccess: (data) => {
          setReviewResult(data);
        },
        onError: () => {
          setReviewResult(MOCK_TABLE_REVIEW);
          toast('Using demo review data', { icon: '🤖' });
        },
      }
    );
  }, [projectId, reviewSchema]);

  // ── Add Index ────────────────────────────────────────────────────────────

  const handleSaveIndex = useCallback(() => {
    if (!projectId || !table || !newIndex.indexName.trim() || newIndex.columns.length === 0) {
      toast.error('Index name and at least one column are required');
      return;
    }
    updateTable.mutate(
      {
        projectId,
        tableId: table.id,
        data: {
          indexes: [
            ...table.indexes.map((idx) => ({
              indexName: idx.name,
              indexType: idx.type,
              isUnique: idx.isUnique,
              columns: idx.columns,
            })),
            {
              indexName: newIndex.indexName.trim(),
              indexType: newIndex.indexType,
              isUnique: newIndex.isUnique,
              columns: newIndex.columns,
            },
          ],
        },
      },
      {
        onSuccess: () => {
          setShowAddIndex(false);
          setNewIndex({ indexName: '', indexType: 'BTREE', isUnique: false, columns: [] });
          toast.success('Index added successfully');
        },
        onError: () => toast.error('Failed to add index'),
      }
    );
  }, [projectId, table, newIndex, updateTable]);

  const handleDeleteIndex = useCallback(
    (indexName: string) => {
      if (!projectId || !table) return;
      updateTable.mutate(
        {
          projectId,
          tableId: table.id,
          data: {
            indexes: table.indexes
              .filter((idx) => idx.name !== indexName)
              .map((idx) => ({
                indexName: idx.name,
                indexType: idx.type,
                isUnique: idx.isUnique,
                columns: idx.columns,
              })),
          },
        },
        {
          onSuccess: () => toast.success('Index deleted'),
          onError: () => toast.error('Failed to delete index'),
        }
      );
    },
    [projectId, table, updateTable]
  );

  // ── Add Constraint ───────────────────────────────────────────────────────

  const handleSaveConstraint = useCallback(() => {
    if (!projectId || !table || !newConstraint.constraintName.trim() || newConstraint.columns.length === 0) {
      toast.error('Constraint name and at least one column are required');
      return;
    }
    updateTable.mutate(
      {
        projectId,
        tableId: table.id,
        data: {
          constraints: [
            ...table.constraints.map((con) => ({
              constraintName: con.name,
              constraintType: con.type,
              columns: con.columns,
            })),
            {
              constraintName: newConstraint.constraintName.trim(),
              constraintType: newConstraint.constraintType,
              columns: newConstraint.columns,
            },
          ],
        },
      },
      {
        onSuccess: () => {
          setShowAddConstraint(false);
          setNewConstraint({ constraintName: '', constraintType: 'UNIQUE', columns: [] });
          toast.success('Constraint added successfully');
        },
        onError: () => toast.error('Failed to add constraint'),
      }
    );
  }, [projectId, table, newConstraint, updateTable]);

  const handleDeleteConstraint = useCallback(
    (constraintName: string) => {
      if (!projectId || !table) return;
      updateTable.mutate(
        {
          projectId,
          tableId: table.id,
          data: {
            constraints: table.constraints
              .filter((con) => con.name !== constraintName)
              .map((con) => ({
                constraintName: con.name,
                constraintType: con.type,
                columns: con.columns,
              })),
          },
        },
        {
          onSuccess: () => toast.success('Constraint deleted'),
          onError: () => toast.error('Failed to delete constraint'),
        }
      );
    },
    [projectId, table, updateTable]
  );

  // ── Trigger handlers ────────────────────────────────────────────────────

  const handleSaveTrigger = useCallback(() => {
    if (!projectId || !tableId || !newTrigger.triggerName.trim() || !newTrigger.triggerBody.trim()) {
      toast.error('Trigger name and body are required');
      return;
    }
    createTrigger.mutate(
      {
        projectId,
        tableId,
        data: {
          triggerName: newTrigger.triggerName.trim(),
          timing: newTrigger.timing,
          event: newTrigger.event,
          triggerBody: newTrigger.triggerBody.trim(),
          description: newTrigger.description.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowAddTrigger(false);
          setNewTrigger({ triggerName: '', timing: 'BEFORE', event: 'INSERT', triggerBody: '', description: '' });
          toast.success('Trigger created successfully');
        },
        onError: () => toast.error('Failed to create trigger'),
      }
    );
  }, [projectId, tableId, newTrigger, createTrigger]);

  const handleUpdateTrigger = useCallback(() => {
    if (!projectId || !tableId || !editingTriggerId) return;
    updateTriggerMut.mutate(
      {
        projectId,
        tableId,
        triggerId: editingTriggerId,
        data: {
          triggerName: editTrigger.triggerName.trim(),
          timing: editTrigger.timing,
          event: editTrigger.event,
          triggerBody: editTrigger.triggerBody.trim(),
          description: editTrigger.description.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setEditingTriggerId(null);
          toast.success('Trigger updated');
        },
        onError: () => toast.error('Failed to update trigger'),
      }
    );
  }, [projectId, tableId, editingTriggerId, editTrigger, updateTriggerMut]);

  const handleDeleteTrigger = useCallback(
    (triggerId: string) => {
      if (!projectId || !tableId) return;
      deleteTrigger.mutate(
        { projectId, tableId, triggerId },
        {
          onSuccess: () => toast.success('Trigger deleted'),
          onError: () => toast.error('Failed to delete trigger'),
        }
      );
    },
    [projectId, tableId, deleteTrigger]
  );

  const handleToggleTrigger = useCallback(
    (triggerId: string) => {
      if (!projectId || !tableId) return;
      toggleTrigger.mutate(
        { projectId, tableId, triggerId },
        {
          onSuccess: (data) => {
            toast.success(`Trigger ${data.isEnabled ? 'enabled' : 'disabled'}`);
          },
          onError: () => toast.error('Failed to toggle trigger'),
        }
      );
    },
    [projectId, tableId, toggleTrigger]
  );

  const handleAnalyzeTrigger = useCallback(
    (form: NewTriggerForm) => {
      if (!projectId || !tableId || !form.triggerName.trim() || !form.triggerBody.trim()) {
        toast.error('Trigger name and body are required for analysis');
        return;
      }
      setTriggerAnalysisResult(null);
      analyzeTriggerMut.mutate(
        {
          projectId,
          tableId,
          triggerName: form.triggerName.trim(),
          timing: form.timing,
          event: form.event,
          triggerBody: form.triggerBody.trim(),
          description: form.description.trim() || undefined,
          dialect: project?.dialect ?? 'postgresql',
        },
        {
          onSuccess: (data) => {
            setTriggerAnalysisResult(data);
          },
          onError: () => toast.error('AI analysis failed. Check your AI provider configuration.'),
        }
      );
    },
    [projectId, tableId, project?.dialect, analyzeTriggerMut]
  );

  const handleStartEditTrigger = useCallback((trigger: Trigger) => {
    setEditingTriggerId(trigger.id);
    setEditTrigger({
      triggerName: trigger.triggerName,
      timing: trigger.timing,
      event: trigger.event,
      triggerBody: trigger.triggerBody,
      description: trigger.description || '',
    });
  }, []);

  // ── Copy DDL ─────────────────────────────────────────────────────────────

  const handleCopyDDL = useCallback(() => {
    if (!table) return;
    const cols = table.columns
      .map((c) => {
        let line = `  ${c.name} ${c.dataType}`;
        if (!c.nullable) line += ' NOT NULL';
        if (c.isPrimaryKey) line += ' PRIMARY KEY';
        if (c.isUnique && !c.isPrimaryKey) line += ' UNIQUE';
        if (c.defaultValue) line += ` DEFAULT ${c.defaultValue}`;
        return line;
      })
      .join(',\n');
    const ddl = `CREATE TABLE ${table.name} (\n${cols}\n);`;
    navigator.clipboard.writeText(ddl);
    toast.success('DDL copied to clipboard');
  }, [table]);

  // ── Toggle index column selection ────────────────────────────────────────

  const toggleIndexColumn = useCallback((colName: string) => {
    setNewIndex((prev) => ({
      ...prev,
      columns: prev.columns.includes(colName)
        ? prev.columns.filter((c) => c !== colName)
        : [...prev.columns, colName],
    }));
  }, []);

  const toggleConstraintColumn = useCallback((colName: string) => {
    setNewConstraint((prev) => ({
      ...prev,
      columns: prev.columns.includes(colName)
        ? prev.columns.filter((c) => c !== colName)
        : [...prev.columns, colName],
    }));
  }, []);

  // ── Loading / not found ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-aqua-500 animate-spin" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Table not found.</p>
      </div>
    );
  }

  const health = getHealthBadge(table);

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: 'columns', label: 'Columns', icon: Columns3, count: table.columns.length },
    { key: 'indexes', label: 'Indexes', icon: ListTree, count: table.indexes.length },
    { key: 'constraints', label: 'Constraints', icon: ShieldCheck, count: table.constraints.length },
    { key: 'relationships', label: 'Relationships', icon: GitFork, count: incomingRels.length + outgoingRels.length },
    { key: 'triggers', label: 'Triggers', icon: Zap, count: triggers?.length ?? 0 },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Delete Confirmation Bar ──────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 font-medium flex-1">
            Delete table &quot;{table.name}&quot;? This action cannot be undone.
          </span>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteTable}
            disabled={deleteTable.isPending}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {deleteTable.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Delete
          </button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-aqua-600 hover:text-aqua-700 font-medium mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to overview
          </button>
        )}

        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }}
          >
            <Table2 className="w-5 h-5 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Editable Name */}
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-bold text-foreground border border-aqua-400 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-aqua-500/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                />
                <button onClick={handleSaveName} className="p-1 text-aqua-600 hover:text-aqua-700">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditingName(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h2
                className="text-lg font-bold text-foreground cursor-pointer hover:text-aqua-700 transition-colors group inline-flex items-center gap-1.5"
                onClick={() => {
                  setEditName(table.name);
                  setIsEditingName(true);
                }}
              >
                {table.name}
                <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
            )}

            {/* Tags Row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-medium bg-aqua-50 text-aqua-700 rounded-full uppercase">
                {table.type || 'table'}
              </span>
              {table.estimatedRows != null && (
                <span className="text-xs text-muted-foreground">
                  ~{formatNumber(table.estimatedRows)} rows
                </span>
              )}
              <span className={cn('px-2 py-0.5 text-[10px] font-medium rounded-full', health.color)}>
                {health.label}
              </span>
            </div>

            {/* Editable Description */}
            {isEditingDesc ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Add a description..."
                  className="text-sm text-muted-foreground border border-aqua-400 rounded-lg px-2 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-aqua-500/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDesc();
                    if (e.key === 'Escape') setIsEditingDesc(false);
                  }}
                />
                <button onClick={handleSaveDesc} className="p-1 text-aqua-600 hover:text-aqua-700">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditingDesc(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p
                className="text-sm text-muted-foreground mt-2 cursor-pointer hover:text-foreground transition-colors group inline-flex items-center gap-1.5"
                onClick={() => {
                  setEditDesc(table.description || '');
                  setIsEditingDesc(true);
                }}
              >
                {table.description || 'Click to add description...'}
                <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="bg-card border border-slate-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-slate-800">{table.columns.length}</div>
            <div className="text-[10px] text-slate-500 uppercase font-medium">Columns</div>
          </div>
          <div className="bg-card border border-slate-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-slate-800">{table.indexes.length}</div>
            <div className="text-[10px] text-slate-500 uppercase font-medium">Indexes</div>
          </div>
          <div className="bg-card border border-slate-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-slate-800">{table.constraints.length}</div>
            <div className="text-[10px] text-slate-500 uppercase font-medium">Constraints</div>
          </div>
          <div className="bg-card border border-slate-200 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-slate-800">{incomingRels.length + outgoingRels.length}</div>
            <div className="text-[10px] text-slate-500 uppercase font-medium">Relations</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button
            onClick={handleStartEdit}
            disabled={isEditing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              isEditing
                ? 'bg-aqua-100 text-aqua-700 cursor-not-allowed'
                : 'bg-aqua-600 hover:bg-aqua-700 text-white'
            )}
          >
            <Pencil className="w-3 h-3" />
            Edit Columns
          </button>
          <button
            onClick={handleAIReview}
            disabled={reviewSchema.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {reviewSchema.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            AI Review
          </button>
          <button
            onClick={handleCopyDDL}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Copy className="w-3 h-3" />
            Copy DDL
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 bg-card border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors ml-auto"
          >
            <Trash2 className="w-3 h-3" />
            Delete Table
          </button>
        </div>
      </div>

      {/* ── AI Review Results ───────────────────────────────────── */}
      {showReview && (
        <div className="mb-6 bg-card border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-800">AI Schema Review</h3>
            </div>
            <button onClick={() => setShowReview(false)} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {reviewSchema.isPending ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
              <span className="text-sm text-slate-500">Analyzing table structure...</span>
            </div>
          ) : reviewResult ? (
            <div className="space-y-3">
              {/* Score Badge */}
              <div className="flex items-center gap-3">
                <div className={cn('px-3 py-1.5 rounded-lg border text-lg font-bold', getScoreColor(reviewResult.score))}>
                  {reviewResult.score}/100
                </div>
                <p className="text-sm text-slate-600">{reviewResult.summary}</p>
              </div>

              {/* Issues List */}
              {reviewResult.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issues Found</h4>
                  {reviewResult.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={cn('border rounded-lg p-3', getSeverityBg(issue.severity))}
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(issue.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-slate-700">{issue.category}</span>
                          </div>
                          <p className="text-xs text-slate-600">{issue.message}</p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {issue.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-aqua-500 text-aqua-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10px] rounded-full font-medium',
                  activeTab === tab.key ? 'bg-aqua-100 text-aqua-700' : 'bg-slate-100 text-slate-500'
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Edit Mode Banner ───────────────────────────────────── */}
      {isEditing && activeTab === 'columns' && (
        <div className="flex items-center gap-3 mb-4 bg-aqua-50 border border-aqua-200 rounded-xl px-4 py-3">
          <Pencil className="w-4 h-4 text-aqua-600" />
          <span className="text-sm text-aqua-700 font-medium flex-1">Editing columns &mdash; make changes below</span>
          <button
            onClick={handleCancelEdit}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveColumns}
            disabled={updateTable.isPending}
            className="px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {updateTable.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            <Save className="w-3 h-3" />
            Save Changes
          </button>
        </div>
      )}

      {/* ── Tab Content ────────────────────────────────────────── */}
      {activeTab === 'columns' && (
        <ColumnsTab
          table={table}
          isEditing={isEditing}
          editColumns={editColumns}
          onColumnChange={handleColumnChange}
          onRemoveColumn={handleRemoveColumn}
          onAddColumn={handleAddColumn}
          dialectDataTypes={dialectDataTypes}
        />
      )}
      {activeTab === 'indexes' && (
        <IndexesTab
          table={table}
          showAddIndex={showAddIndex}
          setShowAddIndex={setShowAddIndex}
          newIndex={newIndex}
          setNewIndex={setNewIndex}
          toggleIndexColumn={toggleIndexColumn}
          onSaveIndex={handleSaveIndex}
          onDeleteIndex={handleDeleteIndex}
          isSaving={updateTable.isPending}
        />
      )}
      {activeTab === 'constraints' && (
        <ConstraintsTab
          table={table}
          showAddConstraint={showAddConstraint}
          setShowAddConstraint={setShowAddConstraint}
          newConstraint={newConstraint}
          setNewConstraint={setNewConstraint}
          toggleConstraintColumn={toggleConstraintColumn}
          onSaveConstraint={handleSaveConstraint}
          onDeleteConstraint={handleDeleteConstraint}
          isSaving={updateTable.isPending}
        />
      )}
      {activeTab === 'relationships' && (
        <RelationshipsTab incoming={incomingRels} outgoing={outgoingRels} />
      )}
      {activeTab === 'triggers' && (
        <TriggersTab
          triggers={triggers ?? []}
          showAddTrigger={showAddTrigger}
          setShowAddTrigger={setShowAddTrigger}
          newTrigger={newTrigger}
          setNewTrigger={setNewTrigger}
          onSaveTrigger={handleSaveTrigger}
          onDeleteTrigger={handleDeleteTrigger}
          onToggleTrigger={handleToggleTrigger}
          onStartEditTrigger={handleStartEditTrigger}
          editingTriggerId={editingTriggerId}
          editTrigger={editTrigger}
          setEditTrigger={setEditTrigger}
          onUpdateTrigger={handleUpdateTrigger}
          onCancelEditTrigger={() => setEditingTriggerId(null)}
          isSaving={createTrigger.isPending || updateTriggerMut.isPending}
          onAnalyzeTrigger={handleAnalyzeTrigger}
          isAnalyzing={analyzeTriggerMut.isPending}
          analysisResult={triggerAnalysisResult}
          onClearAnalysis={() => setTriggerAnalysisResult(null)}
        />
      )}
    </div>
  );
}

// ── Columns Tab ──────────────────────────────────────────────────────────────

function ColumnsTab({
  table,
  isEditing,
  editColumns,
  onColumnChange,
  onRemoveColumn,
  onAddColumn,
  dialectDataTypes,
}: {
  table: Table;
  isEditing: boolean;
  editColumns: ColumnEditRow[];
  onColumnChange: (id: string, field: keyof ColumnEditRow, value: string | boolean) => void;
  onRemoveColumn: (id: string) => void;
  onAddColumn: () => void;
  dialectDataTypes: string[];
}) {
  if (isEditing) {
    return (
      <div className="bg-card border-2 border-aqua-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-aqua-100 bg-aqua-50/50">
                <th className="text-left py-2.5 px-3 text-slate-500 font-semibold w-8">#</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Name</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Data Type</th>
                <th className="text-center py-2.5 px-3 text-slate-500 font-semibold">Nullable</th>
                <th className="text-center py-2.5 px-3 text-slate-500 font-semibold">PK</th>
                <th className="text-center py-2.5 px-3 text-slate-500 font-semibold">Unique</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Default</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Comment</th>
                <th className="text-center py-2.5 px-3 text-slate-500 font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody>
              {editColumns.map((col, idx) => (
                <tr key={col.id} className="border-b border-slate-100 hover:bg-aqua-50/30 transition-colors">
                  <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={col.columnName}
                      onChange={(e) => onColumnChange(col.id, 'columnName', e.target.value)}
                      placeholder="column_name"
                      className="text-xs border border-slate-300 rounded px-2 py-1 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={col.dataType}
                      onChange={(e) => onColumnChange(col.id, 'dataType', e.target.value)}
                      className="text-xs border border-slate-300 rounded px-2 py-1 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none bg-card"
                    >
                      {dialectDataTypes.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                      {/* Keep current value if it's not in the dialect list */}
                      {!dialectDataTypes.includes(col.dataType) && (
                        <option value={col.dataType}>{col.dataType}</option>
                      )}
                    </select>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onColumnChange(col.id, 'isNullable', !col.isNullable)}
                      className={cn(
                        'inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-medium transition-colors',
                        col.isNullable
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      )}
                    >
                      {col.isNullable ? 'YES' : 'NO'}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={col.isPrimaryKey}
                      onChange={(e) => onColumnChange(col.id, 'isPrimaryKey', e.target.checked)}
                      className="w-3.5 h-3.5 text-amber-500 border-slate-300 rounded focus:ring-aqua-500/30 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={col.isUnique}
                      onChange={(e) => onColumnChange(col.id, 'isUnique', e.target.checked)}
                      className="w-3.5 h-3.5 text-purple-500 border-slate-300 rounded focus:ring-aqua-500/30 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={col.defaultValue}
                      onChange={(e) => onColumnChange(col.id, 'defaultValue', e.target.value)}
                      placeholder="NULL"
                      className="text-xs border border-slate-300 rounded px-2 py-1 w-full font-mono focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={col.comment}
                      onChange={(e) => onColumnChange(col.id, 'comment', e.target.value)}
                      placeholder="Comment"
                      className="text-xs border border-slate-300 rounded px-2 py-1 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => onRemoveColumn(col.id)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove column"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Column Row */}
        <button
          onClick={onAddColumn}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-aqua-600 hover:text-aqua-700 hover:bg-aqua-50/50 border-t border-dashed border-aqua-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Column
        </button>
      </div>
    );
  }

  // Read-only mode
  return (
    <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left py-2.5 px-3 text-slate-500 font-semibold w-8">#</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Name</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Type</th>
              <th className="text-center py-2.5 px-3 text-slate-500 font-semibold">Nullable</th>
              <th className="text-center py-2.5 px-3 text-slate-500 font-semibold">PK</th>
              <th className="text-center py-2.5 px-3 text-slate-500 font-semibold">Unique</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Default</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Comment</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-semibold">Reference</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((col, idx) => (
              <tr
                key={col.id || col.name}
                className={cn(
                  'border-b border-slate-100 transition-colors hover:bg-slate-50',
                  idx % 2 === 0 ? 'bg-card' : 'bg-slate-50/40'
                )}
              >
                <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                <td className="py-2.5 px-3 font-medium text-slate-800">
                  <div className="flex items-center gap-1.5">
                    {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500" />}
                    {col.isForeignKey && <Link className="w-3 h-3 text-blue-500" />}
                    <span>{col.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                    {col.dataType}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={cn(
                      'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                      col.nullable ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
                    )}
                  >
                    {col.nullable ? 'YES' : 'NO'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  {col.isPrimaryKey && (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                      P
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center">
                  {col.isUnique && (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">
                      U
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                  {col.defaultValue ?? '-'}
                </td>
                <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                  {col.comment ?? '-'}
                </td>
                <td className="py-2.5 px-3">
                  {col.isForeignKey && col.referencesTable && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      <ArrowRight className="w-2.5 h-2.5" />
                      {col.referencesTable}
                      {col.referencesColumn && `.${col.referencesColumn}`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Indexes Tab ──────────────────────────────────────────────────────────────

function IndexesTab({
  table,
  showAddIndex,
  setShowAddIndex,
  newIndex,
  setNewIndex,
  toggleIndexColumn,
  onSaveIndex,
  onDeleteIndex,
  isSaving,
}: {
  table: Table;
  showAddIndex: boolean;
  setShowAddIndex: (v: boolean) => void;
  newIndex: NewIndexForm;
  setNewIndex: React.Dispatch<React.SetStateAction<NewIndexForm>>;
  toggleIndexColumn: (colName: string) => void;
  onSaveIndex: () => void;
  onDeleteIndex: (name: string) => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Add Index Button */}
      <div className="flex justify-end">
        {!showAddIndex && (
          <button
            onClick={() => setShowAddIndex(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Index
          </button>
        )}
      </div>

      {/* Add Index Form */}
      {showAddIndex && (
        <div className="bg-card border-2 border-aqua-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ListTree className="w-4 h-4 text-aqua-600" />
            <h4 className="text-xs font-semibold text-slate-700">New Index</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Index Name</label>
              <input
                type="text"
                value={newIndex.indexName}
                onChange={(e) => setNewIndex((p) => ({ ...p, indexName: e.target.value }))}
                placeholder="idx_table_column"
                className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Index Type</label>
              <select
                value={newIndex.indexType}
                onChange={(e) => setNewIndex((p) => ({ ...p, indexType: e.target.value }))}
                className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none bg-card"
              >
                {INDEX_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={newIndex.isUnique}
                onChange={(e) => setNewIndex((p) => ({ ...p, isUnique: e.target.checked }))}
                className="w-3.5 h-3.5 text-aqua-600 border-slate-300 rounded focus:ring-aqua-500/30"
              />
              Unique Index
            </label>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Columns</label>
            <div className="flex flex-wrap gap-1.5">
              {table.columns.map((col) => (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => toggleIndexColumn(col.name)}
                  className={cn(
                    'px-2 py-1 text-[11px] font-mono rounded border transition-colors',
                    newIndex.columns.includes(col.name)
                      ? 'bg-aqua-100 text-aqua-700 border-aqua-300'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-aqua-300 hover:text-aqua-600'
                  )}
                >
                  {col.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setShowAddIndex(false);
                setNewIndex({ indexName: '', indexType: 'BTREE', isUnique: false, columns: [] });
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSaveIndex}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              <Save className="w-3 h-3" />
              Save Index
            </button>
          </div>
        </div>
      )}

      {/* Index List */}
      {table.indexes.length === 0 && !showAddIndex ? (
        <EmptyTabState message="No indexes defined on this table." />
      ) : (
        table.indexes.map((idx) => (
          <div
            key={idx.id || idx.name}
            className="bg-card border border-slate-200 rounded-xl p-3 group hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <ListTree className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-800">{idx.name}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded uppercase">
                {idx.type}
              </span>
              {idx.isUnique && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 rounded">
                  UNIQUE
                </span>
              )}
              <button
                onClick={() => onDeleteIndex(idx.name)}
                className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                title="Delete index"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 ml-5.5">
              {idx.columns.map((col) => (
                <span
                  key={col}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-50 text-slate-600 rounded border border-slate-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Constraints Tab ──────────────────────────────────────────────────────────

function ConstraintsTab({
  table,
  showAddConstraint,
  setShowAddConstraint,
  newConstraint,
  setNewConstraint,
  toggleConstraintColumn,
  onSaveConstraint,
  onDeleteConstraint,
  isSaving,
}: {
  table: Table;
  showAddConstraint: boolean;
  setShowAddConstraint: (v: boolean) => void;
  newConstraint: NewConstraintForm;
  setNewConstraint: React.Dispatch<React.SetStateAction<NewConstraintForm>>;
  toggleConstraintColumn: (colName: string) => void;
  onSaveConstraint: () => void;
  onDeleteConstraint: (name: string) => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Add Constraint Button */}
      <div className="flex justify-end">
        {!showAddConstraint && (
          <button
            onClick={() => setShowAddConstraint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Constraint
          </button>
        )}
      </div>

      {/* Add Constraint Form */}
      {showAddConstraint && (
        <div className="bg-card border-2 border-aqua-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-aqua-600" />
            <h4 className="text-xs font-semibold text-slate-700">New Constraint</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Constraint Name</label>
              <input
                type="text"
                value={newConstraint.constraintName}
                onChange={(e) => setNewConstraint((p) => ({ ...p, constraintName: e.target.value }))}
                placeholder="pk_table_id"
                className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Constraint Type</label>
              <select
                value={newConstraint.constraintType}
                onChange={(e) => setNewConstraint((p) => ({ ...p, constraintType: e.target.value }))}
                className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none bg-card"
              >
                {CONSTRAINT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Columns</label>
            <div className="flex flex-wrap gap-1.5">
              {table.columns.map((col) => (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => toggleConstraintColumn(col.name)}
                  className={cn(
                    'px-2 py-1 text-[11px] font-mono rounded border transition-colors',
                    newConstraint.columns.includes(col.name)
                      ? 'bg-aqua-100 text-aqua-700 border-aqua-300'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-aqua-300 hover:text-aqua-600'
                  )}
                >
                  {col.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setShowAddConstraint(false);
                setNewConstraint({ constraintName: '', constraintType: 'UNIQUE', columns: [] });
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSaveConstraint}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              <Save className="w-3 h-3" />
              Save Constraint
            </button>
          </div>
        </div>
      )}

      {/* Constraint List */}
      {table.constraints.length === 0 && !showAddConstraint ? (
        <EmptyTabState message="No constraints defined on this table." />
      ) : (
        table.constraints.map((con) => (
          <div
            key={con.id || con.name}
            className="bg-card border border-slate-200 rounded-xl p-3 group hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-800">{con.name}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10px] font-medium rounded uppercase',
                  con.type === 'PRIMARY KEY'
                    ? 'bg-amber-50 text-amber-700'
                    : con.type === 'FOREIGN KEY'
                    ? 'bg-blue-50 text-blue-700'
                    : con.type === 'UNIQUE'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-slate-100 text-slate-600'
                )}
              >
                {con.type}
              </span>
              <button
                onClick={() => onDeleteConstraint(con.name)}
                className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                title="Delete constraint"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 ml-5.5">
              {con.columns.map((col) => (
                <span
                  key={col}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-50 text-slate-600 rounded border border-slate-200"
                >
                  {col}
                </span>
              ))}
            </div>
            {con.referencesTable && (
              <div className="flex items-center gap-1.5 mt-2 ml-5.5 text-[10px] text-blue-600">
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium">{con.referencesTable}</span>
                {con.referencesColumns && (
                  <span className="text-blue-400">({con.referencesColumns.join(', ')})</span>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Relationships Tab ────────────────────────────────────────────────────────

function RelationshipsTab({
  incoming,
  outgoing,
}: {
  incoming: Relationship[];
  outgoing: Relationship[];
}) {
  if (incoming.length === 0 && outgoing.length === 0) {
    return <EmptyTabState message="No relationships found for this table." />;
  }

  return (
    <div className="space-y-4">
      {/* Outgoing */}
      {outgoing.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3" />
            Outgoing ({outgoing.length})
          </h4>
          <div className="space-y-2">
            {outgoing.map((rel) => (
              <RelationshipCard key={rel.id} rel={rel} direction="outgoing" />
            ))}
          </div>
        </div>
      )}

      {/* Incoming */}
      {incoming.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ArrowLeft className="w-3 h-3" />
            Incoming ({incoming.length})
          </h4>
          <div className="space-y-2">
            {incoming.map((rel) => (
              <RelationshipCard key={rel.id} rel={rel} direction="incoming" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Relationship Card ────────────────────────────────────────────────────────

function RelationshipCard({
  rel,
  direction,
}: {
  rel: Relationship;
  direction: 'incoming' | 'outgoing';
}) {
  return (
    <div className="bg-card border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <GitFork className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-800">{rel.name}</span>
        {rel.isInferred && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">
            inferred
          </span>
        )}
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded uppercase">
          {rel.type}
        </span>
        <span
          className={cn(
            'ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded',
            direction === 'outgoing'
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-orange-50 text-orange-600'
          )}
        >
          {direction}
        </span>
      </div>
      <div className="flex items-center gap-2 ml-5.5 text-xs text-slate-600">
        <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
          {(rel.sourceTableName || rel.sourceTable)}.{rel.sourceColumn}
        </span>
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
          {(rel.targetTableName || rel.targetTable)}.{rel.targetColumn}
        </span>
      </div>
    </div>
  );
}

// ── Triggers Tab ─────────────────────────────────────────────────────────────

function TriggersTab({
  triggers,
  showAddTrigger,
  setShowAddTrigger,
  newTrigger,
  setNewTrigger,
  onSaveTrigger,
  onDeleteTrigger,
  onToggleTrigger,
  onStartEditTrigger,
  editingTriggerId,
  editTrigger,
  setEditTrigger,
  onUpdateTrigger,
  onCancelEditTrigger,
  isSaving,
  onAnalyzeTrigger,
  isAnalyzing,
  analysisResult,
  onClearAnalysis,
}: {
  triggers: Trigger[];
  showAddTrigger: boolean;
  setShowAddTrigger: (v: boolean) => void;
  newTrigger: NewTriggerForm;
  setNewTrigger: React.Dispatch<React.SetStateAction<NewTriggerForm>>;
  onSaveTrigger: () => void;
  onDeleteTrigger: (id: string) => void;
  onToggleTrigger: (id: string) => void;
  onStartEditTrigger: (trigger: Trigger) => void;
  editingTriggerId: string | null;
  editTrigger: NewTriggerForm;
  setEditTrigger: React.Dispatch<React.SetStateAction<NewTriggerForm>>;
  onUpdateTrigger: () => void;
  onCancelEditTrigger: () => void;
  isSaving: boolean;
  onAnalyzeTrigger: (form: NewTriggerForm) => void;
  isAnalyzing: boolean;
  analysisResult: TriggerAnalysis | null;
  onClearAnalysis: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Add Trigger Button */}
      <div className="flex justify-end">
        {!showAddTrigger && (
          <button
            onClick={() => setShowAddTrigger(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Trigger
          </button>
        )}
      </div>

      {/* Add Trigger Form */}
      {showAddTrigger && (
        <TriggerForm
          form={newTrigger}
          setForm={setNewTrigger}
          onSave={onSaveTrigger}
          onCancel={() => {
            setShowAddTrigger(false);
            setNewTrigger({ triggerName: '', timing: 'BEFORE', event: 'INSERT', triggerBody: '', description: '' });
            onClearAnalysis();
          }}
          isSaving={isSaving}
          title="New Trigger"
          onAnalyze={onAnalyzeTrigger}
          isAnalyzing={isAnalyzing}
          analysisResult={analysisResult}
        />
      )}

      {/* Trigger List */}
      {triggers.length === 0 && !showAddTrigger ? (
        <EmptyTabState message="No triggers defined on this table." />
      ) : (
        triggers.map((trigger) =>
          editingTriggerId === trigger.id ? (
            <TriggerForm
              key={trigger.id}
              form={editTrigger}
              setForm={setEditTrigger}
              onSave={onUpdateTrigger}
              onCancel={() => { onCancelEditTrigger(); onClearAnalysis(); }}
              isSaving={isSaving}
              title="Edit Trigger"
              onAnalyze={onAnalyzeTrigger}
              isAnalyzing={isAnalyzing}
              analysisResult={analysisResult}
            />
          ) : (
            <div
              key={trigger.id}
              className="bg-card border border-slate-200 rounded-xl p-3 group hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-slate-800">{trigger.triggerName}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded uppercase">
                  {trigger.timing}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-50 text-violet-700 rounded uppercase">
                  {trigger.event}
                </span>
                <button
                  onClick={() => onToggleTrigger(trigger.id)}
                  className={cn(
                    'ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded transition-colors',
                    trigger.isEnabled
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                  title={trigger.isEnabled ? 'Click to disable' : 'Click to enable'}
                >
                  {trigger.isEnabled ? (
                    <ToggleRight className="w-3.5 h-3.5" />
                  ) : (
                    <ToggleLeft className="w-3.5 h-3.5" />
                  )}
                  {trigger.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => onStartEditTrigger(trigger)}
                  className="p-1 text-slate-400 hover:text-aqua-600 hover:bg-aqua-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Edit trigger"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteTrigger(trigger.id)}
                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete trigger"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {trigger.description && (
                <p className="text-[11px] text-slate-500 ml-5.5 mb-1.5">{trigger.description}</p>
              )}
              <div className="ml-5.5">
                <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {trigger.triggerBody}
                </pre>
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}

// ── Trigger Form (shared for create/edit) ────────────────────────────────────

function TriggerForm({
  form,
  setForm,
  onSave,
  onCancel,
  isSaving,
  title,
  onAnalyze,
  isAnalyzing,
  analysisResult,
}: {
  form: NewTriggerForm;
  setForm: React.Dispatch<React.SetStateAction<NewTriggerForm>>;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  title: string;
  onAnalyze?: (form: NewTriggerForm) => void;
  isAnalyzing?: boolean;
  analysisResult?: TriggerAnalysis | null;
}) {
  return (
    <div className="bg-card border-2 border-aqua-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-aqua-600" />
        <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Trigger Name</label>
          <input
            type="text"
            value={form.triggerName}
            onChange={(e) => setForm((p) => ({ ...p, triggerName: e.target.value }))}
            placeholder="trg_before_insert"
            className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Timing</label>
          <select
            value={form.timing}
            onChange={(e) => setForm((p) => ({ ...p, timing: e.target.value }))}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none bg-card"
          >
            {TRIGGER_TIMINGS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Event</label>
          <select
            value={form.event}
            onChange={(e) => setForm((p) => ({ ...p, event: e.target.value }))}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none bg-card"
          >
            {TRIGGER_EVENTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="What this trigger does..."
          className="text-xs border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Trigger Body</label>
        <textarea
          value={form.triggerBody}
          onChange={(e) => setForm((p) => ({ ...p, triggerBody: e.target.value }))}
          placeholder="BEGIN&#10;  -- trigger logic here&#10;END;"
          rows={6}
          className="text-xs font-mono border border-slate-300 rounded px-2 py-1.5 w-full focus:border-aqua-500 focus:ring-1 focus:ring-aqua-500/30 focus:outline-none resize-y"
        />
      </div>
      {/* AI Analysis Results */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
          <span className="text-xs text-slate-500">Analyzing trigger with AI...</span>
        </div>
      )}

      {analysisResult && !isAnalyzing && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-semibold text-slate-700">AI Analysis</span>
            <span className={cn(
              'px-1.5 py-0.5 text-[10px] font-medium rounded',
              analysisResult.isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            )}>
              {analysisResult.isValid ? 'Valid' : 'Has Issues'}
            </span>
          </div>

          {/* Explanation */}
          {analysisResult.explanation && (
            <p className="text-[11px] text-slate-600">{analysisResult.explanation}</p>
          )}

          {/* Issues */}
          {analysisResult.issues.length > 0 && (
            <div className="space-y-1">
              {analysisResult.issues.map((issue, idx) => (
                <div key={idx} className={cn('rounded p-2 border text-[11px]', getSeverityBg(issue.severity))}>
                  <div className="flex items-start gap-1.5">
                    {getSeverityIcon(issue.severity)}
                    <div>
                      <p className="text-slate-700">{issue.message}</p>
                      <p className="text-slate-500 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                        {issue.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Optimized Body */}
          {analysisResult.optimizedBody && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-slate-500 uppercase">Optimized Body</span>
                <button
                  onClick={() => setForm(p => ({ ...p, triggerBody: analysisResult.optimizedBody! }))}
                  className="text-[10px] text-aqua-600 hover:text-aqua-700 font-medium"
                >
                  Apply
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-600 bg-card border border-slate-200 rounded p-2 whitespace-pre-wrap max-h-24 overflow-y-auto">
                {analysisResult.optimizedBody}
              </pre>
            </div>
          )}

          {/* Dialect Notes */}
          {analysisResult.dialectNotes && (
            <p className="text-[10px] text-slate-500 italic">{analysisResult.dialectNotes}</p>
          )}

          {/* Best Practices */}
          {analysisResult.bestPractices && analysisResult.bestPractices.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-slate-500 uppercase">Best Practices</span>
              <ul className="mt-1 space-y-0.5">
                {analysisResult.bestPractices.map((bp, idx) => (
                  <li key={idx} className="text-[10px] text-slate-600 flex items-start gap-1">
                    <Info className="w-2.5 h-2.5 text-blue-400 flex-shrink-0 mt-0.5" />
                    {bp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        {onAnalyze && (
          <button
            onClick={() => onAnalyze(form)}
            disabled={isAnalyzing || !form.triggerBody.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            AI Validate
          </button>
        )}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
          <Save className="w-3 h-3" />
          Save Trigger
        </button>
      </div>
    </div>
  );
}

// ── Empty Tab State ──────────────────────────────────────────────────────────

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Info className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
