import { create } from 'zustand';
import type { DiagramType } from '@/hooks/use-saved-diagrams';

// ── Types ────────────────────────────────────────────────────────────────────

type LayoutDirection = 'TB' | 'LR';

export interface Annotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface ERDiagramState {
  // Active diagram
  activeDiagramId: string | null;
  diagramType: DiagramType;

  // Visual settings
  selectedNodeIds: string[];
  showColumns: boolean;
  showRelationshipLabels: boolean;
  layoutDirection: LayoutDirection;
  colorBySchema: boolean;
  snapToGrid: boolean;
  isFullscreen: boolean;

  // Table filtering
  includedTableIds: string[] | null; // null = all tables
  searchQuery: string;

  // Annotations
  annotations: Annotation[];
  isAnnotationMode: boolean;

  // Position history (undo)
  positionHistory: Array<Record<string, { x: number; y: number }>>;
  positionHistoryIndex: number;

  // Actions — diagram selection
  setActiveDiagram: (id: string | null) => void;
  setDiagramType: (type: DiagramType) => void;

  // Actions — node selection
  selectNode: (nodeId: string, multi?: boolean) => void;
  clearSelection: () => void;

  // Actions — visual settings
  toggleColumns: () => void;
  toggleLabels: () => void;
  setLayoutDirection: (direction: LayoutDirection) => void;
  toggleColorBySchema: () => void;
  toggleSnapToGrid: () => void;
  toggleFullscreen: () => void;

  // Actions — table filtering
  setIncludedTableIds: (ids: string[] | null) => void;
  toggleTableInclusion: (tableId: string) => void;
  setSearchQuery: (query: string) => void;

  // Actions — annotations
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  toggleAnnotationMode: () => void;

  // Actions — position history
  pushPositionSnapshot: (positions: Record<string, { x: number; y: number }>) => void;
  undoPositions: () => Record<string, { x: number; y: number }> | null;
  redoPositions: () => Record<string, { x: number; y: number }> | null;

  // Actions — bulk load (from saved diagram)
  loadDiagramSettings: (settings: {
    diagramType?: DiagramType;
    layoutDirection?: LayoutDirection;
    showColumns?: boolean;
    showLabels?: boolean;
    colorBySchema?: boolean;
    includedTableIds?: string[] | null;
    annotations?: Annotation[];
  }) => void;

  resetToDefaults: () => void;
}

const MAX_HISTORY = 30;

// ── Store ────────────────────────────────────────────────────────────────────

export const useERDiagramStore = create<ERDiagramState>((set, get) => ({
  activeDiagramId: null,
  diagramType: 'er-full',

  selectedNodeIds: [],
  showColumns: true,
  showRelationshipLabels: true,
  layoutDirection: 'TB',
  colorBySchema: false,
  snapToGrid: false,
  isFullscreen: false,

  includedTableIds: null,
  searchQuery: '',

  annotations: [],
  isAnnotationMode: false,

  positionHistory: [],
  positionHistoryIndex: -1,

  // ── Diagram selection ──────────────────────────────────────────────
  setActiveDiagram: (id) => set({ activeDiagramId: id }),
  setDiagramType: (type) => set({ diagramType: type }),

  // ── Node selection ─────────────────────────────────────────────────
  selectNode: (nodeId, multi = false) =>
    set((state) => {
      if (multi) {
        const exists = state.selectedNodeIds.includes(nodeId);
        return {
          selectedNodeIds: exists
            ? state.selectedNodeIds.filter((id) => id !== nodeId)
            : [...state.selectedNodeIds, nodeId],
        };
      }
      return { selectedNodeIds: [nodeId] };
    }),

  clearSelection: () => set({ selectedNodeIds: [] }),

  // ── Visual settings ────────────────────────────────────────────────
  toggleColumns: () => set((s) => ({ showColumns: !s.showColumns })),
  toggleLabels: () => set((s) => ({ showRelationshipLabels: !s.showRelationshipLabels })),
  setLayoutDirection: (direction) => set({ layoutDirection: direction }),
  toggleColorBySchema: () => set((s) => ({ colorBySchema: !s.colorBySchema })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),

  // ── Table filtering ────────────────────────────────────────────────
  setIncludedTableIds: (ids) => set({ includedTableIds: ids }),
  toggleTableInclusion: (tableId) =>
    set((state) => {
      const current = state.includedTableIds;
      if (current === null) return state;
      const exists = current.includes(tableId);
      return {
        includedTableIds: exists
          ? current.filter((id) => id !== tableId)
          : [...current, tableId],
      };
    }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // ── Annotations ────────────────────────────────────────────────────
  addAnnotation: (annotation) =>
    set((s) => ({ annotations: [...s.annotations, annotation] })),
  updateAnnotation: (id, updates) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
  removeAnnotation: (id) =>
    set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),
  toggleAnnotationMode: () => set((s) => ({ isAnnotationMode: !s.isAnnotationMode })),

  // ── Position history ───────────────────────────────────────────────
  pushPositionSnapshot: (positions) =>
    set((s) => {
      const newHistory = [
        ...s.positionHistory.slice(0, s.positionHistoryIndex + 1),
        positions,
      ].slice(-MAX_HISTORY);
      return {
        positionHistory: newHistory,
        positionHistoryIndex: newHistory.length - 1,
      };
    }),

  undoPositions: () => {
    const state = get();
    if (state.positionHistoryIndex <= 0) return null;
    const newIndex = state.positionHistoryIndex - 1;
    set({ positionHistoryIndex: newIndex });
    return state.positionHistory[newIndex];
  },

  redoPositions: () => {
    const state = get();
    if (state.positionHistoryIndex >= state.positionHistory.length - 1) return null;
    const newIndex = state.positionHistoryIndex + 1;
    set({ positionHistoryIndex: newIndex });
    return state.positionHistory[newIndex];
  },

  // ── Bulk load ──────────────────────────────────────────────────────
  loadDiagramSettings: (settings) =>
    set({
      diagramType: settings.diagramType ?? 'er-full',
      layoutDirection: (settings.layoutDirection as LayoutDirection) ?? 'TB',
      showColumns: settings.showColumns ?? true,
      showRelationshipLabels: settings.showLabels ?? true,
      colorBySchema: settings.colorBySchema ?? false,
      includedTableIds: settings.includedTableIds ?? null,
      annotations: settings.annotations ?? [],
      positionHistory: [],
      positionHistoryIndex: -1,
    }),

  resetToDefaults: () =>
    set({
      activeDiagramId: null,
      diagramType: 'er-full',
      selectedNodeIds: [],
      showColumns: true,
      showRelationshipLabels: true,
      layoutDirection: 'TB',
      colorBySchema: false,
      snapToGrid: false,
      isFullscreen: false,
      includedTableIds: null,
      searchQuery: '',
      annotations: [],
      isAnnotationMode: false,
      positionHistory: [],
      positionHistoryIndex: -1,
    }),
}));
