import type { ModuleUsage } from '@/hooks/use-ai-usage';

interface Props {
  data?: ModuleUsage[];
  isLoading: boolean;
}

const MODULE_COLORS: Record<string, string> = {
  schema: 'bg-blue-500',
  query: 'bg-violet-500',
  performance: 'bg-amber-500',
  datagen: 'bg-emerald-500',
  docs: 'bg-pink-500',
  migration: 'bg-orange-500',
  chat: 'bg-cyan-500',
};

export function UsageByModuleChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Usage by Module</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const items = data ?? [];
  const maxTokens = Math.max(...items.map((m) => m.totalTokens ?? 0), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Usage by Module</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No usage data yet</p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const tokens = m.totalTokens ?? 0;
            const cost = m.totalCost ?? 0;
            const pct = (tokens / maxTokens) * 100;
            const color = MODULE_COLORS[m.module] ?? 'bg-slate-500';
            return (
              <div key={m.module}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground capitalize">{m.module}</span>
                  <span className="text-muted-foreground">
                    {tokens.toLocaleString()} tokens &middot; ${cost.toFixed(4)} &middot; {m.totalCalls} calls
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
