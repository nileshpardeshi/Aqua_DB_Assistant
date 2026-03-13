import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Table2,
  Terminal,
  MessageSquare,
  Plus,
  Database,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Archive,
  FileText,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { APP_NAME, APP_TAGLINE, DATABASE_DIALECTS, getDialect } from '@/config/constants';
import {
  useProjects,
  useGlobalStats,
  useDeleteProject,
  type Project,
  type ProjectFilters,
} from '@/hooks/use-projects';
import { useProjectStore } from '@/stores/use-project-store';
import { ProjectCreateDialog } from '@/components/project/project-create-dialog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

export function Dashboard() {
  const navigate = useNavigate();
  const { setActiveProject } = useProjectStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Search & filter state
  const [searchInput, setSearchInput] = useState('');
  const [dialectFilter, setDialectFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const filters: ProjectFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      dialect: dialectFilter || undefined,
      sortBy,
      sortOrder,
    }),
    [debouncedSearch, dialectFilter, sortBy, sortOrder],
  );

  const { data: projects, isLoading } = useProjects(filters);
  const { data: globalStats } = useGlobalStats();

  const stats = [
    {
      label: 'Total Projects',
      value: globalStats?.projects ?? 0,
      icon: FolderOpen,
      gradient: 'from-aqua-500 to-aqua-600',
    },
    {
      label: 'Total Tables',
      value: globalStats?.tables ?? 0,
      icon: Table2,
      gradient: 'from-cyan-500 to-blue-500',
    },
    {
      label: 'Saved Queries',
      value: globalStats?.queries ?? 0,
      icon: Terminal,
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      label: 'AI Conversations',
      value: globalStats?.conversations ?? 0,
      icon: MessageSquare,
      gradient: 'from-amber-500 to-orange-500',
    },
  ];

  function handleProjectClick(project: Project) {
    setActiveProject(project.id);
    navigate(`/project/${project.id}`);
  }

  function handleExploreFeatures() {
    if (projects && projects.length > 0) {
      handleProjectClick(projects[0]);
    } else {
      setCreateDialogOpen(true);
    }
  }

  const hasActiveFilters = !!debouncedSearch || !!dialectFilter;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-aqua-600 via-aqua-700 to-aqua-900 p-8 lg:p-10 text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-card/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-card/5 rounded-full translate-y-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-aqua-200" />
            <span className="text-aqua-200 text-sm font-medium">AI-Powered Database Engineering</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
            Welcome to {APP_NAME}
          </h1>
          <p className="mt-2 text-aqua-100 text-lg max-w-2xl">
            {APP_TAGLINE}. Design schemas, optimize queries, and manage your database lifecycle with the power of AI.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-card text-aqua-700 font-semibold rounded-lg hover:bg-aqua-50 transition-colors shadow-lg shadow-black/10"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
            <button
              onClick={handleExploreFeatures}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-card/15 text-white font-medium rounded-lg hover:bg-card/25 transition-colors backdrop-blur-sm border border-white/20"
            >
              <Database className="w-4 h-4" />
              Explore Features
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group relative bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground tracking-tight">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br shadow-sm',
                    stat.gradient,
                  )}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Projects Section */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Your Projects</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage and access your database projects
            </p>
          </div>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent placeholder:text-muted-foreground"
            />
          </div>

          {/* Dialect Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={dialectFilter}
              onChange={(e) => setDialectFilter(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="">All Dialects</option>
              {DATABASE_DIALECTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="pl-9 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-400 focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="updatedAt-desc">Recently Updated</option>
            </select>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchInput('');
                setDialectFilter('');
              }}
              className="px-3 py-2 text-xs font-medium text-aqua-600 hover:text-aqua-800 hover:bg-aqua-50 rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Project Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border p-5 animate-pulse"
              >
                <div className="h-5 bg-muted rounded w-2/3 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project)}
              />
            ))}

            {/* New Project Card */}
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-muted-foreground hover:border-aqua-300 hover:text-aqua-600 hover:bg-aqua-50/50 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-aqua-100 flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium">Create New Project</span>
            </button>
          </div>
        ) : hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No matching projects
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              No projects match your current search and filter criteria.
            </p>
            <button
              onClick={() => {
                setSearchInput('');
                setDialectFilter('');
              }}
              className="text-sm font-medium text-aqua-600 hover:text-aqua-700"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <EmptyState onCreateClick={() => setCreateDialogOpen(true)} />
        )}
      </div>

      {/* Create Dialog */}
      <ProjectCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {
  const dialect = getDialect(project.dialect);
  const deleteProject = useDeleteProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    deleteProject.mutate(project.id);
    setMenuOpen(false);
    setConfirmArchive(false);
  }

  return (
    <div
      onClick={onClick}
      className="group relative text-left rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-aqua-200 transition-all duration-200 cursor-pointer"
    >
      {/* Three-dot menu */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
            setConfirmArchive(false);
          }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-44 bg-card rounded-lg border border-border shadow-lg py-1 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleArchive}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
                confirmArchive
                  ? 'text-red-600 bg-red-50 hover:bg-red-100 font-medium'
                  : 'text-foreground hover:bg-muted/50',
              )}
            >
              <Archive className="w-3.5 h-3.5" />
              {confirmArchive ? 'Click again to confirm' : 'Archive Project'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-start justify-between mb-3 pr-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-aqua-50 flex items-center justify-center">
            <Database className="w-4 h-4 text-aqua-600" />
          </div>
          <h3 className="text-sm font-semibold text-foreground group-hover:text-aqua-700 transition-colors truncate">
            {project.name}
          </h3>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-aqua-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </div>

      {/* Dialect Badge */}
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-3"
        style={{
          backgroundColor: `${dialect?.color || '#64748b'}15`,
          color: dialect?.color || '#64748b',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: dialect?.color || '#64748b' }}
        />
        {dialect?.label || project.dialect}
      </span>

      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {typeof project.tableCount === 'number' && (
            <span className="flex items-center gap-1">
              <Table2 className="w-3 h-3" />
              {project.tableCount} tables
            </span>
          )}
          {typeof project.queryCount === 'number' && project.queryCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {project.queryCount} queries
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(project.createdAt)}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-aqua-100 to-aqua-200 flex items-center justify-center mb-6">
        <Database className="w-10 h-10 text-aqua-600" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No projects yet
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        Create your first project to start designing schemas, writing queries, and
        leveraging AI for your database engineering workflow.
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" />
        Create Your First Project
      </button>
    </div>
  );
}

export default Dashboard;
