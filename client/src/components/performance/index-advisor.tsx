import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  ArrowRight,
  Search,
  Zap,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreatePerformanceRun } from '@/hooks/use-performance';
import type { IndexRecommendation } from '@/hooks/use-performance';

const MOCK_RECOMMENDATIONS: IndexRecommendation[] = [
  {
    id: '1',
    tableName: 'orders',
    columns: ['customer_id', 'created_at'],
    indexType: 'BTREE',
    createStatement:
      'CREATE INDEX idx_orders_customer_created ON orders (customer_id, created_at DESC);',
    impact: 'high',
    reason:
      'Queries filtering by customer_id with ORDER BY created_at are scanning the full table. A composite index would enable index-only scans.',
    estimatedImprovement: '~85% faster',
  },
  {
    id: '2',
    tableName: 'users',
    columns: ['email'],
    indexType: 'BTREE UNIQUE',
    createStatement: 'CREATE UNIQUE INDEX idx_users_email ON users (email);',
    impact: 'high',
    reason:
      'The email column is used in WHERE clauses for login queries but has no index, causing sequential scans on every authentication request.',
    estimatedImprovement: '~90% faster',
  },
  {
    id: '3',
    tableName: 'products',
    columns: ['category_id', 'price'],
    indexType: 'BTREE',
    createStatement:
      'CREATE INDEX idx_products_category_price ON products (category_id, price);',
    impact: 'medium',
    reason:
      'Category browsing queries with price range filters would benefit from a composite index to avoid sorting.',
    estimatedImprovement: '~60% faster',
  },
  {
    id: '4',
    tableName: 'order_items',
    columns: ['order_id'],
    indexType: 'BTREE',
    createStatement:
      'CREATE INDEX idx_order_items_order_id ON order_items (order_id);',
    impact: 'medium',
    reason:
      'Foreign key lookups from orders to order_items are not indexed, causing nested loop joins to be slow.',
    estimatedImprovement: '~50% faster',
  },
  {
    id: '5',
    tableName: 'logs',
    columns: ['created_at'],
    indexType: 'BTREE',
    createStatement: 'CREATE INDEX idx_logs_created_at ON logs (created_at);',
    impact: 'low',
    reason:
      'Time-range queries on the logs table would benefit from an index, though the table is currently small.',
    estimatedImprovement: '~20% faster',
  },
];

const IMPACT_CONFIG = {
  high: {
    label: 'High Impact',
    icon: Zap,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  medium: {
    label: 'Medium Impact',
    icon: TrendingDown,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  low: {
    label: 'Low Impact',
    icon: Minus,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
};

export function IndexAdvisor() {
  const { projectId } = useParams();
  const createRun = useCreatePerformanceRun();

  const [slowQueries, setSlowQueries] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<IndexRecommendation[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!slowQueries.trim() || !projectId) return;
    setIsAnalyzing(true);
    setRecommendations([]);

    try {
      await createRun.mutateAsync({
        projectId,
        type: 'index-analysis',
        name: 'Index analysis',
        config: { queries: slowQueries },
      });

      // Simulate AI analysis
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setRecommendations(MOCK_RECOMMENDATIONS);
    } catch {
      // Error handled by mutation
    } finally {
      setIsAnalyzing(false);
    }
  }, [slowQueries, projectId, createRun]);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleCopyAll = useCallback(() => {
    const allStatements = recommendations
      .map((r) => `-- ${r.reason}\n${r.createStatement}`)
      .join('\n\n');
    navigator.clipboard.writeText(allStatements);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  }, [recommendations]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" />
          Paste Slow Queries
        </label>
        <textarea
          value={slowQueries}
          onChange={(e) => setSlowQueries(e.target.value)}
          placeholder={`-- Paste one or more slow queries here\nSELECT o.*, u.name FROM orders o\nJOIN users u ON u.id = o.customer_id\nWHERE o.created_at > '2025-01-01'\nORDER BY o.created_at DESC;\n\n-- Another slow query\nSELECT * FROM products\nWHERE category_id = 5 AND price BETWEEN 10 AND 100;`}
          rows={8}
          spellCheck={false}
          className="w-full px-4 py-3 text-sm font-mono bg-[#1e293b] text-slate-100 rounded-lg border border-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 resize-y selection:bg-aqua-500/30 caret-aqua-400"
        />
      </div>

      {/* Analyze Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !slowQueries.trim()}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            isAnalyzing || !slowQueries.trim()
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analyze Queries
            </>
          )}
        </button>

        {isAnalyzing && (
          <span className="text-xs text-slate-500">
            AI is analyzing query patterns and table structures...
          </span>
        )}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">
              Recommended Indexes ({recommendations.length})
            </h4>
            <button
              onClick={handleCopyAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {copiedId === 'all' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  Copied All
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy All Statements
                </>
              )}
            </button>
          </div>

          {recommendations.map((rec) => {
            const impact = IMPACT_CONFIG[rec.impact];
            const ImpactIcon = impact.icon;
            const isExpanded = expandedIds.has(rec.id);

            return (
              <div
                key={rec.id}
                className={cn(
                  'bg-white border rounded-lg overflow-hidden transition-all',
                  impact.border
                )}
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpand(rec.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      impact.bg
                    )}
                  >
                    <ImpactIcon className={cn('w-4 h-4', impact.text)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {rec.tableName}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-sm text-slate-600 font-mono">
                        ({rec.columns.join(', ')})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {rec.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase',
                        impact.badge
                      )}
                    >
                      {rec.impact}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">
                      {rec.estimatedImprovement}
                    </span>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">
                        Why this index helps:
                      </p>
                      <p className="text-sm text-slate-700">{rec.reason}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-slate-600">
                          CREATE INDEX Statement:
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(rec.createStatement, rec.id);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          {copiedId === rec.id ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-[#1e293b] text-slate-100 text-sm font-mono px-4 py-3 rounded-lg overflow-x-auto">
                        {rec.createStatement}
                      </div>
                    </div>

                    {/* Before / After Visualization */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-red-600 uppercase mb-1.5">
                          Before (No Index)
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Scan Type:</span>
                            <span className="font-medium text-red-700">Sequential Scan</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Est. Rows Scanned:</span>
                            <span className="font-medium text-red-700">~500,000</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Est. Time:</span>
                            <span className="font-medium text-red-700">~250ms</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-green-600 uppercase mb-1.5">
                          After (With Index)
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Scan Type:</span>
                            <span className="font-medium text-green-700">Index Scan</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Est. Rows Scanned:</span>
                            <span className="font-medium text-green-700">~150</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Est. Time:</span>
                            <span className="font-medium text-green-700">~5ms</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default IndexAdvisor;
