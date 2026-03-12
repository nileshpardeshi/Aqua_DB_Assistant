import { Table, Rows3, DatabaseZap } from 'lucide-react';
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
  if (columns.length === 0 && rows.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 px-4',
          className
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <DatabaseZap className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          No results yet
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Write a SQL query and click Run or press Ctrl+Enter to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Result Info Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Rows3 className="w-3.5 h-3.5" />
          <span>
            {rows.length} {rows.length === 1 ? 'row' : 'rows'} returned
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Table className="w-3.5 h-3.5" />
          <span>
            {columns.length} {columns.length === 1 ? 'column' : 'columns'}
          </span>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-auto max-h-[400px]">
        <table className="w-full text-sm border-collapse min-w-max">
          {/* Sticky Header */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b border-border">
              {/* Row Number Column */}
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 border-r border-border/50 w-12">
                #
              </th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 border-r border-border/50 last:border-r-0 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={cn(
                  'border-b border-border/30 hover:bg-aqua-50/30 transition-colors',
                  rowIdx % 2 === 0 ? 'bg-card' : 'bg-slate-50/50'
                )}
              >
                {/* Row Number */}
                <td className="px-3 py-1.5 text-xs text-slate-400 font-mono border-r border-border/30 tabular-nums">
                  {rowIdx + 1}
                </td>
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-3 py-1.5 text-xs text-foreground font-mono border-r border-border/30 last:border-r-0 whitespace-nowrap max-w-[300px] truncate"
                    title={String(cell ?? '')}
                  >
                    {cell === null || cell === undefined ? (
                      <span className="text-slate-400 italic">NULL</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default QueryResultsTable;
