import { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  History,
  Timer,
  Rows3,
  Search,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryHistory, type QueryHistoryItem } from '@/hooks/use-queries';

interface QueryHistoryPanelProps {
  projectId: string;
  onLoadQuery: (sql: string) => void;
  className?: string;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function QueryHistoryPanel({
  projectId,
  onLoadQuery,
  className,
}: QueryHistoryPanelProps) {
  const { data: history, isLoading } = useQueryHistory(projectId);

  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredHistory = useMemo(() => {
    let items = history || [];
    if (searchFilter) {
      items = items.filter(item =>
        item.sql.toLowerCase().includes(searchFilter.toLowerCase()),
      );
    }
    if (statusFilter !== 'all') {
      items = items.filter(item => item.status === statusFilter);
    }
    items = [...items].sort((a, b) => {
      const dateA = new Date(a.executedAt).getTime();
      const dateB = new Date(b.executedAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return items;
  }, [history, searchFilter, statusFilter, sortOrder]);

  const handleCopy = (e: React.MouseEvent, item: QueryHistoryItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.sql);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusFilters: { label: string; value: 'all' | 'success' | 'error' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Success', value: 'success' },
    { label: 'Failed', value: 'error' },
  ];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header Bar */}
      <div className="px-4 py-3 space-y-3 border-b border-border">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search queries..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-aqua-400 placeholder:text-muted-foreground"
          />
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-2">
          {/* Status Pills */}
          <div className="flex items-center gap-1">
            {statusFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
                  statusFilter === f.value
                    ? 'bg-aqua-50 text-aqua-700 border-aqua-300'
                    : 'bg-card border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort Toggle */}
          <button
            onClick={() => setSortOrder(prev => (prev === 'newest' ? 'oldest' : 'newest'))}
            className="ml-auto p-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
            title={sortOrder === 'newest' ? 'Showing newest first' : 'Showing oldest first'}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* Count Badge */}
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
            {filteredHistory.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="divide-y divide-border/50">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-4 py-3 space-y-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-secondary rounded-full" />
                  <div className="h-3 bg-secondary rounded w-3/4" />
                </div>
                <div className="ml-6 space-y-1.5">
                  <div className="h-2.5 bg-secondary rounded w-full" />
                  <div className="flex gap-2">
                    <div className="h-2 bg-secondary rounded w-12" />
                    <div className="h-2 bg-secondary rounded w-10" />
                    <div className="h-2 bg-secondary rounded w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <History className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No query history
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {searchFilter || statusFilter !== 'all'
                ? 'No queries match your filters'
                : 'Your executed queries will appear here'}
            </p>
          </div>
        )}

        {/* History Items */}
        {!isLoading && filteredHistory.length > 0 && (
          <div className="divide-y divide-border/50">
            {filteredHistory.map(item => (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group relative"
                onClick={() => onLoadQuery(item.sql)}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Saved Query Title */}
                    {item.savedQuery?.title && (
                      <span className="inline-block text-[10px] font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded px-1.5 py-0.5 mb-1">
                        {item.savedQuery.title}
                      </span>
                    )}

                    {/* SQL Preview */}
                    <p className="text-xs font-mono text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.sql}
                    </p>

                    {/* Metadata Row */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {/* Status Badge */}
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                          item.status === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
                        )}
                      >
                        {item.status === 'success' ? 'Success' : 'Failed'}
                      </span>

                      {/* Execution Time */}
                      {item.executionTime != null && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Timer className="w-3 h-3" />
                          {item.executionTime}ms
                        </span>
                      )}

                      {/* Row Count */}
                      {item.rowsReturned != null && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Rows3 className="w-3 h-3" />
                          {item.rowsReturned} rows
                        </span>
                      )}

                      {/* Relative Timestamp */}
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.executedAt)}
                      </span>
                    </div>

                    {/* Error Message */}
                    {item.status === 'error' && item.errorMessage && (
                      <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded p-2 text-xs font-mono mt-1.5">
                        {item.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Copy Button (hover) */}
                  <button
                    onClick={e => handleCopy(e, item)}
                    className={cn(
                      'absolute top-3 right-3 p-1.5 rounded-md border shadow-sm transition-all',
                      'opacity-0 group-hover:opacity-100',
                      copiedId === item.id
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted/50',
                    )}
                    title={copiedId === item.id ? 'Copied!' : 'Copy SQL'}
                  >
                    {copiedId === item.id ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default QueryHistoryPanel;
