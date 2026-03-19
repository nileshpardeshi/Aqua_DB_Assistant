import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TABS, type TabId } from './constants';
import { CollectionsTab } from './tabs/collections-tab';
import { ChainDesignerTab } from './tabs/chains-tab';
import { LoadScenariosTab } from './tabs/scenarios-tab';
import { TestRunsTab } from './tabs/runs-tab';
import { ReportsTab } from './tabs/reports-tab';
import { DataFactoryTab } from './tabs/data-factory-tab';

export function PtSuite() {
  const [activeTab, setActiveTab] = useState<TabId>('collections');

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/50 dark:to-blue-900/50 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Performance Testing Suite</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            End-to-end API performance testing: collections, chains, load scenarios, and AI reports
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-xl p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center',
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-sm shadow-cyan-500/5'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 border border-transparent',
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'collections' && <CollectionsTab />}
        {activeTab === 'chains' && <ChainDesignerTab />}
        {activeTab === 'scenarios' && <LoadScenariosTab />}
        {activeTab === 'runs' && <TestRunsTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'data-factory' && <DataFactoryTab />}
      </div>
    </div>
  );
}
