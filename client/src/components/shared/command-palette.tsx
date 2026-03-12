import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Settings,
  Database,
  Terminal,
  Plus,
  Upload,
  Bot,
  Sparkles,
  Gauge,
  GitBranch,
  Shield,
  FileText,
  ArrowRight,
  Command,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/use-project-store';
import { useUIStore } from '@/stores/use-ui-store';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'navigation' | 'project' | 'ai' | 'tools';
  shortcut?: string;
  action: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  recent: 'Recent',
  navigation: 'Navigation',
  project: 'Project',
  ai: 'AI Assistant',
  tools: 'Tools',
};

const MAX_RECENT = 5;
const RECENT_STORAGE_KEY = 'aqua-command-palette-recent';

function getRecentCommands(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentCommand(id: string) {
  try {
    const recent = getRecentCommands().filter((r) => r !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // Ignore storage errors
  }
}

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Simple substring match plus word-boundary awareness
  if (lowerText.includes(lowerQuery)) return true;

  // Fuzzy: check if all chars exist in order
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      qi++;
    }
  }
  return qi === lowerQuery.length;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { activeProjectId } = useProjectStore();
  const { toggleAiPanel } = useUIStore();

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const projectPrefix = activeProjectId ? `/project/${activeProjectId}` : '';

    const items: CommandItem[] = [
      // Navigation
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        description: 'Main dashboard with all projects',
        icon: LayoutDashboard,
        category: 'navigation',
        action: () => navigate('/'),
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        description: 'Application and AI provider settings',
        icon: Settings,
        category: 'navigation',
        action: () => navigate('/settings'),
      },
      {
        id: 'nav-schema',
        label: 'Go to Schema',
        description: 'Schema Intelligence module',
        icon: Database,
        category: 'navigation',
        action: () => navigate(projectPrefix ? `${projectPrefix}/schema` : '/'),
      },
      {
        id: 'nav-query',
        label: 'Go to Query Editor',
        description: 'Query Intelligence module',
        icon: Terminal,
        category: 'navigation',
        action: () => navigate(projectPrefix ? `${projectPrefix}/query` : '/'),
      },
      {
        id: 'nav-performance',
        label: 'Go to Performance Lab',
        description: 'Performance analysis and benchmarking',
        icon: Gauge,
        category: 'navigation',
        action: () => navigate(projectPrefix ? `${projectPrefix}/performance` : '/'),
      },
      {
        id: 'nav-migrations',
        label: 'Go to Migration Studio',
        description: 'Schema migration management',
        icon: GitBranch,
        category: 'navigation',
        action: () => navigate(projectPrefix ? `${projectPrefix}/migrations` : '/'),
      },
      {
        id: 'nav-data-lifecycle',
        label: 'Go to Data Lifecycle',
        description: 'Data retention and compliance',
        icon: Shield,
        category: 'navigation',
        action: () => navigate(projectPrefix ? `${projectPrefix}/data-lifecycle` : '/'),
      },
      {
        id: 'nav-audit-logs',
        label: 'Go to Audit Logs',
        description: 'View system audit logs',
        icon: FileText,
        category: 'navigation',
        action: () => navigate('/audit-logs'),
      },

      // Project
      {
        id: 'proj-create',
        label: 'Create New Project',
        description: 'Start a new database project',
        icon: Plus,
        category: 'project',
        shortcut: 'Ctrl+N',
        action: () => navigate('/'),
      },
      {
        id: 'proj-upload',
        label: 'Upload SQL File',
        description: 'Import SQL files to parse schemas',
        icon: Upload,
        category: 'project',
        action: () => navigate(projectPrefix ? `${projectPrefix}/schema` : '/'),
      },

      // AI
      {
        id: 'ai-chat',
        label: 'Open AI Chat',
        description: 'Start an AI conversation',
        icon: Bot,
        category: 'ai',
        action: () => toggleAiPanel(),
      },
      {
        id: 'ai-generate-sql',
        label: 'Generate SQL',
        description: 'Use AI to generate SQL queries',
        icon: Sparkles,
        category: 'ai',
        action: () => {
          toggleAiPanel();
        },
      },
      {
        id: 'ai-optimize',
        label: 'Optimize Query',
        description: 'AI-powered query optimization',
        icon: Gauge,
        category: 'ai',
        action: () => navigate(projectPrefix ? `${projectPrefix}/query` : '/'),
      },

      // Tools
      {
        id: 'tools-export-schema',
        label: 'Export Schema',
        description: 'Export schema as SQL or JSON',
        icon: FileText,
        category: 'tools',
        action: () => navigate(projectPrefix ? `${projectPrefix}/schema` : '/'),
      },
      {
        id: 'tools-compare',
        label: 'Compare Schemas',
        description: 'Diff two schema versions side by side',
        icon: GitBranch,
        category: 'tools',
        action: () => navigate(projectPrefix ? `${projectPrefix}/migrations` : '/'),
      },
    ];

    return items;
  }, [activeProjectId, navigate, toggleAiPanel]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then all by category
      const recentIds = getRecentCommands();
      const recentItems = recentIds
        .map((id) => commands.find((c) => c.id === id))
        .filter(Boolean) as CommandItem[];

      return { recent: recentItems, all: commands };
    }

    const matches = commands.filter(
      (cmd) =>
        fuzzyMatch(cmd.label, query) ||
        fuzzyMatch(cmd.description || '', query) ||
        fuzzyMatch(cmd.category, query)
    );

    return { recent: [], all: matches };
  }, [query, commands]);

  // Flatten for keyboard navigation
  const flatList = useMemo(() => {
    const list: CommandItem[] = [];
    if (filteredCommands.recent.length > 0) {
      list.push(...filteredCommands.recent);
    }
    // Add remaining (excluding recent duplicates)
    const recentIds = new Set(filteredCommands.recent.map((r) => r.id));
    const remaining = filteredCommands.all.filter((c) => !recentIds.has(c.id));
    list.push(...remaining);
    return list;
  }, [filteredCommands]);

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Slight delay so modal renders first
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    const selected = items[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      addRecentCommand(cmd.id);
      setOpen(false);
      cmd.action();
    },
    []
  );

  // Handle keyboard navigation within the list
  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatList.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatList.length) % flatList.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (flatList[selectedIndex]) {
          executeCommand(flatList[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  if (!open) return null;

  // Group items by category for display
  const recentIds = new Set(filteredCommands.recent.map((r) => r.id));
  const categorized: Record<string, CommandItem[]> = {};

  if (filteredCommands.recent.length > 0) {
    categorized['recent'] = filteredCommands.recent;
  }

  const remaining = filteredCommands.all.filter((c) => !recentIds.has(c.id));
  for (const cmd of remaining) {
    if (!categorized[cmd.category]) {
      categorized[cmd.category] = [];
    }
    categorized[cmd.category].push(cmd);
  }

  // Build a flat index map for highlight tracking
  let flatIndex = 0;
  const categoryEntries = Object.entries(categorized);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
        onClick={() => setOpen(false)}
      />

      {/* Command Palette Modal */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh]">
        <div
          className="w-full max-w-lg bg-card rounded-xl shadow-2xl border border-border overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Type a command or search..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-slate-100 border border-slate-200 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {flatList.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No commands found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
              </div>
            ) : (
              categoryEntries.map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_LABELS[category] || category}
                    </p>
                  </div>
                  {items.map((cmd) => {
                    const currentIndex = flatIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <button
                        key={cmd.id}
                        data-command-item
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'bg-aqua-50 text-aqua-700'
                            : 'text-foreground hover:bg-slate-50'
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                            isSelected ? 'bg-aqua-100' : 'bg-slate-100'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4',
                              isSelected ? 'text-aqua-600' : 'text-slate-500'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cmd.label}</p>
                          {cmd.description && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {cmd.description}
                            </p>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-slate-100 border border-slate-200 rounded flex-shrink-0">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-aqua-500 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-slate-50">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ChevronUp className="w-3 h-3" />
                <ChevronDown className="w-3 h-3" />
                Navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3" />
                Select
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] font-mono">ESC</span>
                Close
              </span>
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Command className="w-3 h-3" />
              <span>K to toggle</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CommandPalette;
