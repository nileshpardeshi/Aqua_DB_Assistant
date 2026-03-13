import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowRightLeft,
  Loader2,
  Copy,
  CheckCircle2,
  ArrowRight,
  FileText,
  Download,
  Play,
  Sparkles,
  Upload,
  Eye,
  PlayCircle,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  AlertTriangle,
  Table2,
  ShieldCheck,
  Brain,
  Info,
  XCircle,
  Wand2,
  Code2,
  ArrowDownToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import {
  useConvertDialect,
  useAIValidateConversion,
  type ConversionChange,
  type ValidationResult,
  type AIValidationResult,
} from '@/hooks/use-migrations';
import {
  useSandboxStatus,
  useSandboxTable,
  useExecuteSandbox,
  useCleanupSandbox,
} from '@/hooks/use-sandbox';
import { useInMemoryDB } from '@/hooks/use-inmemory-db';

const DIALECTS = DATABASE_DIALECTS.filter((d) =>
  ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb', 'snowflake', 'bigquery'].includes(d.value)
);

const SAMPLE_SQL = `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(200),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  role VARCHAR(50) DEFAULT 'user',
  profile JSONB,
  login_count INTEGER DEFAULT 0,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);`;

const PROGRESS_STEPS = [
  'Parsing',
  'Mapping types',
  'Transforming syntax',
  'Complete',
] as const;

// ── Safe error message extraction ────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (obj.message && typeof obj.message === 'object') {
      const inner = obj.message as Record<string, unknown>;
      if (typeof inner.message === 'string') return inner.message;
      if (typeof inner.code === 'string') return inner.code;
    }
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    try { return JSON.stringify(err); } catch { return String(err); }
  }
  return String(err);
}

// ── Extract table names from SQL ─────────────────────────────────────────────

