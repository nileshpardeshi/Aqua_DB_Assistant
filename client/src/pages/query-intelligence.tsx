import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Play,
  Sparkles,
  Save,
  AlignLeft,
  History,
  Table2,
  Bot,
  Terminal,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDialect } from '@/config/constants';
import type { Project } from '@/hooks/use-projects';
import { useEditorStore } from '@/stores/use-editor-store';
import { useExecuteQuery, useSaveQuery } from '@/hooks/use-queries';
import { QueryTabBar } from '@/components/query/query-tab-bar';
import { SQLEditor } from '@/components/query/sql-editor';
import { QueryResultsTable } from '@/components/query/query-results-table';
import { QueryHistoryPanel } from '@/components/query/query-history-panel';
import { AIQueryAssistant } from '@/components/query/ai-query-assistant';

type BottomTab = 'results' | 'history' | 'ai-assistant';

export function QueryIntelligence() {
  const { project } = useOutletContext<{ project: Project }>();
  const dialect = project ? getDialect(project.dialect) : undefined;

  const { tabs, activeTabId, updateTabSQL } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const executeQuery = useExecuteQuery();
  const saveQuery = useSaveQuery();

  const [bottomTab, setBottomTab] = useState<BottomTab>('results');
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [resultRows, setResultRows] = useState<unknown[][]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRunQuery = async () => {
    if (!activeTab?.sql.trim() || !project?.id) return;
    setIsRunning(true);
    setBottomTab('results');
    setErrorMessage(null);

    const startTime = Date.now();

    try {
      const elapsed = Date.now() - startTime;

      await executeQuery.mutateAsync({
        projectId: project.id,
        data: {
          sql: activeTab.sql,
          dialect: project.dialect,
          savedQueryId: activeTab.savedQueryId,
          status: 'success',
          executionTime: elapsed,
          resultPreview: JSON.stringify({ columns: [], rows: [] }),
        },
      });

      // The server records the execution. Clear previous results and show
      // a confirmation that the execution was recorded.
      setResultColumns(['status', 'sql', 'execution_time_ms', 'recorded_at']);
      setResultRows([
        [
          'Execution recorded',
          activeTab.sql.length > 80
            ? activeTab.sql.substring(0, 80) + '...'
            : activeTab.sql,
          elapsed,
          new Date().toISOString(),
        ],
      ]);
      setHasResults(true);
      setExecutionTime(elapsed);
    } catch (err: unknown) {
      const elapsed = Date.now() - startTime;
      const message =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Query execution failed';

      // Still attempt to record the failed execution
      try {
        await executeQuery.mutateAsync({
          projectId: project.id,
          data: {
            sql: activeTab.sql,
            dialect: project.dialect,
            savedQueryId: activeTab.savedQueryId,
            status: 'error',
            executionTime: elapsed,
            errorMessage: message,
          },
        });
      } catch {
        // Silently ignore if recording also fails
      }

      setErrorMessage(message);
      setResultColumns(['error']);
      setResultRows([[message]]);
      setHasResults(true);
      setExecutionTime(elapsed);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!activeTab?.sql.trim() || !project?.id) return;
    setIsSaving(true);

    try {
      await saveQuery.mutateAsync({
        projectId: project.id,
        data: {
          title: activeTab.title || 'Untitled Query',
          sql: activeTab.sql,
          dialect: project.dialect,
          description: '',
        },
      });
    } catch {
      // Error handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormatQuery = () => {
    if (!activeTab?.sql.trim() || !activeTabId) return;
    // Simple formatting: uppercase keywords, trim whitespace
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'ON', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE',
      'ALTER TABLE', 'DROP TABLE', 'AS', 'IN', 'NOT', 'NULL', 'IS', 'LIKE',
      'BETWEEN', 'EXISTS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'DESC', 'ASC',
    ];
    let formatted = activeTab.sql;
    keywords.forEach((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      formatted = formatted.replace(regex, kw);
    });
    updateTabSQL(activeTabId, formatted);
  };

  const handleLoadQueryFromHistory = (sql: string) => {
    if (activeTabId) {
      updateTabSQL(activeTabId, sql);
      setBottomTab('results');
    }
  };

  const bottomTabs: { id: BottomTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'results', label: 'Results', icon: Table2 },
    { id: 'history', label: 'History', icon: History },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Query Tab Bar */}
      <QueryTabBar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* ===== TOP SECTION: Editor (60%) ===== */}
        <div className="flex flex-col" style={{ flex: '0 0 60%' }}>
          {/* Editor Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-border">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                SQL Editor
              </span>
              {dialect && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ml-2"
                  style={{
                    backgroundColor: `${dialect.color}15`,
                    color: dialect.color,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: dialect.color }}
                  />
                  {dialect.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* AI Assist Toggle */}
              <button
                onClick={() =>
                  setBottomTab(
                    bottomTab === 'ai-assistant' ? 'results' : 'ai-assistant'
                  )
                }
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  bottomTab === 'ai-assistant'
                    ? 'bg-aqua-50 text-aqua-700 border border-aqua-200'
                    : 'text-muted-foreground bg-white border border-input hover:bg-secondary'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Assist
              </button>

              {/* Format Button */}
              <button
                onClick={handleFormatQuery}
                disabled={!activeTab?.sql.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-white border border-input rounded-md hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <AlignLeft className="w-3.5 h-3.5" />
                Format
              </button>

              {/* Save Button */}
              <button
                onClick={handleSaveQuery}
                disabled={!activeTab?.sql.trim() || isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-white border border-input rounded-md hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </>
                )}
              </button>

              {/* Run Button */}
              <button
                onClick={handleRunQuery}
                disabled={isRunning || !activeTab?.sql.trim()}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white rounded-md transition-all shadow-sm',
                  isRunning || !activeTab?.sql.trim()
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-md'
                )}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Run
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SQL Editor */}
          <SQLEditor
            value={activeTab?.sql || ''}
            onChange={(sql) => {
              if (activeTabId) updateTabSQL(activeTabId, sql);
            }}
            onExecute={handleRunQuery}
            dialect={project?.dialect}
            className="flex-1"
          />
        </div>

        {/* ===== BOTTOM SECTION: Results / History / AI (40%) ===== */}
        <div className="flex flex-col border-t border-border bg-white" style={{ flex: '0 0 40%' }}>
          {/* Bottom Tab Bar */}
          <div className="flex items-center justify-between border-b border-border px-2 bg-slate-50">
            <div className="flex items-center gap-0.5">
              {bottomTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = bottomTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setBottomTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                      isActive
                        ? 'border-aqua-500 text-aqua-700 bg-white'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/50'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Execution time badge */}
            {hasResults && executionTime !== null && bottomTab === 'results' && (
              <div className="flex items-center gap-2 mr-2">
                {errorMessage && (
                  <span className="text-[10px] text-red-600 px-2 py-1 bg-red-50 rounded border border-red-200">
                    Error
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground px-2 py-1 bg-white rounded border border-border/50">
                  Executed in {executionTime}ms
                </span>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {bottomTab === 'results' && (
              <QueryResultsTable
                columns={hasResults ? resultColumns : []}
                rows={hasResults ? resultRows : []}
              />
            )}
            {bottomTab === 'history' && (
              <QueryHistoryPanel onLoadQuery={handleLoadQueryFromHistory} />
            )}
            {bottomTab === 'ai-assistant' && <AIQueryAssistant />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QueryIntelligence;
