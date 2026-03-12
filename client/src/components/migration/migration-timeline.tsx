import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMigrations, useCreateMigration } from '@/hooks/use-migrations';
import { DATABASE_DIALECTS } from '@/config/constants';
import { formatDate } from '@/lib/utils';
import type { Migration } from '@/hooks/use-migrations';

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    line: 'bg-amber-300',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    line: 'bg-blue-300',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'text-green-500',
    bg: 'bg-green-50',
    border: 'border-green-200',
    line: 'bg-green-400',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    line: 'bg-red-300',
  },
};

const DIALECTS = DATABASE_DIALECTS.filter((d) =>
  ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb', 'snowflake', 'bigquery'].includes(d.value)
);

// Mock migrations for demonstration
const MOCK_MIGRATIONS: Migration[] = [
  {
    id: '1',
    projectId: '',
    name: 'Initial schema migration',
    status: 'completed',
    sourceDialect: 'postgresql',
    targetDialect: 'mysql',
    sourceSql: 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE\n);',
    targetSql: 'CREATE TABLE users (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE\n) ENGINE=InnoDB;',
    changesLog: ['Changed SERIAL to AUTO_INCREMENT', 'Added ENGINE=InnoDB'],
    createdAt: '2025-12-01T10:30:00Z',
    updatedAt: '2025-12-01T10:32:00Z',
  },
  {
    id: '2',
    projectId: '',
    name: 'Add orders table',
    status: 'completed',
    sourceDialect: 'postgresql',
    targetDialect: 'mysql',
    sourceSql: 'CREATE TABLE orders (\n  id SERIAL PRIMARY KEY,\n  user_id INT REFERENCES users(id),\n  total DECIMAL(10,2),\n  created_at TIMESTAMP DEFAULT NOW()\n);',
    targetSql: 'CREATE TABLE orders (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  user_id INT,\n  total DECIMAL(10,2),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  FOREIGN KEY (user_id) REFERENCES users(id)\n) ENGINE=InnoDB;',
    createdAt: '2025-12-05T14:20:00Z',
    updatedAt: '2025-12-05T14:21:00Z',
  },
  {
    id: '3',
    projectId: '',
    name: 'Add index on orders.user_id',
    status: 'completed',
    sourceDialect: 'postgresql',
    targetDialect: 'mysql',
    sourceSql: 'CREATE INDEX idx_orders_user_id ON orders (user_id);',
    targetSql: 'CREATE INDEX idx_orders_user_id ON orders (user_id);',
    createdAt: '2025-12-10T09:15:00Z',
    updatedAt: '2025-12-10T09:15:30Z',
  },
  {
    id: '4',
    projectId: '',
    name: 'Add products catalog',
    status: 'running',
    sourceDialect: 'postgresql',
    targetDialect: 'mysql',
    sourceSql: 'CREATE TABLE products (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255),\n  price DECIMAL(10,2),\n  category_id INT\n);',
    createdAt: '2025-12-15T16:45:00Z',
    updatedAt: '2025-12-15T16:45:00Z',
  },
  {
    id: '5',
    projectId: '',
    name: 'Add audit logging tables',
    status: 'pending',
    sourceDialect: 'postgresql',
    targetDialect: 'mysql',
    sourceSql: '',
    createdAt: '2025-12-20T08:00:00Z',
    updatedAt: '2025-12-20T08:00:00Z',
  },
];

