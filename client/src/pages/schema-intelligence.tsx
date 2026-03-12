import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Database,
  Upload,
  Sparkles,
  Camera,
  Table2,
  X,
  Loader2,
  Download,
  Plus,
  Trash2,
  Search,
  Wand2,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Bot,
  Columns3,
  Key,
  ToggleLeft,
  Hash,
  Type,
  Zap,
  Star,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  useTables,
  useCreateSnapshot,
  useCreateTable,
  useDeleteTable,
  useSchemas,
} from '@/hooks/use-schema';
import type { Table, Column, Index, Constraint, CreateTableInput } from '@/hooks/use-schema';
import { useProject } from '@/hooks/use-projects';
import { useSuggestSchema, useReviewSchema } from '@/hooks/use-ai';
import type { SchemaSuggestion, SchemaReview } from '@/hooks/use-ai';
import { SchemaExplorer } from '@/components/schema/schema-explorer';
import { TableDetailPanel } from '@/components/schema/table-detail-panel';
import { FileUploadZone } from '@/components/shared/file-upload-zone';
import { getDialectDataTypes } from '@/config/constants';

// ── Column Builder Types ────────────────────────────────────────────────────

interface ColumnDraft {
  id: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string;
  comment: string;
}

// Data types are now loaded dynamically per dialect from constants
// See getDialectDataTypes() in config/constants.ts

function newColumnDraft(): ColumnDraft {
  return {
    id: crypto.randomUUID(),
    columnName: '',
    dataType: 'VARCHAR(255)',
    isNullable: true,
    isPrimaryKey: false,
    isUnique: false,
    defaultValue: '',
    comment: '',
  };
}

// ── Demo Helpers ────────────────────────────────────────────────────────────

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

// ── Demo Data ───────────────────────────────────────────────────────────────

function generateDemoTables(): Table[] {
  return [
    {
      id: 't-users',
      name: 'users',
      schema: 'public',
      type: 'TABLE',
      description: 'User accounts and authentication',
      estimatedRows: 150000,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('username', 'VARCHAR(50)', { isUnique: true }),
        col('email', 'VARCHAR(255)', { isUnique: true }),
        col('password_hash', 'VARCHAR(255)'),
        col('full_name', 'VARCHAR(100)', { nullable: true }),
        col('phone', 'VARCHAR(20)', { nullable: true }),
        col('is_active', 'BOOLEAN'),
        col('created_at', 'TIMESTAMPTZ'),
        col('updated_at', 'TIMESTAMPTZ'),
      ],
      indexes: [
        idx('idx_users_email', ['email'], true),
        idx('idx_users_username', ['username'], true),
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
      id: 't-products',
      name: 'products',
      schema: 'public',
      type: 'TABLE',
      description: 'Product catalog with pricing and inventory info',
      estimatedRows: 85000,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('name', 'VARCHAR(300)'),
        col('slug', 'VARCHAR(300)', { isUnique: true }),
        col('description', 'TEXT', { nullable: true }),
        col('price', 'FLOAT'),
        col('cost_price', 'DECIMAL(10,2)', { nullable: true }),
        col('sku', 'VARCHAR(100)', { isUnique: true }),
        col('stock_quantity', 'INTEGER'),
        col('category_id', 'BIGINT', { isForeignKey: true }),
        col('is_active', 'BOOLEAN'),
        col('created_at', 'TIMESTAMPTZ'),
      ],
      indexes: [
        idx('idx_products_slug', ['slug'], true),
        idx('idx_products_category', ['category_id']),
        idx('idx_products_sku', ['sku'], true),
        idx('idx_products_price', ['price']),
      ],
      constraints: [
        cstr('pk_products', 'PRIMARY KEY', ['id']),
        cstr('uq_products_slug', 'UNIQUE', ['slug']),
        cstr('uq_products_sku', 'UNIQUE', ['sku']),
        cstr('fk_products_category', 'FOREIGN KEY', ['category_id']),
      ],
    },
    {
      id: 't-categories',
      name: 'categories',
      schema: 'public',
      type: 'TABLE',
      description: 'Hierarchical product categories',
      estimatedRows: 250,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('name', 'VARCHAR(200)'),
        col('slug', 'VARCHAR(200)', { isUnique: true }),
        col('parent_id', 'BIGINT', { nullable: true, isForeignKey: true }),
        col('description', 'TEXT', { nullable: true }),
        col('sort_order', 'INTEGER'),
      ],
      indexes: [
        idx('idx_cat_slug', ['slug'], true),
        idx('idx_cat_parent', ['parent_id']),
      ],
      constraints: [
        cstr('pk_categories', 'PRIMARY KEY', ['id']),
        cstr('uq_cat_slug', 'UNIQUE', ['slug']),
        cstr('fk_cat_parent', 'FOREIGN KEY', ['parent_id']),
      ],
    },
    {
      id: 't-orders',
      name: 'orders',
      schema: 'public',
      type: 'TABLE',
      description: 'Customer purchase orders',
      estimatedRows: 2500000,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('user_id', 'BIGINT', { isForeignKey: true }),
        col('status', 'VARCHAR(30)'),
        col('total_amount', 'DECIMAL(12,2)'),
        col('shipping_address', 'TEXT', { nullable: true }),
        col('billing_address', 'TEXT', { nullable: true }),
        col('notes', 'TEXT', { nullable: true }),
        col('created_at', 'TIMESTAMPTZ'),
        col('updated_at', 'TIMESTAMPTZ'),
      ],
      indexes: [
        idx('idx_orders_user', ['user_id']),
        idx('idx_orders_status', ['status']),
        idx('idx_orders_created', ['created_at']),
        idx('idx_orders_status_date', ['status', 'created_at']),
      ],
      constraints: [
        cstr('pk_orders', 'PRIMARY KEY', ['id']),
        cstr('fk_orders_user', 'FOREIGN KEY', ['user_id']),
      ],
    },
    {
      id: 't-order_items',
      name: 'order_items',
      schema: 'public',
      type: 'TABLE',
      description: 'Individual line items within each order',
      estimatedRows: 6200000,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('order_id', 'BIGINT', { isForeignKey: true }),
        col('product_id', 'BIGINT', { isForeignKey: true }),
        col('quantity', 'INTEGER'),
        col('unit_price', 'DECIMAL(10,2)'),
        col('total_price', 'DECIMAL(12,2)'),
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
      id: 't-payments',
      name: 'payments',
      schema: 'public',
      type: 'TABLE',
      description: 'Payment transactions for orders',
      estimatedRows: 2100000,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('order_id', 'BIGINT', { isForeignKey: true }),
        col('method', 'VARCHAR(50)'),
        col('amount', 'DECIMAL(12,2)'),
        col('status', 'VARCHAR(30)'),
        col('transaction_id', 'VARCHAR(200)', { nullable: true }),
        col('paid_at', 'TIMESTAMPTZ', { nullable: true }),
      ],
      indexes: [
        idx('idx_pay_order', ['order_id']),
        idx('idx_pay_status', ['status']),
        idx('idx_pay_method', ['method']),
      ],
      constraints: [
        cstr('pk_payments', 'PRIMARY KEY', ['id']),
        cstr('fk_pay_order', 'FOREIGN KEY', ['order_id']),
      ],
    },
    {
      id: 't-reviews',
      name: 'reviews',
      schema: 'public',
      type: 'TABLE',
      description: 'Customer reviews and ratings for products',
      estimatedRows: 420000,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('user_id', 'BIGINT', { isForeignKey: true }),
        col('product_id', 'BIGINT', { isForeignKey: true }),
        col('rating', 'SMALLINT'),
        col('title', 'VARCHAR(200)', { nullable: true }),
        col('body', 'TEXT', { nullable: true }),
        col('is_verified', 'BOOLEAN'),
        col('created_at', 'TIMESTAMPTZ'),
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
      id: 't-inventory_logs',
      name: 'inventory_logs',
      schema: 'public',
      type: 'TABLE',
      description: 'Audit trail for inventory changes',
      estimatedRows: 980000,
      columns: [
        col('id', 'BIGSERIAL', { isPrimaryKey: true }),
        col('product_id', 'BIGINT', { isForeignKey: true }),
        col('change_quantity', 'INTEGER'),
        col('reason', 'VARCHAR(100)'),
        col('reference_id', 'VARCHAR(200)', { nullable: true }),
        col('created_at', 'TIMESTAMPTZ'),
      ],
      indexes: [
        idx('idx_invlog_product', ['product_id']),
        idx('idx_invlog_created', ['created_at']),
      ],
      constraints: [
        cstr('pk_inventory_logs', 'PRIMARY KEY', ['id']),
        cstr('fk_invlog_product', 'FOREIGN KEY', ['product_id']),
      ],
    },
  ];
}

