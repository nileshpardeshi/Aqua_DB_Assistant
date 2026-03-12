import { useState, useMemo, useCallback } from 'react';
import {
  Table,
  Rows3,
  DatabaseZap,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  CheckCircle2,
  FileJson,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueryResultsTableProps {
  columns: string[];
  rows: unknown[][];
  className?: string;
}

export function QueryResultsTable({
  columns,
  rows,
  className,
}: QueryResultsTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedCell, setExpandedCell] = useState<{ row: number; col: number } | null>(null);

  const handleSort = useCallback(
    (colIdx: number) => {
      if (sortCol === colIdx) {
        if (sortDir === 'asc') {
          setSortDir('desc');
        } else if (sortDir === 'desc') {
          setSortCol(null);
          setSortDir(null);
        }
      } else {
        setSortCol(colIdx);
        setSortDir('asc');
      }
      setPage(0);
    },
    [sortCol, sortDir],
  );

  const sortedRows = useMemo(() => {
    if (sortCol === null || sortDir === null) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }
      return sortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const paginatedRows = useMemo(
    () => sortedRows.slice(page * pageSize, (page + 1) * pageSize),
    [sortedRows, page, pageSize],
  );

  const handleExportCSV = useCallback(() => {
    const csvLines = [columns.join(',')];
    for (const row of sortedRows) {
      csvLines.push(
        row
          .map((cell) => {
            const str = String(cell ?? '');
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(','),
      );
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, sortedRows]);

  const handleExportJSON = useCallback(() => {
    const data = sortedRows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, sortedRows]);

  const handleCopyAll = useCallback(() => {
    const tsv = [
      columns.join('\t'),
      ...sortedRows.map((row) => row.map((c) => String(c ?? '')).join('\t')),
    ].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [columns, sortedRows]);

  if (columns.length === 0 && rows.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 px-4',
          className,
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <DatabaseZap className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          No results yet
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Write a SQL query and click Run or press Ctrl+Enter to see results
          here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Result Info Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Rows3 className="w-3.5 h-3.5" />
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
          <span className="flex items-center gap-1.5">
            <Table className="w-3.5 h-3.5" />
            {columns.length} {columns.length === 1 ? 'column' : 'columns'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 px-2 py-1 bg-card rounded border border-border/50 hover:bg-slate-100 transition-colors"
          >
            {copiedAll ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy All
              </>
            )}
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 px-2 py-1 bg-card rounded border border-border/50 hover:bg-slate-100 transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 px-2 py-1 bg-card rounded border border-border/50 hover:bg-slate-100 transition-colors"
          >
            <FileJson className="w-3 h-3" />
            JSON
          </button>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b border-border">
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 border-r border-border/50 w-12">
                #
              </th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => handleSort(idx)}
                  className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 border-r border-border/50 last:border-r-0 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors select-none group"
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === idx ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-aqua-600" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-aqua-600" />
                      )
                    ) : (
                      <ArrowUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIdx) => {
              const globalRowIdx = page * pageSize + rowIdx;
              return (
                <tr
                  key={globalRowIdx}
                  className={cn(
                    'border-b border-border/30 hover:bg-aqua-50/30 transition-colors',
                    rowIdx % 2 === 0 ? 'bg-card' : 'bg-slate-50/50',
                  )}
                >
                  <td className="px-3 py-1.5 text-xs text-slate-400 font-mono border-r border-border/30 tabular-nums">
                    {globalRowIdx + 1}
                  </td>
                  {row.map((cell, cellIdx) => {
                    const cellStr = String(cell ?? '');
                    const isExpanded =
                      expandedCell?.row === globalRowIdx &&
                      expandedCell?.col === cellIdx;
                    return (
                      <td
                        key={cellIdx}
                        onClick={() =>
                          setExpandedCell(
                            isExpanded
                              ? null
                              : { row: globalRowIdx, col: cellIdx },
                          )
                        }
                        className={cn(
                          'px-3 py-1.5 text-xs text-foreground font-mono border-r border-border/30 last:border-r-0 cursor-pointer',
                          isExpanded
                            ? 'whitespace-pre-wrap break-all bg-aqua-50/50'
                            : 'whitespace-nowrap max-w-[300px] truncate',
                        )}
                        title={isExpanded ? undefined : cellStr}
                      >
                        {cell === null || cell === undefined ? (
                          <span className="text-slate-400 italic">NULL</span>
                        ) : (
                          cellStr
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {rows.length > 25 && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page:</span>
            {[25, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size);
                  setPage(0);
                }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                  pageSize === size
                    ? 'bg-aqua-50 text-aqua-700 border border-aqua-300'
                    : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, rows.length)} of {rows.length}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QueryResultsTable;
