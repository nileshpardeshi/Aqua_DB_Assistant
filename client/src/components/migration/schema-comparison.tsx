import { useState, useMemo } from 'react';
import {
  Columns3,
  Plus,
  Minus,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
}

interface TableDef {
  name: string;
  columns: ColumnDef[];
}

type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

interface ColumnDiff {
  name: string;
  status: DiffStatus;
  sourceType?: string;
  targetType?: string;
  sourceNullable?: boolean;
  targetNullable?: boolean;
  sourceDefault?: string;
  targetDefault?: string;
}

interface TableDiff {
  name: string;
  status: DiffStatus;
  columns: ColumnDiff[];
}

// Mock schemas for demonstration
const MOCK_SOURCE_TABLES: TableDef[] = [
  {
    name: 'users',
    columns: [
      { name: 'id', type: 'INT', nullable: false, isPrimaryKey: true },
      { name: 'name', type: 'VARCHAR(255)', nullable: false },
      { name: 'email', type: 'VARCHAR(255)', nullable: false },
      { name: 'password_hash', type: 'VARCHAR(255)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'NOW()' },
    ],
  },
  {
    name: 'orders',
    columns: [
      { name: 'id', type: 'INT', nullable: false, isPrimaryKey: true },
      { name: 'user_id', type: 'INT', nullable: false },
      { name: 'total', type: 'DECIMAL(10,2)', nullable: false },
      { name: 'status', type: 'VARCHAR(50)', nullable: false, defaultValue: "'pending'" },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
  },
  {
    name: 'sessions',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, isPrimaryKey: true },
      { name: 'user_id', type: 'INT', nullable: false },
      { name: 'token', type: 'VARCHAR(512)', nullable: false },
      { name: 'expires_at', type: 'TIMESTAMP', nullable: false },
    ],
  },
];

const MOCK_TARGET_TABLES: TableDef[] = [
  {
    name: 'users',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, isPrimaryKey: true },
      { name: 'name', type: 'VARCHAR(255)', nullable: false },
      { name: 'email', type: 'VARCHAR(320)', nullable: false },
      { name: 'password_hash', type: 'VARCHAR(255)', nullable: false },
      { name: 'phone', type: 'VARCHAR(20)', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP', nullable: true },
    ],
  },
  {
    name: 'orders',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, isPrimaryKey: true },
      { name: 'user_id', type: 'BIGINT', nullable: false },
      { name: 'total', type: 'DECIMAL(12,2)', nullable: false },
      { name: 'status', type: 'VARCHAR(50)', nullable: false, defaultValue: "'pending'" },
      { name: 'notes', type: 'TEXT', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
  },
  {
    name: 'products',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, isPrimaryKey: true },
      { name: 'name', type: 'VARCHAR(255)', nullable: false },
      { name: 'price', type: 'DECIMAL(10,2)', nullable: false },
      { name: 'category', type: 'VARCHAR(100)', nullable: true },
    ],
  },
];

function computeTableDiffs(
  source: TableDef[],
  target: TableDef[]
): TableDiff[] {
  const diffs: TableDiff[] = [];
  const sourceNames = new Set(source.map((t) => t.name));
  const targetNames = new Set(target.map((t) => t.name));

  // Tables in both
  for (const sourceTable of source) {
    const targetTable = target.find((t) => t.name === sourceTable.name);
    if (targetTable) {
      const columnDiffs = computeColumnDiffs(sourceTable.columns, targetTable.columns);
      const hasChanges = columnDiffs.some((c) => c.status !== 'unchanged');
      diffs.push({
        name: sourceTable.name,
        status: hasChanges ? 'modified' : 'unchanged',
        columns: columnDiffs,
      });
    } else {
      // Removed table
      diffs.push({
        name: sourceTable.name,
        status: 'removed',
        columns: sourceTable.columns.map((c) => ({
          name: c.name,
          status: 'removed' as DiffStatus,
          sourceType: c.type,
          sourceNullable: c.nullable,
          sourceDefault: c.defaultValue,
        })),
      });
    }
  }

  // Added tables
  for (const targetTable of target) {
    if (!sourceNames.has(targetTable.name)) {
      diffs.push({
        name: targetTable.name,
        status: 'added',
        columns: targetTable.columns.map((c) => ({
          name: c.name,
          status: 'added' as DiffStatus,
          targetType: c.type,
          targetNullable: c.nullable,
          targetDefault: c.defaultValue,
        })),
      });
    }
  }

  // Sort: modified first, then added, then removed, then unchanged
  const order: Record<DiffStatus, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 };
  diffs.sort((a, b) => order[a.status] - order[b.status]);

  return diffs;
}

function computeColumnDiffs(
  source: ColumnDef[],
  target: ColumnDef[]
): ColumnDiff[] {
  const diffs: ColumnDiff[] = [];
  const sourceNames = new Set(source.map((c) => c.name));

  for (const srcCol of source) {
    const tgtCol = target.find((c) => c.name === srcCol.name);
    if (tgtCol) {
      const isModified =
        srcCol.type !== tgtCol.type ||
        srcCol.nullable !== tgtCol.nullable ||
        srcCol.defaultValue !== tgtCol.defaultValue;
      diffs.push({
        name: srcCol.name,
        status: isModified ? 'modified' : 'unchanged',
        sourceType: srcCol.type,
        targetType: tgtCol.type,
        sourceNullable: srcCol.nullable,
        targetNullable: tgtCol.nullable,
        sourceDefault: srcCol.defaultValue,
        targetDefault: tgtCol.defaultValue,
      });
    } else {
      diffs.push({
        name: srcCol.name,
        status: 'removed',
        sourceType: srcCol.type,
        sourceNullable: srcCol.nullable,
        sourceDefault: srcCol.defaultValue,
      });
    }
  }

  for (const tgtCol of target) {
    if (!sourceNames.has(tgtCol.name)) {
      diffs.push({
        name: tgtCol.name,
        status: 'added',
        targetType: tgtCol.type,
        targetNullable: tgtCol.nullable,
        targetDefault: tgtCol.defaultValue,
      });
    }
  }

  return diffs;
}

