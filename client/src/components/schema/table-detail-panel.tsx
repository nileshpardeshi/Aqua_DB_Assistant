import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Table2,
  Columns3,
  ListTree,
  ShieldCheck,
  GitFork,
  ArrowRight,
  ArrowLeft,
  Key,
  Link,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils';
import { useTable, useRelationships } from '@/hooks/use-schema';
import type { Table, Relationship } from '@/hooks/use-schema';

// ── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'columns' | 'indexes' | 'constraints' | 'relationships';

interface TableDetailPanelProps {
  tableId: string;
  onBack?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TableDetailPanel({ tableId, onBack }: TableDetailPanelProps) {
  const { projectId } = useParams();
  const { data: table, isLoading } = useTable(projectId, tableId);
  const { data: allRelationships } = useRelationships(projectId);
  const [activeTab, setActiveTab] = useState<TabKey>('columns');

  // Filter relationships for this table
  const incomingRels = (allRelationships ?? []).filter(
    (r) => r.targetTable === tableId
  );
  const outgoingRels = (allRelationships ?? []).filter(
    (r) => r.sourceTable === tableId
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-aqua-500 animate-spin" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Table not found.</p>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: 'columns', label: 'Columns', icon: Columns3, count: table.columns.length },
    { key: 'indexes', label: 'Indexes', icon: ListTree, count: table.indexes.length },
    { key: 'constraints', label: 'Constraints', icon: ShieldCheck, count: table.constraints.length },
    {
      key: 'relationships',
      label: 'Relationships',
      icon: GitFork,
      count: incomingRels.length + outgoingRels.length,
    },
  ];

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-aqua-600 hover:text-aqua-700 font-medium mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to overview
          </button>
        )}

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }}>
            <Table2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">{table.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-medium bg-aqua-50 text-aqua-700 rounded-full uppercase">
                {table.type || 'table'}
              </span>
              {table.estimatedRows != null && (
                <span className="text-xs text-muted-foreground">
                  ~{formatNumber(table.estimatedRows)} rows
                </span>
              )}
            </div>
            {table.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {table.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-aqua-500 text-aqua-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10px] rounded-full font-medium',
                  activeTab === tab.key
                    ? 'bg-aqua-100 text-aqua-700'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {activeTab === 'columns' && <ColumnsTab table={table} />}
      {activeTab === 'indexes' && <IndexesTab table={table} />}
      {activeTab === 'constraints' && <ConstraintsTab table={table} />}
      {activeTab === 'relationships' && (
        <RelationshipsTab incoming={incomingRels} outgoing={outgoingRels} />
      )}
    </div>
  );
}

// ── Columns Tab ──────────────────────────────────────────────────────────────

