import React, { useState, useRef, useCallback } from 'react';
import {
  FlaskConical,
  Play,
  Upload,
  Copy,
  Check,
  Loader2,
  Code2,
  BarChart3,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  FileCode,
  AlertCircle,
  Info,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useAnalyzeJPA,
  type JPAAnalysisResult,
  type JPAPerformanceEstimate,
  type JPAIssue,
  type JPARecommendation,
} from '@/hooks/use-jpa-lab';

// ── Dialect options ──────────────────────────────────────────────────────────

const DIALECT_OPTIONS = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle' },
] as const;

// ── Tab definitions ──────────────────────────────────────────────────────────

type ResultTab = 'sql' | 'performance' | 'issues' | 'recommendations';

const RESULT_TABS: {
  id: ResultTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'sql', label: 'SQL Translation', icon: Code2 },
  { id: 'performance', label: 'Performance Report', icon: BarChart3 },
  { id: 'issues', label: 'Issues Found', icon: AlertTriangle },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
];

// ── Analysis progress steps ─────────────────────────────────────────────────

const ANALYSIS_STEPS = [
  { label: 'Parsing JPQL/HQL query', icon: Code2 },
  { label: 'Translating to SQL', icon: FileCode },
  { label: 'Analyzing performance', icon: BarChart3 },
  { label: 'Detecting issues', icon: Lightbulb },
];

// ── Rating helpers ───────────────────────────────────────────────────────────

function getRatingColor(rating: JPAPerformanceEstimate['rating']) {
  switch (rating) {
    case 'good':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'acceptable':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'warning':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getSeverityConfig(severity: JPAIssue['severity']) {
  switch (severity) {
    case 'critical':
      return {
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: AlertCircle,
        label: 'Critical',
      };
    case 'warning':
      return {
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: AlertTriangle,
        label: 'Warning',
      };
    case 'info':
      return {
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: Info,
        label: 'Info',
      };
    default:
      return {
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: Info,
        label: 'Info',
      };
  }
}

// ── SQL Syntax Highlighting ─────────────────────────────────────────────────

function highlightSQL(sql: string): React.ReactNode {
  if (!sql) return null;
  const keywords = new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS',
    'ON', 'AND', 'OR', 'IN', 'NOT', 'NULL', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING',
    'LIMIT', 'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
    'INDEX', 'TABLE', 'VALUES', 'SET', 'INTO', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
    'MAX', 'MIN', 'BETWEEN', 'LIKE', 'EXISTS', 'UNION', 'ALL', 'CASE', 'WHEN',
    'THEN', 'ELSE', 'END', 'IS', 'ASC', 'DESC', 'WITH', 'PARTITION', 'RANGE',
    'LIST', 'HASH', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'TOP', 'OVER', 'WINDOW',
  ]);

  // Split by word boundaries, preserving whitespace and punctuation
  const tokens = sql.split(/(\b\w+\b)/g);
  return tokens.map((token, i) => {
    if (keywords.has(token.toUpperCase())) {
      return <span key={i} className="text-cyan-400 font-bold">{token}</span>;
    }
    if (/^\d+(\.\d+)?$/.test(token)) {
      return <span key={i} className="text-emerald-400">{token}</span>;
    }
    return <span key={i}>{token}</span>;
  });
}

// ── Embeddable Content Component ────────────────────────────────────────────

