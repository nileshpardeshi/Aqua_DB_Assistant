import { useLocation, Link, useParams } from 'react-router-dom';
import { Sun, Moon, Bell, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/use-ui-store';
import { useProject } from '../../hooks/use-projects';

interface Breadcrumb {
  label: string;
  path?: string;
}

function useBreadcrumbs(): Breadcrumb[] {
  const location = useLocation();
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);

  const segments = location.pathname.split('/').filter(Boolean);
  const crumbs: Breadcrumb[] = [{ label: 'Home', path: '/' }];

  if (segments.length === 0) {
    crumbs.push({ label: 'Dashboard' });
    return crumbs;
  }

  if (segments[0] === 'settings') {
    crumbs.push({ label: 'Settings' });
    return crumbs;
  }

  if (segments[0] === 'project' && projectId) {
    crumbs.push({
      label: project?.name || 'Project',
      path: `/project/${projectId}`,
    });

    const subRoute = segments[2];
    if (subRoute) {
      const routeLabels: Record<string, string> = {
        schema: 'Schema Intelligence',
        'er-diagram': 'ER Diagram',
        query: 'Query Intelligence',
        performance: 'Performance Lab',
        'data-lifecycle': 'Data Lifecycle',
        migrations: 'Migration Studio',
        connections: 'Connections',
      };
      const label = routeLabels[subRoute] || subRoute;
      crumbs.push({ label });

      // Handle nested routes like schema/er-diagram
      const deepRoute = segments[3];
      if (deepRoute) {
        const deepLabel = routeLabels[deepRoute] || deepRoute;
        crumbs.push({ label: deepLabel });
      }
    } else {
      crumbs.push({ label: 'Overview' });
    }
  }

  return crumbs;
}

export function Header() {
  const { theme, setTheme, toggleSidebar } = useUIStore();
  const breadcrumbs = useBreadcrumbs();

  const isDark = theme === 'dark';

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-border">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span className="text-slate-300">/</span>
                )}
                {crumb.path && !isLast ? (
                  <Link
                    to={crumb.path}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aqua-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}

export default Header;
