import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Wand2,
  FileCode,
  Activity,
  BarChart3,
  Database,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerformanceRuns } from '@/hooks/use-performance';
import { SyntheticScriptsTab } from '@/components/datagen/synthetic-scripts-tab';
import { QueryPlannerTab } from '@/components/datagen/query-planner-tab';
import { DataDistributionTab } from '@/components/datagen/data-distribution-tab';

type DatagenTab = 'synthetic-scripts' | 'query-planner' | 'data-distribution';

const TABS: {
  id: DatagenTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    id: 'synthetic-scripts',
    label: 'Synthetic Data Scripts',
    icon: FileCode,
    description: 'Generate INSERT scripts with realistic data',
  },
  {
    id: 'query-planner',
    label: 'Query Planner Simulation',
    icon: Activity,
    description: 'Simulate EXPLAIN ANALYZE plans',
  },
  {
    id: 'data-distribution',
    label: 'Data Distribution',
    icon: BarChart3,
    description: 'Analyze column distributions & skew',
  },
];

export function SyntheticDataLab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: runs } = usePerformanceRuns(projectId);
  const [activeTab, setActiveTab] = useState<DatagenTab>('synthetic-scripts');

  const datagenTypes = ['synthetic-data-gen', 'query-plan-sim', 'data-dist-sim'];
  const datagenRuns = runs?.filter((r) => datagenTypes.includes(r.type)) ?? [];
  const totalRuns = datagenRuns.length;
  const scriptRuns = datagenRuns.filter((r) => r.type === 'synthetic-data-gen').length;
  const planRuns = datagenRuns.filter((r) => r.type === 'query-plan-sim').length;
  const distRuns = datagenRuns.filter((r) => r.type === 'data-dist-sim').length;

  const stats = [
    { label: 'Total Runs', value: totalRuns, icon: Zap, color: 'text-aqua-500' },
    { label: 'Scripts Generated', value: scriptRuns, icon: FileCode, color: 'text-emerald-500' },
    { label: 'Plans Simulated', value: planRuns, icon: Activity, color: 'text-violet-500' },
    { label: 'Distributions', value: distRuns, icon: TrendingUp, color: 'text-amber-500' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-aqua-100 dark:bg-aqua-900/30 rounded-lg">
            <Wand2 className="w-6 h-6 text-aqua-600 dark:text-aqua-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Synthetic Large Data Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered synthetic data generation, query plan simulation & distribution analysis
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
          >
            <div className="p-2 bg-secondary rounded-lg">
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-aqua-500 text-aqua-600 dark:text-aqua-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'synthetic-scripts' && <SyntheticScriptsTab />}
        {activeTab === 'query-planner' && <QueryPlannerTab />}
        {activeTab === 'data-distribution' && <DataDistributionTab />}
      </div>
    </div>
  );
}

export default SyntheticDataLab;
