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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTables } from '@/hooks/use-schema';
import type { Table, Column } from '@/hooks/use-schema';

// ── Props ────────────────────────────────────────────────────────────────────

interface SchemaExplorerProps {
  onSelectTable?: (table: Table) => void;
  selectedTableId?: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SchemaExplorer({
  onSelectTable,
  selectedTableId,
}: SchemaExplorerProps) {
  const { projectId } = useParams();
  const { data: tables, isLoading } = useTables(projectId);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Filter tables by search
  const filteredTables = (tables ?? []).filter((table) =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group tables by schema
  const groupedBySchema = filteredTables.reduce<Record<string, Table[]>>(
    (acc, table) => {
      const schema = table.schema || 'public';
      if (!acc[schema]) acc[schema] = [];
      acc[schema].push(table);
      return acc;
    },
    {}
  );

  const schemas = Object.keys(groupedBySchema).sort();

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
          {tables && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-aqua-50 text-aqua-700 rounded-full">
              {tables.length}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-input rounded-lg bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
          />
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
            {!searchQuery && (
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
            />
          ))}
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
}: {
  schemaName: string;
  tables: Table[];
  expandedTables: Set<string>;
  selectedTableId?: string | null;
  onToggle: (tableId: string) => void;
  onSelectTable?: (table: Table) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-1">
      {/* Schema header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors rounded"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Hash className="w-3 h-3" />
        {schemaName}
        <span className="ml-auto text-[10px] text-slate-400 font-normal">
          {tables.length}
        </span>
      </button>

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
}: {
  table: Table;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="mb-0.5">
      {/* Table row */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors group',
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

        {/* Table name */}
        <button
          onClick={onSelect}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <Table2
            className={cn(
              'w-3.5 h-3.5 flex-shrink-0',
              isSelected ? 'text-aqua-600' : 'text-slate-400'
            )}
          />
          <span className="text-xs font-medium truncate">{table.name}</span>
          <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">
            {table.columns.length}
          </span>
        </button>
      </div>

      {/* Columns */}
      {isExpanded && (
        <div className="ml-6 border-l border-slate-200 pl-2 py-0.5">
          {table.columns.map((col) => (
            <ColumnTreeItem key={col.id || col.name} column={col} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Column Tree Item ─────────────────────────────────────────────────────────

function ColumnTreeItem({ column }: { column: Column }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600">
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

      {/* Type */}
      <span className="ml-auto text-[10px] text-slate-400 font-mono flex-shrink-0">
        {column.dataType}
      </span>
    </div>
  );
}
