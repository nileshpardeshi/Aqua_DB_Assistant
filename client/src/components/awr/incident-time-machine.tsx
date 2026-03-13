import { useState, useRef, useCallback } from 'react';
import {
  Upload, Loader2, AlertTriangle, AlertCircle,
  CheckCircle2, X, FileUp, Clock, Zap,
  Shield, FileText, Copy, Check, Sparkles,
  ArrowRight, Play, ChevronDown, ChevronRight,
  GitBranch, Target, Link2, Wrench, BookOpen,
  Trash2, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackAIUsage } from '@/lib/ai-usage-tracker';
import {
  useIncidentAnalyze,
  type IncidentFullResult,
  type IncidentTimelineEvent,
  type EventCategory,
  type EventSeverity,
} from '@/hooks/use-awr';

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<EventCategory, { color: string; bg: string; border: string; label: string }> = {
  deployment: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', label: 'Deploy' },
  schema_change: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', label: 'Schema' },
  performance: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', label: 'Perf' },
  query: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', label: 'Query' },
  wait_event: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', label: 'Wait' },
  resource: { color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-300', label: 'Resource' },
  config_change: { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-300', label: 'Config' },
  error: { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-400', label: 'Error' },
  metric: { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-300', label: 'Metric' },
};

const SEVERITY_DOT: Record<EventSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-400',
  info: 'bg-gray-400',
};

type IncidentTab = 'timeline' | 'root-cause' | 'correlations' | 'impact' | 'remediation';

// ── Demo Data ────────────────────────────────────────────────────────────────

function getDemoIncidentResult(): IncidentFullResult {
  return {
    timeline: {
      events: [
        { id: 'e1', timestamp: '2026-03-14 10:01:00', sortKey: 1, category: 'deployment', severity: 'info', title: 'Deployment v2.4.1 executed', description: 'Release v2.4.1 deployed to production. Includes schema migration script.', source: 'deploy.log', sourceType: 'generic' },
        { id: 'e2', timestamp: '2026-03-14 10:03:00', sortKey: 2, category: 'schema_change', severity: 'high', title: 'ALTER TABLE: DROP INDEX idx_transactions_customer_id', description: 'Index on transactions.customer_id dropped during migration. This index supported JOIN queries with customers table.', source: 'deploy.log', sourceType: 'generic' },
        { id: 'e3', timestamp: '2026-03-14 10:05:00', sortKey: 3, category: 'query', severity: 'high', title: 'Slow Query: 3.5s — SELECT * FROM transactions JOIN customers', description: 'Query latency increased from 20ms to 3.5s. Full table scan on transactions (25M rows).', source: 'oracle-awr.html', sourceType: 'awr' },
        { id: 'e4', timestamp: '2026-03-14 10:06:00', sortKey: 4, category: 'wait_event', severity: 'critical', title: 'Wait: db file sequential read (45% DB Time)', description: 'Massive I/O spike. Physical reads increased 50x as buffer cache hit ratio dropped to 72%.', source: 'oracle-awr.html', sourceType: 'awr' },
        { id: 'e5', timestamp: '2026-03-14 10:07:00', sortKey: 5, category: 'resource', severity: 'critical', title: 'CPU Usage: 95% — sustained for 40+ minutes', description: 'CPU spike caused by full table scans. All 8 cores saturated.', source: 'oracle-awr.html', sourceType: 'awr' },
        { id: 'e6', timestamp: '2026-03-14 10:08:00', sortKey: 6, category: 'error', severity: 'high', title: 'Connection pool exhausted — 200 waiting threads', description: 'Application connection pool saturated. New requests queuing for 10+ seconds.', source: 'app-error.log', sourceType: 'generic' },
        { id: 'e7', timestamp: '2026-03-14 10:12:00', sortKey: 7, category: 'query', severity: 'medium', title: 'Slow Query: 12.8s — SELECT COUNT(*) FROM transactions WHERE customer_id = ?', description: 'Aggregation query now doing full scan instead of index-only scan.', source: 'mysql-slow.log', sourceType: 'mysql_slowlog' },
        { id: 'e8', timestamp: '2026-03-14 10:15:00', sortKey: 8, category: 'performance', severity: 'high', title: 'Buffer Cache Hit Ratio: 72% (was 99.2%)', description: 'Dramatic cache efficiency drop indicating massive physical I/O pressure.', source: 'oracle-awr.html', sourceType: 'awr' },
        { id: 'e9', timestamp: '2026-03-14 10:45:00', sortKey: 9, category: 'deployment', severity: 'medium', title: 'Hotfix: CREATE INDEX idx_txn_cust_id ON transactions(customer_id)', description: 'Emergency index recreation deployed. Query latency recovery started.', source: 'deploy.log', sourceType: 'generic' },
        { id: 'e10', timestamp: '2026-03-14 10:48:00', sortKey: 10, category: 'performance', severity: 'info', title: 'Query latency normalized: 25ms', description: 'After index rebuild, queries returned to normal performance. CPU dropped to 15%.', source: 'oracle-awr.html', sourceType: 'awr' },
      ],
      sources: [
        { fileName: 'oracle-awr-PRODDB.html', reportType: 'awr', database: 'oracle', eventCount: 12, fileSizeKB: 847 },
        { fileName: 'deploy-v2.4.1.log', reportType: 'generic', database: 'unknown', eventCount: 5, fileSizeKB: 23 },
        { fileName: 'app-error-2026-03-14.log', reportType: 'generic', database: 'unknown', eventCount: 8, fileSizeKB: 156 },
      ],
      timeRange: { earliest: '2026-03-14 10:01:00', latest: '2026-03-14 10:48:00' },
      totalEventsBeforeDedup: 35,
      totalEventsAfterDedup: 10,
      compressionRatio: 94,
    },
    analysis: {
      incidentSummary: {
        severity: 'critical',
        headline: 'Index drop during deployment caused 175x query latency increase and CPU saturation',
        duration: '47 minutes (10:01 AM - 10:48 AM)',
        affectedSystems: ['transactions table', 'customer lookup queries', 'connection pool', 'API response times'],
        database: 'Oracle 19c — PRODDB',
      },
      timeline: [
        { timestamp: '10:01 AM', event: 'Deployment v2.4.1 executed', category: 'deployment', severity: 'info', isRootCause: false, isTrigger: true, correlatedWith: ['Index drop'], analysis: 'Deployment included a migration script that dropped a critical index.' },
        { timestamp: '10:03 AM', event: 'Index idx_transactions_customer_id dropped', category: 'schema_change', severity: 'critical', isRootCause: true, isTrigger: false, correlatedWith: ['Full table scan', 'CPU spike'], analysis: 'ROOT CAUSE: This index supported the most frequent JOIN query pattern. Without it, Oracle resorts to full table scans on 25M rows.' },
        { timestamp: '10:05 AM', event: 'Query latency: 20ms → 3.5s', category: 'performance', severity: 'high', isRootCause: false, isTrigger: false, correlatedWith: ['Index drop'], analysis: 'Direct consequence of missing index. Query now performs full table scan.' },
        { timestamp: '10:07 AM', event: 'CPU spike to 95%', category: 'resource', severity: 'critical', isRootCause: false, isTrigger: false, correlatedWith: ['Full table scan'], analysis: 'CPU saturation from concurrent full table scans across multiple sessions.' },
      ],
      rootCause: {
        primaryCause: 'Index idx_transactions_customer_id on transactions table was dropped during deployment v2.4.1 migration script',
        confidence: 'high',
        explanation: 'The deployment at 10:01 AM included a migration script that dropped the index on transactions.customer_id. This index was critical for JOIN operations between transactions (25M rows) and customers tables. Without it, all queries using this join pattern fell back to full table scans, causing query latency to jump from 20ms to 3.5s (175x increase). The cascading effect caused CPU saturation at 95%, connection pool exhaustion, and application-level timeouts.',
        evidence: [
          'Index drop at 10:03 AM immediately preceded first slow query at 10:05 AM (2 minute lag)',
          'Query execution plan changed from INDEX RANGE SCAN to TABLE ACCESS FULL',
          'Buffer cache hit ratio dropped from 99.2% to 72% (massive physical I/O)',
          'CPU spike to 95% coincided exactly with full table scan activity',
          'Recovery at 10:48 AM after index was recreated confirms causal relationship',
        ],
        causalChain: [
          { step: 1, event: 'Deployment v2.4.1 executed', effect: 'Migration script ran DROP INDEX', timelag: '2 minutes' },
          { step: 2, event: 'Index idx_transactions_customer_id dropped', effect: 'Query optimizer switched to full table scan', timelag: 'Immediate' },
          { step: 3, event: 'Full table scan on 25M rows', effect: 'Query latency jumped to 3.5s, massive physical reads', timelag: '2 minutes' },
          { step: 4, event: 'Concurrent slow queries accumulated', effect: 'CPU saturated at 95%, connection pool exhausted', timelag: '3 minutes' },
          { step: 5, event: 'Connection pool exhaustion', effect: 'Application requests timing out, user-facing errors', timelag: '1 minute' },
        ],
      },
      correlations: [
        { eventA: 'Index drop at 10:03', eventB: 'Query latency spike at 10:05', relationship: 'caused_by', confidence: 'high', explanation: 'Direct causal: removing index forced full table scans' },
        { eventA: 'Full table scans', eventB: 'CPU spike at 10:07', relationship: 'caused_by', confidence: 'high', explanation: 'Multiple concurrent full table scans saturated CPU' },
        { eventA: 'CPU saturation', eventB: 'Connection pool exhaustion at 10:08', relationship: 'caused_by', confidence: 'high', explanation: 'Slow queries held connections longer, exhausting the pool' },
        { eventA: 'Index recreation at 10:45', eventB: 'Recovery at 10:48', relationship: 'caused_by', confidence: 'high', explanation: 'Confirms index was the root cause — recreation resolved the issue' },
      ],
      impact: {
        queriesAffected: '~15,000 queries during the 47-minute incident window',
        latencyIncrease: '20ms → 3.5s (175x increase)',
        usersImpacted: 'All users performing transaction lookups — estimated 2,000+ concurrent users',
        dataAtRisk: 'No data loss — read-only query degradation',
        businessImpact: 'Transaction lookup API returned timeouts for 47 minutes. Customer-facing dashboards showed stale data.',
      },
      remediation: {
        immediateFix: {
          description: 'Recreate the dropped index on transactions.customer_id',
          sql: 'CREATE INDEX idx_transactions_customer_id ON transactions(customer_id) TABLESPACE idx_ts PARALLEL 4 NOLOGGING;\nALTER INDEX idx_transactions_customer_id NOPARALLEL LOGGING;',
          estimatedRecoveryTime: '3-5 minutes for index creation on 25M rows',
        },
        preventiveMeasures: [
          { title: 'Add index dependency checks to CI/CD pipeline', description: 'Scan migration scripts for DROP INDEX statements and cross-reference with active query patterns', priority: 'immediate', implementation: 'Add a pre-deployment hook that checks for index drops and requires explicit approval' },
          { title: 'Implement schema change review process', description: 'All DDL changes should be reviewed by DBA team before production deployment', priority: 'short-term', implementation: 'Create a schema change approval workflow in the deployment pipeline' },
          { title: 'Set up real-time alerting on cache hit ratio', description: 'Alert when buffer cache hit ratio drops below 95%', priority: 'short-term', implementation: 'Configure monitoring threshold: buffer_cache_hit_ratio < 95% → PagerDuty alert' },
          { title: 'Maintain index usage statistics', description: 'Regularly audit index usage to identify critical indexes that should never be dropped', priority: 'long-term', implementation: 'Schedule weekly V$OBJECT_USAGE analysis and tag critical indexes' },
        ],
        rollbackSteps: [
          { step: 1, description: 'Recreate the dropped index', sql: 'CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);', risk: 'Index creation on 25M rows may cause brief lock contention' },
          { step: 2, description: 'Verify query plans returned to index scan', sql: "EXPLAIN PLAN FOR SELECT * FROM transactions WHERE customer_id = 12345;\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);", risk: 'None' },
          { step: 3, description: 'Monitor buffer cache hit ratio recovery', sql: "SELECT name, value FROM V$SYSSTAT WHERE name LIKE 'buffer cache%';", risk: 'None' },
        ],
      },
      lessonsLearned: [
        'Migration scripts should never drop indexes without verifying query dependencies',
        'Pre-deployment checks should include index usage analysis',
        'Real-time monitoring should alert on sudden changes in buffer cache efficiency',
        'Deployment rollback procedures should include DDL rollback (CREATE INDEX to reverse DROP INDEX)',
        'The 2-minute gap between index drop and visible degradation shows the importance of sub-minute monitoring',
      ],
    },
    tokenOptimization: {
      totalInputSizeKB: 1026,
      compressedContextChars: 4200,
      estimatedTokensSaved: 255400,
      compressionRatio: 94,
    },
    usage: { inputTokens: 3200, outputTokens: 2800 },
    model: 'claude-sonnet-4-20250514',
    analysisTimeMs: 8420,
    totalLines: 14850,
  };
}

// ── Copy Helper ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-muted transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 50;
const MAX_TOTAL_SIZE_MB = 150;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IncidentTimeMachine() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeIncident = useIncidentAnalyze();

  // Sources state — track file sizes for validation
  const [sources, setSources] = useState<Array<{ content: string; fileName: string; sizeBytes: number }>>([]);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [result, setResult] = useState<IncidentFullResult | null>(null);
  const [activeTab, setActiveTab] = useState<IncidentTab>('timeline');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [uploadError, setUploadError] = useState<string | null>(null);

  const totalSizeMB = sources.reduce((sum, s) => sum + s.sizeBytes, 0) / (1024 * 1024);

  // File upload handler — supports multiple files with size validation
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadError(null);

    for (const file of Array.from(files)) {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        setUploadError(`"${file.name}" is ${fileSizeMB.toFixed(1)}MB — exceeds the ${MAX_FILE_SIZE_MB}MB per-file limit. Consider trimming the log to the incident time window.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setSources((prev) => {
          const updated = [...prev, { content: text, fileName: file.name, sizeBytes: file.size }];
          const newTotalMB = updated.reduce((s, f) => s + f.sizeBytes, 0) / (1024 * 1024);
          if (newTotalMB > MAX_TOTAL_SIZE_MB) {
            setUploadError(`Total upload size (${newTotalMB.toFixed(1)}MB) exceeds the ${MAX_TOTAL_SIZE_MB}MB combined limit. Remove some files or trim logs to the incident window.`);
            return prev; // Don't add the file
          }
          return updated;
        });
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }, []);

  const removeSource = useCallback((idx: number) => {
    setSources((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Analyze
  const handleAnalyze = useCallback(async () => {
    if (sources.length === 0) return;
    try {
      const res = await analyzeIncident.mutateAsync({
        sources: sources.map((s) => ({ content: s.content, fileName: s.fileName })),
        incidentDescription: incidentDescription.trim() || undefined,
      });
      setResult(res);
      setActiveTab('timeline');
      trackAIUsage({ usage: res.usage, model: res.model }, 'incident-time-machine');
    } catch {
      // Error handled by mutation state
    }
  }, [sources, incidentDescription, analyzeIncident]);

  // Demo
  const handleLoadDemo = useCallback(() => {
    setResult(getDemoIncidentResult());
    setSources([
      { content: '(demo)', fileName: 'oracle-awr-PRODDB.html' },
      { content: '(demo)', fileName: 'deploy-v2.4.1.log' },
      { content: '(demo)', fileName: 'app-error-2026-03-14.log' },
    ]);
    setActiveTab('timeline');
  }, []);

  const handleReset = useCallback(() => {
    setSources([]);
    setResult(null);
    setIncidentDescription('');
  }, []);

  const toggleEvent = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const analysis = result?.analysis;

  // ── Upload View ──
  if (!result) {
    return (
      <div className="space-y-5">
        {/* Multi-file Upload Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.txt,.log,.csv,.htm,.json"
            onChange={handleFileUpload}
            className="hidden"
            multiple
          />
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileUp className="w-6 h-6 text-violet-500" />
          </div>
          <h4 className="text-base font-semibold text-foreground mb-1">Upload Incident Evidence</h4>
          <p className="text-xs text-muted-foreground mb-1">
            Drop multiple files: AWR reports, slow query logs, deployment logs, error logs
          </p>
          <p className="text-[10px] text-muted-foreground">
            Supports <code className="px-1 py-0.5 bg-muted rounded">.html</code>{' '}
            <code className="px-1 py-0.5 bg-muted rounded">.txt</code>{' '}
            <code className="px-1 py-0.5 bg-muted rounded">.log</code>{' '}
            <code className="px-1 py-0.5 bg-muted rounded">.csv</code> — up to {MAX_FILE_SIZE_MB}MB per file, {MAX_TOTAL_SIZE_MB}MB total
          </p>
        </div>

        {/* Upload Error */}
        {uploadError && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{uploadError}</p>
            <button onClick={() => setUploadError(null)} className="p-0.5 ml-auto">
              <X className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        )}

        {/* Uploaded Sources List */}
        {sources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                Evidence Files ({sources.length})
              </h5>
              <span className={cn('text-[10px] font-medium', totalSizeMB > MAX_TOTAL_SIZE_MB * 0.8 ? 'text-amber-600' : 'text-muted-foreground')}>
                Total: {totalSizeMB < 1 ? `${(totalSizeMB * 1024).toFixed(0)} KB` : `${totalSizeMB.toFixed(1)} MB`} / {MAX_TOTAL_SIZE_MB}MB
              </span>
            </div>
            {sources.map((src, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                <FileText className="w-4 h-4 text-violet-600 flex-shrink-0" />
                <span className="text-sm font-medium text-violet-800 flex-1 truncate">{src.fileName}</span>
                <span className="text-[10px] text-violet-600">{formatFileSize(src.sizeBytes)}</span>
                <button onClick={() => removeSource(i)} className="p-0.5 rounded hover:bg-violet-200 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-violet-600" />
                </button>
              </div>
            ))}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add More Files
            </button>
          </div>
        )}

        {/* Incident Description */}
        {sources.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Incident Description (optional)
            </label>
            <textarea
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
              placeholder="e.g., Production database latency spiked after 10:00 AM deployment..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all resize-y"
            />
          </div>
        )}

        {/* Analyze Button */}
        {sources.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={analyzeIncident.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all shadow-sm',
              analyzeIncident.isPending
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-violet-500/25'
            )}
          >
            {analyzeIncident.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Building timeline & analyzing...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Reconstruct Incident Timeline</>
            )}
          </button>
        )}

        {analyzeIncident.error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700">{String((analyzeIncident.error as Record<string, unknown>).message || analyzeIncident.error)}</p>
          </div>
        )}

        {/* Demo Button */}
        {sources.length === 0 && (
          <div className="flex items-center justify-center">
            <button
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Load Demo — Production Index Drop Incident
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Results View ──

  const TABS: { id: IncidentTab; label: string; icon: typeof Clock }[] = [
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'root-cause', label: 'Root Cause', icon: Target },
    { id: 'correlations', label: 'Correlations', icon: Link2 },
    { id: 'impact', label: 'Impact', icon: AlertTriangle },
    { id: 'remediation', label: 'Remediation', icon: Wrench },
  ];

  const summaryColor = analysis?.incidentSummary.severity === 'critical' ? 'from-red-600 to-red-700'
    : analysis?.incidentSummary.severity === 'high' ? 'from-orange-600 to-orange-700'
    : analysis?.incidentSummary.severity === 'medium' ? 'from-amber-600 to-amber-700'
    : 'from-green-600 to-green-700';

  return (
    <div className="space-y-5">
      {/* Incident Summary Banner */}
      <div className={cn('rounded-xl p-5 text-white bg-gradient-to-r shadow-lg', summaryColor)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-white/20 rounded-full">
                {analysis?.incidentSummary.severity} severity
              </span>
              <span className="text-xs opacity-80">{analysis?.incidentSummary.duration}</span>
            </div>
            <h3 className="text-lg font-bold leading-snug mb-2">
              {analysis?.incidentSummary.headline}
            </h3>
            <div className="flex items-center gap-3 text-xs opacity-80 flex-wrap">
              <span>{analysis?.incidentSummary.database}</span>
              <span>|</span>
              <span>{result.timeline.sources.length} sources analyzed</span>
              <span>|</span>
              <span>{result.timeline.totalEventsAfterDedup} events detected</span>
              <span>|</span>
              <span>{result.tokenOptimization.compressionRatio}% token compression</span>
            </div>
          </div>
          <button onClick={handleReset} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Token Optimization Info */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex-wrap">
        <Zap className="w-4 h-4 text-emerald-600" />
        <span className="font-semibold text-emerald-800">Token Optimization:</span>
        <span className="text-emerald-700">{result.tokenOptimization.totalInputSizeKB}KB input → {Math.round(result.tokenOptimization.compressedContextChars / 1024)}KB compressed</span>
        <span className="text-emerald-700">~{result.tokenOptimization.estimatedTokensSaved.toLocaleString()} tokens saved</span>
        <span className="text-emerald-700">{result.analysisTimeMs ? `${(result.analysisTimeMs / 1000).toFixed(1)}s analysis` : ''}</span>
        <span className="text-emerald-700">{result.totalLines.toLocaleString()} lines analyzed</span>
      </div>

      {/* Sources */}
      <div className="flex items-center gap-2 flex-wrap">
        {result.timeline.sources.map((src, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-muted rounded-lg border border-border">
            <FileText className="w-3 h-3 text-muted-foreground" />
            {src.fileName}
            <span className="text-muted-foreground">({src.reportType}, {src.eventCount} events)</span>
          </span>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-violet-500 text-violet-700'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {/* ── Timeline Tab ── */}
      {activeTab === 'timeline' && (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

          {result.timeline.events.map((event, i) => {
            const catCfg = CATEGORY_CONFIG[event.category as EventCategory] || CATEGORY_CONFIG.metric;
            const isExpanded = expandedEvents.has(event.id);
            const aiEvent = analysis?.timeline.find((t) => t.timestamp?.includes(event.timestamp.split(' ')[1]?.slice(0, 5) || '__'));
            const isRootCause = aiEvent?.isRootCause ?? false;
            const isTrigger = aiEvent?.isTrigger ?? false;

            return (
              <div key={event.id} className="relative mb-4 last:mb-0">
                {/* Dot on timeline */}
                <div className={cn(
                  'absolute -left-5 top-3 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10',
                  SEVERITY_DOT[event.severity as EventSeverity] || 'bg-gray-400',
                  isRootCause && 'ring-2 ring-red-400 ring-offset-1'
                )} />

                {/* Event Card */}
                <div
                  className={cn(
                    'rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm',
                    isRootCause ? 'border-red-300 bg-red-50/50 ring-1 ring-red-200' :
                    isTrigger ? 'border-blue-300 bg-blue-50/50' :
                    'border-border bg-card'
                  )}
                  onClick={() => toggleEvent(event.id)}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground">{event.timestamp}</span>
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', catCfg.bg, catCfg.color, catCfg.border)}>
                      {catCfg.label}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded',
                      event.severity === 'critical' ? 'bg-red-600 text-white' :
                      event.severity === 'high' ? 'bg-orange-600 text-white' :
                      event.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {event.severity}
                    </span>
                    {isRootCause && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white animate-pulse">
                        ROOT CAUSE
                      </span>
                    )}
                    {isTrigger && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                        TRIGGER
                      </span>
                    )}
                    {isExpanded ? <ChevronDown className="w-3 h-3 ml-auto text-muted-foreground" /> : <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />}
                  </div>

                  <p className="text-sm font-medium text-foreground">{event.title}</p>

                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>Source: {event.source}</span>
                        <span>({event.sourceType})</span>
                      </div>
                      {aiEvent?.analysis && (
                        <div className="px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded text-xs text-violet-800">
                          <strong>AI Analysis:</strong> {aiEvent.analysis}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Root Cause Tab ── */}
      {activeTab === 'root-cause' && analysis?.rootCause && (
        <div className="space-y-5">
          {/* Primary Cause */}
          <div className="rounded-xl border-2 border-red-300 bg-red-50/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-red-600" />
              <h4 className="text-sm font-bold text-red-800">Primary Root Cause</h4>
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto',
                analysis.rootCause.confidence === 'high' ? 'bg-green-100 text-green-700' :
                analysis.rootCause.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-700'
              )}>
                {analysis.rootCause.confidence} confidence
              </span>
            </div>
            <p className="text-base font-semibold text-foreground mb-3">{analysis.rootCause.primaryCause}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.rootCause.explanation}</p>
          </div>

          {/* Evidence */}
          <div>
            <h4 className="text-xs font-bold text-foreground mb-2 uppercase">Evidence</h4>
            <ul className="space-y-1.5">
              {analysis.rootCause.evidence.map((ev, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  {ev}
                </li>
              ))}
            </ul>
          </div>

          {/* Causal Chain */}
          <div>
            <h4 className="text-xs font-bold text-foreground mb-3 uppercase">Causal Chain</h4>
            <div className="space-y-0">
              {analysis.rootCause.causalChain.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {step.step}
                    </div>
                    {i < analysis.rootCause.causalChain.length - 1 && (
                      <div className="w-0.5 h-8 bg-violet-200 my-1" />
                    )}
                  </div>
                  <div className="pb-3 flex-1">
                    <p className="text-sm font-medium text-foreground">{step.event}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{step.effect}</span>
                    </div>
                    <span className="text-[10px] text-violet-600 mt-0.5 inline-block">{step.timelag} later</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Correlations Tab ── */}
      {activeTab === 'correlations' && analysis?.correlations && (
        <div className="space-y-3">
          {analysis.correlations.map((corr, i) => {
            const relColor = corr.relationship === 'caused_by' ? 'border-red-200 bg-red-50/30'
              : corr.relationship === 'symptom_of' ? 'border-amber-200 bg-amber-50/30'
              : 'border-border bg-card';
            return (
              <div key={i} className={cn('rounded-lg border p-4', relColor)}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded flex-1 truncate">{corr.eventA}</span>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      corr.relationship === 'caused_by' ? 'bg-red-100 text-red-700' :
                      corr.relationship === 'contributed_to' ? 'bg-amber-100 text-amber-700' :
                      corr.relationship === 'symptom_of' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {corr.relationship.replace(/_/g, ' ')}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground mt-1" />
                  </div>
                  <span className="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded flex-1 truncate">{corr.eventB}</span>
                </div>
                <p className="text-xs text-muted-foreground">{corr.explanation}</p>
                <span className={cn(
                  'text-[10px] font-medium mt-1 inline-block',
                  corr.confidence === 'high' ? 'text-green-600' : corr.confidence === 'medium' ? 'text-amber-600' : 'text-gray-500'
                )}>
                  {corr.confidence} confidence
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Impact Tab ── */}
      {activeTab === 'impact' && analysis?.impact && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Queries Affected', value: analysis.impact.queriesAffected, icon: Zap, color: 'text-amber-600' },
            { label: 'Latency Increase', value: analysis.impact.latencyIncrease, icon: Clock, color: 'text-red-600' },
            { label: 'Users Impacted', value: analysis.impact.usersImpacted, icon: Shield, color: 'text-orange-600' },
            { label: 'Data at Risk', value: analysis.impact.dataAtRisk, icon: AlertTriangle, color: 'text-blue-600' },
            { label: 'Business Impact', value: analysis.impact.businessImpact, icon: Target, color: 'text-purple-600' },
          ].filter((item) => item.value).map((item, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={cn('w-4 h-4', item.color)} />
                <span className="text-xs font-bold text-muted-foreground uppercase">{item.label}</span>
              </div>
              <p className="text-sm text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Remediation Tab ── */}
      {activeTab === 'remediation' && analysis?.remediation && (
        <div className="space-y-5">
          {/* Immediate Fix */}
          <div className="rounded-xl border-2 border-green-300 bg-green-50/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-5 h-5 text-green-600" />
              <h4 className="text-sm font-bold text-green-800">Immediate Fix</h4>
              {analysis.remediation.immediateFix.estimatedRecoveryTime && (
                <span className="text-[10px] text-green-600 ml-auto">{analysis.remediation.immediateFix.estimatedRecoveryTime}</span>
              )}
            </div>
            <p className="text-sm text-foreground mb-3">{analysis.remediation.immediateFix.description}</p>
            {analysis.remediation.immediateFix.sql && (
              <div className="relative">
                <pre className="text-xs font-mono bg-green-100/50 border border-green-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">{analysis.remediation.immediateFix.sql}</pre>
                <div className="absolute top-1 right-1"><CopyButton text={analysis.remediation.immediateFix.sql} /></div>
              </div>
            )}
          </div>

          {/* Preventive Measures */}
          <div>
            <h4 className="text-xs font-bold text-foreground mb-3 uppercase">Preventive Measures</h4>
            {analysis.remediation.preventiveMeasures.map((pm, i) => (
              <div key={i} className="rounded-lg border border-border p-3 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    pm.priority === 'immediate' ? 'bg-red-100 text-red-700' :
                    pm.priority === 'short-term' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {pm.priority}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{pm.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{pm.description}</p>
                <p className="text-xs text-violet-700 mt-1 italic">{pm.implementation}</p>
              </div>
            ))}
          </div>

          {/* Rollback Steps */}
          {analysis.remediation.rollbackSteps.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-foreground mb-3 uppercase">Rollback Steps</h4>
              {analysis.remediation.rollbackSteps.map((step) => (
                <div key={step.step} className="rounded-lg border border-border p-3 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center">{step.step}</span>
                    <span className="text-sm text-foreground">{step.description}</span>
                  </div>
                  {step.sql && (
                    <div className="relative mt-2">
                      <pre className="text-[10px] font-mono bg-muted/50 border border-border rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap">{step.sql}</pre>
                      <div className="absolute top-1 right-1"><CopyButton text={step.sql} /></div>
                    </div>
                  )}
                  {step.risk && (
                    <p className="text-[10px] text-amber-700 mt-1">Risk: {step.risk}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Lessons Learned */}
          {analysis.lessonsLearned && analysis.lessonsLearned.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-foreground mb-2 uppercase flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-600" /> Lessons Learned
              </h4>
              <ul className="space-y-1.5">
                {analysis.lessonsLearned.map((lesson, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-violet-500 font-bold mt-0.5">{i + 1}.</span>
                    {lesson}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
