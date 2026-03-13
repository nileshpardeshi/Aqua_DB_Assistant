import { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Download,
  Filter,
  Calendar,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Search,
  Zap,
  Play,
  Import,
  X,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAuditLogs, type AuditLogFilters } from '@/hooks/use-audit-logs';

const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  CREATE: { label: 'Create', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800', icon: Plus },
  UPDATE: { label: 'Update', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800', icon: Pencil },
  DELETE: { label: 'Delete', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800', icon: Trash2 },
  VIEW: { label: 'View', color: 'text-foreground', bg: 'bg-muted/50 border-border', icon: Eye },
  EXPORT: { label: 'Export', color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800', icon: Download },
  UPLOAD: { label: 'Upload', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800', icon: Upload },
  ANALYZE: { label: 'Analyze', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800', icon: Zap },
  EXECUTE: { label: 'Execute', color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800', icon: Play },
  IMPORT: { label: 'Import', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800', icon: Import },
};

// Normalize action from backend formats like "project.create" or "schema.parse" → "CREATE"/"ANALYZE"
function normalizeAction(raw: string): string {
  const upper = raw.toUpperCase();
  // Direct match
  if (ACTION_CONFIG[upper]) return upper;
  // Dot format: "project.create" → extract verb after dot
  const parts = raw.split('.');
  if (parts.length >= 2) {
    const verb = parts[parts.length - 1].toUpperCase();
    if (verb === 'PARSE') return 'ANALYZE';
    if (ACTION_CONFIG[verb]) return verb;
  }
  return upper;
}

const ENTITY_TYPES = [
  { value: '', label: 'All Entity Types' },
  { value: 'project', label: 'Project' },
  { value: 'schema', label: 'Schema' },
  { value: 'query', label: 'Query' },
  { value: 'file', label: 'File' },
  { value: 'migration', label: 'Migration' },
  { value: 'connection', label: 'Connection' },
  { value: 'settings', label: 'Settings' },
  { value: 'diagram', label: 'Diagram' },
  { value: 'awr-analysis', label: 'AWR Analysis' },
  { value: 'incident-analysis', label: 'Incident Analysis' },
  { value: 'dr-assessment', label: 'DR Assessment' },
  { value: 'cost-assessment', label: 'Cost Assessment' },
  { value: 'data-lifecycle', label: 'Data Lifecycle' },
  { value: 'data-migration', label: 'Data Migration' },
  { value: 'dialect-conversion', label: 'Dialect Conversion' },
  { value: 'ai-analysis', label: 'AI Analysis' },
];

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'ANALYZE', label: 'Analyze' },
  { value: 'EXECUTE', label: 'Execute' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'UPLOAD', label: 'Upload' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'VIEW', label: 'View' },
];

// Friendly entity label
function entityLabel(raw?: string): string {
  if (!raw) return '—';
  // Convert kebab-case / dot-case to Title Case
  return raw
    .replace(/[-_.]/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

interface AuditLogViewerProps {
  projectId?: string;
  compact?: boolean;
}

export function AuditLogViewer({ projectId, compact = false }: AuditLogViewerProps) {
  const [filters, setFilters] = useState<AuditLogFilters>({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: compact ? 5 : 15,
    projectId,
  });
  const [searchText, setSearchText] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(!compact);

  const { data: response, isLoading } = useAuditLogs(filters);
  const allLogs = response?.data ?? [];
  const meta = response?.meta ?? { total: 0, page: 1, limit: 15, totalPages: 1 };

  // Client-side text search over details + entity
  const logs = searchText.trim()
    ? allLogs.filter((log) => {
        const term = searchText.toLowerCase();
        return (
          (log.details || '').toLowerCase().includes(term) ||
          (log.entityType || '').toLowerCase().includes(term) ||
          (log.action || '').toLowerCase().includes(term) ||
          (log.entityId || '').toLowerCase().includes(term)
        );
      })
    : allLogs;

  function toggleExpanded(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleFilterChange(key: keyof AuditLogFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function clearFilters() {
    setFilters({ action: '', entityType: '', startDate: '', endDate: '', page: 1, limit: compact ? 5 : 15, projectId });
    setSearchText('');
  }

  const hasActiveFilters = !!(filters.action || filters.entityType || filters.startDate || filters.endDate || searchText.trim());

  function exportToCsv() {
    if (!logs.length) return;

    const headers = ['Timestamp', 'Action', 'Entity Type', 'Details', 'Entity ID', 'Project ID', 'IP Address'];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.action,
      log.entityType || '',
      `"${(log.details || '').replace(/"/g, '""')}"`,
      log.entityId || '',
      log.projectId || '',
      log.ipAddress || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {!compact && (
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                showFilters
                  ? 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-300'
                  : 'bg-card border-border text-foreground hover:bg-muted/50'
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 rounded-lg border border-border transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {meta.total} total entries
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-48 pl-8 pr-3 py-2 text-sm bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-muted-foreground"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <button
            onClick={exportToCsv}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && !compact && (
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Action Type */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Action
              </label>
              <div className="relative">
                <select
                  value={filters.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent appearance-none cursor-pointer"
                >
                  {ACTION_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Entity Type */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Entity Type
              </label>
              <div className="relative">
                <select
                  value={filters.entityType || ''}
                  onChange={(e) => handleFilterChange('entityType', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent appearance-none cursor-pointer"
                >
                  {ENTITY_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                From Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                To Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Entries */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No audit log entries found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveFilters ? 'Try adjusting your filters or search term' : 'Actions will appear here as you use the platform'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {logs.map((log) => {
              const isExpanded = expandedRows.has(log.id);
              const normalizedAction = normalizeAction(log.action);
              const actionCfg = ACTION_CONFIG[normalizedAction] || ACTION_CONFIG.VIEW;
              const ActionIcon = actionCfg.icon;

              return (
                <div key={log.id} className="hover:bg-muted/30 transition-colors">
                  <button
                    onClick={() => toggleExpanded(log.id)}
                    className="flex items-center gap-4 w-full px-5 py-3.5 text-left"
                  >
                    {/* Expand indicator */}
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 w-36">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(log.createdAt)}
                      </p>
                    </div>

                    {/* Action Badge */}
                    <div className="flex-shrink-0 w-24">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                          actionCfg.bg,
                          actionCfg.color
                        )}
                      >
                        <ActionIcon className="w-3 h-3" />
                        {actionCfg.label}
                      </span>
                    </div>

                    {/* Entity Type */}
                    <div className="flex-shrink-0 w-28">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                        {entityLabel(log.entityType)}
                      </span>
                    </div>

                    {/* Details summary */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {log.details || log.entityType || '—'}
                      </p>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pl-14">
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2.5">
                        {log.details && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              Details
                            </p>
                            <p className="text-sm text-foreground">{log.details}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 pt-1">
                          {log.entityId && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                                Entity ID
                              </p>
                              <p className="text-xs text-foreground font-mono">{log.entityId}</p>
                            </div>
                          )}
                          {log.projectId && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                                Project ID
                              </p>
                              <p className="text-xs text-foreground font-mono">{log.projectId}</p>
                            </div>
                          )}
                          {log.ipAddress && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                                IP Address
                              </p>
                              <p className="text-xs text-foreground font-mono">{log.ipAddress}</p>
                            </div>
                          )}
                          {log.userAgent && (
                            <div>
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                                User Agent
                              </p>
                              <p className="text-xs text-foreground font-mono truncate max-w-xs">{log.userAgent}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                              Timestamp
                            </p>
                            <p className="text-xs text-foreground">
                              {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Page {meta.page} of {meta.totalPages} ({meta.total} entries)
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={meta.page <= 1}
                onClick={() => handlePageChange(meta.page - 1)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm text-muted-foreground hover:bg-card hover:text-foreground border border-transparent hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(meta.totalPages, 7) }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    page === meta.page
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground border border-transparent hover:border-border'
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => handlePageChange(meta.page + 1)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm text-muted-foreground hover:bg-card hover:text-foreground border border-transparent hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogViewer;
