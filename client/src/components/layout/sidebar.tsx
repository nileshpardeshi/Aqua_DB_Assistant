import { useState, useRef, useEffect } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Database,
  GitFork,
  Terminal,
  Gauge,
  Shield,
  GitBranch,
  Plug,
  Heart,
  Bot,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ArrowRightLeft,
  FlaskConical,
  ScrollText,
  FileText,
  Coins,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { APP_NAME, APP_TAGLINE, getDialect } from '../../config/constants';
import { useUIStore } from '../../stores/use-ui-store';
import { useProjectStore } from '../../stores/use-project-store';
import { useProjects, type Project } from '../../hooks/use-projects';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  end?: boolean;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', end: true },
];

const toolNavItems: NavItem[] = [
  { label: 'SQL Converter', icon: ArrowRightLeft, path: '/tools/sql-converter' },
  { label: 'JPA Query Lab', icon: FlaskConical, path: '/tools/jpa-lab' },
  { label: 'DB Connections', icon: Plug, path: '/tools/connections' },
  { label: 'Audit Logs', icon: ScrollText, path: '/audit-logs' },
  { label: 'AI Usage', icon: Coins, path: '/ai-usage' },
];

function getProjectNavItems(projectId: string): NavItem[] {
  return [
    { label: 'Overview', icon: FolderOpen, path: `/project/${projectId}`, end: true },
    { label: 'Schema Intelligence', icon: Database, path: `/project/${projectId}/schema` },
    { label: 'Diagram Studio', icon: GitFork, path: `/project/${projectId}/schema/er-diagram` },
    { label: 'Query Intelligence', icon: Terminal, path: `/project/${projectId}/query` },
    { label: 'Performance Lab', icon: Gauge, path: `/project/${projectId}/performance` },
    { label: 'DB Docs', icon: FileText, path: `/project/${projectId}/docs` },
    { label: 'Data Lifecycle', icon: Shield, path: `/project/${projectId}/data-lifecycle` },
    { label: 'Migration Studio', icon: GitBranch, path: `/project/${projectId}/migrations` },
  ];
}

const bottomNavItems: NavItem[] = [
  { label: 'Contact Us', icon: Heart, path: '/settings' },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed, toggleAiPanel, aiPanelOpen } =
    useUIStore();
  const { activeProjectId, setActiveProject } = useProjectStore();
  const { data: projects } = useProjects();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId && projectId !== activeProjectId) {
      setActiveProject(projectId);
    }
  }, [projectId, activeProjectId, setActiveProject]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentProject = projects?.find((p: Project) => p.id === (projectId || activeProjectId));
  const displayProjectId = projectId || activeProjectId;
  const projectNavItems = displayProjectId ? getProjectNavItems(displayProjectId) : [];

  function handleProjectSelect(project: Project) {
    setActiveProject(project.id);
    setProjectDropdownOpen(false);
    navigate(`/project/${project.id}`);
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Logo and Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <img
          src="/logo.jpg"
          alt={APP_NAME}
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
        />
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white tracking-tight truncate">
              {APP_NAME}
            </h1>
            <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
              {APP_TAGLINE}
            </p>
          </div>
        )}
      </div>

      {/* Project Selector */}
      {!sidebarCollapsed && projects && projects.length > 0 && (
        <div className="px-3 py-3 border-b border-sidebar-border" ref={dropdownRef}>
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-slate-300 bg-sidebar-accent rounded-lg hover:bg-slate-700 transition-colors"
          >
            <span className="truncate">
              {currentProject ? currentProject.name : 'Select Project'}
            </span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 ml-2 flex-shrink-0 transition-transform',
                projectDropdownOpen && 'rotate-180',
              )}
            />
          </button>

          {projectDropdownOpen && (
            <div className="mt-1 py-1 bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-h-48 overflow-y-auto">
              {projects.map((project: Project) => {
                const dialect = getDialect(project.dialect);
                return (
                  <button
                    key={project.id}
                    onClick={() => handleProjectSelect(project)}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-slate-700 transition-colors',
                      project.id === displayProjectId
                        ? 'text-aqua-400 bg-slate-700/50'
                        : 'text-slate-300',
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dialect?.color || '#64748b' }}
                    />
                    <span className="truncate">{project.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {/* Main Nav */}
        {mainNavItems.map((item) => (
          <SidebarLink key={item.path} item={item} collapsed={sidebarCollapsed} />
        ))}

        {/* Tools Section */}
        {!sidebarCollapsed && (
          <div className="pt-4 pb-1 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Tools
            </p>
          </div>
        )}
        {sidebarCollapsed && <div className="my-2 border-t border-sidebar-border" />}
        {toolNavItems.map((item) => (
          <SidebarLink key={item.path} item={item} collapsed={sidebarCollapsed} />
        ))}

        {/* Project Nav */}
        {displayProjectId && projectNavItems.length > 0 && (
          <>
            {!sidebarCollapsed && (
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Project
                </p>
              </div>
            )}
            {sidebarCollapsed && <div className="my-2 border-t border-sidebar-border" />}
            {projectNavItems.map((item) => (
              <SidebarLink key={item.path} item={item} collapsed={sidebarCollapsed} />
            ))}
          </>
        )}

        {/* Divider */}
        <div className="my-3 border-t border-sidebar-border" />

        {/* Bottom Nav */}
        {bottomNavItems.map((item) => (
          <SidebarLink key={item.path} item={item} collapsed={sidebarCollapsed} />
        ))}
      </nav>

      {/* Bottom Controls */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {/* AI Copilot Toggle */}
        <button
          onClick={toggleAiPanel}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            aiPanelOpen
              ? 'bg-aqua-600 text-white shadow-lg shadow-aqua-600/25'
              : 'text-slate-400 hover:text-white hover:bg-sidebar-accent',
          )}
          title="AI Copilot"
        >
          <Bot className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span>AI Copilot</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebarCollapsed}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-sidebar-accent transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="w-5 h-5 flex-shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="w-5 h-5 flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative',
          isActive
            ? 'bg-aqua-600/15 text-aqua-400'
            : 'text-slate-400 hover:text-slate-200 hover:bg-sidebar-accent',
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-aqua-400 rounded-r-full" />
          )}
          <Icon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

export default Sidebar;
