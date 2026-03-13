import { Coins, Hash, Zap, TrendingUp } from 'lucide-react';
import type { UsageSummary } from '@/hooks/use-ai-usage';

interface Props {
  data?: UsageSummary;
  isLoading: boolean;
}

const cards = [
  { key: 'totalTokens', label: 'Total Tokens', icon: Hash, format: (v: number) => v.toLocaleString(), color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
  { key: 'totalCost', label: 'Estimated Cost', icon: Coins, format: (v: number) => `$${v.toFixed(4)}`, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' },
  { key: 'totalCalls', label: 'AI Calls', icon: Zap, format: (v: number) => v.toLocaleString(), color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' },
  { key: 'avgTokensPerCall', label: 'Avg Tokens/Call', icon: TrendingUp, format: (v: number) => Math.round(v).toLocaleString(), color: 'text-violet-500 bg-violet-50 dark:bg-violet-900/30' },
] as const;

export function UsageSummaryCards({ data, isLoading }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const value = data ? (data as Record<string, number>)[card.key] ?? 0 : 0;
        return (
          <div
            key={card.key}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
          >
            <div className={`p-2.5 rounded-lg ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              {isLoading ? (
                <div className="h-6 w-20 bg-muted rounded animate-pulse mt-1" />
              ) : (
                <p className="text-lg font-bold text-foreground">{card.format(value)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
