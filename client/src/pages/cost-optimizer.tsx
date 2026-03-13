import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  DollarSign, TrendingDown, Activity, Server, Database, HardDrive,
  AlertTriangle, CheckCircle2, ChevronRight, Plus, Trash2, Loader2,
  FileText, Zap, ArrowRight, RefreshCw, Eye, BarChart3, Search,
  Archive, ListChecks, Gauge, PieChart, ArrowDownRight, Clock,
  Layers, Target, Settings, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCostAssessments, useCreateCostAssessment, useDeleteCostAssessment, useAnalyzeCost,
  type CostAssessment, type CostAnalysis, type CloudConfig, type QueryPatterns,
  type StorageProfile, type IndexProfile,
} from '@/hooks/use-cost-optimizer';

// ── Constants ────────────────────────────────────────────────────────

const CLOUD_PROVIDERS = ['AWS', 'Azure', 'GCP', 'Oracle Cloud', 'On-Premise', 'Snowflake', 'Databricks'];
const CLOUD_SERVICES = ['RDS', 'Aurora', 'Redshift', 'BigQuery', 'Cloud SQL', 'Azure SQL', 'Snowflake', 'Self-Managed'];
const INSTANCE_TYPES = ['db.t3.medium', 'db.t3.large', 'db.r6g.large', 'db.r6g.xlarge', 'db.r6g.2xlarge', 'db.r6g.4xlarge', 'db.r5.2xlarge', 'db.m6g.xlarge', 'db.m6g.2xlarge', 'custom'];

type ViewMode = 'list' | 'form' | 'results';
type ResultTab = 'summary' | 'breakdown' | 'queries' | 'storage' | 'rightsizing' | 'actions';

const RESULT_TABS: { id: ResultTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'summary', label: 'Executive Summary', icon: FileText },
  { id: 'breakdown', label: 'Cost Breakdown', icon: PieChart },
  { id: 'queries', label: 'Query Costs', icon: Search },
  { id: 'storage', label: 'Storage & Indexes', icon: HardDrive },
  { id: 'rightsizing', label: 'Right-Sizing', icon: Gauge },
  { id: 'actions', label: 'Action Plan', icon: ListChecks },
];

function formatCurrency(v: number) { return `$${v.toLocaleString()}`; }

function getPriorityColor(p: string) {
  const u = p?.toUpperCase();
  if (u === 'CRITICAL' || u === 'QUICK_WIN') return 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
  if (u === 'HIGH' || u === 'SHORT_TERM') return 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
  if (u === 'MEDIUM') return 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
}

