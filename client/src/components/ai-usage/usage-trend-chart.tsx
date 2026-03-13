import type { TrendPoint } from '@/hooks/use-ai-usage';

interface Props {
  data?: TrendPoint[];
  isLoading: boolean;
}

export function UsageTrendChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Daily Trend (Last 30 Days)</h3>
        <div className="h-40 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const points = data ?? [];
  const maxTokens = Math.max(...points.map((p) => p.totalTokens ?? 0), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Daily Trend (Last 30 Days)</h3>
      {points.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No trend data yet</p>
      ) : (
        <div className="flex items-end gap-[2px] h-40">
          {points.map((p) => {
            const tokens = p.totalTokens ?? 0;
            const pct = (tokens / maxTokens) * 100;
            const date = new Date(p.date);
            const label = `${date.getMonth() + 1}/${date.getDate()}`;
            return (
              <div
                key={p.date}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  className="w-full bg-aqua-500/80 hover:bg-aqua-500 rounded-t transition-colors min-h-[2px]"
                  style={{ height: `${Math.max(pct, 1)}%` }}
                />
                <span className="text-[8px] text-muted-foreground mt-1 hidden group-hover:block absolute -bottom-4">
                  {label}
                </span>
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg px-2 py-1 text-[10px] shadow-lg hidden group-hover:block whitespace-nowrap z-10">
                  <div className="font-medium text-foreground">{label}</div>
                  <div className="text-muted-foreground">{tokens.toLocaleString()} tokens</div>
                  <div className="text-muted-foreground">{p.totalCalls ?? 0} calls &middot; ${(p.totalCost ?? 0).toFixed(4)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
