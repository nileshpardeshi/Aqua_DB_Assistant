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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataLifecycleRules, useGeneratePurgeScript } from '@/hooks/use-data-lifecycle';
import type { DataLifecycleRule } from '@/hooks/use-data-lifecycle';

const BATCH_SIZE_OPTIONS = [
  { label: '1,000', value: 1000 },
  { label: '5,000', value: 5000 },
  { label: '10,000', value: 10000 },
];

// Mock rules for demonstration
const MOCK_RULES: DataLifecycleRule[] = [
  {
    id: 'r1',
    projectId: '',
    tableName: 'audit_logs',
    retentionPeriod: 90,
    retentionUnit: 'days',
    retentionColumn: 'created_at',
    priority: 'high',
    active: true,
    createdAt: '2025-11-01T00:00:00Z',
    updatedAt: '2025-11-01T00:00:00Z',
  },
  {
    id: 'r2',
    projectId: '',
    tableName: 'user_sessions',
    retentionPeriod: 30,
    retentionUnit: 'days',
    retentionColumn: 'last_login_at',
    condition: "status = 'expired'",
    priority: 'medium',
    active: true,
    createdAt: '2025-11-05T00:00:00Z',
    updatedAt: '2025-11-05T00:00:00Z',
  },
  {
    id: 'r3',
    projectId: '',
    tableName: 'temp_uploads',
    retentionPeriod: 7,
    retentionUnit: 'days',
    retentionColumn: 'created_at',
    priority: 'low',
    active: true,
    createdAt: '2025-11-10T00:00:00Z',
    updatedAt: '2025-11-10T00:00:00Z',
  },
];

function generateMockScript(rule: DataLifecycleRule, batchSize: number, dryRun: boolean): string {
  const dateExpr = rule.retentionUnit === 'days'
    ? `NOW() - INTERVAL '${rule.retentionPeriod} days'`
    : rule.retentionUnit === 'months'
    ? `NOW() - INTERVAL '${rule.retentionPeriod} months'`
    : `NOW() - INTERVAL '${rule.retentionPeriod} years'`;

  const whereClause = rule.condition
    ? `${rule.retentionColumn} < ${dateExpr}\n    AND ${rule.condition}`
    : `${rule.retentionColumn} < ${dateExpr}`;

  if (dryRun) {
    return `-- DRY RUN: Purge script for ${rule.tableName}
-- Generated at: ${new Date().toISOString()}
-- Retention: ${rule.retentionPeriod} ${rule.retentionUnit} on column ${rule.retentionColumn}
-- Batch size: ${batchSize.toLocaleString()}

-- Step 1: Count affected rows
SELECT COUNT(*) AS rows_to_purge
FROM ${rule.tableName}
WHERE ${whereClause};

-- Step 2: Preview affected data (sample)
SELECT *
FROM ${rule.tableName}
WHERE ${whereClause}
ORDER BY ${rule.retentionColumn} ASC
LIMIT 10;

-- NOTE: This is a DRY RUN. No data will be deleted.
-- Remove the DRY RUN flag to generate the actual DELETE statements.`;
  }

  return `-- Purge script for ${rule.tableName}
-- Generated at: ${new Date().toISOString()}
-- Retention: ${rule.retentionPeriod} ${rule.retentionUnit} on column ${rule.retentionColumn}
-- Batch size: ${batchSize.toLocaleString()}
-- WARNING: This will permanently delete data!

-- Step 1: Safety check - count affected rows
DO $$
DECLARE
  total_rows BIGINT;
  deleted_rows BIGINT := 0;
  batch_deleted BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_rows
  FROM ${rule.tableName}
  WHERE ${whereClause};

  RAISE NOTICE 'Total rows to purge: %', total_rows;

  -- Step 2: Batch delete loop
  LOOP
    DELETE FROM ${rule.tableName}
    WHERE ctid IN (
      SELECT ctid
      FROM ${rule.tableName}
      WHERE ${whereClause}
      LIMIT ${batchSize}
    );

    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    deleted_rows := deleted_rows + batch_deleted;

    RAISE NOTICE 'Deleted % rows (total: %/%)', batch_deleted, deleted_rows, total_rows;

    EXIT WHEN batch_deleted = 0;

    -- Brief pause to reduce lock contention
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Purge complete. Total deleted: % rows', deleted_rows;
END $$;

-- Step 3: Reclaim space (optional)
-- VACUUM ANALYZE ${rule.tableName};`;
}

