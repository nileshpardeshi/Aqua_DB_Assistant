import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Database,
  Upload,
  Sparkles,
  Camera,
  Table2,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTables, useCreateSnapshot } from '@/hooks/use-schema';
import { SchemaExplorer } from '@/components/schema/schema-explorer';
import { TableDetailPanel } from '@/components/schema/table-detail-panel';
import { FileUploadZone } from '@/components/shared/file-upload-zone';
import type { Table } from '@/hooks/use-schema';

// ── Component ────────────────────────────────────────────────────────────────

export function SchemaIntelligence() {
  const { projectId } = useParams();
  const { data: tables, isLoading } = useTables(projectId);
  const createSnapshot = useCreateSnapshot();

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');

  const handleSelectTable = useCallback((table: Table) => {
    setSelectedTable(table);
  }, []);

  const handleBackToOverview = useCallback(() => {
    setSelectedTable(null);
  }, []);

  const handleUploadComplete = useCallback(() => {
    // Upload modal stays open so user can see success; they close manually
  }, []);

  const handleCreateSnapshot = useCallback(() => {
    if (!projectId || !snapshotName.trim()) return;
    createSnapshot.mutate(
      { projectId, name: snapshotName.trim() },
      {
        onSuccess: () => {
          setShowSnapshotDialog(false);
          setSnapshotName('');
        },
      }
    );
  }, [projectId, snapshotName, createSnapshot]);

  const hasTables = (tables?.length ?? 0) > 0;

  return (
    <div className="flex h-full min-h-[calc(100vh-180px)]">
      {/* ── Left Panel: Schema Explorer ───────────────────────────── */}
      <div className="w-[300px] border-r border-border bg-slate-50/50 flex-shrink-0 flex flex-col">
        <SchemaExplorer
          onSelectTable={handleSelectTable}
          selectedTableId={selectedTable?.id}
        />
      </div>

      {/* ── Right Panel: Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-6 py-3 bg-white/95 backdrop-blur border-b border-slate-200">
          <h2 className="text-sm font-semibold text-foreground mr-auto">
            Schema Intelligence
          </h2>

          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload SQL
          </button>

          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors border border-aqua-200"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Design
          </button>

          <button
            onClick={() => setShowSnapshotDialog(true)}
            disabled={!hasTables}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border',
              hasTables
                ? 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200'
                : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'
            )}
          >
            <Camera className="w-3.5 h-3.5" />
            Snapshot
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-aqua-500 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Loading schema...
                </p>
              </div>
            </div>
          )}

          {/* Table Detail */}
          {!isLoading && selectedTable && (
            <TableDetailPanel
              tableId={selectedTable.id}
              onBack={handleBackToOverview}
            />
          )}

          {/* Overview Grid (when no table selected) */}
          {!isLoading && !selectedTable && hasTables && (
            <SchemaOverviewGrid tables={tables!} onSelectTable={handleSelectTable} />
          )}

          {/* Empty State */}
          {!isLoading && !selectedTable && !hasTables && (
            <SchemaEmptyState onUpload={() => setShowUploadModal(true)} />
          )}
        </div>
      </div>

      {/* ── Upload Modal ──────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowUploadModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <FileUploadZone
              onUploadComplete={handleUploadComplete}
              onClose={() => setShowUploadModal(false)}
            />
          </div>
        </div>
      )}

      {/* ── Snapshot Dialog ────────────────────────────────────────── */}
      {showSnapshotDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSnapshotDialog(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                Create Snapshot
              </h3>
              <button
                onClick={() => setShowSnapshotDialog(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Snapshot name..."
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSnapshot();
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSnapshotDialog(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={!snapshotName.trim() || createSnapshot.isPending}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  snapshotName.trim()
                    ? 'text-white bg-aqua-600 hover:bg-aqua-700'
                    : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                )}
              >
                {createSnapshot.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overview Grid ────────────────────────────────────────────────────────────

function SchemaOverviewGrid({
  tables,
  onSelectTable,
}: {
  tables: Table[];
  onSelectTable: (table: Table) => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground">Schema Overview</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {tables.length} table{tables.length !== 1 ? 's' : ''} discovered in
          your database schema
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tables.map((table) => {
          const pkCount = table.columns.filter((c) => c.isPrimaryKey).length;
          const fkCount = table.columns.filter((c) => c.isForeignKey).length;

          return (
            <button
              key={table.id}
              onClick={() => onSelectTable(table)}
              className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-aqua-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                  }}
                >
                  <Table2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-aqua-700 transition-colors">
                    {table.name}
                  </h4>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {table.type || 'table'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{table.columns.length} cols</span>
                {pkCount > 0 && (
                  <span className="text-amber-600">{pkCount} PK</span>
                )}
                {fkCount > 0 && (
                  <span className="text-blue-600">{fkCount} FK</span>
                )}
                <span>{table.indexes.length} idx</span>
              </div>

              {table.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {table.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function SchemaEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-aqua-100 to-cyan-100 flex items-center justify-center mb-6">
        <Database className="w-10 h-10 text-aqua-600" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Upload SQL files or design a schema to get started
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        Import existing SQL DDL files to analyze your schema, or use AI to help
        design a new database schema from scratch.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload SQL Files
        </button>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aqua-700 bg-aqua-50 rounded-lg hover:bg-aqua-100 transition-colors border border-aqua-200">
          <Sparkles className="w-4 h-4" />
          AI Schema Design
        </button>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 w-full max-w-2xl">
        {[
          {
            icon: Upload,
            title: 'SQL Import',
            description:
              'Parse CREATE TABLE, ALTER TABLE, and other DDL statements automatically',
          },
          {
            icon: Table2,
            title: 'Schema Analysis',
            description:
              'Get AI-powered insights on normalization, indexing, and relationships',
          },
          {
            icon: Sparkles,
            title: 'AI Generation',
            description:
              'Describe your data model in plain English and let AI generate the schema',
          },
        ].map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="bg-white rounded-xl border border-border p-5 shadow-sm"
            >
              <div className="w-9 h-9 rounded-lg bg-aqua-50 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-aqua-600" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {feature.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SchemaIntelligence;
