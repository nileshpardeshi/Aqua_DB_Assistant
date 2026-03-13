import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Eye,
  PlayCircle,
  Trash2,
  ArrowUpRight,
  Check,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  AlertTriangle,
  Table2,
  BarChart3,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  useSandboxStatus,
  useSandboxTable,
  useExecuteSandbox,
  useCleanupSandbox,
  usePromoteSandbox,
  useCleanupPromoted,
} from '@/hooks/use-sandbox';

// ── Types ────────────────────────────────────────────────────────────────────

interface ColumnConfig {
  name: string;
  type: string;
  generator: string;
  params: Record<string, string>;
  isConstant?: boolean;
  constantValue?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

interface TableConfig {
  tableName: string;
  tableId?: string;
  rowCount: number;
  columns: ColumnConfig[];
  expanded: boolean;
}

interface DatagenTestPanelProps {
  generatedSQL: string;
  tables: TableConfig[];
  generateSampleValue: (generator: string, params: Record<string, string>, rowIndex: number, isConstant?: boolean, constantValue?: string) => string;
}

type TestTab = 'preview' | 'sandbox';

// ── Safe error message extraction ────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // Handle nested error objects like { message: { code, message } }
    if (obj.message && typeof obj.message === 'object') {
      const inner = obj.message as Record<string, unknown>;
      if (typeof inner.message === 'string') return inner.message;
      if (typeof inner.code === 'string') return inner.code;
    }
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    // Handle { code, message } directly
    if (typeof obj.code === 'string' && typeof (obj as Record<string, unknown>).message === 'undefined') return obj.code;
    try { return JSON.stringify(err); } catch { return String(err); }
  }
  return String(err);
}

// ── Pseudo-random for consistent preview ─────────────────────────────────────

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ── Quick Preview Data Generator (Client-side) ──────────────────────────────

