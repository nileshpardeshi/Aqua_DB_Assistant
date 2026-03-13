import { useMemo, useState, useCallback } from 'react';
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
  Activity,
  CheckCircle2,
  Sparkles,
  FileText,
  Inbox,
  Shield,
  TrendingUp,
  AlertTriangle,
  Zap,
  Key,
  Layers,
  Server,
  Eye,
  FlaskConical,
  ArrowUpRight,
  Hash,
  RefreshCw,
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
  AreaChart,
  Area,
} from 'recharts';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { getDialect } from '@/config/constants';
import type { Project } from '@/hooks/use-projects';
import { useProjectStats } from '@/hooks/use-projects';
import { useTables, useRelationships } from '@/hooks/use-schema';
import type { Table, Column, Index, Constraint, Relationship } from '@/hooks/use-schema';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { usePerformanceRuns } from '@/hooks/use-performance';
import { useMigrations } from '@/hooks/use-migrations';
import { useConnections } from '@/hooks/use-connections';
import { useDataLifecycleRules } from '@/hooks/use-data-lifecycle';
import { useSavedQueries } from '@/hooks/use-queries';

// ── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#0891b2', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

const CHART_TOOLTIP = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

const ACTIVITY_ICONS: Record<string, { icon: typeof Database; color: string }> = {
  project: { icon: Database, color: 'text-aqua-600 bg-aqua-50' },
  schema: { icon: Table2, color: 'text-violet-600 bg-violet-50' },
  query: { icon: Terminal, color: 'text-amber-600 bg-amber-50' },
  file: { icon: FileText, color: 'text-cyan-600 bg-cyan-50' },
  migration: { icon: GitFork, color: 'text-emerald-600 bg-emerald-50' },
  default: { icon: Activity, color: 'text-muted-foreground bg-muted/50' },
};

// ── Demo Data Generators ─────────────────────────────────────────────────────

