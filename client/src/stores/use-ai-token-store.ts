import { create } from 'zustand';

export interface AIUsageEntry {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  module: string;
  timestamp: number;
}

interface AITokenState {
  sessionTokens: number;
  sessionCost: number;
  sessionCallCount: number;
  lastUsage: AIUsageEntry | null;
  recentCalls: AIUsageEntry[];
  addUsage: (entry: AIUsageEntry) => void;
  resetSession: () => void;
}

function loadFromSession(): Pick<AITokenState, 'sessionTokens' | 'sessionCost' | 'sessionCallCount' | 'recentCalls'> {
  try {
    const stored = sessionStorage.getItem('aqua-ai-tokens');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        sessionTokens: parsed.sessionTokens ?? 0,
        sessionCost: parsed.sessionCost ?? 0,
        sessionCallCount: parsed.sessionCallCount ?? 0,
        recentCalls: Array.isArray(parsed.recentCalls) ? parsed.recentCalls : [],
      };
    }
  } catch {
    // sessionStorage unavailable
  }
  return { sessionTokens: 0, sessionCost: 0, sessionCallCount: 0, recentCalls: [] };
}

function saveToSession(state: Pick<AITokenState, 'sessionTokens' | 'sessionCost' | 'sessionCallCount' | 'recentCalls'>) {
  try {
    sessionStorage.setItem('aqua-ai-tokens', JSON.stringify(state));
  } catch {
    // sessionStorage unavailable
  }
}

const initial = loadFromSession();

export const useAITokenStore = create<AITokenState>((set) => ({
  sessionTokens: initial.sessionTokens,
  sessionCost: initial.sessionCost,
  sessionCallCount: initial.sessionCallCount,
  lastUsage: null,
  recentCalls: initial.recentCalls,

  addUsage: (entry) =>
    set((state) => {
      const updated = {
        sessionTokens: state.sessionTokens + entry.totalTokens,
        sessionCost: state.sessionCost + entry.cost,
        sessionCallCount: state.sessionCallCount + 1,
        lastUsage: entry,
        recentCalls: [entry, ...state.recentCalls].slice(0, 50),
      };
      saveToSession(updated);
      return updated;
    }),

  resetSession: () => {
    const empty = { sessionTokens: 0, sessionCost: 0, sessionCallCount: 0, recentCalls: [] as AIUsageEntry[] };
    saveToSession(empty);
    set({ ...empty, lastUsage: null });
  },
}));
