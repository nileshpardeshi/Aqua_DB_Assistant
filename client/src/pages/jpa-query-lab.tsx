import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  FlaskConical, Play, Upload, Copy, Check, Loader2, Code2, BarChart3,
  AlertTriangle, Lightbulb, ChevronDown, ChevronUp, FileCode, AlertCircle,
  Info, X, Trash2, FileUp, FolderOpen, Search, Zap,
  Database, RotateCcw, Shield, Clock, Cpu, HardDrive, Activity, CheckCircle2,
  ChevronRight, Gauge, Layers, ArrowRight, Terminal,
  PlayCircle, Filter, SortAsc, SortDesc, FileText, Sparkles, Download,
  Minimize2, Maximize2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/use-projects';
import { useInMemoryDB } from '@/hooks/use-inmemory-db';
import {
  useAnalyzeJPA, useParseJPAFiles, useSampleJPAFiles, useBatchAnalyzeJPA,
  type JPAAnalysisResult, type JPAPerformanceEstimate,
  type ExtractedJPAQuery, type JPAParseResult,
  type BatchQueryResult, type BatchAnalysisResult,
} from '@/hooks/use-jpa-lab';
import {
  useExecuteSandbox, useSandboxStatus,
} from '@/hooks/use-sandbox';

// ── Constants ────────────────────────────────────────────────────────────────

const DIALECT_OPTIONS = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle' },
] as const;

const COMPLEXITY_CONFIG = {
  simple: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Simple' },
  moderate: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Activity, label: 'Moderate' },
  complex: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle, label: 'Complex' },
  critical: { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle, label: 'Critical' },
} as const;

