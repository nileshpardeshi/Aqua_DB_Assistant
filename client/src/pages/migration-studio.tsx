import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  GitBranch,
  ArrowRightLeft,
  Clock,
  GitCompareArrows,
  CheckCircle2,
  XCircle,
  Activity,
  Brain,
  FileCode2,
  BarChart3,
  FolderInput,
  FileEdit,
  Columns3,
  FileUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMigrations } from '@/hooks/use-migrations';
import { MigrationPlanner } from '@/components/migration/migration-planner';
import { DialectConverter } from '@/components/migration/dialect-converter';
import { SchemaComparison } from '@/components/migration/schema-comparison';
import { MigrationScriptsPanel } from '@/components/migration/migration-scripts-panel';
import { MigrationTimeline } from '@/components/migration/migration-timeline';
import { MigrationReports } from '@/components/migration/migration-reports';
import { MigrationImportExport } from '@/components/migration/migration-import-export';
import { ColumnMapping } from '@/components/migration/column-mapping';
import { DataMigration } from '@/components/migration/data-migration';

type MigrationTab =
  | 'planner'
  | 'dialect-converter'
  | 'schema-comparison'
  | 'column-mapping'
  | 'data-migration'
  | 'scripts'
  | 'migration-history'
  | 'reports'
  | 'import-export';

const TABS: {
  id: MigrationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'planner', label: 'Planner', icon: Brain },
  { id: 'dialect-converter', label: 'Converter', icon: ArrowRightLeft },
  { id: 'schema-comparison', label: 'Comparison', icon: GitCompareArrows },
  { id: 'column-mapping', label: 'Column Mapping', icon: Columns3 },
  { id: 'data-migration', label: 'Data Migration', icon: FileUp },
  { id: 'scripts', label: 'Scripts', icon: FileCode2 },
  { id: 'migration-history', label: 'History', icon: Clock },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'import-export', label: 'Import/Export', icon: FolderInput },
];

export function MigrationStudio() {
  const { projectId } = useParams();
  const { data: migrations } = useMigrations(projectId);
  const [activeTab, setActiveTab] = useState<MigrationTab>('planner');

  const totalMigrations = migrations?.length ?? 0;
  const completedMigrations =
    migrations?.filter((m) => m.status === 'completed').length ?? 0;
  const failedMigrations =
    migrations?.filter((m) => m.status === 'failed').length ?? 0;
  const draftMigrations =
    migrations?.filter((m) => m.status === 'draft').length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Migration Studio
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Plan, convert, and manage database migrations at scale
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Total Migrations',
            value: totalMigrations,
            icon: Activity,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
          {
            label: 'Completed',
            value: completedMigrations,
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: 'Failed',
            value: failedMigrations,
            icon: XCircle,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
          {
            label: 'Draft Scripts',
            value: draftMigrations,
            icon: FileEdit,
            color: 'text-slate-600',
            bg: 'bg-slate-100',
          },
          {
            label: 'Success Rate',
            value:
              totalMigrations > 0
                ? `${Math.round((completedMigrations / totalMigrations) * 100)}%`
                : '--',
            icon: GitBranch,
            color: 'text-aqua-600',
            bg: 'bg-aqua-50',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-card border border-slate-200 rounded-xl p-3.5 flex items-center gap-3"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  stat.bg
                )}
              >
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                <p className="text-[9px] text-slate-500 uppercase font-medium tracking-wide">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
                isActive
                  ? 'border-purple-500 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'planner' && projectId && (
          <MigrationPlanner projectId={projectId} />
        )}
        {activeTab === 'dialect-converter' && <DialectConverter />}
        {activeTab === 'schema-comparison' && (
          <SchemaComparison projectId={projectId} />
        )}
        {activeTab === 'column-mapping' && projectId && (
          <ColumnMapping projectId={projectId} />
        )}
        {activeTab === 'data-migration' && projectId && (
          <DataMigration projectId={projectId} />
        )}
        {activeTab === 'scripts' && projectId && (
          <MigrationScriptsPanel projectId={projectId} />
        )}
        {activeTab === 'migration-history' && <MigrationTimeline />}
        {activeTab === 'reports' && projectId && (
          <MigrationReports projectId={projectId} />
        )}
        {activeTab === 'import-export' && projectId && (
          <MigrationImportExport projectId={projectId} />
        )}
      </div>
    </div>
  );
}

export default MigrationStudio;
