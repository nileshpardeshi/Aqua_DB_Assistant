import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';

import { useParams } from 'react-router-dom';
import { GitFork, Loader2 } from 'lucide-react';
import { useERDiagram } from '@/hooks/use-schema';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';
import { ERTableNode, type ERTableNodeData } from './er-table-node';
import { ERRelationshipEdge, type ERRelationshipEdgeData } from './er-relationship-edge';
import { ERToolbar } from './er-toolbar';

// ── Custom Node / Edge Types ─────────────────────────────────────────────────

const nodeTypes = {
  erTable: ERTableNode,
};

const edgeTypes = {
  erRelationship: ERRelationshipEdge,
};

// ── Dagre Layout ─────────────────────────────────────────────────────────────

const NODE_BASE_WIDTH = 260;
const NODE_HEADER_HEIGHT = 44;
const NODE_COLUMN_HEIGHT = 28;
const NODE_FOOTER_HEIGHT = 28;
const NODE_COLLAPSED_HEIGHT = 80;

function getLayoutedElements(
  nodes: Node<ERTableNodeData>[],
  edges: Edge<ERRelationshipEdgeData>[],
  direction: 'TB' | 'LR',
  showColumns: boolean
): { nodes: Node<ERTableNodeData>[]; edges: Edge<ERRelationshipEdgeData>[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });

  // Calculate node dimensions based on column count
  nodes.forEach((node) => {
    const columnCount = node.data.columns.length;
    const width = NODE_BASE_WIDTH;
    const height = showColumns
      ? NODE_HEADER_HEIGHT +
        Math.min(columnCount, 10) * NODE_COLUMN_HEIGHT +
        NODE_FOOTER_HEIGHT
      : NODE_COLLAPSED_HEIGHT;

    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    const columnCount = node.data.columns.length;
    const width = NODE_BASE_WIDTH;
    const height = showColumns
      ? NODE_HEADER_HEIGHT +
        Math.min(columnCount, 10) * NODE_COLUMN_HEIGHT +
        NODE_FOOTER_HEIGHT
      : NODE_COLLAPSED_HEIGHT;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ── Inner Canvas (needs ReactFlow context) ───────────────────────────────────

function ERCanvasInner() {
  const { projectId } = useParams();
  const { data: erData, isLoading, isError } = useERDiagram(projectId);
  const { layoutDirection, showColumns, clearSelection } = useERDiagramStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<ERTableNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ERRelationshipEdgeData>([]);

  // Convert API data to React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!erData) return { initialNodes: [], initialEdges: [] };

    const rfNodes: Node<ERTableNodeData>[] = erData.tables.map((table) => ({
      id: table.id,
      type: 'erTable',
      position: { x: 0, y: 0 },
      data: {
        tableId: table.id,
        tableName: table.name,
        schema: table.schema,
        columns: table.columns,
        estimatedRows: table.estimatedRows,
        indexCount: table.indexes?.length ?? 0,
      },
    }));

    const rfEdges: Edge<ERRelationshipEdgeData>[] = erData.relationships.map(
      (rel) => ({
        id: rel.id,
        source: rel.sourceTable,
        target: rel.targetTable,
        type: 'erRelationship',
        animated: rel.isInferred,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: rel.isInferred ? '#60a5fa' : '#94a3b8',
          width: 16,
          height: 16,
        },
        data: {
          constraintName: rel.name,
          isInferred: rel.isInferred,
          relationshipType: rel.type,
        },
      })
    );

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [erData]);

  // Apply Dagre layout when data or direction changes
  useEffect(() => {
    if (initialNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      layoutDirection,
      showColumns
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [initialNodes, initialEdges, layoutDirection, showColumns, setNodes, setEdges]);

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // ── Loading state ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-aqua-500 animate-spin" />
          <p className="text-sm text-slate-500">Loading ER diagram...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <GitFork className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            Failed to load ER diagram
          </p>
          <p className="text-xs text-slate-500">
            Please check your connection and try again.
          </p>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (!erData || erData.tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-aqua-100 flex items-center justify-center">
            <GitFork className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-700">
            No tables found
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Upload SQL files in the Schema Intelligence page to populate the ER
            diagram with your database tables and relationships.
          </p>
        </div>
      </div>
    );
  }

  // ── Diagram ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <ERToolbar />
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'erRelationship',
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#e2e8f0"
          />
          <Controls
            showInteractive={false}
            className="!shadow-md !rounded-lg !border !border-slate-200"
          />
          <MiniMap
            nodeColor="#0891b2"
            maskColor="rgba(241, 245, 249, 0.7)"
            className="!shadow-md !rounded-lg !border !border-slate-200"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// ── Wrapped Component with Provider ──────────────────────────────────────────

export function ERCanvas() {
  return (
    <ReactFlowProvider>
      <ERCanvasInner />
    </ReactFlowProvider>
  );
}
