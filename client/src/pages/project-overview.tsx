import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Table2,
  Columns3,
  GitFork,
  Terminal,
  Upload,
  Database,
  PenTool,
  Bot,
  ArrowRight,
  Activity,
  FileUp,
  Edit3,
  Search,
  Gauge,
  Shield,
  GitBranch,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn, formatDate } from '@/lib/utils';
import { getDialect } from '@/config/constants';
import type { Project } from '@/hooks/use-projects';

// ---- Mock Data ----

const mockColumnsPerTable = [
  { table: 'users', columns: 12 },
  { table: 'orders', columns: 18 },
  { table: 'products', columns: 15 },
  { table: 'payments', columns: 9 },
  { table: 'categories', columns: 6 },
  { table: 'reviews', columns: 8 },
  { table: 'inventory', columns: 11 },
  { table: 'shipping', columns: 14 },
];

const mockTableSizeDistribution = [
  { name: 'users', value: 2400, fill: '#0891b2' },
  { name: 'orders', value: 4500, fill: '#06b6d4' },
  { name: 'products', value: 1800, fill: '#22d3ee' },
  { name: 'payments', value: 3200, fill: '#67e8f9' },
  { name: 'categories', value: 600, fill: '#a5f3fc' },
  { name: 'others', value: 1500, fill: '#cffafe' },
];

const PIE_COLORS = ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe'];

const mockRecentActivity = [
  {
    id: '1',
    action: 'SQL File Uploaded',
    detail: 'schema_v2.sql uploaded and parsed successfully',
    icon: FileUp,
    time: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    color: 'text-aqua-600 bg-aqua-50',
  },
  {
    id: '2',
    action: 'Schema Updated',
    detail: 'Added index on orders.customer_id',
    icon: Edit3,
    time: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    color: 'text-violet-600 bg-violet-50',
  },
  {
    id: '3',
    action: 'Query Saved',
    detail: 'Monthly revenue report query saved to workspace',
    icon: Terminal,
    time: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    color: 'text-amber-600 bg-amber-50',
  },
  {
    id: '4',
    action: 'AI Analysis Complete',
    detail: 'Performance optimization suggestions generated',
    icon: Bot,
    time: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    id: '5',
    action: 'Schema Created',
    detail: 'Initial project schema with 8 tables created',
    icon: Database,
    time: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    color: 'text-cyan-600 bg-cyan-50',
  },
];

interface QuickLinkItem {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  gradient: string;
}

export function ProjectOverview() {
  const { project } = useOutletContext<{ project: Project }>();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const dialect = getDialect(project.dialect);

  const tableCount = project.tableCount ?? 8;
  const columnCount = tableCount * 12;
  const relationshipCount = Math.max(0, tableCount - 1) * 2;
  const savedQueries = project.queryCount ?? 5;

  const stats = [
    {
      label: 'Tables',
      value: tableCount,
      icon: Table2,
      gradient: 'from-aqua-500 to-cyan-500',
    },
    {
      label: 'Columns',
      value: columnCount,
      icon: Columns3,
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      label: 'Relationships',
      value: relationshipCount,
      icon: GitFork,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      label: 'Saved Queries',
      value: savedQueries,
      icon: Terminal,
      gradient: 'from-emerald-500 to-teal-500',
    },
  ];

  const quickActions = [
    {
      label: 'Upload SQL',
      description: 'Import SQL files to analyze schemas',
      icon: Upload,
      gradient: 'from-aqua-500 to-cyan-500',
      onClick: () => navigate(`/project/${projectId}/schema`),
    },
    {
      label: 'View Schema',
      description: 'Explore your database schema visually',
      icon: Database,
      gradient: 'from-violet-500 to-purple-500',
      onClick: () => navigate(`/project/${projectId}/schema`),
    },
    {
      label: 'Query Editor',
      description: 'Write and optimize SQL queries with AI',
      icon: PenTool,
      gradient: 'from-amber-500 to-orange-500',
      onClick: () => navigate(`/project/${projectId}/query`),
    },
    {
      label: 'AI Assistant',
      description: 'Get AI-powered database recommendations',
      icon: Bot,
      gradient: 'from-emerald-500 to-teal-500',
      onClick: () => {},
    },
  ];

  const quickLinks: QuickLinkItem[] = [
    {
      label: 'Schema Intelligence',
      description: 'Design, analyze, and optimize your database schema',
      icon: Database,
      path: `/project/${projectId}/schema`,
      gradient: 'from-aqua-500/10 to-cyan-500/10',
    },
    {
      label: 'ER Diagram',
      description: 'Visual entity-relationship diagram of your schema',
      icon: GitFork,
      path: `/project/${projectId}/schema/er-diagram`,
      gradient: 'from-violet-500/10 to-purple-500/10',
    },
    {
      label: 'Query Intelligence',
      description: 'Write, test, and optimize SQL queries',
      icon: Terminal,
      path: `/project/${projectId}/query`,
      gradient: 'from-amber-500/10 to-orange-500/10',
    },
    {
      label: 'Performance Lab',
      description: 'Benchmark and optimize database performance',
      icon: Gauge,
      path: `/project/${projectId}/performance`,
      gradient: 'from-emerald-500/10 to-teal-500/10',
    },
    {
      label: 'Data Lifecycle',
      description: 'Manage data retention, archival, and compliance',
      icon: Shield,
      path: `/project/${projectId}/data-lifecycle`,
      gradient: 'from-pink-500/10 to-rose-500/10',
    },
    {
      label: 'Migration Studio',
      description: 'Plan, generate, and track schema migrations',
      icon: GitBranch,
      path: `/project/${projectId}/migrations`,
      gradient: 'from-blue-500/10 to-indigo-500/10',
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-8">
      {/* Project Header Card */}
      <div className="relative overflow-hidden bg-white rounded-xl border border-border shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-aqua-400 via-cyan-400 to-aqua-500" />
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aqua-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                <Database className="w-6 h-6 text-aqua-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                  {dialect && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
                  {project.description || 'No description provided for this project.'}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Created {formatDate(project.createdAt, { relative: false })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Updated {formatDate(project.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="group text-left bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:border-aqua-200 transition-all duration-200"
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2.5 shadow-sm',
                  action.gradient
                )}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-aqua-600 transition-colors">
                {action.label}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                {action.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className="mt-1.5 text-2xl font-bold text-foreground tracking-tight">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br shadow-sm',
                    stat.gradient
                  )}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schema Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Columns per Table */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-aqua-500" />
            <h3 className="text-sm font-semibold text-foreground">Columns per Table</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockColumnsPerTable} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="table"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar
                  dataKey="columns"
                  fill="#0891b2"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Table Size Distribution */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-aqua-500" />
            <h3 className="text-sm font-semibold text-foreground">Table Size Distribution</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mockTableSizeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {mockTableSizeDistribution.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} rows`, 'Size']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-aqua-500" />
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {mockRecentActivity.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                {/* Timeline indicator */}
                <div className="flex flex-col items-center pt-0.5">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {index < mockRecentActivity.length - 1 && (
                    <div className="w-px h-full bg-slate-200 mt-2 min-h-[16px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 pt-0.5">
                  {formatDate(item.time)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Explore Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.label}
                onClick={() => navigate(link.path)}
                className="group text-left bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md hover:border-aqua-200 transition-all duration-200"
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3',
                    link.gradient
                  )}
                >
                  <Icon className="w-5 h-5 text-aqua-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-aqua-600 transition-colors">
                  {link.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {link.description}
                </p>
                <div className="flex items-center gap-1 mt-3 text-xs text-aqua-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Open Module <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ProjectOverview;
