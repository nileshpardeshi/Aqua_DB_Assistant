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
  History,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataLifecycleRules, parseRuleConfig } from '@/hooks/use-data-lifecycle';
import { RetentionPolicyEditor } from '@/components/data-lifecycle/retention-policy-editor';
import { PurgeScriptGenerator } from '@/components/data-lifecycle/purge-script-generator';
import { DataClassification } from '@/components/data-lifecycle/data-classification';
import { ExecutionHistory } from '@/components/data-lifecycle/execution-history';

type LifecycleTab = 'retention-policies' | 'purge-scripts' | 'data-classification' | 'execution-history';

const TABS: {
  id: LifecycleTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'retention-policies', label: 'Retention Policies', icon: Clock },
  { id: 'purge-scripts', label: 'Purge Scripts', icon: Trash2 },
  { id: 'execution-history', label: 'Execution History', icon: History },
  { id: 'data-classification', label: 'Data Classification', icon: Tags },
];

export function DataLifecycle() {
  const { projectId } = useParams();
  const { data: rules } = useDataLifecycleRules(projectId);
  const [activeTab, setActiveTab] = useState<LifecycleTab>('retention-policies');

  const totalRules = rules?.length ?? 0;
  const activeRules = rules?.filter((r) => r.isActive).length ?? 0;
  const tablesWithRules = new Set(rules?.map((r) => r.targetTable)).size ?? 0;
  const criticalRules = rules?.filter((r) => {
    const config = parseRuleConfig(r);
    return config.priority === 'critical';
  }).length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Data Lifecycle Manager
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enterprise data retention, purge script generation, dry-run analysis, and compliance
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
            bg: 'bg-blue-50 dark:bg-blue-900/20',
          },
          {
            label: 'Active Rules',
            value: activeRules,
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20',
          },
          {
            label: 'Tables Covered',
            value: tablesWithRules,
            icon: Table2,
            color: 'text-aqua-600',
            bg: 'bg-aqua-50 dark:bg-aqua-900/20',
          },
          {
            label: 'Critical Rules',
            value: criticalRules,
            icon: criticalRules > 0 ? AlertTriangle : Trash2,
            color: criticalRules > 0 ? 'text-red-600' : 'text-muted-foreground',
            bg: criticalRules > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/50',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
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
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
                isActive
                  ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
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
        {activeTab === 'execution-history' && <ExecutionHistory />}
        {activeTab === 'data-classification' && <DataClassification />}
      </div>
    </div>
  );
}

export default DataLifecycle;