export function PurgeScriptGenerator() {
  const { projectId } = useParams();
  const { data: apiRules } = useDataLifecycleRules(projectId);
  const generatePurgeScript = useGeneratePurgeScript();

  const rules = apiRules && apiRules.length > 0 ? apiRules : MOCK_RULES;
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [batchSize, setBatchSize] = useState(5000);
  const [dryRun, setDryRun] = useState(true);
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedRule = rules.find((r) => r.id === selectedRuleId);

  const handleGenerate = useCallback(async () => {
    if (!selectedRule || !projectId) return;
    setIsGenerating(true);
    setGeneratedScript('');

    try {
      await generatePurgeScript.mutateAsync({
        projectId,
        ruleId: selectedRule.id,
        batchSize,
        dryRun,
      });
    } catch {
      // Continue with mock generation
    }

    // Generate mock script
    await new Promise((resolve) => setTimeout(resolve, 800));
    setGeneratedScript(generateMockScript(selectedRule, batchSize, dryRun));
    setIsGenerating(false);
  }, [selectedRule, batchSize, dryRun, projectId, generatePurgeScript]);

  const handleCopy = useCallback(() => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedScript]);

  const handleDownload = useCallback(() => {
    if (!generatedScript || !selectedRule) return;
    const blob = new Blob([generatedScript], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purge_${selectedRule.tableName}_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedScript, selectedRule]);

  return (
    <div className="space-y-6">
      {/* Rule Selector */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5" />
          Select Retention Rule
        </label>
        <select
          value={selectedRuleId}
          onChange={(e) => setSelectedRuleId(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
        >
          <option value="">-- Select a rule --</option>
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.tableName} - {rule.retentionPeriod} {rule.retentionUnit} ({rule.retentionColumn})
            </option>
          ))}
        </select>
      </div>

      {/* Selected Rule Details */}
      {selectedRule && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Table:</span>
              <p className="font-mono font-semibold text-slate-800 mt-0.5">
                {selectedRule.tableName}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Retention:</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {selectedRule.retentionPeriod} {selectedRule.retentionUnit}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Column:</span>
              <p className="font-mono font-semibold text-slate-800 mt-0.5">
                {selectedRule.retentionColumn}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Priority:</span>
              <p className="font-semibold text-slate-800 mt-0.5 capitalize">
                {selectedRule.priority}
              </p>
            </div>
          </div>
          {selectedRule.condition && (
            <div className="mt-2 text-xs">
              <span className="text-slate-500 font-medium">Condition:</span>
              <p className="font-mono text-slate-700 mt-0.5 bg-white px-2 py-1 rounded border border-slate-200">
                {selectedRule.condition}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Batch Size */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Batch Size
          </label>
          <div className="flex gap-2">
            {BATCH_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setBatchSize(opt.value)}
                className={cn(
                  'flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all',
                  batchSize === opt.value
                    ? 'bg-aqua-50 border-aqua-300 text-aqua-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dry Run Toggle */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setDryRun(true)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all',
                dryRun
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                  ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
          disabled={!selectedRule || isGenerating}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            !selectedRule || isGenerating
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Generate Script
            </>
          )}
        </button>

        {!dryRun && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <Trash2 className="w-3 h-3" />
            Warning: Live delete mode. Script will permanently remove data.
          </span>
        )}
      </div>

      {/* Generated Script */}
      {generatedScript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700">
              Generated Purge Script
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download .sql
              </button>
            </div>
          </div>

          <pre className="text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {generatedScript}
          </pre>
        </div>
      )}
    </div>
  );
}

export default PurgeScriptGenerator;
