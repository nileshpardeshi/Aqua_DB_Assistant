import { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
import { getDialect } from '@/config/constants';
import { useProject } from '@/hooks/use-projects';
import { useProjectStore } from '@/stores/use-project-store';

export function ProjectWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(projectId);
  const { setActiveProject } = useProjectStore();

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
      {/* Compact Project Header */}
      <div className="px-6 lg:px-8 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-aqua-50 flex items-center justify-center">
            <Database className="w-4 h-4 text-aqua-600" />
          </div>
          <h1 className="text-base font-bold text-foreground">{project.name}</h1>
          {dialect && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
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

      {/* Content — sidebar handles navigation */}
      <div className="flex-1 overflow-y-auto">
        <Outlet context={{ project }} />
      </div>
    </div>
  );
}

export default ProjectWorkspace;
