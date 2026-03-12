import { create } from 'zustand';

export interface EditorTab {
  id: string;
  title: string;
  sql: string;
  dialect: string;
  isDirty: boolean;
  savedQueryId?: string;
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string | null;
  addTab: (tab?: Partial<EditorTab>) => void;
  closeTab: (id: string) => void;
  updateTabSQL: (id: string, sql: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
}

function generateId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const defaultTabId = generateId();

export const useEditorStore = create<EditorStore>((set) => ({
  tabs: [
    {
      id: defaultTabId,
      title: 'Untitled Query',
      sql: '',
      dialect: 'postgresql',
      isDirty: false,
    },
  ],
  activeTabId: defaultTabId,

  addTab: (tab) => {
    const id = generateId();
    const newTab: EditorTab = {
      id,
      title: tab?.title || 'Untitled Query',
      sql: tab?.sql || '',
      dialect: tab?.dialect || 'postgresql',
      isDirty: false,
      savedQueryId: tab?.savedQueryId,
    };
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
  },

  closeTab: (id) =>
    set((state) => {
      const filtered = state.tabs.filter((t) => t.id !== id);
      if (filtered.length === 0) {
        // Always keep at least one tab
        const newId = generateId();
        return {
          tabs: [
            {
              id: newId,
              title: 'Untitled Query',
              sql: '',
              dialect: 'postgresql',
              isDirty: false,
            },
          ],
          activeTabId: newId,
        };
      }
      const activeTabId =
        state.activeTabId === id
          ? filtered[Math.max(0, filtered.length - 1)].id
          : state.activeTabId;
      return { tabs: filtered, activeTabId };
    }),

  updateTabSQL: (id, sql) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, sql, isDirty: true } : t
      ),
    })),

  setActiveTab: (id) => set({ activeTabId: id }),

  renameTab: (id, title) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, title } : t
      ),
    })),
}));
