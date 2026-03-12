import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: Theme;
  aiPanelOpen: boolean;
  notificationOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setTheme: (theme: Theme) => void;
  toggleAiPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  toggleNotification: () => void;
  setNotificationOpen: (open: boolean) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('aqua-db-theme');
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 'light';
}

// Apply theme on load (before React renders)
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: initialTheme,
  aiPanelOpen: false,
  notificationOpen: false,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    try {
      localStorage.setItem('aqua-db-theme', theme);
    } catch {
      // localStorage unavailable
    }
  },

  toggleAiPanel: () =>
    set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),

  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),

  toggleNotification: () =>
    set((state) => ({ notificationOpen: !state.notificationOpen })),

  setNotificationOpen: (open) => set({ notificationOpen: open }),
}));