export function JPAQueryLabContent() {
  const [jpql, setJpql] = useState('');
  const [dialect, setDialect] = useState('postgresql');
  const [entityContext, setEntityContext] = useState('');
  const [showEntityContext, setShowEntityContext] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>('sql');
  const [copied, setCopied] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [demoResult, setDemoResult] = useState<JPAAnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeJPA = useAnalyzeJPA();

  const result = (analyzeJPA.data as JPAAnalysisResult | undefined) || demoResult;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAnalyze = useCallback(() => {
    if (!jpql.trim()) return;
    setDemoResult(null);

    // Reset and start the step interval
    setAnalysisStep(0);
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
    }
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 1200);

    analyzeJPA.mutate(
      { jpql: jpql.trim(), dialect, entityContext: entityContext.trim() || undefined },
      {
        onSettled: () => {
          if (stepIntervalRef.current) {
            clearInterval(stepIntervalRef.current);
            stepIntervalRef.current = null;
          }
          setAnalysisStep(ANALYSIS_STEPS.length);
        },
      },
    );
  }, [jpql, dialect, entityContext, analyzeJPA]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (content) {
          setEntityContext(content);
          setShowEntityContext(true);
        }
      };
      reader.readAsText(file);

      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [],
  );

  const copyToClipboard = useCallback(
    (text: string, key: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
      });
    },
    [],
  );

  const buildFullReport = useCallback((): string => {
    if (!result) return '';

    let report = '=== JPA Query Analysis Report ===\n\n';

    report += '--- SQL Translation ---\n';
    report += result.sqlTranslation || '(none)';
    report += '\n\n';

    report += '--- Performance Estimates ---\n';
    if (result.performanceEstimates.length > 0) {
      report += 'Rows\t\tEst. Time\tScan Type\t\tJoins\tMemory\tRating\n';
      for (const est of result.performanceEstimates) {
        report += `${est.rows}\t\t${est.estimatedTimeMs}ms\t\t${est.scanType}\t\t${est.joinsUsed}\t${est.memoryMB}MB\t${est.rating}\n`;
      }
    } else {
      report += '(no estimates)\n';
    }
    report += '\n';

    report += '--- Issues ---\n';
    if (result.issues.length > 0) {
      for (const issue of result.issues) {
        report += `[${issue.severity.toUpperCase()}] ${issue.title}\n`;
        report += `  ${issue.description}\n`;
        report += `  Impact: ${issue.impact}\n\n`;
      }
    } else {
      report += 'No issues found.\n';
    }
    report += '\n';

    report += '--- Recommendations ---\n';
    if (result.recommendations.length > 0) {
      for (const rec of result.recommendations) {
        report += `${rec.title}\n`;
        report += `  ${rec.description}\n`;
        report += `  Before: ${rec.before}\n`;
        report += `  After:  ${rec.after}\n`;
        report += `  Improvement: ${rec.estimatedImprovement}\n\n`;
      }
    } else {
      report += 'No recommendations.\n';
    }
    report += '\n';

    report += '--- Summary ---\n';
    report += result.summary || '(none)';
    report += '\n';

    return report;
  }, [result]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAnalyze();
      }
    },
    [handleAnalyze],
  );

  const handleLoadDemo = useCallback(() => {
    setJpql(`SELECT u FROM User u
LEFT JOIN FETCH u.orders o
WHERE u.email LIKE :emailPattern
  AND u.createdAt > :startDate
ORDER BY u.createdAt DESC`);
    setDialect('postgresql');
    setDemoResult({
      sqlTranslation: `SELECT u.id, u.name, u.email, u.created_at,
       o.id AS order_id, o.total, o.status, o.created_at AS order_date
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.email LIKE $1
  AND u.created_at > $2
ORDER BY u.created_at DESC`,
      performanceEstimates: [
        { rows: '1K', estimatedTimeMs: 12, scanType: 'Index Scan', joinsUsed: 1, memoryMB: 2, rating: 'good' },
        { rows: '100K', estimatedTimeMs: 85, scanType: 'Index Scan', joinsUsed: 1, memoryMB: 18, rating: 'acceptable' },
        { rows: '1M', estimatedTimeMs: 420, scanType: 'Bitmap Heap Scan', joinsUsed: 1, memoryMB: 156, rating: 'warning' },
        { rows: '10M', estimatedTimeMs: 2800, scanType: 'Sequential Scan', joinsUsed: 1, memoryMB: 1024, rating: 'critical' },
      ],
      issues: [
        {
          severity: 'critical',
          title: 'N+1 Query Risk with FETCH JOIN',
          description: 'Using LEFT JOIN FETCH can trigger N+1 queries if the collection is accessed outside the transaction context. With 10M users, this could generate millions of additional queries.',
          impact: 'Potential 100x slowdown at scale due to lazy loading fallback',
        },
        {
          severity: 'warning',
          title: 'LIKE Pattern with Leading Wildcard',
          description: 'If :emailPattern starts with \'%\', the database cannot use the index on email column, forcing a full table scan.',
          impact: 'Query time increases from 12ms to 2800ms at 10M rows',
        },
        {
          severity: 'warning',
          title: 'Missing Index on created_at',
          description: 'The ORDER BY u.createdAt DESC clause requires sorting. Without an index, PostgreSQL must perform an in-memory or disk sort.',
          impact: 'Additional 200-500ms overhead for sorting 1M+ rows',
        },
        {
          severity: 'info',
          title: 'Consider Pagination',
          description: 'The query returns all matching results without LIMIT. For large result sets, consider using Spring Data Pageable or JPQL pagination.',
          impact: 'Memory usage could exceed 1GB for 10M+ matching rows',
        },
      ],
      recommendations: [
        {
          title: 'Add Index on email Column',
          description: 'Create an index on the email column to support LIKE queries with suffix patterns.',
          before: 'SELECT u FROM User u WHERE u.email LIKE :emailPattern',
          after: '-- Add index:\nCREATE INDEX idx_users_email ON users (email varchar_pattern_ops);\n-- Query remains the same but uses index scan',
          estimatedImprovement: '85% faster at 1M rows',
        },
        {
          title: 'Use EntityGraph Instead of FETCH JOIN',
          description: 'Replace LEFT JOIN FETCH with @EntityGraph to have more control over eager loading and avoid N+1 issues.',
          before: 'SELECT u FROM User u LEFT JOIN FETCH u.orders o WHERE ...',
          after: '@EntityGraph(attributePaths = {"orders"})\nList<User> findByEmailAndCreatedAt(...);',
          estimatedImprovement: 'Eliminates N+1 risk',
        },
        {
          title: 'Add Pagination',
          description: 'Add LIMIT/OFFSET or use Spring Data Pageable to control result set size.',
          before: 'SELECT u FROM User u ... ORDER BY u.createdAt DESC',
          after: 'SELECT u FROM User u ... ORDER BY u.createdAt DESC\n-- Using Pageable:\nPage<User> findAll(Specification<User> spec, Pageable pageable);',
          estimatedImprovement: '90% memory reduction',
        },
      ],
      summary: 'The JPA query translates to a LEFT JOIN between users and orders tables. At small scale (1K rows), performance is good with 12ms response time. However, the query degrades significantly at 10M rows (2.8s) due to missing indexes and the N+1 query risk from FETCH JOIN. Three optimizations are recommended: adding an email index, using @EntityGraph, and implementing pagination.',
    });
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

  const issueCount = result?.issues?.length ?? 0;
  const recCount = result?.recommendations?.length ?? 0;

  return (
    <>
      {/* Input Section */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {/* JPQL Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            JPQL / HQL Query
          </label>
          <textarea
            value={jpql}
            onChange={(e) => setJpql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="SELECT u FROM User u WHERE u.email = :email"
            rows={6}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/40 focus:border-aqua-500 resize-y"
          />
          <p className="text-xs text-slate-400 mt-1">
            Press Ctrl+Enter to analyze
          </p>
        </div>

        {/* Dialect + Actions */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Dialect Selector */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Target SQL Dialect
            </label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-slate-200 bg-card text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-aqua-500/40 focus:border-aqua-500 min-w-[160px]"
            >
              {DIALECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={!jpql.trim() || analyzeJPA.isPending}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
              'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-md shadow-aqua-500/20',
              'hover:from-aqua-600 hover:to-aqua-700 hover:shadow-lg hover:shadow-aqua-500/30',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md',
            )}
          >
            {analyzeJPA.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {analyzeJPA.isPending ? 'Analyzing...' : 'Analyze'}
          </button>

          {/* Load Demo Button */}
          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <FlaskConical className="w-4 h-4" />
            Load Demo
          </button>

          {/* Upload .java Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload .java
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".java,.kt,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Copy Report Button (only when results exist) */}
          {result && (
            <button
              onClick={() => copyToClipboard(buildFullReport(), 'report')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors ml-auto"
            >
              {copied === 'report' ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied === 'report' ? 'Copied!' : 'Copy Report'}
            </button>
          )}
        </div>

        {/* Entity Context (expandable) */}
        <div className="border-t border-slate-100 pt-3">
          <button
            onClick={() => setShowEntityContext(!showEntityContext)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            <FileCode className="w-4 h-4" />
            Entity Context
            <span className="text-xs text-slate-400 font-normal">
              (optional)
            </span>
            {showEntityContext ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            )}
          </button>
          {showEntityContext && (
            <div className="mt-2">
              <textarea
                value={entityContext}
                onChange={(e) => setEntityContext(e.target.value)}
                placeholder={`Paste your JPA entity class definitions here for more accurate analysis...\n\n@Entity\npublic class User {\n    @Id\n    @GeneratedValue\n    private Long id;\n\n    @Column(unique = true)\n    private String email;\n\n    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)\n    private List<Order> orders;\n}`}
                rows={8}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/40 focus:border-aqua-500 resize-y"
              />
            </div>
          )}
        </div>
      </div>

      {/* Analysis Progress Stepper */}
      {analyzeJPA.isPending && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {ANALYSIS_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = i === analysisStep;
              const isCompleted = i < analysisStep;
              return (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0',
                      isCompleted ? 'bg-aqua-500 text-white' :
                      isActive ? 'bg-aqua-100 text-aqua-700 ring-2 ring-aqua-500 animate-pulse' :
                      'bg-slate-100 text-slate-400'
                    )}>
                      {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                    </div>
                    <span className={cn('text-xs whitespace-nowrap', isActive ? 'text-aqua-700 font-medium' : isCompleted ? 'text-aqua-600' : 'text-slate-400')}>
                      {step.label}
                    </span>
                  </div>
                  {i < ANALYSIS_STEPS.length - 1 && (
                    <div className={cn('flex-1 h-0.5 min-w-[20px]', isCompleted ? 'bg-aqua-500' : 'bg-slate-200')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-aqua-500 to-cyan-500 h-1.5 rounded-full transition-all duration-500"
                 style={{ width: `${((analysisStep + 1) / ANALYSIS_STEPS.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Error State */}
      {analyzeJPA.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Analysis Failed</p>
            <p className="text-sm text-red-600 mt-1">
              {(analyzeJPA.error as { message?: string })?.message ||
                'An unexpected error occurred. Please check your AI provider configuration and try again.'}
            </p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Analysis Summary
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {result.summary}
              </p>
            </div>
          )}

          {/* Summary Dashboard Cards (6 columns) */}
          {result && (() => {
            const worstRating = result.performanceEstimates.reduce((worst, est) => {
              const order: Record<string, number> = { good: 0, acceptable: 1, warning: 2, critical: 3 };
              return (order[est.rating] || 0) > (order[worst] || 0) ? est.rating : worst;
            }, 'good' as JPAPerformanceEstimate['rating']);
            const criticalIssues = result.issues.filter(i => i.severity === 'critical').length;
            const warningIssues = result.issues.filter(i => i.severity === 'warning').length;
            const maxTime = result.performanceEstimates.length > 0 ? Math.max(...result.performanceEstimates.map(e => e.estimatedTimeMs)) : 0;
            const maxMemory = result.performanceEstimates.length > 0 ? Math.max(...result.performanceEstimates.map(e => e.memoryMB)) : 0;

            return (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Overall Rating', value: worstRating.toUpperCase(), color: worstRating === 'critical' ? 'text-red-600' : worstRating === 'warning' ? 'text-orange-600' : worstRating === 'acceptable' ? 'text-yellow-600' : 'text-emerald-600' },
                  { label: 'Max Latency', value: `${maxTime}ms`, color: maxTime > 500 ? 'text-red-600' : maxTime > 200 ? 'text-orange-600' : 'text-emerald-600' },
                  { label: 'Max Memory', value: `${maxMemory}MB`, color: 'text-violet-600' },
                  { label: 'Critical Issues', value: criticalIssues, color: criticalIssues > 0 ? 'text-red-600' : 'text-emerald-600' },
                  { label: 'Warnings', value: warningIssues, color: warningIssues > 0 ? 'text-amber-600' : 'text-emerald-600' },
                  { label: 'Recommendations', value: result.recommendations.length, color: 'text-aqua-600' },
                ].map(stat => (
                  <div key={stat.label} className="bg-card border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">{stat.label}</p>
                    <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Tab Navigation */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-1 border-b border-slate-200 px-4">
              {RESULT_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                let badge: number | null = null;
                if (tab.id === 'issues') badge = issueCount;
                if (tab.id === 'recommendations') badge = recCount;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                      isActive
                        ? 'border-aqua-500 text-aqua-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {badge !== null && badge > 0 && (
                      <span
                        className={cn(
                          'ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full',
                          tab.id === 'issues'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-aqua-100 text-aqua-600',
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-5 min-h-[300px]">
              {activeTab === 'sql' && (
                <SQLTranslationTab
                  sql={result.sqlTranslation}
                  onCopy={copyToClipboard}
                  copied={copied}
                />
              )}
              {activeTab === 'performance' && (
                <PerformanceTab estimates={result.performanceEstimates} />
              )}
              {activeTab === 'issues' && (
                <IssuesTab issues={result.issues} />
              )}
              {activeTab === 'recommendations' && (
                <RecommendationsTab
                  recommendations={result.recommendations}
                  onCopy={copyToClipboard}
                  copied={copied}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main page component (standalone route) ──────────────────────────────────

export function JPAQueryLabPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-cyan-100 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              JPA Query Lab
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Analyze JPA/JPQL queries for performance issues and optimization
              opportunities
            </p>
          </div>
        </div>
      </div>

      <JPAQueryLabContent />
    </div>
  );
}

// ── Tab: SQL Translation ─────────────────────────────────────────────────────

function SQLTranslationTab({
  sql,
  onCopy,
  copied,
}: {
  sql: string;
  onCopy: (text: string, key: string) => void;
  copied: string | null;
}) {
  if (!sql) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Code2 className="w-10 h-10 mb-3" />
        <p className="text-sm">No SQL translation available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Generated SQL
        </h3>
        <button
          onClick={() => onCopy(sql, 'sql')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          {copied === 'sql' ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied === 'sql' ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
        {highlightSQL(sql)}
      </pre>
    </div>
  );
}

// ── Tab: Performance Report ──────────────────────────────────────────────────

function PerformanceTab({
  estimates,
}: {
  estimates: JPAPerformanceEstimate[];
}) {
  if (!estimates || estimates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <BarChart3 className="w-10 h-10 mb-3" />
        <p className="text-sm">No performance estimates available</p>
      </div>
    );
  }

  const chartData = estimates.map(est => ({
    rows: est.rows,
    time: est.estimatedTimeMs,
    memory: est.memoryMB,
    joins: est.joinsUsed,
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">Performance Estimates by Data Volume</h3>

      {/* Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Response Time Trend */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h5 className="text-xs font-semibold text-slate-700 mb-3">Response Time vs Data Volume</h5>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="rows" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} unit="ms" />
                <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="time" stroke="#0891b2" fill="#0891b2" fillOpacity={0.15} strokeWidth={2} name="Est. Time (ms)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h5 className="text-xs font-semibold text-slate-700 mb-3">Memory Usage vs Data Volume</h5>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="rows" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} unit="MB" />
                <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="memory" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Memory (MB)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Enhanced Table with rating progress bars */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Rows</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Est. Time</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Scan Type</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Joins</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Memory</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-600">Rating</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((est, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-0">
                <td className="py-3 px-4 font-medium text-slate-800">{est.rows}</td>
                <td className="py-3 px-4 font-mono text-slate-700">{est.estimatedTimeMs}ms</td>
                <td className="py-3 px-4 text-slate-700">{est.scanType}</td>
                <td className="py-3 px-4 text-slate-700">{est.joinsUsed}</td>
                <td className="py-3 px-4 font-mono text-slate-700">{est.memoryMB}MB</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={cn('h-2 rounded-full',
                        est.rating === 'good' ? 'bg-emerald-500 w-1/4' :
                        est.rating === 'acceptable' ? 'bg-yellow-500 w-2/4' :
                        est.rating === 'warning' ? 'bg-orange-500 w-3/4' :
                        'bg-red-500 w-full'
                      )} />
                    </div>
                    <span className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                      getRatingColor(est.rating)
                    )}>{est.rating}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400 font-medium">Thresholds:</span>
        {[
          { label: 'Good (<50ms)', cls: 'bg-emerald-100 text-emerald-700' },
          { label: 'Acceptable (<200ms)', cls: 'bg-yellow-100 text-yellow-700' },
          { label: 'Warning (<500ms)', cls: 'bg-orange-100 text-orange-700' },
          { label: 'Critical (>500ms)', cls: 'bg-red-100 text-red-700' },
        ].map(t => (
          <span key={t.label} className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-semibold', t.cls)}>{t.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Issues Found ────────────────────────────────────────────────────────

function IssuesTab({ issues }: { issues: JPAIssue[] }) {
  if (!issues || issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Check className="w-10 h-10 mb-3 text-emerald-400" />
        <p className="text-sm font-medium text-emerald-600">
          No issues found
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Your query looks good!
        </p>
      </div>
    );
  }

  const severityData = [
    { name: 'Critical', value: issues.filter(i => i.severity === 'critical').length, fill: '#ef4444' },
    { name: 'Warning', value: issues.filter(i => i.severity === 'warning').length, fill: '#f59e0b' },
    { name: 'Info', value: issues.filter(i => i.severity === 'info').length, fill: '#3b82f6' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Severity Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h5 className="text-xs font-semibold text-slate-700 mb-2">Severity Distribution</h5>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 mt-1">
            {severityData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-[10px] text-slate-600">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Issues List */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">
            {issues.length} Issue{issues.length !== 1 ? 's' : ''} Found
          </h3>
          {issues.map((issue, idx) => {
            const config = getSeverityConfig(issue.severity);
            const SevIcon = config.icon;
            return (
              <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', config.color)}>
                    <SevIcon className="w-3 h-3" />
                    {config.label}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-800">{issue.title}</h4>
                </div>
                <p className="text-sm text-slate-600">{issue.description}</p>
                <div className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
                  <span className="font-semibold">Impact:</span> {issue.impact}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Recommendations ─────────────────────────────────────────────────────

function RecommendationsTab({
  recommendations,
  onCopy,
  copied,
}: {
  recommendations: JPARecommendation[];
  onCopy: (text: string, key: string) => void;
  copied: string | null;
}) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Lightbulb className="w-10 h-10 mb-3" />
        <p className="text-sm">No additional recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">
        {recommendations.length} Recommendation
        {recommendations.length !== 1 ? 's' : ''}
      </h3>
      {recommendations.map((rec, idx) => (
        <div
          key={idx}
          className="border border-slate-200 rounded-lg p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-aqua-100 text-aqua-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">{rec.title}</h4>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <TrendingUp className="w-3 h-3" />
                  {rec.estimatedImprovement}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{rec.description}</p>
            </div>
          </div>

          {/* Before / After with syntax highlighting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Before */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                  Before
                </span>
                <button
                  onClick={() => onCopy(rec.before, `before-${idx}`)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  title="Copy"
                >
                  {copied === `before-${idx}` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <pre className="bg-[#1e293b] text-slate-100 text-xs font-mono px-3 py-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {highlightSQL(rec.before)}
              </pre>
            </div>

            {/* After */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                  After
                </span>
                <button
                  onClick={() => onCopy(rec.after, `after-${idx}`)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  title="Copy"
                >
                  {copied === `after-${idx}` ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <pre className="bg-[#1e293b] text-slate-100 text-xs font-mono px-3 py-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {highlightSQL(rec.after)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default JPAQueryLabPage;
