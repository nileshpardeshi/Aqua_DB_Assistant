import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  GitFork,
  Loader2,
  X,
  Key,
  Link,
  Hash,
  Table2,
  ShieldCheck,
} from 'lucide-react';
import { useERDiagram } from '@/hooks/use-schema';
import type { Table } from '@/hooks/use-schema';
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

// ── Table Detail Panel ────────────────────────────────────────────────────────

function TableDetailPanel({
  table,
  onClose,
}: {
  table: Table;
  onClose: () => void;
}) {
  const pkColumns = table.columns.filter((c) => c.isPrimaryKey);
  const fkColumns = table.columns.filter((c) => c.isForeignKey);

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 bg-card border-l border-slate-200 shadow-xl z-20 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-4 h-4 text-white/90 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-white truncate">
            {table.schema ? `${table.schema}.${table.name}` : table.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-card/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Stats */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-4">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{table.columns.length}</span> columns
          </div>
          {table.estimatedRows != null && (
            <div className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">
                {table.estimatedRows.toLocaleString()}
              </span>{' '}
              rows
            </div>
          )}
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{table.indexes?.length ?? 0}</span>{' '}
            indexes
          </div>
        </div>

        {/* Columns */}
        <div className="px-4 py-3 border-b border-slate-100">
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Columns
          </h4>
          <div className="space-y-1">
            {table.columns.map((col) => (
              <div
                key={col.id || col.name}
                className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-slate-50 text-xs"
              >
                <span className="w-4 flex-shrink-0 flex items-center justify-center">
                  {col.isPrimaryKey ? (
                    <Key className="w-3 h-3 text-amber-500" />
                  ) : col.isForeignKey ? (
                    <Link className="w-3 h-3 text-blue-500" />
                  ) : (
                    <span className="w-3" />
                  )}
                </span>
                <span className="flex-1 font-medium text-slate-700 truncate">
                  {col.name}
                </span>
                {!col.nullable && (
                  <span className="text-red-400 text-[10px] font-bold flex-shrink-0">
                    *
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                  {col.dataType}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Primary Keys */}
        {pkColumns.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Key className="w-3 h-3 text-amber-500" />
              Primary Keys
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {pkColumns.map((col) => (
                <span
                  key={col.id || col.name}
                  className="px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-md"
                >
                  {col.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Foreign Keys */}
        {fkColumns.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Link className="w-3 h-3 text-blue-500" />
              Foreign Keys
            </h4>
            <div className="space-y-1.5">
              {fkColumns.map((col) => (
                <div
                  key={col.id || col.name}
                  className="text-[11px] px-2 py-1 rounded-md bg-blue-50 border border-blue-100"
                >
                  <span className="font-medium text-blue-700">{col.name}</span>
                  {col.referencesTable && (
                    <span className="text-blue-500">
                      {' '}
                      &rarr; {col.referencesTable}
                      {col.referencesColumn ? `.${col.referencesColumn}` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indexes */}
        {table.indexes && table.indexes.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-slate-400" />
              Indexes
            </h4>
            <div className="space-y-1.5">
              {table.indexes.map((idx) => (
                <div
                  key={idx.id || idx.name}
                  className="text-[11px] px-2 py-1 rounded-md bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-700 truncate">
                      {idx.name}
                    </span>
                    {idx.isUnique && (
                      <span className="px-1 py-px text-[9px] font-semibold bg-teal-50 text-teal-600 border border-teal-200 rounded">
                        UNIQUE
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono">
                    ({idx.columns.join(', ')})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Constraints */}
        {table.constraints && table.constraints.length > 0 && (
          <div className="px-4 py-3">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-slate-400" />
              Constraints
            </h4>
            <div className="space-y-1.5">
              {table.constraints.map((con) => (
                <div
                  key={con.id || con.name}
                  className="text-[11px] px-2 py-1 rounded-md bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-700 truncate">
                      {con.name}
                    </span>
                    <span className="px-1 py-px text-[9px] font-semibold bg-slate-100 text-slate-500 rounded">
                      {con.type}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono">
                    ({con.columns.join(', ')})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inner Canvas (needs ReactFlow context) ───────────────────────────────────

function ERCanvasInner() {
  const { projectId } = useParams();
  const { data: erData, isLoading, isError } = useERDiagram(projectId);
  const { layoutDirection, showColumns, clearSelection } = useERDiagramStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<ERTableNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ERRelationshipEdgeData>([]);

  // Table detail panel state
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Convert API data to React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!erData?.tables || !erData?.relationships) return { initialNodes: [], initialEdges: [] };

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
          color: rel.isInferred ? '#94a3b8' : '#0891b2',
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

  // Handle double-click on a node to open detail panel
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<ERTableNodeData>) => {
      if (!erData?.tables) return;
      const table = erData.tables.find((t) => t.id === node.id);
      if (table) {
        setSelectedTable(table);
      }
    },
    [erData]
  );

  // Tables data for DDL export (minimal shape the toolbar needs)
  const tablesForExport = useMemo(() => {
    if (!erData?.tables) return [];
    return erData.tables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
        nullable: c.nullable,
        isPrimaryKey: c.isPrimaryKey,
        defaultValue: c.defaultValue,
      })),
    }));
  }, [erData]);

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
  if (!erData?.tables || erData.tables.length === 0) {
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
      <ERToolbar tables={tablesForExport} nodes={nodes} />
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={onPaneClick}
          onNodeDoubleClick={onNodeDoubleClick}
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

        {/* Table detail slide-out panel */}
        {selectedTable && (
          <TableDetailPanel
            table={selectedTable}
            onClose={() => setSelectedTable(null)}
          />
        )}
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
