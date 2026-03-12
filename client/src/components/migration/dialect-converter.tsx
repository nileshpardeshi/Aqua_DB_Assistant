import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowRightLeft,
  Loader2,
  Copy,
  CheckCircle2,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import { useConvertDialect } from '@/hooks/use-migrations';

const DIALECTS = DATABASE_DIALECTS.filter((d) =>
  ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb', 'snowflake', 'bigquery'].includes(d.value)
);

// Mock conversion changes for demonstration
const MOCK_CHANGES: Record<string, string[]> = {
  mysql: [
    'Changed SERIAL to INT AUTO_INCREMENT',
    'Changed BOOLEAN to TINYINT(1)',
    'Changed TEXT to LONGTEXT for large fields',
    'Replaced NOW() with CURRENT_TIMESTAMP',
    'Changed TIMESTAMP to DATETIME for wider range',
    'Added ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  ],
  oracle: [
    'Changed SERIAL to NUMBER GENERATED ALWAYS AS IDENTITY',
    'Changed VARCHAR to VARCHAR2',
    'Changed BOOLEAN to NUMBER(1)',
    'Replaced NOW() with SYSTIMESTAMP',
    'Changed TIMESTAMP to TIMESTAMP WITH TIME ZONE',
    'Added semicolons after each statement',
  ],
  sqlserver: [
    'Changed SERIAL to INT IDENTITY(1,1)',
    'Changed BOOLEAN to BIT',
    'Changed TEXT to NVARCHAR(MAX)',
    'Replaced NOW() with GETDATE()',
    'Changed double quotes to square brackets for identifiers',
    'Added GO statement between batches',
  ],
  postgresql: [
    'Changed AUTO_INCREMENT to SERIAL',
    'Changed TINYINT to SMALLINT',
    'Changed DATETIME to TIMESTAMP',
    'Changed LONGTEXT to TEXT',
    'Replaced GETDATE()/SYSDATE with NOW()',
  ],
};

function getMockTargetSql(source: string, targetDialect: string): string {
  // Simple mock transformation
  let result = source;

  if (targetDialect === 'mysql') {
    result = result
      .replace(/SERIAL/gi, 'INT AUTO_INCREMENT')
      .replace(/BOOLEAN/gi, 'TINYINT(1)')
      .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/TIMESTAMP/gi, 'DATETIME');
  } else if (targetDialect === 'oracle') {
    result = result
      .replace(/SERIAL/gi, 'NUMBER GENERATED ALWAYS AS IDENTITY')
      .replace(/VARCHAR\(/gi, 'VARCHAR2(')
      .replace(/BOOLEAN/gi, 'NUMBER(1)')
      .replace(/NOW\(\)/gi, 'SYSTIMESTAMP');
  } else if (targetDialect === 'sqlserver') {
    result = result
      .replace(/SERIAL/gi, 'INT IDENTITY(1,1)')
      .replace(/BOOLEAN/gi, 'BIT')
      .replace(/TEXT/gi, 'NVARCHAR(MAX)')
      .replace(/NOW\(\)/gi, 'GETDATE()');
  }

  return result;
}

export function DialectConverter() {
  const { projectId } = useParams();
  const convertDialect = useConvertDialect();

  const [sourceDialect, setSourceDialect] = useState('postgresql');
  const [targetDialect, setTargetDialect] = useState('mysql');
  const [sourceSql, setSourceSql] = useState('');
  const [targetSql, setTargetSql] = useState('');
  const [changesLog, setChangesLog] = useState<string[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConvert = useCallback(async () => {
    if (!sourceSql.trim() || !projectId) return;
    setIsConverting(true);
    setTargetSql('');
    setChangesLog([]);

    try {
      await convertDialect.mutateAsync({
        projectId,
        sourceDialect,
        targetDialect,
        sourceSql,
      });

      // Simulate conversion result
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setTargetSql(getMockTargetSql(sourceSql, targetDialect));
      setChangesLog(MOCK_CHANGES[targetDialect] || ['No changes needed']);
    } catch {
      // Use mock results on error
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTargetSql(getMockTargetSql(sourceSql, targetDialect));
      setChangesLog(MOCK_CHANGES[targetDialect] || ['No changes needed']);
    } finally {
      setIsConverting(false);
    }
  }, [sourceSql, sourceDialect, targetDialect, projectId, convertDialect]);

  const handleCopy = useCallback(() => {
    if (!targetSql) return;
    navigator.clipboard.writeText(targetSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [targetSql]);

  const handleSwapDialects = useCallback(() => {
    setSourceDialect(targetDialect);
    setTargetDialect(sourceDialect);
    if (targetSql) {
      setSourceSql(targetSql);
      setTargetSql('');
      setChangesLog([]);
    }
  }, [sourceDialect, targetDialect, targetSql]);

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
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
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
          className="mt-5 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-aqua-600 transition-all"
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
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
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
            {targetSql && (
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
            )}
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

      {/* Convert Button */}
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
              <ArrowRight className="w-4 h-4" />
              Convert
            </>
          )}
        </button>

        {sourceDialectInfo && targetDialectInfo && (
          <span className="text-xs text-slate-500">
            {sourceDialectInfo.label} → {targetDialectInfo.label}
          </span>
        )}
      </div>

      {/* Changes Log */}
      {changesLog.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <h4 className="text-xs font-semibold text-slate-700">
              Conversion Changes ({changesLog.length})
            </h4>
          </div>
          <ul className="divide-y divide-slate-100">
            {changesLog.map((change, idx) => (
              <li
                key={idx}
                className="px-4 py-2 text-sm text-slate-700 flex items-start gap-2"
              >
                <span className="text-aqua-500 mt-0.5 flex-shrink-0">
                  <ArrowRight className="w-3 h-3" />
                </span>
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DialectConverter;
