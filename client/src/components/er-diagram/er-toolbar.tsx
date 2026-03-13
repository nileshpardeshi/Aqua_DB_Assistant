import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow, type Node } from 'reactflow';
import {
  ArrowDownUp,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Columns3,
  Tag,
  Download,
  Image,
  FileCode2,
  FileText,
  Search,
  X,
  ChevronDown,
  Grid3X3,
  Palette,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  StickyNote,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';
import {
  exportDiagramAsPNG,
  exportDiagramAsSVG,
  generateDDL,
  downloadTextFile,
} from '@/lib/export-utils';
import type { ERTableNodeData } from './er-table-node';
import type { DiagramType } from '@/hooks/use-saved-diagrams';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ERToolbarProps {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      dataType: string;
      nullable: boolean;
      isPrimaryKey: boolean;
      defaultValue?: string | null;
    }>;
  }>;
  nodes: Node<ERTableNodeData>[];
  onSave?: () => void;
  onApplyPositions?: (positions: Record<string, { x: number; y: number }>) => void;
  diagramType: DiagramType;
  activeDiagramId: string | null;
}

// ── Diagram Type Labels ───────────────────────────────────────────────────────

const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  'er-full': 'Full ER Diagram',
  'er-compact': 'Compact Relationship Map',
  'dependency-graph': 'Table Dependency Graph',
  'schema-group': 'Schema Group View',
};

// ── Component ────────────────────────────────────────────────────────────────

