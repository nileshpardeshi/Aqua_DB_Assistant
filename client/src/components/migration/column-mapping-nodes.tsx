import { memo, useState } from 'react';
import {
  Handle,
  Position,
  getSmoothStepPath,
  EdgeLabelRenderer,
  type NodeProps,
  type EdgeProps,
} from 'reactflow';
import { Table2, Key, Link, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Column } from '@/hooks/use-schema';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 32;

// ── Data Interfaces ───────────────────────────────────────────────────────────

export interface ColumnMappingNodeData {
  tableId: string;
  tableName: string;
  schema?: string;
  columns: Column[];
  mappedColumnNames: Set<string>;
}

export interface MappingEdgeData {
  transformationType: 'direct' | 'cast' | 'expression' | 'default' | 'rename';
  expression?: string;
  castTo?: string;
  defaultValue?: string;
  nullHandling?: 'pass' | 'default' | 'skip';
  isValid: boolean;
  sourceType: string;
  targetType: string;
  sourceColumn: string;
  targetColumn: string;
  onEdgeClick?: (edgeId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sort columns so PKs come first, then by ordinal position. */
function sortColumns(columns: Column[]): Column[] {
  const pkColumns = columns.filter((c) => c.isPrimaryKey);
  const regularColumns = columns.filter((c) => !c.isPrimaryKey);
  return [...pkColumns, ...regularColumns];
}

// ── 1. SourceTableNode ────────────────────────────────────────────────────────

function SourceTableNodeComponent({ data }: NodeProps<ColumnMappingNodeData>) {
  const displayName = data.schema
    ? `${data.schema}.${data.tableName}`
    : data.tableName;

  const sortedColumns = sortColumns(data.columns);

  return (
    <div
      className={cn(
        'bg-card rounded-xl shadow-md border-2 min-w-[280px] max-w-[340px]',
        'hover:shadow-lg hover:scale-[1.02] transition-all duration-200',
        'border-border hover:border-purple-300'
      )}
      style={{ position: 'relative' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="px-3 py-2.5 rounded-t-[10px] flex items-center justify-between gap-2"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-4 h-4 text-white/90 flex-shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            {displayName}
          </span>
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-white/20 text-white rounded-full uppercase tracking-wider">
            Source
          </span>
        </div>
        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded-full">
          {data.columns.length} col{data.columns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Column List ─────────────────────────────────────────────────── */}
      <div className="max-h-[480px] overflow-y-auto">
        {sortedColumns.map((col, idx) => {
          const isMapped = data.mappedColumnNames.has(col.name);

          return (
            <div
              key={col.id || col.name}
              className={cn(
                'flex items-center gap-2 px-3 text-xs',
                idx % 2 === 0 ? 'bg-card' : 'bg-muted/50'
              )}
              style={{ height: `${ROW_HEIGHT}px` }}
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
              <span className="flex-1 font-medium text-foreground truncate">
                {col.name}
              </span>

              {/* NOT NULL indicator */}
              {!col.nullable && (
                <span className="text-red-400 text-[10px] font-bold flex-shrink-0">
                  *
                </span>
              )}

              {/* Data type */}
              <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0 truncate max-w-[80px]">
                {col.dataType}
              </span>

              {/* Mapped indicator */}
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  isMapped ? 'bg-green-500' : 'bg-muted-foreground/40'
                )}
              />
            </div>
          );
        })}
      </div>

      {/* ── Per-column Handles ──────────────────────────────────────────── */}
      {sortedColumns.map((col, index) => (
        <Handle
          key={`source-${col.name}`}
          type="source"
          position={Position.Right}
          id={`source-${col.name}`}
          className="!w-3 !h-3 !bg-purple-500 !border-white !border-2"
          style={{
            top: `${HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2}px`,
          }}
          isConnectable={true}
        />
      ))}
    </div>
  );
}

export const SourceTableNode = memo(SourceTableNodeComponent);

// ── 2. TargetTableNode ────────────────────────────────────────────────────────

function TargetTableNodeComponent({ data }: NodeProps<ColumnMappingNodeData>) {
  const displayName = data.schema
    ? `${data.schema}.${data.tableName}`
    : data.tableName;

  const sortedColumns = sortColumns(data.columns);

  return (
    <div
      className={cn(
        'bg-card rounded-xl shadow-md border-2 min-w-[280px] max-w-[340px]',
        'hover:shadow-lg hover:scale-[1.02] transition-all duration-200',
        'border-border hover:border-aqua-300'
      )}
      style={{ position: 'relative' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
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
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-white/20 text-white rounded-full uppercase tracking-wider">
            Target
          </span>
        </div>
        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded-full">
          {data.columns.length} col{data.columns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Column List ─────────────────────────────────────────────────── */}
      <div className="max-h-[480px] overflow-y-auto">
        {sortedColumns.map((col, idx) => {
          const isMapped = data.mappedColumnNames.has(col.name);

          return (
            <div
              key={col.id || col.name}
              className={cn(
                'flex items-center gap-2 px-3 text-xs',
                idx % 2 === 0 ? 'bg-card' : 'bg-muted/50'
              )}
              style={{ height: `${ROW_HEIGHT}px` }}
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
              <span className="flex-1 font-medium text-foreground truncate">
                {col.name}
              </span>

              {/* NOT NULL indicator */}
              {!col.nullable && (
                <span className="text-red-400 text-[10px] font-bold flex-shrink-0">
                  *
                </span>
              )}

              {/* Data type */}
              <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0 truncate max-w-[80px]">
                {col.dataType}
              </span>

              {/* Mapped indicator */}
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  isMapped ? 'bg-green-500' : 'bg-muted-foreground/40'
                )}
              />
            </div>
          );
        })}
      </div>

      {/* ── Per-column Handles ──────────────────────────────────────────── */}
      {sortedColumns.map((col, index) => (
        <Handle
          key={`target-${col.name}`}
          type="target"
          position={Position.Left}
          id={`target-${col.name}`}
          className="!w-3 !h-3 !bg-aqua-500 !border-white !border-2"
          style={{
            top: `${HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2}px`,
          }}
          isConnectable={true}
        />
      ))}
    </div>
  );
}

export const TargetTableNode = memo(TargetTableNodeComponent);

// ── 3. MappingEdge ────────────────────────────────────────────────────────────

/** Return edge color based on transformation type and validity. */
function getEdgeColor(data?: MappingEdgeData): string {
  if (!data || !data.isValid) return '#ef4444';
  if (data.transformationType === 'direct') return '#8b5cf6';
  return '#0891b2';
}

/** Return badge label and background color for the transformation type. */
function getTransformBadge(data?: MappingEdgeData): {
  label: string;
  bg: string;
  text: string;
} {
  if (!data || !data.isValid) {
    return { label: 'INVALID', bg: 'bg-red-500', text: 'text-white' };
  }

  switch (data.transformationType) {
    case 'direct':
      return { label: 'DIRECT', bg: 'bg-purple-500', text: 'text-white' };
    case 'cast': {
      const castLabel = data.castTo
        ? `CAST(${data.castTo.length > 10 ? data.castTo.slice(0, 10) + '\u2026' : data.castTo})`
        : 'CAST';
      return { label: castLabel, bg: 'bg-cyan-600', text: 'text-white' };
    }
    case 'expression':
      return { label: 'EXPR', bg: 'bg-blue-500', text: 'text-white' };
    case 'default':
      return { label: 'DEFAULT', bg: 'bg-slate-500', text: 'text-white' };
    case 'rename':
      return { label: 'RENAME', bg: 'bg-violet-500', text: 'text-white' };
    default:
      return { label: 'DIRECT', bg: 'bg-purple-500', text: 'text-white' };
  }
}

/** Human-readable transformation detail for the hover tooltip. */
function getTransformDetail(data?: MappingEdgeData): string {
  if (!data) return '';

  switch (data.transformationType) {
    case 'direct':
      return 'Direct mapping (no transformation)';
    case 'cast':
      return data.castTo
        ? `Cast to ${data.castTo}`
        : 'Type cast';
    case 'expression':
      return data.expression
        ? `Expression: ${data.expression}`
        : 'Custom expression';
    case 'default':
      return data.defaultValue
        ? `Default value: ${data.defaultValue}`
        : 'Default value mapping';
    case 'rename':
      return 'Column rename';
    default:
      return '';
  }
}

function MappingEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}: EdgeProps<MappingEdgeData>) {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const edgeColor = getEdgeColor(data);
  const isValid = data?.isValid ?? true;
  const badge = getTransformBadge(data);

  return (
    <>
      {/* Invisible wider hit-area for hover detection */}
      <path
        d={edgePath}
        style={{
          stroke: 'transparent',
          strokeWidth: 16,
          fill: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => data?.onEdgeClick?.(id)}
      />

      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: isHovered ? (isValid ? '#6d28d9' : '#dc2626') : edgeColor,
          strokeWidth: isHovered ? 3 : 2,
          strokeDasharray: isValid ? 'none' : '6 4',
          fill: 'none',
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
        markerEnd={markerEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      <EdgeLabelRenderer>
        {/* ── Midpoint Badge ──────────────────────────────────────────── */}
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            cursor: 'pointer',
          }}
          onClick={() => data?.onEdgeClick?.(id)}
        >
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md shadow-sm',
              badge.bg,
              badge.text
            )}
          >
            {!isValid && (
              <AlertTriangle className="w-3 h-3" />
            )}
            {badge.label}
          </span>
        </div>

        {/* ── Hover Tooltip ───────────────────────────────────────────── */}
        {isHovered && data && (
          <div
            className="nodrag nopan pointer-events-none"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -120%) translate(${labelX}px,${labelY}px)`,
              zIndex: 50,
            }}
          >
            <div className="bg-slate-800 text-white rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              <div className="text-[11px] font-semibold mb-0.5">
                {data.sourceColumn}{' '}
                <span className="text-slate-400">({data.sourceType})</span>
                {'  \u2192  '}
                {data.targetColumn}{' '}
                <span className="text-slate-400">({data.targetType})</span>
              </div>
              <div className="text-[10px] text-slate-300">
                {getTransformDetail(data)}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">
                Click to configure
              </div>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const MappingEdge = memo(MappingEdgeComponent);

// ── Registration Constants ────────────────────────────────────────────────────

export const columnMappingNodeTypes = {
  sourceTable: SourceTableNode,
  targetTable: TargetTableNode,
};

export const columnMappingEdgeTypes = {
  mapping: MappingEdge,
};
