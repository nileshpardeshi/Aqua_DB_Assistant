import { useState, useMemo } from 'react';
import {
  FileCode, Copy, CheckCircle2, Search, ArrowRight,
  Filter, Layers, BarChart3, GitFork, Table2, Settings2, Repeat,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sql: string;
  tags: string[];
}

interface QueryTemplatesPanelProps {
  dialect: string;
  onInsertTemplate: (sql: string) => void;
  className?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'select', label: 'SELECT', icon: Table2 },
  { id: 'join', label: 'JOIN', icon: GitFork },
  { id: 'aggregation', label: 'Aggregation', icon: BarChart3 },
  { id: 'subquery', label: 'Subquery', icon: Repeat },
  { id: 'cte', label: 'CTE', icon: Filter },
  { id: 'window', label: 'Window', icon: Settings2 },
  { id: 'ddl', label: 'DDL', icon: FileCode },
] as const;

function limitClause(dialect: string): string {
  const upper = dialect.toUpperCase();
  if (upper === 'ORACLE' || upper === 'DB2') return 'FETCH FIRST 100 ROWS ONLY';
  return 'LIMIT 100';
}

const TEMPLATES: QueryTemplate[] = [
  // SELECT
  {
    id: 'select-basic',
    name: 'Basic Select with Filters',
    description: 'Simple SELECT with WHERE, ORDER BY, and row limiting',
    category: 'select',
    sql: `SELECT column1, column2, column3\nFROM table_name\nWHERE status = 'active'\n  AND created_at >= '2024-01-01'\nORDER BY created_at DESC\n{{LIMIT}};`,
    tags: ['select', 'filter', 'basic'],
  },
  {
    id: 'select-case',
    name: 'Select with CASE Expression',
    description: 'Conditional logic using CASE WHEN for computed columns',
    category: 'select',
    sql: `SELECT\n  id,\n  name,\n  CASE\n    WHEN score >= 90 THEN 'Excellent'\n    WHEN score >= 70 THEN 'Good'\n    WHEN score >= 50 THEN 'Average'\n    ELSE 'Below Average'\n  END AS performance_grade,\n  score\nFROM evaluations\nORDER BY score DESC;`,
    tags: ['select', 'case', 'conditional'],
  },
  {
    id: 'select-distinct-count',
    name: 'Select Distinct with Count',
    description: 'Count occurrences of each distinct value in a column',
    category: 'select',
    sql: `SELECT\n  category,\n  COUNT(*) AS frequency,\n  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct\nFROM products\nGROUP BY category\nORDER BY frequency DESC;`,
    tags: ['select', 'distinct', 'count'],
  },
  // JOIN
  {
    id: 'join-inner-agg',
    name: 'Inner Join with Aggregation',
    description: 'JOIN two tables with GROUP BY and HAVING filter',
    category: 'join',
    sql: `SELECT\n  c.customer_name,\n  COUNT(o.id) AS total_orders,\n  SUM(o.amount) AS total_spent\nFROM customers c\nINNER JOIN orders o ON o.customer_id = c.id\nGROUP BY c.customer_name\nHAVING SUM(o.amount) > 1000\nORDER BY total_spent DESC;`,
    tags: ['join', 'inner', 'aggregation'],
  },
  {
    id: 'join-left-null',
    name: 'Left Join with Null Check',
    description: 'Find records in the left table with no matching rows',
    category: 'join',
    sql: `SELECT\n  c.id,\n  c.customer_name,\n  c.email\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL\nORDER BY c.customer_name;`,
    tags: ['join', 'left', 'null', 'unmatched'],
  },
  {
    id: 'join-multi',
    name: 'Multi-Table Join',
    description: 'Join three or more tables to build a composite result set',
    category: 'join',
    sql: `SELECT\n  o.id AS order_id,\n  c.customer_name,\n  p.product_name,\n  oi.quantity,\n  oi.unit_price,\n  (oi.quantity * oi.unit_price) AS line_total\nFROM orders o\nINNER JOIN customers c ON c.id = o.customer_id\nINNER JOIN order_items oi ON oi.order_id = o.id\nINNER JOIN products p ON p.id = oi.product_id\nORDER BY o.id, p.product_name;`,
    tags: ['join', 'multi-table', 'composite'],
  },
  // Aggregation
  {
    id: 'agg-rollup',
    name: 'Group By with Rollup',
    description: 'Generate subtotals and grand totals with ROLLUP',
    category: 'aggregation',
    sql: `SELECT\n  COALESCE(region, '** Total **') AS region,\n  COALESCE(category, '** Subtotal **') AS category,\n  SUM(revenue) AS total_revenue,\n  COUNT(*) AS num_sales\nFROM sales\nGROUP BY ROLLUP (region, category)\nORDER BY region, category;`,
    tags: ['aggregation', 'rollup', 'subtotal'],
  },
  {
    id: 'agg-pivot',
    name: 'Pivot Query',
    description: 'Cross-tabulation turning row values into columns',
    category: 'aggregation',
    sql: `SELECT\n  product_name,\n  SUM(CASE WHEN quarter = 'Q1' THEN revenue ELSE 0 END) AS q1,\n  SUM(CASE WHEN quarter = 'Q2' THEN revenue ELSE 0 END) AS q2,\n  SUM(CASE WHEN quarter = 'Q3' THEN revenue ELSE 0 END) AS q3,\n  SUM(CASE WHEN quarter = 'Q4' THEN revenue ELSE 0 END) AS q4,\n  SUM(revenue) AS annual_total\nFROM quarterly_sales\nGROUP BY product_name\nORDER BY annual_total DESC;`,
    tags: ['aggregation', 'pivot', 'cross-tab'],
  },
  {
    id: 'agg-running-total',
    name: 'Running Total',
    description: 'Cumulative sum using a window function over ordered rows',
    category: 'aggregation',
    sql: `SELECT\n  transaction_date,\n  amount,\n  SUM(amount) OVER (\n    ORDER BY transaction_date\n    ROWS UNBOUNDED PRECEDING\n  ) AS running_total\nFROM transactions\nORDER BY transaction_date;`,
    tags: ['aggregation', 'running total', 'window'],
  },
  // Subquery
  {
    id: 'sub-correlated',
    name: 'Correlated Subquery',
    description: 'EXISTS with a correlated subquery to filter parent rows',
    category: 'subquery',
    sql: `SELECT\n  e.id,\n  e.employee_name,\n  e.department_id\nFROM employees e\nWHERE EXISTS (\n  SELECT 1\n  FROM performance_reviews pr\n  WHERE pr.employee_id = e.id\n    AND pr.rating >= 4\n    AND pr.review_year = 2024\n)\nORDER BY e.employee_name;`,
    tags: ['subquery', 'correlated', 'exists'],
  },
  {
    id: 'sub-in-agg',
    name: 'IN Subquery with Aggregation',
    description: 'Filter rows using WHERE IN with a nested aggregate query',
    category: 'subquery',
    sql: `SELECT\n  product_name,\n  price,\n  category\nFROM products\nWHERE category IN (\n  SELECT category\n  FROM products\n  GROUP BY category\n  HAVING AVG(price) > 50\n)\nORDER BY category, price DESC;`,
    tags: ['subquery', 'in', 'aggregation'],
  },
  // CTE
  {
    id: 'cte-simple',
    name: 'Simple CTE',
    description: 'WITH clause to improve readability of complex queries',
    category: 'cte',
    sql: `WITH monthly_totals AS (\n  SELECT\n    DATE_TRUNC('month', order_date) AS month,\n    SUM(amount) AS total,\n    COUNT(*) AS num_orders\n  FROM orders\n  WHERE order_date >= '2024-01-01'\n  GROUP BY DATE_TRUNC('month', order_date)\n)\nSELECT\n  month,\n  total,\n  num_orders,\n  ROUND(total / num_orders, 2) AS avg_order_value\nFROM monthly_totals\nORDER BY month;`,
    tags: ['cte', 'with', 'readability'],
  },
  {
    id: 'cte-recursive',
    name: 'Recursive CTE',
    description: 'Traverse hierarchical data such as org charts or trees',
    category: 'cte',
    sql: `WITH RECURSIVE org_tree AS (\n  -- Anchor: top-level managers\n  SELECT id, name, manager_id, 1 AS depth\n  FROM employees\n  WHERE manager_id IS NULL\n\n  UNION ALL\n\n  -- Recursive: subordinates\n  SELECT e.id, e.name, e.manager_id, t.depth + 1\n  FROM employees e\n  INNER JOIN org_tree t ON t.id = e.manager_id\n)\nSELECT\n  LPAD(' ', (depth - 1) * 2) || name AS org_chart,\n  depth\nFROM org_tree\nORDER BY depth, name;`,
    tags: ['cte', 'recursive', 'hierarchy'],
  },
  // Window
  {
    id: 'win-row-number',
    name: 'Row Number Partition',
    description: 'Assign row numbers within each partition for ranking or dedup',
    category: 'window',
    sql: `SELECT *\nFROM (\n  SELECT\n    department,\n    employee_name,\n    salary,\n    ROW_NUMBER() OVER (\n      PARTITION BY department\n      ORDER BY salary DESC\n    ) AS rn\n  FROM employees\n) ranked\nWHERE rn <= 3\nORDER BY department, rn;`,
    tags: ['window', 'row_number', 'partition'],
  },
  {
    id: 'win-moving-avg',
    name: 'Moving Average',
    description: 'Compute a sliding average over a window of preceding rows',
    category: 'window',
    sql: `SELECT\n  report_date,\n  daily_value,\n  ROUND(\n    AVG(daily_value) OVER (\n      ORDER BY report_date\n      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW\n    ), 2\n  ) AS moving_avg_7d\nFROM daily_metrics\nORDER BY report_date;`,
    tags: ['window', 'moving average', 'rows between'],
  },
  // DDL
  {
    id: 'ddl-create-table',
    name: 'Create Table with Constraints',
    description: 'Full CREATE TABLE with PK, FK, NOT NULL, DEFAULT, and index',
    category: 'ddl',
    sql: `CREATE TABLE orders (\n  id          SERIAL PRIMARY KEY,\n  customer_id INTEGER NOT NULL,\n  order_date  DATE    NOT NULL DEFAULT CURRENT_DATE,\n  status      VARCHAR(20) NOT NULL DEFAULT 'pending',\n  total       DECIMAL(12,2) NOT NULL DEFAULT 0,\n  notes       TEXT,\n  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),\n  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),\n\n  CONSTRAINT fk_orders_customer\n    FOREIGN KEY (customer_id)\n    REFERENCES customers (id)\n    ON DELETE RESTRICT,\n\n  CONSTRAINT chk_orders_status\n    CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled'))\n);\n\nCREATE INDEX idx_orders_customer ON orders (customer_id);\nCREATE INDEX idx_orders_date ON orders (order_date);`,
    tags: ['ddl', 'create', 'constraints', 'index'],
  },
];

