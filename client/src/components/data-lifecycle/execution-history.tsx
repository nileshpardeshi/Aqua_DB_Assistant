import { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Shield,
  Trash2,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ExecutionStatus = 'completed' | 'failed' | 'running' | 'dry-run';

interface ExecutionRecord {
  id: string;
  ruleName: string;
  targetTable: string;
  mode: 'dry-run' | 'live';
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  rowsAffected: number;
  duration: string;
  batchSize: number;
  dialect: string;
  script: string;
  error?: string;
}

// Demo records to show what the feature would look like when connected to a real execution engine
const DEMO_RECORDS: ExecutionRecord[] = [
  {
    id: '1',
    ruleName: 'Purge old audit logs',
    targetTable: 'audit_logs',
    mode: 'dry-run',
    status: 'dry-run',
    startedAt: '2026-03-13T08:30:00Z',
    completedAt: '2026-03-13T08:30:02Z',
    rowsAffected: 15420,
    duration: '2.1s',
    batchSize: 5000,
    dialect: 'postgresql',
    script: 'SELECT COUNT(*) AS rows_to_purge FROM audit_logs WHERE created_at < NOW() - INTERVAL \'90 days\';',
  },
  {
    id: '2',
    ruleName: 'Clean expired sessions',
    targetTable: 'user_sessions',
    mode: 'live',
    status: 'completed',
    startedAt: '2026-03-12T22:00:00Z',
    completedAt: '2026-03-12T22:01:45Z',
    rowsAffected: 8734,
    duration: '1m 45s',
    batchSize: 1000,
    dialect: 'postgresql',
    script: 'DELETE FROM user_sessions WHERE last_login_at < NOW() - INTERVAL \'30 days\' AND status = \'expired\';',
  },
  {
    id: '3',
    ruleName: 'Remove temp uploads',
    targetTable: 'temp_uploads',
    mode: 'live',
    status: 'failed',
    startedAt: '2026-03-12T03:00:00Z',
    completedAt: '2026-03-12T03:00:12Z',
    rowsAffected: 0,
    duration: '12s',
    batchSize: 5000,
    dialect: 'postgresql',
    script: 'DELETE FROM temp_uploads WHERE created_at < NOW() - INTERVAL \'7 days\';',
    error: 'ERROR: update or delete on table "temp_uploads" violates foreign key constraint "fk_attachments_upload_id" on table "attachments"',
  },
  {
    id: '4',
    ruleName: 'Purge old audit logs',
    targetTable: 'audit_logs',
    mode: 'live',
    status: 'completed',
    startedAt: '2026-03-11T22:00:00Z',
    completedAt: '2026-03-11T22:03:22Z',
    rowsAffected: 45210,
    duration: '3m 22s',
    batchSize: 10000,
    dialect: 'postgresql',
    script: 'DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL \'90 days\';',
  },
];

const STATUS_CONFIG: Record<ExecutionStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
  running: { icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Running' },
  'dry-run': { icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Dry Run' },
};

export function ExecutionHistory() {
  const [records] = useState<ExecutionRecord[]>(DEMO_RECORDS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const completed = records.filter((r) => r.status === 'completed').length;
  const failed = records.filter((r) => r.status === 'failed').length;
  const totalPurged = records
    .filter((r) => r.status === 'completed' && r.mode === 'live')
    .reduce((sum, r) => sum + r.rowsAffected, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <span className="text-slate-500">{records.length} executions recorded</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-bold">
          <CheckCircle2 className="w-2.5 h-2.5" /> {completed} completed
        </span>
        {failed > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold">
            <XCircle className="w-2.5 h-2.5" /> {failed} failed
          </span>
        )}
        <span className="text-slate-500">
          {totalPurged.toLocaleString()} rows purged total
        </span>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-center gap-2">
        <History className="w-4 h-4 flex-shrink-0" />
        <div>
          <p className="font-medium">Execution Audit Trail</p>
          <p className="mt-0.5 text-blue-600">
            Every purge script execution is logged here for compliance and audit purposes.
            Connect to your database execution engine to see live results.
          </p>
        </div>
      </div>

      {/* Records */}
      <div className="space-y-2">
        {records.map((record) => {
          const statusConfig = STATUS_CONFIG[record.status];
          const StatusIcon = statusConfig.icon;
          const isExpanded = expandedId === record.id;

          return (
            <div
              key={record.id}
              className="bg-card border border-slate-200 rounded-lg overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => toggleExpand(record.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                )}

                <StatusIcon className={cn('w-4 h-4 flex-shrink-0', statusConfig.color)} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {record.ruleName}
                    </span>
                    <span className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold rounded uppercase',
                      statusConfig.bg, statusConfig.color
                    )}>
                      {statusConfig.label}
                    </span>
                    <span className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold rounded uppercase',
                      record.mode === 'live' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                    )}>
                      {record.mode === 'live' ? 'LIVE' : 'DRY RUN'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-mono">{record.targetTable}</span>
                    {' — '}
                    {record.rowsAffected.toLocaleString()} rows
                    {' — '}
                    {record.duration}
                    {' — '}
                    {new Date(record.startedAt).toLocaleString()}
                  </p>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium">Started</span>
                      <p className="text-slate-800 mt-0.5">{new Date(record.startedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Completed</span>
                      <p className="text-slate-800 mt-0.5">
                        {record.completedAt ? new Date(record.completedAt).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Rows Affected</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{record.rowsAffected.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Batch Size</span>
                      <p className="text-slate-800 mt-0.5">{record.batchSize.toLocaleString()}</p>
                    </div>
                  </div>

                  {record.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Execution Error</p>
                        <code className="block mt-1 font-mono text-[11px] whitespace-pre-wrap">{record.error}</code>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Executed Script
                    </span>
                    <pre className="mt-1 text-xs font-mono bg-[#1e293b] text-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                      {record.script}
                    </pre>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>Dialect: {record.dialect}</span>
                    <span>ID: {record.id}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {records.length === 0 && (
        <div className="text-center py-16 bg-card border border-slate-200 rounded-xl">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-700 mb-1">No Execution History</h4>
          <p className="text-xs text-slate-500">
            Purge script executions will appear here once you run your first script.
          </p>
        </div>
      )}
    </div>
  );
}

export default ExecutionHistory;
