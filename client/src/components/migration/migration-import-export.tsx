import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  FileUp,
  FileDown,
  Copy,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  FileCode2,
  Loader2,
  ArrowRight,
  ClipboardPaste,
  FolderInput,
  Package,
  Database,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateMigration, useMigrations } from '@/hooks/use-migrations';
import type { Migration } from '@/hooks/use-migrations';
import { DATABASE_DIALECTS } from '@/config/constants';
import { downloadTextFile } from '@/lib/export-utils';

interface MigrationImportExportProps {
  projectId: string;
}

// ── Dialect Detection ────────────────────────────────────────────────────────

const DIALECT_PATTERNS: Array<{ pattern: RegExp; dialect: string; label: string }> = [
  { pattern: /\bSERIAL\b|\bBIGSERIAL\b|\bBYTEA\b|\bTIMESTAMPTZ\b|\bJSONB\b/i, dialect: 'postgresql', label: 'PostgreSQL' },
  { pattern: /\bAUTO_INCREMENT\b|\bENGINE\s*=\s*InnoDB\b|\bTINYINT\(1\)/i, dialect: 'mysql', label: 'MySQL' },
  { pattern: /\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)|\bNVARCHAR\(MAX\)|\bGETDATE\(\)/i, dialect: 'sqlserver', label: 'SQL Server' },
  { pattern: /\bVARCHAR2\b|\bNUMBER\b.*\bGENERATED\b|\bSYSDATE\b|\bCLOB\b/i, dialect: 'oracle', label: 'Oracle' },
  { pattern: /\bINET4\b|\bINET6\b/i, dialect: 'mariadb', label: 'MariaDB' },
  { pattern: /\bVARIANT\b|\bTIMESTAMP_NTZ\b|\bTIMESTAMP_LTZ\b/i, dialect: 'snowflake', label: 'Snowflake' },
  { pattern: /\bINT64\b|\bFLOAT64\b|\bBIGNUMERIC\b|\bSTRUCT\b/i, dialect: 'bigquery', label: 'BigQuery' },
];

function detectDialect(sql: string): { dialect: string; label: string; confidence: string } {
  for (const { pattern, dialect, label } of DIALECT_PATTERNS) {
    if (pattern.test(sql)) {
      return { dialect, label, confidence: 'high' };
    }
  }
  return { dialect: 'postgresql', label: 'PostgreSQL', confidence: 'low' };
}

function countStatements(sql: string): number {
  return sql.split(';').filter((s) => s.trim().length > 0).length;
}

// ── Bundle Format ────────────────────────────────────────────────────────────

interface MigrationBundle {
  format: string;
  version: string;
  sourceDialect: string;
  targetDialect: string;
  migrations: Array<{
    version: string;
    title: string;
    description?: string;
    upSQL: string;
    downSQL?: string;
  }>;
}

