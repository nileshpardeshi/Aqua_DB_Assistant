import { useMemo } from 'react';
import {
  Activity,
  Database,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// ---- Mock Data ----

const HEALTH_SCORE = 87;

const mockTableGrowth = [
  { month: 'Jul', users: 12000, orders: 34000, products: 5200, payments: 28000 },
  { month: 'Aug', users: 14500, orders: 38000, products: 5400, payments: 31000 },
  { month: 'Sep', users: 16200, orders: 42000, products: 5800, payments: 35000 },
  { month: 'Oct', users: 18800, orders: 48000, products: 6200, payments: 39000 },
  { month: 'Nov', users: 21000, orders: 52000, products: 6500, payments: 44000 },
  { month: 'Dec', users: 24500, orders: 61000, products: 7100, payments: 52000 },
  { month: 'Jan', users: 27200, orders: 68000, products: 7400, payments: 58000 },
  { month: 'Feb', users: 30100, orders: 74000, products: 7800, payments: 63000 },
];

const mockIndexUsage = [
  { name: 'idx_users_email', used: 9800, unused: 200 },
  { name: 'idx_orders_date', used: 8500, unused: 1500 },
  { name: 'idx_products_sku', used: 7200, unused: 2800 },
  { name: 'idx_payments_ref', used: 6100, unused: 3900 },
  { name: 'idx_users_name', used: 2200, unused: 7800 },
  { name: 'idx_orders_total', used: 1800, unused: 8200 },
];

const mockSlowQueries = [
  {
    id: 'sq-1',
    query: 'SELECT * FROM orders o JOIN users u ON o.user_id = u.id WHERE o.created_at > ...',
    avgTime: '2.4s',
    calls: 1240,
    table: 'orders',
    severity: 'high' as const,
  },
  {
    id: 'sq-2',
    query: 'SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id ...',
    avgTime: '1.8s',
    calls: 890,
    table: 'products',
    severity: 'high' as const,
  },
  {
    id: 'sq-3',
    query: 'UPDATE inventory SET quantity = quantity - 1 WHERE product_id IN (SELECT ...)',
    avgTime: '1.2s',
    calls: 2100,
    table: 'inventory',
    severity: 'medium' as const,
  },
  {
    id: 'sq-4',
    query: 'SELECT u.*, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON ...',
    avgTime: '0.9s',
    calls: 560,
    table: 'users',
    severity: 'medium' as const,
  },
  {
    id: 'sq-5',
    query: 'DELETE FROM sessions WHERE expires_at < NOW() AND user_id NOT IN (SELECT ...)',
    avgTime: '0.7s',
    calls: 340,
    table: 'sessions',
    severity: 'low' as const,
  },
];

const mockStorageUsage = [
  { name: 'Tables', value: 4200, fill: '#0891b2' },
  { name: 'Indexes', value: 1800, fill: '#06b6d4' },
  { name: 'TOAST', value: 800, fill: '#22d3ee' },
  { name: 'WAL', value: 600, fill: '#67e8f9' },
  { name: 'Temp', value: 200, fill: '#a5f3fc' },
];

const STORAGE_COLORS = ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc'];

const mockConnectionPool = {
  active: 24,
  idle: 16,
  total: 50,
  waiting: 2,
  maxConnections: 100,
};

// ---- Component ----

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function getHealthBg(score: number): string {
  if (score >= 80) return 'from-emerald-500 to-teal-500';
  if (score >= 60) return 'from-amber-500 to-orange-500';
  return 'from-red-500 to-rose-500';
}

function getHealthLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

const SEVERITY_CONFIG = {
  high: { label: 'High', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  medium: { label: 'Medium', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  low: { label: 'Low', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
};

export function HealthDashboard() {
  const healthAngle = useMemo(() => (HEALTH_SCORE / 100) * 180, []);

  return (
    <div className="space-y-6">
      {/* Top Row: Health Score + Connection Pool */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Gauge */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-foreground mb-4 self-start flex items-center gap-2">
            <Activity className="w-4 h-4 text-aqua-500" />
            Overall Health Score
          </h3>
          <div className="relative w-48 h-28">
            {/* SVG Gauge */}
            <svg viewBox="0 0 200 110" className="w-full h-full">
              {/* Background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="14"
                strokeLinecap="round"
              />
              {/* Value arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#healthGradient)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${(healthAngle / 180) * 251.2} 251.2`}
              />
              <defs>
                <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              {/* Center text */}
              <text
                x="100"
                y="85"
                textAnchor="middle"
                className="text-3xl font-bold"
                fill="currentColor"
              >
                {HEALTH_SCORE}
              </text>
              <text
                x="100"
                y="102"
                textAnchor="middle"
                className="text-xs"
                fill="#94a3b8"
              >
                / 100
              </text>
            </svg>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CheckCircle2 className={cn('w-4 h-4', getHealthColor(HEALTH_SCORE))} />
            <span className={cn('text-sm font-semibold', getHealthColor(HEALTH_SCORE))}>
              {getHealthLabel(HEALTH_SCORE)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Based on query performance, index usage, and resource utilization
          </p>
        </div>

        {/* Connection Pool Status */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-aqua-500" />
            Connection Pool
          </h3>
          <div className="space-y-4">
            {/* Pool bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Pool Utilization</span>
                <span className="font-medium text-foreground">
                  {mockConnectionPool.active + mockConnectionPool.idle} / {mockConnectionPool.maxConnections}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-aqua-500 to-cyan-500 rounded-l-full"
                  style={{ width: `${(mockConnectionPool.active / mockConnectionPool.maxConnections) * 100}%` }}
                />
                <div
                  className="bg-aqua-200"
                  style={{ width: `${(mockConnectionPool.idle / mockConnectionPool.maxConnections) * 100}%` }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-aqua-50 dark:bg-aqua-950/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-lg font-bold text-aqua-700 dark:text-aqua-200">{mockConnectionPool.active}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Idle</p>
                <p className="text-lg font-bold text-foreground">{mockConnectionPool.idle}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Waiting</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-200">{mockConnectionPool.waiting}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Max</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-200">{mockConnectionPool.maxConnections}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Usage Pie Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-aqua-500" />
            Storage Breakdown
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mockStorageUsage}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {mockStorageUsage.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={STORAGE_COLORS[index % STORAGE_COLORS.length]} />
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
                  formatter={(value: number) => [`${value} MB`, 'Size']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-1">
            Total: {(mockStorageUsage.reduce((s, e) => s + e.value, 0) / 1000).toFixed(1)} GB
          </p>
        </div>
      </div>

      {/* Table Growth Chart */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-aqua-500" />
            Table Growth Over Time
          </h3>
          <span className="text-xs text-muted-foreground">Last 8 months</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockTableGrowth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Rows']}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="users" stroke="#0891b2" fill="url(#colorUsers)" strokeWidth={2} />
              <Area type="monotone" dataKey="orders" stroke="#8b5cf6" fill="url(#colorOrders)" strokeWidth={2} />
              <Area type="monotone" dataKey="products" stroke="#f59e0b" fill="url(#colorProducts)" strokeWidth={2} />
              <Area type="monotone" dataKey="payments" stroke="#10b981" fill="url(#colorPayments)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Index Usage + Slow Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Index Usage Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <Zap className="w-4 h-4 text-aqua-500" />
            Index Usage Analysis
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mockIndexUsage}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  width={110}
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
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="used" stackId="a" fill="#0891b2" name="Used" radius={[0, 0, 0, 0]} />
                <Bar dataKey="unused" stackId="a" fill="#e2e8f0" name="Unused" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Slow Queries List */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Top 5 Slow Queries
            </h3>
          </div>
          <div className="divide-y divide-border/50">
            {mockSlowQueries.map((sq) => {
              const severity = SEVERITY_CONFIG[sq.severity];
              return (
                <div key={sq.id} className="px-6 py-3.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-xs font-mono text-foreground line-clamp-1 flex-1">
                      {sq.query}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0',
                        severity.bg,
                        severity.color
                      )}
                    >
                      {severity.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Avg: {sq.avgTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {sq.table}
                    </span>
                    <span>{sq.calls.toLocaleString()} calls</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HealthDashboard;