function generatePreviewRows(
  columns: ColumnConfig[],
  rowCount: number,
  generateSample: DatagenTestPanelProps['generateSampleValue']
): Record<string, string>[] {
  const effectiveCount = Math.min(rowCount, 500); // Cap at 500 for browser performance
  const rows: Record<string, string>[] = [];

  for (let i = 0; i < effectiveCount; i++) {
    const row: Record<string, string> = {};
    for (const col of columns) {
      if (col.generator === 'Null') {
        row[col.name] = 'NULL';
      } else {
        row[col.name] = generateSample(
          col.generator,
          col.params,
          i,
          col.isConstant,
          col.constantValue
        );
      }
    }
    rows.push(row);
  }

  return rows;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DatagenTestPanel({
  generatedSQL,
  tables,
  generateSampleValue,
}: DatagenTestPanelProps) {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState<TestTab>('preview');
  const [previewTableIndex, setPreviewTableIndex] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const previewPageSize = 50;

  // Sandbox state
  const [sandboxBrowseTable, setSandboxBrowseTable] = useState<string | null>(null);
  const [sandboxPage, setSandboxPage] = useState(1);
  const sandboxPageSize = 50;

  // Hooks
  const { data: sandboxStatus, refetch: refetchStatus } = useSandboxStatus(projectId);
  const executeSandbox = useExecuteSandbox();
  const cleanupSandbox = useCleanupSandbox();
  const promoteSandbox = usePromoteSandbox();
  const cleanupPromoted = useCleanupPromoted();
  const { data: sandboxTableData, isLoading: tableDataLoading } = useSandboxTable(
    projectId,
    sandboxBrowseTable || undefined,
    sandboxPage,
    sandboxPageSize
  );

  // ── Quick Preview Data ───────────────────────────────────────────────────

  const currentPreviewTable = tables[previewTableIndex];
  const previewRows = useMemo(() => {
    if (!currentPreviewTable) return [];
    return generatePreviewRows(
      currentPreviewTable.columns,
      currentPreviewTable.rowCount,
      generateSampleValue
    );
  }, [currentPreviewTable, generateSampleValue]);

  const previewTotalPages = Math.ceil(previewRows.length / previewPageSize);
  const paginatedPreviewRows = previewRows.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );

  // ── Sandbox Handlers ─────────────────────────────────────────────────────

  const handleExecuteSandbox = async () => {
    if (!projectId || !generatedSQL) return;
    const tableNames = tables.map(t => t.tableName);
    const tableColumns = tables.map(t => ({
      tableName: t.tableName,
      columns: t.columns
        .filter(c => c.generator !== 'Null')
        .map(c => ({ name: c.name, type: c.type, isPrimaryKey: c.isPrimaryKey })),
    }));
    await executeSandbox.mutateAsync({ projectId, sql: generatedSQL, tableNames, tableColumns });
    refetchStatus();
    if (tableNames.length > 0) {
      setSandboxBrowseTable(tableNames[0]);
      setSandboxPage(1);
    }
  };

  const handleCleanup = async () => {
    if (!projectId) return;
    try {
      await cleanupSandbox.mutateAsync(projectId);
      setSandboxBrowseTable(null);
      executeSandbox.reset();
      promoteSandbox.reset();
      cleanupPromoted.reset();
      refetchStatus();
      toast.success('Sandbox schema dropped successfully');
    } catch {
      toast.error('Failed to cleanup sandbox');
    }
  };

  const handlePromote = async () => {
    if (!projectId) return;
    try {
      const tableNames = tables.map(t => t.tableName);
      const result = await promoteSandbox.mutateAsync({ projectId, tableNames });
      const succeeded = result.tables.filter(t => t.status === 'promoted').length;
      toast.success(`${succeeded}/${result.tables.length} tables promoted to real database`);
    } catch {
      toast.error('Failed to promote tables');
    }
  };

  const handleCleanupPromoted = async () => {
    if (!projectId) return;
    try {
      const tableNames = tables.map(t => t.tableName);

      // Drop promoted tables from real database
      const result = await cleanupPromoted.mutateAsync({ projectId, tableNames });
      const dropped = result.tables.filter(t => t.status === 'dropped').length;

      // Also cleanup the sandbox data
      await cleanupSandbox.mutateAsync(projectId);
      setSandboxBrowseTable(null);
      executeSandbox.reset();
      promoteSandbox.reset();
      refetchStatus();

      toast.success(`${dropped} real table${dropped !== 1 ? 's' : ''} dropped + sandbox cleaned up`);
    } catch {
      toast.error('Failed to cleanup tables');
    }
  };

  // ── No tables check ──────────────────────────────────────────────────────

  if (tables.length === 0) {
    return (
      <div className="mt-6 border border-dashed border-border rounded-lg p-8 text-center">
        <Table2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Select tables and configure generators to preview and test data</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mt-6 border border-border rounded-lg overflow-hidden bg-card">
      {/* Tab Header */}
      <div className="flex items-center border-b border-border bg-muted/50">
        <button
          onClick={() => setActiveTab('preview')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'preview'
              ? 'border-aqua-500 text-aqua-700 bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Eye className="w-4 h-4" />
          Quick Preview
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-aqua-100 text-aqua-700 rounded">
            In-Memory
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sandbox')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2',
            activeTab === 'sandbox'
              ? 'border-aqua-500 text-aqua-700 bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <PlayCircle className="w-4 h-4" />
          Sandbox Execute
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">
            PostgreSQL
          </span>
        </button>

        {/* Status indicators */}
        <div className="ml-auto pr-4 flex items-center gap-3">
          {activeTab === 'preview' && (
            <span className="text-[10px] text-muted-foreground">
              {previewRows.length} rows cached (max 500)
            </span>
          )}
          {activeTab === 'sandbox' && sandboxStatus?.exists && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Sandbox active · {sandboxStatus.tables.length} tables
            </span>
          )}
        </div>
      </div>

      {/* ═══════════════ QUICK PREVIEW TAB ═══════════════ */}
      {activeTab === 'preview' && (
        <div className="p-4">
          {/* Table Selector (if multi-table) */}
          {tables.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs text-muted-foreground font-medium">Table:</label>
              <div className="flex gap-1">
                {tables.map((t, idx) => (
                  <button
                    key={t.tableName}
                    onClick={() => { setPreviewTableIndex(idx); setPreviewPage(1); }}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
                      previewTableIndex === idx
                        ? 'bg-aqua-50 border-aqua-300 text-aqua-700'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    {t.tableName}
                    <span className="ml-1 text-muted-foreground">({Math.min(t.rowCount, 500)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview Stats */}
          {currentPreviewTable && (
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{currentPreviewTable.columns.length} columns</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Database className="w-3.5 h-3.5" />
                <span>{previewRows.length} rows generated</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3.5 h-3.5" />
                <span>Instant (client-side)</span>
              </div>
            </div>
          )}

          {/* Data Grid */}
          {currentPreviewTable && paginatedPreviewRows.length > 0 && (
            <>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
                      {currentPreviewTable.columns
                        .filter(c => c.generator !== 'Null')
                        .map((c, i) => (
                          <th key={i} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                            {c.name}
                            {c.isPrimaryKey && <span className="ml-1 text-blue-500 text-[9px]">PK</span>}
                            {c.isForeignKey && <span className="ml-1 text-amber-500 text-[9px]">FK</span>}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPreviewRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-border/50 last:border-b-0 hover:bg-muted/50">
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">
                          {(previewPage - 1) * previewPageSize + rowIdx + 1}
                        </td>
                        {currentPreviewTable.columns
                          .filter(c => c.generator !== 'Null')
                          .map((c, colIdx) => (
                            <td key={colIdx} className="px-3 py-1.5 text-foreground font-mono whitespace-nowrap max-w-[200px] truncate">
                              {row[c.name]}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {previewTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">
                    Page {previewPage} of {previewTotalPages} · {previewRows.length} total rows
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                      disabled={previewPage <= 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPreviewPage(p => Math.min(previewTotalPages, p + 1))}
                      disabled={previewPage >= previewTotalPages}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ SANDBOX EXECUTE TAB ═══════════════ */}
      {activeTab === 'sandbox' && (
        <div className="p-4 space-y-4">
          {/* Action Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleExecuteSandbox}
              disabled={!generatedSQL || executeSandbox.isPending}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                !generatedSQL || executeSandbox.isPending
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              )}
            >
              {executeSandbox.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
              ) : (
                <><PlayCircle className="w-4 h-4" /> Execute in Sandbox</>
              )}
            </button>

            {sandboxStatus?.exists && (
              <>
                <button
                  onClick={handlePromote}
                  disabled={promoteSandbox.isPending}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                    promoteSandbox.isPending
                      ? 'bg-muted text-muted-foreground border-border'
                      : 'text-blue-700 bg-blue-50 dark:bg-blue-950/30 border-blue-200 hover:bg-blue-100 dark:text-blue-300'
                  )}
                >
                  {promoteSandbox.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Promoting...</>
                  ) : (
                    <><ArrowUpRight className="w-3.5 h-3.5" /> Promote to Real Tables</>
                  )}
                </button>

                <button
                  onClick={handleCleanup}
                  disabled={cleanupSandbox.isPending}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                    cleanupSandbox.isPending
                      ? 'bg-muted text-muted-foreground border-border'
                      : 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 hover:bg-red-100 dark:text-red-400'
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Cleanup Sandbox
                </button>
              </>
            )}

            {/* Cleanup promoted real tables — always available if tables are configured */}
            {promoteSandbox.data && (
              <button
                onClick={handleCleanupPromoted}
                disabled={cleanupPromoted.isPending}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                  cleanupPromoted.isPending
                    ? 'bg-muted text-muted-foreground border-border'
                    : 'text-orange-700 bg-orange-50 dark:bg-orange-950/30 border-orange-200 hover:bg-orange-100 dark:text-orange-300'
                )}
              >
                {cleanupPromoted.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Dropping...</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" /> Cleanup Real Tables</>
                )}
              </button>
            )}

            {!generatedSQL && (
              <span className="text-xs text-muted-foreground italic">
                Generate SQL script first, then execute in sandbox
              </span>
            )}
          </div>

          {/* Execution Results */}
          {executeSandbox.data && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 rounded-lg border border-border">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Execution completed in {executeSandbox.data.totalDurationMs.toLocaleString()}ms
                </span>
                <span className="text-xs text-muted-foreground">
                  {executeSandbox.data.tables.filter(t => t.status === 'success').length}/{executeSandbox.data.tables.length} tables succeeded
                </span>
              </div>

              {/* Per-table results */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {executeSandbox.data.tables.map((result) => (
                  <div
                    key={result.tableName}
                    onClick={() => {
                      if (result.status === 'success') {
                        setSandboxBrowseTable(result.tableName);
                        setSandboxPage(1);
                      }
                    }}
                    className={cn(
                      'px-4 py-3 rounded-lg border transition-all',
                      result.status === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 cursor-pointer hover:border-emerald-400'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{result.tableName}</span>
                      {result.status === 'success' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className={cn(
                        'text-xs font-medium',
                        result.status === 'success' ? 'text-emerald-700' : 'text-red-700'
                      )}>
                        {result.status === 'success'
                          ? `${result.rowCount.toLocaleString()} rows`
                          : 'Failed'}
                      </span>
                      {result.durationMs > 0 && (
                        <span className="text-[10px] text-muted-foreground">{result.durationMs}ms</span>
                      )}
                    </div>
                    {result.error && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-red-700 leading-tight break-all">
                          {(() => { const msg = getErrorMessage(result.error); return msg.length > 200 ? msg.slice(0, 200) + '...' : msg; })()}
                        </p>
                      </div>
                    )}
                    {result.status === 'success' && (
                      <p className="mt-1 text-[10px] text-emerald-600">Click to browse data</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution Error */}
          {executeSandbox.error && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Execution Failed</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {getErrorMessage(executeSandbox.error)}
                </p>
              </div>
            </div>
          )}

          {/* Promote Results */}
          {promoteSandbox.data && (
            <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg">
              <ArrowUpRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Promotion Results</p>
                <div className="mt-1 space-y-1">
                  {promoteSandbox.data.tables.map(t => (
                    <p key={t.tableName} className={cn(
                      'text-xs',
                      t.status === 'promoted' ? 'text-blue-700' : 'text-red-700'
                    )}>
                      {t.status === 'promoted'
                        ? `${t.tableName}: ${t.rowCount.toLocaleString()} rows promoted to real table`
                        : `${t.tableName}: Failed — ${getErrorMessage(t.error)}`}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Cleanup Promoted Results */}
          {cleanupPromoted.data && (
            <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 rounded-lg">
              <Trash2 className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Cleanup Results</p>
                <div className="mt-1 space-y-1">
                  {cleanupPromoted.data.tables.map(t => (
                    <p key={t.tableName} className={cn(
                      'text-xs',
                      t.status === 'dropped' ? 'text-orange-700' : t.status === 'skipped' ? 'text-muted-foreground' : 'text-red-700'
                    )}>
                      {t.status === 'dropped'
                        ? `${t.tableName}: Dropped from real database`
                        : t.status === 'skipped'
                        ? `${t.tableName}: ${t.error}`
                        : `${t.tableName}: Failed — ${t.error}`}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data Browser */}
          {sandboxBrowseTable && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-foreground">
                    Sandbox Data: <span className="text-aqua-600">{sandboxBrowseTable}</span>
                  </h4>
                  {sandboxTableData && (
                    <span className="text-[10px] text-muted-foreground">
                      {sandboxTableData.totalCount.toLocaleString()} rows · {sandboxTableData.columns.length} columns
                    </span>
                  )}
                </div>

                {/* Table Switcher */}
                {sandboxStatus?.tables && sandboxStatus.tables.length > 1 && (
                  <div className="flex gap-1">
                    {sandboxStatus.tables.map(t => (
                      <button
                        key={t.tableName}
                        onClick={() => { setSandboxBrowseTable(t.tableName); setSandboxPage(1); }}
                        className={cn(
                          'px-2 py-0.5 text-[10px] font-medium rounded border transition-colors',
                          sandboxBrowseTable === t.tableName
                            ? 'bg-aqua-50 border-aqua-300 text-aqua-700'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        {t.tableName} ({t.rowCount})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {tableDataLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading data...</span>
                </div>
              ) : sandboxTableData && sandboxTableData.rows.length > 0 ? (
                <>
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
                          {sandboxTableData.columns.map((col, i) => (
                            <th key={i} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sandboxTableData.rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b border-border/50 last:border-b-0 hover:bg-muted/50">
                            <td className="px-3 py-1.5 text-muted-foreground font-mono">
                              {(sandboxPage - 1) * sandboxPageSize + rowIdx + 1}
                            </td>
                            {sandboxTableData.columns.map((col, colIdx) => {
                              const val = row[col];
                              const displayVal = val === null ? 'NULL'
                                : typeof val === 'object' ? JSON.stringify(val)
                                : String(val);
                              return (
                                <td
                                  key={colIdx}
                                  className={cn(
                                    'px-3 py-1.5 font-mono whitespace-nowrap max-w-[200px] truncate',
                                    val === null ? 'text-muted-foreground italic' : 'text-foreground'
                                  )}
                                  title={displayVal}
                                >
                                  {displayVal}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {sandboxTableData.totalCount > sandboxPageSize && (
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">
                        Page {sandboxPage} of {Math.ceil(sandboxTableData.totalCount / sandboxPageSize)} · {sandboxTableData.totalCount.toLocaleString()} total rows
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSandboxPage(p => Math.max(1, p - 1))}
                          disabled={sandboxPage <= 1}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSandboxPage(p => p + 1)}
                          disabled={sandboxPage * sandboxPageSize >= sandboxTableData.totalCount}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="border border-dashed border-border rounded-lg p-6 text-center">
                  <Database className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No data in sandbox table</p>
                </div>
              )}
            </div>
          )}

          {/* Sandbox Status (when no execution yet) */}
          {!executeSandbox.data && !executeSandbox.isPending && sandboxStatus && (
            <div className="border border-dashed border-border rounded-lg p-6 text-center">
              {sandboxStatus.exists ? (
                <>
                  <Database className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">Sandbox schema exists</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sandboxStatus.tables.length} table(s): {sandboxStatus.tables.map(t => `${t.tableName} (${t.rowCount})`).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click a table above to browse data, or re-execute to regenerate
                  </p>
                </>
              ) : (
                <>
                  <PlayCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {generatedSQL
                      ? 'Click "Execute in Sandbox" to test your generated SQL in a safe sandbox schema'
                      : 'Generate SQL first, then execute in sandbox to validate'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Creates <code className="bg-muted px-1 rounded">_datagen_sandbox</code> schema with mirrored tables · Real PostgreSQL execution · No impact on production data
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DatagenTestPanel;