const DEMO_REVIEW: SchemaReview = {
  score: 82,
  issues: [
    {
      severity: 'error',
      category: 'Normalization',
      message:
        'Table "orders" stores customer name directly instead of referencing customers table',
      table: 'orders',
      suggestion: 'Replace customer_name with customer_id foreign key',
    },
    {
      severity: 'warning',
      category: 'Indexing',
      message:
        'Column "email" in users table is frequently queried but not indexed',
      table: 'users',
      column: 'email',
      suggestion: 'Add a unique index on users.email',
    },
    {
      severity: 'warning',
      category: 'Data Types',
      message:
        'Column "price" uses FLOAT which can cause precision issues for currency',
      table: 'products',
      column: 'price',
      suggestion: 'Use DECIMAL(10,2) for monetary values',
    },
    {
      severity: 'info',
      category: 'Best Practice',
      message:
        'Consider adding created_at and updated_at timestamps to all tables',
      suggestion: 'Add TIMESTAMP columns with DEFAULT NOW()',
    },
    {
      severity: 'warning',
      category: 'Security',
      message: 'No CHECK constraints found on any table',
      suggestion:
        'Add CHECK constraints for data validation (e.g., price > 0)',
    },
    {
      severity: 'info',
      category: 'Performance',
      message: 'Large TEXT columns without separate storage strategy',
      table: 'products',
      column: 'description',
      suggestion:
        'Consider TOAST storage settings or moving to a separate table',
    },
  ],
  summary:
    'Schema has a solid foundation but needs improvements in normalization, indexing strategy, and data type choices. Key issues: denormalized customer data in orders, missing indexes on frequently queried columns, and FLOAT usage for monetary values.',
};

// ── Template Presets ────────────────────────────────────────────────────────

const TEMPLATES: Record<
  string,
  { name: string; description: string; columns: ColumnDraft[] }
> = {
  user: {
    name: 'users',
    description: 'User accounts and authentication',
    columns: [
      { id: crypto.randomUUID(), columnName: 'id', dataType: 'BIGSERIAL', isNullable: false, isPrimaryKey: true, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'username', dataType: 'VARCHAR(50)', isNullable: false, isPrimaryKey: false, isUnique: true, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'email', dataType: 'VARCHAR(255)', isNullable: false, isPrimaryKey: false, isUnique: true, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'password_hash', dataType: 'VARCHAR(255)', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'full_name', dataType: 'VARCHAR(100)', isNullable: true, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'is_active', dataType: 'BOOLEAN', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: 'true' },
      { id: crypto.randomUUID(), columnName: 'created_at', dataType: 'TIMESTAMPTZ', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: 'NOW()' },
      { id: crypto.randomUUID(), columnName: 'updated_at', dataType: 'TIMESTAMPTZ', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: 'NOW()' },
    ],
  },
  product: {
    name: 'products',
    description: 'Product catalog with pricing info',
    columns: [
      { id: crypto.randomUUID(), columnName: 'id', dataType: 'BIGSERIAL', isNullable: false, isPrimaryKey: true, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'name', dataType: 'VARCHAR(255)', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'slug', dataType: 'VARCHAR(255)', isNullable: false, isPrimaryKey: false, isUnique: true, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'description', dataType: 'TEXT', isNullable: true, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'price', dataType: 'DECIMAL(10,2)', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'sku', dataType: 'VARCHAR(100)', isNullable: false, isPrimaryKey: false, isUnique: true, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'stock_quantity', dataType: 'INTEGER', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: '0' },
      { id: crypto.randomUUID(), columnName: 'is_active', dataType: 'BOOLEAN', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: 'true' },
      { id: crypto.randomUUID(), columnName: 'created_at', dataType: 'TIMESTAMPTZ', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: 'NOW()' },
    ],
  },
  order: {
    name: 'orders',
    description: 'Customer purchase orders',
    columns: [
      { id: crypto.randomUUID(), columnName: 'id', dataType: 'BIGSERIAL', isNullable: false, isPrimaryKey: true, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'user_id', dataType: 'BIGINT', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'status', dataType: 'VARCHAR(30)', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: "'pending'" },
      { id: crypto.randomUUID(), columnName: 'total_amount', dataType: 'DECIMAL(12,2)', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'shipping_address', dataType: 'TEXT', isNullable: true, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'notes', dataType: 'TEXT', isNullable: true, isPrimaryKey: false, isUnique: false, defaultValue: '', comment: '' },
      { id: crypto.randomUUID(), columnName: 'created_at', dataType: 'TIMESTAMPTZ', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: 'NOW()' },
      { id: crypto.randomUUID(), columnName: 'updated_at', dataType: 'TIMESTAMPTZ', isNullable: false, isPrimaryKey: false, isUnique: false, defaultValue: 'NOW()' },
    ],
  },
};

