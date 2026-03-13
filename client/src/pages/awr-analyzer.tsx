import React, { useState, useRef, useCallback } from 'react';
import {
  FileSearch, Upload, Loader2, AlertTriangle, AlertCircle,
  CheckCircle2, Activity, X, FileUp, Cpu, HardDrive,
  Database, Code2, Lightbulb, ChevronDown, ChevronUp, Copy, Check,
  Gauge, Shield, Clock, Zap, TrendingUp, TrendingDown,
  Server, FileText, Download, BarChart3, Info, Layers,
  ArrowRight, GitCompare, Sparkles, Play, Timer,
} from 'lucide-react';
import { IncidentTimeMachine } from '@/components/awr/incident-time-machine';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { trackAIUsage } from '@/lib/ai-usage-tracker';
import {
  useAWRAnalyze, useAWRCompare,
  type AWRFullResult, type AWRAnalysisResult, type AWRCompareResult,
  type ReportType, type Severity,
} from '@/hooks/use-awr';

// ── Constants ────────────────────────────────────────────────────────────────

const REPORT_TYPES: { value: ReportType; label: string; db: string }[] = [
  { value: 'awr', label: 'Oracle AWR', db: 'Oracle' },
  { value: 'ash', label: 'Oracle ASH', db: 'Oracle' },
  { value: 'addm', label: 'Oracle ADDM', db: 'Oracle' },
  { value: 'mysql_slowlog', label: 'MySQL Slow Log', db: 'MySQL' },
  { value: 'pg_stats', label: 'PG Stats', db: 'PostgreSQL' },
  { value: 'generic', label: 'Auto-Detect', db: 'Any' },
];

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string; icon: typeof AlertCircle }> = {
  critical: { color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200', icon: AlertCircle },
  high: { color: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200', icon: AlertTriangle },
  medium: { color: 'text-yellow-700', bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200', icon: Info },
  low: { color: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200', icon: CheckCircle2 },
};

const HEALTH_COLOR = (score: number) =>
  score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

const CATEGORY_ICONS: Record<string, typeof Cpu> = {
  index: Layers,
  sql: Code2,
  config: Server,
  partition: Database,
  memory: HardDrive,
  io: Activity,
  architecture: Shield,
};

const PRIORITY_CONFIG = {
  immediate: { color: 'text-red-700 bg-red-50 border-red-200', label: 'Immediate' },
  'short-term': { color: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Short-term' },
  'long-term': { color: 'text-blue-700 bg-blue-50 border-blue-200', label: 'Long-term' },
};

type AnalysisTab = 'overview' | 'root-cause' | 'sql' | 'wait-events' | 'recommendations' | 'raw-metrics';

// ── Copy helper ─────────────────────────────────────────────────────────────

function copyText(text: string, setCopied: (v: string | null) => void, field: string) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }).catch(() => {});
}

// ── Demo Data ───────────────────────────────────────────────────────────────

function getDemoResult(): AWRFullResult {
  return {
    parseResult: {
      reportType: 'awr',
      database: 'oracle',
      fileSizeKB: 847,
      parseTimeMs: 42,
      fromCache: false,
      sectionsFound: ['Load Profile', 'Top Wait Events', 'SQL by Elapsed Time', 'Instance Efficiency', 'I/O Stats', 'Memory'],
      lineCount: 4287,
    },
    metrics: {
      reportType: 'awr', database: 'oracle', instanceName: 'PRODDB', dbName: 'PRODDB', dbVersion: '19.21.0.0.0', hostName: 'prod-db-server-01',
      timeRange: { start: '14-Mar-26 08:00', end: '14-Mar-26 09:00' }, elapsedMinutes: 60, dbTimeMinutes: 487,
      loadProfile: { dbTimePerSec: 8.11, cpuTimePerSec: 3.24, logicalReadsPerSec: 187432, physicalReadsPerSec: 12847, parsesPerSec: 345, hardParsesPerSec: 28.7, transactionsPerSec: 19.2, redoSizePerSec: 2847561 },
      waitEvents: [
        { event: 'db file sequential read', percentDbTime: 29.89, timeSeconds: 8742.3, avgWaitMs: 3.07, waitClass: 'User I/O' },
        { event: 'DB CPU', percentDbTime: 19.92, timeSeconds: 5824.1, avgWaitMs: 0, waitClass: 'CPU' },
        { event: 'log file sync', percentDbTime: 11.70, timeSeconds: 3421.7, avgWaitMs: 7.02, waitClass: 'Commit' },
        { event: 'db file scattered read', percentDbTime: 9.73, timeSeconds: 2847.5, avgWaitMs: 2.28, waitClass: 'User I/O' },
        { event: 'enq: TX - row lock contention', percentDbTime: 6.31, timeSeconds: 1847.2, avgWaitMs: 147.94, waitClass: 'Application' },
      ],
      topSQLByElapsed: [
        { sqlId: 'g8fn4q2k7x9m2', elapsedTimeSec: 4287.32, cpuTimeSec: 1247.84, executions: 48721, avgElapsedMs: 88.0, bufferGets: 48721847, diskReads: 12847231, percentDbTime: 14.66, sqlText: 'SELECT o.order_id, o.order_date, o.status, c.customer_name... FROM orders o JOIN customers c ON o.customer_id = c.customer_id JOIN order_lines ol ON o.order_id = ol.order_id WHERE o.order_date BETWEEN :1 AND :2' },
        { sqlId: 'a2bx8n4kp1w3z', elapsedTimeSec: 3124.87, cpuTimeSec: 2847.12, executions: 12487, avgElapsedMs: 250.3, bufferGets: 28471234, diskReads: 8472314, percentDbTime: 10.68, sqlText: 'SELECT /*+ FULL(t) PARALLEL(t, 4) */ t.transaction_id... FROM transactions t JOIN accounts a ON t.account_id = a.account_id WHERE t.created_at >= SYSDATE - 30' },
        { sqlId: 'w3z8b2n4k7m1p', elapsedTimeSec: 1847.54, cpuTimeSec: 1523.41, executions: 847, avgElapsedMs: 2181.0, bufferGets: 8472314, diskReads: 2847123, percentDbTime: 6.32, sqlText: 'SELECT customer_id, customer_name, email, (SELECT COUNT(*) FROM orders WHERE customer_id = c.customer_id) AS order_count... FROM customers c WHERE c.status = \'ACTIVE\'' },
      ],
      instanceEfficiency: { bufferCacheHitRatio: 93.14, libraryCacheHitRatio: 97.82, softParseRatio: 91.68, executeToParseRatio: 87.89 },
      memory: { sgaTotalMB: 98304, pgaAllocatedMB: 28471, bufferCacheMB: 65536, sharedPoolMB: 16384 },
      sectionsFound: ['Load Profile', 'Top Wait Events', 'SQL by Elapsed Time', 'Instance Efficiency', 'I/O Stats', 'Memory'],
    },
    analysis: {
      summary: {
        healthScore: 58,
        healthRating: 'degraded',
        headline: 'Database experiencing significant I/O bottleneck with high physical reads and row lock contention impacting order processing throughput',
        keyFindings: [
          'Buffer Cache Hit Ratio at 93.14% — below recommended 95%+ threshold, causing excessive physical reads (12,847/sec)',
          'Row lock contention (TX enqueue) averaging 148ms per wait — indicating hot table conflicts on order processing',
          'Top SQL g8fn4q2k7x9m2 consuming 14.66% of DB time across 48K executions — missing composite index on orders table',
          'Correlated subqueries in SQL w3z8b2n4k7m1p averaging 2.18 seconds per execution — requires rewrite with JOIN',
          'Hard parse ratio at 8.3% (28.7/345 parses) — prepared statements not being used for some application queries',
        ],
        timeRange: '08:00 - 09:00 (60 min) · DB Time: 487 min · Avg Active Sessions: 8.1',
      },
      rootCause: [
        {
          primaryCause: 'Excessive Physical I/O from Undersized Buffer Cache',
          explanation: 'The buffer cache hit ratio of 93.14% is significantly below the recommended 95%+ threshold for an OLTP workload. With 12,847 physical reads/sec and the db file sequential read wait event consuming 29.89% of total DB time, the SGA buffer cache (65GB) is insufficient for the current working set. The ORDERS and ORDER_LINES tables alone account for 3 million physical reads during this hour.',
          evidence: [
            'Buffer Cache Hit Ratio: 93.14% (target: >95%)',
            'Physical reads/sec: 12,847 — 3.5x higher than optimal for this workload',
            'db file sequential read: 29.89% of DB time, 8,742 seconds total wait',
            'Top segment physical reads: ORDERS partition P202603 = 1.84M reads',
          ],
          severity: 'critical' as Severity,
          affectedArea: 'io' as const,
        },
        {
          primaryCause: 'Row Lock Contention on Order Processing Tables',
          explanation: 'The TX row lock contention event averaging 147.94ms per wait indicates concurrent DML conflicts, likely on the ORDERS or INVENTORY tables. With 12,487 total waits consuming 6.31% of DB time, this suggests that order placement and inventory update paths are serializing on the same rows.',
          evidence: [
            'enq: TX - row lock contention: 6.31% DB time, 12,487 waits',
            'Average wait time: 147.94ms — extremely high for row locks',
            'Inventory UPDATE (SQL p1w3z8b2n4k7m): 3,847 executions with 321ms avg',
            'Coincides with peak order processing window (08:00-09:00)',
          ],
          severity: 'high' as Severity,
          affectedArea: 'locking' as const,
        },
        {
          primaryCause: 'Inefficient SQL with Correlated Subqueries',
          explanation: 'SQL ID w3z8b2n4k7m1p executes 3 correlated subqueries per row against the ORDERS and ORDER_LINES tables to compute order_count, last_order_date, and lifetime_value. With 847 executions averaging 2.18 seconds each, this pattern causes N+1-style query behavior.',
          evidence: [
            'SQL w3z8b2n4k7m1p: 2,181ms average execution time',
            '3 correlated scalar subqueries = 3x table access per row',
            'Total elapsed: 1,847.54 seconds (6.32% of DB time)',
            'Buffer gets: 8.47M — disproportionately high for 847 executions',
          ],
          severity: 'high' as Severity,
          affectedArea: 'sql' as const,
        },
        {
          primaryCause: 'Missing Composite Index on Orders Table',
          explanation: 'The highest-consuming SQL (g8fn4q2k7x9m2) joins ORDERS, CUSTOMERS, and ORDER_LINES with a date range filter and status IN-list. The IDX_ORDERS_DATE index is single-column, forcing additional table lookups for status filtering.',
          evidence: [
            'SQL g8fn4q2k7x9m2: 14.66% DB time across 48,721 executions',
            'Disk reads: 12.8M — suggests table scans after index range scan',
            'Current index IDX_ORDERS_DATE covers only order_date column',
            'Estimated 60-70% reduction in elapsed time with composite index',
          ],
          severity: 'medium' as Severity,
          affectedArea: 'sql' as const,
        },
      ],
      sqlAnalysis: [
        {
          sqlId: 'g8fn4q2k7x9m2',
          sqlText: 'SELECT o.order_id, o.order_date, o.status, c.customer_name, c.email, SUM(ol.quantity * ol.unit_price) AS total_amount FROM orders o JOIN customers c ON o.customer_id = c.customer_id JOIN order_lines ol ON o.order_id = ol.order_id WHERE o.order_date BETWEEN :1 AND :2 AND o.status IN (:3, :4, :5) GROUP BY o.order_id, o.order_date, o.status, c.customer_name, c.email ORDER BY o.order_date DESC',
          problem: 'Three-way JOIN with date range scan and IN-list filter on status. Single-column IDX_ORDERS_DATE index forces excessive table access for status filtering. Buffer gets (48.7M) and disk reads (12.8M) are disproportionately high.',
          currentTime: '88ms avg (48,721 execs)',
          recommendation: 'Create composite index on orders(order_date, status, customer_id) to enable index skip-scan or range scan that covers both WHERE predicates.',
          suggestedRewrite: 'SELECT /*+ INDEX(o IDX_ORDERS_DATE_STATUS_CUST) */\n  o.order_id, o.order_date, o.status,\n  c.customer_name, c.email,\n  SUM(ol.quantity * ol.unit_price) AS total_amount\nFROM orders o\nJOIN customers c ON o.customer_id = c.customer_id\nJOIN order_lines ol ON o.order_id = ol.order_id\nWHERE o.order_date BETWEEN :1 AND :2\n  AND o.status IN (:3, :4, :5)\nGROUP BY o.order_id, o.order_date, o.status,\n  c.customer_name, c.email\nORDER BY o.order_date DESC',
          indexRecommendation: 'CREATE INDEX IDX_ORDERS_DATE_STATUS_CUST ON orders(order_date, status, customer_id) TABLESPACE USERS_INDEX;',
          estimatedImprovement: '60-70% reduction in elapsed time, ~80% reduction in disk reads',
        },
        {
          sqlId: 'w3z8b2n4k7m1p',
          sqlText: 'SELECT customer_id, customer_name, email, phone, (SELECT COUNT(*) FROM orders WHERE customer_id = c.customer_id) AS order_count, (SELECT MAX(order_date) FROM orders WHERE customer_id = c.customer_id) AS last_order_date, (SELECT SUM(ol.quantity * ol.unit_price) FROM orders o JOIN order_lines ol ON o.order_id = ol.order_id WHERE o.customer_id = c.customer_id) AS lifetime_value FROM customers c WHERE c.status = \'ACTIVE\' ORDER BY lifetime_value DESC NULLS LAST',
          problem: 'Three correlated scalar subqueries execute independently for each customer row, causing N+1-style access pattern. Each execution scans the orders and order_lines tables 3 additional times.',
          currentTime: '2,181ms avg (847 execs)',
          recommendation: 'Rewrite correlated subqueries as a single LEFT JOIN with GROUP BY aggregation. This eliminates the N+1 pattern and allows the optimizer to use hash joins.',
          suggestedRewrite: 'SELECT c.customer_id, c.customer_name, c.email, c.phone,\n  COUNT(DISTINCT o.order_id) AS order_count,\n  MAX(o.order_date) AS last_order_date,\n  SUM(ol.quantity * ol.unit_price) AS lifetime_value\nFROM customers c\nLEFT JOIN orders o ON c.customer_id = o.customer_id\nLEFT JOIN order_lines ol ON o.order_id = ol.order_id\nWHERE c.status = \'ACTIVE\'\nGROUP BY c.customer_id, c.customer_name, c.email, c.phone\nORDER BY lifetime_value DESC NULLS LAST',
          indexRecommendation: 'CREATE INDEX IDX_ORDERS_CUSTID_DATE ON orders(customer_id, order_date) TABLESPACE USERS_INDEX;',
          estimatedImprovement: '85-90% reduction — from 2.18s to ~200-300ms per execution',
        },
        {
          sqlId: 'a2bx8n4kp1w3z',
          sqlText: 'SELECT /*+ FULL(t) PARALLEL(t, 4) */ t.transaction_id, t.account_id, t.amount, t.transaction_type, t.created_at, a.account_number, a.balance FROM transactions t JOIN accounts a ON t.account_id = a.account_id WHERE t.created_at >= SYSDATE - 30 AND t.amount > 10000 AND NOT EXISTS (SELECT 1 FROM audit_log al WHERE al.transaction_id = t.transaction_id AND al.status = \'REVIEWED\')',
          problem: 'FULL hint forces full table scan with PARALLEL on the transactions table. The NOT EXISTS subquery on audit_log lacks an index on (transaction_id, status).',
          currentTime: '250ms avg (12,487 execs)',
          recommendation: 'Remove the FULL/PARALLEL hints — let the optimizer choose an index range scan. Create covering index on audit_log(transaction_id, status).',
          suggestedRewrite: 'SELECT t.transaction_id, t.account_id, t.amount,\n  t.transaction_type, t.created_at,\n  a.account_number, a.balance\nFROM transactions t\nJOIN accounts a ON t.account_id = a.account_id\nWHERE t.created_at >= SYSDATE - 30\n  AND t.amount > 10000\n  AND NOT EXISTS (\n    SELECT 1 FROM audit_log al\n    WHERE al.transaction_id = t.transaction_id\n    AND al.status = \'REVIEWED\'\n  )',
          indexRecommendation: 'CREATE INDEX IDX_AUDIT_LOG_TXNID_STATUS ON audit_log(transaction_id, status) TABLESPACE USERS_INDEX;\nCREATE INDEX IDX_TXN_CREATED_AMT ON transactions(created_at, amount) TABLESPACE USERS_INDEX;',
          estimatedImprovement: '70% reduction in CPU time, 50% reduction in elapsed time',
        },
      ],
      waitEventAnalysis: [
        {
          event: 'db file sequential read',
          interpretation: 'Single-block I/O reads from data files, typically caused by index lookups followed by table access via ROWID. At 29.89% of DB time with 2.84M waits and 3.07ms average, this indicates the buffer cache is not retaining frequently accessed blocks.',
          severity: 'critical' as Severity,
          recommendation: 'Increase SGA buffer cache from 65GB to 80-90GB. Implement the recommended composite indexes to reduce physical reads.',
        },
        {
          event: 'log file sync',
          interpretation: 'Wait on LGWR to flush redo log buffer to disk during COMMIT. At 11.70% DB time with 7.02ms average, this is moderately elevated for OLTP workload.',
          severity: 'high' as Severity,
          recommendation: 'Move redo logs to dedicated low-latency NVMe storage. Consider increasing log_buffer to 64MB. Batch application commits where possible.',
        },
        {
          event: 'enq: TX - row lock contention',
          interpretation: 'Application-level row lock conflicts where multiple sessions attempt to modify the same rows simultaneously. The 147.94ms avg indicates long-held locks from inventory UPDATE statements.',
          severity: 'high' as Severity,
          recommendation: 'Implement optimistic locking with SELECT FOR UPDATE SKIP LOCKED for inventory updates. Reduce transaction scope around inventory modifications.',
        },
        {
          event: 'db file scattered read',
          interpretation: 'Multi-block I/O reads from full table scans. At 9.73% DB time, consistent with the PARALLEL full table scan in SQL a2bx8n4kp1w3z against the transactions table.',
          severity: 'medium' as Severity,
          recommendation: 'Eliminate the FULL hint in SQL a2bx8n4kp1w3z and create proper indexes. Schedule batch operations during off-peak hours.',
        },
        {
          event: 'gc buffer busy acquire',
          interpretation: 'RAC-specific wait event for buffer block contention across cluster instances. At 3.38% DB time with 3.47ms average, within acceptable range but worth monitoring.',
          severity: 'low' as Severity,
          recommendation: 'Monitor gc buffer busy trends during peak hours. Consider service-based workload routing to minimize cross-instance block transfers.',
        },
      ],
      recommendations: [
        {
          category: 'index' as const, priority: 'immediate' as const,
          title: 'Create Composite Index on Orders Table',
          description: 'The most impactful single change. The top SQL (14.66% DB time) will shift from full table scans with post-filtering to index range scans.',
          implementation: 'CREATE INDEX IDX_ORDERS_DATE_STATUS_CUST\n  ON orders(order_date, status, customer_id)\n  TABLESPACE USERS_INDEX\n  PARALLEL 4;\n\nALTER INDEX IDX_ORDERS_DATE_STATUS_CUST NOPARALLEL;',
          estimatedImpact: '14.66% DB time reduction — saves ~4,287 seconds/hour',
        },
        {
          category: 'sql' as const, priority: 'immediate' as const,
          title: 'Rewrite Customer Lifetime Value Query',
          description: 'Replace 3 correlated subqueries with a single JOIN+GROUP BY. Eliminates N+1 anti-pattern generating thousands of internal queries.',
          implementation: 'SELECT c.customer_id, c.customer_name, c.email,\n  COUNT(DISTINCT o.order_id) AS order_count,\n  MAX(o.order_date) AS last_order_date,\n  SUM(ol.quantity * ol.unit_price) AS lifetime_value\nFROM customers c\nLEFT JOIN orders o ON c.customer_id = o.customer_id\nLEFT JOIN order_lines ol ON o.order_id = ol.order_id\nWHERE c.status = \'ACTIVE\'\nGROUP BY c.customer_id, c.customer_name, c.email\nORDER BY lifetime_value DESC NULLS LAST;',
          estimatedImpact: '85-90% improvement — from 2.18s to ~200ms per execution',
        },
        {
          category: 'memory' as const, priority: 'short-term' as const,
          title: 'Increase Buffer Cache Size',
          description: 'Buffer cache hit ratio at 93.14% is causing 12,847 physical reads/sec. Server has 256GB RAM with current SGA at 96GB, leaving headroom.',
          implementation: 'ALTER SYSTEM SET sga_target = 128G SCOPE=SPFILE;\nALTER SYSTEM SET db_cache_size = 90G SCOPE=SPFILE;\n-- Restart required for SGA resize above sga_max_size',
          estimatedImpact: 'Buffer cache hit ratio 97%+, ~40% reduction in physical reads',
        },
        {
          category: 'config' as const, priority: 'short-term' as const,
          title: 'Remove FULL/PARALLEL Hints from Transaction Query',
          description: 'SQL a2bx8n4kp1w3z has hardcoded FULL(t) PARALLEL(t, 4) hints that override the optimizer. With proper indexes, an index range scan would be significantly more efficient.',
          implementation: '-- Remove hints from application code:\n-- Before: SELECT /*+ FULL(t) PARALLEL(t, 4) */ ...\n-- After:  SELECT t.transaction_id, ...\n\n-- Add supporting index:\nCREATE INDEX IDX_TXN_CREATED_AMT\n  ON transactions(created_at, amount)\n  TABLESPACE USERS_INDEX;',
          estimatedImpact: '70% CPU reduction for this query, 10.68% DB time savings',
        },
        {
          category: 'architecture' as const, priority: 'long-term' as const,
          title: 'Implement Optimistic Locking for Inventory Updates',
          description: 'Row lock contention averaging 148ms suggests multiple sessions competing for the same inventory rows during concurrent order processing.',
          implementation: '-- Use SELECT FOR UPDATE SKIP LOCKED pattern:\nSELECT quantity_on_hand FROM inventory\n  WHERE product_id = :1 AND warehouse_id = :2\n  FOR UPDATE SKIP LOCKED;\n\n-- Or implement application-level optimistic locking:\nUPDATE inventory\n  SET quantity_on_hand = quantity_on_hand - :qty,\n      version = version + 1\n  WHERE product_id = :pid AND warehouse_id = :wid\n  AND version = :expected_version;',
          estimatedImpact: '6.31% DB time reduction, eliminates 148ms avg lock waits',
        },
        {
          category: 'partition' as const, priority: 'long-term' as const,
          title: 'Partition Transactions Table by Created Date',
          description: 'Range partitioning by created_at would enable partition pruning for the 30-day lookback queries, eliminating scans of historical data.',
          implementation: 'ALTER TABLE transactions MODIFY\n  PARTITION BY RANGE (created_at)\n  INTERVAL (NUMTOYMINTERVAL(1, \'MONTH\'))\n(\n  PARTITION p_before_2026 VALUES LESS THAN\n    (TO_DATE(\'2026-01-01\', \'YYYY-MM-DD\'))\n);',
          estimatedImpact: 'Eliminates scanning 11 months of historical data for 30-day queries',
        },
      ],
      indexRecommendations: [
        { table: 'orders', columns: ['order_date', 'status', 'customer_id'], reason: 'Covers WHERE clause of top SQL enabling index range scan instead of full table scan.', createStatement: 'CREATE INDEX IDX_ORDERS_DATE_STATUS_CUST ON orders(order_date, status, customer_id) TABLESPACE USERS_INDEX;', estimatedImprovement: '60-70% reduction in query time for top SQL' },
        { table: 'orders', columns: ['customer_id', 'order_date'], reason: 'Optimizes customer lifetime value query JOIN and correlated subqueries.', createStatement: 'CREATE INDEX IDX_ORDERS_CUSTID_DATE ON orders(customer_id, order_date) TABLESPACE USERS_INDEX;', estimatedImprovement: '80% improvement for customer analytics queries' },
        { table: 'audit_log', columns: ['transaction_id', 'status'], reason: 'The NOT EXISTS anti-join currently performs full scans. This composite index enables efficient semi-join.', createStatement: 'CREATE INDEX IDX_AUDIT_LOG_TXNID_STATUS ON audit_log(transaction_id, status) TABLESPACE USERS_INDEX;', estimatedImprovement: '50% reduction in CPU for transaction audit query' },
        { table: 'transactions', columns: ['created_at', 'amount'], reason: 'Replaces the forced FULL PARALLEL scan with an efficient index range scan.', createStatement: 'CREATE INDEX IDX_TXN_CREATED_AMT ON transactions(created_at, amount) TABLESPACE USERS_INDEX;', estimatedImprovement: '70% reduction in query elapsed time after hint removal' },
      ],
    },
    usage: { inputTokens: 3847, outputTokens: 6284 },
    model: 'claude-sonnet-4-20250514',
    analysisTimeMs: 8472,
  };
}

// ── Main Component ──────────────────────────────────────────────────────────

type PageMode = 'analyze' | 'incident';

export function AWRAnalyzerPage() {
  const [pageMode, setPageMode] = useState<PageMode>('analyze');

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Mode Selector */}
      <div className="flex items-center gap-1 p-1 mb-6 bg-muted/50 rounded-xl w-fit border border-border">
        <button
          onClick={() => setPageMode('analyze')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
            pageMode === 'analyze'
              ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileSearch className="w-4 h-4" />
          Report Analyzer
        </button>
        <button
          onClick={() => setPageMode('incident')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
            pageMode === 'incident'
              ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Timer className="w-4 h-4" />
          Incident Time-Machine
        </button>
      </div>

      {pageMode === 'analyze' ? <AWRAnalyzerContent /> : <IncidentTimeMachine />}
    </div>
  );
}

export function AWRAnalyzerContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compareFileRef = useRef<HTMLInputElement>(null);

  // State
  const [reportContent, setReportContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [forceType, setForceType] = useState<ReportType>('generic');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [result, setResult] = useState<AWRFullResult | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareContent, setCompareContent] = useState('');
  const [compareFileName, setCompareFileName] = useState('');
  const [compareResult, setCompareResult] = useState<AWRCompareResult | null>(null);

  // Hooks
  const analyze = useAWRAnalyze();
  const compare = useAWRCompare();

  // ── File handlers ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, isCompare = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (isCompare) { setCompareContent(text); setCompareFileName(file.name); }
      else { setReportContent(text); setFileName(file.name); setResult(null); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // ── Analyze ──
  const handleAnalyze = useCallback(async () => {
    if (!reportContent) return;
    const res = await analyze.mutateAsync({
      content: reportContent,
      fileName: fileName || undefined,
      forceType: forceType !== 'generic' ? forceType : undefined,
      focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
    });
    setResult(res);
    setActiveTab('overview');
    trackAIUsage({ usage: res.usage, model: res.model }, 'awr-analyzer');
  }, [reportContent, fileName, forceType, focusAreas, analyze]);

  // ── Compare ──
  const handleCompare = useCallback(async () => {
    if (!reportContent || !compareContent) return;
    const res = await compare.mutateAsync({
      reportA: { content: reportContent, fileName: fileName || undefined },
      reportB: { content: compareContent, fileName: compareFileName || undefined },
    });
    setCompareResult(res);
    trackAIUsage({ usage: res.usage, model: res.model }, 'awr-compare');
  }, [reportContent, compareContent, fileName, compareFileName, compare]);

  // ── Load Demo ──
  const handleLoadDemo = useCallback(() => {
    const demo = getDemoResult();
    setResult(demo);
    setFileName('oracle-awr-PRODDB-2026-03-14.html');
    setReportContent('(demo)');
    setActiveTab('overview');
  }, []);

  // ── Reset ──
  const handleReset = useCallback(() => {
    setReportContent(''); setFileName(''); setResult(null);
    setCompareMode(false); setCompareContent(''); setCompareFileName(''); setCompareResult(null);
  }, []);

  const handleExportPDF = useCallback(() => { if (result) generateAWRPDF(result); }, [result]);

  const toggleFocus = useCallback((area: string) => {
    setFocusAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  }, []);

  const TABS: { id: AnalysisTab; label: string; icon: typeof Cpu }[] = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'root-cause', label: 'Root Cause', icon: AlertTriangle },
    { id: 'sql', label: 'SQL Analysis', icon: Code2 },
    { id: 'wait-events', label: 'Wait Events', icon: Clock },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
    { id: 'raw-metrics', label: 'Raw Metrics', icon: FileText },
  ];

  const analysis = result?.analysis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/50 dark:to-indigo-900/50 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Report Analyzer</h2>
            <p className="text-xs text-muted-foreground">Upload Oracle AWR, MySQL Slow Logs, PG Stats — get instant root-cause analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
                <Download className="w-3.5 h-3.5" /> Export PDF
              </button>
              <button onClick={() => { setCompareMode(!compareMode); setCompareResult(null); }} className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors', compareMode ? 'text-indigo-700 bg-indigo-100 border-indigo-300' : 'text-muted-foreground bg-muted/50 border-border hover:text-foreground')}>
                <GitCompare className="w-3.5 h-3.5" /> Compare
              </button>
            </>
          )}
          {(reportContent || result) && (
            <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      {!result && (
        <div className="space-y-4">
          <div onClick={() => fileInputRef.current?.click()} className="relative border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-950/20 transition-all group">
            <input ref={fileInputRef} type="file" accept=".html,.txt,.log,.csv,.htm" onChange={(e) => handleFileUpload(e)} className="hidden" />
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/50 dark:to-indigo-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileUp className="w-7 h-7 text-violet-500" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-1">{fileName ? fileName : 'Upload Performance Report'}</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Supports <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.html</code> <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.txt</code> <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.log</code> <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.csv</code>
            </p>
            <p className="text-xs text-muted-foreground">Oracle AWR/ASH/ADDM, MySQL Slow Query Logs, PostgreSQL pg_stat_statements</p>
          </div>

          {/* Demo Button */}
          {!reportContent && (
            <div className="flex items-center justify-center">
              <button onClick={handleLoadDemo} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
                <Play className="w-3.5 h-3.5" /> Load Demo — Oracle AWR Report
              </button>
            </div>
          )}

          {reportContent && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-medium text-violet-800 dark:text-violet-200">{fileName} loaded ({Math.round(reportContent.length / 1024)}KB)</span>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Report Type:</label>
                  <select value={forceType} onChange={(e) => setForceType(e.target.value as ReportType)} className="h-8 px-3 text-xs border border-border rounded-lg bg-card text-foreground">
                    {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} ({t.db})</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Focus:</label>
                  {['CPU', 'I/O', 'Memory', 'SQL', 'Locking', 'Indexes'].map(area => (
                    <button key={area} onClick={() => toggleFocus(area.toLowerCase())} className={cn('px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors', focusAreas.includes(area.toLowerCase()) ? 'bg-violet-100 border-violet-300 text-violet-700' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleAnalyze} disabled={analyze.isPending} className={cn('inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all shadow-sm', analyze.isPending ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-violet-500/25')}>
                {analyze.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing report...</> : <><Sparkles className="w-4 h-4" /> Analyze with AI</>}
              </button>

              {analyze.error && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">{String((analyze.error as Record<string, unknown>).message || analyze.error)}</p>
                </div>
              )}
            </div>
          )}

          {!reportContent && (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">or paste report text</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <textarea value={reportContent} onChange={(e) => { setReportContent(e.target.value); setFileName('pasted-report.txt'); }} placeholder="Paste your AWR report, slow query log, or pg_stat_statements output here..." className="w-full h-48 px-4 py-3 text-xs font-mono border border-border rounded-xl bg-card text-foreground resize-y focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
            </>
          )}
        </div>
      )}

      {/* Compare Mode */}
      {compareMode && result && (
        <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2"><GitCompare className="w-4 h-4 text-indigo-600" /> Compare with Another Report</h4>
            <button onClick={() => { setCompareMode(false); setCompareResult(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => compareFileRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
              <Upload className="w-4 h-4" /> {compareFileName || 'Upload Second Report'}
            </button>
            <input ref={compareFileRef} type="file" accept=".html,.txt,.log,.csv,.htm" onChange={(e) => handleFileUpload(e, true)} className="hidden" />
            {compareContent && (
              <button onClick={handleCompare} disabled={compare.isPending} className={cn('inline-flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-all', compare.isPending ? 'bg-muted text-muted-foreground' : 'bg-indigo-600 text-white hover:bg-indigo-700')}>
                {compare.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />} Compare Reports
              </button>
            )}
          </div>
          {compareResult && <CompareResultPanel result={compareResult} />}
        </div>
      )}

      {/* Results Dashboard */}
      {result && analysis && (
        <div className="space-y-4">
          {/* Parse Info Banner */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 rounded-lg text-xs flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="font-medium text-violet-800 dark:text-violet-200">
              {result.parseResult.reportType.toUpperCase()} report ({result.parseResult.database}) · {result.parseResult.fileSizeKB}KB
              {result.parseResult.lineCount ? ` · ${result.parseResult.lineCount.toLocaleString()} lines analyzed` : ''}
              {' '}· Parsed in {result.parseResult.parseTimeMs}ms
              {result.parseResult.fromCache && ' (cached)'}
            </span>
            <span className="text-violet-600 ml-auto flex items-center gap-3 flex-wrap">
              <span>{result.parseResult.sectionsFound.length} sections</span>
              <span className="w-px h-3 bg-violet-300" />
              <span>{result.model}</span>
              <span className="w-px h-3 bg-violet-300" />
              <span>{(result.usage.inputTokens + result.usage.outputTokens).toLocaleString()} tokens</span>
              {result.analysisTimeMs != null && (
                <>
                  <span className="w-px h-3 bg-violet-300" />
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {result.analysisTimeMs >= 1000 ? `${(result.analysisTimeMs / 1000).toFixed(1)}s` : `${result.analysisTimeMs}ms`}
                  </span>
                </>
              )}
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-border overflow-x-auto">
            {TABS.map(tab => {
              const TIcon = tab.icon;
              const count = tab.id === 'root-cause' ? analysis.rootCause.length : tab.id === 'sql' ? analysis.sqlAnalysis.length : tab.id === 'recommendations' ? analysis.recommendations.length + analysis.indexRecommendations.length : tab.id === 'wait-events' ? analysis.waitEventAnalysis.length : undefined;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', activeTab === tab.id ? 'border-violet-500 text-violet-700 dark:text-violet-300' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  <TIcon className="w-3.5 h-3.5" />
                  {tab.label}
                  {count !== undefined && count > 0 && <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-violet-100 text-violet-700 rounded-full">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'overview' && <OverviewTab analysis={analysis} />}
            {activeTab === 'root-cause' && <RootCauseTab rootCauses={analysis.rootCause} copiedField={copiedField} setCopied={setCopiedField} />}
            {activeTab === 'sql' && <SQLAnalysisTab sqlAnalysis={analysis.sqlAnalysis} copiedField={copiedField} setCopied={setCopiedField} />}
            {activeTab === 'wait-events' && <WaitEventsTab waitEvents={analysis.waitEventAnalysis} />}
            {activeTab === 'recommendations' && <RecommendationsTab recs={analysis.recommendations} indexRecs={analysis.indexRecommendations} copiedField={copiedField} setCopied={setCopiedField} />}
            {activeTab === 'raw-metrics' && <RawMetricsTab metrics={result.metrics} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ analysis }: { analysis: AWRAnalysisResult }) {
  const s = analysis.summary;
  const healthColor = HEALTH_COLOR(s.healthScore);
  const gaugeData = [{ name: 'Health', value: s.healthScore, fill: healthColor }];
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const rc of analysis.rootCause) severityCounts[rc.severity]++;
  const pieData = [
    { name: 'Critical', value: severityCounts.critical, fill: '#ef4444' },
    { name: 'High', value: severityCounts.high, fill: '#f97316' },
    { name: 'Medium', value: severityCounts.medium, fill: '#f59e0b' },
    { name: 'Low', value: severityCounts.low, fill: '#3b82f6' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <ResponsiveContainer width={140} height={140}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={gaugeData} startAngle={180} endAngle={0}>
              <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#f1f5f9' }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-3xl font-black mt-[-20px]" style={{ color: healthColor }}>{s.healthScore}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1">{s.healthRating === 'healthy' ? 'Healthy' : s.healthRating === 'degraded' ? 'Degraded' : 'Critical'}</p>
        </div>
        <div className="lg:col-span-2 border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-bold text-foreground">{s.headline}</h3>
          {s.timeRange && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {s.timeRange}</p>}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Key Findings</p>
            {s.keyFindings.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Root Causes', value: analysis.rootCause.length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'SQL Issues', value: analysis.sqlAnalysis.length, icon: Code2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Wait Events', value: analysis.waitEventAnalysis.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Recommendations', value: analysis.recommendations.length + analysis.indexRecommendations.length, icon: Lightbulb, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', card.bg)}><Icon className={cn('w-5 h-5', card.color)} /></div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{card.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border rounded-xl p-4">
            <h5 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-violet-500" /> Root Cause Severity Distribution</h5>
            <div className="flex items-center gap-6">
              <div className="w-28 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={45} dataKey="value" strokeWidth={2}>{pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Pie></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                {pieData.map(d => (<div key={d.name} className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} /><span className="text-muted-foreground">{d.name}:</span><span className="font-bold text-foreground">{d.value}</span></div>))}
              </div>
            </div>
          </div>
          <div className="border border-border rounded-xl p-4">
            <h5 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-violet-500" /> Recommendation Priority</h5>
            {(['immediate', 'short-term', 'long-term'] as const).map(priority => {
              const count = analysis.recommendations.filter(r => r.priority === priority).length;
              const cfg = PRIORITY_CONFIG[priority];
              return (<div key={priority} className="flex items-center justify-between py-1.5"><span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-md border', cfg.color)}>{cfg.label}</span><span className="text-sm font-bold text-foreground">{count}</span></div>);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RootCauseTab({ rootCauses, copiedField, setCopied }: { rootCauses: AWRAnalysisResult['rootCause']; copiedField: string | null; setCopied: (v: string | null) => void }) {
  if (rootCauses.length === 0) return <EmptyState icon={CheckCircle2} title="No Root Causes Detected" subtitle="The database appears to be performing well." />;
  return (
    <div className="space-y-4">
      {rootCauses.map((rc, i) => {
        const cfg = SEVERITY_CONFIG[rc.severity]; const SIcon = cfg.icon; const AreaIcon = CATEGORY_ICONS[rc.affectedArea] || Activity;
        return (
          <div key={i} className={cn('border rounded-xl overflow-hidden', cfg.border)}>
            <div className={cn('px-5 py-4', cfg.bg)}>
              <div className="flex items-start gap-3">
                <SIcon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', cfg.color)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-foreground">{rc.primaryCause}</h4>
                    <span className={cn('px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border', cfg.color, cfg.bg, cfg.border)}>{rc.severity}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 rounded-full"><AreaIcon className="w-3 h-3" /> {rc.affectedArea}</span>
                  </div>
                  <p className="text-xs text-foreground/80 mt-2 leading-relaxed">{rc.explanation}</p>
                </div>
                <button onClick={() => copyText(rc.explanation, setCopied, `rc-${i}`)} className="text-muted-foreground hover:text-foreground flex-shrink-0">{copiedField === `rc-${i}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
              </div>
            </div>
            {rc.evidence.length > 0 && (
              <div className="px-5 py-3 bg-card border-t border-border/50">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Evidence</p>
                <ul className="space-y-1">{rc.evidence.map((e, j) => (<li key={j} className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-violet-500 mt-0.5">-</span>{e}</li>))}</ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SQLAnalysisTab({ sqlAnalysis, copiedField, setCopied }: { sqlAnalysis: AWRAnalysisResult['sqlAnalysis']; copiedField: string | null; setCopied: (v: string | null) => void }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  if (sqlAnalysis.length === 0) return <EmptyState icon={Code2} title="No SQL Issues" subtitle="No problematic queries were identified." />;
  return (
    <div className="space-y-3">
      {sqlAnalysis.map((sq, i) => (
        <div key={i} className="border border-border rounded-xl overflow-hidden bg-card">
          <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3 text-left">
              <Code2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div><p className="text-sm font-bold text-foreground">{sq.sqlId}</p><p className="text-[10px] text-muted-foreground">{sq.currentTime} avg · {sq.problem.slice(0, 80)}</p></div>
            </div>
            {expanded === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expanded === i && (
            <div className="px-5 pb-4 space-y-3 border-t border-border/50 pt-3">
              <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">SQL</p><pre className="px-3 py-2 bg-slate-50 dark:bg-slate-900/70 border border-border rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">{sq.sqlText}</pre></div>
              <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Problem</p><p className="text-xs text-foreground">{sq.problem}</p></div>
              <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Recommendation</p><p className="text-xs text-foreground">{sq.recommendation}</p></div>
              {sq.suggestedRewrite && (
                <div>
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold text-emerald-600 uppercase">Suggested Rewrite</p><button onClick={() => copyText(sq.suggestedRewrite!, setCopied, `sql-rw-${i}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `sql-rw-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}</button></div>
                  <pre className="px-3 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">{sq.suggestedRewrite}</pre>
                </div>
              )}
              {sq.indexRecommendation && (
                <div>
                  <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold text-amber-600 uppercase">Index Recommendation</p><button onClick={() => copyText(sq.indexRecommendation!, setCopied, `sql-idx-${i}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `sql-idx-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}</button></div>
                  <pre className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">{sq.indexRecommendation}</pre>
                </div>
              )}
              <p className="text-xs text-emerald-600 font-medium">Estimated: {sq.estimatedImprovement}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WaitEventsTab({ waitEvents }: { waitEvents: AWRAnalysisResult['waitEventAnalysis'] }) {
  if (waitEvents.length === 0) return <EmptyState icon={Clock} title="No Wait Event Issues" subtitle="No significant wait events were detected." />;
  const chartData = waitEvents.map(w => ({ name: w.event.length > 25 ? w.event.slice(0, 22) + '...' : w.event, severity: w.severity === 'critical' ? 4 : w.severity === 'high' ? 3 : w.severity === 'medium' ? 2 : 1, fill: w.severity === 'critical' ? '#ef4444' : w.severity === 'high' ? '#f97316' : w.severity === 'medium' ? '#f59e0b' : '#3b82f6' }));
  return (
    <div className="space-y-4">
      {chartData.length > 1 && (
        <div className="border border-border rounded-xl p-4">
          <h5 className="text-xs font-bold text-foreground mb-3">Wait Event Severity</h5>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" domain={[0, 4]} ticks={[1, 2, 3, 4]} tickFormatter={v => ['', 'Low', 'Med', 'High', 'Crit'][v]} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={180} />
              <Tooltip formatter={(v: number) => [['', 'Low', 'Medium', 'High', 'Critical'][v], 'Severity']} />
              <Bar dataKey="severity" radius={[0, 4, 4, 0]}>{chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {waitEvents.map((w, i) => {
        const cfg = SEVERITY_CONFIG[w.severity]; const SIcon = cfg.icon;
        return (
          <div key={i} className={cn('border rounded-xl p-4', cfg.border, cfg.bg)}>
            <div className="flex items-start gap-3">
              <SIcon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', cfg.color)} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1"><h4 className="text-sm font-bold text-foreground">{w.event}</h4><span className={cn('px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full border', cfg.color, cfg.bg, cfg.border)}>{w.severity}</span></div>
                <p className="text-xs text-foreground/80 leading-relaxed">{w.interpretation}</p>
                <div className="mt-2 px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg border border-border/50"><p className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">Recommendation</p><p className="text-xs text-foreground">{w.recommendation}</p></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationsTab({ recs, indexRecs, copiedField, setCopied }: { recs: AWRAnalysisResult['recommendations']; indexRecs: AWRAnalysisResult['indexRecommendations']; copiedField: string | null; setCopied: (v: string | null) => void }) {
  if (recs.length === 0 && indexRecs.length === 0) return <EmptyState icon={Lightbulb} title="No Recommendations" subtitle="No tuning recommendations at this time." />;
  const grouped = { immediate: recs.filter(r => r.priority === 'immediate'), 'short-term': recs.filter(r => r.priority === 'short-term'), 'long-term': recs.filter(r => r.priority === 'long-term') };
  return (
    <div className="space-y-5">
      {(Object.entries(grouped) as [keyof typeof PRIORITY_CONFIG, typeof recs][]).map(([priority, items]) => {
        if (items.length === 0) return null;
        const cfg = PRIORITY_CONFIG[priority];
        return (
          <div key={priority}>
            <h4 className={cn('inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border mb-3', cfg.color)}>
              {priority === 'immediate' ? <Zap className="w-3.5 h-3.5" /> : priority === 'short-term' ? <TrendingUp className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {cfg.label} ({items.length})
            </h4>
            <div className="space-y-3">
              {items.map((rec, i) => {
                const CatIcon = CATEGORY_ICONS[rec.category] || Lightbulb;
                return (
                  <div key={i} className="border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2"><CatIcon className="w-4 h-4 text-violet-500" /><h5 className="text-sm font-bold text-foreground">{rec.title}</h5><span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded uppercase">{rec.category}</span></div>
                      <span className="text-[10px] font-medium text-emerald-600">{rec.estimatedImpact}</span>
                    </div>
                    <div className="px-5 py-3 space-y-2">
                      <p className="text-xs text-foreground">{rec.description}</p>
                      {rec.implementation && (
                        <div>
                          <div className="flex items-center justify-between mb-1"><p className="text-[10px] font-bold text-violet-600 uppercase">Implementation</p><button onClick={() => copyText(rec.implementation, setCopied, `rec-${priority}-${i}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `rec-${priority}-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}</button></div>
                          <pre className="px-3 py-2 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">{rec.implementation}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {indexRecs.length > 0 && (
        <div>
          <h4 className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 mb-3"><Layers className="w-3.5 h-3.5" /> Index Recommendations ({indexRecs.length})</h4>
          <div className="space-y-3">
            {indexRecs.map((idx, i) => (
              <div key={i} className="border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div><h5 className="text-sm font-bold text-foreground">{idx.table} <span className="text-emerald-600">({idx.columns.join(', ')})</span></h5><p className="text-xs text-muted-foreground mt-1">{idx.reason}</p></div>
                  <button onClick={() => copyText(idx.createStatement, setCopied, `idx-${i}`)} className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-3">{copiedField === `idx-${i}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
                </div>
                <pre className="mt-2 px-3 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg text-xs font-mono overflow-x-auto">{idx.createStatement}</pre>
                <p className="text-xs text-emerald-600 font-medium mt-1">{idx.estimatedImprovement}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RawMetricsTab({ metrics }: { metrics: Record<string, unknown> }) {
  const [collapsed, setCollapsed] = useState(true);
  const json = JSON.stringify(metrics, null, 2);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase">Parsed Metrics (sent to AI)</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{Math.round(json.length / 1024)}KB</span>
          <button onClick={() => setCollapsed(!collapsed)} className="text-xs text-violet-600 hover:text-violet-700 font-medium">{collapsed ? 'Expand All' : 'Collapse'}</button>
        </div>
      </div>
      <pre className={cn('px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border border-border rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap', collapsed ? 'max-h-[400px] overflow-y-auto' : '')}>{json}</pre>
    </div>
  );
}

function CompareResultPanel({ result }: { result: AWRCompareResult }) {
  const c = result.comparison;
  const verdictConfig = { improved: { color: 'text-emerald-700', bg: 'bg-emerald-50', icon: TrendingUp, label: 'Improved' }, regressed: { color: 'text-red-700', bg: 'bg-red-50', icon: TrendingDown, label: 'Regressed' }, unchanged: { color: 'text-slate-700', bg: 'bg-slate-50', icon: Activity, label: 'Unchanged' }, mixed: { color: 'text-amber-700', bg: 'bg-amber-50', icon: GitCompare, label: 'Mixed' } };
  const vCfg = verdictConfig[c.overallVerdict] || verdictConfig.mixed;
  const VIcon = vCfg.icon;
  return (
    <div className="space-y-4">
      <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg border', vCfg.bg)}>
        <VIcon className={cn('w-5 h-5', vCfg.color)} /><div><p className={cn('text-sm font-bold', vCfg.color)}>{vCfg.label}</p><p className="text-xs text-foreground mt-0.5">{c.headline}</p></div>
        {c.healthScoreBefore > 0 && (<div className="ml-auto text-right"><p className="text-xs text-muted-foreground">Health Score</p><p className="text-sm font-bold"><span className="text-red-600">{c.healthScoreBefore}</span><ArrowRight className="w-3 h-3 inline mx-1" /><span className="text-emerald-600">{c.healthScoreAfter}</span></p></div>)}
      </div>
      {c.improvements?.length > 0 && (<div><p className="text-xs font-bold text-emerald-600 uppercase mb-2">Improvements ({c.improvements.length})</p>{c.improvements.map((item, i) => (<div key={i} className="flex items-start gap-2 mb-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /><p className="text-xs text-foreground"><strong>{item.area}:</strong> {item.description}</p></div>))}</div>)}
      {c.regressions?.length > 0 && (<div><p className="text-xs font-bold text-red-600 uppercase mb-2">Regressions ({c.regressions.length})</p>{c.regressions.map((item, i) => (<div key={i} className="flex items-start gap-2 mb-1.5"><TrendingDown className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" /><p className="text-xs text-foreground"><strong>{item.area}:</strong> {item.description}</p></div>))}</div>)}
      {c.recommendations?.length > 0 && (<div><p className="text-xs font-bold text-violet-600 uppercase mb-2">Recommendations</p>{c.recommendations.map((rec, i) => (<div key={i} className="flex items-start gap-2 mb-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" /><p className="text-xs text-foreground">{rec}</p></div>))}</div>)}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: typeof CheckCircle2; title: string; subtitle: string }) {
  return (<div className="flex flex-col items-center justify-center py-16"><Icon className="w-12 h-12 text-emerald-400 mb-3" /><p className="text-sm font-semibold text-foreground">{title}</p><p className="text-xs text-muted-foreground mt-1">{subtitle}</p></div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF EXPORT — Professional multi-page report
// ═══════════════════════════════════════════════════════════════════════════════

function generateAWRPDF(result: AWRFullResult) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;
  const a = result.analysis;

  const checkPage = (needed: number) => { if (y + needed > pageH - 20) { doc.addPage(); y = margin; } };
  const drawLine = (yPos: number, color = [220, 220, 220]) => { doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(0.3); doc.line(margin, yPos, pageW - margin, yPos); };
  const drawRect = (x: number, yPos: number, w: number, h: number, fill: number[]) => { doc.setFillColor(fill[0], fill[1], fill[2]); doc.roundedRect(x, yPos, w, h, 2, 2, 'F'); };

  const writeWrapped = (text: string, x: number, maxW: number, fontSize: number, font: 'helvetica' | 'courier' = 'helvetica', style: 'normal' | 'bold' | 'italic' = 'normal', color = [50, 50, 50]) => {
    doc.setFontSize(fontSize); doc.setFont(font, style); doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxW);
    const lineHeight = fontSize * 0.42;
    for (const line of lines) { checkPage(lineHeight + 1); doc.text(line, x, y); y += lineHeight; }
  };

  // ── Title Block ──
  drawRect(margin, y - 4, contentW, 22, [109, 40, 217]);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('AI Database Report Analysis', margin + 5, y + 4);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Aqua DB Copilot — Enterprise Database Performance Analytics', margin + 5, y + 10);
  y += 22;

  // Meta row
  y += 3; doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
  const metaParts = [
    `Generated: ${new Date().toLocaleString()}`, `Type: ${result.parseResult.reportType.toUpperCase()}`, `DB: ${result.parseResult.database}`,
    `File: ${result.parseResult.fileSizeKB}KB`, result.parseResult.lineCount ? `Lines: ${result.parseResult.lineCount.toLocaleString()}` : '',
    `Model: ${result.model}`, `Tokens: ${(result.usage.inputTokens + result.usage.outputTokens).toLocaleString()}`,
    result.analysisTimeMs ? `Time: ${result.analysisTimeMs >= 1000 ? (result.analysisTimeMs / 1000).toFixed(1) + 's' : result.analysisTimeMs + 'ms'}` : '',
  ].filter(Boolean);
  doc.text(metaParts.join('  |  '), margin, y);
  y += 6; drawLine(y); y += 5;

  // ── Health Score ──
  const hColor = a.summary.healthScore >= 80 ? [16, 185, 129] : a.summary.healthScore >= 60 ? [245, 158, 11] : [239, 68, 68];
  const bgColor = a.summary.healthScore >= 80 ? [240, 253, 244] : a.summary.healthScore >= 60 ? [255, 251, 235] : [254, 242, 242];
  drawRect(margin, y - 3, contentW, 16, bgColor);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(hColor[0], hColor[1], hColor[2]);
  doc.text(`${a.summary.healthScore}`, margin + 5, y + 5);
  doc.setFontSize(10); doc.text(`/ 100  —  ${a.summary.healthRating.toUpperCase()}`, margin + 22, y + 5);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
  if (a.summary.timeRange) doc.text(a.summary.timeRange, margin + 5, y + 10);
  y += 17;

  writeWrapped(a.summary.headline, margin, contentW, 10, 'helvetica', 'bold', [30, 30, 30]);
  y += 3;

  // Key Findings
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217); doc.text('KEY FINDINGS', margin, y); y += 4;
  for (const f of a.summary.keyFindings) { checkPage(8); drawRect(margin, y - 2.5, 1.5, 1.5, [109, 40, 217]); writeWrapped(f, margin + 5, contentW - 5, 8, 'helvetica', 'normal', [60, 60, 60]); y += 1; }
  y += 4;

  // ── Root Causes ──
  if (a.rootCause.length > 0) {
    checkPage(15); drawLine(y); y += 5;
    drawRect(margin, y - 3, contentW, 8, [254, 242, 242]);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38);
    doc.text(`ROOT CAUSES (${a.rootCause.length})`, margin + 3, y + 1.5); y += 8;
    for (const rc of a.rootCause) {
      checkPage(18);
      const sevColor = rc.severity === 'critical' ? [220, 38, 38] : rc.severity === 'high' ? [234, 88, 12] : rc.severity === 'medium' ? [202, 138, 4] : [59, 130, 246];
      const sevBg = rc.severity === 'critical' ? [254, 242, 242] : rc.severity === 'high' ? [255, 247, 237] : rc.severity === 'medium' ? [254, 252, 232] : [239, 246, 255];
      drawRect(margin, y - 2.5, 22, 5, sevColor); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(rc.severity.toUpperCase(), margin + 2, y + 0.5);
      drawRect(margin + 24, y - 2.5, 16, 5, [226, 232, 240]); doc.setTextColor(71, 85, 105); doc.text(rc.affectedArea, margin + 25.5, y + 0.5);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.text(rc.primaryCause, margin + 44, y + 0.5); y += 5;
      writeWrapped(rc.explanation, margin + 3, contentW - 6, 8, 'helvetica', 'normal', [70, 70, 70]); y += 1;
      if (rc.evidence.length > 0) {
        drawRect(margin + 3, y - 2, contentW - 6, rc.evidence.length * 3.8 + 3, sevBg);
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100); doc.text('EVIDENCE:', margin + 5, y + 0.5); y += 3;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
        for (const ev of rc.evidence) { doc.setFontSize(7); const evLines = doc.splitTextToSize(`• ${ev}`, contentW - 14); doc.text(evLines[0], margin + 5, y); y += 3.5; }
      }
      y += 3;
    }
  }

  // ── SQL Analysis ──
  if (a.sqlAnalysis.length > 0) {
    checkPage(15); drawLine(y); y += 5;
    drawRect(margin, y - 3, contentW, 8, [239, 246, 255]);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(37, 99, 235);
    doc.text(`SQL ANALYSIS (${a.sqlAnalysis.length})`, margin + 3, y + 1.5); y += 9;
    for (const sq of a.sqlAnalysis) {
      checkPage(25);
      drawRect(margin, y - 2.5, contentW, 7, [241, 245, 249]);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.text(`SQL ID: ${sq.sqlId}`, margin + 3, y + 1);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100); doc.text(sq.currentTime, pageW - margin - 3 - doc.getTextWidth(sq.currentTime), y + 1); y += 8;
      doc.setFontSize(7); doc.setFont('courier', 'normal'); doc.setTextColor(80, 80, 80);
      const sqlLines = doc.splitTextToSize(sq.sqlText, contentW - 8);
      drawRect(margin + 2, y - 2.5, contentW - 4, Math.min(sqlLines.length, 3) * 3 + 2, [248, 250, 252]);
      for (let li = 0; li < Math.min(sqlLines.length, 3); li++) { doc.text(sqlLines[li], margin + 4, y); y += 3; }
      if (sqlLines.length > 3) { doc.text('...', margin + 4, y); y += 3; } y += 1;
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); doc.text('PROBLEM:', margin + 3, y); y += 3;
      writeWrapped(sq.problem, margin + 3, contentW - 6, 8, 'helvetica', 'normal', [70, 70, 70]); y += 1;
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(16, 185, 129); doc.text('RECOMMENDATION:', margin + 3, y); y += 3;
      writeWrapped(sq.recommendation, margin + 3, contentW - 6, 8, 'helvetica', 'normal', [70, 70, 70]); y += 1;
      if (sq.indexRecommendation) { checkPage(8); drawRect(margin + 2, y - 2, contentW - 4, 7, [240, 253, 244]); doc.setFontSize(7); doc.setFont('courier', 'normal'); doc.setTextColor(5, 150, 105); const idxLines = doc.splitTextToSize(sq.indexRecommendation, contentW - 10); doc.text(idxLines[0], margin + 4, y + 0.5); if (idxLines.length > 1) doc.text(idxLines[1], margin + 4, y + 3.5); y += Math.min(idxLines.length, 2) * 3.5 + 2; }
      if (sq.estimatedImprovement) { doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(16, 185, 129); doc.text(`Expected: ${sq.estimatedImprovement}`, margin + 3, y); y += 4; }
      y += 3;
    }
  }

  // ── Recommendations ──
  if (a.recommendations.length > 0) {
    checkPage(15); drawLine(y); y += 5;
    drawRect(margin, y - 3, contentW, 8, [255, 251, 235]);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(202, 138, 4);
    doc.text(`RECOMMENDATIONS (${a.recommendations.length})`, margin + 3, y + 1.5); y += 9;
    for (const rec of a.recommendations) {
      checkPage(20);
      const prColor = rec.priority === 'immediate' ? [220, 38, 38] : rec.priority === 'short-term' ? [202, 138, 4] : [59, 130, 246];
      drawRect(margin, y - 2.5, 20, 5, prColor); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(rec.priority.toUpperCase(), margin + 1.5, y + 0.5);
      drawRect(margin + 22, y - 2.5, 16, 5, [226, 232, 240]); doc.setTextColor(71, 85, 105); doc.text(rec.category.toUpperCase(), margin + 23.5, y + 0.5);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.text(rec.title, margin + 42, y + 0.5); y += 5;
      writeWrapped(rec.description, margin + 3, contentW - 6, 8, 'helvetica', 'normal', [70, 70, 70]); y += 1;
      if (rec.implementation) {
        checkPage(12); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217); doc.text('IMPLEMENTATION:', margin + 3, y); y += 3;
        const implLines = doc.splitTextToSize(rec.implementation, contentW - 10).slice(0, 6);
        drawRect(margin + 2, y - 2.5, contentW - 4, implLines.length * 3.2 + 2, [245, 243, 255]);
        doc.setFontSize(7); doc.setFont('courier', 'normal'); doc.setTextColor(88, 28, 135);
        for (const line of implLines) { doc.text(line, margin + 4, y); y += 3.2; } y += 1;
      }
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(16, 185, 129); doc.text(`Impact: ${rec.estimatedImpact}`, margin + 3, y); y += 5;
    }
  }

  // ── Index Recommendations ──
  if (a.indexRecommendations.length > 0) {
    checkPage(15); drawLine(y); y += 5;
    drawRect(margin, y - 3, contentW, 8, [240, 253, 244]);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(5, 150, 105);
    doc.text(`INDEX RECOMMENDATIONS (${a.indexRecommendations.length})`, margin + 3, y + 1.5); y += 9;
    for (const idx of a.indexRecommendations) {
      checkPage(15); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.text(idx.table, margin + 3, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(5, 150, 105); doc.text(`(${idx.columns.join(', ')})`, margin + 3 + doc.getTextWidth(idx.table + ' '), y); y += 4;
      writeWrapped(idx.reason, margin + 3, contentW - 6, 8, 'helvetica', 'normal', [80, 80, 80]); y += 1;
      drawRect(margin + 2, y - 2, contentW - 4, 7, [240, 253, 244]); doc.setFontSize(7.5); doc.setFont('courier', 'normal'); doc.setTextColor(5, 120, 80);
      const cLines = doc.splitTextToSize(idx.createStatement, contentW - 10); doc.text(cLines[0], margin + 4, y + 0.5); if (cLines.length > 1) doc.text(cLines[1], margin + 4, y + 3.5);
      y += Math.min(cLines.length, 2) * 3.5 + 2;
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(16, 185, 129); doc.text(`Expected: ${idx.estimatedImprovement}`, margin + 3, y); y += 5;
    }
  }

  // ── Wait Events ──
  if (a.waitEventAnalysis.length > 0) {
    checkPage(15); drawLine(y); y += 5;
    drawRect(margin, y - 3, contentW, 8, [255, 251, 235]);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 83, 9);
    doc.text(`WAIT EVENTS (${a.waitEventAnalysis.length})`, margin + 3, y + 1.5); y += 9;
    for (const w of a.waitEventAnalysis) {
      checkPage(15);
      const sevColor = w.severity === 'critical' ? [220, 38, 38] : w.severity === 'high' ? [234, 88, 12] : w.severity === 'medium' ? [202, 138, 4] : [59, 130, 246];
      drawRect(margin, y - 2.5, 18, 5, sevColor); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(w.severity.toUpperCase(), margin + 1.5, y + 0.5);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.text(w.event, margin + 22, y + 0.5); y += 5;
      writeWrapped(w.interpretation, margin + 3, contentW - 6, 8, 'helvetica', 'normal', [70, 70, 70]); y += 1;
      writeWrapped(`Recommendation: ${w.recommendation}`, margin + 3, contentW - 6, 8, 'helvetica', 'italic', [5, 150, 105]); y += 3;
    }
  }

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(109, 40, 217); doc.setLineWidth(0.5); doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
    doc.text('Aqua DB Copilot — AI Report Analysis', margin, pageH - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin - doc.getTextWidth(`Page ${p} of ${totalPages}`), pageH - 8);
  }

  doc.save(`report-analysis-${result.parseResult.reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
