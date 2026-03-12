import { useState, useMemo, useCallback } from 'react';
import {
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  Download,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Filter,
  ArrowUp,
  ArrowDown,
  Table2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { cn, formatDate } from '@/lib/utils';
import { useMigrations } from '@/hooks/use-migrations';
import type { Migration } from '@/hooks/use-migrations';
import { DATABASE_DIALECTS } from '@/config/constants';

// ── Props ────────────────────────────────────────────────────────────────────

interface MigrationReportsProps {
  projectId: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'typeMappings' | 'executionLog';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'typeMappings', label: 'Type Mappings', icon: Table2 },
  { id: 'executionLog', label: 'Execution Log', icon: FileText },
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  pending: '#f59e0b',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rolled_back: 'bg-orange-100 text-orange-700',
};

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const TYPE_MAPPING_DATA: Record<string, Record<string, string>> = {
  'postgresql->mysql': {
    SERIAL: 'INT AUTO_INCREMENT',
    BIGSERIAL: 'BIGINT AUTO_INCREMENT',
    BOOLEAN: 'TINYINT(1)',
    TEXT: 'TEXT',
    BYTEA: 'BLOB',
    TIMESTAMPTZ: 'TIMESTAMP',
    JSONB: 'JSON',
    UUID: 'CHAR(36)',
    'DOUBLE PRECISION': 'DOUBLE',
    REAL: 'FLOAT',
  },
  'postgresql->sqlserver': {
    SERIAL: 'INT IDENTITY(1,1)',
    BIGSERIAL: 'BIGINT IDENTITY(1,1)',
    BOOLEAN: 'BIT',
    TEXT: 'NVARCHAR(MAX)',
    BYTEA: 'VARBINARY(MAX)',
    TIMESTAMPTZ: 'DATETIMEOFFSET',
    JSONB: 'NVARCHAR(MAX)',
    UUID: 'UNIQUEIDENTIFIER',
    'DOUBLE PRECISION': 'FLOAT',
  },
  'postgresql->oracle': {
    SERIAL: 'NUMBER GENERATED ALWAYS AS IDENTITY',
    BOOLEAN: 'NUMBER(1)',
    TEXT: 'CLOB',
    VARCHAR: 'VARCHAR2',
    BYTEA: 'BLOB',
    JSONB: 'CLOB',
    UUID: 'RAW(16)',
    'DOUBLE PRECISION': 'BINARY_DOUBLE',
    INTEGER: 'NUMBER(10)',
  },
  'mysql->postgresql': {
    'INT AUTO_INCREMENT': 'SERIAL',
    'TINYINT(1)': 'BOOLEAN',
    TINYINT: 'SMALLINT',
    DOUBLE: 'DOUBLE PRECISION',
    DATETIME: 'TIMESTAMP',
    BLOB: 'BYTEA',
    LONGTEXT: 'TEXT',
    ENUM: 'VARCHAR(255)',
  },
  'mysql->sqlserver': {
    'INT AUTO_INCREMENT': 'INT IDENTITY(1,1)',
    'TINYINT(1)': 'BIT',
    TEXT: 'NVARCHAR(MAX)',
    BLOB: 'VARBINARY(MAX)',
    DATETIME: 'DATETIME2',
    JSON: 'NVARCHAR(MAX)',
  },
  'sqlserver->postgresql': {
    'INT IDENTITY(1,1)': 'SERIAL',
    BIT: 'BOOLEAN',
    'NVARCHAR(MAX)': 'TEXT',
    'VARBINARY(MAX)': 'BYTEA',
    DATETIME2: 'TIMESTAMP',
    UNIQUEIDENTIFIER: 'UUID',
    MONEY: 'DECIMAL(19,4)',
  },
  'oracle->postgresql': {
    VARCHAR2: 'VARCHAR',
    'NUMBER(1)': 'BOOLEAN',
    CLOB: 'TEXT',
    BLOB: 'BYTEA',
    'RAW(16)': 'UUID',
    BINARY_DOUBLE: 'DOUBLE PRECISION',
    DATE: 'TIMESTAMP',
    'NUMBER(10)': 'INTEGER',
  },
};

// ── Sort helpers ─────────────────────────────────────────────────────────────

type SortField = 'version' | 'title' | 'status' | 'dialects' | 'appliedAt' | 'checksum';
type SortDir = 'asc' | 'desc';