function getRiskBadge(r: string) {
  if (r === 'LOW') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (r === 'MEDIUM') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

// ── Sample Data ─────────────────────────────────────────────────────

const SAMPLE_FORM = {
  name: 'Fintech Production DB — Monthly Cost Review',
  cloud: { provider: 'AWS', service: 'Aurora', instanceType: 'db.r6g.2xlarge', region: 'ap-south-1', monthlyCost: 18500, storageGB: 2400, computeHours: 730, reservedInstances: false, multiAZ: true, readReplicas: 2 } as CloudConfig,
  queries: { topQueries: [
    { description: 'Daily transaction aggregation report', frequency: '24/day', avgDuration: '45s', scanType: 'full_table_scan' },
    { description: 'Customer KYC lookup by PAN', frequency: '15000/day', avgDuration: '120ms', scanType: 'index_scan' },
    { description: 'Monthly settlement reconciliation', frequency: '30/month', avgDuration: '180s', scanType: 'full_table_scan' },
    { description: 'Real-time fraud detection scoring', frequency: '50000/day', avgDuration: '15ms', scanType: 'index_scan' },
    { description: 'Analytics dashboard rollup', frequency: '500/day', avgDuration: '8s', scanType: 'full_table_scan' },
  ], avgQueryCost: 0.02, fullTableScans: 12, queryVolume: 850000, peakHours: '09:00-17:00 IST', slowQueryThreshold: '2s' } as QueryPatterns,
  storage: { totalStorageGB: 2400, dataGrowthRateGB: 80, unusedTables: 'audit_log_2022, session_archive_old, temp_migration_data, payment_log_backup', largestTables: 'transactions (680GB), audit_logs (420GB), event_stream (310GB), customer_profiles (180GB)', archiveCandidates: 'transactions older than 2 years, audit_logs older than 18 months, event_stream older than 1 year', compressionEnabled: false } as StorageProfile,
  indexes: { totalIndexes: 285, unusedIndexes: 42, duplicateIndexes: 18, missingIndexes: 8, indexSizeGB: 180 } as IndexProfile,
};

const SAMPLE_ANALYSIS: CostAnalysis = {
  executiveSummary: {
    currentMonthlyCost: 18500,
    estimatedMonthlySavings: 7850,
    savingsPercentage: 42,
    annualSavingsProjection: 94200,
    headline: 'Your fintech database is 42% over-budget — $7,850/month in savings identified through right-sizing, storage optimization, and query tuning.',
    topCostDrivers: [
      { driver: 'Over-provisioned compute (db.r6g.2xlarge at 28% avg CPU)', monthlyCost: 6200, percentage: 33, category: 'compute' },
      { driver: 'Uncompressed storage (2.4TB without compression)', monthlyCost: 4800, percentage: 26, category: 'storage' },
      { driver: 'Full table scans on analytics queries', monthlyCost: 3500, percentage: 19, category: 'io' },
      { driver: 'Under-utilized second read replica', monthlyCost: 2100, percentage: 11, category: 'compute' },
      { driver: 'No reserved instance commitment (On-Demand pricing)', monthlyCost: 1900, percentage: 10, category: 'compute' },
    ],
    quickWins: [
      { action: 'Enable Aurora table compression (LZ4) for cold tables', monthlySavings: 1200, effort: 'LOW', timeframe: '1-2 days' },
      { action: 'Drop 42 unused indexes (180GB index overhead)', monthlySavings: 850, effort: 'LOW', timeframe: '1 day' },
      { action: 'Archive audit_log_2022 and session_archive_old to S3', monthlySavings: 650, effort: 'LOW', timeframe: '2-3 days' },
      { action: 'Convert to 1-year Reserved Instance', monthlySavings: 1900, effort: 'LOW', timeframe: '30 minutes' },
    ],
  },
  costBreakdown: {
    categories: [
      { name: 'Compute (Primary + Replicas)', currentCost: 8300, optimizedCost: 4600, savings: 3700, percentage: 45 },
      { name: 'Storage (Aurora)', currentCost: 4800, optimizedCost: 2900, savings: 1900, percentage: 26 },
      { name: 'I/O Operations', currentCost: 3500, optimizedCost: 1800, savings: 1700, percentage: 19 },
      { name: 'Backup & Snapshots', currentCost: 1200, optimizedCost: 900, savings: 300, percentage: 6 },
      { name: 'Data Transfer', currentCost: 700, optimizedCost: 450, savings: 250, percentage: 4 },
    ],
    byTable: [
      { tableName: 'transactions', estimatedCost: 5200, costDrivers: ['Largest table (680GB)', 'Full scans for monthly reports', 'No partitioning'], savingsPotential: 2800 },
      { tableName: 'audit_logs', estimatedCost: 3100, costDrivers: ['420GB with 18+ months of data', 'Rarely queried old records', 'Sequential scans'], savingsPotential: 1900 },
      { tableName: 'event_stream', estimatedCost: 2400, costDrivers: ['310GB append-only data', 'No compression', 'Dashboard rollup scans'], savingsPotential: 1400 },
      { tableName: 'customer_profiles', estimatedCost: 1800, costDrivers: ['180GB with redundant indexes', 'Over-indexed for write workload'], savingsPotential: 600 },
    ],
    wasteIdentification: [
      { type: 'unused_table', description: 'audit_log_2022: 85GB table not queried since Jan 2023', monthlyCost: 170, recommendation: 'Export to S3 Glacier and drop table' },
      { type: 'unused_table', description: 'session_archive_old: 42GB legacy migration artifact', monthlyCost: 84, recommendation: 'Verify no dependencies, then drop' },
      { type: 'unused_table', description: 'temp_migration_data: 28GB temporary data from 2023 migration', monthlyCost: 56, recommendation: 'Drop immediately — migration completed' },
      { type: 'redundant_index', description: '18 duplicate indexes adding 45GB of write overhead', monthlyCost: 380, recommendation: 'Identify superseded indexes and drop duplicates' },
      { type: 'over_provisioned', description: 'Second read replica handling only 4% of query traffic', monthlyCost: 2100, recommendation: 'Consolidate to single read replica or remove' },
      { type: 'stale_data', description: '1.2TB of transaction data older than 2 years (rarely accessed)', monthlyCost: 720, recommendation: 'Partition by date and archive to S3' },
    ],
  },
  queryCostAnalysis: {
    expensiveQueries: [
      { description: 'Daily transaction aggregation report', estimatedMonthlyCost: 1800, frequency: '24/day', issue: 'full_table_scan', currentBehavior: 'Scans entire 680GB transactions table for daily SUM/GROUP BY on event_date', optimization: 'Add date-based partitioning on transactions table and create covering index on (event_date, amount, status)', estimatedSavings: 1400, sqlHint: 'ALTER TABLE transactions PARTITION BY RANGE (event_date); CREATE INDEX idx_txn_date_amt ON transactions(event_date, amount, status);' },
      { description: 'Monthly settlement reconciliation', estimatedMonthlyCost: 900, frequency: '30/month', issue: 'full_table_scan', currentBehavior: 'Cross-joins transactions with settlements table (both > 100GB) for monthly reconciliation', optimization: 'Pre-aggregate daily totals into a materialized view, run reconciliation against the summary', estimatedSavings: 750, sqlHint: 'CREATE MATERIALIZED VIEW mv_daily_settlements AS SELECT date_trunc(\'day\', created_at), SUM(amount) FROM transactions GROUP BY 1;' },
      { description: 'Analytics dashboard rollup', estimatedMonthlyCost: 650, frequency: '500/day', issue: 'full_table_scan', currentBehavior: 'Scans event_stream (310GB) for real-time dashboard aggregations', optimization: 'Create pre-computed rollup table updated via trigger or scheduled job every 5 minutes', estimatedSavings: 500, sqlHint: 'CREATE TABLE dashboard_rollup AS SELECT date_trunc(\'hour\', ts), event_type, COUNT(*), SUM(value) FROM event_stream GROUP BY 1,2;' },
      { description: 'Customer KYC lookup', estimatedMonthlyCost: 350, frequency: '15000/day', issue: 'missing_index', currentBehavior: 'Looks up by PAN number but index only covers (customer_id) — secondary lookup needed', optimization: 'Add composite index on (pan_number, customer_id, kyc_status)', estimatedSavings: 200, sqlHint: 'CREATE INDEX idx_customer_pan ON customer_profiles(pan_number) INCLUDE (customer_id, kyc_status);' },
    ],
    fullTableScans: [
      { table: 'transactions', queryPattern: 'GROUP BY event_date without partition pruning', estimatedCost: 1800, fix: 'Partition by event_date (monthly ranges)' },
      { table: 'event_stream', queryPattern: 'Dashboard aggregation on unpartitioned append-only table', estimatedCost: 650, fix: 'Create rollup table or partition by day' },
      { table: 'audit_logs', queryPattern: 'Compliance reports scanning 18 months of data', estimatedCost: 450, fix: 'Partition by month, archive data > 12 months' },
    ],
  },
  storageOptimization: {
    currentStorageGB: 2400, optimizedStorageGB: 1450, storageSavings: 950,
    recommendations: [
      { type: 'archive', target: 'Transactions older than 2 years', currentSizeGB: 480, savingGB: 460, monthlySavings: 460, implementation: 'Export to S3 via AWS DMS, partition remaining data by month, update application queries', risk: 'MEDIUM' },
      { type: 'compress', target: 'Enable LZ4 compression on cold tables', currentSizeGB: 1200, savingGB: 360, monthlySavings: 360, implementation: 'ALTER TABLE ... SET (compression=lz4) — Aurora performs online compression during next compact', risk: 'LOW' },
      { type: 'delete', target: 'Drop unused tables (audit_log_2022, session_archive_old, temp_migration_data)', currentSizeGB: 155, savingGB: 155, monthlySavings: 310, implementation: 'Verify zero query traffic via pg_stat_user_tables, export to S3 as safety net, then DROP TABLE', risk: 'LOW' },
      { type: 'partition', target: 'Partition event_stream by day', currentSizeGB: 310, savingGB: 0, monthlySavings: 200, implementation: 'Create partitioned table, migrate data with pg_partman, enables partition pruning for time-range queries', risk: 'MEDIUM' },
    ],
    unusedTables: [
      { tableName: 'audit_log_2022', sizeGB: 85, lastAccessed: '2023-01-15', monthlyCost: 170, recommendation: 'archive' },
      { tableName: 'session_archive_old', sizeGB: 42, lastAccessed: '2023-06-20', monthlyCost: 84, recommendation: 'drop' },
      { tableName: 'temp_migration_data', sizeGB: 28, lastAccessed: '2023-09-01', monthlyCost: 56, recommendation: 'drop' },
      { tableName: 'payment_log_backup', sizeGB: 65, lastAccessed: '2024-03-10', monthlyCost: 130, recommendation: 'archive' },
    ],
  },
  indexOptimization: {
    unusedIndexes: [
      { indexName: 'idx_txn_old_status', tableName: 'transactions', sizeGB: 12, writeOverhead: '8% slower inserts', recommendation: 'DROP INDEX idx_txn_old_status;', monthlySavings: 95 },
      { indexName: 'idx_audit_user_old', tableName: 'audit_logs', sizeGB: 8, writeOverhead: '5% slower inserts', recommendation: 'DROP INDEX idx_audit_user_old;', monthlySavings: 65 },
      { indexName: 'idx_event_legacy_type', tableName: 'event_stream', sizeGB: 6, writeOverhead: '12% slower inserts', recommendation: 'DROP INDEX idx_event_legacy_type;', monthlySavings: 70 },
    ],
    duplicateIndexes: [
      { indexes: ['idx_customer_email', 'idx_customer_email_lower'], tableName: 'customer_profiles', recommendation: 'Keep idx_customer_email_lower (case-insensitive), drop idx_customer_email', monthlySavings: 45 },
      { indexes: ['idx_txn_created', 'idx_txn_created_status'], tableName: 'transactions', recommendation: 'Keep idx_txn_created_status (superset), drop idx_txn_created', monthlySavings: 80 },
    ],
    missingIndexes: [
      { tableName: 'customer_profiles', columns: ['pan_number'], reason: 'KYC lookups cause 15K daily sequential scans', createStatement: 'CREATE INDEX idx_customer_pan ON customer_profiles(pan_number) INCLUDE (customer_id, kyc_status);', estimatedSavings: 200 },
      { tableName: 'transactions', columns: ['merchant_id', 'created_at'], reason: 'Merchant settlement queries lack efficient access path', createStatement: 'CREATE INDEX idx_txn_merchant_date ON transactions(merchant_id, created_at DESC);', estimatedSavings: 350 },
    ],
  },
  rightSizing: {
    compute: { currentInstance: 'db.r6g.2xlarge (8 vCPU, 64GB RAM)', recommendedInstance: 'db.r6g.xlarge (4 vCPU, 32GB RAM)', currentCost: 3100, recommendedCost: 1550, monthlySavings: 1550, justification: 'Average CPU utilization: 28%, peak: 52%. Memory usage: 18GB average out of 64GB. An xlarge instance handles this comfortably with headroom for 2x traffic growth.', risk: 'LOW' },
    reservedInstances: { currentCommitment: 'On-Demand', recommendedCommitment: '1-Year All Upfront Reserved Instance', monthlySavings: 1900, upfrontCost: 13200, breakEvenMonths: 3, justification: 'Database has been running continuously for 18+ months with 99.9% uptime. Stable workload makes 1-year RI the optimal commitment. 3-month payback period.' },
    storageTier: { currentTier: 'Aurora Standard (gp3-equivalent)', recommendation: 'Move archived/cold data to S3 Standard-IA + Glacier for compliance retention', monthlySavings: 480, details: 'Approximately 40% of storage (960GB) is cold data accessed < 1 time/month. Moving to S3 Standard-IA saves 85% on storage costs for this tier.' },
    readReplicas: { current: 2, recommended: 1, monthlySavings: 2100, justification: 'Read replica #2 handles only 4.2% of total read traffic (mostly monitoring queries). Consolidating to 1 replica saves a full instance cost. Consider Aurora Auto Scaling for peak handling.' },
  },
  actionPlan: [
    { priority: 1, category: 'QUICK_WIN', title: 'Convert to Reserved Instance', description: 'Switch primary Aurora instance from On-Demand to 1-Year All Upfront RI. Zero downtime, immediate savings.', monthlySavings: 1900, effort: 'LOW', risk: 'LOW', timeline: '30 minutes', implementation: '1. Go to AWS RDS Console → Reserved Instances\n2. Purchase db.r6g.xlarge 1-Year All Upfront for ap-south-1\n3. RI automatically applies to matching instance' },
    { priority: 2, category: 'QUICK_WIN', title: 'Right-size primary instance to db.r6g.xlarge', description: 'Downsize from 2xlarge to xlarge during next maintenance window. CPU/memory analysis confirms ample headroom.', monthlySavings: 1550, effort: 'LOW', risk: 'LOW', timeline: '1 hour (maintenance window)', implementation: '1. Modify Aurora instance class via console/CLI\n2. Schedule during low-traffic window\n3. Aurora handles live resizing with brief failover (~30s)' },
    { priority: 3, category: 'QUICK_WIN', title: 'Remove underutilized read replica #2', description: 'Second read replica handles only 4% of traffic. Consolidate to single replica.', monthlySavings: 2100, effort: 'LOW', risk: 'LOW', timeline: '15 minutes', implementation: '1. Redirect monitoring queries to replica #1\n2. Delete replica #2 from Aurora cluster\n3. Enable Aurora Auto Scaling with min=1, max=2 for peak protection' },
    { priority: 4, category: 'QUICK_WIN', title: 'Drop 42 unused indexes', description: 'Remove indexes with zero scans in last 90 days. Reduces storage and speeds up writes.', monthlySavings: 850, effort: 'LOW', risk: 'LOW', timeline: '1-2 days', implementation: '1. Query pg_stat_user_indexes for idx_scan = 0\n2. Verify with DBA team\n3. DROP INDEX CONCURRENTLY for each\n4. Monitor write performance improvement' },
    { priority: 5, category: 'SHORT_TERM', title: 'Archive old data to S3', description: 'Export transactions > 2 years, audit_logs > 18 months, and unused tables to S3. Drop from Aurora.', monthlySavings: 1100, effort: 'MEDIUM', risk: 'MEDIUM', timeline: '1-2 weeks', implementation: '1. Set up AWS DMS for incremental export\n2. Export to S3 in Parquet format\n3. Create Athena external table for occasional queries\n4. Drop archived data from Aurora\n5. Verify application compatibility' },
    { priority: 6, category: 'SHORT_TERM', title: 'Enable compression on cold tables', description: 'Enable LZ4 compression on tables with low write rates. Reduces storage by ~30%.', monthlySavings: 360, effort: 'LOW', risk: 'LOW', timeline: '2-3 days', implementation: '1. Identify tables with < 100 writes/day\n2. ALTER TABLE SET (compression=lz4)\n3. Compression applies during next Aurora compaction\n4. Monitor for any query performance changes' },
    { priority: 7, category: 'LONG_TERM', title: 'Partition transactions table by month', description: 'Implement range partitioning on event_date. Eliminates full table scans for time-range queries.', monthlySavings: 1400, effort: 'HIGH', risk: 'MEDIUM', timeline: '2-3 weeks', implementation: '1. Create new partitioned table structure\n2. Use pg_partman for automatic partition management\n3. Migrate data in batches during low-traffic hours\n4. Update application queries if needed\n5. Drop old table after verification' },
    { priority: 8, category: 'LONG_TERM', title: 'Create materialized views for analytics', description: 'Pre-compute daily/hourly aggregations for dashboard and reporting queries. Eliminates repeated full scans.', monthlySavings: 500, effort: 'MEDIUM', risk: 'LOW', timeline: '1-2 weeks', implementation: '1. Identify top 5 recurring aggregation queries\n2. Create materialized views with appropriate refresh schedule\n3. Update application to query views instead of base tables\n4. Set up pg_cron for automatic refresh' },
  ],
};

// ── Main Component ──────────────────────────────────────────────────

export function CostOptimizer() {
  const { projectId } = useParams();
  const { data: assessments = [], isLoading } = useCostAssessments(projectId);
  const createAssessment = useCreateCostAssessment();
  const deleteAssessment = useDeleteCostAssessment();
  const analyzeCost = useAnalyzeCost();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('summary');
  const [selectedAssessment, setSelectedAssessment] = useState<CostAssessment | null>(null);
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [cloudProvider, setCloudProvider] = useState('AWS');
  const [cloudService, setCloudService] = useState('Aurora');
  const [instanceType, setInstanceType] = useState('db.r6g.2xlarge');
  const [region, setRegion] = useState('ap-south-1');
  const [monthlyCost, setMonthlyCost] = useState(18500);
  const [storageGB, setStorageGB] = useState(2400);
  const [computeHours, setComputeHours] = useState(730);
  const [reservedInst, setReservedInst] = useState(false);
  const [multiAZ, setMultiAZ] = useState(true);
  const [readReplicas, setReadReplicas] = useState(2);
  const [queryVolume, setQueryVolume] = useState(850000);
  const [fullTableScans, setFullTableScans] = useState(12);
  const [avgQueryCost, setAvgQueryCost] = useState(0.02);
  const [peakHours, setPeakHours] = useState('09:00-17:00 IST');
  const [totalStorageGB, setTotalStorageGB] = useState(2400);
  const [dataGrowthRate, setDataGrowthRate] = useState(80);
  const [unusedTables, setUnusedTables] = useState('');
  const [largestTables, setLargestTables] = useState('');
  const [archiveCandidates, setArchiveCandidates] = useState('');
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [totalIndexes, setTotalIndexes] = useState(285);
  const [unusedIndexCount, setUnusedIndexCount] = useState(42);
  const [duplicateIndexCount, setDuplicateIndexCount] = useState(18);
  const [missingIndexCount, setMissingIndexCount] = useState(8);
  const [indexSizeGB, setIndexSizeGB] = useState(180);

  const loadSampleData = useCallback(() => {
    const s = SAMPLE_FORM;
    setFormName(s.name);
    setCloudProvider(s.cloud.provider); setCloudService(s.cloud.service);
    setInstanceType(s.cloud.instanceType); setRegion(s.cloud.region);
    setMonthlyCost(s.cloud.monthlyCost); setStorageGB(s.cloud.storageGB);
    setComputeHours(s.cloud.computeHours); setReservedInst(s.cloud.reservedInstances);
    setMultiAZ(s.cloud.multiAZ); setReadReplicas(s.cloud.readReplicas);
    setQueryVolume(s.queries.queryVolume); setFullTableScans(s.queries.fullTableScans);
    setAvgQueryCost(s.queries.avgQueryCost); setPeakHours(s.queries.peakHours);
    setTotalStorageGB(s.storage.totalStorageGB); setDataGrowthRate(s.storage.dataGrowthRateGB);
    setUnusedTables(s.storage.unusedTables); setLargestTables(s.storage.largestTables);
    setArchiveCandidates(s.storage.archiveCandidates); setCompressionEnabled(s.storage.compressionEnabled);
    setTotalIndexes(s.indexes.totalIndexes); setUnusedIndexCount(s.indexes.unusedIndexes);
    setDuplicateIndexCount(s.indexes.duplicateIndexes); setMissingIndexCount(s.indexes.missingIndexes);
    setIndexSizeGB(s.indexes.indexSizeGB);
  }, []);

  const previewSampleResults = useCallback(() => {
    const mock: CostAssessment = {
      id: 'sample', projectId: projectId || '', name: SAMPLE_FORM.name,
      cloudConfig: JSON.stringify(SAMPLE_FORM.cloud), queryPatterns: JSON.stringify(SAMPLE_FORM.queries),
      storageProfile: JSON.stringify(SAMPLE_FORM.storage), indexProfile: JSON.stringify(SAMPLE_FORM.indexes),
      analysis: JSON.stringify(SAMPLE_ANALYSIS), monthlySavings: SAMPLE_ANALYSIS.executiveSummary.estimatedMonthlySavings,
      status: 'analyzed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setSelectedAssessment(mock); setAnalysis(SAMPLE_ANALYSIS);
    setViewMode('results'); setActiveResultTab('summary');
  }, [projectId]);

  const handleCreateAndAnalyze = useCallback(async () => {
    if (!projectId || !formName.trim()) return;
    try {
      const created = await createAssessment.mutateAsync({
        projectId, name: formName,
        cloudConfig: { provider: cloudProvider, service: cloudService, instanceType, region, monthlyCost, storageGB, computeHours, reservedInstances: reservedInst, multiAZ, readReplicas },
        queryPatterns: { topQueries: [], avgQueryCost, fullTableScans, queryVolume, peakHours, slowQueryThreshold: '2s' },
        storageProfile: { totalStorageGB, dataGrowthRateGB: dataGrowthRate, unusedTables, largestTables, archiveCandidates, compressionEnabled },
        indexProfile: { totalIndexes, unusedIndexes: unusedIndexCount, duplicateIndexes: duplicateIndexCount, missingIndexes: missingIndexCount, indexSizeGB },
      });
      const result = await analyzeCost.mutateAsync({ assessmentId: created.id, projectId });
      setSelectedAssessment(result.assessment); setAnalysis(result.analysis);
      setViewMode('results'); setActiveResultTab('summary');
    } catch { /* TanStack handles */ }
  }, [projectId, formName, cloudProvider, cloudService, instanceType, region, monthlyCost, storageGB, computeHours, reservedInst, multiAZ, readReplicas, avgQueryCost, fullTableScans, queryVolume, peakHours, totalStorageGB, dataGrowthRate, unusedTables, largestTables, archiveCandidates, compressionEnabled, totalIndexes, unusedIndexCount, duplicateIndexCount, missingIndexCount, indexSizeGB, createAssessment, analyzeCost]);

  const handleView = useCallback((a: CostAssessment) => {
    setSelectedAssessment(a);
    if (a.analysis) { try { setAnalysis(JSON.parse(a.analysis)); } catch { setAnalysis(null); } } else { setAnalysis(null); }
    setViewMode('results'); setActiveResultTab('summary');
  }, []);

  const handleReanalyze = useCallback(async () => {
    if (!selectedAssessment || !projectId) return;
    try {
      const result = await analyzeCost.mutateAsync({ assessmentId: selectedAssessment.id, projectId });
      setSelectedAssessment(result.assessment); setAnalysis(result.analysis);
    } catch { /* */ }
  }, [selectedAssessment, projectId, analyzeCost]);

  const handleDelete = useCallback(async (id: string) => {
    if (!projectId) return;
    await deleteAssessment.mutateAsync({ id, projectId });
    if (selectedAssessment?.id === id) { setViewMode('list'); setSelectedAssessment(null); setAnalysis(null); }
  }, [projectId, deleteAssessment, selectedAssessment]);

  // Helper for form input
  const Input = ({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
    </div>
  );

  const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Cost Optimization Advisor</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Identify waste, right-size infrastructure, and reduce cloud database spending</p>
          </div>
        </div>
        {viewMode !== 'form' && (
          <button onClick={() => setViewMode('form')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> New Analysis
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Assessments', value: assessments.length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Analyzed', value: assessments.filter((a) => a.status === 'analyzed').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Total Savings Found', value: formatCurrency(assessments.reduce((s, a) => s + (a.monthlySavings ?? 0), 0)) + '/mo', icon: TrendingDown, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Annual Projection', value: formatCurrency(assessments.reduce((s, a) => s + (a.monthlySavings ?? 0), 0) * 12), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border border-border p-4', s.bg)}>
            <div className="flex items-center gap-2 mb-1"><s.icon className={cn('w-4 h-4', s.color)} /><span className="text-xs font-medium text-muted-foreground">{s.label}</span></div>
            <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ LIST ═══ */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <DollarSign className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No Cost Assessments Yet</h3>
              <p className="text-xs text-muted-foreground mb-4">Analyze your database infrastructure to find cost savings</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setViewMode('form')} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Create Analysis</button>
                <button onClick={previewSampleResults} className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card hover:bg-muted/50 text-foreground rounded-lg text-sm font-medium transition-colors"><Eye className="w-4 h-4" /> Preview Sample Results</button>
              </div>
            </div>
          ) : (
            assessments.map((a) => {
              let cloud: Partial<CloudConfig> = {};
              try { cloud = JSON.parse(a.cloudConfig); } catch { /* */ }
              return (
                <div key={a.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors cursor-pointer" onClick={() => handleView(a)}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', a.monthlySavings ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted/50')}>
                      {a.monthlySavings ? <span className="text-sm font-bold text-emerald-600">{formatCurrency(a.monthlySavings)}</span> : <FileText className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">{a.name}</h4>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium uppercase', a.status === 'analyzed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>{a.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cloud.provider} {cloud.service} · {cloud.instanceType} · {new Date(a.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }} className="p-2 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ FORM ═══ */}
      {viewMode === 'form' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setViewMode('list')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowRight className="w-3 h-3 rotate-180" /> Back</button>
            <div className="flex items-center gap-2">
              <button onClick={loadSampleData} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-100 transition-colors"><Database className="w-3 h-3" /> Load Sample Data</button>
              <button onClick={previewSampleResults} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-100 transition-colors"><Eye className="w-3 h-3" /> Preview Sample Results</button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-foreground mb-2">Assessment Name</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Production DB — Q1 2026 Cost Review" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>

          {/* Cloud Infrastructure */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2"><Server className="w-4 h-4 text-emerald-500" /><h3 className="text-sm font-bold text-foreground">Cloud Infrastructure & Costs</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select label="Cloud Provider" value={cloudProvider} onChange={setCloudProvider} options={CLOUD_PROVIDERS} />
              <Select label="Database Service" value={cloudService} onChange={setCloudService} options={CLOUD_SERVICES} />
              <Select label="Instance Type" value={instanceType} onChange={setInstanceType} options={INSTANCE_TYPES} />
              <Input label="Region" value={region} onChange={setRegion} placeholder="ap-south-1" />
              <Input label="Monthly Cost ($)" value={monthlyCost} onChange={(v) => setMonthlyCost(Number(v))} type="number" />
              <Input label="Storage (GB)" value={storageGB} onChange={(v) => setStorageGB(Number(v))} type="number" />
              <Input label="Compute Hours/Month" value={computeHours} onChange={(v) => setComputeHours(Number(v))} type="number" />
              <Input label="Read Replicas" value={readReplicas} onChange={(v) => setReadReplicas(Number(v))} type="number" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={reservedInst} onChange={(e) => setReservedInst(e.target.checked)} className="rounded" /> Reserved Instance</label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={multiAZ} onChange={(e) => setMultiAZ(e.target.checked)} className="rounded" /> Multi-AZ</label>
            </div>
          </div>

          {/* Query Patterns */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2"><Search className="w-4 h-4 text-blue-500" /><h3 className="text-sm font-bold text-foreground">Query & Compute Patterns</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input label="Daily Query Volume" value={queryVolume} onChange={(v) => setQueryVolume(Number(v))} type="number" />
              <Input label="Full Table Scans Detected" value={fullTableScans} onChange={(v) => setFullTableScans(Number(v))} type="number" />
              <Input label="Avg Query Cost ($)" value={avgQueryCost} onChange={(v) => setAvgQueryCost(Number(v))} type="number" />
              <Input label="Peak Hours" value={peakHours} onChange={setPeakHours} placeholder="09:00-17:00" />
            </div>
          </div>

          {/* Storage */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-orange-500" /><h3 className="text-sm font-bold text-foreground">Storage Profile</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input label="Total Storage (GB)" value={totalStorageGB} onChange={(v) => setTotalStorageGB(Number(v))} type="number" />
              <Input label="Monthly Growth (GB)" value={dataGrowthRate} onChange={(v) => setDataGrowthRate(Number(v))} type="number" />
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Unused Tables</label><textarea value={unusedTables} onChange={(e) => setUnusedTables(e.target.value)} rows={2} placeholder="table1, table2, ..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Largest Tables</label><textarea value={largestTables} onChange={(e) => setLargestTables(e.target.value)} rows={2} placeholder="orders (500GB), logs (300GB), ..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Archive Candidates</label><textarea value={archiveCandidates} onChange={(e) => setArchiveCandidates(e.target.value)} rows={2} placeholder="transactions > 2 years, ..." className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={compressionEnabled} onChange={(e) => setCompressionEnabled(e.target.checked)} className="rounded" /> Compression Enabled</label>
          </div>

          {/* Index Profile */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-purple-500" /><h3 className="text-sm font-bold text-foreground">Index Profile</h3></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Input label="Total Indexes" value={totalIndexes} onChange={(v) => setTotalIndexes(Number(v))} type="number" />
              <Input label="Unused" value={unusedIndexCount} onChange={(v) => setUnusedIndexCount(Number(v))} type="number" />
              <Input label="Duplicates" value={duplicateIndexCount} onChange={(v) => setDuplicateIndexCount(Number(v))} type="number" />
              <Input label="Missing" value={missingIndexCount} onChange={(v) => setMissingIndexCount(Number(v))} type="number" />
              <Input label="Index Size (GB)" value={indexSizeGB} onChange={(v) => setIndexSizeGB(Number(v))} type="number" />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setViewMode('list')} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={handleCreateAndAnalyze} disabled={!formName.trim() || createAssessment.isPending || analyzeCost.isPending} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {createAssessment.isPending || analyzeCost.isPending ? (<><Loader2 className="w-4 h-4 animate-spin" />{createAssessment.isPending ? 'Creating...' : 'Analyzing...'}</>) : (<><Zap className="w-4 h-4" />Analyze Costs</>)}
            </button>
          </div>
          {(createAssessment.isError || analyzeCost.isError) && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"><p className="text-sm text-red-700 dark:text-red-400">{(createAssessment.error as { message?: string })?.message || (analyzeCost.error as { message?: string })?.message || 'An error occurred'}</p></div>
          )}
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {viewMode === 'results' && selectedAssessment && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button onClick={() => { setViewMode('list'); setSelectedAssessment(null); setAnalysis(null); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowRight className="w-3 h-3 rotate-180" /> Back</button>
            <button onClick={handleReanalyze} disabled={analyzeCost.isPending} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50">
              {analyzeCost.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Re-Analyze
            </button>
          </div>

          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-foreground">{selectedAssessment.name}</h3>
            {selectedAssessment.monthlySavings !== null && selectedAssessment.monthlySavings > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Save {formatCurrency(selectedAssessment.monthlySavings)}/mo
              </span>
            )}
          </div>

          {!analysis ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <DollarSign className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Click "Re-Analyze" to generate AI cost optimization report</p>
            </div>
          ) : (
            <>
              {/* Tab Nav */}
              <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border">
                {RESULT_TABS.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveResultTab(tab.id)} className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2', activeResultTab === tab.id ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30')}>
                    <tab.icon className="w-3.5 h-3.5" />{tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-card border border-border rounded-xl p-5">

                {/* ── Executive Summary ── */}
                {activeResultTab === 'summary' && analysis.executiveSummary && (() => {
                  const es = analysis.executiveSummary;
                  return (
                    <div className="space-y-5">
                      {/* Big Numbers */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-secondary/30 rounded-xl border border-border text-center">
                          <p className="text-xs text-muted-foreground mb-1">Current Monthly</p>
                          <p className="text-2xl font-bold text-foreground">{formatCurrency(es.currentMonthlyCost)}</p>
                        </div>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                          <p className="text-xs text-emerald-600 mb-1">Monthly Savings</p>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(es.estimatedMonthlySavings)}</p>
                        </div>
                        <div className="p-4 bg-secondary/30 rounded-xl border border-border text-center">
                          <p className="text-xs text-muted-foreground mb-1">Savings %</p>
                          <p className="text-2xl font-bold text-emerald-600">{es.savingsPercentage}%</p>
                        </div>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                          <p className="text-xs text-emerald-600 mb-1">Annual Projection</p>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(es.annualSavingsProjection)}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground italic">{es.headline}</p>

                      {/* Top Cost Drivers */}
                      {(es.topCostDrivers ?? []).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-orange-500" /> Top Cost Drivers</h4>
                          <div className="space-y-2">
                            {es.topCostDrivers.map((d, i) => (
                              <div key={i} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                                <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                                <div className="flex-1 min-w-0"><p className="text-sm text-foreground truncate">{d.driver}</p></div>
                                <span className="text-sm font-bold text-orange-600">{formatCurrency(d.monthlyCost)}</span>
                                <span className="text-xs text-muted-foreground">{d.percentage}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick Wins */}
                      {(es.quickWins ?? []).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Zap className="w-4 h-4 text-yellow-500" /> Quick Wins</h4>
                          <div className="space-y-2">
                            {es.quickWins.map((qw, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <ArrowDownRight className="w-4 h-4 text-emerald-500 shrink-0" />
                                  <span className="text-sm text-foreground truncate">{qw.action}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-xs text-muted-foreground">{qw.timeframe}</span>
                                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(qw.monthlySavings)}/mo</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Cost Breakdown ── */}
                {activeResultTab === 'breakdown' && analysis.costBreakdown && (
                  <div className="space-y-5">
                    {/* Categories */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Cost by Category</h4>
                      <div className="space-y-3">
                        {(analysis.costBreakdown.categories ?? []).map((cat, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-foreground">{cat.name}</span>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">{formatCurrency(cat.currentCost)}</span>
                                <ArrowRight className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-600 font-bold">{formatCurrency(cat.optimizedCost)}</span>
                                <span className="text-emerald-600 font-bold">(-{formatCurrency(cat.savings)})</span>
                              </div>
                            </div>
                            <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                              <div className="bg-emerald-500 rounded-full" style={{ width: `${(cat.optimizedCost / cat.currentCost) * 100}%` }} />
                              <div className="bg-red-300 dark:bg-red-700 rounded-r-full" style={{ width: `${(cat.savings / cat.currentCost) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* By Table */}
                    {(analysis.costBreakdown.byTable ?? []).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">Most Expensive Tables</h4>
                        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Table</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Monthly Cost</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Cost Drivers</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Savings Potential</th>
                        </tr></thead><tbody>
                          {analysis.costBreakdown.byTable.map((t, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-3 font-mono font-medium text-foreground">{t.tableName}</td>
                              <td className="py-2 px-3 text-right font-bold text-foreground">{formatCurrency(t.estimatedCost)}</td>
                              <td className="py-2 px-3">{t.costDrivers.map((d, j) => <span key={j} className="inline-block px-1.5 py-0.5 mr-1 mb-1 bg-muted rounded text-[10px] text-muted-foreground">{d}</span>)}</td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatCurrency(t.savingsPotential)}</td>
                            </tr>
                          ))}
                        </tbody></table></div>
                      </div>
                    )}

                    {/* Waste */}
                    {(analysis.costBreakdown.wasteIdentification ?? []).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><XCircle className="w-4 h-4 text-red-500" /> Waste Identified</h4>
                        <div className="space-y-2">
                          {analysis.costBreakdown.wasteIdentification.map((w, i) => (
                            <div key={i} className="p-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-200/50 dark:border-red-800/50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 uppercase">{w.type.replace(/_/g, ' ')}</span>
                                <span className="text-sm font-bold text-red-600">{formatCurrency(w.monthlyCost)}/mo wasted</span>
                              </div>
                              <p className="text-sm text-foreground">{w.description}</p>
                              <p className="text-xs text-emerald-600 mt-1"><strong>Fix:</strong> {w.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Query Costs ── */}
                {activeResultTab === 'queries' && analysis.queryCostAnalysis && (
                  <div className="space-y-5">
                    {(analysis.queryCostAnalysis.expensiveQueries ?? []).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">Most Expensive Queries</h4>
                        <div className="space-y-3">
                          {analysis.queryCostAnalysis.expensiveQueries.map((q, i) => (
                            <div key={i} className="p-4 bg-secondary/30 rounded-xl border border-border">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-sm font-semibold text-foreground">{q.description}</h5>
                                <span className="text-sm font-bold text-orange-600">{formatCurrency(q.estimatedMonthlyCost)}/mo</span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 uppercase">{q.issue.replace(/_/g, ' ')}</span>
                                <span className="text-xs text-muted-foreground">{q.frequency}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1"><strong>Current:</strong> {q.currentBehavior}</p>
                              <p className="text-xs text-emerald-600 mb-2"><strong>Optimization:</strong> {q.optimization}</p>
                              {q.sqlHint && <pre className="text-[11px] bg-background p-2 rounded border border-border overflow-x-auto font-mono">{q.sqlHint}</pre>}
                              <div className="mt-2 text-xs"><span className="font-bold text-emerald-600">Estimated savings: {formatCurrency(q.estimatedSavings)}/mo</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(analysis.queryCostAnalysis.fullTableScans ?? []).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-500" /> Full Table Scans Detected</h4>
                        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Table</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Pattern</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Cost</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Fix</th>
                        </tr></thead><tbody>
                          {analysis.queryCostAnalysis.fullTableScans.map((s, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-3 font-mono font-medium text-foreground">{s.table}</td>
                              <td className="py-2 px-3 text-muted-foreground">{s.queryPattern}</td>
                              <td className="py-2 px-3 text-right font-bold text-red-600">{formatCurrency(s.estimatedCost)}</td>
                              <td className="py-2 px-3 text-emerald-600">{s.fix}</td>
                            </tr>
                          ))}
                        </tbody></table></div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Storage & Indexes ── */}
                {activeResultTab === 'storage' && (
                  <div className="space-y-5">
                    {/* Storage Summary */}
                    {analysis.storageOptimization && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-secondary/30 rounded-lg text-center"><p className="text-xs text-muted-foreground">Current</p><p className="text-lg font-bold text-foreground">{analysis.storageOptimization.currentStorageGB} GB</p></div>
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center"><p className="text-xs text-emerald-600">Optimized</p><p className="text-lg font-bold text-emerald-600">{analysis.storageOptimization.optimizedStorageGB} GB</p></div>
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center"><p className="text-xs text-emerald-600">Savings</p><p className="text-lg font-bold text-emerald-600">{analysis.storageOptimization.storageSavings} GB</p></div>
                        </div>

                        {(analysis.storageOptimization.recommendations ?? []).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3">Storage Recommendations</h4>
                            <div className="space-y-2">
                              {analysis.storageOptimization.recommendations.map((r, i) => (
                                <div key={i} className="p-3 bg-secondary/30 rounded-lg border border-border">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 uppercase">{r.type}</span>
                                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', getRiskBadge(r.risk))}>Risk: {r.risk}</span>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600">{formatCurrency(r.monthlySavings)}/mo</span>
                                  </div>
                                  <p className="text-sm font-medium text-foreground">{r.target}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{r.implementation}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(analysis.storageOptimization.unusedTables ?? []).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3">Unused Tables</h4>
                            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
                              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Table</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Size</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Last Accessed</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Monthly Cost</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Action</th>
                            </tr></thead><tbody>
                              {analysis.storageOptimization.unusedTables.map((t, i) => (
                                <tr key={i} className="border-b border-border/50">
                                  <td className="py-2 px-3 font-mono text-foreground">{t.tableName}</td>
                                  <td className="py-2 px-3 text-right">{t.sizeGB} GB</td>
                                  <td className="py-2 px-3 text-muted-foreground">{t.lastAccessed}</td>
                                  <td className="py-2 px-3 text-right font-bold text-red-600">{formatCurrency(t.monthlyCost)}</td>
                                  <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 uppercase">{t.recommendation}</span></td>
                                </tr>
                              ))}
                            </tbody></table></div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Index Optimization */}
                    {analysis.indexOptimization && (
                      <div className="space-y-4 mt-6 pt-6 border-t border-border">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Layers className="w-4 h-4 text-purple-500" /> Index Optimization</h4>

                        {(analysis.indexOptimization.unusedIndexes ?? []).length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Unused Indexes (drop to save write overhead)</h5>
                            {analysis.indexOptimization.unusedIndexes.map((idx, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-secondary/30 rounded mb-1">
                                <div><span className="font-mono text-xs text-foreground">{idx.indexName}</span> <span className="text-[10px] text-muted-foreground">on {idx.tableName} ({idx.sizeGB}GB)</span></div>
                                <span className="text-xs font-bold text-emerald-600">{formatCurrency(idx.monthlySavings)}/mo</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {(analysis.indexOptimization.missingIndexes ?? []).length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Missing Indexes (add to reduce scan costs)</h5>
                            {analysis.indexOptimization.missingIndexes.map((idx, i) => (
                              <div key={i} className="p-3 bg-secondary/30 rounded-lg mb-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm text-foreground font-medium">{idx.tableName} ({idx.columns.join(', ')})</span>
                                  <span className="text-xs font-bold text-emerald-600">{formatCurrency(idx.estimatedSavings)}/mo</span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">{idx.reason}</p>
                                <pre className="text-[11px] bg-background p-2 rounded border border-border font-mono overflow-x-auto">{idx.createStatement}</pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Right-Sizing ── */}
                {activeResultTab === 'rightsizing' && analysis.rightSizing && (
                  <div className="space-y-4">
                    {/* Compute */}
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border">
                      <div className="flex items-center gap-2 mb-3"><Server className="w-4 h-4 text-blue-500" /><h4 className="text-sm font-bold text-foreground">Compute Right-Sizing</h4></div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-mono">{analysis.rightSizing.compute.currentInstance}</span>
                        <ArrowRight className="w-4 h-4 text-emerald-500" />
                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs font-mono">{analysis.rightSizing.compute.recommendedInstance}</span>
                        <span className="text-sm font-bold text-emerald-600 ml-auto">{formatCurrency(analysis.rightSizing.compute.monthlySavings)}/mo</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{analysis.rightSizing.compute.justification}</p>
                      <span className={cn('mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold', getRiskBadge(analysis.rightSizing.compute.risk))}>Risk: {analysis.rightSizing.compute.risk}</span>
                    </div>

                    {/* Reserved Instances */}
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border">
                      <div className="flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-purple-500" /><h4 className="text-sm font-bold text-foreground">Reserved Instance Opportunity</h4></div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">{analysis.rightSizing.reservedInstances.currentCommitment}</span>
                        <ArrowRight className="w-4 h-4 text-emerald-500" />
                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs">{analysis.rightSizing.reservedInstances.recommendedCommitment}</span>
                        <span className="text-sm font-bold text-emerald-600 ml-auto">{formatCurrency(analysis.rightSizing.reservedInstances.monthlySavings)}/mo</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{analysis.rightSizing.reservedInstances.justification}</p>
                      <p className="text-xs text-muted-foreground mt-1">Upfront: {formatCurrency(analysis.rightSizing.reservedInstances.upfrontCost)} · Break-even: {analysis.rightSizing.reservedInstances.breakEvenMonths} months</p>
                    </div>

                    {/* Storage Tier */}
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border">
                      <div className="flex items-center gap-2 mb-2"><HardDrive className="w-4 h-4 text-orange-500" /><h4 className="text-sm font-bold text-foreground">Storage Tier Optimization</h4><span className="text-sm font-bold text-emerald-600 ml-auto">{formatCurrency(analysis.rightSizing.storageTier.monthlySavings)}/mo</span></div>
                      <p className="text-xs text-muted-foreground">{analysis.rightSizing.storageTier.recommendation}</p>
                      <p className="text-xs text-muted-foreground mt-1">{analysis.rightSizing.storageTier.details}</p>
                    </div>

                    {/* Read Replicas */}
                    <div className="p-4 bg-secondary/30 rounded-xl border border-border">
                      <div className="flex items-center gap-2 mb-2"><Database className="w-4 h-4 text-blue-500" /><h4 className="text-sm font-bold text-foreground">Read Replica Optimization</h4><span className="text-sm font-bold text-emerald-600 ml-auto">{formatCurrency(analysis.rightSizing.readReplicas.monthlySavings)}/mo</span></div>
                      <p className="text-xs text-foreground mb-1">Current: {analysis.rightSizing.readReplicas.current} → Recommended: {analysis.rightSizing.readReplicas.recommended}</p>
                      <p className="text-xs text-muted-foreground">{analysis.rightSizing.readReplicas.justification}</p>
                    </div>
                  </div>
                )}

                {/* ── Action Plan ── */}
                {activeResultTab === 'actions' && (analysis.actionPlan ?? []).length > 0 && (
                  <div className="space-y-3">
                    {analysis.actionPlan.map((a, i) => (
                      <div key={i} className="p-4 bg-secondary/30 rounded-xl border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-emerald-600">#{a.priority}</span></span>
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', getPriorityColor(a.category))}>{a.category.replace(/_/g, ' ')}</span>
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', getRiskBadge(a.risk))}>Risk: {a.risk}</span>
                          <span className="text-xs text-muted-foreground ml-auto">Effort: <strong className="text-foreground">{a.effort}</strong> · {a.timeline}</span>
                        </div>
                        <h5 className="text-sm font-semibold text-foreground mb-1">{a.title}</h5>
                        <p className="text-xs text-muted-foreground mb-2">{a.description}</p>
                        <div className="flex items-center justify-between">
                          <details className="text-xs">
                            <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">Implementation steps</summary>
                            <pre className="mt-2 p-2 bg-background rounded border border-border text-[11px] font-mono whitespace-pre-wrap">{a.implementation}</pre>
                          </details>
                          <span className="text-sm font-bold text-emerald-600 shrink-0">{formatCurrency(a.monthlySavings)}/mo</span>
                        </div>
                      </div>
                    ))}

                    {/* Total Savings Summary */}
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Total Projected Monthly Savings</span>
                      <span className="text-xl font-bold text-emerald-600">{formatCurrency(analysis.actionPlan.reduce((s, a) => s + a.monthlySavings, 0))}/month</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CostOptimizer;
