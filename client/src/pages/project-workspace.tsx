import { useEffect } from 'react';
import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Database,
  Terminal,
  Gauge,
  Shield,
  GitBranch,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDialect } from '../config/constants';
import { useProject } from '../hooks/use-projects';
import { useProjectStore } from '../stores/use-project-store';

const tabs = [
  { label: 'Overview', icon: FolderOpen, path: '' },
  { label: 'Schema', icon: Database, path: 'schema' },
  { label: 'Query', icon: Terminal, path: 'query' },
  { label: 'Performance', icon: Gauge, path: 'performance' },
  { label: 'Data Lifecycle', icon: Shield, path: 'data-lifecycle' },
  { label: 'Migrations', icon: GitBranch, path: 'migrations' },
];

export function ProjectWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(projectId);
  const { setActiveProject } = useProjectStore();

  // Sync project store
  useEffect(() => {
    if (projectId) {
      setActiveProject(projectId);
    }
  }, [projectId, setActiveProject]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-aqua-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <Database className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Project not found</h3>
          <p className="text-xs text-muted-foreground">
            The project you are looking for does not exist or has been deleted.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 text-sm text-aqua-600 hover:text-aqua-700 font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const dialect = getDialect(project.dialect);

  return (
    <div className="flex flex-col h-full">
      {/* Project Header */}
      <div className="px-6 lg:px-8 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-aqua-50 flex items-center justify-center">
            <Database className="w-5 h-5 text-aqua-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
            {dialect && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-0.5"
                style={{
                  backgroundColor: `${dialect.color}15`,
                  color: dialect.color,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: dialect.color }}
                />
                {dialect.label}
              </span>
            )}
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex gap-1 border-b border-border -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const to = tab.path
              ? `/project/${projectId}/${tab.path}`
              : `/project/${projectId}`;
            const end = tab.path === '';

            return (
              <NavLink
                key={tab.label}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-aqua-500 text-aqua-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet context={{ project }} />
      </div>
    </div>
  );
}

export default ProjectWorkspace;