function validateBundle(data: unknown): data is MigrationBundle {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.format === 'aqua-migration-bundle' &&
    typeof obj.version === 'string' &&
    Array.isArray(obj.migrations) &&
    obj.migrations.length > 0
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function MigrationImportExport({ projectId }: MigrationImportExportProps) {
  const { data: migrations } = useMigrations(projectId);
  const createMigration = useCreateMigration();

  // Import state
  const [importMode, setImportMode] = useState<'sql' | 'clipboard' | 'bundle'>('sql');
  const [clipboardSql, setClipboardSql] = useState('');
  const [importedFile, setImportedFile] = useState<{ name: string; content: string } | null>(null);
  const [detectedDialect, setDetectedDialect] = useState<ReturnType<typeof detectDialect> | null>(null);
  const [importTitle, setImportTitle] = useState('');
  const [importVersion, setImportVersion] = useState('');
  const [importTargetDialect, setImportTargetDialect] = useState('mysql');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bundlePreview, setBundlePreview] = useState<MigrationBundle | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);

  const DIALECTS = DATABASE_DIALECTS.filter((d) =>
    ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb', 'snowflake', 'bigquery'].includes(d.value)
  );

  // Auto-suggest next version
  const nextVersion = (() => {
    if (!migrations || migrations.length === 0) return '001';
    const versions = migrations.map((m) => parseInt(m.version, 10)).filter((v) => !isNaN(v));
    const max = Math.max(0, ...versions);
    return String(max + 1).padStart(3, '0');
  })();

  // ── Import: SQL File ───────────────────────────────────────────────────────

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setImportedFile({ name: file.name, content });
      const detected = detectDialect(content);
      setDetectedDialect(detected);
      setImportTitle(file.name.replace(/\.sql$/i, ''));
      setImportVersion(nextVersion);
      setImportResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [nextVersion]);

  // ── Import: Clipboard ──────────────────────────────────────────────────────

  const handleClipboardAnalyze = useCallback(() => {
    if (!clipboardSql.trim()) return;
    const detected = detectDialect(clipboardSql);
    setDetectedDialect(detected);
    setImportTitle('Imported migration');
    setImportVersion(nextVersion);
    setImportResult(null);
  }, [clipboardSql, nextVersion]);

  // ── Import: Bundle ─────────────────────────────────────────────────────────

  const handleBundleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (validateBundle(data)) {
          setBundlePreview(data);
          setImportResult(null);
        } else {
          setImportResult({ success: false, message: 'Invalid bundle format. Expected "aqua-migration-bundle" format.' });
        }
      } catch {
        setImportResult({ success: false, message: 'Failed to parse JSON file.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // ── Create Migration from SQL ──────────────────────────────────────────────

  const handleImportAsMigration = useCallback(async () => {
    const sql = importMode === 'clipboard' ? clipboardSql : importedFile?.content;
    if (!sql?.trim() || !importTitle.trim() || !importVersion.trim() || !detectedDialect) return;

    setIsImporting(true);
    setImportResult(null);
    try {
      await createMigration.mutateAsync({
        projectId,
        version: importVersion,
        title: importTitle,
        upSQL: sql,
        sourceDialect: detectedDialect.dialect,
        targetDialect: importTargetDialect,
        description: `Imported from ${importMode === 'clipboard' ? 'clipboard' : importedFile?.name ?? 'file'}`,
      });
      setImportResult({ success: true, message: 'Migration created successfully!' });
      setImportedFile(null);
      setClipboardSql('');
      setDetectedDialect(null);
    } catch (err) {
      setImportResult({ success: false, message: `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    } finally {
      setIsImporting(false);
    }
  }, [importMode, clipboardSql, importedFile, importTitle, importVersion, detectedDialect, importTargetDialect, projectId, createMigration]);

  // ── Bulk Import from Bundle ────────────────────────────────────────────────

  const handleBulkImport = useCallback(async () => {
    if (!bundlePreview) return;
    setIsBulkImporting(true);
    setImportResult(null);

    let successCount = 0;
    let failCount = 0;
    for (const script of bundlePreview.migrations) {
      try {
        await createMigration.mutateAsync({
          projectId,
          version: script.version,
          title: script.title,
          description: script.description,
          upSQL: script.upSQL,
          downSQL: script.downSQL,
          sourceDialect: bundlePreview.sourceDialect,
          targetDialect: bundlePreview.targetDialect,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setImportResult({
      success: failCount === 0,
      message: `Imported ${successCount} of ${bundlePreview.migrations.length} migrations${failCount > 0 ? ` (${failCount} failed)` : ''}.`,
    });
    setBundlePreview(null);
    setIsBulkImporting(false);
  }, [bundlePreview, projectId, createMigration]);

  // ── Export Functions ───────────────────────────────────────────────────────

  const handleExportBundle = useCallback(() => {
    if (!migrations || migrations.length === 0) return;
    const bundle: MigrationBundle = {
      format: 'aqua-migration-bundle',
      version: '1.0',
      sourceDialect: migrations[0].sourceDialect,
      targetDialect: migrations[0].targetDialect,
      migrations: migrations
        .sort((a, b) => a.version.localeCompare(b.version))
        .map((m) => ({
          version: m.version,
          title: m.title,
          description: m.description ?? undefined,
          upSQL: m.upSQL,
          downSQL: m.downSQL ?? undefined,
        })),
    };
    downloadTextFile(JSON.stringify(bundle, null, 2), 'migration-bundle.json');
  }, [migrations]);

  const handleExportUpScripts = useCallback(() => {
    if (!migrations || migrations.length === 0) return;
    const sorted = [...migrations].sort((a, b) => a.version.localeCompare(b.version));
    const content = sorted
      .map((m) => `-- ============================================\n-- Migration v${m.version}: ${m.title}\n-- Status: ${m.status}\n-- ============================================\n\n${m.upSQL}`)
      .join('\n\n');
    downloadTextFile(content, 'migrations-up.sql');
  }, [migrations]);

  const handleExportDownScripts = useCallback(() => {
    if (!migrations || migrations.length === 0) return;
    const sorted = [...migrations].sort((a, b) => b.version.localeCompare(a.version));
    const withDown = sorted.filter((m) => m.downSQL);
    if (withDown.length === 0) return;
    const content = withDown
      .map((m) => `-- ============================================\n-- Rollback v${m.version}: ${m.title}\n-- ============================================\n\n${m.downSQL}`)
      .join('\n\n');
    downloadTextFile(content, 'migrations-rollback.sql');
  }, [migrations]);

  const handleExportJSON = useCallback(() => {
    if (!migrations || migrations.length === 0) return;
    downloadTextFile(JSON.stringify(migrations, null, 2), 'migrations-full.json');
  }, [migrations]);

  const hasDownScripts = migrations?.some((m) => m.downSQL) ?? false;
  const sqlContent = importMode === 'clipboard' ? clipboardSql : importedFile?.content;
  const stmtCount = sqlContent ? countStatements(sqlContent) : 0;

  return (
    <div className="space-y-6">
      {/* ── Import Section ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Upload className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm font-semibold text-slate-800">Import</h4>
        </div>

        {/* Import mode tabs */}
        <div className="px-5 pt-4 flex items-center gap-1">
          {([
            { id: 'sql' as const, label: 'SQL File', icon: FileUp },
            { id: 'clipboard' as const, label: 'Clipboard', icon: ClipboardPaste },
            { id: 'bundle' as const, label: 'Migration Bundle', icon: Package },
          ]).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setImportMode(tab.id); setImportResult(null); }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  importMode === tab.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">
          {/* SQL File Import */}
          {importMode === 'sql' && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors"
              >
                <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  {importedFile ? importedFile.name : 'Click to upload or drag .sql file'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports .sql and .txt files</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}

          {/* Clipboard Import */}
          {importMode === 'clipboard' && (
            <>
              <textarea
                value={clipboardSql}
                onChange={(e) => setClipboardSql(e.target.value)}
                placeholder="Paste your SQL statements here..."
                rows={8}
                spellCheck={false}
                className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-y"
              />
              <button
                onClick={handleClipboardAnalyze}
                disabled={!clipboardSql.trim()}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors',
                  clipboardSql.trim()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <Database className="w-3.5 h-3.5" />
                Analyze SQL
              </button>
            </>
          )}

          {/* Bundle Import */}
          {importMode === 'bundle' && (
            <>
              <div
                onClick={() => bundleInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors"
              >
                <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  Click to upload migration bundle (.json)
                </p>
                <p className="text-xs text-slate-400 mt-1">Aqua migration bundle format</p>
              </div>
              <input
                ref={bundleInputRef}
                type="file"
                accept=".json"
                onChange={handleBundleUpload}
                className="hidden"
              />

              {bundlePreview && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-slate-800">
                      Bundle Preview
                    </h5>
                    <button onClick={() => setBundlePreview(null)} className="p-1 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>{bundlePreview.migrations.length} migrations</span>
                    <span>{bundlePreview.sourceDialect} → {bundlePreview.targetDialect}</span>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {bundlePreview.migrations.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600 py-1 px-2 bg-card rounded">
                        <span className="font-mono font-medium text-purple-600">v{m.version}</span>
                        <span>{m.title}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleBulkImport}
                    disabled={isBulkImporting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {isBulkImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Import All Migrations
                  </button>
                </div>
              )}
            </>
          )}

          {/* Detection Results (for SQL file and clipboard modes) */}
          {detectedDialect && importMode !== 'bundle' && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-medium text-slate-600">Detected Dialect:</span>
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full',
                  detectedDialect.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {detectedDialect.label}
                  {detectedDialect.confidence === 'low' && ' (guessed)'}
                </span>
                <span className="text-xs text-slate-500">{stmtCount} statement{stmtCount !== 1 ? 's' : ''} found</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Version</label>
                  <input
                    value={importVersion}
                    onChange={(e) => setImportVersion(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Title</label>
                  <input
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Target Dialect</label>
                <select
                  value={importTargetDialect}
                  onChange={(e) => setImportTargetDialect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                >
                  {DIALECTS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleImportAsMigration}
                disabled={isImporting || !importTitle.trim() || !importVersion.trim()}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors',
                  !isImporting && importTitle.trim() && importVersion.trim()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Create as Migration
              </button>
            </div>
          )}

          {/* Result Message */}
          {importResult && (
            <div className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium',
              importResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}>
              {importResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {importResult.message}
            </div>
          )}
        </div>
      </div>

      {/* ── Export Section ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Download className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm font-semibold text-slate-800">Export</h4>
          {migrations && (
            <span className="text-[10px] font-medium text-slate-400 ml-auto">
              {migrations.length} migration{migrations.length !== 1 ? 's' : ''} available
            </span>
          )}
        </div>

        <div className="p-5">
          {!migrations || migrations.length === 0 ? (
            <div className="text-center py-8">
              <FolderInput className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No migrations to export</p>
              <p className="text-xs text-slate-400 mt-1">Create migrations first, then export them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportBundle}
                className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/30 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Migration Bundle</p>
                  <p className="text-[10px] text-slate-500">Complete JSON bundle (re-importable)</p>
                </div>
              </button>

              <button
                onClick={handleExportUpScripts}
                className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/30 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
                  <FileCode2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">UP Scripts (.sql)</p>
                  <p className="text-[10px] text-slate-500">All forward migrations in order</p>
                </div>
              </button>

              <button
                onClick={handleExportDownScripts}
                disabled={!hasDownScripts}
                className={cn(
                  'flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg transition-all text-left group',
                  hasDownScripts
                    ? 'hover:border-purple-300 hover:bg-purple-50/30'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <FileDown className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Rollback Scripts (.sql)</p>
                  <p className="text-[10px] text-slate-500">
                    {hasDownScripts ? 'All DOWN migrations in reverse order' : 'No rollback scripts available'}
                  </p>
                </div>
              </button>

              <button
                onClick={handleExportJSON}
                className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/30 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                  <FileJson className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Full Data (JSON)</p>
                  <p className="text-[10px] text-slate-500">Complete migration records with metadata</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MigrationImportExport;