export function ERToolbar({ tables, nodes, onSave, onApplyPositions, diagramType, activeDiagramId }: ERToolbarProps) {
  const reactFlowInstance = useReactFlow();
  const { zoomIn, zoomOut, fitView } = reactFlowInstance;

  const {
    layoutDirection,
    setLayoutDirection,
    showColumns,
    toggleColumns,
    showRelationshipLabels,
    toggleLabels,
    colorBySchema,
    toggleColorBySchema,
    snapToGrid,
    toggleSnapToGrid,
    isFullscreen,
    toggleFullscreen,
    isAnnotationMode,
    toggleAnnotationMode,
    undoPositions,
    redoPositions,
    positionHistory,
    positionHistoryIndex,
  } = useERDiagramStore();

  // ── Export dropdown state ────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as HTMLElement)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  const handleExportPNG = useCallback(async () => {
    setExportOpen(false);
    await exportDiagramAsPNG();
  }, []);

  const handleExportSVG = useCallback(async () => {
    setExportOpen(false);
    await exportDiagramAsSVG();
  }, []);

  const handleExportDDL = useCallback(() => {
    setExportOpen(false);
    const ddl = generateDDL(tables, 'SQL');
    downloadTextFile(ddl, 'er-diagram.sql');
  }, [tables]);

  // ── Search state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const matchingNodes = searchQuery.trim()
    ? nodes.filter((n) =>
        n.data.tableName.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  const handleSearchSelect = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        reactFlowInstance.fitView({
          nodes: [node],
          padding: 0.5,
          duration: 400,
        });
      }
      setSearchQuery('');
      setSearchOpen(false);
    },
    [nodes, reactFlowInstance]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && matchingNodes.length > 0) {
        handleSearchSelect(matchingNodes[0].id);
      }
      if (e.key === 'Escape') {
        setSearchQuery('');
        setSearchOpen(false);
      }
    },
    [matchingNodes, handleSearchSelect]
  );

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const positions = undoPositions();
        if (positions && onApplyPositions) onApplyPositions(positions);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        const positions = redoPositions();
        if (positions && onApplyPositions) onApplyPositions(positions);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undoPositions, redoPositions, onApplyPositions, onSave]);

  const canUndo = positionHistoryIndex > 0;
  const canRedo = positionHistoryIndex < positionHistory.length - 1;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 px-3 py-2 bg-card/95 backdrop-blur border-b border-border flex-wrap">
      {/* ── Diagram type badge ─────────────────────────────────────────── */}
      <span className="px-2.5 py-1 text-[11px] font-semibold bg-gradient-to-r from-aqua-50 to-teal-50 text-aqua-700 border border-aqua-200 rounded-lg mr-1">
        {DIAGRAM_TYPE_LABELS[diagramType]}
      </span>

      <Separator />

      {/* ── Layout Direction ──────────────────────────────────────────── */}
      <div className="flex items-center bg-muted rounded-lg p-0.5">
        <ToolbarButton
          icon={ArrowDownUp}
          label="Top to Bottom"
          active={layoutDirection === 'TB'}
          onClick={() => setLayoutDirection('TB')}
        />
        <ToolbarButton
          icon={ArrowLeftRight}
          label="Left to Right"
          active={layoutDirection === 'LR'}
          onClick={() => setLayoutDirection('LR')}
        />
      </div>

      <Separator />

      {/* ── Zoom Controls ─────────────────────────────────────────────── */}
      <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={() => zoomIn({ duration: 200 })} />
      <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={() => zoomOut({ duration: 200 })} />
      <ToolbarButton icon={Maximize} label="Fit View" onClick={() => fitView({ padding: 0.15, duration: 300 })} />

      <Separator />

      {/* ── Toggle Controls ───────────────────────────────────────────── */}
      <ToolbarButton
        icon={Columns3}
        label={showColumns ? 'Hide Columns' : 'Show Columns'}
        active={showColumns}
        onClick={toggleColumns}
      />
      <ToolbarButton
        icon={Tag}
        label={showRelationshipLabels ? 'Hide Labels' : 'Show Labels'}
        active={showRelationshipLabels}
        onClick={toggleLabels}
      />
      <ToolbarButton
        icon={Palette}
        label={colorBySchema ? 'Disable Schema Colors' : 'Color by Schema'}
        active={colorBySchema}
        onClick={toggleColorBySchema}
      />
      <ToolbarButton
        icon={Grid3X3}
        label={snapToGrid ? 'Disable Snap to Grid' : 'Snap to Grid'}
        active={snapToGrid}
        onClick={toggleSnapToGrid}
      />

      <Separator />

      {/* ── Annotations ───────────────────────────────────────────────── */}
      <ToolbarButton
        icon={StickyNote}
        label={isAnnotationMode ? 'Exit Annotation Mode' : 'Add Annotation'}
        active={isAnnotationMode}
        onClick={toggleAnnotationMode}
      />

      {/* ── Undo/Redo ─────────────────────────────────────────────────── */}
      <ToolbarButton
        icon={Undo2}
        label="Undo (Ctrl+Z)"
        onClick={() => {
          const p = undoPositions();
          if (p && onApplyPositions) onApplyPositions(p);
        }}
        disabled={!canUndo}
      />
      <ToolbarButton
        icon={Redo2}
        label="Redo (Ctrl+Y)"
        onClick={() => {
          const p = redoPositions();
          if (p && onApplyPositions) onApplyPositions(p);
        }}
        disabled={!canRedo}
      />

      <Separator />

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative">
        {searchOpen ? (
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search tables..."
                className="w-48 pl-7 pr-2 py-1.5 text-xs border border-border rounded-md bg-card focus:outline-none focus:border-aqua-400 focus:ring-1 focus:ring-aqua-400"
              />
              <button
                onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {searchQuery.trim() && matchingNodes.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
                {matchingNodes.slice(0, 10).map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleSearchSelect(node.id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-aqua-50 hover:text-aqua-700 truncate"
                  >
                    {node.data.schema ? `${node.data.schema}.${node.data.tableName}` : node.data.tableName}
                  </button>
                ))}
              </div>
            )}

            {searchQuery.trim() && matchingNodes.length === 0 && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
                <p className="px-3 text-xs text-muted-foreground">No tables found</p>
              </div>
            )}
          </div>
        ) : (
          <ToolbarButton icon={Search} label="Search Tables (Ctrl+F)" onClick={() => setSearchOpen(true)} />
        )}
      </div>

      <Separator />

      {/* ── Save Button ────────────────────────────────────────────────── */}
      {activeDiagramId && onSave && (
        <>
          <ToolbarButton icon={Save} label="Save Diagram (Ctrl+S)" onClick={onSave} />
          <Separator />
        </>
      )}

      {/* ── Export Dropdown ─────────────────────────────────────────────── */}
      <div className="relative" ref={exportRef}>
        <button
          onClick={() => setExportOpen((prev) => !prev)}
          title="Export"
          className={cn(
            'inline-flex items-center gap-0.5 justify-center h-8 px-2 rounded-md text-sm transition-colors',
            exportOpen
              ? 'bg-aqua-100 text-aqua-700'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Download className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>

        {exportOpen && (
          <div className="absolute top-full right-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
            <ExportMenuItem icon={Image} label="Export as PNG" onClick={handleExportPNG} />
            <ExportMenuItem icon={FileCode2} label="Export as SVG" onClick={handleExportSVG} />
            <div className="h-px bg-border/50 my-1" />
            <ExportMenuItem icon={FileText} label="Export as SQL DDL" onClick={handleExportDDL} />
          </div>
        )}
      </div>

      <Separator />

      {/* ── Fullscreen Toggle ──────────────────────────────────────────── */}
      <ToolbarButton
        icon={isFullscreen ? Minimize2 : Maximize2}
        label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        onClick={toggleFullscreen}
      />

      {/* ── Spacer + Table Count ───────────────────────────────────────── */}
      <div className="flex-1" />
      <span className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted rounded-full">
        {nodes.length} table{nodes.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-md text-sm transition-colors',
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed'
          : active
            ? 'bg-aqua-100 text-aqua-700'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ExportMenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-aqua-50 hover:text-aqua-700 transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}
