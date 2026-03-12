import { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  History,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

export interface QueryHistoryItem {
  id: string;
  sql: string;
  status: 'success' | 'failed';
  executionTime: number; // in milliseconds
  timestamp: string;
  rowCount?: number;
  error?: string;
}

interface QueryHistoryPanelProps {
  history?: QueryHistoryItem[];
  onLoadQuery?: (sql: string) => void;
  className?: string;
}

// Mock data for demonstration
const mockHistory: QueryHistoryItem[] = [
  {
    id: '1',
    sql: 'SELECT u.id, u.name, u.email, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.created_at > NOW() - INTERVAL \'30 days\' ORDER BY o.total DESC LIMIT 50;',
    status: 'success',
    executionTime: 245,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    rowCount: 42,
  },
  {
    id: '2',
    sql: 'SELECT COUNT(*) as total_users, DATE_TRUNC(\'month\', created_at) as month FROM users GROUP BY month ORDER BY month DESC;',
    status: 'success',
    executionTime: 128,
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    rowCount: 12,
  },
  {
    id: '3',
    sql: 'ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);',
    status: 'failed',
    executionTime: 15,
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    error: 'relation "categories" does not exist',
  },
  {
    id: '4',
    sql: 'SELECT * FROM products WHERE price BETWEEN 10 AND 100 AND stock > 0;',
    status: 'success',
    executionTime: 89,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    rowCount: 156,
  },
  {
    id: '5',
    sql: 'INSERT INTO audit_log (action, user_id, table_name) VALUES (\'UPDATE\', 1, \'users\');',
    status: 'success',
    executionTime: 12,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    rowCount: 1,
  },
];

export function QueryHistoryPanel({
  history,
  onLoadQuery,
  className,
}: QueryHistoryPanelProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const items = history || mockHistory;

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 px-4',
          className
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <History className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          No query history
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Your executed queries will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-y-auto max-h-[400px]', className)}>
      <div className="divide-y divide-border/50">
        {items.map((item) => (
          <div
            key={item.id}
            className="px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer group relative"
            onClick={() => onLoadQuery?.(item.sql)}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
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
                {/* SQL Preview */}
                <p className="text-xs font-mono text-foreground truncate leading-relaxed">
                  {item.sql}
                </p>

                {/* Metadata Row */}
                <div className="flex items-center gap-3 mt-1.5">
                  {/* Status Badge */}
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                      item.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    )}
                  >
                    {item.status === 'success' ? 'Success' : 'Failed'}
                  </span>

                  {/* Execution Time */}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Timer className="w-3 h-3" />
                    {item.executionTime}ms
                  </span>

                  {/* Row Count */}
                  {item.rowCount !== undefined && (
                    <span className="text-[10px] text-muted-foreground">
                      {item.rowCount} rows
                    </span>
                  )}

                  {/* Timestamp */}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                    <Clock className="w-3 h-3" />
                    {formatDate(item.timestamp)}
                  </span>
                </div>

                {/* Error message for failed queries */}
                {item.status === 'failed' && item.error && (
                  <p className="mt-1.5 text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded font-mono">
                    {item.error}
                  </p>
                )}
              </div>

              {/* Copy button on hover */}
              {hoveredId === item.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadQuery?.(item.sql);
                  }}
                  className="absolute top-3 right-3 p-1.5 bg-white rounded-md border border-border shadow-sm hover:bg-slate-50 transition-colors"
                  title="Load into editor"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QueryHistoryPanel;
