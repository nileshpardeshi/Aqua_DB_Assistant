import { useState } from 'react';
import {
  Sparkles,
  Zap,
  BookOpen,
  Copy,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/use-editor-store';

interface AIQueryAssistantProps {
  className?: string;
}

export function AIQueryAssistant({ className }: AIQueryAssistantProps) {
  const { tabs, activeTabId, updateTabSQL } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState<string | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [copiedToEditor, setCopiedToEditor] = useState(false);

  const handleGenerateSQL = async () => {
    if (!naturalLanguageInput.trim()) return;
    setIsGenerating(true);
    setGeneratedSQL(null);

    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockGenerated = `-- AI Generated Query
-- Prompt: "${naturalLanguageInput}"

SELECT
  u.id,
  u.name,
  u.email,
  COUNT(o.id) AS order_count,
  SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.active = true
  AND u.created_at >= NOW() - INTERVAL '90 days'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 0
ORDER BY total_spent DESC
LIMIT 100;`;

    setGeneratedSQL(mockGenerated);
    setIsGenerating(false);
  };

  const handleOptimizeQuery = async () => {
    if (!activeTab?.sql.trim()) return;
    setIsOptimizing(true);
    setOptimizationSuggestions(null);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setOptimizationSuggestions(
      `**Performance Suggestions:**

1. **Add Index**: Consider adding a composite index on \`(user_id, created_at)\` for the orders table to speed up the JOIN operation.

2. **Use EXISTS instead of JOIN**: If you only need user data, replace the LEFT JOIN with an EXISTS subquery to reduce memory usage.

3. **Limit Columns**: Instead of \`SELECT *\`, specify only the columns you need to reduce I/O overhead.

4. **Partition Strategy**: Consider table partitioning on \`created_at\` column for large datasets.

5. **Query Cost**: Estimated cost reduced from ~450 to ~120 with suggested indexes.`
    );
    setIsOptimizing(false);
  };

  const handleExplainQuery = async () => {
    if (!activeTab?.sql.trim()) return;
    setIsExplaining(true);
    setExplanation(null);

    await new Promise((resolve) => setTimeout(resolve, 1800));

    setExplanation(
      `**Query Explanation:**

This query performs a LEFT JOIN between the \`users\` and \`orders\` tables to find active users who have placed orders in the last 90 days.

**Step-by-step breakdown:**
- Joins users with their orders using the user_id foreign key
- Filters for active users created within the last 90 days
- Groups results by user to aggregate order counts and totals
- HAVING clause filters out users with zero orders
- Results are sorted by total spending in descending order
- Limited to top 100 users

**Expected Performance:**
- Full table scan on users (unless indexed on \`active\` and \`created_at\`)
- Index scan on orders.user_id (if index exists)
- Group by operation uses hash aggregate
- Sort operation for ORDER BY`
    );
    setIsExplaining(false);
  };

  const handleCopyToEditor = () => {
    if (generatedSQL && activeTabId) {
      updateTabSQL(activeTabId, generatedSQL);
      setCopiedToEditor(true);
      setTimeout(() => setCopiedToEditor(false), 2000);
    }
  };

  return (
    <div className={cn('overflow-y-auto max-h-[400px] p-4 space-y-4', className)}>
      {/* AI Generate Section */}
      <div className="bg-gradient-to-br from-aqua-50 to-cyan-50 rounded-xl border border-aqua-200/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-aqua-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Generate SQL from Natural Language
          </h3>
        </div>

        <div className="space-y-3">
          <textarea
            value={naturalLanguageInput}
            onChange={(e) => setNaturalLanguageInput(e.target.value)}
            placeholder="Describe what you want to query... e.g., 'Find top 10 customers by total spending in the last month'"
            className="w-full px-3 py-2.5 text-sm bg-card rounded-lg border border-aqua-200 focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent placeholder:text-slate-400 resize-none"
            rows={3}
          />
          <button
            onClick={handleGenerateSQL}
            disabled={isGenerating || !naturalLanguageInput.trim()}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all',
              isGenerating || !naturalLanguageInput.trim()
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-aqua-600 hover:bg-aqua-700 shadow-sm hover:shadow-md'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate SQL
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Generated Result */}
        {generatedSQL && (
          <div className="mt-4 bg-card rounded-lg border border-aqua-200/50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-border/50">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Code2 className="w-3.5 h-3.5 text-aqua-500" />
                Generated SQL
              </span>
              <button
                onClick={handleCopyToEditor}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all',
                  copiedToEditor
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-aqua-50 text-aqua-700 hover:bg-aqua-100'
                )}
              >
                {copiedToEditor ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy to Editor
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-slate-800 overflow-x-auto bg-slate-900 text-slate-200 leading-relaxed">
              {generatedSQL}
            </pre>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {/* Optimize */}
        <button
          onClick={handleOptimizeQuery}
          disabled={isOptimizing || !activeTab?.sql.trim()}
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
            isOptimizing || !activeTab?.sql.trim()
              ? 'bg-slate-50 border-border/50 cursor-not-allowed opacity-60'
              : 'bg-card border-border hover:border-amber-300 hover:shadow-sm hover:bg-amber-50/30 group'
          )}
        >
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
              isOptimizing
                ? 'bg-slate-100'
                : 'bg-amber-50 group-hover:bg-amber-100'
            )}
          >
            {isOptimizing ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Optimize Query</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Get performance tips
            </p>
          </div>
        </button>

        {/* Explain */}
        <button
          onClick={handleExplainQuery}
          disabled={isExplaining || !activeTab?.sql.trim()}
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
            isExplaining || !activeTab?.sql.trim()
              ? 'bg-slate-50 border-border/50 cursor-not-allowed opacity-60'
              : 'bg-card border-border hover:border-violet-300 hover:shadow-sm hover:bg-violet-50/30 group'
          )}
        >
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
              isExplaining
                ? 'bg-slate-100'
                : 'bg-violet-50 group-hover:bg-violet-100'
            )}
          >
            {isExplaining ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : (
              <BookOpen className="w-4 h-4 text-violet-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Explain Query</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Understand your SQL
            </p>
          </div>
        </button>
      </div>

      {/* Optimization Suggestions */}
      {optimizationSuggestions && (
        <div className="bg-amber-50/50 rounded-xl border border-amber-200/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200/50">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-900">
              Optimization Suggestions
            </span>
          </div>
          <div className="p-4 text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">
            {optimizationSuggestions}
          </div>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="bg-violet-50/50 rounded-xl border border-violet-200/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-b border-violet-200/50">
            <BookOpen className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-semibold text-violet-900">
              Query Explanation
            </span>
          </div>
          <div className="p-4 text-xs text-violet-900 leading-relaxed whitespace-pre-wrap">
            {explanation}
          </div>
        </div>
      )}
    </div>
  );
}

export default AIQueryAssistant;
