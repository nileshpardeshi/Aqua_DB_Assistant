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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import { useConvertDialect, type ConversionChange } from '@/hooks/use-migrations';

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

export function DialectConverter() {
  const { projectId } = useParams();
  const convertDialect = useConvertDialect();

  const [sourceDialect, setSourceDialect] = useState('postgresql');
  const [targetDialect, setTargetDialect] = useState('mysql');
  const [sourceSql, setSourceSql] = useState('');
  const [targetSql, setTargetSql] = useState('');
  const [changes, setChanges] = useState<ConversionChange[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState(-1);

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
        // Stop before "Complete" — that gets set when the API returns
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
    setProgressStep(PROGRESS_STEPS.length - 1); // "Complete"
  }, []);

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
    } catch (error) {
      console.error('Dialect conversion failed:', error);
      setTargetSql('-- Conversion failed. Please check your SQL and try again.');
      setChanges([]);
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
    }
  }, [sourceDialect, targetDialect, targetSql]);

  const handleLoadSample = useCallback(() => {
    setSourceSql(SAMPLE_SQL);
    setSourceDialect('postgresql');
    setTargetSql('');
    setChanges([]);
    setProgressStep(-1);
  }, []);

  const handleDownload = useCallback(() => {
    if (!targetSql) return;
    const blob = new Blob([targetSql], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_${targetDialect}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [targetSql, targetDialect]);

  const sourceDialectInfo = DIALECTS.find((d) => d.value === sourceDialect);
  const targetDialectInfo = DIALECTS.find((d) => d.value === targetDialect);

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
            </label>
            <button
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-aqua-600 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Load Sample
            </button>
          </div>
          <textarea
            value={sourceSql}
            onChange={(e) => setSourceSql(e.target.value)}
            placeholder={`-- Paste your ${sourceDialectInfo?.label || 'source'} SQL here\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE,\n  active BOOLEAN DEFAULT true,\n  created_at TIMESTAMP DEFAULT NOW()\n);`}
            rows={12}
            spellCheck={false}
            className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
          />
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
                    onClick={handleDownload}
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
            readOnly
            placeholder="Converted SQL will appear here..."
            rows={12}
            spellCheck={false}
            className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none resize-y selection:bg-aqua-500/30"
          />
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
          <ul className="divide-y divide-slate-100">
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
    </div>
  );
}

export default DialectConverter;
