import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CommandPalette } from '../shared/command-palette';
import { useUIStore } from '../../stores/use-ui-store';
import { cn } from '../../lib/utils';

export function AppLayout() {
  const { sidebarOpen, sidebarCollapsed } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          'flex-shrink-0 transition-all duration-300 ease-in-out',
          // Mobile: overlay behavior
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50',
          !sidebarOpen && 'max-lg:-translate-x-full'
        )}
      >
        <Sidebar />
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => useUIStore.getState().setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette />
    </div>
  );
}

export default AppLayout;
