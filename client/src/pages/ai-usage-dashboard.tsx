import { useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import {
  useAIUsageSummary,
  useAIUsageByModule,
  useAIUsageByProvider,
  useAIUsageByProject,
  useAIUsageTopCalls,
  useAIUsageTrend,
  useAIBudget,
  useCurrentMonthUsage,
  type UsageFilters,
} from '@/hooks/use-ai-usage';
import { UsageSummaryCards } from '@/components/ai-usage/usage-summary-cards';
import { UsageByModuleChart } from '@/components/ai-usage/usage-by-module-chart';
import { UsageTrendChart } from '@/components/ai-usage/usage-trend-chart';
import { BudgetStatusCard } from '@/components/ai-usage/budget-status-card';
import { TopCallsTable } from '@/components/ai-usage/top-calls-table';
import { useQueryClient } from '@tanstack/react-query';

type TimeRange = '7d' | '30d' | 'all';

function getDateRange(range: TimeRange): Partial<UsageFilters> {
  if (range === 'all') return {};
  const days = range === '7d' ? 7 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { startDate: start.toISOString().split('T')[0] };
}

export function AIUsageDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const queryClient = useQueryClient();

  const filters: UsageFilters = getDateRange(timeRange);

  const summary = useAIUsageSummary(filters);
  const byModule = useAIUsageByModule(filters);
  const byProvider = useAIUsageByProvider(filters);
  const byProject = useAIUsageByProject(filters);
  const topCalls = useAIUsageTopCalls(10);
  const trend = useAIUsageTrend(timeRange === '7d' ? 7 : 30);
  const budgets = useAIBudget();
  const currentMonth = useCurrentMonthUsage();

  const isRefreshing = summary.isFetching || byModule.isFetching;

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
            <Coins className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Usage & Token Governance</h1>
            <p className="text-xs text-muted-foreground">
              Monitor AI token consumption, costs, and budget limits across all modules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex bg-secondary rounded-lg p-0.5">
            {(['7d', '30d', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <UsageSummaryCards data={summary.data} isLoading={summary.isLoading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageByModuleChart data={byModule.data} isLoading={byModule.isLoading} />
        <BudgetStatusCard
          budgets={budgets.data}
          currentMonth={currentMonth.data}
          isLoading={budgets.isLoading || currentMonth.isLoading}
        />
      </div>

      {/* Trend */}
      <UsageTrendChart data={trend.data} isLoading={trend.isLoading} />

      {/* Provider Breakdown */}
      {byProvider.data && byProvider.data.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Usage by Provider / Model</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Provider</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Model</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Calls</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Tokens</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byProvider.data.map((p, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 px-2 font-medium text-foreground capitalize">{p.provider}</td>
                    <td className="py-2 px-2 text-muted-foreground">{p.model}</td>
                    <td className="py-2 px-2 text-right text-foreground">{p.totalCalls}</td>
                    <td className="py-2 px-2 text-right text-foreground">{(p.totalTokens ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-foreground">${(p.totalCost ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Breakdown */}
      {byProject.data && byProject.data.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Usage by Project</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Project</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Calls</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Tokens</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {byProject.data.map((p, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 px-2 font-medium text-foreground">
                      {p.projectName ?? (p.projectId ? p.projectId.slice(0, 8) : 'No Project')}
                    </td>
                    <td className="py-2 px-2 text-right text-foreground">{p.totalCalls}</td>
                    <td className="py-2 px-2 text-right text-foreground">{(p.totalTokens ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-foreground">${(p.totalCost ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Calls */}
      <TopCallsTable data={topCalls.data} isLoading={topCalls.isLoading} />
    </div>
  );
}

export default AIUsageDashboard;