function ColumnsTab({ table }: { table: Table }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-slate-500 font-semibold">#</th>
            <th className="text-left py-2 px-3 text-slate-500 font-semibold">Name</th>
            <th className="text-left py-2 px-3 text-slate-500 font-semibold">Type</th>
            <th className="text-center py-2 px-3 text-slate-500 font-semibold">Nullable</th>
            <th className="text-center py-2 px-3 text-slate-500 font-semibold">PK</th>
            <th className="text-center py-2 px-3 text-slate-500 font-semibold">Unique</th>
            <th className="text-left py-2 px-3 text-slate-500 font-semibold">Default</th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((col, idx) => (
            <tr
              key={col.id || col.name}
              className={cn(
                'border-b border-slate-100 transition-colors hover:bg-slate-50',
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
              )}
            >
              <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
              <td className="py-2 px-3 font-medium text-slate-800">
                <div className="flex items-center gap-1.5">
                  {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500" />}
                  {col.isForeignKey && <Link className="w-3 h-3 text-blue-500" />}
                  {col.name}
                </div>
              </td>
              <td className="py-2 px-3 font-mono text-slate-500">{col.dataType}</td>
              <td className="py-2 px-3 text-center">
                <span
                  className={cn(
                    'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                    col.nullable
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-green-50 text-green-700'
                  )}
                >
                  {col.nullable ? 'YES' : 'NO'}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                {col.isPrimaryKey && (
                  <span className="inline-block w-4 h-4 bg-amber-100 text-amber-700 rounded-full text-[10px] leading-4 font-bold text-center">
                    P
                  </span>
                )}
              </td>
              <td className="py-2 px-3 text-center">
                {col.isUnique && (
                  <span className="inline-block w-4 h-4 bg-purple-100 text-purple-700 rounded-full text-[10px] leading-4 font-bold text-center">
                    U
                  </span>
                )}
              </td>
              <td className="py-2 px-3 text-slate-400 font-mono">
                {col.defaultValue ?? '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Indexes Tab ──────────────────────────────────────────────────────────────

function IndexesTab({ table }: { table: Table }) {
  if (table.indexes.length === 0) {
    return (
      <EmptyTabState message="No indexes defined on this table." />
    );
  }

  return (
    <div className="space-y-2">
      {table.indexes.map((idx) => (
        <div
          key={idx.id || idx.name}
          className="bg-white border border-slate-200 rounded-lg p-3"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <ListTree className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-800">
              {idx.name}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded uppercase">
              {idx.type}
            </span>
            {idx.isUnique && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 rounded">
                UNIQUE
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 ml-5.5">
            {idx.columns.map((col) => (
              <span
                key={col}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-50 text-slate-600 rounded border border-slate-200"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Constraints Tab ──────────────────────────────────────────────────────────

function ConstraintsTab({ table }: { table: Table }) {
  if (table.constraints.length === 0) {
    return (
      <EmptyTabState message="No constraints defined on this table." />
    );
  }

  return (
    <div className="space-y-2">
      {table.constraints.map((con) => (
        <div
          key={con.id || con.name}
          className="bg-white border border-slate-200 rounded-lg p-3"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-800">
              {con.name}
            </span>
            <span
              className={cn(
                'px-1.5 py-0.5 text-[10px] font-medium rounded uppercase',
                con.type === 'PRIMARY KEY'
                  ? 'bg-amber-50 text-amber-700'
                  : con.type === 'FOREIGN KEY'
                  ? 'bg-blue-50 text-blue-700'
                  : con.type === 'UNIQUE'
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-slate-100 text-slate-600'
              )}
            >
              {con.type}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 ml-5.5">
            {con.columns.map((col) => (
              <span
                key={col}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-50 text-slate-600 rounded border border-slate-200"
              >
                {col}
              </span>
            ))}
          </div>
          {con.referencesTable && (
            <div className="flex items-center gap-1.5 mt-2 ml-5.5 text-[10px] text-blue-600">
              <ArrowRight className="w-3 h-3" />
              <span className="font-medium">{con.referencesTable}</span>
              {con.referencesColumns && (
                <span className="text-blue-400">
                  ({con.referencesColumns.join(', ')})
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Relationships Tab ────────────────────────────────────────────────────────

function RelationshipsTab({
  incoming,
  outgoing,
}: {
  incoming: Relationship[];
  outgoing: Relationship[];
}) {
  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyTabState message="No relationships found for this table." />
    );
  }

  return (
    <div className="space-y-4">
      {/* Outgoing */}
      {outgoing.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3" />
            Outgoing ({outgoing.length})
          </h4>
          <div className="space-y-2">
            {outgoing.map((rel) => (
              <RelationshipCard key={rel.id} rel={rel} direction="outgoing" />
            ))}
          </div>
        </div>
      )}

      {/* Incoming */}
      {incoming.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ArrowLeft className="w-3 h-3" />
            Incoming ({incoming.length})
          </h4>
          <div className="space-y-2">
            {incoming.map((rel) => (
              <RelationshipCard key={rel.id} rel={rel} direction="incoming" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RelationshipCard({
  rel,
  direction,
}: {
  rel: Relationship;
  direction: 'incoming' | 'outgoing';
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <GitFork className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-800">
          {rel.name}
        </span>
        {rel.isInferred && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">
            inferred
          </span>
        )}
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded uppercase">
          {rel.type}
        </span>
      </div>
      <div className="flex items-center gap-2 ml-5.5 text-xs text-slate-600">
        <span className="font-mono">
          {(rel.sourceTableName || rel.sourceTable)}.{rel.sourceColumn}
        </span>
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <span className="font-mono">
          {(rel.targetTableName || rel.targetTable)}.{rel.targetColumn}
        </span>
      </div>
    </div>
  );
}

// ── Empty Tab State ──────────────────────────────────────────────────────────

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
