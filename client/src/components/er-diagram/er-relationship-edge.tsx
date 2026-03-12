import { memo } from 'react';
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

  const edgeColor = isInferred ? '#60a5fa' : '#94a3b8'; // blue-400 : slate-400
  const labelText = data?.constraintName || (isInferred ? 'inferred' : 'FK');

  return (
    <>
      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
          strokeDasharray: isInferred ? '6 4' : 'none',
          fill: 'none',
        }}
        markerEnd={markerEnd}
      />

      {/* Animated overlay for inferred relationships */}
      {isInferred && (
        <path
          d={edgePath}
          style={{
            stroke: edgeColor,
            strokeWidth: 2,
            strokeDasharray: '6 4',
            fill: 'none',
            animation: 'dash-flow 1.5s linear infinite',
          }}
        />
      )}

      {/* Midpoint label */}
      {showLabels && (
        <EdgeLabelRenderer>
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
                backgroundColor: isInferred ? '#eff6ff' : '#f8fafc',
                color: isInferred ? '#3b82f6' : '#64748b',
                borderColor: isInferred ? '#bfdbfe' : '#e2e8f0',
              }}
            >
              {labelText}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}

    </>
  );
}

export const ERRelationshipEdge = memo(ERRelationshipEdgeComponent);
