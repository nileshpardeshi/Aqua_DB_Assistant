import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, FileCode2, Copy, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/use-editor-store';

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
}

export function QueryTabBar() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, renameTab } =
    useEditorStore();

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [contextMenu]);

  // Auto-focus edit input
  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  const handleCloseTab = (
    e: React.MouseEvent,
    tabId: string,
    isDirty: boolean,
  ) => {
    e.stopPropagation();
    if (isDirty) {
      const confirmed = window.confirm(
        'This query has unsaved changes. Close anyway?',
      );
      if (!confirmed) return;
    }
    closeTab(tabId);
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      setContextMenu({ tabId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleDoubleClick = useCallback(
    (tabId: string, currentTitle: string) => {
      setEditingTabId(tabId);
      setEditingTitle(currentTitle);
    },
    [],
  );

  const handleRenameSubmit = useCallback(() => {
    if (editingTabId && editingTitle.trim()) {
      renameTab(editingTabId, editingTitle.trim());
    }
    setEditingTabId(null);
    setEditingTitle('');
  }, [editingTabId, editingTitle, renameTab]);

  const handleDuplicate = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        addTab({
          title: tab.title + ' (Copy)',
          sql: tab.sql,
          dialect: tab.dialect,
        });
      }
      setContextMenu(null);
    },
    [tabs, addTab],
  );

  const handleCloseOthers = useCallback(
    (tabId: string) => {
      tabs.forEach((tab) => {
        if (tab.id !== tabId) closeTab(tab.id);
      });
      setActiveTab(tabId);
      setContextMenu(null);
    },
    [tabs, closeTab, setActiveTab],
  );

  const handleCloseAll = useCallback(() => {
    tabs.forEach((tab) => closeTab(tab.id));
    setContextMenu(null);
  }, [tabs, closeTab]);

  const handleRenameFromMenu = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        setEditingTabId(tabId);
        setEditingTitle(tab.title);
      }
      setContextMenu(null);
    },
    [tabs],
  );

  return (
    <div className="flex items-center bg-slate-100 border-b border-border overflow-x-auto relative">
      {/* Tabs */}
      <div className="flex items-center min-w-0 flex-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = editingTabId === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onDoubleClick={() => handleDoubleClick(tab.id, tab.title)}
              className={cn(
                'group flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 border-r border-border/50 transition-all duration-150 min-w-0 max-w-[200px] relative',
                isActive
                  ? 'bg-card text-foreground border-b-aqua-500 shadow-sm'
                  : 'bg-slate-50 text-muted-foreground border-b-transparent hover:bg-card/70 hover:text-foreground',
              )}
            >
              <FileCode2
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0',
                  isActive ? 'text-aqua-500' : 'text-slate-400',
                )}
              />
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') {
                      setEditingTabId(null);
                      setEditingTitle('');
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent border-b border-aqua-400 outline-none text-xs font-medium text-foreground px-0 py-0"
                />
              ) : (
                <span className="truncate">
                  {tab.title}
                  {tab.isDirty && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-aqua-500 ml-1.5 align-middle" />
                  )}
                </span>
              )}
              <span
                onClick={(e) => handleCloseTab(e, tab.id, tab.isDirty)}
                className={cn(
                  'flex-shrink-0 p-0.5 rounded hover:bg-slate-200 transition-colors ml-1',
                  isActive
                    ? 'opacity-70 hover:opacity-100'
                    : 'opacity-0 group-hover:opacity-70 hover:!opacity-100',
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
        className="flex items-center justify-center w-9 h-9 mx-1 text-muted-foreground hover:text-foreground hover:bg-card rounded-md transition-colors flex-shrink-0"
        title="New Query Tab"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleRenameFromMenu(contextMenu.tabId)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
            Rename
          </button>
          <button
            onClick={() => handleDuplicate(contextMenu.tabId)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            Duplicate
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => handleCloseOthers(contextMenu.tabId)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
            Close Others
          </button>
          <button
            onClick={handleCloseAll}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Close All
          </button>
        </div>
      )}
    </div>
  );
}

export default QueryTabBar;