const RATING_CONFIG = {
  good: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200', fill: '#10b981', label: 'Good' },
  acceptable: { color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200', fill: '#f59e0b', label: 'Acceptable' },
  warning: { color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200', fill: '#f97316', label: 'Warning' },
  critical: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200', fill: '#ef4444', label: 'Critical' },
} as const;

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300', icon: AlertCircle, label: 'Critical' },
  warning: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300', icon: AlertTriangle, label: 'Warning' },
  info: { color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300', icon: Info, label: 'Info' },
} as const;

type LabPhase = 'upload' | 'detected';
type ExecutionMode = 'inmemory' | 'sandbox' | 'realdb';
type SortField = 'complexity' | 'methodName' | 'type' | 'className';

// ── Helpers ──────────────────────────────────────────────────────────────────

function highlightSQL(sql: string): React.ReactNode {
  const keywordPattern = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|INSERT|UPDATE|DELETE|SET|VALUES|CREATE|ALTER|DROP|INDEX|TABLE|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|FETCH|FUNCTION|NULL|IS|DESC|ASC|UNION|ALL|WITH|RECURSIVE)\b/gi;
  const parts = sql.split(keywordPattern);
  // After split with a capturing group, odd-index parts are the captured keywords
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="text-blue-600 dark:text-blue-400 font-bold">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function formatMs(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Generates SQLite CREATE TABLE + INSERT statements for tables referenced in a SELECT query.
 * Extracts column names from the query and creates tables with sample data for in-memory testing.
 */
function generateScaffoldSQL(sql: string): string {
  const upper = sql.toUpperCase();
  // Only scaffold for SELECT queries
  if (!upper.trimStart().startsWith('SELECT')) return '';

  // Extract table names and aliases from FROM/JOIN clauses
  const tableAliasRe = /(?:FROM|JOIN)\s+["']?(\w+)["']?(?:\s+(?:AS\s+)?(\w+))?/gi;
  const tables = new Map<string, string>(); // tableName → alias
  let m: RegExpExecArray | null;
  while ((m = tableAliasRe.exec(sql)) !== null) {
    const name = m[1];
    const alias = m[2] || m[1];
    // Skip SQL keywords that might match
    if (/^(SELECT|WHERE|AND|OR|ON|SET|VALUES|GROUP|ORDER|HAVING|LIMIT|INNER|LEFT|RIGHT|OUTER|CROSS|NATURAL)$/i.test(name)) continue;
    tables.set(name, alias);
  }

  if (tables.size === 0) return '';

  // Extract columns referenced for each table (via alias.column or table.column patterns)
  const colRefs = new Map<string, Set<string>>(); // tableName → columns
  for (const [tName] of tables) colRefs.set(tName, new Set());

  // Match alias.column patterns
  const dotColRe = /(\w+)\.(\w+)/g;
  while ((m = dotColRe.exec(sql)) !== null) {
    const prefix = m[1];
    const col = m[2];
    // Find which table this alias/name refers to
    for (const [tName, tAlias] of tables) {
      if (prefix.toLowerCase() === tAlias.toLowerCase() || prefix.toLowerCase() === tName.toLowerCase()) {
        colRefs.get(tName)!.add(col);
      }
    }
  }

  // Generate CREATE TABLE + INSERT for each table
  const stmts: string[] = [];
  const sampleRows = 20;

  for (const [tName, _alias] of tables) {
    const cols = colRefs.get(tName) ?? new Set<string>();
    // Ensure at least an id column
    if (cols.size === 0) cols.add('id');
    if (!Array.from(cols).some(c => c.toLowerCase() === 'id')) {
      cols.add('id');
    }

    const colList = Array.from(cols);
    const colDefs = colList.map(c => {
      const cl = c.toLowerCase();
      if (cl === 'id') return `"${c}" INTEGER PRIMARY KEY`;
      if (cl.endsWith('_id') || cl.endsWith('Id')) return `"${c}" INTEGER`;
      if (cl.includes('price') || cl.includes('amount') || cl.includes('total') || cl.includes('balance') || cl.includes('rating') || cl.includes('cost')) return `"${c}" REAL`;
      if (cl.includes('quantity') || cl.includes('count') || cl.includes('age') || cl.includes('status')) return `"${c}" INTEGER`;
      if (cl.includes('date') || cl.includes('time') || cl.includes('created') || cl.includes('updated')) return `"${c}" TEXT`;
      if (cl.includes('active') || cl.includes('enabled') || cl.includes('flag')) return `"${c}" INTEGER`;
      return `"${c}" TEXT`;
    });

    stmts.push(`CREATE TABLE IF NOT EXISTS "${tName}" (${colDefs.join(', ')});`);

    // Generate sample data
    for (let i = 1; i <= sampleRows; i++) {
      const vals = colList.map(c => {
        const cl = c.toLowerCase();
        if (cl === 'id') return String(i);
        if (cl.endsWith('_id') || cl.endsWith('Id')) return String(1 + (i % 5));
        if (cl.includes('price') || cl.includes('cost')) return (10 + Math.random() * 990).toFixed(2);
        if (cl.includes('amount') || cl.includes('total') || cl.includes('balance')) return (100 + Math.random() * 9900).toFixed(2);
        if (cl.includes('rating')) return (1 + Math.random() * 4).toFixed(1);
        if (cl.includes('quantity') || cl.includes('count')) return String(Math.floor(1 + Math.random() * 100));
        if (cl.includes('status')) return String(Math.floor(Math.random() * 4));
        if (cl.includes('active') || cl.includes('enabled') || cl.includes('flag')) return String(Math.random() > 0.3 ? 1 : 0);
        if (cl.includes('date') || cl.includes('time') || cl.includes('created') || cl.includes('updated')) {
          const d = new Date(2024, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28));
          return `'${d.toISOString().slice(0, 10)}'`;
        }
        if (cl === 'name' || cl.includes('name')) return `'${tName.replace(/s$/, '')}_${i}'`;
        if (cl === 'email') return `'user${i}@example.com'`;
        if (cl === 'sku') return `'SKU-${String(i).padStart(4, '0')}'`;
        if (cl.includes('description') || cl.includes('desc')) return `'Description for item ${i}'`;
        return `'${c}_val_${i}'`;
      });
      stmts.push(`INSERT INTO "${tName}" (${colList.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')});`);
    }
  }

  return stmts.join('\n');
}

function handleCopyText(text: string, setCopied: (v: string | null) => void, field: string) {
  try {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  } catch {
    /* ignore */
  }
}

/**
 * Generate a PDF report from the batch AI analysis results.
 */
function downloadAnalysisPDF(
  batchResult: BatchAnalysisResult,
  allQueries: ExtractedJPAQuery[],
  dialect: string,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Title ──
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 18, 60); // rose-700
  doc.text('JPA Query Analysis Report', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Dialect: ${dialect.toUpperCase()}  |  Model: ${batchResult.model}`, margin, y);
  y += 4;
  doc.text(`Tokens used: ${(batchResult.usage.inputTokens + batchResult.usage.outputTokens).toLocaleString()}`, margin, y);
  y += 6;

  // ── Divider ──
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Summary ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Summary', margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const summaryLines = doc.splitTextToSize(batchResult.analysis.summary, contentW);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4 + 4;

  // ── Rating overview ──
  const ratings = { good: 0, acceptable: 0, warning: 0, critical: 0 };
  for (const r of batchResult.analysis.results) ratings[r.overallRating]++;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ratings:  Good: ${ratings.good}  |  Acceptable: ${ratings.acceptable}  |  Warning: ${ratings.warning}  |  Critical: ${ratings.critical}`, margin, y);
  y += 8;

  // ── Per-query details ──
  for (const result of batchResult.analysis.results) {
    checkPage(50);
    const origQuery = allQueries.find(q => q.id === result.queryId);

    // Query header
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    const ratingLabel = result.overallRating.toUpperCase();
    doc.text(`${result.methodName}()  [${ratingLabel}]`, margin, y);
    y += 4;

    if (origQuery) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`${origQuery.className} · ${origQuery.fileName}:${origQuery.lineNumber} · ${origQuery.type.toUpperCase()}`, margin, y);
      y += 4;

      // Original query
      checkPage(15);
      doc.setFontSize(8);
      doc.setFont('courier', 'normal');
      doc.setTextColor(80, 80, 80);
      const origLines = doc.splitTextToSize(origQuery.query, contentW);
      doc.text(origLines.slice(0, 4), margin, y);
      y += Math.min(origLines.length, 4) * 3.5 + 3;
    }

    // SQL Translation
    if (result.sqlTranslation) {
      checkPage(15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald
      doc.text('SQL Translation:', margin, y);
      y += 4;
      doc.setFontSize(8);
      doc.setFont('courier', 'normal');
      doc.setTextColor(60, 60, 60);
      const sqlLines = doc.splitTextToSize(result.sqlTranslation, contentW);
      doc.text(sqlLines.slice(0, 6), margin, y);
      y += Math.min(sqlLines.length, 6) * 3.5 + 3;
    }

    // Execution plan
    if (result.executionPlan) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const planLines = doc.splitTextToSize(`Plan: ${result.executionPlan}`, contentW);
      doc.text(planLines.slice(0, 2), margin, y);
      y += Math.min(planLines.length, 2) * 3.5 + 2;
    }

    // Performance estimates
    if (result.performanceEstimates.length > 0) {
      checkPage(12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Performance at Scale:', margin, y);
      y += 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      for (const pe of result.performanceEstimates) {
        doc.setTextColor(60, 60, 60);
        doc.text(
          `${pe.rows} rows → ${formatMs(pe.estimatedTimeMs)} | ${pe.scanType} | ${pe.memoryMB}MB | ${pe.joinsUsed} joins | ${pe.rating.toUpperCase()}`,
          margin + 2, y,
        );
        y += 3.5;
      }
      y += 2;
    }

    // Issues
    if (result.issues.length > 0) {
      checkPage(10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68); // red
      doc.text(`Issues (${result.issues.length}):`, margin, y);
      y += 4;
      for (const issue of result.issues) {
        checkPage(10);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(`[${issue.severity.toUpperCase()}] ${issue.title}`, margin + 2, y);
        y += 3.5;
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(issue.description, contentW - 4);
        doc.text(descLines.slice(0, 2), margin + 2, y);
        y += Math.min(descLines.length, 2) * 3.5 + 1;
      }
      y += 2;
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      checkPage(10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(245, 158, 11); // amber
      doc.text(`Recommendations (${result.recommendations.length}):`, margin, y);
      y += 4;
      for (const rec of result.recommendations) {
        checkPage(12);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(`${rec.title} (${rec.estimatedImprovement})`, margin + 2, y);
        y += 3.5;
        doc.setFont('helvetica', 'normal');
        const recLines = doc.splitTextToSize(rec.description, contentW - 4);
        doc.text(recLines.slice(0, 2), margin + 2, y);
        y += Math.min(recLines.length, 2) * 3.5 + 1;
        if (rec.before) {
          doc.setFont('courier', 'normal');
          doc.setTextColor(200, 60, 60);
          const bLines = doc.splitTextToSize(`Before: ${rec.before}`, contentW - 4);
          doc.text(bLines.slice(0, 2), margin + 2, y);
          y += Math.min(bLines.length, 2) * 3.5;
          doc.setTextColor(16, 150, 100);
          const aLines = doc.splitTextToSize(`After:  ${rec.after}`, contentW - 4);
          doc.text(aLines.slice(0, 2), margin + 2, y);
          y += Math.min(aLines.length, 2) * 3.5 + 2;
        }
      }
      y += 2;
    }

    y += 3;
  }

  // ── Footer on each page ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Aqua DB Copilot — JPA Analysis Report — Page ${p} of ${totalPages}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  doc.save(`jpa-analysis-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── JPAQueryLabContent (embeddable in Performance Lab) ───────────────────────

export function JPAQueryLabContent() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);
  const dialect = project?.dialect || 'postgresql';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<LabPhase>('upload');
  const [selectedDialect, setSelectedDialect] = useState(dialect);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [parsedResults, setParsedResults] = useState<JPAParseResult[]>([]);
  const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('complexity');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [batchResult, setBatchResult] = useState<BatchAnalysisResult | null>(null);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('inmemory');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [entityContext, setEntityContext] = useState('');
  const [showEntityInput, setShowEntityInput] = useState(false);

  // Single query analysis (for individual run)
  const [singleResult, setSingleResult] = useState<JPAAnalysisResult | null>(null);
  const [singleQueryId, setSingleQueryId] = useState<string | null>(null);
  const [quickResultCollapsed, setQuickResultCollapsed] = useState(false);

  // ── Hooks ──────────────────────────────────────────────────────────────
  const parseFiles = useParseJPAFiles();
  const { data: sampleFiles } = useSampleJPAFiles();
  const batchAnalyze = useBatchAnalyzeJPA();
  const singleAnalyze = useAnalyzeJPA();
  const inMemoryDb = useInMemoryDB();
  const executeSandbox = useExecuteSandbox();
  const _sandboxStatus = useSandboxStatus(projectId);

  // ── All queries flattened ──────────────────────────────────────────────
  const allQueries = useMemo(() => {
    return parsedResults.flatMap((pr) => pr.queries);
  }, [parsedResults]);

  const filteredQueries = useMemo(() => {
    let list = filterType === 'all' ? allQueries : allQueries.filter((q) => q.type === filterType);
    const complexityOrder: Record<string, number> = { critical: 0, complex: 1, moderate: 2, simple: 3 };
    list = [...list].sort((a, b) => {
      if (sortField === 'complexity') {
        const diff = (complexityOrder[a.complexity] ?? 3) - (complexityOrder[b.complexity] ?? 3);
        return sortAsc ? -diff : diff;
      }
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return list;
  }, [allQueries, filterType, sortField, sortAsc]);

  // Stats
  const stats = useMemo(() => {
    const total = allQueries.length;
    const byComplexity: Record<string, number> = { simple: 0, moderate: 0, complex: 0, critical: 0 };
    const byType: Record<string, number> = { jpql: 0, hql: 0, native: 0, criteria: 0 };
    let nPlusOne = 0;
    let fetchJoin = 0;
    for (const q of allQueries) {
      byComplexity[q.complexity] = (byComplexity[q.complexity] ?? 0) + 1;
      byType[q.type] = (byType[q.type] ?? 0) + 1;
      if (q.hasNPlusOne) nPlusOne++;
      if (q.hasFetchJoin) fetchJoin++;
    }
    return { total, byComplexity, byType, nPlusOne, fetchJoin };
  }, [allQueries]);

  // ── File Upload Handler ────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const newFiles: { name: string; content: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.name.endsWith('.java') || file.name.endsWith('.kt')) {
        const content = await file.text();
        newFiles.push({ name: file.name, content });
      }
    }

    if (newFiles.length === 0) return;

    const allFiles = [...uploadedFiles, ...newFiles];
    setUploadedFiles(allFiles);

    const results = await parseFiles.mutateAsync(allFiles);
    setParsedResults(results);

    const allIds = new Set(results.flatMap((r) => r.queries.map((q) => q.id)));
    setSelectedQueries(allIds);
    setPhase('detected');

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadedFiles, parseFiles]);

  // ── Load Sample Files ──────────────────────────────────────────────────
  const handleLoadSamples = useCallback(async () => {
    if (!sampleFiles || sampleFiles.length === 0) return;
    setUploadedFiles(sampleFiles);

    const results = await parseFiles.mutateAsync(sampleFiles);
    setParsedResults(results);

    const allIds = new Set(results.flatMap((r) => r.queries.map((q) => q.id)));
    setSelectedQueries(allIds);
    setPhase('detected');
  }, [sampleFiles, parseFiles]);

  // ── Run Batch Analysis ─────────────────────────────────────────────────
  const handleBatchAnalyze = useCallback(async () => {
    const selected = allQueries.filter((q) => selectedQueries.has(q.id));
    if (selected.length === 0) return;

    const result = await batchAnalyze.mutateAsync({
      queries: selected,
      dialect: selectedDialect,
      entityContext: entityContext || undefined,
    });

    setBatchResult(result);
    if (result.analysis.results.length > 0) {
      setActiveQueryId(result.analysis.results[0].queryId);
    }
  }, [allQueries, selectedQueries, selectedDialect, entityContext, batchAnalyze]);

  // ── Run Single Query Analysis ──────────────────────────────────────────
  const handleSingleAnalyze = useCallback(async (query: ExtractedJPAQuery) => {
    setSingleQueryId(query.id);
    setSingleResult(null);
    setQuickResultCollapsed(false);
    const result = await singleAnalyze.mutateAsync({
      jpql: query.query,
      dialect: selectedDialect,
      entityContext: entityContext || undefined,
    });
    setSingleResult(result);
  }, [selectedDialect, entityContext, singleAnalyze]);

  // ── Execute SQL (3 modes) ──────────────────────────────────────────────
  const handleExecuteSQL = useCallback(async (sql: string) => {
    if (executionMode === 'inmemory') {
      // Generate scaffold CREATE TABLE + INSERT statements so the SELECT can run
      const scaffold = generateScaffoldSQL(sql);
      const fullSQL = scaffold ? `${scaffold}\n${sql}` : sql;
      await inMemoryDb.execute(fullSQL);
    } else if (executionMode === 'sandbox' && projectId) {
      const tableMatch = sql.match(/(?:FROM|JOIN|INTO|UPDATE)\s+["']?(\w+)["']?/gi);
      const tableNames = tableMatch
        ? [...new Set(tableMatch.map((m) => m.replace(/^(?:FROM|JOIN|INTO|UPDATE)\s+["']?/i, '').replace(/["']$/, '')))]
        : ['query_result'];
      await executeSandbox.mutateAsync({
        projectId,
        sql: `-- JPA Lab execution\n${sql}`,
        tableNames,
      });
    }
  }, [executionMode, projectId, inMemoryDb, executeSandbox]);

  // ── Toggle query selection ─────────────────────────────────────────────
  const toggleQuery = useCallback((id: string) => {
    setSelectedQueries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedQueries.size === filteredQueries.length) {
      setSelectedQueries(new Set());
    } else {
      setSelectedQueries(new Set(filteredQueries.map((q) => q.id)));
    }
  }, [filteredQueries, selectedQueries]);

  // ── Reset ──────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setUploadedFiles([]);
    setParsedResults([]);
    setSelectedQueries(new Set());
    setBatchResult(null);
    setSingleResult(null);
    setSingleQueryId(null);
    setActiveQueryId(null);
    setPhase('upload');
    inMemoryDb.cleanup();
  }, [inMemoryDb]);

  // ── Active batch query result ──────────────────────────────────────────
  const activeResult = useMemo(() => {
    if (!batchResult || !activeQueryId) return null;
    return batchResult.analysis.results.find((r) => r.queryId === activeQueryId) ?? null;
  }, [batchResult, activeQueryId]);

  const activeOriginalQuery = useMemo(() => {
    return allQueries.find((q) => q.id === activeQueryId) ?? null;
  }, [allQueries, activeQueryId]);

  // ═══════════════════════════════════════════════════════════════════════
  // ══ RENDER ═════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* ── Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/50 dark:to-pink-900/50 flex items-center justify-center">
            <FlaskConical className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">JPA Query Lab</h3>
            <p className="text-xs text-muted-foreground">
              Upload Java files, auto-detect JPA queries, analyze performance on millions of rows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDialect}
            onChange={(e) => setSelectedDialect(e.target.value)}
            className="h-8 px-3 text-xs border border-border rounded-lg bg-card text-foreground focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
          >
            {DIALECT_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {phase !== 'upload' && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════ PHASE 1: UPLOAD ═══════════════ */}
      {phase === 'upload' && (
        <div className="space-y-4">
          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".java,.kt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/50 dark:to-pink-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileUp className="w-8 h-8 text-rose-500" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-1">
              Upload Java / Kotlin Files
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Drag & drop or click to browse. Supports <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.java</code> and <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.kt</code> files.
            </p>
            <p className="text-xs text-muted-foreground">
              Auto-detects @Query, EntityManager.createQuery, @NamedQuery, and Criteria API patterns
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">or try samples</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Sample Files */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-rose-50/30 dark:from-slate-900/50 dark:to-rose-950/20 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="w-4.5 h-4.5 text-rose-500" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Sample JPA Files</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pre-loaded repositories with common JPA patterns and anti-patterns
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLoadSamples}
                  disabled={parseFiles.isPending || !sampleFiles}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                    parseFiles.isPending
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md',
                  )}
                >
                  {parseFiles.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Load All Samples</>
                  )}
                </button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(sampleFiles ?? []).map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:border-rose-300 transition-colors"
                >
                  <FileCode className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {f.content.split('\n').length} lines
                    </p>
                  </div>
                </div>
              ))}
              {!sampleFiles && (
                <div className="col-span-full flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading samples...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ PHASE 2: DETECTED QUERIES ═══════════════ */}
      {phase === 'detected' && (
        <div className="space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Queries', value: stats.total, icon: Search, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40' },
              { label: 'JPQL', value: stats.byType.jpql ?? 0, icon: Code2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
              { label: 'Native SQL', value: stats.byType.native ?? 0, icon: Terminal, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40' },
              { label: 'N+1 Risk', value: stats.nPlusOne, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/40' },
              { label: 'Fetch Join', value: stats.fetchJoin, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
              { label: 'Files Parsed', value: parsedResults.length, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
                    <Icon className={cn('w-4 h-4', s.color)} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide mt-0.5">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Uploaded Files */}
          <div className="flex items-center gap-2 flex-wrap">
            {uploadedFiles.map((f) => (
              <span key={f.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-lg">
                <FileCode className="w-3.5 h-3.5 text-orange-500" />
                {f.name}
                <button
                  onClick={() => {
                    const remaining = uploadedFiles.filter((uf) => uf.name !== f.name);
                    setUploadedFiles(remaining);
                    if (remaining.length > 0) {
                      parseFiles.mutateAsync(remaining).then((r) => {
                        setParsedResults(r);
                        setSelectedQueries(new Set(r.flatMap((pr) => pr.queries.map((q) => q.id))));
                      });
                    } else {
                      handleReset();
                    }
                  }}
                  className="ml-1 text-muted-foreground hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Add More Files
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".java,.kt" onChange={handleFileUpload} className="hidden" />
          </div>

          {/* Entity Context Toggle */}
          <div>
            <button
              onClick={() => setShowEntityInput(!showEntityInput)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showEntityInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Optional: Paste Entity Definitions for Better Analysis
            </button>
            {showEntityInput && (
              <textarea
                value={entityContext}
                onChange={(e) => setEntityContext(e.target.value)}
                placeholder="Paste your JPA entity classes here for more accurate analysis..."
                className="mt-2 w-full h-32 px-4 py-3 text-xs font-mono border border-border rounded-lg bg-card text-foreground resize-y focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 py-2 border-y border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAll}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
              >
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                  selectedQueries.size === filteredQueries.length && filteredQueries.length > 0
                    ? 'bg-rose-500 border-rose-500'
                    : selectedQueries.size > 0
                      ? 'bg-rose-300 border-rose-300'
                      : 'border-rose-400',
                )}>
                  {selectedQueries.size === filteredQueries.length && filteredQueries.length > 0 && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                  {selectedQueries.size > 0 && selectedQueries.size < filteredQueries.length && (
                    <div className="w-2 h-0.5 bg-white rounded" />
                  )}
                </div>
                {selectedQueries.size === filteredQueries.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-xs text-muted-foreground font-medium">
                {selectedQueries.size} of {filteredQueries.length} selected
              </span>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                {['all', 'jpql', 'native', 'criteria'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors',
                      filterType === t
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-700 dark:text-rose-300'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t === 'all' ? 'All' : t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                {sortAsc ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
              </button>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="h-7 px-2 text-[10px] border border-border rounded bg-card text-foreground"
              >
                <option value="complexity">Complexity</option>
                <option value="methodName">Method</option>
                <option value="type">Type</option>
                <option value="className">Class</option>
              </select>
              <span className="w-px h-5 bg-border" />
              <button
                onClick={handleBatchAnalyze}
                disabled={selectedQueries.size === 0 || batchAnalyze.isPending}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all shadow-sm',
                  selectedQueries.size === 0 || batchAnalyze.isPending
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 hover:shadow-md',
                )}
              >
                {batchAnalyze.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> AI Analyze ({selectedQueries.size})</>
                )}
              </button>
            </div>
          </div>

          {/* Query Cards */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredQueries.map((q) => {
              const cCfg = COMPLEXITY_CONFIG[q.complexity];
              const CIcon = cCfg.icon;
              const isSelected = selectedQueries.has(q.id);
              return (
                <div
                  key={q.id}
                  className={cn(
                    'border rounded-xl p-4 transition-all cursor-pointer',
                    isSelected
                      ? 'border-rose-300 bg-rose-50/30 dark:bg-rose-950/20 dark:border-rose-700'
                      : 'border-border bg-card hover:border-rose-200',
                  )}
                  onClick={() => toggleQuery(q.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      isSelected ? 'bg-rose-500 border-rose-500' : 'border-border',
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">
                          {q.className}.<span className="text-rose-600">{q.methodName}</span>()
                        </span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border rounded-full', cCfg.color)}>
                          <CIcon className="w-3 h-3" />
                          {cCfg.label}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full uppercase">
                          {q.type}
                        </span>
                        {q.annotations.map((a) => (
                          <span key={a} className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded">
                            {a}
                          </span>
                        ))}
                      </div>

                      <div className="mt-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/70 rounded-lg border border-border/50 overflow-x-auto">
                        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                          {highlightSQL(q.query)}
                        </pre>
                      </div>

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {q.hasNPlusOne && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-full">
                            <AlertCircle className="w-3 h-3" /> N+1 Risk
                          </span>
                        )}
                        {q.hasFetchJoin && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Fetch Join
                          </span>
                        )}
                        {q.hasAggregation && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-full">
                            <BarChart3 className="w-3 h-3" /> Aggregation
                          </span>
                        )}
                        {q.hasSubquery && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 rounded-full">
                            <Layers className="w-3 h-3" /> Subquery
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {q.fileName}:{q.lineNumber}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleSingleAnalyze(q); }}
                      disabled={singleAnalyze.isPending && singleQueryId === q.id}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                    >
                      {singleAnalyze.isPending && singleQueryId === q.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      Quick
                    </button>
                  </div>

                  {singleResult && singleQueryId === q.id && (
                    <div className="mt-3 border-t border-border/50 pt-3" onClick={(e) => e.stopPropagation()}>
                      {/* Quick Result Toolbar */}
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setQuickResultCollapsed(!quickResultCollapsed)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                        >
                          {quickResultCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                          {quickResultCollapsed ? 'Expand Result' : 'Collapse Result'}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const text = [
                                `Summary: ${singleResult.summary}`,
                                `SQL: ${singleResult.sqlTranslation}`,
                                ...singleResult.performanceEstimates.map(pe =>
                                  `${pe.rows} rows → ${formatMs(pe.estimatedTimeMs)} | ${pe.scanType} | ${pe.memoryMB}MB | ${pe.rating}`),
                                ...singleResult.issues.map(i => `[${i.severity}] ${i.title}: ${i.description}`),
                                ...singleResult.recommendations.map(r => `${r.title}: ${r.description} (${r.estimatedImprovement})`),
                              ].join('\n');
                              handleCopyText(text, setCopiedField, 'quick-full');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md transition-colors"
                            title="Copy full result"
                          >
                            {copiedField === 'quick-full' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </button>
                          <button
                            onClick={() => { setSingleResult(null); setSingleQueryId(null); }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-red-600 bg-muted/50 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                            title="Clear result"
                          >
                            <X className="w-3 h-3" />
                            Clear
                          </button>
                        </div>
                      </div>
                      {!quickResultCollapsed && (
                        <SingleQueryInlineResult result={singleResult} copiedField={copiedField} setCopied={setCopiedField} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between py-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {selectedQueries.size} queries selected for batch analysis
            </div>
            <button
              onClick={handleBatchAnalyze}
              disabled={selectedQueries.size === 0 || batchAnalyze.isPending}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm',
                selectedQueries.size === 0 || batchAnalyze.isPending
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 hover:shadow-lg hover:shadow-rose-500/25',
              )}
            >
              {batchAnalyze.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing {selectedQueries.size} queries...</>
              ) : (
                <><Play className="w-4 h-4" /> AI Analyze {selectedQueries.size} Queries</>
              )}
            </button>
          </div>

          {/* ═══════════════ BATCH RESULTS (inline below queries) ═══════════════ */}
          {batchResult && (
            <div className="space-y-4 border-t-2 border-rose-200 dark:border-rose-800 pt-6">
              {/* Summary Banner */}
              <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI Analysis Report — {batchResult.analysis.results.length} Queries
                    </h4>
                    <p className="text-xs text-rose-700/80 dark:text-rose-300/70 mt-1 max-w-2xl leading-relaxed">
                      {batchResult.analysis.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <div className="text-right text-[10px] text-muted-foreground">
                      <p>{batchResult.model}</p>
                      <p>{(batchResult.usage.inputTokens + batchResult.usage.outputTokens).toLocaleString()} tokens</p>
                    </div>
                    <button
                      onClick={() => downloadAnalysisPDF(batchResult, allQueries, selectedDialect)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white/60 dark:bg-white/10 border border-rose-200 dark:border-rose-700 rounded-lg hover:bg-white dark:hover:bg-white/20 transition-colors"
                      title="Download PDF report"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={() => setBatchResult(null)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-white/50 dark:hover:bg-white/10"
                      title="Dismiss report"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-3">
                  {(['good', 'acceptable', 'warning', 'critical'] as const).map((rating) => {
                    const count = batchResult.analysis.results.filter((r) => r.overallRating === rating).length;
                    const cfg = RATING_CONFIG[rating];
                    return (
                      <div key={rating} className={cn('px-3 py-2 rounded-lg border text-center', cfg.bg, cfg.border)}>
                        <p className={cn('text-lg font-bold', cfg.color)}>{count}</p>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">{cfg.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Execution Mode Selector */}
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {([
                    { id: 'inmemory' as const, label: 'In-Memory', icon: Cpu, badge: 'SQLite' },
                    { id: 'sandbox' as const, label: 'Sandbox', icon: Shield, badge: 'PostgreSQL' },
                    { id: 'realdb' as const, label: 'Real DB', icon: Database, badge: 'Live' },
                  ]).map((m) => {
                    const MIcon = m.icon;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setExecutionMode(m.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                          executionMode === m.id
                            ? 'bg-white dark:bg-slate-700 text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <MIcon className="w-3.5 h-3.5" />
                        {m.label}
                        <span className={cn(
                          'px-1 py-0.5 text-[8px] font-bold rounded',
                          m.id === 'inmemory' ? 'bg-blue-100 text-blue-700' :
                          m.id === 'sandbox' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-amber-100 text-amber-700',
                        )}>
                          {m.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Results Layout */}
              <div className="flex gap-4">
                {/* Sidebar */}
                <div className="w-72 flex-shrink-0 border border-border rounded-xl overflow-hidden bg-card">
                  <div className="px-3 py-2 border-b border-border bg-muted/50">
                    <p className="text-xs font-semibold text-foreground">
                      {batchResult.analysis.results.length} Query Results
                    </p>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {batchResult.analysis.results.map((r) => {
                      const rCfg = RATING_CONFIG[r.overallRating] ?? RATING_CONFIG.good;
                      const isActive = r.queryId === activeQueryId;
                      return (
                        <button
                          key={r.queryId}
                          onClick={() => setActiveQueryId(r.queryId)}
                          className={cn(
                            'w-full text-left px-3 py-3 border-b border-border/50 transition-colors',
                            isActive ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-muted/50',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                              {r.methodName}()
                            </span>
                            <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded border', rCfg.bg, rCfg.border, rCfg.color)}>
                              {rCfg.label}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{r.issues.length} issues</span>
                            <span>{r.recommendations.length} tips</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Detail Panel */}
                <div className="flex-1 min-w-0">
                  {activeResult ? (
                    <QueryDetailPanel
                      result={activeResult}
                      originalQuery={activeOriginalQuery}
                      copiedField={copiedField}
                      setCopied={setCopiedField}
                      executionMode={executionMode}
                      onExecute={handleExecuteSQL}
                      inMemoryResult={inMemoryDb.result}
                      isExecuting={inMemoryDb.isExecuting || executeSandbox.isPending}
                      executionError={inMemoryDb.error || (executeSandbox.error ? String((executeSandbox.error as Record<string, unknown>).message || executeSandbox.error) : null)}
                      sandboxResult={executeSandbox.data ?? null}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
                      <p className="text-sm text-muted-foreground">Select a query from the sidebar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ══ SUB-COMPONENTS ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function SingleQueryInlineResult({
  result,
  copiedField,
  setCopied,
}: {
  result: JPAAnalysisResult;
  copiedField: string | null;
  setCopied: (v: string | null) => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>('perf');
  const worstRating = result.performanceEstimates.length > 0
    ? result.performanceEstimates[result.performanceEstimates.length - 1]?.rating ?? 'good'
    : 'good';
  const worstCfg = RATING_CONFIG[worstRating];

  return (
    <div className="space-y-3 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/30 rounded-lg p-3">
      {/* Summary with overall rating */}
      <div className="flex items-start gap-3">
        <div className={cn('px-2 py-1 rounded-md border text-[10px] font-bold flex-shrink-0', worstCfg.bg, worstCfg.border, worstCfg.color)}>
          {worstCfg.label}
        </div>
        <p className="text-xs text-foreground leading-relaxed">{result.summary}</p>
      </div>

      {/* Performance Estimates */}
      {result.performanceEstimates.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'perf' ? null : 'perf')}
            className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground mb-2"
          >
            {expandedSection === 'perf' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Gauge className="w-3 h-3" />
            Performance at Scale
          </button>
          {expandedSection === 'perf' && (
            <div className="grid grid-cols-4 gap-2">
              {result.performanceEstimates.map((pe) => {
                const cfg = RATING_CONFIG[pe.rating] ?? RATING_CONFIG.good;
                return (
                  <div key={pe.rows} className={cn('px-3 py-2.5 rounded-lg border text-center', cfg.bg, cfg.border)}>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{pe.rows} rows</p>
                    <p className={cn('text-base font-black mt-0.5', cfg.color)}>{formatMs(pe.estimatedTimeMs)}</p>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
                        <Cpu className="w-2.5 h-2.5" /> {pe.scanType}
                      </p>
                      <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
                        <HardDrive className="w-2.5 h-2.5" /> {pe.memoryMB} MB
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SQL Translation */}
      <div>
        <button
          onClick={() => setExpandedSection(expandedSection === 'sql' ? null : 'sql')}
          className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground mb-2"
        >
          {expandedSection === 'sql' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <Code2 className="w-3 h-3" />
          SQL Translation
        </button>
        {expandedSection === 'sql' && (
          <div className="relative">
            <button
              onClick={() => handleCopyText(result.sqlTranslation, setCopied, 'inline-sql')}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground z-10"
            >
              {copiedField === 'inline-sql' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
            <pre className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {highlightSQL(result.sqlTranslation)}
            </pre>
          </div>
        )}
      </div>

      {/* Issues */}
      {result.issues.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'issues' ? null : 'issues')}
            className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground mb-2"
          >
            {expandedSection === 'issues' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <AlertTriangle className="w-3 h-3" />
            Issues ({result.issues.length})
          </button>
          {expandedSection === 'issues' && (
            <div className="space-y-1.5">
              {result.issues.map((issue, i) => {
                const sCfg = SEVERITY_CONFIG[issue.severity];
                const SIcon = sCfg.icon;
                return (
                  <div key={i} className={cn('flex items-start gap-2 px-3 py-2 rounded-lg border', sCfg.color)}>
                    <SIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{issue.title}</p>
                      <p className="text-[10px] opacity-80 mt-0.5">{issue.description}</p>
                      {issue.impact && <p className="text-[9px] opacity-60 mt-0.5">Impact: {issue.impact}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedSection(expandedSection === 'recs' ? null : 'recs')}
            className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground mb-2"
          >
            {expandedSection === 'recs' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Lightbulb className="w-3 h-3" />
            Recommendations ({result.recommendations.length})
          </button>
          {expandedSection === 'recs' && (
            <div className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <div key={i} className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lightbulb className="w-3 h-3 text-amber-500" />
                        {rec.title}
                      </p>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded">
                        {rec.estimatedImprovement}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{rec.description}</p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-amber-200 dark:divide-amber-800">
                    <div className="p-2">
                      <p className="text-[9px] font-bold text-red-500 uppercase mb-1">Before</p>
                      <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap">{rec.before}</pre>
                    </div>
                    <div className="p-2">
                      <p className="text-[9px] font-bold text-emerald-500 uppercase mb-1">After</p>
                      <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap">{rec.after}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueryDetailPanel({
  result,
  originalQuery,
  copiedField,
  setCopied,
  executionMode,
  onExecute,
  inMemoryResult,
  isExecuting,
  executionError,
  sandboxResult,
}: {
  result: BatchQueryResult;
  originalQuery: ExtractedJPAQuery | null;
  copiedField: string | null;
  setCopied: (v: string | null) => void;
  executionMode: ExecutionMode;
  onExecute: (sql: string) => void;
  inMemoryResult: ReturnType<typeof useInMemoryDB>['result'];
  isExecuting: boolean;
  executionError: string | null;
  sandboxResult: { tables: { tableName: string; rowCount: number; durationMs: number; status: string; error?: string }[]; totalDurationMs: number } | null;
}) {
  const [activeTab, setActiveTab] = useState<'sql' | 'performance' | 'issues' | 'recommendations' | 'execution'>('performance');
  const rCfg = RATING_CONFIG[result.overallRating] ?? RATING_CONFIG.good;

  const chartData = result.performanceEstimates.map((pe) => ({
    rows: pe.rows,
    time: pe.estimatedTimeMs,
    memory: pe.memoryMB,
    fill: RATING_CONFIG[pe.rating]?.fill ?? '#94a3b8',
  }));

  const radarData = [
    { metric: 'Speed', value: result.performanceEstimates[0]?.estimatedTimeMs < 50 ? 95 : result.performanceEstimates[0]?.estimatedTimeMs < 200 ? 70 : 30 },
    { metric: 'Memory', value: result.performanceEstimates[0]?.memoryMB < 1 ? 95 : result.performanceEstimates[0]?.memoryMB < 10 ? 70 : 30 },
    { metric: 'Scalability', value: result.overallRating === 'good' ? 90 : result.overallRating === 'acceptable' ? 65 : 30 },
    { metric: 'Joins', value: result.performanceEstimates[0]?.joinsUsed === 0 ? 100 : result.performanceEstimates[0]?.joinsUsed <= 2 ? 70 : 30 },
    { metric: 'Issues', value: result.issues.length === 0 ? 100 : result.issues.length <= 2 ? 60 : 20 },
  ];

  const issueDistribution = [
    { name: 'Critical', value: result.issues.filter((i) => i.severity === 'critical').length, fill: '#ef4444' },
    { name: 'Warning', value: result.issues.filter((i) => i.severity === 'warning').length, fill: '#f59e0b' },
    { name: 'Info', value: result.issues.filter((i) => i.severity === 'info').length, fill: '#3b82f6' },
  ].filter((d) => d.value > 0);

  const TABS = [
    { id: 'performance' as const, label: 'Performance', icon: Gauge },
    { id: 'sql' as const, label: 'SQL', icon: Code2 },
    { id: 'issues' as const, label: `Issues (${result.issues.length})`, icon: AlertTriangle },
    { id: 'recommendations' as const, label: `Tips (${result.recommendations.length})`, icon: Lightbulb },
    { id: 'execution' as const, label: 'Execute', icon: PlayCircle },
  ];

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-rose-50/30 dark:from-slate-900/50 dark:to-rose-950/20 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              {result.methodName}()
              <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full border', rCfg.bg, rCfg.border, rCfg.color)}>
                {rCfg.label}
              </span>
            </h4>
            {originalQuery && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {originalQuery.className} · {originalQuery.fileName}:{originalQuery.lineNumber} · {originalQuery.type.toUpperCase()}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-xs text-right italic">{result.executionPlan}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border bg-muted/30">
        {TABS.map((tab) => {
          const TIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-rose-500 text-rose-700 dark:text-rose-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <TIcon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-3">
              {result.performanceEstimates.map((pe) => {
                const cfg = RATING_CONFIG[pe.rating] ?? RATING_CONFIG.good;
                return (
                  <div key={pe.rows} className={cn('rounded-xl border p-4 text-center', cfg.bg, cfg.border)}>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{pe.rows} rows</p>
                    <p className={cn('text-2xl font-black mt-1', cfg.color)}>{formatMs(pe.estimatedTimeMs)}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                        <Cpu className="w-3 h-3" /> {pe.scanType}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                        <HardDrive className="w-3 h-3" /> {pe.memoryMB} MB
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                        <Layers className="w-3 h-3" /> {pe.joinsUsed} joins
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border rounded-xl p-4">
                <h5 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  Response Time vs Data Volume
                </h5>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="rows" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatMs(v)} />
                    <Tooltip formatter={(v: number) => [formatMs(v), 'Time']} />
                    <Bar dataKey="time" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-border rounded-xl p-4">
                <h5 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  Query Health Radar
                </h5>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                    <Radar name="Score" dataKey="value" stroke="#e11d48" fill="#e11d48" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border border-border rounded-xl p-4">
              <h5 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-rose-500" />
                Memory Consumption Trend
              </h5>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="rows" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}MB`} />
                  <Tooltip formatter={(v: number) => [`${v} MB`, 'Memory']} />
                  <Area type="monotone" dataKey="memory" stroke="#e11d48" fill="#e11d48" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* SQL Tab */}
        {activeTab === 'sql' && (
          <div className="space-y-4">
            {originalQuery && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Original JPQL/HQL</span>
                  <button onClick={() => handleCopyText(originalQuery.query, setCopied, 'orig-jpql')} className="text-muted-foreground hover:text-foreground">
                    {copiedField === 'orig-jpql' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="px-4 py-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {highlightSQL(originalQuery.query)}
                </pre>
              </div>
            )}

            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-rose-600 rotate-90" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Translated SQL</span>
                <button onClick={() => handleCopyText(result.sqlTranslation, setCopied, 'trans-sql')} className="text-muted-foreground hover:text-foreground">
                  {copiedField === 'trans-sql' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {highlightSQL(result.sqlTranslation)}
              </pre>
            </div>
          </div>
        )}

        {/* Issues Tab */}
        {activeTab === 'issues' && (
          <div className="space-y-4">
            {result.issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                <p className="text-sm font-semibold text-foreground">No Issues Detected</p>
                <p className="text-xs text-muted-foreground mt-1">This query looks healthy!</p>
              </div>
            ) : (
              <>
                {issueDistribution.length > 0 && (
                  <div className="flex items-center gap-6 mb-4">
                    <div className="w-24 h-24 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={issueDistribution} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value" strokeWidth={2}>
                            {issueDistribution.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1">
                      {issueDistribution.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="text-muted-foreground">{d.name}:</span>
                          <span className="font-bold text-foreground">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.issues.map((issue, i) => {
                  const sCfg = SEVERITY_CONFIG[issue.severity];
                  const SIcon = sCfg.icon;
                  return (
                    <div key={i} className={cn('rounded-xl border p-4', sCfg.color)}>
                      <div className="flex items-start gap-3">
                        <SIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold">{issue.title}</p>
                          <p className="text-xs mt-1 opacity-80">{issue.description}</p>
                          <p className="text-[10px] mt-2 font-medium opacity-70">Impact: {issue.impact}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {result.recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                <p className="text-sm font-semibold text-foreground">Query is Already Optimized</p>
                <p className="text-xs text-muted-foreground mt-1">No further recommendations.</p>
              </div>
            ) : (
              result.recommendations.map((rec, i) => (
                <div key={i} className="border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        {rec.title}
                      </h5>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                        {rec.estimatedImprovement}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <div className="p-4">
                      <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Before</p>
                      <pre className="px-3 py-2 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {highlightSQL(rec.before)}
                      </pre>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2">After</p>
                      <pre className="px-3 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                        {highlightSQL(rec.after)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Execution Tab */}
        {activeTab === 'execution' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">SQL to Execute</span>
                <button onClick={() => handleCopyText(result.sqlTranslation, setCopied, 'exec-sql')} className="text-muted-foreground hover:text-foreground">
                  {copiedField === 'exec-sql' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border border-border rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                {highlightSQL(result.sqlTranslation)}
              </pre>
            </div>

            <div className={cn(
              'px-4 py-3 rounded-lg border text-xs',
              executionMode === 'inmemory' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 text-blue-700 dark:text-blue-300' :
              executionMode === 'sandbox' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-300' :
              'bg-amber-50 dark:bg-amber-950/20 border-amber-200 text-amber-700 dark:text-amber-300',
            )}>
              {executionMode === 'inmemory' && (
                <p><strong>In-Memory Mode:</strong> Runs in browser SQLite via WASM. Instant execution, up to 100 rows preview. No server required.</p>
              )}
              {executionMode === 'sandbox' && (
                <p><strong>Sandbox Mode:</strong> Executes in an isolated <code className="bg-white/50 px-1 rounded">_datagen_sandbox</code> PostgreSQL schema. Real DB engine, no impact on production data.</p>
              )}
              {executionMode === 'realdb' && (
                <p><strong>Real DB Mode:</strong> Executes against the project&apos;s live database. Use with caution — SELECT queries only recommended.</p>
              )}
            </div>

            <button
              onClick={() => onExecute(result.sqlTranslation)}
              disabled={isExecuting}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm',
                isExecuting
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : executionMode === 'inmemory' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    executionMode === 'sandbox' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                    'bg-amber-600 text-white hover:bg-amber-700',
              )}
            >
              {isExecuting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
              ) : (
                <><Play className="w-4 h-4" /> Execute SQL</>
              )}
            </button>

            {executionError && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Execution Failed</p>
                  <p className="text-xs text-red-700 mt-0.5 font-mono whitespace-pre-wrap">{executionError}</p>
                </div>
              </div>
            )}

            {executionMode === 'inmemory' && inMemoryResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Completed in {inMemoryResult.totalDurationMs}ms
                  </span>
                  <span className="text-xs text-blue-600">
                    {inMemoryResult.statementsExecuted} statements · {inMemoryResult.tables.length} tables
                  </span>
                </div>

                {/* Performance Comparison: Actual vs AI Predicted */}
                {result.performanceEstimates.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/20 border-b border-border">
                      <h5 className="text-xs font-bold text-foreground flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-violet-500" />
                        Performance Results
                      </h5>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Actual execution metric */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3 text-center">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Actual Time</p>
                          <p className="text-xl font-black text-blue-600 mt-1">{inMemoryResult.totalDurationMs}ms</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">In-memory SQLite</p>
                        </div>
                        <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 p-3 text-center">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Tables Created</p>
                          <p className="text-xl font-black text-violet-600 mt-1">{inMemoryResult.tables.filter(t => t.status === 'success').length}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">with sample data</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-center">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Rows Returned</p>
                          <p className="text-xl font-black text-emerald-600 mt-1">
                            {inMemoryResult.tables.filter(t => t.status === 'success').reduce((sum, t) => sum + t.rowCount, 0)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">from query</p>
                        </div>
                      </div>

                      {/* AI predicted performance at scale */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">AI-Predicted Performance at Scale</p>
                        <div className="grid grid-cols-4 gap-2">
                          {result.performanceEstimates.map((pe) => {
                            const cfg = RATING_CONFIG[pe.rating] ?? RATING_CONFIG.good;
                            return (
                              <div key={pe.rows} className={cn('rounded-lg border p-3 text-center', cfg.bg, cfg.border)}>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{pe.rows} rows</p>
                                <p className={cn('text-lg font-black mt-0.5', cfg.color)}>{formatMs(pe.estimatedTimeMs)}</p>
                                <div className="mt-1 space-y-0.5">
                                  <p className="text-[9px] text-muted-foreground">{pe.scanType}</p>
                                  <p className="text-[9px] text-muted-foreground">{pe.memoryMB}MB · {pe.joinsUsed} joins</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mini chart */}
                      <div className="border border-border rounded-lg p-3">
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="rows" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatMs(v)} />
                            <Tooltip formatter={(v: number) => [formatMs(v), 'Estimated Time']} />
                            <Bar dataKey="time" radius={[4, 4, 0, 0]}>
                              {chartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {inMemoryResult.tables.filter((t) => t.status === 'success').map((table) => (
                  <div key={table.tableName} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{table.tableName}</span>
                      <span className="text-[10px] text-muted-foreground">{table.rowCount} rows · {table.durationMs}ms</span>
                    </div>
                    {table.rows.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/30 border-b border-border">
                              {table.columns.map((col) => (
                                <th key={col} className="px-3 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.slice(0, 20).map((row, i) => (
                              <tr key={i} className="border-b border-border/50 last:border-b-0 hover:bg-muted/30">
                                {table.columns.map((col) => (
                                  <td key={col} className="px-3 py-1 font-mono whitespace-nowrap max-w-[200px] truncate text-foreground">
                                    {row[col] === null ? <span className="text-muted-foreground italic">NULL</span> : String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {executionMode === 'sandbox' && sandboxResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    Sandbox execution completed in {sandboxResult.totalDurationMs}ms
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sandboxResult.tables.map((t) => (
                    <div
                      key={t.tableName}
                      className={cn(
                        'px-4 py-3 rounded-lg border',
                        t.status === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200'
                          : 'bg-red-50 dark:bg-red-950/30 border-red-200',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{t.tableName}</span>
                        {t.status === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-red-600" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.status === 'success' ? `${t.rowCount} rows · ${t.durationMs}ms` : t.error}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Standalone Page ──────────────────────────────────────────────────────────

export function JPAQueryLabPage() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <JPAQueryLabContent />
    </div>
  );
}

export default JPAQueryLabPage;
