import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Table2, Key, Link, Hash, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';
import type { Column } from '@/hooks/use-schema';

// ── Schema Color Palette ────────────────────────────────────────────────────

const SCHEMA_COLORS: Record<string, { gradient: string; accent: string; ring: string }> = {
  public:   { gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)', accent: '#0891b2', ring: 'ring-cyan-400' },
  auth:     { gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', accent: '#7c3aed', ring: 'ring-violet-400' },
  billing:  { gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)', accent: '#059669', ring: 'ring-emerald-400' },
  analytics:{ gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', accent: '#d97706', ring: 'ring-amber-400' },
  audit:    { gradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', accent: '#dc2626', ring: 'ring-red-400' },
  hr:       { gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', accent: '#2563eb', ring: 'ring-blue-400' },
  inventory:{ gradient: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)', accent: '#db2777', ring: 'ring-pink-400' },
  config:   { gradient: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', accent: '#4f46e5', ring: 'ring-indigo-400' },
};

const DEFAULT_SCHEMA_COLOR = {
  gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
  accent: '#0891b2',
  ring: 'ring-cyan-400',
};

function getSchemaColor(schema?: string) {
  if (!schema) return DEFAULT_SCHEMA_COLOR;
  const lower = schema.toLowerCase();
  for (const [key, color] of Object.entries(SCHEMA_COLORS)) {
    if (lower.includes(key)) return color;
  }
  // Generate a consistent color from schema name hash
  const hash = lower.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palette = Object.values(SCHEMA_COLORS);
  return palette[hash % palette.length];
}

// ── Node Data Type ───────────────────────────────────────────────────────────

export interface ERTableNodeData {
  tableId: string;
  tableName: string;
  schema?: string;
  columns: Column[];
  estimatedRows?: number | null;
  indexCount: number;
  isCompact?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

function ERTableNodeComponent({ data, selected }: NodeProps<ERTableNodeData>) {
  const showColumns = useERDiagramStore((s) => s.showColumns);
  const colorBySchema = useERDiagramStore((s) => s.colorBySchema);
  const isCompact = data.isCompact;

  const displayName = data.schema
    ? `${data.schema}.${data.tableName}`
    : data.tableName;

  const pkColumns = data.columns.filter((c) => c.isPrimaryKey);
  const fkColumns = data.columns.filter((c) => c.isForeignKey);
  const regularColumns = data.columns.filter((c) => !c.isPrimaryKey);
  const sortedColumns = [...pkColumns, ...regularColumns];

  const schemaColor = colorBySchema ? getSchemaColor(data.schema) : DEFAULT_SCHEMA_COLOR;

  // ── Compact Mode (for dependency graph / compact view) ──────────
  if (isCompact) {
    return (
      <div
        className={cn(
          'rounded-lg shadow-md border-2 transition-all duration-200 px-4 py-2.5 min-w-[140px] max-w-[200px]',
          'hover:shadow-lg hover:scale-[1.03]',
          selected
            ? 'border-aqua-500 shadow-aqua-200/50'
            : 'border-slate-200 hover:border-aqua-300'
        )}
        style={{ borderLeftColor: schemaColor.accent, borderLeftWidth: 4 }}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-top-1" />
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-bottom-1" />
        <Handle type="target" position={Position.Left} id="left-target" className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-left-1" />
        <Handle type="source" position={Position.Right} id="right-source" className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-right-1" />

        <div className="flex items-center gap-2">
          <Table2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: schemaColor.accent }} />
          <span className="text-xs font-semibold text-slate-800 truncate">{data.tableName}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
          <span>{data.columns.length} cols</span>
          {pkColumns.length > 0 && <span className="text-amber-500">{pkColumns.length} PK</span>}
          {fkColumns.length > 0 && <span className="text-blue-500">{fkColumns.length} FK</span>}
        </div>
      </div>
    );
  }

  // ── Full Mode ──────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'bg-card rounded-xl shadow-md border-2 transition-all duration-200 min-w-[220px] max-w-[320px]',
        'hover:shadow-lg hover:scale-[1.02]',
        selected
          ? 'border-aqua-500 shadow-aqua-200/50'
          : 'border-slate-200 hover:border-aqua-300'
      )}
    >
      {/* ── Handles (all 4 sides) ─────────────────────────────────────── */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-top-1" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-bottom-1" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-left-1" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-2 !h-2 !bg-aqua-500 !border-white !border-2 !-right-1" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="px-3 py-2.5 rounded-t-[10px] flex items-center justify-between gap-2"
        style={{ background: schemaColor.gradient }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-4 h-4 text-white/90 flex-shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            {displayName}
          </span>
        </div>
        {data.estimatedRows != null && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-card/20 text-white rounded-full">
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
                idx % 2 === 0 ? 'bg-card' : 'bg-slate-50/70'
              )}
            >
              <span className="w-4 flex-shrink-0 flex items-center justify-center">
                {col.isPrimaryKey ? (
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                ) : col.isForeignKey ? (
                  <Link className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <span className="w-3.5" />
                )}
              </span>
              <span
                className={cn(
                  'flex-1 truncate',
                  col.isPrimaryKey ? 'font-bold text-slate-800' : 'text-slate-700'
                )}
              >
                {col.name}
              </span>
              {!col.nullable && (
                <span className="text-red-400 text-[10px] font-bold flex-shrink-0">*</span>
              )}
              <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                {col.dataType}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Collapsed column indicator ────────────────────────────────── */}
      {!showColumns && sortedColumns.length > 0 && (
        <div className="px-3 py-2 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Rows3 className="w-3 h-3" />
          {sortedColumns.length} column{sortedColumns.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-t border-slate-100 rounded-b-[10px] flex items-center gap-3 bg-slate-50/50">
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-400">
            {data.indexCount} index{data.indexCount !== 1 ? 'es' : ''}
          </span>
        </div>
        {pkColumns.length > 0 && (
          <div className="flex items-center gap-1">
            <Key className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-500">{pkColumns.length}</span>
          </div>
        )}
        {fkColumns.length > 0 && (
          <div className="flex items-center gap-1">
            <Link className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] text-blue-500">{fkColumns.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const ERTableNode = memo(ERTableNodeComponent);