// ── Severity Helpers ────────────────────────────────────────────────────────

function severityIcon(severity: 'error' | 'warning' | 'info') {
  switch (severity) {
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    case 'info':
      return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
}

function severityBg(severity: 'error' | 'warning' | 'info') {
  switch (severity) {
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    case 'info':
      return 'bg-blue-50 border-blue-200';
  }
}

function severityText(severity: 'error' | 'warning' | 'info') {
  switch (severity) {
    case 'error':
      return 'text-red-700';
    case 'warning':
      return 'text-amber-700';
    case 'info':
      return 'text-blue-700';
  }
}

// ── Health indicator for a table ────────────────────────────────────────────

function getTableHealth(table: Table): {
  color: string;
  bg: string;
  label: string;
} {
  const hasPK = table.columns.some((c) => c.isPrimaryKey);
  const hasIndexes = table.indexes.length > 0;

  if (!hasPK)
    return { color: 'text-red-600', bg: 'bg-red-100', label: 'No PK' };
  if (!hasIndexes)
    return {
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      label: 'No Index',
    };
  return { color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Good' };
}

// ── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  size = 100,
}: {
  score: number;
  size?: number;
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let color = '#10b981';
  if (score < 60) color = '#ef4444';
  else if (score < 80) color = '#f59e0b';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-800">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SchemaIntelligence() {
  const { projectId } = useParams();
  const { data: apiTables, isLoading } = useTables(projectId);
  const { data: project } = useProject(projectId);
  const createSnapshot = useCreateSnapshot();
  const createTable = useCreateTable();
  const deleteTable = useDeleteTable();
  const suggestSchema = useSuggestSchema();
  const reviewSchema = useReviewSchema();
  const { data: schemasList } = useSchemas(projectId);

  // ── Demo mode ──
  const [useDemoData, setUseDemoData] = useState(false);
  const [demoTables, setDemoTables] = useState<Table[]>([]);
  const tables = useDemoData ? demoTables : (apiTables ?? []);

  // ── UI State ──
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [showAIDesignModal, setShowAIDesignModal] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [schemaReview, setSchemaReview] = useState<SchemaReview | null>(null);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Create Table form state ──
  const [ctName, setCtName] = useState('');
  const [ctSchema, setCtSchema] = useState('public');
  const [ctDescription, setCtDescription] = useState('');
  const [ctColumns, setCtColumns] = useState<ColumnDraft[]>([newColumnDraft()]);

  // ── AI Design state ──
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<SchemaSuggestion | null>(
    null
  );

  // ── Dialect-aware data types ──
  const dialectDataTypes = useMemo(
    () => getDialectDataTypes(project?.dialect ?? 'postgresql'),
    [project?.dialect]
  );

  // ── Filtered tables ──
  const filteredTables = useMemo(
    () =>
      tables.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [tables, searchQuery]
  );

  const hasTables = tables.length > 0;

  // ── Computed stats ──
  const totalColumns = tables.reduce((s, t) => s + t.columns.length, 0);
  const totalIndexes = tables.reduce((s, t) => s + t.indexes.length, 0);
  const totalConstraints = tables.reduce(
    (s, t) => s + t.constraints.length,
    0
  );
  const pkTables = tables.filter((t) =>
    t.columns.some((c) => c.isPrimaryKey)
  ).length;
  const pkCoverage =
    tables.length > 0 ? Math.round((pkTables / tables.length) * 100) : 0;

  // ── Handlers ──

  const handleSelectTable = useCallback((table: Table) => {
    setSelectedTable(table);
  }, []);

  const handleBackToOverview = useCallback(() => {
    setSelectedTable(null);
  }, []);

  const handleUploadComplete = useCallback(() => {
    // Upload modal stays open; user closes manually
  }, []);

  const handleCreateSnapshot = useCallback(() => {
    if (!projectId || !snapshotName.trim()) return;
    createSnapshot.mutate(
      { projectId, name: snapshotName.trim() },
      {
        onSuccess: () => {
          setShowSnapshotDialog(false);
          setSnapshotName('');
          toast.success('Snapshot created successfully');
        },
        onError: () => {
          toast.error('Failed to create snapshot');
        },
      }
    );
  }, [projectId, snapshotName, createSnapshot]);

  const handleExportSchema = useCallback(async () => {
    if (!projectId) return;
    const dialect = project?.dialect || 'postgresql';
    const url = `/api/v1/projects/${projectId}/schema/export?dialect=${dialect}&download=true`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_export_${dialect}.sql`;
    a.click();
    toast.success('Downloading schema DDL');
  }, [projectId, project?.dialect]);

  const handleLoadDemo = useCallback(() => {
    setUseDemoData(true);
    setDemoTables(generateDemoTables());
    setSchemaReview(DEMO_REVIEW);
    setShowReviewPanel(true);
    toast.success('Loaded demo schema with 8 tables');
  }, []);

  // ── Create Table ──

  const resetCreateTableForm = useCallback(() => {
    setCtName('');
    setCtSchema('public');
    setCtDescription('');
    setCtColumns([newColumnDraft()]);
  }, []);

  const handleApplyTemplate = useCallback((key: string) => {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    setCtName(tpl.name);
    setCtDescription(tpl.description);
    setCtColumns(
      tpl.columns.map((c) => ({ ...c, id: crypto.randomUUID() }))
    );
  }, []);

  const handleAddColumn = useCallback(() => {
    setCtColumns((prev) => [...prev, newColumnDraft()]);
  }, []);

  const handleRemoveColumn = useCallback((id: string) => {
    setCtColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleUpdateColumn = useCallback(
    (id: string, field: keyof ColumnDraft, value: string | boolean) => {
      setCtColumns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  const handleCreateTable = useCallback(() => {
    if (!projectId) return;
    const validColumns = ctColumns.filter((c) => c.columnName.trim());
    if (!ctName.trim() || validColumns.length === 0) {
      toast.error('Table name and at least one column are required');
      return;
    }

    const input: CreateTableInput = {
      tableName: ctName.trim(),
      schemaName: ctSchema.trim() || 'public',
      description: ctDescription.trim() || undefined,
      columns: validColumns.map((c) => ({
        columnName: c.columnName.trim(),
        dataType: c.dataType,
        isNullable: c.isNullable,
        isPrimaryKey: c.isPrimaryKey,
        isUnique: c.isUnique,
        defaultValue: c.defaultValue.trim() || undefined,
        comment: c.comment.trim() || undefined,
      })),
    };

    if (useDemoData) {
      // In demo mode, add table directly to demo state
      const newTable: Table = {
        id: `t-${ctName.trim().toLowerCase()}-${Date.now()}`,
        name: ctName.trim(),
        schema: ctSchema.trim() || 'public',
        type: 'TABLE',
        description: ctDescription.trim() || null,
        estimatedRows: 0,
        columns: validColumns.map((c, i) => ({
          id: `col-${c.columnName}-${Math.random().toString(36).slice(2, 8)}`,
          name: c.columnName.trim(),
          dataType: c.dataType,
          nullable: c.isNullable,
          isPrimaryKey: c.isPrimaryKey,
          isForeignKey: false,
          isUnique: c.isUnique,
          defaultValue: c.defaultValue.trim() || null,
          ordinalPosition: i + 1,
        })),
        indexes: [],
        constraints: [],
      };
      setDemoTables((prev) => [...prev, newTable]);
      setShowCreateTableModal(false);
      resetCreateTableForm();
      toast.success(`Table "${ctName.trim()}" created`);
      return;
    }

    createTable.mutate(
      { projectId, data: input },
      {
        onSuccess: () => {
          setShowCreateTableModal(false);
          resetCreateTableForm();
          toast.success(`Table "${ctName.trim()}" created successfully`);
        },
        onError: () => {
          toast.error('Failed to create table');
        },
      }
    );
  }, [
    projectId,
    ctName,
    ctSchema,
    ctDescription,
    ctColumns,
    createTable,
    useDemoData,
    resetCreateTableForm,
  ]);

  // ── Delete Table ──

  const handleDeleteTable = useCallback(() => {
    if (!projectId || !tableToDelete) return;

    if (useDemoData) {
      setDemoTables((prev) => prev.filter((t) => t.id !== tableToDelete.id));
      if (selectedTable?.id === tableToDelete.id) setSelectedTable(null);
      setTableToDelete(null);
      toast.success(`Table "${tableToDelete.name}" deleted`);
      return;
    }

    deleteTable.mutate(
      { projectId, tableId: tableToDelete.id },
      {
        onSuccess: () => {
          if (selectedTable?.id === tableToDelete.id) setSelectedTable(null);
          setTableToDelete(null);
          toast.success(`Table "${tableToDelete.name}" deleted`);
        },
        onError: () => {
          toast.error('Failed to delete table');
          setTableToDelete(null);
        },
      }
    );
  }, [projectId, tableToDelete, deleteTable, useDemoData, selectedTable]);

  // ── AI Design ──

  const handleAIGenerate = useCallback(() => {
    if (!projectId || !aiPrompt.trim()) return;

    suggestSchema.mutate(
      { projectId, prompt: aiPrompt.trim() },
      {
        onSuccess: (data) => {
          setAiSuggestion(data);
          toast.success('Schema suggestion generated');
        },
        onError: () => {
          toast.error('AI generation failed. Loading demo suggestion.');
          // Provide fallback demo suggestion
          setAiSuggestion({
            tables: [
              {
                name: 'blog_posts',
                columns: [
                  { name: 'id', dataType: 'BIGSERIAL', nullable: false, isPrimaryKey: true },
                  { name: 'title', dataType: 'VARCHAR(300)', nullable: false, isPrimaryKey: false },
                  { name: 'slug', dataType: 'VARCHAR(300)', nullable: false, isPrimaryKey: false },
                  { name: 'content', dataType: 'TEXT', nullable: true, isPrimaryKey: false },
                  { name: 'author_id', dataType: 'BIGINT', nullable: false, isPrimaryKey: false },
                  { name: 'published_at', dataType: 'TIMESTAMPTZ', nullable: true, isPrimaryKey: false },
                  { name: 'created_at', dataType: 'TIMESTAMPTZ', nullable: false, isPrimaryKey: false },
                ],
                description: 'Blog posts with content and author reference',
              },
              {
                name: 'authors',
                columns: [
                  { name: 'id', dataType: 'BIGSERIAL', nullable: false, isPrimaryKey: true },
                  { name: 'name', dataType: 'VARCHAR(200)', nullable: false, isPrimaryKey: false },
                  { name: 'bio', dataType: 'TEXT', nullable: true, isPrimaryKey: false },
                  { name: 'email', dataType: 'VARCHAR(255)', nullable: false, isPrimaryKey: false },
                ],
                description: 'Authors who write blog posts',
              },
              {
                name: 'tags',
                columns: [
                  { name: 'id', dataType: 'BIGSERIAL', nullable: false, isPrimaryKey: true },
                  { name: 'name', dataType: 'VARCHAR(100)', nullable: false, isPrimaryKey: false },
                  { name: 'slug', dataType: 'VARCHAR(100)', nullable: false, isPrimaryKey: false },
                ],
                description: 'Tags for categorizing posts',
              },
            ],
            relationships: [
              {
                sourceTable: 'blog_posts',
                sourceColumn: 'author_id',
                targetTable: 'authors',
                targetColumn: 'id',
                type: 'many-to-one',
              },
            ],
            explanation:
              'A blog schema with posts, authors, and tags. Posts reference authors via foreign key. Tags can be linked via a junction table.',
          });
        },
      }
    );
  }, [projectId, aiPrompt, suggestSchema]);

  const handleApplyAllSuggestions = useCallback(() => {
    if (!projectId || !aiSuggestion) return;

    if (useDemoData) {
      const newTables: Table[] = aiSuggestion.tables.map((st) => ({
        id: `t-${st.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: st.name,
        schema: 'public',
        type: 'TABLE',
        description: st.description,
        estimatedRows: 0,
        columns: st.columns.map((sc, i) => ({
          id: `col-${sc.name}-${Math.random().toString(36).slice(2, 8)}`,
          name: sc.name,
          dataType: sc.dataType,
          nullable: sc.nullable,
          isPrimaryKey: sc.isPrimaryKey,
          isForeignKey: false,
          isUnique: false,
          ordinalPosition: i + 1,
        })),
        indexes: [],
        constraints: [],
      }));

      setDemoTables((prev) => [...prev, ...newTables]);
      setShowAIDesignModal(false);
      setAiSuggestion(null);
      setAiPrompt('');
      toast.success(`Created ${newTables.length} tables from AI suggestion`);
      return;
    }

    // Create each table via API
    let created = 0;
    for (const st of aiSuggestion.tables) {
      const input: CreateTableInput = {
        tableName: st.name,
        description: st.description,
        columns: st.columns.map((sc) => ({
          columnName: sc.name,
          dataType: sc.dataType,
          isNullable: sc.nullable,
          isPrimaryKey: sc.isPrimaryKey,
        })),
      };
      createTable.mutate(
        { projectId, data: input },
        {
          onSuccess: () => {
            created++;
            if (created === aiSuggestion.tables.length) {
              toast.success(
                `Created ${created} tables from AI suggestion`
              );
              setShowAIDesignModal(false);
              setAiSuggestion(null);
              setAiPrompt('');
            }
          },
        }
      );
    }
  }, [projectId, aiSuggestion, createTable, useDemoData]);

  // ── AI Review ──

  const handleRunReview = useCallback(() => {
    if (!projectId) return;

    if (useDemoData) {
      setSchemaReview(DEMO_REVIEW);
      setShowReviewPanel(true);
      toast.success('Schema review complete');
      return;
    }

    reviewSchema.mutate(
      { projectId },
      {
        onSuccess: (data) => {
          setSchemaReview(data);
          setShowReviewPanel(true);
          toast.success('Schema review complete');
        },
        onError: () => {
          toast.error('Review failed. Showing demo review.');
          setSchemaReview(DEMO_REVIEW);
          setShowReviewPanel(true);
        },
      }
    );
  }, [projectId, reviewSchema, useDemoData]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-[calc(100vh-180px)]">
      {/* ── Left Panel: Schema Explorer ───────────────────────────── */}
      <div className="w-[300px] border-r border-border bg-slate-50/50 flex-shrink-0 flex flex-col">
        <SchemaExplorer
          onSelectTable={handleSelectTable}
          selectedTableId={selectedTable?.id}
        />
      </div>

      {/* ── Right Panel: Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* ── Enhanced Toolbar ── */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-6 py-3 bg-card/95 backdrop-blur border-b border-slate-200 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground mr-auto">
            Schema Intelligence
          </h2>

          {/* Create Table */}
          <button
            onClick={() => {
              resetCreateTableForm();
              setShowCreateTableModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Table
          </button>

          {/* Upload SQL */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-card rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload SQL
          </button>

          {/* AI Design */}
          <button
            onClick={() => {
              setAiSuggestion(null);
              setAiPrompt('');
              setShowAIDesignModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors border border-aqua-200"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Design
          </button>

          {/* AI Review */}
          <button
            onClick={handleRunReview}
            disabled={!hasTables || reviewSchema.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border',
              hasTables
                ? 'text-aqua-700 bg-aqua-50 hover:bg-aqua-100 border-aqua-200'
                : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'
            )}
          >
            {reviewSchema.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            AI Review
          </button>

          {/* Export DDL */}
          <button
            onClick={handleExportSchema}
            disabled={!hasTables}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border',
              hasTables
                ? 'text-slate-700 bg-card hover:bg-slate-50 border-slate-200'
                : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'
            )}
          >
            <Download className="w-3.5 h-3.5" />
            Export DDL
          </button>

          {/* Snapshot */}
          <button
            onClick={() => setShowSnapshotDialog(true)}
            disabled={!hasTables}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border',
              hasTables
                ? 'text-slate-700 bg-card hover:bg-slate-50 border-slate-200'
                : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'
            )}
          >
            <Camera className="w-3.5 h-3.5" />
            Snapshot
          </button>

          {/* Load Demo */}
          <button
            onClick={handleLoadDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
          >
            <Star className="w-3.5 h-3.5" />
            Load Demo
          </button>
        </div>

        {/* ── Stats Bar ── */}
        {hasTables && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex-wrap">
            <StatBadge
              icon={<Table2 className="w-3 h-3" />}
              label="Tables"
              value={tables.length}
              gradient="from-aqua-500 to-cyan-600"
            />
            <StatBadge
              icon={<Columns3 className="w-3 h-3" />}
              label="Columns"
              value={totalColumns}
              gradient="from-violet-500 to-purple-600"
            />
            <StatBadge
              icon={<Zap className="w-3 h-3" />}
              label="Indexes"
              value={totalIndexes}
              gradient="from-amber-500 to-orange-600"
            />
            <StatBadge
              icon={<Hash className="w-3 h-3" />}
              label="Constraints"
              value={totalConstraints}
              gradient="from-emerald-500 to-green-600"
            />
            <StatBadge
              icon={<Key className="w-3 h-3" />}
              label="PK Coverage"
              value={`${pkCoverage}%`}
              gradient="from-rose-500 to-pink-600"
            />
          </div>
        )}

        {/* ── Content Area ── */}
        <div className="flex-1 p-6 lg:p-8">
          {/* Loading */}
          {isLoading && !useDemoData && (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-aqua-500 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Loading schema...
                </p>
              </div>
            </div>
          )}

          {/* Table Detail */}
          {!isLoading && selectedTable && (
            <TableDetailPanel
              tableId={selectedTable.id}
              onBack={handleBackToOverview}
            />
          )}

          {/* Overview Grid + Review Panel */}
          {((!isLoading && !selectedTable && hasTables) ||
            (useDemoData && !selectedTable && hasTables)) && (
            <div
              className={cn(
                'flex gap-6',
                showReviewPanel && schemaReview
                  ? 'flex-col xl:flex-row'
                  : ''
              )}
            >
              {/* Grid Section */}
              <div
                className={cn(
                  'flex-1 min-w-0',
                  showReviewPanel && schemaReview ? 'xl:w-2/3' : 'w-full'
                )}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">
                      Schema Overview
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {filteredTables.length} table
                      {filteredTables.length !== 1 ? 's' : ''}{' '}
                      {searchQuery ? 'matching' : 'in your schema'}
                    </p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search tables..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all w-48"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTables.map((table) => {
                    const pkCount = table.columns.filter(
                      (c) => c.isPrimaryKey
                    ).length;
                    const fkCount = table.columns.filter(
                      (c) => c.isForeignKey
                    ).length;
                    const health = getTableHealth(table);

                    return (
                      <div
                        key={table.id}
                        className="bg-card border border-slate-200 rounded-xl p-4 hover:border-aqua-300 hover:shadow-md transition-all group relative"
                      >
                        {/* Health indicator */}
                        <div
                          className={cn(
                            'absolute top-3 right-3 px-1.5 py-0.5 text-[10px] font-medium rounded-full',
                            health.bg,
                            health.color
                          )}
                        >
                          {health.label}
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background:
                                'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                            }}
                          >
                            <Table2 className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0 pr-12">
                            <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-aqua-700 transition-colors">
                              {table.name}
                            </h4>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {table.schema ? `${table.schema}.` : ''}
                              {table.type || 'table'}
                            </span>
                          </div>
                        </div>

                        {/* Column/Index/Key badges */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mb-2">
                          <span className="inline-flex items-center gap-1">
                            <Columns3 className="w-3 h-3" />
                            {table.columns.length} cols
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {table.indexes.length} idx
                          </span>
                          {pkCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <Key className="w-3 h-3" />
                              {pkCount} PK
                            </span>
                          )}
                          {fkCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-blue-600">
                              <Hash className="w-3 h-3" />
                              {fkCount} FK
                            </span>
                          )}
                        </div>

                        {table.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {table.description}
                          </p>
                        )}

                        {table.estimatedRows != null && table.estimatedRows > 0 && (
                          <p className="text-[10px] text-muted-foreground mb-3">
                            ~{table.estimatedRows.toLocaleString()} rows
                          </p>
                        )}

                        {/* Quick actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleSelectTable(table)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-aqua-700 bg-aqua-50 rounded-md hover:bg-aqua-100 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTableToDelete(table);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredTables.length === 0 && searchQuery && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Search className="w-8 h-8 text-slate-300 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No tables matching "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>

              {/* Review Panel */}
              {showReviewPanel && schemaReview && (
                <div className="xl:w-1/3 flex-shrink-0">
                  <ReviewPanel
                    review={schemaReview}
                    onClose={() => setShowReviewPanel(false)}
                    onReanalyze={handleRunReview}
                    isLoading={reviewSchema.isPending}
                  />
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !selectedTable && !hasTables && !useDemoData && (
            <SchemaEmptyState
              onUpload={() => setShowUploadModal(true)}
              onAIDesign={() => {
                setAiSuggestion(null);
                setAiPrompt('');
                setShowAIDesignModal(true);
              }}
              onLoadDemo={handleLoadDemo}
              onCreateTable={() => {
                resetCreateTableForm();
                setShowCreateTableModal(true);
              }}
            />
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
         ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Upload Modal ── */}
      {showUploadModal && (
        <ModalBackdrop onClose={() => setShowUploadModal(false)}>
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <FileUploadZone
              onUploadComplete={handleUploadComplete}
              onClose={() => setShowUploadModal(false)}
            />
          </div>
        </ModalBackdrop>
      )}

      {/* ── Snapshot Dialog ── */}
      {showSnapshotDialog && (
        <ModalBackdrop onClose={() => setShowSnapshotDialog(false)}>
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                Create Snapshot
              </h3>
              <button
                onClick={() => setShowSnapshotDialog(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Snapshot name..."
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSnapshot();
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSnapshotDialog(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={
                  !snapshotName.trim() || createSnapshot.isPending
                }
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  snapshotName.trim()
                    ? 'text-white bg-aqua-600 hover:bg-aqua-700'
                    : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                )}
              >
                {createSnapshot.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ── Create Table Modal ── */}
      {showCreateTableModal && (
        <ModalBackdrop onClose={() => setShowCreateTableModal(false)}>
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Create New Table
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define table structure with columns, types, and constraints
                </p>
              </div>
              <button
                onClick={() => setShowCreateTableModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Templates */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50">
              <span className="text-xs font-medium text-muted-foreground mr-3">
                Quick Templates:
              </span>
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <button
                  key={key}
                  onClick={() => handleApplyTemplate(key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-aqua-700 bg-aqua-50 rounded-md hover:bg-aqua-100 transition-colors mr-2 border border-aqua-200"
                >
                  <Wand2 className="w-3 h-3" />
                  {key.charAt(0).toUpperCase() + key.slice(1)} Table
                </button>
              ))}
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Table Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Table Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. users"
                    value={ctName}
                    onChange={(e) => setCtName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Schema
                  </label>
                  <select
                    value={ctSchema}
                    onChange={(e) => setCtSchema(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
                  >
                    {(schemasList ?? ['public']).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Optional description"
                    value={ctDescription}
                    onChange={(e) => setCtDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
                  />
                </div>
              </div>

              {/* Column Builder */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                  Columns
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Column Header */}
                  <div className="grid grid-cols-[1fr_140px_60px_50px_60px_100px_120px_40px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    <span>Name</span>
                    <span>Data Type</span>
                    <span className="text-center">Null</span>
                    <span className="text-center">PK</span>
                    <span className="text-center">Unique</span>
                    <span>Default</span>
                    <span>Comment</span>
                    <span />
                  </div>

                  {/* Column Rows */}
                  {ctColumns.map((column) => (
                    <div
                      key={column.id}
                      className="grid grid-cols-[1fr_140px_60px_50px_60px_100px_120px_40px] gap-2 px-3 py-1.5 border-b border-slate-100 last:border-b-0 items-center"
                    >
                      <input
                        type="text"
                        placeholder="column_name"
                        value={column.columnName}
                        onChange={(e) =>
                          handleUpdateColumn(
                            column.id,
                            'columnName',
                            e.target.value
                          )
                        }
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-card focus:outline-none focus:ring-1 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
                      />
                      <select
                        value={column.dataType}
                        onChange={(e) =>
                          handleUpdateColumn(
                            column.id,
                            'dataType',
                            e.target.value
                          )
                        }
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-card focus:outline-none focus:ring-1 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
                      >
                        {dialectDataTypes.map((dt) => (
                          <option key={dt} value={dt}>
                            {dt}
                          </option>
                        ))}
                        {/* Keep current value if it's not in the dialect list */}
                        {!dialectDataTypes.includes(column.dataType) && (
                          <option value={column.dataType}>{column.dataType}</option>
                        )}
                      </select>
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={column.isNullable}
                          onChange={(e) =>
                            handleUpdateColumn(
                              column.id,
                              'isNullable',
                              e.target.checked
                            )
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-aqua-600 focus:ring-aqua-500"
                        />
                      </div>
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={column.isPrimaryKey}
                          onChange={(e) =>
                            handleUpdateColumn(
                              column.id,
                              'isPrimaryKey',
                              e.target.checked
                            )
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                      </div>
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={column.isUnique}
                          onChange={(e) =>
                            handleUpdateColumn(
                              column.id,
                              'isUnique',
                              e.target.checked
                            )
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="DEFAULT"
                        value={column.defaultValue}
                        onChange={(e) =>
                          handleUpdateColumn(
                            column.id,
                            'defaultValue',
                            e.target.value
                          )
                        }
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-card focus:outline-none focus:ring-1 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
                      />
                      <input
                        type="text"
                        placeholder="Comment"
                        value={column.comment}
                        onChange={(e) =>
                          handleUpdateColumn(
                            column.id,
                            'comment',
                            e.target.value
                          )
                        }
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-card focus:outline-none focus:ring-1 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
                      />
                      <button
                        onClick={() => handleRemoveColumn(column.id)}
                        disabled={ctColumns.length <= 1}
                        className={cn(
                          'p-1 rounded transition-colors',
                          ctColumns.length > 1
                            ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-slate-200 cursor-not-allowed'
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAddColumn}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors border border-aqua-200"
                >
                  <Plus className="w-3 h-3" />
                  Add Column
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setShowCreateTableModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTable}
                disabled={
                  !ctName.trim() ||
                  ctColumns.filter((c) => c.columnName.trim()).length === 0 ||
                  createTable.isPending
                }
                className={cn(
                  'px-4 py-2 text-xs font-medium rounded-lg transition-colors shadow-sm',
                  ctName.trim() &&
                    ctColumns.some((c) => c.columnName.trim())
                    ? 'text-white bg-aqua-600 hover:bg-aqua-700'
                    : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                )}
              >
                {createTable.isPending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Table'
                )}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ── AI Design Modal ── */}
      {showAIDesignModal && (
        <ModalBackdrop onClose={() => setShowAIDesignModal(false)}>
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-aqua-400 to-cyan-600 flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    AI Schema Designer
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Describe your data model and let AI generate the schema
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAIDesignModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Prompt */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Describe your schema
                </label>
                <textarea
                  placeholder="e.g. I need a blog platform with posts, authors, tags, and comments. Each post can have multiple tags and comments. Authors have profiles with bio and social links..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all resize-none"
                />
              </div>

              <button
                onClick={handleAIGenerate}
                disabled={!aiPrompt.trim() || suggestSchema.isPending}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm',
                  aiPrompt.trim()
                    ? 'text-white bg-aqua-600 hover:bg-aqua-700'
                    : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                )}
              >
                {suggestSchema.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Schema
                  </>
                )}
              </button>

              {/* Suggestion Preview */}
              {aiSuggestion && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">
                      Suggested Schema
                    </h4>
                    <button
                      onClick={handleApplyAllSuggestions}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Apply All
                    </button>
                  </div>

                  {/* Explanation */}
                  <div className="bg-aqua-50 border border-aqua-200 rounded-lg p-3">
                    <p className="text-xs text-aqua-800">
                      {aiSuggestion.explanation}
                    </p>
                  </div>

                  {/* Table previews */}
                  {aiSuggestion.tables.map((st) => (
                    <div
                      key={st.name}
                      className="border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                        <Table2 className="w-3.5 h-3.5 text-aqua-600" />
                        <span className="text-xs font-semibold text-foreground">
                          {st.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {st.columns.length} columns
                        </span>
                      </div>
                      <div className="px-3 py-2 space-y-1">
                        {st.columns.map((sc) => (
                          <div
                            key={sc.name}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={cn(
                                'font-mono',
                                sc.isPrimaryKey
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-slate-700'
                              )}
                            >
                              {sc.name}
                            </span>
                            <span className="text-muted-foreground">
                              {sc.dataType}
                            </span>
                            {sc.isPrimaryKey && (
                              <span className="px-1 py-0.5 text-[9px] font-medium bg-amber-100 text-amber-700 rounded">
                                PK
                              </span>
                            )}
                            {sc.nullable && (
                              <span className="px-1 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-500 rounded">
                                NULL
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {st.description && (
                        <div className="px-3 py-1.5 border-t border-slate-100">
                          <p className="text-[10px] text-muted-foreground">
                            {st.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Relationships */}
                  {aiSuggestion.relationships.length > 0 && (
                    <div className="border border-slate-200 rounded-lg p-3">
                      <h5 className="text-xs font-semibold text-slate-700 mb-2">
                        Relationships
                      </h5>
                      {aiSuggestion.relationships.map((rel, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"
                        >
                          <span className="font-mono text-slate-700">
                            {rel.sourceTable}.{rel.sourceColumn}
                          </span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="font-mono text-slate-700">
                            {rel.targetTable}.{rel.targetColumn}
                          </span>
                          <span className="ml-auto text-[10px] text-aqua-600 bg-aqua-50 px-1.5 py-0.5 rounded">
                            {rel.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setShowAIDesignModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {tableToDelete && (
        <ModalBackdrop onClose={() => setTableToDelete(null)}>
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Delete Table
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to delete table{' '}
                  <strong className="text-foreground">
                    {tableToDelete.name}
                  </strong>
                  ? This action cannot be undone and all data within this
                  table will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTableToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTable}
                disabled={deleteTable.isPending}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
              >
                {deleteTable.isPending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  'Delete Table'
                )}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {children}
    </div>
  );
}

function StatBadge({
  icon,
  label,
  value,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  gradient: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-card border border-slate-200 rounded-lg shadow-sm">
      <div
        className={cn(
          'w-5 h-5 rounded flex items-center justify-center text-white bg-gradient-to-br',
          gradient
        )}
      >
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-foreground">{value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

// ── Review Panel ────────────────────────────────────────────────────────────

function ReviewPanel({
  review,
  onClose,
  onReanalyze,
  isLoading,
}: {
  review: SchemaReview;
  onClose: () => void;
  onReanalyze: () => void;
  isLoading: boolean;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['error', 'warning', 'info'])
  );

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const errorCount = review.issues.filter(
    (i) => i.severity === 'error'
  ).length;
  const warningCount = review.issues.filter(
    (i) => i.severity === 'warning'
  ).length;
  const infoCount = review.issues.filter(
    (i) => i.severity === 'info'
  ).length;

  const groupedIssues: Record<string, typeof review.issues> = {};
  for (const issue of review.issues) {
    if (!groupedIssues[issue.severity]) groupedIssues[issue.severity] = [];
    groupedIssues[issue.severity].push(issue);
  }

  return (
    <div className="bg-card border border-slate-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-aqua-600" />
          <h3 className="text-sm font-semibold text-foreground">
            AI Schema Review
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Score */}
      <div className="flex flex-col items-center py-4 border-b border-slate-100">
        <ScoreRing score={review.score} />
        <div className="flex items-center gap-3 mt-3 text-xs">
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <XCircle className="w-3 h-3" />
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {infoCount > 0 && (
            <span className="inline-flex items-center gap-1 text-blue-600">
              <Info className="w-3 h-3" />
              {infoCount} info
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {review.summary}
        </p>
      </div>

      {/* Issues grouped by severity */}
      <div className="max-h-[400px] overflow-y-auto">
        {(['error', 'warning', 'info'] as const).map((sev) => {
          const issues = groupedIssues[sev];
          if (!issues || issues.length === 0) return null;
          const isExpanded = expandedCategories.has(sev);

          return (
            <div key={sev} className="border-b border-slate-100 last:border-b-0">
              <button
                onClick={() => toggleCategory(sev)}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {severityIcon(sev)}
                <span className="capitalize">{sev}s</span>
                <span className="ml-auto text-muted-foreground">
                  {issues.length}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-lg border p-3 space-y-1.5',
                        severityBg(issue.severity)
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {severityIcon(issue.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                                severityBg(issue.severity),
                                severityText(issue.severity)
                              )}
                            >
                              {issue.category}
                            </span>
                            {issue.table && (
                              <span className="text-[10px] font-mono text-slate-500">
                                {issue.table}
                                {issue.column ? `.${issue.column}` : ''}
                              </span>
                            )}
                          </div>
                          <p
                            className={cn(
                              'text-xs mt-1',
                              severityText(issue.severity)
                            )}
                          >
                            {issue.message}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 italic">
                            Suggestion: {issue.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center px-4 py-3 border-t border-slate-200">
        <button
          onClick={onReanalyze}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors border border-aqua-200"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          Re-analyze
        </button>
      </div>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function SchemaEmptyState({
  onUpload,
  onAIDesign,
  onLoadDemo,
  onCreateTable,
}: {
  onUpload: () => void;
  onAIDesign: () => void;
  onLoadDemo: () => void;
  onCreateTable: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-aqua-100 to-cyan-100 flex items-center justify-center mb-6">
        <Database className="w-10 h-10 text-aqua-600" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No schema yet -- let's build one
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        Import existing SQL DDL files, create tables manually, use AI to design
        a schema from scratch, or load demo data to explore the interface.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload SQL Files
        </button>
        <button
          onClick={onCreateTable}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors border border-aqua-200"
        >
          <Plus className="w-4 h-4" />
          Create Table
        </button>
        <button
          onClick={onAIDesign}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors border border-aqua-200"
        >
          <Sparkles className="w-4 h-4" />
          AI Schema Design
        </button>
        <button
          onClick={onLoadDemo}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
        >
          <Star className="w-4 h-4" />
          Load Demo Data
        </button>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12 w-full max-w-3xl">
        {[
          {
            icon: Upload,
            title: 'SQL Import',
            description:
              'Parse CREATE TABLE, ALTER TABLE, and other DDL statements automatically',
          },
          {
            icon: Table2,
            title: 'Manual Design',
            description:
              'Build tables column by column with a visual builder and quick templates',
          },
          {
            icon: Sparkles,
            title: 'AI Generation',
            description:
              'Describe your data model in plain English and let AI generate the schema',
          },
          {
            icon: ShieldCheck,
            title: 'Schema Review',
            description:
              'Get AI-powered analysis on normalization, indexing, and best practices',
          },
        ].map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="bg-card rounded-xl border border-border p-5 shadow-sm"
            >
              <div className="w-9 h-9 rounded-lg bg-aqua-50 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-aqua-600" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {feature.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SchemaIntelligence;
