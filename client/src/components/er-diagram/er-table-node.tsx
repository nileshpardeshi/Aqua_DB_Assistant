import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Table2, Key, Link, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';
import type { Column } from '@/hooks/use-schema';

// ── Node Data Type ───────────────────────────────────────────────────────────

export interface ERTableNodeData {
  tableId: string;
  tableName: string;
  schema?: string;
  columns: Column[];
  estimatedRows?: number | null;
  indexCount: number;
}

// ── Component ────────────────────────────────────────────────────────────────

function ERTableNodeComponent({ data, selected }: NodeProps<ERTableNodeData>) {
  const showColumns = useERDiagramStore((s) => s.showColumns);

  const displayName = data.schema
    ? `${data.schema}.${data.tableName}`
    : data.tableName;

  const pkColumns = data.columns.filter((c) => c.isPrimaryKey);
  const regularColumns = data.columns.filter((c) => !c.isPrimaryKey);
  const sortedColumns = [...pkColumns, ...regularColumns];

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-md border-2 transition-all duration-200 min-w-[220px] max-w-[320px]',
        'hover:shadow-lg hover:scale-[1.02]',
        selected
          ? 'border-aqua-500 shadow-aqua-200/50'
          : 'border-slate-200 hover:border-aqua-300'
      )}
    >
      {/* ── Handles (all 4 sides) ─────────────────────────────────────── */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-top-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-bottom-1"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-left-1"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-right-1"
      />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="px-3 py-2.5 rounded-t-[10px] flex items-center justify-between gap-2"
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-4 h-4 text-white/90 flex-shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            {displayName}
          </span>
        </div>
        {data.estimatedRows != null && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded-full">
            {data.estimatedRows.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* ── Columns ───────────────────────────────────────────────────── */}
      {showColumns && sortedColumns.length > 0 && (
        <div className="max-h-[260px] overflow-y-auto">
          {sortedColumns.map((col, idx) => (
            <div
              key={col.id || col.name}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs',
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
              )}
            >
              {/* Key icon */}
              <span className="w-4 flex-shrink-0 flex items-center justify-center">
                {col.isPrimaryKey ? (
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                ) : col.isForeignKey ? (
                  <Link className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <span className="w-3.5" />
                )}
              </span>

              {/* Column name */}
              <span
                className={cn(
                  'flex-1 truncate',
                  col.isPrimaryKey
                    ? 'font-bold text-slate-800'
                    : 'text-slate-700'
                )}
              >
                {col.name}
              </span>

              {/* NOT NULL indicator */}
              {!col.nullable && (
                <span className="text-red-400 text-[10px] font-bold flex-shrink-0">
                  *
                </span>
              )}

              {/* Data type */}
              <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                {col.dataType}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Collapsed column indicator ────────────────────────────────── */}
      {!showColumns && sortedColumns.length > 0 && (
        <div className="px-3 py-2 text-xs text-slate-400 text-center">
          {sortedColumns.length} column{sortedColumns.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-t border-slate-100 rounded-b-[10px] flex items-center gap-2 bg-slate-50/50">
        <Hash className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] text-slate-400">
          {data.indexCount} index{data.indexCount !== 1 ? 'es' : ''}
        </span>
      </div>
    </div>
  );
}

export const ERTableNode = memo(ERTableNodeComponent);
