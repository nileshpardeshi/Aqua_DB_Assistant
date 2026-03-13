import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type NodeDragHandler,
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
import toast from 'react-hot-toast';
import { useERDiagram } from '@/hooks/use-schema';
import type { Table } from '@/hooks/use-schema';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';
import { useUpdateDiagram, type SavedDiagram } from '@/hooks/use-saved-diagrams';
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
const NODE_COMPACT_WIDTH = 180;
const NODE_HEADER_HEIGHT = 44;
const NODE_COLUMN_HEIGHT = 28;
const NODE_FOOTER_HEIGHT = 28;
const NODE_COLLAPSED_HEIGHT = 80;
const NODE_COMPACT_HEIGHT = 60;

function getLayoutedElements(
  nodes: Node<ERTableNodeData>[],
  edges: Edge<ERRelationshipEdgeData>[],
  direction: 'TB' | 'LR',
  showColumns: boolean,
  isCompact: boolean,
  savedPositions?: Record<string, { x: number; y: number }> | null,
): { nodes: Node<ERTableNodeData>[]; edges: Edge<ERRelationshipEdgeData>[] } {
  // If we have saved positions, use them directly
  if (savedPositions && Object.keys(savedPositions).length > 0) {
    const positionedNodes = nodes.map((node) => {
      const saved = savedPositions[node.id];
      return {
        ...node,
        position: saved ?? { x: 0, y: 0 },
      };
    });
    return { nodes: positionedNodes, edges };
  }

  // Auto-layout with Dagre
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: isCompact ? 40 : 60,
    ranksep: isCompact ? 50 : 80,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    const columnCount = node.data.columns.length;
    const width = isCompact ? NODE_COMPACT_WIDTH : NODE_BASE_WIDTH;
    const height = isCompact
      ? NODE_COMPACT_HEIGHT
      : showColumns
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
    const width = isCompact ? NODE_COMPACT_WIDTH : NODE_BASE_WIDTH;
    const columnCount = node.data.columns.length;
    const height = isCompact
      ? NODE_COMPACT_HEIGHT
      : showColumns
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

// ── Annotation Overlay ──────────────────────────────────────────────────────

function AnnotationOverlay() {
  const { annotations, removeAnnotation, updateAnnotation, isAnnotationMode, addAnnotation } = useERDiagramStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isAnnotationMode) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addAnnotation({
        id: crypto.randomUUID(),
        x,
        y,
        text: 'New note',
        color: '#fef3c7',
      });
    },
    [isAnnotationMode, addAnnotation]
  );

  if (annotations.length === 0 && !isAnnotationMode) return null;

  return (
    <div
      className="absolute inset-0 z-10"
      onClick={handleCanvasClick}
      style={{ pointerEvents: isAnnotationMode ? 'auto' : 'none' }}
    >
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className="absolute group"
          style={{
            left: ann.x,
            top: ann.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
          }}
        >
          <div
            className="px-3 py-2 rounded-lg shadow-md border border-border min-w-[100px] max-w-[200px] text-xs"
            style={{ backgroundColor: ann.color }}
          >
            {editingId === ann.id ? (
              <textarea
                autoFocus
                defaultValue={ann.text}
                onBlur={(e) => {
                  updateAnnotation(ann.id, { text: e.target.value });
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    updateAnnotation(ann.id, { text: (e.target as HTMLTextAreaElement).value });
                    setEditingId(null);
                  }
                }}
                className="w-full bg-transparent text-foreground outline-none resize-none"
                rows={2}
              />
            ) : (
              <p
                className="text-foreground cursor-pointer"
                onDoubleClick={() => setEditingId(ann.id)}
              >
                {ann.text}
              </p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
              className="absolute -top-2 -right-2 w-4 h-4 bg-red-400 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
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
    <div className="absolute top-0 right-0 bottom-0 w-80 bg-card border-l border-border shadow-xl z-20 flex flex-col overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }}
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

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-4">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{table.columns.length}</span> columns
          </div>
          {table.estimatedRows != null && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{table.estimatedRows.toLocaleString()}</span> rows
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{table.indexes?.length ?? 0}</span> indexes
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border/50">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Columns</h4>
          <div className="space-y-1">
            {table.columns.map((col) => (
              <div key={col.id || col.name} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 text-xs">
                <span className="w-4 flex-shrink-0 flex items-center justify-center">
                  {col.isPrimaryKey ? <Key className="w-3 h-3 text-amber-500" /> : col.isForeignKey ? <Link className="w-3 h-3 text-blue-500" /> : <span className="w-3" />}
                </span>
                <span className="flex-1 font-medium text-foreground truncate">{col.name}</span>
                {!col.nullable && <span className="text-red-400 text-[10px] font-bold flex-shrink-0">*</span>}
                <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0">{col.dataType}</span>
              </div>
            ))}
          </div>
        </div>

        {pkColumns.length > 0 && (
          <div className="px-4 py-3 border-b border-border/50">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Key className="w-3 h-3 text-amber-500" /> Primary Keys
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {pkColumns.map((col) => (
                <span key={col.id || col.name} className="px-2 py-0.5 text-[11px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-md">{col.name}</span>
              ))}
            </div>
          </div>
        )}

        {fkColumns.length > 0 && (
          <div className="px-4 py-3 border-b border-border/50">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Link className="w-3 h-3 text-blue-500" /> Foreign Keys
            </h4>
            <div className="space-y-1.5">
              {fkColumns.map((col) => (
                <div key={col.id || col.name} className="text-[11px] px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800">
                  <span className="font-medium text-blue-700 dark:text-blue-200">{col.name}</span>
                  {col.referencesTable && (
                    <span className="text-blue-500 dark:text-blue-400"> &rarr; {col.referencesTable}{col.referencesColumn ? `.${col.referencesColumn}` : ''}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {table.indexes && table.indexes.length > 0 && (
          <div className="px-4 py-3 border-b border-border/50">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-muted-foreground" /> Indexes
            </h4>
            <div className="space-y-1.5">
              {table.indexes.map((idx) => (
                <div key={idx.id || idx.name} className="text-[11px] px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground truncate">{idx.name}</span>
                    {idx.isUnique && <span className="px-1 py-px text-[9px] font-semibold bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded">UNIQUE</span>}
                  </div>
                  <span className="text-muted-foreground font-mono">({idx.columns.join(', ')})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {table.constraints && table.constraints.length > 0 && (
          <div className="px-4 py-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-muted-foreground" /> Constraints
            </h4>
            <div className="space-y-1.5">
              {table.constraints.map((con) => (
                <div key={con.id || con.name} className="text-[11px] px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground truncate">{con.name}</span>
                    <span className="px-1 py-px text-[9px] font-semibold bg-muted text-muted-foreground rounded">{con.type}</span>
                  </div>
                  <span className="text-muted-foreground font-mono">({con.columns.join(', ')})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ERCanvasProps {
  activeDiagram?: SavedDiagram | null;
}

// ── Inner Canvas (needs ReactFlow context) ───────────────────────────────────

function ERCanvasInner({ activeDiagram }: ERCanvasProps) {
  const { projectId } = useParams();
  const { data: erData, isLoading, isError } = useERDiagram(projectId);
  const updateDiagram = useUpdateDiagram();

  const {
    layoutDirection,
    showColumns,
    clearSelection,
    diagramType,
    includedTableIds,
    snapToGrid,
    isFullscreen,
    activeDiagramId,
    pushPositionSnapshot,
  } = useERDiagramStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<ERTableNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ERRelationshipEdgeData>([]);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const savedPositions = useMemo(() => {
    if (!activeDiagram?.nodePositions) return null;
    try {
      return JSON.parse(activeDiagram.nodePositions) as Record<string, { x: number; y: number }>;
    } catch {
      return null;
    }
  }, [activeDiagram?.nodePositions]);

  const isCompact = diagramType === 'er-compact' || diagramType === 'dependency-graph';

  // Filter tables based on includedTableIds
  const filteredData = useMemo(() => {
    if (!erData) return null;
    if (!includedTableIds) return erData;

    const tableSet = new Set(includedTableIds);
    const tables = erData.tables.filter((t) => tableSet.has(t.id));
    const tableIdSet = new Set(tables.map((t) => t.id));
    const relationships = erData.relationships.filter(
      (r) => tableIdSet.has(r.sourceTable) && tableIdSet.has(r.targetTable)
    );
    return { tables, relationships };
  }, [erData, includedTableIds]);

  // Schema groups for the schema-group view
  const schemaGroups = useMemo(() => {
    if (diagramType !== 'schema-group' || !filteredData) return null;
    const groups: Record<string, typeof filteredData.tables> = {};
    for (const table of filteredData.tables) {
      const schema = table.schema || 'default';
      if (!groups[schema]) groups[schema] = [];
      groups[schema].push(table);
    }
    return groups;
  }, [diagramType, filteredData]);

  // Convert API data to React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!filteredData?.tables || !filteredData?.relationships) return { initialNodes: [], initialEdges: [] };

    const rfNodes: Node<ERTableNodeData>[] = filteredData.tables.map((table) => ({
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
        isCompact,
      },
    }));

    const rfEdges: Edge<ERRelationshipEdgeData>[] = filteredData.relationships.map((rel) => ({
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
    }));

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [filteredData, isCompact]);

  const initialLayoutDone = useRef(false);

  useEffect(() => {
    if (initialNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      initialLayoutDone.current = false;
      return;
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      layoutDirection,
      showColumns,
      isCompact,
      initialLayoutDone.current ? null : savedPositions,
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    initialLayoutDone.current = true;
  }, [initialNodes, initialEdges, layoutDirection, showColumns, isCompact, setNodes, setEdges, savedPositions]);

  const onPaneClick = useCallback(() => clearSelection(), [clearSelection]);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<ERTableNodeData>) => {
      if (!filteredData?.tables) return;
      const table = filteredData.tables.find((t) => t.id === node.id);
      if (table) setSelectedTable(table);
    },
    [filteredData]
  );

  const onNodeDragStop: NodeDragHandler = useCallback(
    () => {
      const currentPositions: Record<string, { x: number; y: number }> = {};
      // We need to use the store's latest node data — access via setNodes callback
      setNodes((nds) => {
        nds.forEach((n) => {
          currentPositions[n.id] = { x: n.position.x, y: n.position.y };
        });
        return nds; // Don't change anything, just read
      });
      if (Object.keys(currentPositions).length > 0) {
        pushPositionSnapshot(currentPositions);
      }
    },
    [pushPositionSnapshot, setNodes]
  );

  const onApplyPositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      setNodes((nds) =>
        nds.map((n) => {
          const pos = positions[n.id];
          return pos ? { ...n, position: pos } : n;
        })
      );
    },
    [setNodes]
  );

  const handleSave = useCallback(() => {
    if (!activeDiagramId || !projectId) return;
    const currentPositions: Record<string, { x: number; y: number }> = {};
    setNodes((nds) => {
      nds.forEach((n) => {
        currentPositions[n.id] = { x: n.position.x, y: n.position.y };
      });
      return nds;
    });

    const state = useERDiagramStore.getState();
    updateDiagram.mutate(
      {
        projectId,
        diagramId: activeDiagramId,
        data: {
          nodePositions: currentPositions,
          layoutDirection: state.layoutDirection,
          showColumns: state.showColumns,
          showLabels: state.showRelationshipLabels,
          colorBySchema: state.colorBySchema,
          includedTables: state.includedTableIds,
          annotations: state.annotations,
        },
      },
      {
        onSuccess: () => toast.success('Diagram saved'),
        onError: () => toast.error('Failed to save diagram'),
      }
    );
  }, [activeDiagramId, projectId, updateDiagram, setNodes]);

  const tablesForExport = useMemo(() => {
    if (!filteredData?.tables) return [];
    return filteredData.tables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
        nullable: c.nullable,
        isPrimaryKey: c.isPrimaryKey,
        defaultValue: c.defaultValue,
      })),
    }));
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-aqua-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <GitFork className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm font-medium text-foreground">Failed to load diagram</p>
          <p className="text-xs text-muted-foreground">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  if (!filteredData?.tables || filteredData.tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-aqua-100 flex items-center justify-center">
            <GitFork className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No tables found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Upload SQL files in Schema Intelligence to populate the diagram with your database tables and relationships.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-card' : ''}`}>
      <ERToolbar
        tables={tablesForExport}
        nodes={nodes}
        onSave={handleSave}
        onApplyPositions={onApplyPositions}
        diagramType={diagramType}
        activeDiagramId={activeDiagramId}
      />
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={onPaneClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.05}
          maxZoom={3}
          snapToGrid={snapToGrid}
          snapGrid={[15, 15]}
          defaultEdgeOptions={{ type: 'erRelationship' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={snapToGrid ? 15 : 20}
            size={1}
            color={snapToGrid ? '#cbd5e1' : '#e2e8f0'}
          />
          <Controls
            showInteractive={false}
            className="!shadow-md !rounded-lg !border !border-border"
          />
          <MiniMap
            nodeColor="#0891b2"
            maskColor="rgba(241, 245, 249, 0.7)"
            className="!shadow-md !rounded-lg !border !border-border"
          />
        </ReactFlow>

        <AnnotationOverlay />

        {selectedTable && (
          <TableDetailPanel table={selectedTable} onClose={() => setSelectedTable(null)} />
        )}

        {diagramType === 'schema-group' && schemaGroups && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
            {Object.keys(schemaGroups).map((schema) => (
              <div key={schema} className="flex items-center gap-1.5 px-2 py-1 bg-card/90 backdrop-blur rounded-md shadow-sm border border-border text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-aqua-500" />
                <span className="font-medium text-foreground">{schema}</span>
                <span className="text-muted-foreground">({schemaGroups[schema].length})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wrapped Component with Provider ──────────────────────────────────────────

export function ERCanvas({ activeDiagram }: ERCanvasProps) {
  return (
    <ReactFlowProvider>
      <ERCanvasInner activeDiagram={activeDiagram} />
    </ReactFlowProvider>
  );
}
