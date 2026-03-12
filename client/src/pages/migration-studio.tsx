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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMigrations } from '@/hooks/use-migrations';
import { DialectConverter } from '@/components/migration/dialect-converter';
import { MigrationTimeline } from '@/components/migration/migration-timeline';
import { SchemaComparison } from '@/components/migration/schema-comparison';

type MigrationTab = 'dialect-converter' | 'migration-history' | 'schema-comparison';

const TABS: {
  id: MigrationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dialect-converter', label: 'Dialect Converter', icon: ArrowRightLeft },
  { id: 'migration-history', label: 'Migration History', icon: Clock },
  { id: 'schema-comparison', label: 'Schema Comparison', icon: GitCompareArrows },
];

export function MigrationStudio() {
  const { projectId } = useParams();
  const { data: migrations } = useMigrations(projectId);
  const [activeTab, setActiveTab] = useState<MigrationTab>('dialect-converter');

  const totalMigrations = migrations?.length ?? 0;
  const successfulMigrations =
    migrations?.filter((m) => m.status === 'completed').length ?? 0;
  const failedMigrations =
    migrations?.filter((m) => m.status === 'failed').length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
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
              Convert SQL dialects, track migrations, and compare schemas
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Migrations',
            value: totalMigrations,
            icon: Activity,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
          {
            label: 'Successful',
            value: successfulMigrations,
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
            label: 'Success Rate',
            value:
              totalMigrations > 0
                ? `${Math.round((successfulMigrations / totalMigrations) * 100)}%`
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
              className="bg-card border border-slate-200 rounded-xl p-4 flex items-center gap-3"
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                  stat.bg
                )}
              >
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                isActive
                  ? 'border-purple-500 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'dialect-converter' && <DialectConverter />}
        {activeTab === 'migration-history' && <MigrationTimeline />}
        {activeTab === 'schema-comparison' && <SchemaComparison />}
      </div>
    </div>
  );
}

export default MigrationStudio;
