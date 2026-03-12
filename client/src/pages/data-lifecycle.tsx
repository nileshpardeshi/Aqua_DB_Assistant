import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield,
  Clock,
  Trash2,
  Tags,
  Activity,
  CheckCircle2,
  Table2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataLifecycleRules } from '@/hooks/use-data-lifecycle';
import { RetentionPolicyEditor } from '@/components/data-lifecycle/retention-policy-editor';
import { PurgeScriptGenerator } from '@/components/data-lifecycle/purge-script-generator';
import { DataClassification } from '@/components/data-lifecycle/data-classification';

type LifecycleTab = 'retention-policies' | 'purge-scripts' | 'data-classification';

const TABS: {
  id: LifecycleTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'retention-policies', label: 'Retention Policies', icon: Clock },
  { id: 'purge-scripts', label: 'Purge Scripts', icon: Trash2 },
  { id: 'data-classification', label: 'Data Classification', icon: Tags },
];

export function DataLifecycle() {
  const { projectId } = useParams();
  const { data: rules } = useDataLifecycleRules(projectId);
  const [activeTab, setActiveTab] = useState<LifecycleTab>('retention-policies');

  const totalRules = rules?.length ?? 0;
  const activeRules = rules?.filter((r) => r.active).length ?? 0;
  const tablesWithRules = new Set(rules?.map((r) => r.tableName)).size ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Data Lifecycle
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage retention policies, generate purge scripts, and classify data
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Rules',
            value: totalRules,
            icon: Activity,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Active Rules',
            value: activeRules,
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: 'Tables Covered',
            value: tablesWithRules,
            icon: Table2,
            color: 'text-aqua-600',
            bg: 'bg-aqua-50',
          },
          {
            label: 'Est. Purgeable',
            value: totalRules > 0 ? '~12.4K' : '--',
            icon: Trash2,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3"
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
                  ? 'border-blue-500 text-blue-700'
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
        {activeTab === 'retention-policies' && <RetentionPolicyEditor />}
        {activeTab === 'purge-scripts' && <PurgeScriptGenerator />}
        {activeTab === 'data-classification' && <DataClassification />}
      </div>
    </div>
  );
}

export default DataLifecycle;