export function MigrationTimeline() {
  const { projectId } = useParams();
  const { data: apiMigrations } = useMigrations(projectId);
  const createMigration = useCreateMigration();

  const migrations = apiMigrations && apiMigrations.length > 0 ? apiMigrations : MOCK_MIGRATIONS;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSourceDialect, setNewSourceDialect] = useState('postgresql');
  const [newTargetDialect, setNewTargetDialect] = useState('mysql');
  const [newSourceSql, setNewSourceSql] = useState('');

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleCreateMigration = useCallback(async () => {
    if (!newName.trim() || !projectId) return;
    try {
      await createMigration.mutateAsync({
        projectId,
        name: newName.trim(),
        sourceDialect: newSourceDialect,
        targetDialect: newTargetDialect,
        sourceSql: newSourceSql,
      });
      setShowCreateForm(false);
      setNewName('');
      setNewSourceSql('');
    } catch {
      // Error handled by mutation
    }
  }, [newName, newSourceDialect, newTargetDialect, newSourceSql, projectId, createMigration]);

  const getDialectLabel = (value: string) =>
    DATABASE_DIALECTS.find((d) => d.value === value)?.label || value;

  const getDialectColor = (value: string) =>
    DATABASE_DIALECTS.find((d) => d.value === value)?.color || '#64748b';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">
          Migration History ({migrations.length})
        </h4>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New Migration
        </button>
      </div>

      {/* Create Migration Form */}
      {showCreateForm && (
        <div className="bg-white border border-aqua-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-semibold text-slate-800">
              Create New Migration
            </h5>
            <button
              onClick={() => setShowCreateForm(false)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Migration name..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">
                Source
              </label>
              <select
                value={newSourceDialect}
                onChange={(e) => setNewSourceDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
              >
                {DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">
                Target
              </label>
              <select
                value={newTargetDialect}
                onChange={(e) => setNewTargetDialect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
              >
                {DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={newSourceSql}
            onChange={(e) => setNewSourceSql(e.target.value)}
            placeholder="Source SQL (optional)..."
            rows={4}
            spellCheck={false}
            className="w-full px-3 py-2 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 resize-y"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateMigration}
              disabled={!newName.trim() || createMigration.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors',
                newName.trim()
                  ? 'text-white bg-aqua-600 hover:bg-aqua-700'
                  : 'text-slate-400 bg-slate-100 cursor-not-allowed'
              )}
            >
              {createMigration.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {migrations.map((migration, idx) => {
          const status = STATUS_CONFIG[migration.status];
          const StatusIcon = status.icon;
          const isExpanded = expandedId === migration.id;
          const isLast = idx === migrations.length - 1;

          return (
            <div key={migration.id} className="relative flex gap-4">
              {/* Timeline line */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute left-[15px] top-[36px] w-[2px] bottom-0',
                    status.line
                  )}
                />
              )}

              {/* Status icon */}
              <div
                className={cn(
                  'relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2',
                  status.bg,
                  status.border
                )}
              >
                <StatusIcon
                  className={cn(
                    'w-4 h-4',
                    status.color,
                    migration.status === 'running' && 'animate-spin'
                  )}
                />
              </div>

              {/* Content */}
              <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
                <button
                  onClick={() => handleToggleExpand(migration.id)}
                  className="w-full text-left bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <h5 className="text-sm font-semibold text-slate-800">
                        {migration.name}
                      </h5>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Dialect badge */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: getDialectColor(migration.sourceDialect) }}
                        />
                        <span style={{ color: getDialectColor(migration.sourceDialect) }}>
                          {getDialectLabel(migration.sourceDialect)}
                        </span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: getDialectColor(migration.targetDialect) }}
                        />
                        <span style={{ color: getDialectColor(migration.targetDialect) }}>
                          {getDialectLabel(migration.targetDialect)}
                        </span>
                      </span>

                      {/* Status badge */}
                      <span
                        className={cn(
                          'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                          status.bg,
                          status.color
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 mt-1 ml-5">
                    {formatDate(migration.createdAt)}
                  </p>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    {migration.sourceSql && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                          Source SQL
                        </p>
                        <pre className="text-xs font-mono bg-[#1e293b] text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                          {migration.sourceSql}
                        </pre>
                      </div>
                    )}

                    {migration.targetSql && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                          Target SQL
                        </p>
                        <pre className="text-xs font-mono bg-[#1e293b] text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                          {migration.targetSql}
                        </pre>
                      </div>
                    )}

                    {migration.changesLog && migration.changesLog.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                          Changes
                        </p>
                        <ul className="space-y-1">
                          {migration.changesLog.map((change, i) => (
                            <li
                              key={i}
                              className="text-xs text-slate-600 flex items-start gap-1.5"
                            >
                              <ArrowRight className="w-3 h-3 text-aqua-500 mt-0.5 flex-shrink-0" />
                              {change}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {migrations.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No migrations yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Create your first migration to get started
          </p>
        </div>
      )}
    </div>
  );
}

export default MigrationTimeline;