function col(name: string, type: string, extra?: Partial<Column>): Column {
  return {
    id: `dc-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    dataType: type,
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    isUnique: false,
    ordinalPosition: 0,
    ...extra,
  };
}

function idx(name: string, cols: string[], unique = false): Index {
  return { id: name, name, type: 'BTREE', columns: cols, isUnique: unique };
}

function cstr(name: string, type: string, cols: string[]): Constraint {
  return { id: name, name, type, columns: cols };
}

function generateDemoTables(): Table[] {
  return [
    {
      id: 't-users', name: 'users', type: 'TABLE', estimatedRows: 150000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('email', 'VARCHAR(255)', { isUnique: true }),
        col('username', 'VARCHAR(100)', { isUnique: true }),
        col('password_hash', 'VARCHAR(255)'),
        col('full_name', 'VARCHAR(200)', { nullable: true }),
        col('role', 'VARCHAR(50)'),
        col('avatar_url', 'VARCHAR(500)', { nullable: true }),
        col('is_active', 'BOOLEAN'),
        col('last_login_at', 'TIMESTAMP', { nullable: true }),
        col('created_at', 'TIMESTAMP'),
        col('updated_at', 'TIMESTAMP'),
      ],
      indexes: [
        idx('idx_users_email', ['email'], true),
        idx('idx_users_username', ['username'], true),
        idx('idx_users_role', ['role']),
        idx('idx_users_active', ['is_active']),
        idx('idx_users_created', ['created_at']),
      ],
      constraints: [
        cstr('pk_users', 'PRIMARY KEY', ['id']),
        cstr('uq_users_email', 'UNIQUE', ['email']),
        cstr('uq_users_username', 'UNIQUE', ['username']),
      ],
    },
    {
      id: 't-orders', name: 'orders', type: 'TABLE', estimatedRows: 2500000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('customer_id', 'BIGINT', { isForeignKey: true }),
        col('order_number', 'VARCHAR(50)', { isUnique: true }),
        col('status', 'VARCHAR(30)'),
        col('total_amount', 'DECIMAL(12,2)'),
        col('currency', 'VARCHAR(3)'),
        col('shipping_address', 'TEXT', { nullable: true }),
        col('billing_address', 'TEXT', { nullable: true }),
        col('notes', 'TEXT', { nullable: true }),
        col('created_at', 'TIMESTAMP'),
        col('updated_at', 'TIMESTAMP'),
        col('shipped_at', 'TIMESTAMP', { nullable: true }),
        col('completed_at', 'TIMESTAMP', { nullable: true }),
      ],
      indexes: [
        idx('idx_orders_customer', ['customer_id']),
        idx('idx_orders_status', ['status']),
        idx('idx_orders_number', ['order_number'], true),
        idx('idx_orders_created', ['created_at']),
        idx('idx_orders_status_date', ['status', 'created_at']),
      ],
      constraints: [
        cstr('pk_orders', 'PRIMARY KEY', ['id']),
        cstr('fk_orders_customer', 'FOREIGN KEY', ['customer_id']),
        cstr('uq_orders_number', 'UNIQUE', ['order_number']),
      ],
    },
    {
      id: 't-products', name: 'products', type: 'TABLE', estimatedRows: 85000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('name', 'VARCHAR(300)'),
        col('slug', 'VARCHAR(300)', { isUnique: true }),
        col('description', 'TEXT', { nullable: true }),
        col('price', 'DECIMAL(10,2)'),
        col('compare_at_price', 'DECIMAL(10,2)', { nullable: true }),
        col('category_id', 'BIGINT', { isForeignKey: true }),
        col('sku', 'VARCHAR(100)', { isUnique: true }),
        col('stock_quantity', 'INTEGER'),
        col('weight', 'DECIMAL(8,2)', { nullable: true }),
        col('is_published', 'BOOLEAN'),
        col('created_at', 'TIMESTAMP'),
        col('updated_at', 'TIMESTAMP'),
      ],
      indexes: [
        idx('idx_products_slug', ['slug'], true),
        idx('idx_products_category', ['category_id']),
        idx('idx_products_sku', ['sku'], true),
        idx('idx_products_published', ['is_published']),
        idx('idx_products_price', ['price']),
      ],
      constraints: [
        cstr('pk_products', 'PRIMARY KEY', ['id']),
        cstr('fk_products_category', 'FOREIGN KEY', ['category_id']),
        cstr('uq_products_slug', 'UNIQUE', ['slug']),
        cstr('uq_products_sku', 'UNIQUE', ['sku']),
      ],
    },
    {
      id: 't-order_items', name: 'order_items', type: 'TABLE', estimatedRows: 6200000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('order_id', 'BIGINT', { isForeignKey: true }),
        col('product_id', 'BIGINT', { isForeignKey: true }),
        col('quantity', 'INTEGER'),
        col('unit_price', 'DECIMAL(10,2)'),
        col('total_price', 'DECIMAL(12,2)'),
        col('discount_amount', 'DECIMAL(10,2)', { nullable: true }),
      ],
      indexes: [
        idx('idx_oi_order', ['order_id']),
        idx('idx_oi_product', ['product_id']),
        idx('idx_oi_order_product', ['order_id', 'product_id']),
      ],
      constraints: [
        cstr('pk_order_items', 'PRIMARY KEY', ['id']),
        cstr('fk_oi_order', 'FOREIGN KEY', ['order_id']),
        cstr('fk_oi_product', 'FOREIGN KEY', ['product_id']),
      ],
    },
    {
      id: 't-categories', name: 'categories', type: 'TABLE', estimatedRows: 250,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('name', 'VARCHAR(200)'),
        col('slug', 'VARCHAR(200)', { isUnique: true }),
        col('parent_id', 'BIGINT', { nullable: true, isForeignKey: true }),
        col('description', 'TEXT', { nullable: true }),
        col('sort_order', 'INTEGER'),
        col('is_active', 'BOOLEAN'),
      ],
      indexes: [
        idx('idx_cat_slug', ['slug'], true),
        idx('idx_cat_parent', ['parent_id']),
        idx('idx_cat_active', ['is_active']),
      ],
      constraints: [
        cstr('pk_categories', 'PRIMARY KEY', ['id']),
        cstr('uq_cat_slug', 'UNIQUE', ['slug']),
        cstr('fk_cat_parent', 'FOREIGN KEY', ['parent_id']),
      ],
    },
    {
      id: 't-payments', name: 'payments', type: 'TABLE', estimatedRows: 2100000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('order_id', 'BIGINT', { isForeignKey: true }),
        col('method', 'VARCHAR(50)'),
        col('amount', 'DECIMAL(12,2)'),
        col('currency', 'VARCHAR(3)'),
        col('status', 'VARCHAR(30)'),
        col('gateway_ref', 'VARCHAR(200)', { nullable: true }),
        col('processed_at', 'TIMESTAMP', { nullable: true }),
        col('created_at', 'TIMESTAMP'),
      ],
      indexes: [
        idx('idx_pay_order', ['order_id']),
        idx('idx_pay_status', ['status']),
        idx('idx_pay_method', ['method']),
        idx('idx_pay_created', ['created_at']),
      ],
      constraints: [
        cstr('pk_payments', 'PRIMARY KEY', ['id']),
        cstr('fk_pay_order', 'FOREIGN KEY', ['order_id']),
      ],
    },
    {
      id: 't-reviews', name: 'reviews', type: 'TABLE', estimatedRows: 420000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('product_id', 'BIGINT', { isForeignKey: true }),
        col('user_id', 'BIGINT', { isForeignKey: true }),
        col('rating', 'SMALLINT'),
        col('title', 'VARCHAR(200)', { nullable: true }),
        col('comment', 'TEXT', { nullable: true }),
        col('is_verified', 'BOOLEAN'),
        col('created_at', 'TIMESTAMP'),
      ],
      indexes: [
        idx('idx_rev_product', ['product_id']),
        idx('idx_rev_user', ['user_id']),
        idx('idx_rev_rating', ['rating']),
      ],
      constraints: [
        cstr('pk_reviews', 'PRIMARY KEY', ['id']),
        cstr('fk_rev_product', 'FOREIGN KEY', ['product_id']),
        cstr('fk_rev_user', 'FOREIGN KEY', ['user_id']),
      ],
    },
    {
      id: 't-sessions', name: 'sessions', type: 'TABLE', estimatedRows: 50000,
      columns: [
        col('id', 'VARCHAR(128)', { isPrimaryKey: true }),
        col('user_id', 'BIGINT', { isForeignKey: true }),
        col('ip_address', 'VARCHAR(45)', { nullable: true }),
        col('user_agent', 'TEXT', { nullable: true }),
        col('expires_at', 'TIMESTAMP'),
        col('created_at', 'TIMESTAMP'),
      ],
      indexes: [
        idx('idx_sess_user', ['user_id']),
        idx('idx_sess_expires', ['expires_at']),
      ],
      constraints: [
        cstr('pk_sessions', 'PRIMARY KEY', ['id']),
        cstr('fk_sess_user', 'FOREIGN KEY', ['user_id']),
      ],
    },
    {
      id: 't-audit_logs', name: 'audit_logs', type: 'TABLE', estimatedRows: 15000000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('user_id', 'BIGINT', { nullable: true, isForeignKey: true }),
        col('action', 'VARCHAR(50)'),
        col('entity_type', 'VARCHAR(50)'),
        col('entity_id', 'VARCHAR(100)', { nullable: true }),
        col('details', 'JSONB', { nullable: true }),
        col('ip_address', 'VARCHAR(45)', { nullable: true }),
        col('created_at', 'TIMESTAMP'),
      ],
      indexes: [
        idx('idx_al_user', ['user_id']),
        idx('idx_al_action', ['action']),
        idx('idx_al_entity', ['entity_type', 'entity_id']),
        idx('idx_al_created', ['created_at']),
      ],
      constraints: [
        cstr('pk_audit_logs', 'PRIMARY KEY', ['id']),
        cstr('fk_al_user', 'FOREIGN KEY', ['user_id']),
      ],
    },
    {
      id: 't-notifications', name: 'notifications', type: 'TABLE', estimatedRows: 800000,
      columns: [
        col('id', 'BIGINT', { isPrimaryKey: true }),
        col('user_id', 'BIGINT', { isForeignKey: true }),
        col('type', 'VARCHAR(50)'),
        col('title', 'VARCHAR(200)'),
        col('message', 'TEXT'),
        col('is_read', 'BOOLEAN'),
        col('created_at', 'TIMESTAMP'),
      ],
      indexes: [
        idx('idx_notif_user', ['user_id']),
        idx('idx_notif_read', ['user_id', 'is_read']),
        idx('idx_notif_type', ['type']),
      ],
      constraints: [
        cstr('pk_notifications', 'PRIMARY KEY', ['id']),
        cstr('fk_notif_user', 'FOREIGN KEY', ['user_id']),
      ],
    },
  ];
}

function generateDemoRelationships(): Relationship[] {
  return [
    { id: 'r1', name: 'orders_customer', sourceTable: 't-orders', sourceTableName: 'orders', sourceColumn: 'customer_id', targetTable: 't-users', targetTableName: 'users', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r2', name: 'oi_order', sourceTable: 't-order_items', sourceTableName: 'order_items', sourceColumn: 'order_id', targetTable: 't-orders', targetTableName: 'orders', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r3', name: 'oi_product', sourceTable: 't-order_items', sourceTableName: 'order_items', sourceColumn: 'product_id', targetTable: 't-products', targetTableName: 'products', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r4', name: 'products_category', sourceTable: 't-products', sourceTableName: 'products', sourceColumn: 'category_id', targetTable: 't-categories', targetTableName: 'categories', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r5', name: 'categories_self', sourceTable: 't-categories', sourceTableName: 'categories', sourceColumn: 'parent_id', targetTable: 't-categories', targetTableName: 'categories', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r6', name: 'payments_order', sourceTable: 't-payments', sourceTableName: 'payments', sourceColumn: 'order_id', targetTable: 't-orders', targetTableName: 'orders', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r7', name: 'reviews_product', sourceTable: 't-reviews', sourceTableName: 'reviews', sourceColumn: 'product_id', targetTable: 't-products', targetTableName: 'products', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r8', name: 'reviews_user', sourceTable: 't-reviews', sourceTableName: 'reviews', sourceColumn: 'user_id', targetTable: 't-users', targetTableName: 'users', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r9', name: 'sessions_user', sourceTable: 't-sessions', sourceTableName: 'sessions', sourceColumn: 'user_id', targetTable: 't-users', targetTableName: 'users', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r10', name: 'audit_user', sourceTable: 't-audit_logs', sourceTableName: 'audit_logs', sourceColumn: 'user_id', targetTable: 't-users', targetTableName: 'users', targetColumn: 'id', type: 'many-to-one', isInferred: false },
    { id: 'r11', name: 'notif_user', sourceTable: 't-notifications', sourceTableName: 'notifications', sourceColumn: 'user_id', targetTable: 't-users', targetTableName: 'users', targetColumn: 'id', type: 'many-to-one', isInferred: false },
  ];
}

// ── Health Score Helpers ─────────────────────────────────────────────────────

function getHealthColor(score: number) {
  if (score >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-100', label: 'Excellent' };
  if (score >= 60) return { text: 'text-amber-600', bg: 'bg-amber-500', bgLight: 'bg-amber-100', label: 'Good' };
  if (score >= 40) return { text: 'text-orange-600', bg: 'bg-orange-500', bgLight: 'bg-orange-100', label: 'Needs Work' };
  return { text: 'text-red-600', bg: 'bg-red-500', bgLight: 'bg-red-100', label: 'Critical' };
}

function getBarColor(value: number) {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-amber-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getTableHealth(table: Table): { label: string; color: string; bg: string } {
  const hasPK = table.columns?.some(c => c.isPrimaryKey) ?? false;
  const hasIndex = (table.indexes?.length ?? 0) > 0;
  const hasConstraints = (table.constraints?.length ?? 0) > 1; // More than just PK
  if (hasPK && hasIndex && hasConstraints) return { label: 'Healthy', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (hasPK && hasIndex) return { label: 'Good', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  if (hasPK) return { label: 'Basic', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { label: 'At Risk', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProjectOverview() {
  const { project } = useOutletContext<{ project: Project }>();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const dialect = getDialect(project.dialect);

  // Data hooks
  const { data: projectStats } = useProjectStats(projectId);
  const { data: tables } = useTables(projectId);
  const { data: relationships } = useRelationships(projectId);
  const { data: auditData } = useAuditLogs({ projectId, limit: 10 });
  const { data: performanceRuns } = usePerformanceRuns(projectId);
  const { data: migrations } = useMigrations(projectId);
  const { data: connections } = useConnections(projectId);
  const { data: lifecycleRules } = useDataLifecycleRules(projectId);
  const { data: savedQueries } = useSavedQueries(projectId);

  // Demo state
  const [demoTables, setDemoTables] = useState<Table[] | null>(null);
  const [demoRelationships, setDemoRelationships] = useState<Relationship[] | null>(null);
  const isDemoActive = demoTables !== null;

  // Effective data: demo overrides hook data
  const displayTables = demoTables || tables || [];
  const displayRelationships = demoRelationships || relationships || [];

  const handleLoadDemo = useCallback(() => {
    setDemoTables(generateDemoTables());
    setDemoRelationships(generateDemoRelationships());
  }, []);

  const handleClearDemo = useCallback(() => {
    setDemoTables(null);
    setDemoRelationships(null);
  }, []);

  // ── Computed Data ────────────────────────────────────────────────────────

  const totalColumns = useMemo(() => {
    return displayTables.reduce((sum, t) => sum + (t.columns?.length ?? 0), 0);
  }, [displayTables]);

  const totalIndexes = useMemo(() => {
    return displayTables.reduce((sum, t) => sum + (t.indexes?.length ?? 0), 0);
  }, [displayTables]);

  const totalConstraints = useMemo(() => {
    return displayTables.reduce((sum, t) => sum + (t.constraints?.length ?? 0), 0);
  }, [displayTables]);

  const columnsPerTable = useMemo(() => {
    if (displayTables.length === 0) return [];
    return displayTables
      .map(t => ({ table: t.name, columns: t.columns?.length ?? 0 }))
      .sort((a, b) => b.columns - a.columns)
      .slice(0, 12);
  }, [displayTables]);

  const tableDistribution = useMemo(() => {
    if (displayTables.length === 0) return [];
    return displayTables
      .map((t, i) => ({ name: t.name, value: t.columns?.length ?? 0, fill: PIE_COLORS[i % PIE_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [displayTables]);

  const dataTypeDistribution = useMemo(() => {
    if (displayTables.length === 0) return [];
    const typeMap: Record<string, number> = {};
    displayTables.forEach(t => {
      t.columns?.forEach(c => {
        const type = c.dataType.toUpperCase().split('(')[0].trim();
        typeMap[type] = (typeMap[type] || 0) + 1;
      });
    });
    return Object.entries(typeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [displayTables]);

  const indexCoverageData = useMemo(() => {
    if (displayTables.length === 0) return [];
    return displayTables
      .map(t => ({ table: t.name, indexes: t.indexes?.length ?? 0, constraints: t.constraints?.length ?? 0 }))
      .sort((a, b) => (b.indexes + b.constraints) - (a.indexes + a.constraints))
      .slice(0, 12);
  }, [displayTables]);

  const estimatedRowsData = useMemo(() => {
    if (displayTables.length === 0) return [];
    return displayTables
      .filter(t => (t.estimatedRows ?? 0) > 0)
      .map(t => ({ table: t.name, rows: t.estimatedRows ?? 0 }))
      .sort((a, b) => b.rows - a.rows)
      .slice(0, 10);
  }, [displayTables]);

  const schemaHealth = useMemo(() => {
    if (displayTables.length === 0) return null;
    const tablesWithIndexes = displayTables.filter(t => (t.indexes?.length ?? 0) > 0).length;
    const tablesWithFK = displayTables.filter(t => t.columns?.some(c => c.isForeignKey) ?? false).length;
    const tablesWithPK = displayTables.filter(t => t.columns?.some(c => c.isPrimaryKey) ?? false).length;
    const allColumns = displayTables.flatMap(t => t.columns || []);
    const nullableColumns = allColumns.filter(c => c.nullable).length;

    const pkCoverage = Math.round((tablesWithPK / displayTables.length) * 100);
    const indexCoverage = Math.round((tablesWithIndexes / displayTables.length) * 100);
    const fkCoverage = Math.round((tablesWithFK / displayTables.length) * 100);
    const nullableRatio = Math.round((nullableColumns / Math.max(allColumns.length, 1)) * 100);

    const overallScore = Math.round(
      pkCoverage * 0.30 + indexCoverage * 0.30 + fkCoverage * 0.20 + (100 - nullableRatio) * 0.20
    );

    return { pkCoverage, indexCoverage, fkCoverage, nullableRatio, overallScore };
  }, [displayTables]);

  // Operations data
  const connectionCounts = useMemo(() => {
    const list = connections || [];
    return {
      total: list.length,
      connected: list.filter(c => c.status === 'connected').length,
      disconnected: list.filter(c => c.status === 'disconnected').length,
      error: list.filter(c => c.status === 'error').length,
    };
  }, [connections]);

  const migrationCounts = useMemo(() => {
    const list = migrations || [];
    return {
      total: list.length,
      completed: list.filter(m => m.status === 'completed').length,
      pending: list.filter(m => m.status === 'pending').length,
      running: list.filter(m => m.status === 'running').length,
      failed: list.filter(m => m.status === 'failed').length,
    };
  }, [migrations]);

  const lifecycleCounts = useMemo(() => {
    const list = lifecycleRules || [];
    return {
      total: list.length,
      active: list.filter(r => r.active).length,
      inactive: list.filter(r => !r.active).length,
      critical: list.filter(r => r.priority === 'critical').length,
      high: list.filter(r => r.priority === 'high').length,
    };
  }, [lifecycleRules]);

  const perfRunCounts = useMemo(() => {
    const list = performanceRuns || [];
    return {
      total: list.length,
      completed: list.filter(r => r.status === 'completed').length,
      failed: list.filter(r => r.status === 'failed').length,
      running: list.filter(r => r.status === 'running').length,
    };
  }, [performanceRuns]);

  // KPI stat cards
  const tableCount = displayTables.length || (projectStats?.tables ?? project.tableCount ?? 0);
  const relationshipCount = displayRelationships.length;
  const savedQueryCount = savedQueries?.length ?? projectStats?.queries ?? project.queryCount ?? 0;

  const kpiStats = [
    { label: 'Tables', value: tableCount, icon: Table2, gradient: 'from-aqua-500 to-cyan-500' },
    { label: 'Columns', value: totalColumns, icon: Columns3, gradient: 'from-violet-500 to-purple-500' },
    { label: 'Relationships', value: relationshipCount, icon: GitFork, gradient: 'from-amber-500 to-orange-500' },
    { label: 'Indexes', value: totalIndexes, icon: Key, gradient: 'from-emerald-500 to-teal-500' },
    { label: 'Saved Queries', value: savedQueryCount, icon: Terminal, gradient: 'from-blue-500 to-indigo-500' },
    { label: 'Connections', value: connectionCounts.total, icon: Server, gradient: 'from-cyan-500 to-sky-500' },
    { label: 'Migrations', value: migrationCounts.total, icon: Layers, gradient: 'from-fuchsia-500 to-pink-500' },
    { label: 'Perf Runs', value: perfRunCounts.total, icon: Zap, gradient: 'from-rose-500 to-red-500' },
  ];

  const quickActions = [
    { label: 'Upload SQL', description: 'Import SQL files to analyze schemas', icon: Upload, gradient: 'from-aqua-500 to-cyan-500', onClick: () => navigate(`/project/${projectId}/schema`) },
    { label: 'View Schema', description: 'Explore your database schema visually', icon: Database, gradient: 'from-violet-500 to-purple-500', onClick: () => navigate(`/project/${projectId}/schema`) },
    { label: 'Query Editor', description: 'Write and optimize SQL queries with AI', icon: PenTool, gradient: 'from-amber-500 to-orange-500', onClick: () => navigate(`/project/${projectId}/query`) },
    { label: 'AI Assistant', description: 'Get AI-powered database recommendations', icon: Bot, gradient: 'from-emerald-500 to-teal-500', onClick: () => {} },
  ];

  const recentActivity = auditData?.data ?? [];
  const hasSchemaData = displayTables.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] space-y-6">
      {/* ── Project Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-card rounded-xl border border-border shadow-sm">
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
                      style={{ backgroundColor: `${dialect.color}15`, color: dialect.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dialect.color }} />
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {isDemoActive ? (
                <button
                  onClick={handleClearDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Clear Demo
                </button>
              ) : (
                <button
                  onClick={handleLoadDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-lg hover:bg-aqua-100 transition-colors"
                >
                  <FlaskConical className="w-3 h-3" />
                  Load Demo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="group text-left bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:border-aqua-200 transition-all duration-200"
            >
              <div className={cn('w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2.5 shadow-sm', action.gradient)}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-aqua-600 transition-colors">{action.label}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{action.description}</p>
            </button>
          );
        })}
      </div>

      {/* ── KPI Stats Grid (8 cards) ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
                </div>
                <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br shadow-sm', stat.gradient)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Schema Health Panel ──────────────────────────────────────────── */}
      {schemaHealth ? (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-aqua-500" />
              <h3 className="text-sm font-semibold text-foreground">Schema Health Score</h3>
            </div>
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
              getHealthColor(schemaHealth.overallScore).bgLight,
              getHealthColor(schemaHealth.overallScore).text,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', getHealthColor(schemaHealth.overallScore).bg)} />
              {getHealthColor(schemaHealth.overallScore).label}
            </span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Overall Score */}
              <div className="lg:col-span-1 flex flex-col items-center justify-center">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={schemaHealth.overallScore >= 80 ? '#10b981' : schemaHealth.overallScore >= 60 ? '#f59e0b' : schemaHealth.overallScore >= 40 ? '#f97316' : '#ef4444'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${schemaHealth.overallScore * 2.64} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn('text-2xl font-bold', getHealthColor(schemaHealth.overallScore).text)}>
                      {schemaHealth.overallScore}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Health Metrics */}
              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Primary Key Coverage', value: schemaHealth.pkCoverage, icon: Key, desc: 'Tables with defined primary keys' },
                  { label: 'Index Coverage', value: schemaHealth.indexCoverage, icon: Zap, desc: 'Tables with at least one index' },
                  { label: 'Foreign Key Coverage', value: schemaHealth.fkCoverage, icon: GitFork, desc: 'Tables with foreign key relationships' },
                  { label: 'Nullable Ratio', value: schemaHealth.nullableRatio, icon: AlertTriangle, desc: 'Columns allowing NULL values', invert: true },
                ].map(metric => (
                  <div key={metric.label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <metric.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{metric.label}</span>
                      </div>
                      <span className={cn('text-xs font-bold', metric.invert
                        ? (metric.value <= 30 ? 'text-emerald-600' : metric.value <= 50 ? 'text-amber-600' : 'text-red-600')
                        : (metric.value >= 80 ? 'text-emerald-600' : metric.value >= 60 ? 'text-amber-600' : 'text-red-600')
                      )}>
                        {metric.value}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          metric.invert ? getBarColor(100 - metric.value) : getBarColor(metric.value),
                        )}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{metric.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Health Summary Chips */}
            <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border/50">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground">
                <Table2 className="w-3 h-3" /> {displayTables.length} tables
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground">
                <Columns3 className="w-3 h-3" /> {totalColumns} columns
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground">
                <Key className="w-3 h-3" /> {totalIndexes} indexes
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground">
                <Shield className="w-3 h-3" /> {totalConstraints} constraints
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground">
                <GitFork className="w-3 h-3" /> {displayRelationships.length} relationships
              </div>
            </div>
          </div>
        </div>
      ) : !hasSchemaData ? (
        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No schema data yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Upload a SQL file or click "Load Demo" to see schema health analysis and visualizations.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/project/${projectId}/schema`)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload SQL File
              </button>
              <button
                onClick={handleLoadDemo}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-lg hover:bg-aqua-100 transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Load Demo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Charts Row 1: Columns per Table + Data Type Distribution ───── */}
      {hasSchemaData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columns per Table */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-aqua-500" />
              <h3 className="text-sm font-semibold text-foreground">Columns per Table</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={columnsPerTable} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="table" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Bar dataKey="columns" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={36} name="Columns" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Type Distribution */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-foreground">Data Type Distribution</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataTypeDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis type="category" dataKey="type" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} width={55} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20} name="Count">
                    {dataTypeDistribution.map((_entry, index) => (
                      <Cell key={`dtype-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts Row 2: Distribution Pie + Index Coverage ──────────── */}
      {hasSchemaData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column Distribution Donut */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-aqua-500" />
              <h3 className="text-sm font-semibold text-foreground">Column Distribution by Table</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tableDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {tableDistribution.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number) => [`${value} columns`, 'Columns']} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Index & Constraint Coverage per Table */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Indexes & Constraints per Table</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indexCoverageData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="table" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Bar dataKey="indexes" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={30} name="Indexes" />
                  <Bar dataKey="constraints" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={30} name="Constraints" />
                  <Legend verticalAlign="top" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Estimated Rows (Data Volume) ─────────────────────────────── */}
      {estimatedRowsData.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-aqua-500" />
            <h3 className="text-sm font-semibold text-foreground">Estimated Data Volume by Table</h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={estimatedRowsData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="rowsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="table" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tickFormatter={(v: number) => formatNumber(v)} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number) => [formatNumber(value) + ' rows', 'Est. Rows']} />
                <Area type="monotone" dataKey="rows" stroke="#0891b2" strokeWidth={2} fill="url(#rowsGradient)" name="Est. Rows" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Table Insights Grid ──────────────────────────────────────── */}
      {hasSchemaData && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-aqua-500" />
              <h3 className="text-sm font-semibold text-foreground">Table Insights</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {displayTables.length} tables analyzed
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/50">
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-5">Table Name</th>
                  <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-3">Columns</th>
                  <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-3">Indexes</th>
                  <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-3">Constraints</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-3">Est. Rows</th>
                  <th className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-5">Health</th>
                </tr>
              </thead>
              <tbody>
                {displayTables
                  .slice()
                  .sort((a, b) => (b.columns?.length ?? 0) - (a.columns?.length ?? 0))
                  .map(table => {
                    const health = getTableHealth(table);
                    return (
                      <tr key={table.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <Table2 className="w-3.5 h-3.5 text-aqua-500 flex-shrink-0" />
                            <span className="text-sm font-medium text-foreground">{table.name}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 text-xs font-semibold text-violet-700 bg-violet-50 rounded-full">
                            {table.columns?.length ?? 0}
                          </span>
                        </td>
                        <td className="text-center py-3 px-3">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full">
                            {table.indexes?.length ?? 0}
                          </span>
                        </td>
                        <td className="text-center py-3 px-3">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full">
                            {table.constraints?.length ?? 0}
                          </span>
                        </td>
                        <td className="text-right py-3 px-3">
                          <span className="text-sm font-mono text-muted-foreground">
                            {table.estimatedRows ? formatNumber(table.estimatedRows) : '—'}
                          </span>
                        </td>
                        <td className="text-center py-3 px-5">
                          <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border', health.bg, health.color)}>
                            {health.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Operations Monitor ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connections */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-semibold text-foreground">Connections</h3>
          </div>
          <div className="p-5">
            {connectionCounts.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">{connectionCounts.total}</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Connected', count: connectionCounts.connected, dot: 'bg-emerald-500', text: 'text-emerald-700' },
                    { label: 'Disconnected', count: connectionCounts.disconnected, dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
                    { label: 'Error', count: connectionCounts.error, dot: 'bg-red-500', text: 'text-red-700' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.label} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', s.dot)} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                      <span className={cn('text-xs font-bold', s.text)}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Server className="w-6 h-6 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No connections configured</p>
              </div>
            )}
          </div>
        </div>

        {/* Migrations */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Layers className="w-4 h-4 text-fuchsia-500" />
            <h3 className="text-sm font-semibold text-foreground">Migrations</h3>
          </div>
          <div className="p-5">
            {migrationCounts.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">{migrationCounts.total}</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Completed', count: migrationCounts.completed, dot: 'bg-emerald-500', text: 'text-emerald-700' },
                    { label: 'Running', count: migrationCounts.running, dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700' },
                    { label: 'Pending', count: migrationCounts.pending, dot: 'bg-amber-500', text: 'text-amber-700' },
                    { label: 'Failed', count: migrationCounts.failed, dot: 'bg-red-500', text: 'text-red-700' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.label} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', s.dot)} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                      <span className={cn('text-xs font-bold', s.text)}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Layers className="w-6 h-6 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No migrations yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Lifecycle Rules */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-foreground">Data Lifecycle</h3>
          </div>
          <div className="p-5">
            {lifecycleCounts.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Rules</span>
                  <span className="text-lg font-bold text-foreground">{lifecycleCounts.total}</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Active', count: lifecycleCounts.active, dot: 'bg-emerald-500', text: 'text-emerald-700' },
                    { label: 'Inactive', count: lifecycleCounts.inactive, dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
                    { label: 'Critical Priority', count: lifecycleCounts.critical, dot: 'bg-red-500', text: 'text-red-700' },
                    { label: 'High Priority', count: lifecycleCounts.high, dot: 'bg-amber-500', text: 'text-amber-700' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.label} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', s.dot)} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                      <span className={cn('text-xs font-bold', s.text)}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <RefreshCw className="w-6 h-6 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No lifecycle rules defined</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Performance Runs Summary ─────────────────────────────────── */}
      {perfRunCounts.total > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-foreground">Performance Runs</h3>
            </div>
            <button
              onClick={() => navigate(`/project/${projectId}/performance`)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-aqua-600 hover:text-aqua-700 transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Runs', value: perfRunCounts.total, color: 'text-foreground', bg: 'bg-muted/50' },
                { label: 'Completed', value: perfRunCounts.completed, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                { label: 'Running', value: perfRunCounts.running, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                { label: 'Failed', value: perfRunCounts.failed, color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/30' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-lg p-4 text-center', item.bg)}>
                  <p className="text-2xl font-bold mb-0.5" style={{ color: undefined }}>
                    <span className={item.color}>{item.value}</span>
                  </p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Activity Timeline ─────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-aqua-500" />
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          </div>
        </div>
        {recentActivity.length > 0 ? (
          <div className="divide-y divide-border/50">
            {recentActivity.map((item, index) => {
              const entityKey = (item.entityType ?? item.entity ?? 'default') as string;
              const activityConfig = ACTIVITY_ICONS[entityKey.toLowerCase()] ?? ACTIVITY_ICONS.default;
              const Icon = activityConfig.icon;
              return (
                <div key={item.id} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center pt-0.5">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', activityConfig.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {index < recentActivity.length - 1 && (
                      <div className="w-px h-full bg-border mt-2 min-h-[16px]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.details}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 pt-0.5">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Activity will appear here as you work with this project.
            </p>
          </div>
        )}
      </div>

      {/* Navigation hint */}
      <p className="text-center text-xs text-muted-foreground py-2">
        Use the sidebar to navigate between project modules
      </p>
    </div>
  );
}

export default ProjectOverview;
