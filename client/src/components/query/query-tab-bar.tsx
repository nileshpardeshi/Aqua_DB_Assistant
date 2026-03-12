import { Plus, X, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/use-editor-store';

export function QueryTabBar() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } =
    useEditorStore();

  const handleCloseTab = (
    e: React.MouseEvent,
    tabId: string,
    isDirty: boolean
  ) => {
    e.stopPropagation();
    if (isDirty) {
      const confirmed = window.confirm(
        'This query has unsaved changes. Close anyway?'
      );
      if (!confirmed) return;
    }
    closeTab(tabId);
  };

  return (
    <div className="flex items-center bg-slate-100 border-b border-border overflow-x-auto">
      {/* Tabs */}
      <div className="flex items-center min-w-0 flex-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'group flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 border-r border-border/50 transition-all duration-150 min-w-0 max-w-[200px] relative',
                isActive
                  ? 'bg-white text-foreground border-b-aqua-500 shadow-sm'
                  : 'bg-slate-50 text-muted-foreground border-b-transparent hover:bg-white/70 hover:text-foreground'
              )}
            >
              <FileCode2
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0',
                  isActive ? 'text-aqua-500' : 'text-slate-400'
                )}
              />
              <span className="truncate">
                {tab.title}
                {tab.isDirty && (
                  <span className="text-aqua-500 ml-0.5">*</span>
                )}
              </span>
              <span
                onClick={(e) => handleCloseTab(e, tab.id, tab.isDirty)}
                className={cn(
                  'flex-shrink-0 p-0.5 rounded hover:bg-slate-200 transition-colors ml-1',
                  isActive
                    ? 'opacity-70 hover:opacity-100'
                    : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'
                )}
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Tab Button */}
      <button
        onClick={() => addTab()}
        className="flex items-center justify-center w-9 h-9 mx-1 text-muted-foreground hover:text-foreground hover:bg-white rounded-md transition-colors flex-shrink-0"
        title="New Query Tab"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export default QueryTabBar;
