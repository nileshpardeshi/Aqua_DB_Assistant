import { useState, useMemo, useCallback } from 'react';
import {
  Columns3,
  Plus,
  Minus,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  Filter,
  FileCode2,
  Database,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTables } from '@/hooks/use-schema';

// ── Types ──────────────────────────────────────────────────────────────────────

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

type SourceMode = 'project' | 'paste';
type FilterOption = 'all' | 'added' | 'modified' | 'removed';

interface SchemaComparisonProps {
  projectId?: string;
}

// ── Diff computation ───────────────────────────────────────────────────────────

function computeTableDiffs(
  source: TableDef[],
  target: TableDef[]
): TableDiff[] {
  const diffs: TableDiff[] = [];
  const sourceNames = new Set(source.map((t) => t.name));

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

// ── DDL Parser ─────────────────────────────────────────────────────────────────

function parseDDL(ddl: string): TableDef[] {
  const tables: TableDef[] = [];
  // Match CREATE TABLE statements (with optional schema prefix, IF NOT EXISTS, and quoted names)
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi;

  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(ddl)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: ColumnDef[] = [];
    const primaryKeyColumns = new Set<string>();

    // Extract table-level PRIMARY KEY constraints first
    const pkConstraintRegex =
      /(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/gi;
    let pkMatch: RegExpExecArray | null;
    while ((pkMatch = pkConstraintRegex.exec(body)) !== null) {
      const pkCols = pkMatch[1].split(',').map((c) => c.trim().replace(/["`]/g, ''));
      pkCols.forEach((col) => primaryKeyColumns.add(col.toLowerCase()));
    }

    // Split body into lines and process each column definition
    const lines = body.split(',').map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      // Skip constraint lines (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, INDEX, KEY)
      if (
        /^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|INDEX|KEY|CONSTRAINT)\s/i.test(
          line
        )
      ) {
        continue;
      }

      // Parse column: name TYPE [NOT NULL] [DEFAULT value] [PRIMARY KEY]
      const colRegex =
        /^["`]?(\w+)["`]?\s+([\w]+(?:\s*\([^)]*\))?(?:\s+(?:UNSIGNED|SIGNED|VARYING|PRECISION|WITHOUT\s+TIME\s+ZONE|WITH\s+TIME\s+ZONE))*)(.*)/i;
      const colMatch = colRegex.exec(line);
      if (!colMatch) continue;

      const colName = colMatch[1];
      const colType = colMatch[2].trim().toUpperCase();
      const rest = colMatch[3] || '';

      const isNotNull = /NOT\s+NULL/i.test(rest);
      const isInlinePK = /PRIMARY\s+KEY/i.test(rest);
      const isPK =
        isInlinePK || primaryKeyColumns.has(colName.toLowerCase());

      let defaultValue: string | undefined;
      const defaultMatch = /DEFAULT\s+('(?:[^']*)'|"(?:[^"]*)"|[^\s,]+)/i.exec(rest);
      if (defaultMatch) {
        defaultValue = defaultMatch[1];
      }

      columns.push({
        name: colName,
        type: colType,
        nullable: !isNotNull && !isPK,
        defaultValue,
        isPrimaryKey: isPK,
      });
    }

    if (columns.length > 0) {
      // Mark columns that are part of table-level PK
      for (const col of columns) {
        if (primaryKeyColumns.has(col.name.toLowerCase())) {
          col.isPrimaryKey = true;
          col.nullable = false;
        }
      }
      tables.push({ name: tableName, columns });
    }
  }

  return tables;
}

// ── ALTER statement generation ──────────────────────────────────────────────────

function generateAlterStatements(diffs: TableDiff[]): string {
  const statements: string[] = [];

  for (const table of diffs) {
    if (table.status === 'added') {
      // Generate CREATE TABLE
      const colDefs = table.columns.map((col) => {
        const type = col.targetType || 'TEXT';
        const nullable = col.targetNullable === false ? ' NOT NULL' : '';
        const def = col.targetDefault ? ` DEFAULT ${col.targetDefault}` : '';
        return `  ${col.name} ${type}${nullable}${def}`;
      });
      statements.push(
        `-- Create new table: ${table.name}`,
        `CREATE TABLE ${table.name} (`,
        colDefs.join(',\n'),
        ');',
        ''
      );
    } else if (table.status === 'removed') {
      statements.push(
        `-- Drop removed table: ${table.name}`,
        `DROP TABLE IF EXISTS ${table.name};`,
        ''
      );
    } else if (table.status === 'modified') {
      const colStatements: string[] = [];

      for (const col of table.columns) {
        if (col.status === 'added') {
          const type = col.targetType || 'TEXT';
          const nullable = col.targetNullable === false ? ' NOT NULL' : '';
          const def = col.targetDefault ? ` DEFAULT ${col.targetDefault}` : '';
          colStatements.push(
            `ALTER TABLE ${table.name} ADD COLUMN ${col.name} ${type}${nullable}${def};`
          );
        } else if (col.status === 'removed') {
          colStatements.push(
            `ALTER TABLE ${table.name} DROP COLUMN ${col.name};`
          );
        } else if (col.status === 'modified') {
          const type = col.targetType || col.sourceType || 'TEXT';
          const nullable = col.targetNullable === false ? ' NOT NULL' : '';
          const def = col.targetDefault ? ` DEFAULT ${col.targetDefault}` : '';
          colStatements.push(
            `ALTER TABLE ${table.name} ALTER COLUMN ${col.name} TYPE ${type}${nullable}${def};`
          );
        }
      }

      if (colStatements.length > 0) {
        statements.push(`-- Modify table: ${table.name}`);
        statements.push(...colStatements);
        statements.push('');
      }
    }
  }

  return statements.join('\n');
}

// ── Styles / Icons ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DiffStatus, { bg: string; text: string; badge: string }> = {
  added: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  removed: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  modified: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  unchanged: { bg: 'bg-card', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-500' },
};

const STATUS_ICONS: Record<DiffStatus, React.ComponentType<{ className?: string }>> = {
  added: Plus,
  removed: Minus,
  modified: RefreshCw,
  unchanged: Columns3,
};

// ── Component ──────────────────────────────────────────────────────────────────

export function SchemaComparison({ projectId }: SchemaComparisonProps) {
  // Source mode: use project schema or paste DDL
  const [sourceMode, setSourceMode] = useState<SourceMode>(projectId ? 'project' : 'paste');

  // DDL textareas
  const [sourceDDL, setSourceDDL] = useState('');
  const [targetDDL, setTargetDDL] = useState('');

  // Parsed schemas
  const [parsedSource, setParsedSource] = useState<TableDef[]>([]);
  const [parsedTarget, setParsedTarget] = useState<TableDef[]>([]);
  const [hasCompared, setHasCompared] = useState(false);

  // UI state
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [copiedAlter, setCopiedAlter] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Fetch project tables as source when in project mode
  const { data: projectTables, isLoading: tablesLoading } = useTables(
    sourceMode === 'project' ? projectId : undefined
  );

  // Convert project Table[] to TableDef[]
  const projectTableDefs: TableDef[] = useMemo(() => {
    if (!projectTables) return [];
    return projectTables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.dataType,
        nullable: c.nullable,
        defaultValue: c.defaultValue ?? undefined,
        isPrimaryKey: c.isPrimaryKey,
      })),
    }));
  }, [projectTables]);

  // Determine effective source and target
  const effectiveSource = sourceMode === 'project' ? projectTableDefs : parsedSource;
  const effectiveTarget = parsedTarget;

  // Compute diffs
  const tableDiffs = useMemo(() => {
    if (sourceMode === 'project') {
      // In project mode, diff is live as soon as we have both project tables and target
      if (projectTableDefs.length === 0 && effectiveTarget.length === 0) return [];
      return computeTableDiffs(projectTableDefs, effectiveTarget);
    }
    // In paste mode, only show diffs after user clicks Compare
    if (!hasCompared) return [];
    return computeTableDiffs(effectiveSource, effectiveTarget);
  }, [sourceMode, projectTableDefs, effectiveSource, effectiveTarget, hasCompared]);

  // Filter diffs
  const filteredDiffs = useMemo(() => {
    if (filterOption === 'all') return tableDiffs;
    return tableDiffs.filter((t) => t.status === filterOption);
  }, [tableDiffs, filterOption]);

  const stats = useMemo(() => {
    const added = tableDiffs.filter((t) => t.status === 'added').length;
    const removed = tableDiffs.filter((t) => t.status === 'removed').length;
    const modified = tableDiffs.filter((t) => t.status === 'modified').length;
    const unchanged = tableDiffs.filter((t) => t.status === 'unchanged').length;
    return { added, removed, modified, unchanged };
  }, [tableDiffs]);

  const toggleExpand = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Parse DDL and trigger comparison
  const handleCompare = useCallback(() => {
    if (sourceMode === 'paste') {
      setParsedSource(parseDDL(sourceDDL));
    }
    setParsedTarget(parseDDL(targetDDL));
    setHasCompared(true);
    setExpandedTables(new Set());
  }, [sourceMode, sourceDDL, targetDDL]);

  // Parse target DDL only (project mode)
  const handleCompareTarget = useCallback(() => {
    setParsedTarget(parseDDL(targetDDL));
    setHasCompared(true);
    setExpandedTables(new Set());
  }, [targetDDL]);

  // Generate ALTER statements
  const alterStatements = useMemo(() => {
    if (tableDiffs.length === 0) return '';
    return generateAlterStatements(tableDiffs);
  }, [tableDiffs]);

  // Download ALTER statements
  const handleDownloadAlter = useCallback(() => {
    if (!alterStatements) return;
    const blob = new Blob([alterStatements], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migration_alter_statements.sql';
    a.click();
    URL.revokeObjectURL(url);
  }, [alterStatements]);

  // Copy ALTER statements
  const handleCopyAlter = useCallback(() => {
    if (!alterStatements) return;
    navigator.clipboard.writeText(alterStatements);
    setCopiedAlter(true);
    setTimeout(() => setCopiedAlter(false), 2000);
  }, [alterStatements]);

  // Export diff as JSON
  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(tableDiffs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema_diff.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [tableDiffs]);

  // Copy diff JSON
  const handleCopyJson = useCallback(() => {
    const json = JSON.stringify(tableDiffs, null, 2);
    navigator.clipboard.writeText(json);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }, [tableDiffs]);

  // Loading skeleton
  if (sourceMode === 'project' && tablesLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex gap-3">
          <div className="h-9 w-36 bg-slate-200 rounded-lg" />
          <div className="h-9 w-36 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-32 bg-slate-100 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        {projectId && (
          <button
            onClick={() => {
              setSourceMode('project');
              setHasCompared(false);
            }}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              sourceMode === 'project'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            )}
          >
            <Database className="w-4 h-4" />
            Project Schema
          </button>
        )}
        <button
          onClick={() => {
            setSourceMode('paste');
            setHasCompared(false);
          }}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
            sourceMode === 'paste'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          )}
        >
          <Upload className="w-4 h-4" />
          Paste DDL
        </button>
      </div>

      {/* Input Area */}
      {sourceMode === 'project' ? (
        <div className="space-y-3">
          {/* Project schema info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <Database className="w-4 h-4 flex-shrink-0" />
            <span>
              Source: <strong>{projectTableDefs.length}</strong> tables loaded from project schema
            </span>
          </div>

          {/* Target DDL input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Target DDL (paste the schema you want to migrate to)
            </label>
            <textarea
              value={targetDDL}
              onChange={(e) => setTargetDDL(e.target.value)}
              placeholder={`CREATE TABLE users (\n  id BIGINT NOT NULL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(320) NOT NULL,\n  created_at TIMESTAMP DEFAULT NOW()\n);`}
              className="w-full h-44 px-3 py-2.5 bg-[#1e293b] text-slate-100 font-mono text-sm rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y placeholder:text-slate-500"
              spellCheck={false}
            />
          </div>

          <button
            onClick={handleCompareTarget}
            disabled={!targetDDL.trim()}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              targetDDL.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            <RefreshCw className="w-4 h-4" />
            Compare Schemas
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Source DDL */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Source DDL (current schema)
              </label>
              <textarea
                value={sourceDDL}
                onChange={(e) => setSourceDDL(e.target.value)}
                placeholder={`CREATE TABLE users (\n  id INT NOT NULL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) NOT NULL\n);`}
                className="w-full h-44 px-3 py-2.5 bg-[#1e293b] text-slate-100 font-mono text-sm rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y placeholder:text-slate-500"
                spellCheck={false}
              />
            </div>

            {/* Target DDL */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Target DDL (desired schema)
              </label>
              <textarea
                value={targetDDL}
                onChange={(e) => setTargetDDL(e.target.value)}
                placeholder={`CREATE TABLE users (\n  id BIGINT NOT NULL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(320) NOT NULL,\n  phone VARCHAR(20)\n);`}
                className="w-full h-44 px-3 py-2.5 bg-[#1e293b] text-slate-100 font-mono text-sm rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y placeholder:text-slate-500"
                spellCheck={false}
              />
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={!sourceDDL.trim() && !targetDDL.trim()}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              sourceDDL.trim() || targetDDL.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            <RefreshCw className="w-4 h-4" />
            Compare Schemas
          </button>
        </div>
      )}

      {/* Results section */}
      {tableDiffs.length > 0 && (
        <>
          {/* Summary + Actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-200">
            {/* Summary badges */}
            <div className="flex items-center gap-3 flex-wrap">
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

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Filter dropdown */}
              <div className="relative">
                <select
                  value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value as FilterOption)}
                  className="appearance-none pl-7 pr-8 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="added">Added</option>
                  <option value="modified">Modified</option>
                  <option value="removed">Removed</option>
                </select>
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Export diff JSON */}
              <button
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                title="Export diff as JSON"
              >
                {copiedJson ? (
                  <>
                    <Copy className="w-3.5 h-3.5 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    JSON
                  </>
                )}
              </button>

              <button
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                title="Copy diff JSON to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy JSON
              </button>
            </div>
          </div>

          {/* Table Diffs */}
          <div className="space-y-3">
            {filteredDiffs.map((table) => {
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

            {filteredDiffs.length === 0 && tableDiffs.length > 0 && (
              <div className="text-center py-8 text-sm text-slate-400">
                No tables match the selected filter.
              </div>
            )}
          </div>

          {/* ALTER Statements Output */}
          {alterStatements && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileCode2 className="w-4 h-4" />
                  Generated ALTER Statements
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyAlter}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedAlter ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownloadAlter}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .sql
                  </button>
                </div>
              </div>
              <pre className="px-4 py-3 bg-[#1e293b] text-slate-100 font-mono text-sm rounded-lg overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
                {alterStatements}
              </pre>
            </div>
          )}
        </>
      )}

      {/* Empty state when no comparison has been done */}
      {tableDiffs.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-300 rounded-lg">
          <Columns3 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No schema comparison yet</p>
          <p className="text-xs text-slate-400 mt-1">
            {sourceMode === 'project'
              ? 'Paste your target DDL above and click "Compare Schemas" to see differences.'
              : 'Paste your source and target DDL above and click "Compare Schemas" to see differences.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default SchemaComparison;
