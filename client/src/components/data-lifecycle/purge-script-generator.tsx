import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Trash2,
  Play,
  Loader2,
  Copy,
  CheckCircle2,
  Download,
  Shield,
  FileCode,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDataLifecycleRules,
  useGeneratePurgeScript,
  parseRuleConfig,
} from '@/hooks/use-data-lifecycle';

const BATCH_SIZE_OPTIONS = [
  { label: '500', value: 500 },
  { label: '1,000', value: 1000 },
  { label: '5,000', value: 5000 },
  { label: '10,000', value: 10000 },
  { label: '50,000', value: 50000 },
];

const DIALECT_OPTIONS = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mariadb', label: 'MariaDB' },
];

export function PurgeScriptGenerator() {
  const { projectId } = useParams();
  const { data: rules, isLoading } = useDataLifecycleRules(projectId);
  const generatePurgeScript = useGeneratePurgeScript();

  const activeRules = rules?.filter((r) => r.isActive) ?? [];

  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [batchSize, setBatchSize] = useState(5000);
  const [dryRun, setDryRun] = useState(true);
  const [dialect, setDialect] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [scriptMeta, setScriptMeta] = useState<{ ruleName: string; targetTable: string; dryRun: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedRule = rules?.find((r) => r.id === selectedRuleId);
  const selectedConfig = selectedRule ? parseRuleConfig(selectedRule) : null;

  // Auto-set dialect from rule config when selecting a rule
  const handleRuleSelect = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setGeneratedScript('');
    setScriptMeta(null);
    const rule = rules?.find((r) => r.id === ruleId);
    if (rule) {
      const config = parseRuleConfig(rule);
      setDialect(config.sqlDialect || 'postgresql');
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!selectedRule || !projectId) return;

    try {
      const result = await generatePurgeScript.mutateAsync({
        projectId,
        ruleId: selectedRule.id,
        batchSize,
        dryRun,
        dialect: dialect || undefined,
      });
      setGeneratedScript(result.script);
      setScriptMeta({
        ruleName: result.ruleName,
        targetTable: result.targetTable,
        dryRun: result.dryRun,
      });
    } catch {
      // Error handled by mutation
    }
  }, [selectedRule, batchSize, dryRun, dialect, projectId, generatePurgeScript]);

  const handleCopy = useCallback(() => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedScript]);

  const handleDownload = useCallback(() => {
    if (!generatedScript || !scriptMeta) return;
    const prefix = dryRun ? 'dryrun' : 'purge';
    const blob = new Blob([generatedScript], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${scriptMeta.targetTable}_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedScript, scriptMeta, dryRun]);

  return (
    <div className="space-y-6">
      {/* Rule Selector */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5" />
          Select Retention Rule
        </label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading rules...
          </div>
        ) : activeRules.length === 0 ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="font-medium">No active retention rules found</p>
              <p className="text-xs mt-0.5">Create a retention rule in the "Retention Policies" tab first, then come back here to generate purge scripts.</p>
            </div>
          </div>
        ) : (
          <select
            value={selectedRuleId}
            onChange={(e) => handleRuleSelect(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          >
            <option value="">-- Select a rule ({activeRules.length} active) --</option>
            {activeRules.map((rule) => {
              const config = parseRuleConfig(rule);
              return (
                <option key={rule.id} value={rule.id}>
                  {rule.ruleName} — {rule.targetTable} ({config.retentionPeriod} {config.retentionUnit})
                </option>
              );
            })}
          </select>
        )}
      </div>

      {/* Selected Rule Details */}
      {selectedRule && selectedConfig && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground font-medium">Table</span>
              <p className="font-mono font-semibold text-foreground mt-0.5">
                {selectedRule.targetTable}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground font-medium">Retention</span>
              <p className="font-semibold text-foreground mt-0.5">
                {selectedConfig.retentionPeriod} {selectedConfig.retentionUnit}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground font-medium">Date Column</span>
              <p className="font-mono font-semibold text-foreground mt-0.5">
                {selectedConfig.retentionColumn}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground font-medium">Priority</span>
              <p className="font-semibold text-foreground mt-0.5 capitalize">
                {selectedConfig.priority}
              </p>
            </div>
          </div>
          {selectedConfig.conditions.length > 0 && (
            <div className="mt-2 text-xs">
              <span className="text-muted-foreground font-medium">Conditions:</span>
              <div className="mt-1 space-y-0.5">
                {selectedConfig.conditions.map((c, i) => (
                  <code key={i} className="block font-mono text-foreground bg-card px-2 py-0.5 rounded border border-border">
                    {i > 0 ? `${c.conjunction} ` : ''}{c.column} {c.operator}
                    {c.operator !== 'IS NULL' && c.operator !== 'IS NOT NULL' && ` '${c.value}'`}
                  </code>
                ))}
              </div>
            </div>
          )}
          {selectedConfig.backupBeforePurge && (
            <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> Backup table will be created before deletion
            </p>
          )}
        </div>
      )}

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Batch Size */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Batch Size
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {BATCH_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setBatchSize(opt.value)}
                className={cn(
                  'px-2.5 py-2 text-xs font-medium rounded-lg border transition-all',
                  batchSize === opt.value
                    ? 'bg-aqua-50 dark:bg-aqua-900/20 border-aqua-300 dark:border-aqua-700 text-aqua-700 dark:text-aqua-400 shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* SQL Dialect Override */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            SQL Dialect
          </label>
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          >
            {DIALECT_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Mode Toggle */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setDryRun(true)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all',
                dryRun
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              Dry Run
            </button>
            <button
              onClick={() => setDryRun(false)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all',
                !dryRun
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Live Delete
            </button>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={!selectedRule || generatePurgeScript.isPending}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            !selectedRule || generatePurgeScript.isPending
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : dryRun
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-red-600 text-white hover:bg-red-700'
          )}
        >
          {generatePurgeScript.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {dryRun ? 'Generate Dry Run Script' : 'Generate Purge Script'}
            </>
          )}
        </button>

        {!dryRun && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Live delete mode. Script will permanently remove data.
          </span>
        )}
      </div>

      {/* Error Display */}
      {generatePurgeScript.isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Failed to generate script. Please check the rule configuration and try again.
        </div>
      )}

      {/* Generated Script */}
      {generatedScript && scriptMeta && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-foreground">
                Generated {scriptMeta.dryRun ? 'Dry Run' : 'Purge'} Script
              </h4>
              <span className={cn(
                'px-2 py-0.5 text-[10px] font-bold rounded',
                scriptMeta.dryRun
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                  : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
              )}>
                {scriptMeta.dryRun ? 'DRY RUN' : 'LIVE DELETE'}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download .sql
              </button>
            </div>
          </div>

          <pre className="text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
            {generatedScript}
          </pre>

          {/* Script Info */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>Table: <span className="font-mono">{scriptMeta.targetTable}</span></span>
            <span>Dialect: {dialect}</span>
            <span>Batch: {batchSize.toLocaleString()}</span>
            <span>{generatedScript.split('\n').length} lines</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PurgeScriptGenerator;
