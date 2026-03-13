import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  GitFork,
  Network,
  Boxes,
  LayoutGrid,
  Plus,
  Trash2,
  Copy,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Table2,
  Eye,
  EyeOff,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { ERCanvas } from '@/components/er-diagram/er-canvas';
import { useERDiagram } from '@/hooks/use-schema';
import { useERDiagramStore } from '@/stores/use-er-diagram-store';
import {
  useSavedDiagrams,
  useCreateDiagram,
  useUpdateDiagram,
  useDeleteDiagram,
  useDuplicateDiagram,
  type SavedDiagram,
  type DiagramType,
} from '@/hooks/use-saved-diagrams';

// ── Diagram Type Config ──────────────────────────────────────────────────────

const DIAGRAM_TYPES: Array<{
  type: DiagramType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    type: 'er-full',
    label: 'Full ER Diagram',
    description: 'Complete entity-relationship view with all columns, keys, and indexes',
    icon: GitFork,
  },
  {
    type: 'er-compact',
    label: 'Compact Relationship Map',
    description: 'Simplified table boxes showing only relationships and cardinality',
    icon: Network,
  },
  {
    type: 'dependency-graph',
    label: 'Table Dependency Graph',
    description: 'Directed acyclic graph showing FK dependency chains between tables',
    icon: Boxes,
  },
  {
    type: 'schema-group',
    label: 'Schema Group View',
    description: 'Tables organized and color-coded by schema namespace',
    icon: LayoutGrid,
  },
];

// ── ErDiagram Page ───────────────────────────────────────────────────────────