function compareMigrations(a: Migration, b: Migration, field: SortField, dir: SortDir): number {
  let cmp = 0;
  switch (field) {
    case 'version':
      cmp = a.version.localeCompare(b.version, undefined, { numeric: true });
      break;
    case 'title':
      cmp = a.title.localeCompare(b.title);
      break;
    case 'status':
      cmp = a.status.localeCompare(b.status);
      break;
    case 'dialects': {
      const aDial = `${a.sourceDialect}->${a.targetDialect}`;
      const bDial = `${b.sourceDialect}->${b.targetDialect}`;
      cmp = aDial.localeCompare(bDial);
      break;
    }
    case 'appliedAt': {
      const aTime = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const bTime = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      cmp = aTime - bTime;
      break;
    }
    case 'checksum':
      cmp = a.checksum.localeCompare(b.checksum);
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

// ── Component ────────────────────────────────────────────────────────────────

export function MigrationReports({ projectId }: MigrationReportsProps) {
  const { data: migrations, isLoading } = useMigrations(projectId);

  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Type Mappings state
  const [sourceDialect, setSourceDialect] = useState('postgresql');
  const [targetDialect, setTargetDialect] = useState('mysql');

  // Execution Log state
  const [sortField, setSortField] = useState<SortField>('version');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ── Computed data ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!migrations || migrations.length === 0) {
      return { total: 0, completed: 0, failed: 0, successRate: null };
    }
    const total = migrations.length;
    const completed = migrations.filter((m) => m.status === 'completed').length;
    const failed = migrations.filter((m) => m.status === 'failed').length;
    const finished = completed + failed;
    const successRate = finished > 0 ? Math.round((completed / finished) * 100) : null;
    return { total, completed, failed, successRate };
  }, [migrations]);

  const statusDistribution = useMemo(() => {
    if (!migrations || migrations.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const m of migrations) {
      counts[m.status] = (counts[m.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      status,
      fill: STATUS_COLORS[status] || '#94a3b8',
    }));
  }, [migrations]);

  const migrationsOverTime = useMemo(() => {
    if (!migrations || migrations.length === 0) return [];
    const monthCounts: Record<string, number> = {};
    for (const m of migrations) {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
    return Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [, monthStr] = key.split('-');
        const monthIndex = parseInt(monthStr, 10);
        return { month: MONTH_LABELS[monthIndex], count };
      });
  }, [migrations]);

  // Type mapping lookup
  const currentMappingKey = `${sourceDialect}->${targetDialect}`;
  const currentMapping = TYPE_MAPPING_DATA[currentMappingKey] || null;

  const mappingEntries = useMemo(() => {
    if (!currentMapping) return [];
    return Object.entries(currentMapping);
  }, [currentMapping]);

  // Execution log: filter + sort
  const filteredSortedMigrations = useMemo(() => {
    if (!migrations) return [];
    let items = [...migrations];
    if (statusFilter !== 'all') {
      items = items.filter((m) => m.status === statusFilter);
    }
    items.sort((a, b) => compareMigrations(a, b, sortField, sortDir));
    return items;
  }, [migrations, statusFilter, sortField, sortDir]);

  const uniqueStatuses = useMemo(() => {
    if (!migrations) return [];
    return Array.from(new Set(migrations.map((m) => m.status)));
  }, [migrations]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField]
  );

  const handleExportJSON = useCallback(() => {
    if (!migrations) return;
    const blob = new Blob([JSON.stringify(migrations, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migration-report.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [migrations]);

  const handleExportCSV = useCallback(() => {
    if (!migrations) return;
    const headers = [
      'Version',
      'Title',
      'Status',
      'Source Dialect',
      'Target Dialect',
      'Applied At',
      'Checksum',
      'Created At',
    ];
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const rows = migrations.map((m) =>
      [
        escapeCSV(m.version),
        escapeCSV(m.title),
        escapeCSV(m.status),
        escapeCSV(m.sourceDialect),
        escapeCSV(m.targetDialect),
        escapeCSV(m.appliedAt || ''),
        escapeCSV(m.checksum),
        escapeCSV(m.createdAt),
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migration-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [migrations]);

  // ── Sort header helper ───────────────────────────────────────────────────

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase hover:text-slate-700 transition-colors"
    >
      {label}
      {sortField === field &&
        (sortDir === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        ))}
    </button>
  );

  // ── Dialect label helper ─────────────────────────────────────────────────

  const getDialectLabel = (value: string) => {
    const d = DATABASE_DIALECTS.find((dd) => dd.value === value);
    return d?.label || value;
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton tabs */}
        <div className="flex gap-6 border-b border-slate-200 pb-0">
          {TABS.map((t) => (
            <div
              key={t.id}
              className="h-8 w-28 bg-slate-200 animate-pulse rounded-t-md"
            />
          ))}
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-slate-200 rounded-xl p-4 space-y-2"
            >
              <div className="h-3 w-20 bg-slate-200 animate-pulse rounded" />
              <div className="h-6 w-12 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
        {/* Skeleton chart areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-slate-200 rounded-xl p-4 h-64 animate-pulse" />
          <div className="bg-card border border-slate-200 rounded-xl p-4 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!migrations || migrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <BarChart3 className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">
          No migration data yet
        </h3>
        <p className="text-sm text-slate-500 max-w-md">
          Create migrations in the Migration Studio to see reports, type mapping
          coverage, and execution logs here.
        </p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-6 border-b border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 pb-2.5 px-1 text-sm font-medium transition-colors border-b-2',
                isActive
                  ? 'border-purple-500 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Section 1: Overview ──────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-slate-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">
                  Total Migrations
                </p>
              </div>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>

            <div className="bg-card border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">
                  Completed
                </p>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {stats.completed}
              </p>
            </div>

            <div className="bg-card border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">
                  Failed
                </p>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>

            <div className="bg-card border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-purple-500" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase">
                  Success Rate
                </p>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {stats.successRate !== null ? `${stats.successRate}%` : '--'}
              </p>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status Distribution Donut */}
            <div className="bg-card border border-slate-200 rounded-xl p-4">
              <h5 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <PieChartIcon className="w-3.5 h-3.5 text-slate-500" />
                Status Distribution
              </h5>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={3}
                      nameKey="name"
                    >
                      {statusDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                {statusDistribution.map((entry) => (
                  <div key={entry.status} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-xs text-slate-600">
                      {entry.name} ({entry.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Migrations Over Time */}
            <div className="bg-card border border-slate-200 rounded-xl p-4">
              <h5 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                Migrations Over Time
              </h5>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={migrationsOverTime}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      allowDecimals={false}
                      label={{
                        value: 'Count',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 11, fill: '#94a3b8' },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                      name="Migrations"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section 2: Type Mapping Coverage Matrix ──────────────────────── */}
      {activeTab === 'typeMappings' && (
        <div className="space-y-6">
          {/* Dialect selectors */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">
                Source Dialect:
              </label>
              <select
                value={sourceDialect}
                onChange={(e) => setSourceDialect(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-card text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              >
                {DATABASE_DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">
                Target Dialect:
              </label>
              <select
                value={targetDialect}
                onChange={(e) => setTargetDialect(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-card text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              >
                {DATABASE_DIALECTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Coverage badge */}
            {currentMapping && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                <Table2 className="w-3 h-3" />
                {mappingEntries.length} types mapped
              </span>
            )}
          </div>

          {/* Mapping table or empty */}
          {currentMapping ? (
            <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase">
                        Source Type ({getDialectLabel(sourceDialect)})
                      </th>
                      <th className="px-2 py-2.5 w-10" />
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase">
                        Target Type ({getDialectLabel(targetDialect)})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingEntries.map(([sourceType, targetType]) => (
                      <tr
                        key={sourceType}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <code className="text-sm font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {sourceType}
                          </code>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 inline-block" />
                        </td>
                        <td className="px-4 py-2.5">
                          {targetType ? (
                            <code className="text-sm font-mono text-green-800 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                              {targetType}
                            </code>
                          ) : (
                            <span className="text-sm font-mono text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              N/A
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-slate-200 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Table2 className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                No mapping data available for this dialect pair
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {getDialectLabel(sourceDialect)} to{' '}
                {getDialectLabel(targetDialect)} mappings have not been
                configured.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Section 3: Execution Log ─────────────────────────────────────── */}
      {activeTab === 'executionLog' && (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <label className="text-xs font-medium text-slate-600">
                Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-card text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 ml-1">
                {filteredSortedMigrations.length} result
                {filteredSortedMigrations.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJSON}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-2.5">
                      <SortHeader field="version" label="Version" />
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <SortHeader field="title" label="Title" />
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <SortHeader field="status" label="Status" />
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <SortHeader field="dialects" label="Source / Target" />
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <SortHeader field="appliedAt" label="Applied At" />
                    </th>
                    <th className="text-left px-4 py-2.5">
                      <SortHeader field="checksum" label="Checksum" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSortedMigrations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        No migrations match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSortedMigrations.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <span className="text-sm font-mono font-medium text-slate-800">
                            {m.version}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm text-slate-700 truncate block max-w-[220px]">
                            {m.title}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                              STATUS_BADGE_CLASSES[m.status] ||
                                'bg-slate-100 text-slate-600'
                            )}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-slate-600">
                            {getDialectLabel(m.sourceDialect)}
                            <ArrowRight className="w-3 h-3 inline-block mx-1 text-slate-400" />
                            {getDialectLabel(m.targetDialect)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-slate-500">
                            {m.appliedAt
                              ? formatDate(m.appliedAt)
                              : '--'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <code className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {m.checksum.slice(0, 8)}
                          </code>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MigrationReports;
