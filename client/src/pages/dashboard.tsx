import { useState } from 'react';
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
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { APP_NAME, APP_TAGLINE, getDialect } from '@/config/constants';
import { useProjects, type Project } from '@/hooks/use-projects';
import { useProjectStore } from '@/stores/use-project-store';
import { ProjectCreateDialog } from '@/components/project/project-create-dialog';

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  change?: string;
  gradient: string;
}

export function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const { setActiveProject } = useProjectStore();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const projectCount = projects?.length || 0;
  const totalTables = projects?.reduce((sum: number, p: Project) => sum + (p.tableCount || 0), 0) || 0;

  const stats: StatCard[] = [
    {
      label: 'Total Projects',
      value: projectCount,
      icon: FolderOpen,
      gradient: 'from-aqua-500 to-aqua-600',
    },
    {
      label: 'Total Tables',
      value: totalTables,
      icon: Table2,
      gradient: 'from-cyan-500 to-blue-500',
    },
    {
      label: 'Active Queries',
      value: 0,
      icon: Terminal,
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      label: 'AI Conversations',
      value: 0,
      icon: MessageSquare,
      gradient: 'from-amber-500 to-orange-500',
    },
  ];

  function handleProjectClick(project: Project) {
    setActiveProject(project.id);
    navigate(`/project/${project.id}`);
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-aqua-600 via-aqua-700 to-aqua-900 p-8 lg:p-10 text-white">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-white/5 rounded-full translate-y-1/2" />

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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-aqua-700 font-semibold rounded-lg hover:bg-aqua-50 transition-colors shadow-lg shadow-black/10"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white font-medium rounded-lg hover:bg-white/25 transition-colors backdrop-blur-sm border border-white/20"
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
              className="group relative bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200"
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
                    stat.gradient
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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border p-5 animate-pulse"
              >
                <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
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
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-muted-foreground hover:border-aqua-300 hover:text-aqua-600 hover:bg-aqua-50/50 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-aqua-100 flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium">Create New Project</span>
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

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md hover:border-aqua-200 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-aqua-50 flex items-center justify-center">
            <Database className="w-4 h-4 text-aqua-600" />
          </div>
          <h3 className="text-sm font-semibold text-foreground group-hover:text-aqua-700 transition-colors truncate">
            {project.name}
          </h3>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-aqua-500 group-hover:translate-x-0.5 transition-all" />
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

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {typeof project.tableCount === 'number' && (
            <span className="flex items-center gap-1">
              <Table2 className="w-3 h-3" />
              {project.tableCount} tables
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(project.createdAt)}
        </span>
      </div>
    </button>
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
