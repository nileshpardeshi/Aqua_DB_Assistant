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
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useAuditLogs, type AuditLog, type AuditLogFilters } from '@/hooks/use-audit-logs';

const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  CREATE: { label: 'Create', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: Plus },
  UPDATE: { label: 'Update', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Pencil },
  DELETE: { label: 'Delete', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: Trash2 },
  VIEW: { label: 'View', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', icon: Eye },
  EXPORT: { label: 'Export', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', icon: Download },
  UPLOAD: { label: 'Upload', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Upload },
};

const ENTITY_TYPES = [
  { value: '', label: 'All Entity Types' },
  { value: 'project', label: 'Project' },
  { value: 'schema', label: 'Schema' },
  { value: 'query', label: 'Query' },
  { value: 'migration', label: 'Migration' },
  { value: 'connection', label: 'Connection' },
  { value: 'settings', label: 'Settings' },
  { value: 'file', label: 'File' },
];

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'VIEW', label: 'View' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'UPLOAD', label: 'Upload' },
];

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
    limit: compact ? 5 : 10,
    projectId,
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(!compact);

  const { data: response, isLoading } = useAuditLogs(filters);
  const logs = response?.data ?? [];
  const meta = response?.meta ?? { total: 0, page: 1, limit: 10, totalPages: 1 };

  function toggleExpanded(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleFilterChange(key: keyof AuditLogFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function exportToCsv() {
    const allLogs = logs;
    if (!allLogs.length) return;

    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'Details', 'IP Address'];
    const rows = allLogs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.action,
      log.entityType,
      log.entityName || log.entityId,
      `"${log.details.replace(/"/g, '""')}"`,
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
                  ? 'bg-aqua-50 border-aqua-200 text-aqua-700'
                  : 'bg-white border-border text-foreground hover:bg-slate-50'
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {meta.total} total entries
          </span>
        </div>
        <button
          onClick={exportToCsv}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-white border border-border rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      {showFilters && !compact && (
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
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
                  className="w-full px-3 py-2 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent appearance-none cursor-pointer"
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
                  className="w-full px-3 py-2 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent appearance-none cursor-pointer"
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
                  className="w-full px-3 py-2 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent"
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
                  className="w-full px-3 py-2 text-sm bg-white border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Entries */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-aqua-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-muted-foreground">No audit log entries found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const isExpanded = expandedRows.has(log.id);
              const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.VIEW;
              const ActionIcon = actionCfg.icon;

              return (
                <div key={log.id} className="hover:bg-slate-50/50 transition-colors">
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
                    <div className="flex-shrink-0 w-32">
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
                    <div className="flex-shrink-0 w-24">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                        {log.entityType}
                      </span>
                    </div>

                    {/* Entity Name / Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {log.entityName || log.entityId}
                      </p>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pl-14">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-2.5">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                            Details
                          </p>
                          <p className="text-sm text-foreground">{log.details}</p>
                        </div>
                        <div className="flex flex-wrap gap-4 pt-1">
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                              Entity ID
                            </p>
                            <p className="text-xs text-foreground font-mono">{log.entityId}</p>
                          </div>
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-muted-foreground">
              Page {meta.page} of {meta.totalPages} ({meta.total} entries)
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={meta.page <= 1}
                onClick={() => handlePageChange(meta.page - 1)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm text-muted-foreground hover:bg-white hover:text-foreground border border-transparent hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    page === meta.page
                      ? 'bg-aqua-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-white hover:text-foreground border border-transparent hover:border-border'
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => handlePageChange(meta.page + 1)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm text-muted-foreground hover:bg-white hover:text-foreground border border-transparent hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
