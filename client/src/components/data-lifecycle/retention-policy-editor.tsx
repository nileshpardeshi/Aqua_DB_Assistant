import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Save,
  Loader2,
  Clock,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateRule } from '@/hooks/use-data-lifecycle';

const RETENTION_COLUMNS = [
  'created_at',
  'updated_at',
  'deleted_at',
  'last_login_at',
  'expires_at',
  'processed_at',
];

const PRIORITY_OPTIONS: {
  value: 'critical' | 'high' | 'medium' | 'low';
  label: string;
  color: string;
  bg: string;
}[] = [
  { value: 'critical', label: 'Critical', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  { value: 'high', label: 'High', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  { value: 'medium', label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { value: 'low', label: 'Low', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
];

export function RetentionPolicyEditor() {
  const { projectId } = useParams();
  const createRule = useCreateRule();

  const [tableName, setTableName] = useState('');
  const [retentionPeriod, setRetentionPeriod] = useState(90);
  const [retentionUnit, setRetentionUnit] = useState<'days' | 'months' | 'years'>('days');
  const [retentionColumn, setRetentionColumn] = useState('created_at');
  const [condition, setCondition] = useState('');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    if (!tableName.trim() || !projectId) return;

    try {
      await createRule.mutateAsync({
        projectId,
        tableName: tableName.trim(),
        retentionPeriod,
        retentionUnit,
        retentionColumn,
        condition: condition.trim() || undefined,
        priority,
        active,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error handled by mutation
    }
  }, [tableName, retentionPeriod, retentionUnit, retentionColumn, condition, priority, active, projectId, createRule]);

  return (
    <div className="space-y-6">
      {/* Table Name */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Table Name
        </label>
        <div className="relative">
          <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="e.g., audit_logs, user_sessions, temp_data"
            className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
          />
        </div>
      </div>

      {/* Retention Period */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Retention Period
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={retentionPeriod}
              onChange={(e) => setRetentionPeriod(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
            />
            <select
              value={retentionUnit}
              onChange={(e) => setRetentionUnit(e.target.value as 'days' | 'months' | 'years')}
              className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Data older than {retentionPeriod} {retentionUnit} will be eligible for purging
          </p>
        </div>

        {/* Retention Column */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Retention Column
          </label>
          <select
            value={retentionColumn}
            onChange={(e) => setRetentionColumn(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500"
          >
            {RETENTION_COLUMNS.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Column used to determine data age
          </p>
        </div>
      </div>

      {/* Condition */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Additional Condition (Optional)
        </label>
        <textarea
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="e.g., status = 'archived' AND processed = true"
          rows={3}
          spellCheck={false}
          className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Optional WHERE clause condition to further filter rows eligible for purging
        </p>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Priority
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriority(opt.value)}
              className={cn(
                'px-3 py-2.5 text-sm font-medium rounded-lg border transition-all text-center',
                priority === opt.value
                  ? cn(opt.bg, opt.color, 'shadow-sm')
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Toggle */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Active Status</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {active
              ? 'This rule is active and will be included in purge operations'
              : 'This rule is inactive and will be skipped during purge operations'}
          </p>
        </div>
        <button
          onClick={() => setActive(!active)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            active ? 'bg-aqua-500' : 'bg-slate-300'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
              active ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* Summary Preview */}
      {tableName.trim() && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h5 className="text-xs font-semibold text-slate-600 uppercase mb-2">
            Rule Summary
          </h5>
          <p className="text-sm text-slate-700">
            Delete rows from <span className="font-mono font-semibold text-aqua-700">{tableName}</span> where{' '}
            <span className="font-mono font-semibold">{retentionColumn}</span> is older than{' '}
            <span className="font-semibold">{retentionPeriod} {retentionUnit}</span>
            {condition.trim() && (
              <>
                {' '}and{' '}
                <span className="font-mono text-slate-600">{condition.trim()}</span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!tableName.trim() || createRule.isPending}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            !tableName.trim() || createRule.isPending
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {createRule.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Rule
            </>
          )}
        </button>

        {saved && (
          <span className="text-sm text-green-600 font-medium">
            Rule saved successfully
          </span>
        )}
      </div>
    </div>
  );
}

export default RetentionPolicyEditor;
