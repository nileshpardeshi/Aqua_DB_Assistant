import { memo, useState } from 'react';
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';

// ── Edge Data Type ───────────────────────────────────────────────────────────

export interface ERRelationshipEdgeData {
  constraintName?: string;
  isInferred: boolean;
  relationshipType?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse relationship type string into source/target cardinality labels. */
function getCardinalityLabels(relationshipType?: string): {
  source: string;
  target: string;
} {
  const type = (relationshipType ?? '').toLowerCase();

  if (type.includes('many-to-many') || type === 'm:n') {
    return { source: '*', target: '*' };
  }
  if (
    type.includes('one-to-one') ||
    type === '1:1'
  ) {
    return { source: '1', target: '1' };
  }
  // Default: one-to-many (FK source = "1", FK target = "*")
  return { source: '1', target: '*' };
}

/** Return a human-readable label for the relationship type. */
function formatRelationshipType(type?: string): string {
  if (!type) return 'Foreign Key';
  const lower = type.toLowerCase();
  if (lower.includes('many-to-many')) return 'Many-to-Many';
  if (lower.includes('one-to-one')) return 'One-to-One';
  if (lower.includes('one-to-many')) return 'One-to-Many';
  return type;
}

// ── Component ────────────────────────────────────────────────────────────────

function ERRelationshipEdgeComponent({
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
}: EdgeProps<ERRelationshipEdgeData>) {
  const showLabels = useERDiagramStore((s) => s.showRelationshipLabels);
  const [isHovered, setIsHovered] = useState(false);

  const isInferred = data?.isInferred ?? false;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  // Color coding: explicit FK = solid cyan, inferred = dashed gray
  const edgeColor = isInferred ? '#94a3b8' : '#0891b2';
  const strokeWidth = isInferred ? 1 : 2;
  const labelText = data?.constraintName || (isInferred ? 'inferred' : 'FK');

  const { source: sourceCardinality, target: targetCardinality } =
    getCardinalityLabels(data?.relationshipType);

  // Offset cardinality labels slightly from the endpoints
  const CARDINALITY_OFFSET = 20;
  const sourceLabelX = sourceX;
  const sourceLabelY = sourceY + CARDINALITY_OFFSET;
  const targetLabelX = targetX;
  const targetLabelY = targetY - CARDINALITY_OFFSET;

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
      />

      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: isHovered ? '#0ea5e9' : edgeColor,
          strokeWidth: isHovered ? strokeWidth + 1 : strokeWidth,
          strokeDasharray: isInferred ? '6 4' : 'none',
          fill: 'none',
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
        markerEnd={markerEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Animated overlay for inferred relationships */}
      {isInferred && (
        <path
          d={edgePath}
          style={{
            stroke: edgeColor,
            strokeWidth,
            strokeDasharray: '6 4',
            fill: 'none',
            animation: 'dash-flow 1.5s linear infinite',
          }}
        />
      )}

      <EdgeLabelRenderer>
        {/* ── Source cardinality marker ─────────────────────────────────── */}
        <div
          className="nodrag nopan pointer-events-none"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${sourceLabelX}px,${sourceLabelY}px)`,
          }}
        >
          <span
            className="text-[10px] font-bold"
            style={{ color: isInferred ? '#94a3b8' : '#0891b2' }}
          >
            {sourceCardinality}
          </span>
        </div>

        {/* ── Target cardinality marker ─────────────────────────────────── */}
        <div
          className="nodrag nopan pointer-events-none"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${targetLabelX}px,${targetLabelY}px)`,
          }}
        >
          <span
            className="text-[10px] font-bold"
            style={{ color: isInferred ? '#94a3b8' : '#0891b2' }}
          >
            {targetCardinality}
          </span>
        </div>

        {/* ── Midpoint label ────────────────────────────────────────────── */}
        {showLabels && (
          <div
            className="nodrag nopan pointer-events-auto"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded-md shadow-sm border"
              style={{
                backgroundColor: isInferred ? '#f8fafc' : '#ecfeff',
                color: isInferred ? '#64748b' : '#0e7490',
                borderColor: isInferred ? '#e2e8f0' : '#a5f3fc',
              }}
            >
              {labelText}
            </span>
          </div>
        )}

        {/* ── Hover tooltip ─────────────────────────────────────────────── */}
        {isHovered && (
          <div
            className="nodrag nopan pointer-events-none"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -120%) translate(${labelX}px,${labelY}px)`,
              zIndex: 50,
            }}
          >
            <div className="bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              <div className="font-semibold mb-0.5">
                {formatRelationshipType(data?.relationshipType)}
              </div>
              <div className="text-slate-300">
                {data?.constraintName || 'Unnamed relationship'}
              </div>
              <div className="text-slate-400 text-[10px] mt-0.5">
                {isInferred ? 'Inferred from naming conventions' : 'Explicit foreign key'}
              </div>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const ERRelationshipEdge = memo(ERRelationshipEdgeComponent);
