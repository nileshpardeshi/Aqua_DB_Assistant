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
  Activity,
  CheckCircle2,
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
  RefreshCw,
  AlertCircle,
  Info,
  BarChart3,
  PieChart as PieChartIcon,
  CircleDot,
  Workflow,
  ShieldAlert,
  ShieldCheck,
  Lightbulb,
  ArrowRight,
  Target,
  Cpu,
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
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
  borderRadius: '10px',
  fontSize: '12px',
  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  padding: '10px 14px',
};

const ACTIVITY_ICONS: Record<string, { icon: typeof Database; color: string; bg: string }> = {
  project: { icon: Database, color: 'text-aqua-600', bg: 'bg-aqua-50' },
  schema: { icon: Table2, color: 'text-violet-600', bg: 'bg-violet-50' },
  query: { icon: Terminal, color: 'text-amber-600', bg: 'bg-amber-50' },
  file: { icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  migration: { icon: GitFork, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  connection: { icon: Server, color: 'text-blue-600', bg: 'bg-blue-50' },
  settings: { icon: Cpu, color: 'text-slate-600', bg: 'bg-slate-50' },
  default: { icon: Activity, color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

const ACTION_BADGES: Record<string, { label: string; cls: string }> = {
  CREATE: { label: 'Created', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UPDATE: { label: 'Updated', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  DELETE: { label: 'Deleted', cls: 'bg-red-50 text-red-700 border-red-200' },
  ANALYZE: { label: 'Analyzed', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  EXECUTE: { label: 'Executed', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  UPLOAD: { label: 'Uploaded', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  EXPORT: { label: 'Exported', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  IMPORT: { label: 'Imported', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
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

// ── Health Helpers ────────────────────────────────────────────────────────────

function getHealthConfig(score: number) {
  if (score >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', border: 'border-emerald-200', label: 'Excellent', ring: 'ring-emerald-500/20' };
  if (score >= 60) return { text: 'text-amber-600', bg: 'bg-amber-500', bgLight: 'bg-amber-50', border: 'border-amber-200', label: 'Good', ring: 'ring-amber-500/20' };
  if (score >= 40) return { text: 'text-orange-600', bg: 'bg-orange-500', bgLight: 'bg-orange-50', border: 'border-orange-200', label: 'Needs Work', ring: 'ring-orange-500/20' };
  return { text: 'text-red-600', bg: 'bg-red-500', bgLight: 'bg-red-50', border: 'border-red-200', label: 'Critical', ring: 'ring-red-500/20' };
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
  const hasConstraints = (table.constraints?.length ?? 0) > 1;
  if (hasPK && hasIndex && hasConstraints) return { label: 'Healthy', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (hasPK && hasIndex) return { label: 'Good', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  if (hasPK) return { label: 'Basic', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { label: 'At Risk', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
}

// ── Issue & Recommendation Types ─────────────────────────────────────────────

interface SchemaIssue {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  tables: string[];
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  module: string;
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

  // ── Computed Metrics ──────────────────────────────────────────────────────

  const totalColumns = useMemo(() => displayTables.reduce((s, t) => s + (t.columns?.length ?? 0), 0), [displayTables]);
  const totalIndexes = useMemo(() => displayTables.reduce((s, t) => s + (t.indexes?.length ?? 0), 0), [displayTables]);
  const totalConstraints = useMemo(() => displayTables.reduce((s, t) => s + (t.constraints?.length ?? 0), 0), [displayTables]);
  const totalEstimatedRows = useMemo(() => displayTables.reduce((s, t) => s + (t.estimatedRows ?? 0), 0), [displayTables]);

  const avgColumnsPerTable = useMemo(() => {
    return displayTables.length > 0 ? Math.round(totalColumns / displayTables.length * 10) / 10 : 0;
  }, [displayTables, totalColumns]);

  const indexToTableRatio = useMemo(() => {
    return displayTables.length > 0 ? Math.round(totalIndexes / displayTables.length * 10) / 10 : 0;
  }, [displayTables, totalIndexes]);

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

    return { pkCoverage, indexCoverage, fkCoverage, nullableRatio, overallScore, tablesWithPK, tablesWithIndexes, tablesWithFK };
  }, [displayTables]);

  const radarData = useMemo(() => {
    if (!schemaHealth) return [];
    return [
      { metric: 'PK Coverage', value: schemaHealth.pkCoverage, fullMark: 100 },
      { metric: 'Indexing', value: schemaHealth.indexCoverage, fullMark: 100 },
      { metric: 'FK Relations', value: schemaHealth.fkCoverage, fullMark: 100 },
      { metric: 'Data Integrity', value: 100 - schemaHealth.nullableRatio, fullMark: 100 },
      { metric: 'Normalization', value: Math.min(100, Math.round(displayRelationships.length / Math.max(displayTables.length, 1) * 100)), fullMark: 100 },
      { metric: 'Constraints', value: Math.min(100, Math.round(totalConstraints / Math.max(displayTables.length, 1) * 40)), fullMark: 100 },
    ];
  }, [schemaHealth, displayRelationships, displayTables, totalConstraints]);

  // Auto-detected issues
  const schemaIssues = useMemo((): SchemaIssue[] => {
    if (displayTables.length === 0) return [];
    const issues: SchemaIssue[] = [];

    const noPK = displayTables.filter(t => !t.columns?.some(c => c.isPrimaryKey));
    if (noPK.length > 0) {
      issues.push({ severity: 'critical', title: 'Missing Primary Keys', description: `${noPK.length} table(s) lack a primary key, which can cause data integrity issues and poor query performance.`, tables: noPK.map(t => t.name) });
    }

    const noIndex = displayTables.filter(t => (t.indexes?.length ?? 0) === 0);
    if (noIndex.length > 0) {
      issues.push({ severity: 'warning', title: 'Unindexed Tables', description: `${noIndex.length} table(s) have no indexes, which may cause full table scans and slow queries.`, tables: noIndex.map(t => t.name) });
    }

    const highNullable = displayTables.filter(t => {
      const cols = t.columns || [];
      const nullable = cols.filter(c => c.nullable).length;
      return cols.length > 0 && (nullable / cols.length) > 0.6;
    });
    if (highNullable.length > 0) {
      issues.push({ severity: 'warning', title: 'High Nullable Column Ratio', description: `${highNullable.length} table(s) have >60% nullable columns, which may indicate schema design issues.`, tables: highNullable.map(t => t.name) });
    }

    const wideTable = displayTables.filter(t => (t.columns?.length ?? 0) > 20);
    if (wideTable.length > 0) {
      issues.push({ severity: 'info', title: 'Wide Tables Detected', description: `${wideTable.length} table(s) have more than 20 columns. Consider normalization or vertical partitioning.`, tables: wideTable.map(t => t.name) });
    }

    const largeVolume = displayTables.filter(t => (t.estimatedRows ?? 0) > 10_000_000);
    if (largeVolume.length > 0) {
      issues.push({ severity: 'info', title: 'High-Volume Tables', description: `${largeVolume.length} table(s) have >10M estimated rows. Consider partitioning, archival, or data lifecycle policies.`, tables: largeVolume.map(t => t.name) });
    }

    const isolatedTables = displayTables.filter(t => {
      const hasFK = t.columns?.some(c => c.isForeignKey) ?? false;
      const isTarget = displayRelationships.some(r => r.targetTable === t.id);
      return !hasFK && !isTarget;
    });
    if (isolatedTables.length > 0) {
      issues.push({ severity: 'info', title: 'Isolated Tables', description: `${isolatedTables.length} table(s) have no foreign key relationships, which may indicate missing data connections.`, tables: isolatedTables.map(t => t.name) });
    }

    return issues;
  }, [displayTables, displayRelationships]);

  // Recommendations
  const recommendations = useMemo((): Recommendation[] => {
    const recs: Recommendation[] = [];
    if (displayTables.length === 0) {
      recs.push({ priority: 'high', title: 'Import Your Schema', module: 'Schema Intelligence', description: 'Upload a SQL file to get schema health analysis, ER diagrams, and AI-powered recommendations.' });
    }
    if (schemaIssues.some(i => i.severity === 'critical')) {
      recs.push({ priority: 'high', title: 'Address Critical Schema Issues', module: 'Schema Intelligence', description: 'Fix missing primary keys and other critical issues to ensure data integrity.' });
    }
    if ((connections || []).length === 0) {
      recs.push({ priority: 'medium', title: 'Configure Database Connection', module: 'Connections', description: 'Connect to your live database for real-time monitoring, query execution, and schema introspection.' });
    }
    if ((migrations || []).length === 0 && displayTables.length > 0) {
      recs.push({ priority: 'medium', title: 'Set Up Migration Tracking', module: 'Migration Studio', description: 'Track schema changes with versioned migrations for safe, repeatable deployments.' });
    }
    if ((lifecycleRules || []).length === 0 && totalEstimatedRows > 1_000_000) {
      recs.push({ priority: 'medium', title: 'Define Data Lifecycle Policies', module: 'Data Lifecycle', description: 'With high data volumes, consider retention policies and archival strategies.' });
    }
    if ((performanceRuns || []).length === 0 && displayTables.length > 0) {
      recs.push({ priority: 'low', title: 'Run Performance Benchmarks', module: 'Performance Lab', description: 'Benchmark your schema with synthetic data to identify bottlenecks before production.' });
    }
    return recs;
  }, [displayTables, schemaIssues, connections, migrations, lifecycleRules, performanceRuns, totalEstimatedRows]);

  // Chart data
  const columnsPerTable = useMemo(() => {
    if (displayTables.length === 0) return [];
    return displayTables.map(t => ({ table: t.name, columns: t.columns?.length ?? 0, indexes: t.indexes?.length ?? 0 })).sort((a, b) => b.columns - a.columns).slice(0, 12);
  }, [displayTables]);

  const dataTypeDistribution = useMemo(() => {
    if (displayTables.length === 0) return [];
    const typeMap: Record<string, number> = {};
    displayTables.forEach(t => { t.columns?.forEach(c => { const type = c.dataType.toUpperCase().split('(')[0].trim(); typeMap[type] = (typeMap[type] || 0) + 1; }); });
    return Object.entries(typeMap).map(([type, count], i) => ({ type, count, fill: PIE_COLORS[i % PIE_COLORS.length] })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [displayTables]);

  const estimatedRowsData = useMemo(() => {
    if (displayTables.length === 0) return [];
    return displayTables.filter(t => (t.estimatedRows ?? 0) > 0).map(t => ({ table: t.name, rows: t.estimatedRows ?? 0 })).sort((a, b) => b.rows - a.rows).slice(0, 10);
  }, [displayTables]);

  // Operations data
  const connectionCounts = useMemo(() => { const l = connections || []; return { total: l.length, connected: l.filter(c => c.status === 'connected').length, disconnected: l.filter(c => c.status === 'disconnected').length, error: l.filter(c => c.status === 'error').length }; }, [connections]);
  const migrationCounts = useMemo(() => { const l = migrations || []; return { total: l.length, completed: l.filter(m => m.status === 'completed').length, pending: l.filter(m => m.status === 'pending').length, running: l.filter(m => m.status === 'running').length, failed: l.filter(m => m.status === 'failed').length }; }, [migrations]);
  const lifecycleCounts = useMemo(() => { const l = lifecycleRules || []; return { total: l.length, active: l.filter(r => r.active).length, inactive: l.filter(r => !r.active).length, critical: l.filter(r => r.priority === 'critical').length, high: l.filter(r => r.priority === 'high').length }; }, [lifecycleRules]);
  const perfRunCounts = useMemo(() => { const l = performanceRuns || []; return { total: l.length, completed: l.filter(r => r.status === 'completed').length, failed: l.filter(r => r.status === 'failed').length, running: l.filter(r => r.status === 'running').length }; }, [performanceRuns]);

  const tableCount = displayTables.length || (projectStats?.tables ?? project.tableCount ?? 0);
  const savedQueryCount = savedQueries?.length ?? projectStats?.queries ?? project.queryCount ?? 0;
  const recentActivity = auditData?.data ?? [];
  const hasSchemaData = displayTables.length > 0;
  const criticalIssues = schemaIssues.filter(i => i.severity === 'critical').length;
  const warningIssues = schemaIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] space-y-6">
      {/* ── Project Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-card rounded-2xl border border-border shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-aqua-400 via-cyan-400 to-aqua-500" />
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aqua-500 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-aqua-500/20">
                <Database className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">{project.name}</h1>
                  {dialect && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border" style={{ backgroundColor: `${dialect.color}10`, color: dialect.color, borderColor: `${dialect.color}30` }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dialect.color }} />
                      {dialect.label}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xl leading-relaxed">
                  {project.description || 'No description provided for this project.'}
                </p>
                <div className="flex items-center gap-5 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Created {formatDate(project.createdAt, { relative: false })}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Updated {formatDate(project.updatedAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isDemoActive ? (
                <button onClick={handleClearDemo} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Clear Demo
                </button>
              ) : (
                <button onClick={handleLoadDemo} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-lg hover:bg-aqua-100 transition-colors">
                  <FlaskConical className="w-3 h-3" /> Load Demo Data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Tables', value: tableCount, icon: Table2, gradient: 'from-aqua-500 to-cyan-500', sub: hasSchemaData ? `${avgColumnsPerTable} cols/table` : undefined },
          { label: 'Columns', value: totalColumns, icon: Columns3, gradient: 'from-violet-500 to-purple-500', sub: hasSchemaData ? `${dataTypeDistribution.length} types` : undefined },
          { label: 'Relations', value: displayRelationships.length, icon: GitFork, gradient: 'from-amber-500 to-orange-500', sub: hasSchemaData ? `${(displayRelationships.length / Math.max(tableCount, 1)).toFixed(1)}/table` : undefined },
          { label: 'Indexes', value: totalIndexes, icon: Key, gradient: 'from-emerald-500 to-teal-500', sub: hasSchemaData ? `${indexToTableRatio}/table` : undefined },
          { label: 'Queries', value: savedQueryCount, icon: Terminal, gradient: 'from-blue-500 to-indigo-500', sub: undefined },
          { label: 'Connections', value: connectionCounts.total, icon: Server, gradient: 'from-cyan-500 to-sky-500', sub: connectionCounts.connected > 0 ? `${connectionCounts.connected} active` : undefined },
          { label: 'Migrations', value: migrationCounts.total, icon: Layers, gradient: 'from-fuchsia-500 to-pink-500', sub: migrationCounts.pending > 0 ? `${migrationCounts.pending} pending` : undefined },
          { label: 'Perf Runs', value: perfRunCounts.total, icon: Zap, gradient: 'from-rose-500 to-red-500', sub: perfRunCounts.failed > 0 ? `${perfRunCounts.failed} failed` : undefined },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:border-aqua-200/50 transition-all duration-200">
              <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br shadow-sm mb-2', stat.gradient)}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{stat.label}</p>
              {stat.sub && <p className="text-[10px] text-aqua-600 font-medium mt-1">{stat.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* ── Schema Issues & Risks ─────────────────────────────────────── */}
      {schemaIssues.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-slate-50/80 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm">
                  <ShieldAlert className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Schema Issues & Risks</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Auto-detected from schema analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {criticalIssues > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200"><AlertCircle className="w-3 h-3" /> {criticalIssues} Critical</span>}
                {warningIssues > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle className="w-3 h-3" /> {warningIssues} Warning</span>}
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {schemaIssues.map((issue, i) => {
              const cfg = issue.severity === 'critical'
                ? { icon: AlertCircle, iconCls: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: 'CRITICAL', labelCls: 'bg-red-100 text-red-700' }
                : issue.severity === 'warning'
                  ? { icon: AlertTriangle, iconCls: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'WARNING', labelCls: 'bg-amber-100 text-amber-700' }
                  : { icon: Info, iconCls: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', label: 'INFO', labelCls: 'bg-blue-100 text-blue-700' };
              const IssIcon = cfg.icon;
              return (
                <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border', cfg.bg, cfg.border)}>
                    <IssIcon className={cn('w-4 h-4', cfg.iconCls)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider', cfg.labelCls)}>{cfg.label}</span>
                      <h4 className="text-sm font-semibold text-foreground">{issue.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
                    {issue.tables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {issue.tables.slice(0, 5).map(t => (
                          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted text-muted-foreground border border-border">
                            <Table2 className="w-2.5 h-2.5" /> {t}
                          </span>
                        ))}
                        {issue.tables.length > 5 && <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted text-muted-foreground">+{issue.tables.length - 5} more</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Schema Health + Quality Radar ─────────────────────────────── */}
      {schemaHealth ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-slate-50/80 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Schema Health Scorecard</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{displayTables.length} tables, {totalColumns} columns analyzed</p>
                  </div>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ring-2', getHealthConfig(schemaHealth.overallScore).bgLight, getHealthConfig(schemaHealth.overallScore).text, getHealthConfig(schemaHealth.overallScore).border, getHealthConfig(schemaHealth.overallScore).ring)}>
                  <span className={cn('w-2 h-2 rounded-full', getHealthConfig(schemaHealth.overallScore).bg)} />
                  {getHealthConfig(schemaHealth.overallScore).label}
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-1 flex flex-col items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                      <circle cx="50" cy="50" r="42" fill="none"
                        stroke={schemaHealth.overallScore >= 80 ? '#10b981' : schemaHealth.overallScore >= 60 ? '#f59e0b' : schemaHealth.overallScore >= 40 ? '#f97316' : '#ef4444'}
                        strokeWidth="7" strokeLinecap="round" strokeDasharray={`${schemaHealth.overallScore * 2.64} 264`} className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn('text-3xl font-black tracking-tight', getHealthConfig(schemaHealth.overallScore).text)}>{schemaHealth.overallScore}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold">/ 100</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium mt-2 text-center">Overall Health</p>
                </div>

                <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                  {[
                    { label: 'Primary Key Coverage', value: schemaHealth.pkCoverage, icon: Key, desc: `${schemaHealth.tablesWithPK} of ${displayTables.length} tables`, color: 'text-emerald-600' },
                    { label: 'Index Coverage', value: schemaHealth.indexCoverage, icon: Zap, desc: `${schemaHealth.tablesWithIndexes} of ${displayTables.length} tables`, color: 'text-blue-600' },
                    { label: 'Foreign Key Coverage', value: schemaHealth.fkCoverage, icon: GitFork, desc: `${schemaHealth.tablesWithFK} of ${displayTables.length} tables`, color: 'text-violet-600' },
                    { label: 'Nullable Ratio', value: schemaHealth.nullableRatio, icon: AlertTriangle, desc: 'Lower is better', invert: true, color: 'text-amber-600' },
                  ].map(metric => (
                    <div key={metric.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <metric.icon className={cn('w-4 h-4', metric.color)} />
                          <span className="text-xs font-semibold text-foreground">{metric.label}</span>
                        </div>
                        <span className={cn('text-sm font-bold', metric.invert
                          ? (metric.value <= 30 ? 'text-emerald-600' : metric.value <= 50 ? 'text-amber-600' : 'text-red-600')
                          : (metric.value >= 80 ? 'text-emerald-600' : metric.value >= 60 ? 'text-amber-600' : 'text-red-600')
                        )}>{metric.value}%</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700', metric.invert ? getBarColor(100 - metric.value) : getBarColor(metric.value))} style={{ width: `${metric.value}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{metric.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-border/50">
                {[
                  { icon: Table2, label: `${displayTables.length} tables` },
                  { icon: Columns3, label: `${totalColumns} columns` },
                  { icon: Key, label: `${totalIndexes} indexes` },
                  { icon: Shield, label: `${totalConstraints} constraints` },
                  { icon: GitFork, label: `${displayRelationships.length} relationships` },
                  { icon: BarChart3, label: `${formatNumber(totalEstimatedRows)} est. rows` },
                ].map(chip => (
                  <div key={chip.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/50">
                    <chip.icon className="w-3 h-3" /> {chip.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-slate-50/80 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Quality Radar</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Multi-dimension assessment</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Score" dataKey="value" stroke="#0891b2" fill="#0891b2" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : !hasSchemaData ? (
        <div className="bg-card rounded-2xl border border-border p-10 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aqua-100 to-cyan-100 flex items-center justify-center mb-5">
              <Shield className="w-8 h-8 text-aqua-600" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">No Schema Data Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
              Upload a SQL file or load demo data to see comprehensive schema health analysis, ER diagrams, risk detection, and AI-powered recommendations.
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(`/project/${projectId}/schema`)} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-aqua-600 to-cyan-600 rounded-xl hover:from-aqua-700 hover:to-cyan-700 transition-all shadow-lg shadow-aqua-500/20">
                <Upload className="w-4 h-4" /> Upload SQL File
              </button>
              <button onClick={handleLoadDemo} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-xl hover:bg-aqua-100 transition-colors">
                <FlaskConical className="w-4 h-4" /> Load Demo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Charts: Columns/Indexes + Data Type Distribution ─────────── */}
      {hasSchemaData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-aqua-50 flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5 text-aqua-600" /></div>
                <h3 className="text-sm font-bold text-foreground">Columns & Indexes per Table</h3>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Top {columnsPerTable.length}</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={columnsPerTable} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="table" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Legend verticalAlign="top" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
                  <Bar dataKey="columns" fill="#0891b2" radius={[0, 0, 0, 0]} maxBarSize={28} name="Columns" />
                  <Bar dataKey="indexes" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} name="Indexes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center"><PieChartIcon className="w-3.5 h-3.5 text-violet-600" /></div>
                <h3 className="text-sm font-bold text-foreground">Data Type Distribution</h3>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{totalColumns} total</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataTypeDistribution} cx="50%" cy="45%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="count" nameKey="type">
                    {dataTypeDistribution.map((entry, index) => (<Cell key={`dtype-${index}`} fill={entry.fill} />))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number, name: string) => [`${value} columns`, name]} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Estimated Data Volume ─────────────────────────────────────── */}
      {estimatedRowsData.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-cyan-600" /></div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Estimated Data Volume</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total: {formatNumber(totalEstimatedRows)} rows across {estimatedRowsData.length} tables</p>
              </div>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={estimatedRowsData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="rowsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="table" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tickFormatter={(v: number) => formatNumber(v)} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number) => [formatNumber(value) + ' rows', 'Est. Rows']} />
                <Area type="monotone" dataKey="rows" stroke="#0891b2" strokeWidth={2.5} fill="url(#rowsGradient)" name="Est. Rows" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Table Insights ────────────────────────────────────────────── */}
      {hasSchemaData && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-slate-50/80 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm"><Eye className="w-4 h-4 text-white" /></div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Table Insights</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{displayTables.length} tables analyzed</p>
                </div>
              </div>
              <button onClick={() => navigate(`/project/${projectId}/schema`)} className="inline-flex items-center gap-1 text-[11px] font-medium text-aqua-600 hover:text-aqua-700 transition-colors">
                View All <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3.5 px-5">Table</th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3.5 px-3">Columns</th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3.5 px-3">Indexes</th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3.5 px-3">Constraints</th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3.5 px-3">FKs</th>
                  <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3.5 px-3">Est. Rows</th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-3.5 px-5">Health</th>
                </tr>
              </thead>
              <tbody>
                {displayTables.slice().sort((a, b) => (b.estimatedRows ?? 0) - (a.estimatedRows ?? 0)).map(table => {
                  const health = getTableHealth(table);
                  const fkCount = table.columns?.filter(c => c.isForeignKey).length ?? 0;
                  return (
                    <tr key={table.id} className="border-b border-border/30 hover:bg-aqua-50/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <Table2 className="w-4 h-4 text-aqua-500 flex-shrink-0" />
                          <span className="text-sm font-semibold text-foreground">{table.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3.5 px-3"><span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 text-xs font-bold text-violet-700 bg-violet-50 rounded-lg border border-violet-200">{table.columns?.length ?? 0}</span></td>
                      <td className="text-center py-3.5 px-3"><span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">{table.indexes?.length ?? 0}</span></td>
                      <td className="text-center py-3.5 px-3"><span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg border border-blue-200">{table.constraints?.length ?? 0}</span></td>
                      <td className="text-center py-3.5 px-3"><span className={cn('inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 text-xs font-bold rounded-lg border', fkCount > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-muted-foreground bg-muted/50 border-border')}>{fkCount}</span></td>
                      <td className="text-right py-3.5 px-3"><span className="text-sm font-mono font-semibold text-muted-foreground">{table.estimatedRows ? formatNumber(table.estimatedRows) : '—'}</span></td>
                      <td className="text-center py-3.5 px-5">
                        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider', health.bg, health.color)}>
                          <CircleDot className="w-2.5 h-2.5" /> {health.label}
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

      {/* ── Operations Command Center ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connections */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-slate-50/80 to-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center"><Server className="w-3.5 h-3.5 text-cyan-600" /></div>
              <h3 className="text-sm font-bold text-foreground">Connections</h3>
            </div>
            {connectionCounts.total > 0 && <span className={cn('w-2.5 h-2.5 rounded-full', connectionCounts.error > 0 ? 'bg-red-500 animate-pulse' : connectionCounts.connected > 0 ? 'bg-emerald-500' : 'bg-muted-foreground')} />}
          </div>
          <div className="p-5">
            {connectionCounts.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-foreground tracking-tight">{connectionCounts.total}</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  {connectionCounts.connected > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(connectionCounts.connected / connectionCounts.total) * 100}%` }} />}
                  {connectionCounts.disconnected > 0 && <div className="bg-slate-300 h-full" style={{ width: `${(connectionCounts.disconnected / connectionCounts.total) * 100}%` }} />}
                  {connectionCounts.error > 0 && <div className="bg-red-500 h-full" style={{ width: `${(connectionCounts.error / connectionCounts.total) * 100}%` }} />}
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Connected', count: connectionCounts.connected, dot: 'bg-emerald-500', text: 'text-emerald-700' },
                    { label: 'Disconnected', count: connectionCounts.disconnected, dot: 'bg-slate-300', text: 'text-muted-foreground' },
                    { label: 'Error', count: connectionCounts.error, dot: 'bg-red-500', text: 'text-red-700' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.label} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2"><span className={cn('w-2.5 h-2.5 rounded-full', s.dot)} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
                      <span className={cn('text-xs font-bold', s.text)}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Server className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">No connections</p>
                <button onClick={() => navigate(`/project/${projectId}/connections`)} className="mt-3 text-[11px] font-medium text-aqua-600 hover:text-aqua-700">Add Connection <ArrowRight className="w-3 h-3 inline ml-0.5" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Migrations */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-slate-50/80 to-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-fuchsia-50 flex items-center justify-center"><Layers className="w-3.5 h-3.5 text-fuchsia-600" /></div>
              <h3 className="text-sm font-bold text-foreground">Migrations</h3>
            </div>
            {migrationCounts.running > 0 && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />}
          </div>
          <div className="p-5">
            {migrationCounts.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-foreground tracking-tight">{migrationCounts.total}</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  {migrationCounts.completed > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(migrationCounts.completed / migrationCounts.total) * 100}%` }} />}
                  {migrationCounts.running > 0 && <div className="bg-blue-500 h-full animate-pulse" style={{ width: `${(migrationCounts.running / migrationCounts.total) * 100}%` }} />}
                  {migrationCounts.pending > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(migrationCounts.pending / migrationCounts.total) * 100}%` }} />}
                  {migrationCounts.failed > 0 && <div className="bg-red-500 h-full" style={{ width: `${(migrationCounts.failed / migrationCounts.total) * 100}%` }} />}
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Completed', count: migrationCounts.completed, dot: 'bg-emerald-500', text: 'text-emerald-700' },
                    { label: 'Running', count: migrationCounts.running, dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700' },
                    { label: 'Pending', count: migrationCounts.pending, dot: 'bg-amber-400', text: 'text-amber-700' },
                    { label: 'Failed', count: migrationCounts.failed, dot: 'bg-red-500', text: 'text-red-700' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.label} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2"><span className={cn('w-2.5 h-2.5 rounded-full', s.dot)} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
                      <span className={cn('text-xs font-bold', s.text)}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layers className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">No migrations</p>
                <button onClick={() => navigate(`/project/${projectId}/migrations`)} className="mt-3 text-[11px] font-medium text-aqua-600 hover:text-aqua-700">Create Migration <ArrowRight className="w-3 h-3 inline ml-0.5" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Data Lifecycle */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-slate-50/80 to-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><RefreshCw className="w-3.5 h-3.5 text-emerald-600" /></div>
              <h3 className="text-sm font-bold text-foreground">Data Lifecycle</h3>
            </div>
            {lifecycleCounts.critical > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
          </div>
          <div className="p-5">
            {lifecycleCounts.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-foreground tracking-tight">{lifecycleCounts.total}</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Rules</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  {lifecycleCounts.active > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(lifecycleCounts.active / lifecycleCounts.total) * 100}%` }} />}
                  {lifecycleCounts.inactive > 0 && <div className="bg-slate-300 h-full" style={{ width: `${(lifecycleCounts.inactive / lifecycleCounts.total) * 100}%` }} />}
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Active', count: lifecycleCounts.active, dot: 'bg-emerald-500', text: 'text-emerald-700' },
                    { label: 'Inactive', count: lifecycleCounts.inactive, dot: 'bg-slate-300', text: 'text-muted-foreground' },
                    { label: 'Critical Priority', count: lifecycleCounts.critical, dot: 'bg-red-500', text: 'text-red-700' },
                    { label: 'High Priority', count: lifecycleCounts.high, dot: 'bg-amber-500', text: 'text-amber-700' },
                  ].filter(s => s.count > 0).map(s => (
                    <div key={s.label} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2"><span className={cn('w-2.5 h-2.5 rounded-full', s.dot)} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
                      <span className={cn('text-xs font-bold', s.text)}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <RefreshCw className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">No lifecycle rules</p>
                <button onClick={() => navigate(`/project/${projectId}/data-lifecycle`)} className="mt-3 text-[11px] font-medium text-aqua-600 hover:text-aqua-700">Create Policy <ArrowRight className="w-3 h-3 inline ml-0.5" /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Performance Summary ───────────────────────────────────────── */}
      {perfRunCounts.total > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-slate-50/80 to-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shadow-sm"><Zap className="w-4 h-4 text-white" /></div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Performance Benchmarks</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{perfRunCounts.total} benchmark runs recorded</p>
              </div>
            </div>
            <button onClick={() => navigate(`/project/${projectId}/performance`)} className="inline-flex items-center gap-1 text-[11px] font-medium text-aqua-600 hover:text-aqua-700 transition-colors">
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Runs', value: perfRunCounts.total, color: 'text-foreground', bg: 'bg-muted/50 border-border' },
                { label: 'Completed', value: perfRunCounts.completed, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                { label: 'Running', value: perfRunCounts.running, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Failed', value: perfRunCounts.failed, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-xl p-5 text-center border', item.bg)}>
                  <p className={cn('text-3xl font-black mb-1 tracking-tight', item.color)}>{item.value}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recommendations ───────────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-slate-50/80 to-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm"><Lightbulb className="w-4 h-4 text-white" /></div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Recommendations</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Suggested actions to improve your project</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {recommendations.map((rec, i) => {
              const prCfg = rec.priority === 'high' ? 'bg-red-100 text-red-700' : rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
              return (
                <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <span className={cn('inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider mt-0.5 flex-shrink-0', prCfg)}>{rec.priority}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground">{rec.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.description}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded border border-border flex-shrink-0">
                    <Workflow className="w-3 h-3" /> {rec.module}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Activity ───────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-slate-50/80 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aqua-500 to-cyan-500 flex items-center justify-center shadow-sm"><Activity className="w-4 h-4 text-white" /></div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Latest actions on this project</p>
              </div>
            </div>
            <button onClick={() => navigate('/audit-logs')} className="inline-flex items-center gap-1 text-[11px] font-medium text-aqua-600 hover:text-aqua-700 transition-colors">
              View All Logs <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        {recentActivity.length > 0 ? (
          <div className="divide-y divide-border/50">
            {recentActivity.map((item, index) => {
              const entityKey = (item.entityType ?? item.entity ?? 'default') as string;
              const activityConfig = ACTIVITY_ICONS[entityKey.toLowerCase()] ?? ACTIVITY_ICONS.default;
              const Icon = activityConfig.icon;
              const badge = ACTION_BADGES[item.action] ?? { label: item.action, cls: 'bg-muted text-muted-foreground border-border' };
              return (
                <div key={item.id} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col items-center pt-0.5">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', activityConfig.bg)}>
                      <Icon className={cn('w-4 h-4', activityConfig.color)} />
                    </div>
                    {index < recentActivity.length - 1 && <div className="w-px h-full bg-border mt-2 min-h-[16px]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn('inline-flex px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider', badge.cls)}>{badge.label}</span>
                      <span className="text-xs font-semibold text-foreground capitalize">{entityKey.replace(/-/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.details || '—'}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 pt-1 font-medium">{formatDate(item.createdAt)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">Activity will appear here as you work with this project.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectOverview;
