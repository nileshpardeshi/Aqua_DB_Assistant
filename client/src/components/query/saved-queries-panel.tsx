import { useState, useMemo } from 'react';
import {
  Bookmark,
  Star,
  Trash2,
  Search,
  FileCode2,
  Clock,
  Copy,
  CheckCircle2,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSavedQueries,
  useDeleteQuery,
  useToggleFavorite,
  type SavedQuery,
} from '@/hooks/use-queries';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SavedQueriesPanelProps {
  projectId: string;
  dialect: string;
  onOpenQuery: (query: SavedQuery) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="px-4 py-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-4 h-4 rounded bg-slate-200 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/5" />
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="h-3 bg-slate-100 rounded w-4/5" />
          <div className="flex gap-2 pt-1">
            <div className="h-4 w-16 bg-slate-100 rounded" />
            <div className="h-4 w-14 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-100 rounded ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SavedQueriesPanel({
  projectId,
  dialect: _dialect,
  onOpenQuery,
  className,
}: SavedQueriesPanelProps) {
  // ---- State ---------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- Data ----------------------------------------------------------------
  const { data: queries, isLoading } = useSavedQueries(projectId);
  const deleteQuery = useDeleteQuery();
  const toggleFavorite = useToggleFavorite();

  // ---- Derived / filtered --------------------------------------------------
  const categories = useMemo(() => {
    const cats = new Set<string>();
    queries?.forEach((q) => {
      if (q.category) cats.add(q.category);
    });
    return ['all', ...Array.from(cats).sort()];
  }, [queries]);

  const filteredQueries = useMemo(() => {
    let items = queries || [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        (q) =>
          q.title.toLowerCase().includes(term) ||
          q.sql.toLowerCase().includes(term),
      );
    }
    if (selectedCategory !== 'all') {
      items = items.filter((q) => q.category === selectedCategory);
    }
    if (showFavoritesOnly) {
      items = items.filter((q) => q.isFavorite);
    }
    return items;
  }, [queries, searchTerm, selectedCategory, showFavoritesOnly]);

  const hasActiveFilters =
    searchTerm !== '' || selectedCategory !== 'all' || showFavoritesOnly;

  // ---- Handlers ------------------------------------------------------------

  async function handleDelete(query: SavedQuery) {
    const confirmed = window.confirm(`Delete query "${query.title}"?`);
    if (!confirmed) return;

    setDeletingId(query.id);
    try {
      await deleteQuery.mutateAsync({ projectId, queryId: query.id });
    } finally {
      setDeletingId(null);
    }
  }

  function handleToggleFavorite(query: SavedQuery) {
    toggleFavorite.mutate({
      projectId,
      queryId: query.id,
      isFavorite: !query.isFavorite,
    });
  }

  async function handleCopy(query: SavedQuery) {
    try {
      await navigator.clipboard.writeText(query.sql);
      setCopiedId(query.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API not available — silent fail
    }
  }

  // ---- Loading state -------------------------------------------------------

  if (isLoading) {
    return (
      <div className={cn('overflow-y-auto', className)}>
        <div className="divide-y divide-border/50">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // ---- Empty (no queries at all) ------------------------------------------

  if (!queries || queries.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-16 px-4',
          className,
        )}
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Bookmark className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          No saved queries
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-[220px]">
          Save a query from the editor to see it here.
        </p>
      </div>
    );
  }

  // ---- Main render ---------------------------------------------------------

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* ------------------------------------------------------------------ */}
      {/* Header / Filter Bar                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-4 py-3 border-b border-border/60 space-y-2.5 flex-shrink-0">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search saved queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border',
              'bg-card text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-400',
              'transition-colors',
            )}
          />
        </div>

        {/* Category + Favorites + Count */}
        <div className="flex items-center gap-2">
          {/* Category select */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={cn(
              'flex-1 min-w-0 text-xs rounded-md border border-border px-2 py-1.5',
              'bg-card text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-400',
              'transition-colors cursor-pointer',
            )}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavoritesOnly((prev) => !prev)}
            title={showFavoritesOnly ? 'Show all queries' : 'Show favorites only'}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md border transition-colors flex-shrink-0',
              showFavoritesOnly
                ? 'bg-amber-50 text-amber-600 border-amber-300'
                : 'bg-card border-border text-muted-foreground hover:text-amber-400',
            )}
          >
            <Star
              className="w-3.5 h-3.5"
              fill={showFavoritesOnly ? 'currentColor' : 'none'}
            />
          </button>

          {/* Count badge */}
          <span
            className={cn(
              'inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5',
              'rounded-full text-[10px] font-semibold flex-shrink-0',
              'bg-aqua-50 text-aqua-700 border border-aqua-200',
            )}
          >
            {filteredQueries.length}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Query List                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto">
        {filteredQueries.length === 0 ? (
          /* Empty after filtering */
          <div className="flex flex-col items-center justify-center py-14 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <FolderOpen className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No queries match your filters
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-[220px]">
              Try adjusting your search term, category, or favorites filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredQueries.map((query) => {
              const isDeleting = deletingId === query.id;
              const isCopied = copiedId === query.id;

              return (
                <div
                  key={query.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenQuery(query)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenQuery(query);
                    }
                  }}
                  className={cn(
                    'px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer group relative',
                    isDeleting && 'opacity-50 pointer-events-none',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Star / Favorite toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(query);
                      }}
                      title={query.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className="flex-shrink-0 mt-0.5 p-0.5 rounded hover:bg-slate-100 transition-colors"
                    >
                      <Star
                        className={cn(
                          'w-4 h-4 transition-colors',
                          query.isFavorite
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300 hover:text-amber-400',
                        )}
                      />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2">
                        <FileCode2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">
                          {query.title}
                        </span>
                      </div>

                      {/* SQL preview */}
                      <p className="mt-1 text-xs text-muted-foreground font-mono line-clamp-2 leading-relaxed">
                        {query.sql}
                      </p>

                      {/* Bottom metadata row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Dialect badge */}
                        <span className="inline-flex items-center bg-aqua-50 text-aqua-700 border border-aqua-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                          {query.dialect}
                        </span>

                        {/* Category badge */}
                        {query.category && (
                          <span className="inline-flex items-center bg-violet-50 text-violet-700 border border-violet-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                            {query.category}
                          </span>
                        )}

                        {/* Timestamp */}
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(query.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons (visible on hover) */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Copy button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(query);
                        }}
                        title="Copy SQL to clipboard"
                        className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        {isCopied ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(query);
                        }}
                        title="Delete query"
                        className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SavedQueriesPanel;
