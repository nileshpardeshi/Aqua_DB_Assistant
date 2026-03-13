import { useState } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
import type { BudgetConfig, CurrentMonthData } from '@/hooks/use-ai-usage';
import { useUpdateAIBudget, useDeleteAIBudget } from '@/hooks/use-ai-usage';

interface Props {
  budgets?: BudgetConfig[];
  currentMonth?: CurrentMonthData;
  isLoading: boolean;
}

export function BudgetStatusCard({ budgets, currentMonth, isLoading }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formLimit, setFormLimit] = useState('1000000');
  const [formThreshold, setFormThreshold] = useState('0.8');
  const [formHard, setFormHard] = useState(false);

  const updateBudget = useUpdateAIBudget();
  const deleteBudget = useDeleteAIBudget();

  const budgetStatus = currentMonth?.budget;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateBudget.mutate(
      {
        monthlyTokenLimit: parseInt(formLimit),
        warningThreshold: parseFloat(formThreshold),
        isHardLimit: formHard,
        isActive: true,
      },
      { onSuccess: () => setShowForm(false) },
    );
  }

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Budget Status</h3>
        <div className="h-20 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4" /> Budget Status
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-aqua-600 hover:text-aqua-700 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Configure
        </button>
      </div>

      {budgetStatus ? (
        <div className="space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Used / Limit</span>
            <span className="font-medium text-foreground">
              {budgetStatus.used.toLocaleString()} / {budgetStatus.limit.toLocaleString()}
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budgetStatus.percentUsed >= 100
                  ? 'bg-red-500'
                  : budgetStatus.warning
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(budgetStatus.percentUsed, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {budgetStatus.percentUsed.toFixed(1)}% used this month
            {budgetStatus.warning && ' — approaching limit'}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          No budget configured. Click "Configure" to set monthly limits.
        </p>
      )}

      {/* Existing budgets */}
      {budgets && budgets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {budgets.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-xs">
              <div>
                <span className="font-medium text-foreground">
                  {b.projectId ? b.project?.name ?? 'Project' : 'Global'}
                </span>
                <span className="text-muted-foreground ml-2">
                  {Number(b.monthlyTokenLimit).toLocaleString()} tokens/mo
                  {b.isHardLimit ? ' (hard)' : ' (soft)'}
                </span>
              </div>
              <button
                onClick={() => deleteBudget.mutate(b.id)}
                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Budget Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-border space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Monthly Token Limit</label>
            <input
              type="number"
              value={formLimit}
              onChange={(e) => setFormLimit(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-aqua-500"
              min="1"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Warning Threshold (0-1)</label>
            <input
              type="number"
              value={formThreshold}
              onChange={(e) => setFormThreshold(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-aqua-500"
              step="0.05"
              min="0"
              max="1"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={formHard}
              onChange={(e) => setFormHard(e.target.checked)}
              className="rounded border-border"
            />
            Hard limit (block AI calls when exceeded)
          </label>
          <button
            type="submit"
            disabled={updateBudget.isPending}
            className="w-full py-2 text-xs font-medium text-white bg-aqua-600 hover:bg-aqua-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {updateBudget.isPending ? 'Saving...' : 'Save Budget'}
          </button>
        </form>
      )}
    </div>
  );
}