const STATUS_STYLES: Record<DiffStatus, { bg: string; text: string; badge: string }> = {
  added: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  removed: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  modified: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  unchanged: { bg: 'bg-white', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-500' },
};

const STATUS_ICONS: Record<DiffStatus, React.ComponentType<{ className?: string }>> = {
  added: Plus,
  removed: Minus,
  modified: RefreshCw,
  unchanged: Columns3,
};

export function SchemaComparison() {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set(['users', 'orders']));
  const [sourceSchema] = useState<TableDef[]>(MOCK_SOURCE_TABLES);
  const [targetSchema] = useState<TableDef[]>(MOCK_TARGET_TABLES);

  const tableDiffs = useMemo(
    () => computeTableDiffs(sourceSchema, targetSchema),
    [sourceSchema, targetSchema]
  );

  const toggleExpand = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const stats = useMemo(() => {
    const added = tableDiffs.filter((t) => t.status === 'added').length;
    const removed = tableDiffs.filter((t) => t.status === 'removed').length;
    const modified = tableDiffs.filter((t) => t.status === 'modified').length;
    const unchanged = tableDiffs.filter((t) => t.status === 'unchanged').length;
    return { added, removed, modified, unchanged };
  }, [tableDiffs]);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs font-medium text-slate-600">
          {tableDiffs.length} tables compared:
        </span>
        {stats.added > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700">
            <Plus className="w-2.5 h-2.5" />
            {stats.added} added
          </span>
        )}
        {stats.removed > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
            <Minus className="w-2.5 h-2.5" />
            {stats.removed} removed
          </span>
        )}
        {stats.modified > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">
            <RefreshCw className="w-2.5 h-2.5" />
            {stats.modified} modified
          </span>
        )}
        {stats.unchanged > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500">
            {stats.unchanged} unchanged
          </span>
        )}
      </div>

      {/* Table Diffs */}
      <div className="space-y-3">
        {tableDiffs.map((table) => {
          const style = STATUS_STYLES[table.status];
          const DiffIcon = STATUS_ICONS[table.status];
          const isExpanded = expandedTables.has(table.name);

          return (
            <div
              key={table.name}
              className={cn(
                'border rounded-lg overflow-hidden transition-all',
                table.status === 'added' && 'border-green-200',
                table.status === 'removed' && 'border-red-200',
                table.status === 'modified' && 'border-amber-200',
                table.status === 'unchanged' && 'border-slate-200'
              )}
            >
              {/* Table header */}
              <button
                onClick={() => toggleExpand(table.name)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  style.bg,
                  'hover:opacity-90'
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                )}

                <DiffIcon className={cn('w-4 h-4 flex-shrink-0', style.text)} />

                <span className={cn('text-sm font-semibold font-mono', style.text)}>
                  {table.name}
                </span>

                <span
                  className={cn(
                    'ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                    style.badge
                  )}
                >
                  {table.status}
                </span>

                <span className="text-[10px] text-slate-400">
                  {table.columns.length} cols
                </span>
              </button>

              {/* Column diffs */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {/* Column header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <div className="col-span-1" />
                    <div className="col-span-3">Column</div>
                    <div className="col-span-3">Source Type</div>
                    <div className="col-span-3">Target Type</div>
                    <div className="col-span-2">Status</div>
                  </div>

                  {table.columns.map((col) => {
                    const colStyle = STATUS_STYLES[col.status];

                    return (
                      <div
                        key={col.name}
                        className={cn(
                          'grid grid-cols-12 gap-2 px-4 py-2 items-center border-b border-slate-50 last:border-b-0',
                          col.status === 'added' && 'bg-green-50/50',
                          col.status === 'removed' && 'bg-red-50/50',
                          col.status === 'modified' && 'bg-amber-50/30'
                        )}
                      >
                        <div className="col-span-1">
                          {col.status === 'added' && (
                            <Plus className="w-3 h-3 text-green-500" />
                          )}
                          {col.status === 'removed' && (
                            <Minus className="w-3 h-3 text-red-500" />
                          )}
                          {col.status === 'modified' && (
                            <RefreshCw className="w-3 h-3 text-amber-500" />
                          )}
                        </div>

                        <div className="col-span-3">
                          <span className={cn('text-sm font-mono', colStyle.text)}>
                            {col.name}
                          </span>
                        </div>

                        <div className="col-span-3">
                          {col.sourceType ? (
                            <span
                              className={cn(
                                'text-xs font-mono px-1.5 py-0.5 rounded',
                                col.status === 'removed'
                                  ? 'bg-red-100 text-red-700 line-through'
                                  : col.status === 'modified'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {col.sourceType}
                              {col.sourceNullable === false ? ' NOT NULL' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">--</span>
                          )}
                        </div>

                        <div className="col-span-3">
                          {col.targetType ? (
                            <span
                              className={cn(
                                'text-xs font-mono px-1.5 py-0.5 rounded',
                                col.status === 'added'
                                  ? 'bg-green-100 text-green-700'
                                  : col.status === 'modified'
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {col.targetType}
                              {col.targetNullable === false ? ' NOT NULL' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">--</span>
                          )}
                        </div>

                        <div className="col-span-2">
                          {col.status !== 'unchanged' && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 text-[9px] font-bold rounded uppercase',
                                colStyle.badge
                              )}
                            >
                              {col.status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SchemaComparison;
