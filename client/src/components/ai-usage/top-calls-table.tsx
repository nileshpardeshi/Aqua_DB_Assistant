import type { TopCall } from '@/hooks/use-ai-usage';

interface Props {
  data?: TopCall[];
  isLoading: boolean;
}

export function TopCallsTable({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Top 10 Expensive Calls</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const calls = data ?? [];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Top 10 Expensive Calls</h3>
      {calls.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No calls recorded yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Module</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Model</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Tokens</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Cost</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Duration</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Status</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-2 font-medium text-foreground capitalize">{call.module}</td>
                  <td className="py-2 px-2 text-muted-foreground truncate max-w-[120px]">{call.model}</td>
                  <td className="py-2 px-2 text-right text-foreground">{call.totalTokens.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right text-foreground">${call.estimatedCost.toFixed(4)}</td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{(call.durationMs / 1000).toFixed(1)}s</td>
                  <td className="py-2 px-2">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        call.status === 'success'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {call.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                    {new Date(call.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
