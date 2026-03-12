import { useLocation, Link, useParams } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Bell, Menu, X, Database, FileUp, Search, Settings, GitBranch, Zap, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/use-ui-store';
import { useProject } from '../../hooks/use-projects';
import { useAuditLogs } from '../../hooks/use-audit-logs';

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
        datagen: 'Data Generator',
        docs: 'DB Docs',
        'data-lifecycle': 'Data Lifecycle',
        migrations: 'Migration Studio',
        connections: 'Connections',
      };
      const label = routeLabels[subRoute] || subRoute;
      crumbs.push({ label });

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

function getActionIcon(action: string) {
  const a = action.toLowerCase();
  if (a.includes('create') || a.includes('project.create')) return <Database className="w-3.5 h-3.5 text-emerald-500" />;
  if (a.includes('upload') || a.includes('file')) return <FileUp className="w-3.5 h-3.5 text-blue-500" />;
  if (a.includes('query') || a.includes('search')) return <Search className="w-3.5 h-3.5 text-violet-500" />;
  if (a.includes('settings') || a.includes('connection')) return <Settings className="w-3.5 h-3.5 text-slate-500" />;
  if (a.includes('migration') || a.includes('snapshot')) return <GitBranch className="w-3.5 h-3.5 text-amber-500" />;
  if (a.includes('performance') || a.includes('ai')) return <Zap className="w-3.5 h-3.5 text-aqua-500" />;
  if (a.includes('delete')) return <Trash2 className="w-3.5 h-3.5 text-red-500" />;
  return <Database className="w-3.5 h-3.5 text-slate-400" />;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function Header() {
  const { theme, setTheme, toggleSidebar } = useUIStore();
  const breadcrumbs = useBreadcrumbs();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { data: auditData } = useAuditLogs({ limit: 8 });

  const isDark = theme === 'dark';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [notifOpen]);

  const notifications = auditData?.data ?? [];

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-card border-b border-border">
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
                  <span className="text-muted-foreground/40">/</span>
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
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            className={cn(
              'relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors',
              notifOpen && 'bg-secondary text-foreground'
            )}
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aqua-500 rounded-full" />
            )}
          </button>

          {/* Notification Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  notifications.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-b-0"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-snug line-clamp-2">
                          {log.details || `${log.action} on ${log.entity || log.entityType || 'item'}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTimeAgo(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-secondary/30">
                  <Link
                    to="/"
                    onClick={() => setNotifOpen(false)}
                    className="text-[11px] font-medium text-aqua-600 hover:text-aqua-700 transition-colors"
                  >
                    View all activity
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
