import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Database,
  Search,
  Table2,
  Key,
  Link2,
  ChevronDown,
  Columns3,
  Hash,
  Type,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTables, type Table, type Column } from '@/hooks/use-schema';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchemaReferencePanelProps {
  projectId: string;
  onInsertText: (text: string) => void;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function HighlightedText({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-amber-100 dark:bg-amber-900/40 rounded px-0.5">
        {text.slice(idx, idx + term.length)}
      </span>
      {text.slice(idx + term.length)}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SchemaReferencePanel({
  projectId,
  onInsertText,
  className,
}: SchemaReferencePanelProps) {
  const { data: tables, isLoading } = useTables(projectId);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [flashedItem, setFlashedItem] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toggle ────────────────────────────────────────────────────────────────

  const toggleTable = useCallback((tableName: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  }, []);

  // ── Expand / Collapse All ─────────────────────────────────────────────────

  const expandAll = useCallback(() => {
    if (!tables) return;
    setExpandedTables(new Set(tables.map(t => t.name)));
  }, [tables]);

  const collapseAll = useCallback(() => {
    setExpandedTables(new Set());
  }, []);

  // ── Insert with flash feedback ────────────────────────────────────────────

  const handleInsert = useCallback(
    (text: string, itemKey: string) => {
      onInsertText(text);
      setFlashedItem(itemKey);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setFlashedItem(null), 600);
    },
    [onInsertText],
  );

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredTables = useMemo(() => {
    if (!tables) return [];
    if (!searchTerm) return tables;
    const term = searchTerm.toLowerCase();
    return tables.filter(
      t =>
        t.name.toLowerCase().includes(term) ||
        t.columns.some(c => c.name.toLowerCase().includes(term)),
    );
  }, [tables, searchTerm]);

  const autoExpandedTables = useMemo(() => {
    if (!searchTerm) return expandedTables;
    const expanded = new Set(expandedTables);
    filteredTables.forEach(t => {
      if (
        t.columns.some(c =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      ) {
        expanded.add(t.name);
      }
    });
    return expanded;
  }, [filteredTables, searchTerm, expandedTables]);

  // ── Loading State ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-3 p-3', className)}>
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Schema Reference</span>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-2 py-2">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-3 bg-muted rounded flex-1" />
            <div className="h-3 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  // ── Empty State ───────────────────────────────────────────────────────────

  if (!tables || tables.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-6 text-center',
          className,
        )}
      >
        <Database className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            No schema loaded
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Upload a SQL file in Schema Intelligence to get started
          </p>
        </div>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Schema Reference</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tables & columns..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table Count */}
      <div className="px-3 pb-1">
        <span className="text-xs text-muted-foreground">
          {filteredTables.length} table{filteredTables.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {filteredTables.length === 0 && searchTerm && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              No tables or columns match "{searchTerm}"
            </p>
          </div>
        )}

        {filteredTables.map(table => {
          const isExpanded = autoExpandedTables.has(table.name);
          const tableKey = `table:${table.name}`;

          return (
            <div key={table.id} className="mx-1 mb-0.5">
              {/* Table Header */}
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                  'hover:bg-secondary/70',
                  flashedItem === tableKey &&
                    'bg-primary/10 ring-1 ring-primary/30',
                )}
                onClick={() => toggleTable(table.name)}
                onDoubleClick={() =>
                  handleInsert(table.name, tableKey)
                }
                onMouseDown={e => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    handleInsert(table.name, tableKey);
                  }
                }}
                title="Click to expand. Double-click or Ctrl+click to insert table name."
              >
                <Table2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold truncate flex-1">
                  <HighlightedText text={table.name} term={searchTerm} />
                </span>
                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full shrink-0">
                  {table.columns.length} col{table.columns.length !== 1 ? 's' : ''}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )}
                />
              </button>

              {/* Column List */}
              {isExpanded && (
                <div className="ml-3 border-l border-border/50 pl-1 mt-0.5 mb-1">
                  {table.columns.map((col, colIdx) => {
                    const colKey = `col:${table.name}.${col.name}`;
                    const isLast = colIdx === table.columns.length - 1;

                    return (
                      <button
                        key={col.id}
                        type="button"
                        className={cn(
                          'w-full flex items-center gap-1.5 px-2 py-1 rounded text-left transition-all duration-150',
                          'hover:bg-secondary/50',
                          flashedItem === colKey &&
                            'bg-primary/10 ring-1 ring-primary/30',
                        )}
                        onClick={() =>
                          handleInsert(
                            `${table.name}.${col.name}`,
                            colKey,
                          )
                        }
                        title={`Click to insert ${table.name}.${col.name}`}
                      >
                        {/* Tree connector */}
                        <span className="text-border text-[10px] w-2 shrink-0 select-none">
                          {isLast ? '\u2514' : '\u251C'}
                        </span>

                        {/* Column name */}
                        <span className="font-mono text-xs truncate flex-1 min-w-0">
                          <HighlightedText
                            text={col.name}
                            term={searchTerm}
                          />
                        </span>

                        {/* Data type */}
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px] shrink-0">
                          {col.dataType}
                        </span>

                        {/* Icons */}
                        <span className="flex items-center gap-0.5 shrink-0">
                          {col.isPrimaryKey && (
                            <Key
                              className="h-3 w-3 text-amber-500"
                              aria-label="Primary Key"
                            />
                          )}
                          {col.isForeignKey && (
                            <Link2
                              className="h-3 w-3 text-blue-500"
                              aria-label="Foreign Key"
                            />
                          )}
                          {col.nullable && (
                            <span
                              className="text-[10px] text-slate-400 font-medium leading-none"
                              aria-label="Nullable"
                            >
                              ?
                            </span>
                          )}
                        </span>
                      </button>
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

export default SchemaReferencePanel;