function extractTableNames(sql: string): string[] {
  const tables = new Set<string>();
  // Match CREATE TABLE tablename
  const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?(\w+)(?:`|"|')?/gi;
  let match: RegExpExecArray | null;
  while ((match = createRegex.exec(sql)) !== null) {
    tables.add(match[1]);
  }
  // Match INSERT INTO tablename
  const insertRegex = /INSERT\s+INTO\s+(?:`|"|')?(\w+)(?:`|"|')?/gi;
  while ((match = insertRegex.exec(sql)) !== null) {
    tables.add(match[1]);
  }
  return Array.from(tables);
}

// ── Normalize SQL to SQLite-compatible syntax for Quick Test ─────────────────

function normalizeSqlForSQLite(sql: string): string {
  let s = sql;

  // MySQL AUTO_INCREMENT → SQLite AUTOINCREMENT
  s = s.replace(/\bINT(?:EGER)?\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  s = s.replace(/\bSERIAL\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  s = s.replace(/\bBIGSERIAL\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  s = s.replace(/\bSMALLSERIAL\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  s = s.replace(/\bAUTO_INCREMENT/gi, 'AUTOINCREMENT');
  s = s.replace(/\bIDENTITY(?:\s*\(\s*\d+\s*,\s*\d+\s*\))?/gi, ''); // SQL Server IDENTITY

  // Remove MySQL table options
  s = s.replace(/\)\s*ENGINE\s*=\s*\w+/gi, ')');
  s = s.replace(/\s*DEFAULT\s+CHARSET\s*=\s*\w+/gi, '');
  s = s.replace(/\s*CHARACTER\s+SET\s+\w+/gi, '');
  s = s.replace(/\s*COLLATE\s+\w+/gi, '');
  s = s.replace(/\s*ROW_FORMAT\s*=\s*\w+/gi, '');

  // Remove column-level COMMENT 'xxx'
  s = s.replace(/\s+COMMENT\s+'[^']*'/gi, '');
  s = s.replace(/\s+COMMENT\s+"[^"]*"/gi, '');

  // Remove UNSIGNED
  s = s.replace(/\bUNSIGNED\b/gi, '');

  // Type mappings → SQLite types
  s = s.replace(/\bTINYINT\s*\(\s*1\s*\)/gi, 'INTEGER');
  s = s.replace(/\bTINYINT\b/gi, 'INTEGER');
  s = s.replace(/\bSMALLINT\b/gi, 'INTEGER');
  s = s.replace(/\bMEDIUMINT\b/gi, 'INTEGER');
  s = s.replace(/\bBIGINT\b/gi, 'INTEGER');
  s = s.replace(/\bDOUBLE\s+PRECISION\b/gi, 'REAL');
  s = s.replace(/\bDOUBLE\b/gi, 'REAL');
  s = s.replace(/\bFLOAT\b/gi, 'REAL');
  s = s.replace(/\bDECIMAL\s*\([^)]*\)/gi, 'REAL');
  s = s.replace(/\bNUMERIC\s*\([^)]*\)/gi, 'REAL');
  s = s.replace(/\bENUM\s*\([^)]*\)/gi, 'TEXT');
  s = s.replace(/\bSET\s*\('[^)]*\)/gi, 'TEXT');
  s = s.replace(/\bDATETIME\b/gi, 'TEXT');
  s = s.replace(/\bTIMESTAMPTZ\b/gi, 'TEXT');
  s = s.replace(/\bTIMESTAMP\b/gi, 'TEXT');
  s = s.replace(/\bDATE\b/gi, 'TEXT');
  s = s.replace(/\bTIME\b/gi, 'TEXT');
  s = s.replace(/\bUUID\b/gi, 'TEXT');
  s = s.replace(/\bJSON\b/gi, 'TEXT');
  s = s.replace(/\bJSONB\b/gi, 'TEXT');
  s = s.replace(/\bBYTEA\b/gi, 'BLOB');
  s = s.replace(/\bLONGBLOB\b/gi, 'BLOB');
  s = s.replace(/\bMEDIUMBLOB\b/gi, 'BLOB');
  s = s.replace(/\bTINYBLOB\b/gi, 'BLOB');
  s = s.replace(/\bLONGTEXT\b/gi, 'TEXT');
  s = s.replace(/\bMEDIUMTEXT\b/gi, 'TEXT');
  s = s.replace(/\bTINYTEXT\b/gi, 'TEXT');
  s = s.replace(/\bNVARCHAR\s*\([^)]*\)/gi, 'TEXT');
  s = s.replace(/\bNVARCHAR2\s*\([^)]*\)/gi, 'TEXT');
  s = s.replace(/\bVARCHAR2\s*\([^)]*\)/gi, 'TEXT');
  s = s.replace(/\bCLOB\b/gi, 'TEXT');
  s = s.replace(/\bNCLOB\b/gi, 'TEXT');
  s = s.replace(/\bNUMBER\s*\([^)]*\)/gi, 'REAL');
  s = s.replace(/\bNUMBER\b/gi, 'REAL');

  // BOOLEAN → INTEGER (SQLite has no native BOOLEAN)
  s = s.replace(/\bBOOLEAN\b/gi, 'INTEGER');
  s = s.replace(/\bBOOL\b/gi, 'INTEGER');

  // MySQL/PG default functions → SQLite equivalents
  s = s.replace(/\bNOW\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");
  s = s.replace(/\bCURRENT_DATE\s*\(\s*\)/gi, "CURRENT_DATE");
  s = s.replace(/\bCURDATE\s*\(\s*\)/gi, "CURRENT_DATE");
  s = s.replace(/\bGETDATE\s*\(\s*\)/gi, "CURRENT_TIMESTAMP"); // SQL Server
  s = s.replace(/\bSYSDATE\b/gi, "CURRENT_TIMESTAMP"); // Oracle
  s = s.replace(/\bgen_random_uuid\s*\(\s*\)/gi, "lower(hex(randomblob(16)))");
  s = s.replace(/\buuid_generate_v4\s*\(\s*\)/gi, "lower(hex(randomblob(16)))");
  s = s.replace(/\bUUID\s*\(\s*\)/gi, "lower(hex(randomblob(16)))");

  // Remove ON UPDATE CURRENT_TIMESTAMP
  s = s.replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');

  // Remove schema prefixes (e.g., dbo.tablename, public.tablename)
  s = s.replace(/\b(?:dbo|public|schema)\./gi, '');

  // Remove IF EXISTS on CREATE (keep IF NOT EXISTS)
  // Remove backtick quoting → no quoting (SQLite supports it but let's keep clean)
  s = s.replace(/`/g, '"');

  // Remove square bracket quoting (SQL Server)
  s = s.replace(/\[(\w+)\]/g, '"$1"');

  return s;
}

type TestTab = 'preview' | 'sandbox';

export function DialectConverter() {
  const { projectId } = useParams();
  const convertDialect = useConvertDialect();
  const aiValidate = useAIValidateConversion();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceDialect, setSourceDialect] = useState('postgresql');
  const [targetDialect, setTargetDialect] = useState('mysql');
  const [sourceSql, setSourceSql] = useState('');
  const [targetSql, setTargetSql] = useState('');
  const [changes, setChanges] = useState<ConversionChange[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState(-1);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [ruleValidation, setRuleValidation] = useState<ValidationResult | null>(null);
  const [aiValidation, setAiValidation] = useState<AIValidationResult | null>(null);

  // Test panel state
  const [testTab, setTestTab] = useState<TestTab>('preview');
  const [sandboxBrowseTable, setSandboxBrowseTable] = useState<string | null>(null);
  const [sandboxPage, setSandboxPage] = useState(1);
  const sandboxPageSize = 50;
  const [inMemoryBrowseTable, setInMemoryBrowseTable] = useState<string | null>(null);

  // In-memory DB hook (SQLite WASM — runs entirely in browser)
  const inMemoryDB = useInMemoryDB();

  // Sandbox hooks
  const { data: sandboxStatus, refetch: refetchStatus } = useSandboxStatus(projectId);
  const executeSandbox = useExecuteSandbox();
  const cleanupSandbox = useCleanupSandbox();
  const { data: sandboxTableData, isLoading: tableDataLoading } = useSandboxTable(
    projectId,
    sandboxBrowseTable || undefined,
    sandboxPage,
    sandboxPageSize
  );

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const startProgress = useCallback(() => {
    setProgressStep(0);
    let step = 0;
    progressIntervalRef.current = setInterval(() => {
      step += 1;
      if (step >= PROGRESS_STEPS.length - 1) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
      setProgressStep(step);
    }, 800);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgressStep(PROGRESS_STEPS.length - 1);
  }, []);

  // ── File Upload ─────────────────────────────────────────────────────────────

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setSourceSql(text);
        setUploadedFileName(file.name);
        setTargetSql('');
        setChanges([]);
        setProgressStep(-1);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }, []);

  // ── Convert ─────────────────────────────────────────────────────────────────

  const handleConvert = useCallback(async () => {
    if (!sourceSql.trim() || !projectId) return;
    setIsConverting(true);
    setTargetSql('');
    setChanges([]);
    startProgress();

    try {
      const result = await convertDialect.mutateAsync({
        projectId,
        sql: sourceSql,
        sourceDialect,
        targetDialect,
      });

      setTargetSql(result.sql);
      setChanges(result.changes);
      setRuleValidation(result.validation || null);
      setAiValidation(null);
    } catch (error) {
      console.error('Dialect conversion failed:', error);
      setTargetSql('-- Conversion failed. Please check your SQL and try again.');
      setChanges([]);
      setRuleValidation(null);
    } finally {
      stopProgress();
      setIsConverting(false);
    }
  }, [sourceSql, sourceDialect, targetDialect, projectId, convertDialect, startProgress, stopProgress]);

  const handleCopy = useCallback(() => {
    if (!targetSql) return;
    navigator.clipboard.writeText(targetSql);
    setCopied(true);
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [targetSql]);

  const handleSwapDialects = useCallback(() => {
    setSourceDialect(targetDialect);
    setTargetDialect(sourceDialect);
    if (targetSql) {
      setSourceSql(targetSql);
      setTargetSql('');
      setChanges([]);
      setProgressStep(-1);
      setRuleValidation(null);
      setAiValidation(null);
    }
  }, [sourceDialect, targetDialect, targetSql]);

  const handleLoadSample = useCallback(() => {
    setSourceSql(SAMPLE_SQL);
    setSourceDialect('postgresql');
    setUploadedFileName(null);
    setTargetSql('');
    setChanges([]);
    setProgressStep(-1);
    setRuleValidation(null);
    setAiValidation(null);
  }, []);

  const handleDownloadConverted = useCallback(() => {
    if (!targetSql) return;
    const blob = new Blob([targetSql], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = uploadedFileName
      ? uploadedFileName.replace(/\.\w+$/, '')
      : 'converted';
    a.download = `${baseName}_${targetDialect}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [targetSql, targetDialect, uploadedFileName]);

  const handleDownloadSource = useCallback(() => {
    if (!sourceSql) return;
    const blob = new Blob([sourceSql], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = uploadedFileName || `source_${sourceDialect}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sourceSql, sourceDialect, uploadedFileName]);

  // ── Sandbox Test Handlers ───────────────────────────────────────────────────

  const canTestInSandbox = targetDialect === 'postgresql' && !!targetSql;

  const handleExecuteSandbox = async () => {
    if (!projectId || !targetSql) return;
    const tableNames = extractTableNames(targetSql);
    // No tableColumns needed — converted SQL includes CREATE TABLE statements
    await executeSandbox.mutateAsync({ projectId, sql: targetSql, tableNames });
    refetchStatus();
    if (tableNames.length > 0) {
      setSandboxBrowseTable(tableNames[0]);
      setSandboxPage(1);
    }
  };

  const handleCleanup = async () => {
    if (!projectId) return;
    await cleanupSandbox.mutateAsync(projectId);
    setSandboxBrowseTable(null);
    refetchStatus();
  };

  const sourceDialectInfo = DIALECTS.find((d) => d.value === sourceDialect);
  const targetDialectInfo = DIALECTS.find((d) => d.value === targetDialect);

  // ── Preview Data (parse CREATE TABLE from converted SQL for structure) ─────

  const previewStatements = targetSql
    ? targetSql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'))
    : [];

  return (
    <div className="space-y-5">
      {/* Dialect Selectors */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Source Dialect
          </label>
          <select
            value={sourceDialect}
            onChange={(e) => setSourceDialect(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-card text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          >
            {DIALECTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSwapDialects}
          className="mt-5 p-2.5 rounded-lg border border-slate-200 bg-card hover:bg-slate-50 text-slate-500 hover:text-aqua-600 transition-all"
          title="Swap dialects"
        >
          <ArrowRightLeft className="w-4 h-4" />
        </button>

        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Target Dialect
          </label>
          <select
            value={targetDialect}
            onChange={(e) => setTargetDialect(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-card text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          >
            {DIALECTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SQL Editors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source SQL */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              Source SQL
              {sourceDialectInfo && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: `${sourceDialectInfo.color}15`,
                    color: sourceDialectInfo.color,
                  }}
                >
                  {sourceDialectInfo.label}
                </span>
              )}
              {uploadedFileName && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                  <FileText className="w-2.5 h-2.5" />
                  {uploadedFileName}
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-aqua-600 transition-colors"
              >
                <Upload className="w-3 h-3" />
                Upload .sql
              </button>
              {sourceSql && (
                <button
                  onClick={handleDownloadSource}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              )}
              <button
                onClick={handleLoadSample}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-aqua-600 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Load Sample
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.txt,.ddl"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Source SQL input area */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && (file.name.endsWith('.sql') || file.name.endsWith('.txt') || file.name.endsWith('.ddl'))) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result;
                  if (typeof text === 'string') {
                    setSourceSql(text);
                    setUploadedFileName(file.name);
                    setTargetSql('');
                    setChanges([]);
                    setProgressStep(-1);
                  }
                };
                reader.readAsText(file);
              }
            }}
          >
            <textarea
              value={sourceSql}
              onChange={(e) => { setSourceSql(e.target.value); setUploadedFileName(null); }}
              placeholder={`-- Paste your ${sourceDialectInfo?.label || 'source'} SQL here, or upload a .sql file using the button above\n\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE,\n  active BOOLEAN DEFAULT true,\n  created_at TIMESTAMP DEFAULT NOW()\n);`}
              rows={12}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
            />
          </div>
          {sourceSql && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-slate-500">
                {sourceSql.split('\n').length} lines · {sourceSql.length.toLocaleString()} chars
              </span>
            </div>
          )}
        </div>

        {/* Target SQL */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              Converted SQL
              {targetDialectInfo && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: `${targetDialectInfo.color}15`,
                    color: targetDialectInfo.color,
                  }}
                >
                  {targetDialectInfo.label}
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              {targetSql && (
                <>
                  <button
                    onClick={handleDownloadConverted}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    title="Download as .sql file"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          <textarea
            value={targetSql}
            onChange={(e) => setTargetSql(e.target.value)}
            placeholder="Converted SQL will appear here..."
            rows={12}
            spellCheck={false}
            className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
          />
          {targetSql && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-slate-500">
                {targetSql.split('\n').length} lines · {targetSql.length.toLocaleString()} chars
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Convert Button & Compatibility Summary */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleConvert}
          disabled={isConverting || !sourceSql.trim()}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            isConverting || !sourceSql.trim()
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {isConverting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Convert
            </>
          )}
        </button>

        {sourceDialectInfo && targetDialectInfo && (
          <span className="text-xs text-slate-500">
            {sourceDialectInfo.label} <ArrowRight className="w-3 h-3 inline" /> {targetDialectInfo.label}
          </span>
        )}

        {changes.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-aqua-100 text-aqua-700">
            <CheckCircle2 className="w-3 h-3" />
            {changes.length} change{changes.length !== 1 ? 's' : ''} applied
          </span>
        )}
      </div>

      {/* Progress Stepper */}
      {progressStep >= 0 && (
        <div className="flex items-center gap-1">
          {PROGRESS_STEPS.map((step, idx) => {
            const isActive = progressStep === idx && idx < PROGRESS_STEPS.length - 1;
            const isCompleted = progressStep > idx || (progressStep === PROGRESS_STEPS.length - 1 && idx === PROGRESS_STEPS.length - 1);

            return (
              <div key={step} className="flex items-center gap-1">
                {idx > 0 && (
                  <div
                    className={cn(
                      'w-8 h-px',
                      isCompleted || progressStep > idx ? 'bg-aqua-500' : 'bg-slate-200'
                    )}
                  />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                      isCompleted
                        ? 'bg-aqua-600 text-white'
                        : isActive
                          ? 'bg-aqua-100 text-aqua-700 animate-pulse'
                          : 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-medium whitespace-nowrap',
                      isCompleted
                        ? 'text-aqua-700'
                        : isActive
                          ? 'text-aqua-600 animate-pulse'
                          : 'text-slate-400'
                    )}
                  >
                    {step}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Changes Log */}
      {changes.length > 0 && (
        <div className="bg-card border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <h4 className="text-xs font-semibold text-slate-700">
              Conversion Changes
            </h4>
            <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-aqua-100 text-aqua-700">
              {changes.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {changes.map((change, idx) => (
              <li
                key={idx}
                className="px-4 py-2.5 text-sm text-slate-700"
              >
                <div className="flex items-start gap-2">
                  <span className="text-aqua-500 mt-0.5 flex-shrink-0">
                    <ArrowRight className="w-3 h-3" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="px-1.5 py-0.5 text-xs font-mono bg-red-50 text-red-700 rounded">
                        {change.original}
                      </code>
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <code className="px-1.5 py-0.5 text-xs font-mono bg-green-50 text-green-700 rounded">
                        {change.converted}
                      </code>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {change.reason}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ════════════════════ VALIDATION PANEL ════════════════════ */}
      {targetSql && ruleValidation && ruleValidation.issues.length > 0 && (
        <div className="bg-card border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <h4 className="text-xs font-semibold text-slate-700">
              Compatibility Validation
            </h4>
            {ruleValidation.summary.errors > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                {ruleValidation.summary.errors} error{ruleValidation.summary.errors !== 1 ? 's' : ''}
              </span>
            )}
            {ruleValidation.summary.warnings > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                {ruleValidation.summary.warnings} warning{ruleValidation.summary.warnings !== 1 ? 's' : ''}
              </span>
            )}
            {ruleValidation.summary.info > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                {ruleValidation.summary.info} info
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {ruleValidation.valid ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> No blocking errors
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600">
                  <XCircle className="w-3 h-3" /> Has blocking errors
                </span>
              )}
            </div>
          </div>
          <ul className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {ruleValidation.issues.map((issue, idx) => (
              <li key={idx} className="px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5">
                    {issue.severity === 'error' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        'px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase',
                        issue.severity === 'error' ? 'text-red-700 bg-red-50 border-red-200'
                          : issue.severity === 'warning' ? 'text-amber-700 bg-amber-50 border-amber-200'
                          : 'text-blue-700 bg-blue-50 border-blue-200'
                      )}>
                        {issue.category.replace('_', ' ')}
                      </span>
                      {issue.line && (
                        <span className="text-[10px] text-slate-400 font-mono">Line {issue.line}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-1">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="text-[11px] text-slate-500 mt-0.5 italic">
                        Fix: {issue.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Validation */}
      {targetSql && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              if (!targetSql) return;
              try {
                const result = await aiValidate.mutateAsync({
                  sql: targetSql,
                  sourceDialect,
                  targetDialect,
                });
                setAiValidation(result);
              } catch (err) {
                console.error('AI validation failed:', err);
              }
            }}
            disabled={aiValidate.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
              aiValidate.isPending
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            )}
          >
            {aiValidate.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> AI Validating...</>
            ) : (
              <><Brain className="w-4 h-4" /> AI Validate</>
            )}
          </button>
          {aiValidation && (
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full',
              aiValidation.compatibilityScore >= 90
                ? 'bg-emerald-100 text-emerald-700'
                : aiValidation.compatibilityScore >= 70
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            )}>
              <ShieldCheck className="w-3 h-3" />
              {aiValidation.compatibilityScore}% compatible
            </span>
          )}
          {aiValidate.error && (
            <span className="text-xs text-red-600">
              {getErrorMessage(aiValidate.error)}
            </span>
          )}
        </div>
      )}

      {/* AI Validation Results */}
      {aiValidation && (
        <div className="bg-card border border-violet-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-violet-500" />
            <h4 className="text-xs font-semibold text-violet-800">
              AI Validation Report
            </h4>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold',
              aiValidation.compatibilityScore >= 90
                ? 'bg-emerald-100 text-emerald-700'
                : aiValidation.compatibilityScore >= 70
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
            )}>
              Score: {aiValidation.compatibilityScore}/100
            </span>
            <div className="ml-auto">
              {aiValidation.valid ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> Valid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600">
                  <XCircle className="w-3 h-3" /> Issues Found
                </span>
              )}
            </div>
          </div>
          {aiValidation.overallAssessment && (
            <div className="px-4 py-2.5 bg-violet-50/50 border-b border-violet-100 text-xs text-violet-800">
              {aiValidation.overallAssessment}
            </div>
          )}
          {aiValidation.issues && aiValidation.issues.length > 0 ? (
            <ul className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
              {aiValidation.issues.map((issue, idx) => (
                <li key={idx} className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5">
                      {issue.severity === 'error' ? (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-blue-500" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase',
                          issue.severity === 'error' ? 'text-red-700 bg-red-50 border-red-200'
                            : issue.severity === 'warning' ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-blue-700 bg-blue-50 border-blue-200'
                        )}>
                          {issue.category.replace('_', ' ')}
                        </span>
                        {issue.line && (
                          <span className="text-[10px] text-slate-400 font-mono">Line {issue.line}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 mt-1">{issue.message}</p>
                      {issue.suggestion && (
                        <p className="text-[11px] text-slate-500 mt-0.5 italic">
                          Fix: {issue.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-4 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs text-slate-600">No issues found — conversion looks clean!</p>
            </div>
          )}

          {/* AI Suggested / Corrected SQL */}
          {aiValidation.correctedSql && aiValidation.correctedSql !== targetSql && (
            <div className="border-t border-violet-200">
              <div className="px-4 py-2.5 bg-violet-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5 text-violet-500" />
                  <h4 className="text-xs font-semibold text-violet-800">
                    AI Suggested SQL
                  </h4>
                  <span className="text-[10px] text-violet-600">
                    {aiValidation.issues && aiValidation.issues.length > 0
                      ? `${aiValidation.issues.length} fix${aiValidation.issues.length !== 1 ? 'es' : ''} applied`
                      : 'Optimized'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (aiValidation.correctedSql) {
                        navigator.clipboard.writeText(aiValidation.correctedSql);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-700 bg-violet-100 border border-violet-200 rounded hover:bg-violet-200 transition-colors"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button
                    onClick={() => {
                      if (aiValidation.correctedSql) {
                        setTargetSql(aiValidation.correctedSql);
                        setRuleValidation(null);
                        setAiValidation(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" /> Apply AI Fix
                  </button>
                </div>
              </div>
              <div className="max-h-[300px] overflow-auto">
                <pre className="px-4 py-3 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed bg-white">
                  {aiValidation.correctedSql}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ TEST & PREVIEW PANEL ════════════════════ */}
      {targetSql && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-card">
          {/* Tab Header */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setTestTab('preview')}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2',
                testTab === 'preview'
                  ? 'border-aqua-500 text-aqua-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Play className="w-4 h-4" />
              Quick Test
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-aqua-100 text-aqua-700 rounded">
                In-Memory
              </span>
            </button>
            <button
              onClick={() => setTestTab('sandbox')}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2',
                testTab === 'sandbox'
                  ? 'border-aqua-500 text-aqua-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <PlayCircle className="w-4 h-4" />
              Sandbox Execute
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">
                PostgreSQL
              </span>
            </button>

            <div className="ml-auto pr-4 flex items-center gap-3">
              {testTab === 'preview' && inMemoryDB.result && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {inMemoryDB.result.tables.filter(t => t.status === 'success').length} tables · {inMemoryDB.result.totalDurationMs}ms
                </span>
              )}
              {testTab === 'sandbox' && sandboxStatus?.exists && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Sandbox active · {sandboxStatus.tables.length} tables
                </span>
              )}
            </div>
          </div>

          {/* ═══════════════ QUICK TEST (IN-MEMORY) TAB ═══════════════ */}
          {testTab === 'preview' && (
            <div className="p-4 space-y-4">
              {/* Action Bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => inMemoryDB.execute(normalizeSqlForSQLite(targetSql))}
                  disabled={inMemoryDB.isExecuting || !targetSql}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                    inMemoryDB.isExecuting || !targetSql
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-aqua-600 text-white hover:bg-aqua-700'
                  )}
                >
                  {inMemoryDB.isExecuting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
                  ) : (
                    <><Play className="w-4 h-4" /> Run in Browser</>
                  )}
                </button>

                {inMemoryDB.result && (
                  <button
                    onClick={() => { inMemoryDB.cleanup(); setInMemoryBrowseTable(null); }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border text-red-600 bg-red-50 border-red-200 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}

                <span className="text-[10px] text-slate-500 italic">
                  Runs in SQLite (WASM) in your browser — no server needed
                </span>
              </div>

              {/* Statement Stats */}
              {previewStatements.length > 0 && !inMemoryDB.result && !inMemoryDB.isExecuting && (
                <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Table2 className="w-3.5 h-3.5" />
                    <span>{extractTableNames(targetSql).length} table{extractTableNames(targetSql).length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{previewStatements.length} statement{previewStatements.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Click "Run in Browser" to execute and test</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {inMemoryDB.error && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Execution Failed</p>
                    <pre className="text-xs text-red-700 mt-1 whitespace-pre-wrap">{inMemoryDB.error}</pre>
                  </div>
                </div>
              )}

              {/* Execution Results */}
              {inMemoryDB.result && (
                <div className="space-y-3">
                  {/* Summary Bar */}
                  <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                      Completed in {inMemoryDB.result.totalDurationMs}ms
                    </span>
                    <span className="text-xs text-emerald-600 font-medium">
                      {inMemoryDB.result.statementsExecuted} executed
                    </span>
                    {inMemoryDB.result.statementsFailed > 0 && (
                      <span className="text-xs text-red-600 font-medium">
                        {inMemoryDB.result.statementsFailed} failed
                      </span>
                    )}
                  </div>

                  {/* Table Result Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {inMemoryDB.result.tables.filter(t => t.status === 'success').map((table) => (
                      <div
                        key={table.tableName}
                        onClick={() => setInMemoryBrowseTable(table.tableName)}
                        className={cn(
                          'px-4 py-3 rounded-lg border transition-all cursor-pointer',
                          inMemoryBrowseTable === table.tableName
                            ? 'bg-aqua-50 border-aqua-400 ring-1 ring-aqua-300'
                            : 'bg-emerald-50 border-emerald-200 hover:border-emerald-400'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">{table.tableName}</span>
                          <Check className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-xs font-medium text-emerald-700">
                            {table.rowCount.toLocaleString()} rows
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {table.columns.length} cols
                          </span>
                          <span className="text-[10px] text-slate-500">{table.durationMs}ms</span>
                        </div>
                        <p className="mt-1 text-[10px] text-aqua-600">Click to browse data</p>
                      </div>
                    ))}
                    {inMemoryDB.result.tables.filter(t => t.status === 'failed' && t.tableName !== '⚠ Failed Statements').map((table) => (
                      <div key={table.tableName} className="px-4 py-3 rounded-lg border bg-red-50 border-red-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">{table.tableName}</span>
                          <X className="w-4 h-4 text-red-600" />
                        </div>
                        <p className="text-[11px] text-red-700 mt-1">{table.error}</p>
                      </div>
                    ))}
                  </div>

                  {/* Failed Statements */}
                  {inMemoryDB.result.statementsFailed > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-800">
                          {inMemoryDB.result.statementsFailed} statement{inMemoryDB.result.statementsFailed !== 1 ? 's' : ''} failed
                        </span>
                        <span className="text-[10px] text-amber-600 ml-1">
                          (SQLite may not support all {targetDialectInfo?.label || targetDialect} syntax)
                        </span>
                      </div>
                      {inMemoryDB.result.tables.filter(t => t.tableName === '⚠ Failed Statements').map((t) => (
                        <ul key={t.tableName} className="divide-y divide-amber-100 max-h-[200px] overflow-y-auto">
                          {t.rows.map((row, i) => (
                            <li key={i} className="px-4 py-2">
                              <p className="text-[11px] font-mono text-amber-900 truncate">{String(row.statement)}</p>
                              <p className="text-[10px] text-red-600 mt-0.5">{String(row.error)}</p>
                            </li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  )}

                  {/* In-Memory Data Browser */}
                  {inMemoryBrowseTable && (() => {
                    const tableData = inMemoryDB.result?.tables.find(t => t.tableName === inMemoryBrowseTable && t.status === 'success');
                    if (!tableData) return null;
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-slate-700">
                              Data: <span className="text-aqua-600">{inMemoryBrowseTable}</span>
                            </h4>
                            <span className="text-[10px] text-slate-500">
                              {tableData.rowCount.toLocaleString()} rows · {tableData.columns.length} columns
                            </span>
                          </div>
                          {inMemoryDB.result && inMemoryDB.result.tables.filter(t => t.status === 'success').length > 1 && (
                            <div className="flex gap-1">
                              {inMemoryDB.result.tables.filter(t => t.status === 'success').map(t => (
                                <button
                                  key={t.tableName}
                                  onClick={() => setInMemoryBrowseTable(t.tableName)}
                                  className={cn(
                                    'px-2 py-0.5 text-[10px] font-medium rounded border transition-colors',
                                    inMemoryBrowseTable === t.tableName
                                      ? 'bg-aqua-50 border-aqua-300 text-aqua-700'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  )}
                                >
                                  {t.tableName} ({t.rowCount})
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {tableData.rows.length > 0 ? (
                          <div className="border border-slate-200 rounded-lg overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="px-3 py-2 text-left font-semibold text-slate-500 w-12">#</th>
                                  {tableData.columns.map((col, i) => (
                                    <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tableData.rows.map((row, rowIdx) => (
                                  <tr key={rowIdx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                    <td className="px-3 py-1.5 text-slate-400 font-mono">{rowIdx + 1}</td>
                                    {tableData.columns.map((col, colIdx) => {
                                      const val = row[col];
                                      const displayVal = val === null ? 'NULL'
                                        : typeof val === 'object' ? JSON.stringify(val)
                                        : String(val);
                                      return (
                                        <td
                                          key={colIdx}
                                          className={cn(
                                            'px-3 py-1.5 font-mono whitespace-nowrap max-w-[200px] truncate',
                                            val === null ? 'text-slate-400 italic' : 'text-slate-700'
                                          )}
                                          title={displayVal}
                                        >
                                          {displayVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center">
                            <Database className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">Table created successfully but has no data</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Empty State */}
              {!inMemoryDB.result && !inMemoryDB.isExecuting && !inMemoryDB.error && (
                <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center">
                  <Play className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    Click "Run in Browser" to execute the converted SQL in an in-memory SQLite database
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Uses SQLite WASM — runs entirely in your browser · No server connection needed · Validates table creation & INSERT statements
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ SANDBOX EXECUTE TAB ═══════════════ */}
          {testTab === 'sandbox' && (
            <div className="p-4 space-y-4">
              {/* Dialect Warning */}
              {!canTestInSandbox && (
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Target dialect is not PostgreSQL</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Sandbox execution is only available when the <strong>target dialect is PostgreSQL</strong>, since the sandbox runs on your connected PostgreSQL database.
                      Current target: <strong>{targetDialectInfo?.label || targetDialect}</strong>.
                      Change the target dialect to PostgreSQL to test in sandbox.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleExecuteSandbox}
                  disabled={!canTestInSandbox || executeSandbox.isPending}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm',
                    !canTestInSandbox || executeSandbox.isPending
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  )}
                >
                  {executeSandbox.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
                  ) : (
                    <><PlayCircle className="w-4 h-4" /> Execute in Sandbox</>
                  )}
                </button>

                {sandboxStatus?.exists && (
                  <button
                    onClick={handleCleanup}
                    disabled={cleanupSandbox.isPending}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                      cleanupSandbox.isPending
                        ? 'bg-slate-100 text-slate-400 border-slate-200'
                        : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Cleanup Sandbox
                  </button>
                )}

                {canTestInSandbox && (
                  <span className="text-xs text-slate-500 italic">
                    Converted SQL will be executed in <code className="bg-slate-100 px-1 rounded text-[10px]">_datagen_sandbox</code> schema
                  </span>
                )}
              </div>

              {/* Execution Results */}
              {executeSandbox.data && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                      Execution completed in {executeSandbox.data.totalDurationMs.toLocaleString()}ms
                    </span>
                    <span className="text-xs text-slate-500">
                      {executeSandbox.data.tables.filter((t: { status: string }) => t.status === 'success').length}/{executeSandbox.data.tables.length} tables succeeded
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {executeSandbox.data.tables.map((result: { tableName: string; status: string; rowCount: number; durationMs: number; error?: string }) => (
                      <div
                        key={result.tableName}
                        onClick={() => {
                          if (result.status === 'success') {
                            setSandboxBrowseTable(result.tableName);
                            setSandboxPage(1);
                          }
                        }}
                        className={cn(
                          'px-4 py-3 rounded-lg border transition-all',
                          result.status === 'success'
                            ? 'bg-emerald-50 border-emerald-200 cursor-pointer hover:border-emerald-400'
                            : 'bg-red-50 border-red-200'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">{result.tableName}</span>
                          {result.status === 'success' ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3">
                          <span className={cn(
                            'text-xs font-medium',
                            result.status === 'success' ? 'text-emerald-700' : 'text-red-700'
                          )}>
                            {result.status === 'success'
                              ? `${result.rowCount.toLocaleString()} rows`
                              : 'Failed'}
                          </span>
                          {result.durationMs > 0 && (
                            <span className="text-[10px] text-slate-500">{result.durationMs}ms</span>
                          )}
                        </div>
                        {result.error && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-red-700 leading-tight break-all">
                              {(() => { const msg = getErrorMessage(result.error); return msg.length > 200 ? msg.slice(0, 200) + '...' : msg; })()}
                            </p>
                          </div>
                        )}
                        {result.status === 'success' && (
                          <p className="mt-1 text-[10px] text-emerald-600">Click to browse data</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Error */}
              {executeSandbox.error && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Execution Failed</p>
                    <p className="text-xs text-red-700 mt-0.5">
                      {getErrorMessage(executeSandbox.error)}
                    </p>
                  </div>
                </div>
              )}

              {/* Data Browser */}
              {sandboxBrowseTable && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-slate-700">
                        Sandbox Data: <span className="text-aqua-600">{sandboxBrowseTable}</span>
                      </h4>
                      {sandboxTableData && (
                        <span className="text-[10px] text-slate-500">
                          {sandboxTableData.totalCount.toLocaleString()} rows · {sandboxTableData.columns.length} columns
                        </span>
                      )}
                    </div>

                    {sandboxStatus?.tables && sandboxStatus.tables.length > 1 && (
                      <div className="flex gap-1">
                        {sandboxStatus.tables.map(t => (
                          <button
                            key={t.tableName}
                            onClick={() => { setSandboxBrowseTable(t.tableName); setSandboxPage(1); }}
                            className={cn(
                              'px-2 py-0.5 text-[10px] font-medium rounded border transition-colors',
                              sandboxBrowseTable === t.tableName
                                ? 'bg-aqua-50 border-aqua-300 text-aqua-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            )}
                          >
                            {t.tableName} ({t.rowCount})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {tableDataLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      <span className="ml-2 text-sm text-slate-500">Loading data...</span>
                    </div>
                  ) : sandboxTableData && sandboxTableData.rows.length > 0 ? (
                    <>
                      <div className="border border-slate-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-3 py-2 text-left font-semibold text-slate-500 w-12">#</th>
                              {sandboxTableData.columns.map((col, i) => (
                                <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sandboxTableData.rows.map((row, rowIdx) => (
                              <tr key={rowIdx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                <td className="px-3 py-1.5 text-slate-400 font-mono">
                                  {(sandboxPage - 1) * sandboxPageSize + rowIdx + 1}
                                </td>
                                {sandboxTableData.columns.map((col, colIdx) => {
                                  const val = row[col];
                                  const displayVal = val === null ? 'NULL'
                                    : typeof val === 'object' ? JSON.stringify(val)
                                    : String(val);
                                  return (
                                    <td
                                      key={colIdx}
                                      className={cn(
                                        'px-3 py-1.5 font-mono whitespace-nowrap max-w-[200px] truncate',
                                        val === null ? 'text-slate-400 italic' : 'text-slate-700'
                                      )}
                                      title={displayVal}
                                    >
                                      {displayVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {sandboxTableData.totalCount > sandboxPageSize && (
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-slate-500">
                            Page {sandboxPage} of {Math.ceil(sandboxTableData.totalCount / sandboxPageSize)} · {sandboxTableData.totalCount.toLocaleString()} total rows
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSandboxPage(p => Math.max(1, p - 1))}
                              disabled={sandboxPage <= 1}
                              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSandboxPage(p => p + 1)}
                              disabled={sandboxPage * sandboxPageSize >= sandboxTableData.totalCount}
                              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center">
                      <Database className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No data in sandbox table (structure created successfully)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sandbox Status (when no execution yet) */}
              {!executeSandbox.data && !executeSandbox.isPending && canTestInSandbox && (
                <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center">
                  {sandboxStatus?.exists ? (
                    <>
                      <Database className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-600 font-medium">Sandbox schema exists</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {sandboxStatus.tables.length} table(s): {sandboxStatus.tables.map(t => `${t.tableName} (${t.rowCount})`).join(', ')}
                      </p>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">
                        Click "Execute in Sandbox" to test the converted SQL in a safe sandbox schema
                      </p>
                      <p className="text-[10px] text-slate-400 mt-2">
                        Creates <code className="bg-slate-100 px-1 rounded">_datagen_sandbox</code> schema · Real PostgreSQL execution · No impact on production data
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DialectConverter;
