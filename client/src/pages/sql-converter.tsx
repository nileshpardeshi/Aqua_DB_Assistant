import { useState, useRef, useCallback } from 'react';
import {
  ArrowRightLeft,
  Upload,
  Trash2,
  Copy,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ArrowRight,
  FileText,
  Zap,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import {
  useConvertSQL,
  useValidateSQL,
  useDetectDialect,
} from '@/hooks/use-tools';
import type { ConversionChange } from '@/hooks/use-tools';
import toast from 'react-hot-toast';

export function SQLConverterPage() {
  // State
  const [sourceSQL, setSourceSQL] = useState('');
  const [convertedSQL, setConvertedSQL] = useState('');
  const [sourceDialect, setSourceDialect] = useState('postgresql');
  const [targetDialect, setTargetDialect] = useState('mysql');
  const [changes, setChanges] = useState<ConversionChange[]>([]);
  const [validationStatus, setValidationStatus] = useState<
    'idle' | 'valid' | 'invalid' | 'checking'
  >('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const convertSQL = useConvertSQL();
  const validateSQL = useValidateSQL();
  const detectDialect = useDetectDialect();

  // Handlers

  const handleConvert = useCallback(() => {
    if (!sourceSQL.trim()) {
      toast.error('Please enter SQL to convert');
      return;
    }

    convertSQL.mutate(
      {
        sql: sourceSQL,
        sourceDialect,
        targetDialect,
      },
      {
        onSuccess: (result) => {
          setConvertedSQL(result.sql);
          setChanges(result.changes);
          setValidationStatus('idle');
          if (result.changes.length === 0) {
            toast('No conversions needed - SQL is already compatible', {
              icon: '\u2139\uFE0F',
            });
          } else {
            toast.success(
              `Converted successfully with ${result.changes.length} change${result.changes.length === 1 ? '' : 's'}`,
            );
          }
        },
        onError: (error: any) => {
          toast.error(error?.message || 'Conversion failed');
        },
      },
    );
  }, [sourceSQL, sourceDialect, targetDialect, convertSQL]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData('text');
      if (pastedText.trim().length > 20) {
        // Auto-detect dialect on paste
        setTimeout(() => {
          detectDialect.mutate(
            { sql: pastedText },
            {
              onSuccess: (result) => {
                if (result.dialect && result.dialect !== sourceDialect) {
                  setSourceDialect(result.dialect);
                  toast.success(`Detected dialect: ${getDialectLabel(result.dialect)}`);
                }
              },
            },
          );
        }, 100);
      }
    },
    [detectDialect, sourceDialect],
  );

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setSourceSQL(content);
        toast.success(`Loaded ${file.name}`);

        // Auto-detect dialect
        if (content.trim().length > 20) {
          detectDialect.mutate(
            { sql: content },
            {
              onSuccess: (result) => {
                if (result.dialect) {
                  setSourceDialect(result.dialect);
                  toast.success(`Detected dialect: ${getDialectLabel(result.dialect)}`);
                }
              },
            },
          );
        }
      };
      reader.readAsText(file);

      // Reset file input so the same file can be uploaded again
      e.target.value = '';
    },
    [detectDialect],
  );

  const handleClear = useCallback(() => {
    setSourceSQL('');
    setConvertedSQL('');
    setChanges([]);
    setValidationStatus('idle');
    setValidationMessage('');
  }, []);

  const handleCopyToClipboard = useCallback(async () => {
    if (!convertedSQL) return;
    try {
      await navigator.clipboard.writeText(convertedSQL);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [convertedSQL]);

  const handleDownload = useCallback(() => {
    if (!convertedSQL) return;
    const blob = new Blob([convertedSQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_${targetDialect}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded SQL file');
  }, [convertedSQL, targetDialect]);

  const handleDryRun = useCallback(() => {
    if (!convertedSQL.trim()) {
      toast.error('No converted SQL to validate');
      return;
    }

    setValidationStatus('checking');
    validateSQL.mutate(
      { sql: convertedSQL, dialect: targetDialect },
      {
        onSuccess: (result) => {
          if (result.valid) {
            setValidationStatus('valid');
            setValidationMessage(
              `Valid SQL. ${result.tablesFound} table${result.tablesFound === 1 ? '' : 's'} found.`,
            );
            toast.success('SQL validation passed');
          } else {
            setValidationStatus('invalid');
            setValidationMessage(result.errors.join('; ') || 'Validation failed');
            toast.error('SQL validation found issues');
          }
        },
        onError: (error: any) => {
          setValidationStatus('invalid');
          setValidationMessage(error?.message || 'Validation failed');
          toast.error('Validation request failed');
        },
      },
    );
  }, [convertedSQL, targetDialect, validateSQL]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aqua-100 to-cyan-100 flex items-center justify-center">
          <ArrowRightLeft className="w-5 h-5 text-aqua-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">SQL Converter</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Convert SQL scripts between database dialects
          </p>
        </div>
      </div>

      {/* Main Converter Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-start">
        {/* Source Panel */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Source Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Source
              </span>
              <DialectSelect
                value={sourceDialect}
                onChange={setSourceDialect}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleFileUpload}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
                title="Upload .sql file"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </button>
              <button
                onClick={handleClear}
                disabled={!sourceSQL}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          {/* Source Textarea */}
          <textarea
            value={sourceSQL}
            onChange={(e) => setSourceSQL(e.target.value)}
            onPaste={handlePaste}
            placeholder={`Paste or type your SQL here...\n\nExample:\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  email TEXT UNIQUE,\n  is_active BOOLEAN DEFAULT true,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);`}
            className="w-full min-h-[320px] px-4 py-3 text-sm font-mono bg-card text-foreground placeholder:text-muted-foreground resize-y focus:outline-none"
            spellCheck={false}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Center Convert Button */}
        <div className="flex lg:flex-col items-center justify-center gap-3 py-4">
          <button
            onClick={handleConvert}
            disabled={!sourceSQL.trim() || convertSQL.isPending}
            className={cn(
              'group relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl shadow-lg transition-all duration-200',
              'bg-gradient-to-r from-aqua-500 to-cyan-500 text-white',
              'hover:from-aqua-600 hover:to-cyan-600 hover:shadow-xl hover:shadow-aqua-500/25',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
              'active:scale-95',
            )}
          >
            {convertSQL.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
            )}
            <span className="hidden lg:inline">Convert</span>
          </button>
        </div>

        {/* Target Panel */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Target Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Target
              </span>
              <DialectSelect
                value={targetDialect}
                onChange={setTargetDialect}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDryRun}
                disabled={!convertedSQL || validateSQL.isPending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 border border-aqua-200 rounded-lg hover:bg-aqua-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Validate converted SQL"
              >
                {validateSQL.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                Dry Run
              </button>
              <button
                onClick={handleCopyToClipboard}
                disabled={!convertedSQL}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Copy to clipboard"
              >
                {copied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy
              </button>
              <button
                onClick={handleDownload}
                disabled={!convertedSQL}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Download .sql file"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>

          {/* Target Textarea */}
          <div className="relative">
            <textarea
              value={convertedSQL}
              readOnly
              placeholder="Converted SQL will appear here..."
              className="w-full min-h-[320px] px-4 py-3 text-sm font-mono bg-muted/50 text-foreground placeholder:text-muted-foreground resize-y focus:outline-none"
              spellCheck={false}
            />

            {/* Validation Badge */}
            {validationStatus !== 'idle' && (
              <div
                className={cn(
                  'absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm',
                  validationStatus === 'checking' && 'bg-blue-50 text-blue-700 border border-blue-200',
                  validationStatus === 'valid' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                  validationStatus === 'invalid' && 'bg-red-50 text-red-700 border border-red-200',
                )}
              >
                {validationStatus === 'checking' && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {validationStatus === 'valid' && (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {validationStatus === 'invalid' && (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span className="max-w-[200px] truncate">
                  {validationStatus === 'checking'
                    ? 'Validating...'
                    : validationMessage}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversion Changelog */}
      {changes.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-aqua-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Conversion Changelog
              </h3>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-aqua-50 text-aqua-700 border border-aqua-200/50">
              {changes.length} change{changes.length === 1 ? '' : 's'} applied
            </span>
          </div>

          <div className="max-h-[280px] overflow-y-auto divide-y divide-border">
            {changes.map((change, index) => (
              <div
                key={index}
                className="flex items-start gap-4 px-5 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-6 h-6 rounded-full bg-aqua-100 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-aqua-600">
                      {index + 1}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="px-2 py-0.5 text-xs font-mono bg-red-50 text-red-700 rounded border border-red-200/50">
                      {change.original}
                    </code>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <code className="px-2 py-0.5 text-xs font-mono bg-emerald-50 text-emerald-700 rounded border border-emerald-200/50">
                      {change.converted}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {change.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no conversion done yet */}
      {changes.length === 0 && !convertSQL.isPending && !convertedSQL && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Info className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Ready to Convert
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Paste SQL in the source panel, select your source and target dialects,
              then click Convert. The changelog will show all transformations applied.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Dialect Dropdown Component ----------

function DialectSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const dialect = DATABASE_DIALECTS.find((d) => d.value === value);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent cursor-pointer"
        style={{
          borderLeftColor: dialect?.color || '#64748b',
          borderLeftWidth: '3px',
        }}
      >
        {DATABASE_DIALECTS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ---------- Helpers ----------

function getDialectLabel(value: string): string {
  return DATABASE_DIALECTS.find((d) => d.value === value)?.label || value;
}

export default SQLConverterPage;
