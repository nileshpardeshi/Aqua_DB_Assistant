import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Gauge,
  Timer,
  Database,
  Search,
  Activity,
  TrendingUp,
  Zap,
  BarChart3,
  Layers,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePerformanceRuns } from '@/hooks/use-performance';
import { SyntheticDataGenerator } from '@/components/performance/synthetic-data-generator';
import { QueryBenchmark } from '@/components/performance/query-benchmark';
import { IndexAdvisor } from '@/components/performance/index-advisor';
import { PartitionAdvisor } from '@/components/performance/partition-advisor';
import { JPAQueryLabContent } from '@/pages/jpa-query-lab';

type PerformanceTab = 'benchmarks' | 'data-generator' | 'index-advisor' | 'partition-advisor' | 'jpa-lab';

const TABS: {
  id: PerformanceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'benchmarks', label: 'Benchmarks', icon: Timer },
  { id: 'data-generator', label: 'Data Generator', icon: Database },
  { id: 'index-advisor', label: 'Index Advisor', icon: Search },
  { id: 'partition-advisor', label: 'Partition Advisor', icon: Layers },
  { id: 'jpa-lab', label: 'JPA Query Lab', icon: FlaskConical },
];

export function PerformanceLab() {
  const { projectId } = useParams();
  const { data: runs } = usePerformanceRuns(projectId);
  const [activeTab, setActiveTab] = useState<PerformanceTab>('benchmarks');

  const totalRuns = runs?.length ?? 0;
  const benchmarkRuns = runs?.filter((r) => r.type === 'benchmark').length ?? 0;
  const completedRuns = runs?.filter((r) => r.status === 'completed').length ?? 0;
  const indexAnalyses = runs?.filter((r) => r.type === 'index-analysis').length ?? 0;
  const jpaAnalyses = runs?.filter((r) => r.type === 'jpa-analysis').length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-cyan-100 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Performance Lab
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Benchmark queries, generate test data, optimize indexes,
              partitions & JPA queries
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: 'Total Runs',
            value: totalRuns,
            icon: Activity,
            color: 'text-aqua-600',
            bg: 'bg-aqua-50',
          },
          {
            label: 'Benchmarks',
            value: benchmarkRuns,
            icon: Timer,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Completed',
            value: completedRuns,
            icon: TrendingUp,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Index Analyses',
            value: indexAnalyses,
            icon: Zap,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'JPA Analyses',
            value: jpaAnalyses,
            icon: FlaskConical,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
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
                  ? 'border-aqua-500 text-aqua-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-slate-400">
          <BarChart3 className="w-3 h-3" />
          {totalRuns} total runs
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'benchmarks' && <QueryBenchmark />}
        {activeTab === 'data-generator' && <SyntheticDataGenerator />}
        {activeTab === 'index-advisor' && <IndexAdvisor />}
        {activeTab === 'partition-advisor' && <PartitionAdvisor />}
        {activeTab === 'jpa-lab' && <JPAQueryLabContent />}
      </div>
    </div>
  );
}

export default PerformanceLab;
