import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────────────

type LayoutDirection = 'TB' | 'LR';

interface ERDiagramState {
  selectedNodeIds: string[];
  showColumns: boolean;
  showRelationshipLabels: boolean;
  layoutDirection: LayoutDirection;

  selectNode: (nodeId: string, multi?: boolean) => void;
  clearSelection: () => void;
  toggleColumns: () => void;
  toggleLabels: () => void;
  setLayoutDirection: (direction: LayoutDirection) => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useERDiagramStore = create<ERDiagramState>((set) => ({
  selectedNodeIds: [],
  showColumns: true,
  showRelationshipLabels: true,
  layoutDirection: 'TB',

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

  toggleColumns: () =>
    set((state) => ({ showColumns: !state.showColumns })),

  toggleLabels: () =>
    set((state) => ({
      showRelationshipLabels: !state.showRelationshipLabels,
    })),

  setLayoutDirection: (direction) =>
    set({ layoutDirection: direction }),
}));