function resolveDialect(templates: QueryTemplate[], dialect: string): QueryTemplate[] {
  const limit = limitClause(dialect);
  return templates.map(t => ({
    ...t,
    sql: t.sql.replace('{{LIMIT}}', limit),
  }));
}

export function QueryTemplatesPanel({
  dialect,
  onInsertTemplate,
  className,
}: QueryTemplatesPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dialectTemplates = useMemo(() => resolveDialect(TEMPLATES, dialect), [dialect]);

  const filteredTemplates = useMemo(() => {
    let items = dialectTemplates;
    if (selectedCategory !== 'all') {
      items = items.filter(t => t.category === selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(t =>
        t.name.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }
    return items;
  }, [selectedCategory, searchTerm, dialectTemplates]);

  const handleCopy = async (template: QueryTemplate) => {
    try {
      await navigator.clipboard.writeText(template.sql);
      setCopiedId(template.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may not be available in some environments
    }
  };

  const previewLines = (sql: string, max = 4): { text: string; truncated: boolean } => {
    const lines = sql.split('\n');
    if (lines.length <= max) return { text: sql, truncated: false };
    return { text: lines.slice(0, max).join('\n'), truncated: true };
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Category tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-aqua-50 text-aqua-700 border-aqua-300 border'
                  : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-400"
        />
      </div>

      {/* Template count */}
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Template cards */}
      {filteredTemplates.length > 0 ? (
        <div className="space-y-3">
          {filteredTemplates.map(template => {
            const { text: preview, truncated } = previewLines(template.sql);
            const isCopied = copiedId === template.id;

            return (
              <div
                key={template.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-aqua-300/50 transition-colors"
              >
                <h4 className="text-sm font-medium text-foreground">{template.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>

                {/* SQL preview */}
                <div className="mt-2.5 bg-[#1e293b] text-slate-300 text-xs font-mono p-3 rounded-lg overflow-x-auto">
                  <pre className="whitespace-pre">{preview}{truncated ? '\n...' : ''}</pre>
                </div>

                {/* Footer: tags + actions */}
                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="flex items-center gap-1 flex-wrap min-w-0">
                    {template.tags.map(tag => (
                      <span
                        key={tag}
                        className="bg-secondary text-muted-foreground text-[10px] px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onInsertTemplate(template.sql)}
                      className="flex items-center gap-1 bg-aqua-600 hover:bg-aqua-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Insert
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleCopy(template)}
                      className={cn(
                        'flex items-center justify-center h-7 w-7 rounded-lg border transition-colors',
                        isCopied
                          ? 'border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                      )}
                      title="Copy SQL to clipboard"
                    >
                      {isCopied ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileCode className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No templates found</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Try a different search or category
          </p>
        </div>
      )}
    </div>
  );
}

export default QueryTemplatesPanel;
