import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search,
  Table2,
  ChevronRight,
  ChevronDown,
  Key,
  Link,
  Hash,
  FolderTree,
  Loader2,
  Type,
  Plus,
  Trash2,
  Eye,
  LayoutGrid,
  Filter,
  Pencil,
  Check,
  X,
  FolderPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useTables, useSchemas, useCreateSchema, useRenameSchema, useDeleteSchema } from '@/hooks/use-schema';
import type { Table, Column } from '@/hooks/use-schema';

// ── Props ────────────────────────────────────────────────────────────────────

interface SchemaExplorerProps {
  onSelectTable?: (table: Table) => void;
  selectedTableId?: string | null;
  onAddTable?: () => void;
  onDeleteTable?: (table: Table) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SchemaExplorer({
  onSelectTable,
  selectedTableId,
  onAddTable,
  onDeleteTable,
}: SchemaExplorerProps) {
  const { projectId } = useParams();
  const { data: tables, isLoading } = useTables(projectId);
  const { data: schemasList } = useSchemas(projectId);
  const createSchemaM = useCreateSchema();
  const renameSchemaM = useRenameSchema();
  const deleteSchemaM = useDeleteSchema();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'table' | 'view'>('all');
  const [showNewSchema, setShowNewSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');

  // Filter tables by search and type
  const filteredTables = (tables ?? []).filter((table) => {
    const matchesSearch = table.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === 'all' || table.type.toLowerCase() === filterType;
    return matchesSearch && matchesType;
  });

  // Group tables by schema — include all known schemas even if empty
  const groupedBySchema = filteredTables.reduce<Record<string, Table[]>>(
    (acc, table) => {
      const schema = table.schema || 'public';
      if (!acc[schema]) acc[schema] = [];
      acc[schema].push(table);
      return acc;
    },
    {}
  );

  // Merge API-known schemas (so empty schemas are shown)
  for (const s of schemasList ?? []) {
    if (!groupedBySchema[s]) groupedBySchema[s] = [];
  }

  const schemas = Object.keys(groupedBySchema).sort();

  const handleCreateSchema = () => {
    if (!projectId || !newSchemaName.trim()) return;
    createSchemaM.mutate(
      { projectId, schemaName: newSchemaName.trim() },
      {
        onSuccess: () => {
          setShowNewSchema(false);
          setNewSchemaName('');
          toast.success(`Schema "${newSchemaName.trim()}" created`);
        },
        onError: () => toast.error('Failed to create schema'),
      }
    );
  };

  const handleRenameSchema = (oldName: string, newName: string) => {
    if (!projectId || !newName.trim() || oldName === newName) return;
    renameSchemaM.mutate(
      { projectId, oldName, newName: newName.trim() },
      {
        onSuccess: () => toast.success(`Schema renamed to "${newName.trim()}"`),
        onError: () => toast.error('Failed to rename schema'),
      }
    );
  };

  const handleDeleteSchema = (schemaName: string) => {
    if (!projectId) return;
    deleteSchemaM.mutate(
      { projectId, schemaName },
      {
        onSuccess: () => toast.success(`Schema "${schemaName}" deleted`),
        onError: () => toast.error('Failed to delete schema'),
      }
    );
  };

  const tableCount = (tables ?? []).filter(
    (t) => t.type.toLowerCase() !== 'view'
  ).length;
  const viewCount = (tables ?? []).filter(
    (t) => t.type.toLowerCase() === 'view'
  ).length;

  const toggleExpanded = (tableId: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Schema Explorer
          </h3>
          <div className="flex items-center gap-1.5">
            {tables && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-aqua-50 text-aqua-700 rounded-full">
                {tables.length}
              </span>
            )}
            {onAddTable && (
              <button
                onClick={onAddTable}
                className="p-1 rounded-md text-aqua-600 hover:bg-aqua-50 transition-colors"
                title="Create table"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(
            [
              { key: 'all' as const, label: 'All', count: (tables ?? []).length, icon: Filter },
              { key: 'table' as const, label: 'Tables', count: tableCount, icon: LayoutGrid },
              { key: 'view' as const, label: 'Views', count: viewCount, icon: Eye },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors',
                filterType === tab.key
                  ? 'bg-aqua-100 text-aqua-700'
                  : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              <tab.icon className="w-2.5 h-2.5" />
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* ── Tree Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-aqua-500 animate-spin mb-2" />
            <p className="text-xs text-muted-foreground">Loading schema...</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && filteredTables.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
              <FolderTree className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? 'No tables match your search.'
                : 'No tables discovered yet.'}
            </p>
            {!searchQuery && onAddTable && (
              <button
                onClick={onAddTable}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Create Table
              </button>
            )}
            {!searchQuery && !onAddTable && (
              <p className="text-xs text-muted-foreground mt-1">
                Upload SQL files to populate the schema explorer.
              </p>
            )}
          </div>
        )}

        {/* Tree */}
        {!isLoading &&
          schemas.map((schema) => (
            <SchemaGroup
              key={schema}
              schemaName={schema}
              tables={groupedBySchema[schema]}
              expandedTables={expandedTables}
              selectedTableId={selectedTableId}
              onToggle={toggleExpanded}
              onSelectTable={onSelectTable}
              onDeleteTable={onDeleteTable}
              onRenameSchema={handleRenameSchema}
              onDeleteSchema={handleDeleteSchema}
            />
          ))}

        {/* Create Schema */}
        {!isLoading && (
          <div className="mt-2 px-2">
            {showNewSchema ? (
              <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 rounded-md border border-slate-200">
                <input
                  type="text"
                  value={newSchemaName}
                  onChange={(e) => setNewSchemaName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSchema()}
                  placeholder="schema_name"
                  className="flex-1 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-slate-400"
                  autoFocus
                />
                <button
                  onClick={handleCreateSchema}
                  disabled={!newSchemaName.trim()}
                  className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50 disabled:text-slate-300"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => { setShowNewSchema(false); setNewSchemaName(''); }}
                  className="p-0.5 rounded text-slate-400 hover:bg-slate-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewSchema(true)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-medium text-aqua-600 hover:text-aqua-700 hover:bg-aqua-50/50 rounded-md transition-colors"
              >
                <FolderPlus className="w-3 h-3" />
                Add Schema
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Schema Group ─────────────────────────────────────────────────────────────

function SchemaGroup({
  schemaName,
  tables,
  expandedTables,
  selectedTableId,
  onToggle,
  onSelectTable,
  onDeleteTable,
  onRenameSchema,
  onDeleteSchema,
}: {
  schemaName: string;
  tables: Table[];
  expandedTables: Set<string>;
  selectedTableId?: string | null;
  onToggle: (tableId: string) => void;
  onSelectTable?: (table: Table) => void;
  onDeleteTable?: (table: Table) => void;
  onRenameSchema?: (oldName: string, newName: string) => void;
  onDeleteSchema?: (schemaName: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(schemaName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const schemaTableCount = tables.filter(
    (t) => t.type.toLowerCase() !== 'view'
  ).length;
  const schemaViewCount = tables.filter(
    (t) => t.type.toLowerCase() === 'view'
  ).length;

  const isPublic = schemaName === 'public';

  return (
    <div className="mb-1">
      {/* Schema header */}
      <div className="flex items-center group/schema">
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1 px-2 py-1.5">
            <Hash className="w-3 h-3 text-slate-400" />
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRenameSchema?.(schemaName, renameValue);
                  setIsRenaming(false);
                } else if (e.key === 'Escape') {
                  setIsRenaming(false);
                  setRenameValue(schemaName);
                }
              }}
              className="flex-1 text-[10px] font-semibold uppercase bg-transparent border-b border-aqua-400 outline-none text-slate-700"
              autoFocus
            />
            <button
              onClick={() => { onRenameSchema?.(schemaName, renameValue); setIsRenaming(false); }}
              className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => { setIsRenaming(false); setRenameValue(schemaName); }}
              className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 flex-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors rounded hover:bg-slate-50"
            >
              {expanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <Hash className="w-3 h-3" />
              {schemaName}
              <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 font-normal">
                {schemaTableCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <LayoutGrid className="w-2.5 h-2.5" />
                    {schemaTableCount}
                  </span>
                )}
                {schemaViewCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Eye className="w-2.5 h-2.5" />
                    {schemaViewCount}
                  </span>
                )}
              </span>
            </button>
            {/* Schema actions - visible on hover */}
            {!isPublic && (
              <div className="opacity-0 group-hover/schema:opacity-100 flex items-center gap-0.5 pr-1 transition-opacity">
                <button
                  onClick={() => { setRenameValue(schemaName); setIsRenaming(true); }}
                  className="p-0.5 rounded text-slate-400 hover:text-aqua-600 hover:bg-aqua-50 transition-colors"
                  title="Rename schema"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete schema"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="mx-2 mb-1 px-2 py-2 bg-red-50 border border-red-200 rounded-md text-xs">
          <p className="text-red-700 mb-1.5">
            Delete schema "{schemaName}" and {tables.length} table{tables.length !== 1 ? 's' : ''}?
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onDeleteSchema?.(schemaName); setShowDeleteConfirm(false); }}
              className="px-2 py-1 text-[10px] font-medium text-white bg-red-500 rounded hover:bg-red-600"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-card border border-slate-200 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tables in this schema */}
      {expanded && (
        <div className="ml-2">
          {tables.map((table) => (
            <TableTreeItem
              key={table.id}
              table={table}
              isExpanded={expandedTables.has(table.id)}
              isSelected={table.id === selectedTableId}
              onToggle={() => onToggle(table.id)}
              onSelect={() => onSelectTable?.(table)}
              onDeleteTable={onDeleteTable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Table Tree Item ──────────────────────────────────────────────────────────

function TableTreeItem({
  table,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onDeleteTable,
}: {
  table: Table;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDeleteTable?: (table: Table) => void;
}) {
  const isView = table.type.toLowerCase() === 'view';
  const hasPK = table.columns.some((c) => c.isPrimaryKey);
  const hasFK = table.columns.some((c) => c.isForeignKey);
  const hasIndexes = table.indexes.length > 0;

  // Health: green = has PK + indexes, amber = has PK only, red = no PK
  const healthColor =
    isView
      ? 'bg-sky-400'
      : hasPK && hasIndexes
        ? 'bg-emerald-500'
        : hasPK
          ? 'bg-amber-500'
          : 'bg-red-400';

  const healthTitle = isView
    ? 'View'
    : hasPK && hasIndexes
      ? 'Healthy: has primary key and indexes'
      : hasPK
        ? 'Warning: has primary key but no indexes'
        : 'Issue: no primary key defined';

  return (
    <div className="mb-0.5 group/item">
      {/* Table row */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          isSelected
            ? 'bg-aqua-50 text-aqua-700'
            : 'hover:bg-slate-100 text-slate-700'
        )}
      >
        {/* Expand toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-0.5 rounded hover:bg-slate-200 transition-colors flex-shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-slate-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400" />
          )}
        </button>

        {/* Health indicator dot */}
        <div
          className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', healthColor)}
          title={healthTitle}
        />

        {/* Table name */}
        <button
          onClick={onSelect}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          {isView ? (
            <Eye
              className={cn(
                'w-3.5 h-3.5 flex-shrink-0',
                isSelected ? 'text-aqua-600' : 'text-slate-400'
              )}
            />
          ) : (
            <Table2
              className={cn(
                'w-3.5 h-3.5 flex-shrink-0',
                isSelected ? 'text-aqua-600' : 'text-slate-400'
              )}
            />
          )}
          <span className="text-xs font-medium truncate">{table.name}</span>
          {/* Column count + FK indicator */}
          <span className="ml-auto flex items-center gap-1 flex-shrink-0">
            {hasFK && (
              <Link className="w-2.5 h-2.5 text-blue-400" />
            )}
            <span className="text-[10px] text-slate-400">
              {table.columns.length}
            </span>
          </span>
        </button>

        {/* Delete button - visible on hover */}
        {onDeleteTable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTable(table);
            }}
            className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Delete table"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Expanded columns */}
      {isExpanded && (
        <div className="ml-6 border-l border-slate-200 pl-2 py-0.5">
          {table.columns.length === 0 ? (
            <p className="px-2 py-1 text-[10px] text-slate-400 italic">
              No columns
            </p>
          ) : (
            table.columns.map((col) => (
              <ColumnTreeItem key={col.id || col.name} column={col} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Column Tree Item ─────────────────────────────────────────────────────────

function ColumnTreeItem({ column }: { column: Column }) {
  const typeColor = getTypeColor(column.dataType);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 rounded hover:bg-slate-50 transition-colors">
      {/* Icon */}
      {column.isPrimaryKey ? (
        <Key className="w-3 h-3 text-amber-500 flex-shrink-0" />
      ) : column.isForeignKey ? (
        <Link className="w-3 h-3 text-blue-500 flex-shrink-0" />
      ) : (
        <Type className="w-3 h-3 text-slate-400 flex-shrink-0" />
      )}

      {/* Name */}
      <span
        className={cn(
          'truncate',
          column.isPrimaryKey && 'font-semibold text-slate-800'
        )}
      >
        {column.name}
      </span>

      {/* Nullable indicator */}
      {column.nullable && (
        <span className="text-[9px] text-slate-400 flex-shrink-0" title="Nullable">
          ?
        </span>
      )}

      {/* Data type badge */}
      <span
        className={cn(
          'ml-auto text-[9px] px-1 py-0.5 rounded font-mono flex-shrink-0',
          typeColor
        )}
      >
        {column.dataType}
      </span>
    </div>
  );
}

// ── Type Color Helper ────────────────────────────────────────────────────────

function getTypeColor(dataType: string): string {
  const dt = dataType.toUpperCase();
  if (/INT|SERIAL|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|NUMBER|BIGINT|SMALLINT/.test(dt))
    return 'bg-blue-50 text-blue-600';
  if (/VARCHAR|TEXT|CHAR|STRING|NVARCHAR|CLOB/.test(dt))
    return 'bg-emerald-50 text-emerald-600';
  if (/DATE|TIME|TIMESTAMP|INTERVAL|DATETIME/.test(dt))
    return 'bg-purple-50 text-purple-600';
  if (/BOOL/.test(dt))
    return 'bg-amber-50 text-amber-600';
  if (/UUID/.test(dt))
    return 'bg-cyan-50 text-cyan-600';
  if (/JSON|JSONB/.test(dt))
    return 'bg-pink-50 text-pink-600';
  if (/ARRAY|ENUM|SET/.test(dt))
    return 'bg-indigo-50 text-indigo-600';
  if (/BLOB|BINARY|BYTEA|IMAGE/.test(dt))
    return 'bg-orange-50 text-orange-600';
  return 'bg-slate-50 text-slate-500';
}