export function ErDiagram() {
  const { projectId } = useParams();
  const { data: erData } = useERDiagram(projectId);
  const { data: savedDiagrams, isLoading: diagramsLoading } = useSavedDiagrams(projectId);
  const createDiagram = useCreateDiagram();
  const deleteDiagram = useDeleteDiagram();
  const duplicateDiagram = useDuplicateDiagram();
  const updateDiagram = useUpdateDiagram();

  const {
    activeDiagramId,
    setActiveDiagram,
    diagramType,
    setDiagramType,
    loadDiagramSettings,
    resetToDefaults,
    includedTableIds,
    setIncludedTableIds,
    toggleTableInclusion,
    isFullscreen,
  } = useERDiagramStore();

  // Sidebar sections
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [diagramsExpanded, setDiagramsExpanded] = useState(true);
  const [typesExpanded, setTypesExpanded] = useState(true);
  const [tablesExpanded, setTablesExpanded] = useState(true);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // New diagram dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [newDiagramType, setNewDiagramType] = useState<DiagramType>('er-full');

  // Table filter search
  const [tableFilterSearch, setTableFilterSearch] = useState('');

  // Active diagram object
  const activeDiagram = useMemo(
    () => savedDiagrams?.find((d) => d.id === activeDiagramId) ?? null,
    [savedDiagrams, activeDiagramId]
  );

  // All tables for filtering
  const allTables = useMemo(
    () =>
      (erData?.tables ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        schema: t.schema,
      })),
    [erData]
  );

  const filteredTables = useMemo(() => {
    if (!tableFilterSearch.trim()) return allTables;
    const q = tableFilterSearch.toLowerCase();
    return allTables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.schema && t.schema.toLowerCase().includes(q))
    );
  }, [allTables, tableFilterSearch]);

  // Load a saved diagram
  const handleLoadDiagram = useCallback(
    (diagram: SavedDiagram) => {
      setActiveDiagram(diagram.id);

      let parsedIncluded: string[] | null = null;
      if (diagram.includedTables) {
        try {
          parsedIncluded = JSON.parse(diagram.includedTables);
        } catch { /* ignore */ }
      }

      let parsedAnnotations: Array<{ id: string; x: number; y: number; text: string; color: string }> = [];
      if (diagram.annotations) {
        try {
          parsedAnnotations = JSON.parse(diagram.annotations);
        } catch { /* ignore */ }
      }

      loadDiagramSettings({
        diagramType: diagram.diagramType as DiagramType,
        layoutDirection: diagram.layoutDirection as 'TB' | 'LR',
        showColumns: diagram.showColumns,
        showLabels: diagram.showLabels,
        colorBySchema: diagram.colorBySchema,
        includedTableIds: parsedIncluded,
        annotations: parsedAnnotations,
      });
    },
    [setActiveDiagram, loadDiagramSettings]
  );

  // Create new diagram
  const handleCreateDiagram = useCallback(() => {
    if (!projectId || !newDiagramName.trim()) return;
    createDiagram.mutate(
      {
        projectId,
        data: {
          name: newDiagramName.trim(),
          diagramType: newDiagramType,
        },
      },
      {
        onSuccess: (diagram) => {
          toast.success('Diagram created');
          setShowNewDialog(false);
          setNewDiagramName('');
          handleLoadDiagram(diagram);
        },
        onError: () => toast.error('Failed to create diagram'),
      }
    );
  }, [projectId, newDiagramName, newDiagramType, createDiagram, handleLoadDiagram]);

  // Delete diagram
  const handleDeleteDiagram = useCallback(
    (diagramId: string) => {
      if (!projectId) return;
      deleteDiagram.mutate(
        { projectId, diagramId },
        {
          onSuccess: () => {
            toast.success('Diagram deleted');
            if (activeDiagramId === diagramId) {
              resetToDefaults();
            }
          },
          onError: () => toast.error('Failed to delete diagram'),
        }
      );
    },
    [projectId, deleteDiagram, activeDiagramId, resetToDefaults]
  );

  // Duplicate diagram
  const handleDuplicateDiagram = useCallback(
    (diagramId: string) => {
      if (!projectId) return;
      duplicateDiagram.mutate(
        { projectId, diagramId },
        {
          onSuccess: () => toast.success('Diagram duplicated'),
          onError: () => toast.error('Failed to duplicate diagram'),
        }
      );
    },
    [projectId, duplicateDiagram]
  );

  // Rename diagram
  const handleStartRename = useCallback((diagram: SavedDiagram) => {
    setRenamingId(diagram.id);
    setRenameValue(diagram.name);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!projectId || !renamingId || !renameValue.trim()) return;
    updateDiagram.mutate(
      {
        projectId,
        diagramId: renamingId,
        data: { name: renameValue.trim() },
      },
      {
        onSuccess: () => {
          toast.success('Renamed');
          setRenamingId(null);
        },
        onError: () => toast.error('Failed to rename'),
      }
    );
  }, [projectId, renamingId, renameValue, updateDiagram]);

  // Switch diagram type without saving (ad-hoc)
  const handleSwitchType = useCallback(
    (type: DiagramType) => {
      setDiagramType(type);
      if (type === 'schema-group') {
        useERDiagramStore.getState().toggleColorBySchema();
      }
    },
    [setDiagramType]
  );

  // Toggle all tables
  const allSelected =
    includedTableIds === null || includedTableIds?.length === allTables.length;

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setIncludedTableIds([]);
    } else {
      setIncludedTableIds(null);
    }
  }, [allSelected, setIncludedTableIds]);

  if (isFullscreen) {
    return (
      <div className="h-screen w-screen">
        <ERCanvas activeDiagram={activeDiagram} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-card flex flex-col overflow-hidden">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <GitFork className="w-4 h-4 text-aqua-600" />
              Diagram Studio
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Saved Diagrams Section ─────────────────────────────────── */}
            <div className="border-b border-slate-100">
              <button
                onClick={() => setDiagramsExpanded(!diagramsExpanded)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-50"
              >
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Saved Diagrams
                </span>
                {diagramsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>

              {diagramsExpanded && (
                <div className="px-3 pb-3">
                  {/* New diagram button */}
                  <button
                    onClick={() => setShowNewDialog(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-lg hover:bg-aqua-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Diagram
                  </button>

                  {/* New diagram inline form */}
                  {showNewDialog && (
                    <div className="mb-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <input
                        autoFocus
                        type="text"
                        value={newDiagramName}
                        onChange={(e) => setNewDiagramName(e.target.value)}
                        placeholder="Diagram name..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-card focus:outline-none focus:border-aqua-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateDiagram();
                          if (e.key === 'Escape') setShowNewDialog(false);
                        }}
                      />
                      <select
                        value={newDiagramType}
                        onChange={(e) =>
                          setNewDiagramType(e.target.value as DiagramType)
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-card focus:outline-none focus:border-aqua-400"
                      >
                        {DIAGRAM_TYPES.map((dt) => (
                          <option key={dt.type} value={dt.type}>
                            {dt.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleCreateDiagram}
                          disabled={!newDiagramName.trim()}
                          className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-md hover:bg-aqua-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => setShowNewDialog(false)}
                          className="px-2 py-1.5 text-xs text-slate-500 bg-slate-100 rounded-md hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Diagram list */}
                  {diagramsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    </div>
                  ) : !savedDiagrams || savedDiagrams.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-slate-400 text-center">
                      No saved diagrams yet
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {savedDiagrams.map((d) => {
                        const isActive = activeDiagramId === d.id;
                        const typeConfig = DIAGRAM_TYPES.find(
                          (dt) => dt.type === d.diagramType
                        );
                        const TypeIcon = typeConfig?.icon ?? GitFork;

                        return (
                          <div
                            key={d.id}
                            className={cn(
                              'group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors',
                              isActive
                                ? 'bg-aqua-50 border border-aqua-200'
                                : 'hover:bg-slate-50 border border-transparent'
                            )}
                            onClick={() => handleLoadDiagram(d)}
                          >
                            <TypeIcon
                              className={cn(
                                'w-3.5 h-3.5 flex-shrink-0',
                                isActive ? 'text-aqua-600' : 'text-slate-400'
                              )}
                            />
                            {renamingId === d.id ? (
                              <div className="flex-1 flex items-center gap-1">
                                <input
                                  autoFocus
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) =>
                                    setRenameValue(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter')
                                      handleConfirmRename();
                                    if (e.key === 'Escape')
                                      setRenamingId(null);
                                  }}
                                  className="flex-1 px-1.5 py-0.5 text-xs border border-aqua-300 rounded bg-card focus:outline-none"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmRename();
                                  }}
                                  className="text-green-500 hover:text-green-600"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingId(null);
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={cn(
                                      'text-xs font-medium truncate',
                                      isActive
                                        ? 'text-aqua-700'
                                        : 'text-slate-700'
                                    )}
                                  >
                                    {d.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {typeConfig?.label}
                                  </p>
                                </div>
                                <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartRename(d);
                                    }}
                                    className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                                    title="Rename"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDuplicateDiagram(d.id);
                                    }}
                                    className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                                    title="Duplicate"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDiagram(d.id);
                                    }}
                                    className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Diagram Types Section ──────────────────────────────────── */}
            <div className="border-b border-slate-100">
              <button
                onClick={() => setTypesExpanded(!typesExpanded)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-50"
              >
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Diagram Types
                </span>
                {typesExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>

              {typesExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  {DIAGRAM_TYPES.map((dt) => {
                    const isActive = diagramType === dt.type;
                    return (
                      <button
                        key={dt.type}
                        onClick={() => handleSwitchType(dt.type)}
                        className={cn(
                          'w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
                          isActive
                            ? 'bg-aqua-50 border border-aqua-200'
                            : 'hover:bg-slate-50 border border-transparent'
                        )}
                      >
                        <dt.icon
                          className={cn(
                            'w-4 h-4 flex-shrink-0 mt-0.5',
                            isActive ? 'text-aqua-600' : 'text-slate-400'
                          )}
                        />
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-xs font-medium',
                              isActive ? 'text-aqua-700' : 'text-slate-700'
                            )}
                          >
                            {dt.label}
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                            {dt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Table Filter Section ───────────────────────────────────── */}
            <div>
              <button
                onClick={() => setTablesExpanded(!tablesExpanded)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-50"
              >
                <span className="flex items-center gap-1.5">
                  <Table2 className="w-3.5 h-3.5" />
                  Table Filter ({allTables.length})
                </span>
                {tablesExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>

              {tablesExpanded && (
                <div className="px-3 pb-3">
                  {/* Search + toggle all */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      type="text"
                      value={tableFilterSearch}
                      onChange={(e) => setTableFilterSearch(e.target.value)}
                      placeholder="Filter tables..."
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-card focus:outline-none focus:border-aqua-400"
                    />
                    <button
                      onClick={handleToggleAll}
                      className={cn(
                        'px-2 py-1.5 text-[10px] font-medium rounded-md border transition-colors',
                        allSelected
                          ? 'bg-aqua-50 text-aqua-700 border-aqua-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      )}
                      title={allSelected ? 'Deselect All' : 'Select All'}
                    >
                      All
                    </button>
                  </div>

                  {/* Table list */}
                  <div className="max-h-64 overflow-y-auto space-y-0.5">
                    {filteredTables.map((table) => {
                      const included =
                        includedTableIds === null ||
                        includedTableIds.includes(table.id);
                      return (
                        <button
                          key={table.id}
                          onClick={() => {
                            if (includedTableIds === null) {
                              // First exclusion: switch to explicit list
                              const allIds = allTables
                                .map((t) => t.id)
                                .filter((id) => id !== table.id);
                              setIncludedTableIds(allIds);
                            } else {
                              toggleTableInclusion(table.id);
                            }
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                            included
                              ? 'text-slate-700 hover:bg-slate-50'
                              : 'text-slate-400 hover:bg-slate-50'
                          )}
                        >
                          {included ? (
                            <Eye className="w-3 h-3 text-aqua-500 flex-shrink-0" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          )}
                          <span className="truncate">
                            {table.schema
                              ? `${table.schema}.${table.name}`
                              : table.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar toggle (when collapsed) ────────────────────────────── */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-2 left-2 z-20 w-8 h-8 rounded-lg bg-card border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          title="Open Sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* ── Canvas Area ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <ERCanvas activeDiagram={activeDiagram} />
      </div>
    </div>
  );
}

export default ErDiagram;
