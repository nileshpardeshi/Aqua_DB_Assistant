import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ArrowDown,
  ArrowRight,
  Loader2,
  Download,
  Play,
  Settings2,
  List,
  Eye,
  XCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  Zap,
  Info,
  Save,
  FolderOpen,
  Pencil,
  Trash2,
  Table2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DATABASE_DIALECTS } from '@/config/constants';
import { useColumnMappings, type SavedColumnMapping } from '@/hooks/use-column-mappings';
import {
  useUploadCSV,
  useResolveDependencies,
  useGenerateScript,
  useGenerationStatus,
  getDownloadURL,
  type CSVUploadResult,
  type DataSheetMapping,
  type ColumnMapping,
  type TargetColumnDef,
  type TableMigrationConfig,
} from '@/hooks/use-data-migration';
import {
  useDataSheetMappings,
  useCreateDataSheetMapping,
  useUpdateDataSheetMapping,
  useDeleteDataSheetMapping,
} from '@/hooks/use-data-sheet-mappings';

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ParsedMapping {
  sourceColumn: string;
  targetColumn: string;
  transformationType: string;
  expression?: string;
  castTo?: string;
  defaultValue?: string;
  nullHandling: string;
  isValid: boolean;
  sourceDataType?: string;
  targetDataType?: string;
}

function parseSavedMappings(m: SavedColumnMapping): ParsedMapping[] {
  try {
    const parsed = JSON.parse(m.mappings);

    // SavedMappingData format: { columnMappings, sourceColumns, targetColumns }
    if (parsed?.columnMappings && Array.isArray(parsed.columnMappings)) {
      const srcCols: Array<{ name: string; dataType: string }> = parsed.sourceColumns || [];
      const tgtCols: Array<{ name: string; dataType: string }> = parsed.targetColumns || [];

      return parsed.columnMappings.map((cm: ParsedMapping) => {
        const srcDef = srcCols.find((c) => c.name === cm.sourceColumn);
        const tgtDef = tgtCols.find((c) => c.name === cm.targetColumn);
        return {
          ...cm,
          sourceDataType: cm.sourceDataType || srcDef?.dataType || 'VARCHAR',
          targetDataType: cm.targetDataType || tgtDef?.dataType || 'VARCHAR',
        };
      });
    }

    // Legacy flat array format
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function fuzzyMatch(csvHeader: string, dbColumn: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[_\-\s]/g, '').trim();
  return normalize(csvHeader) === normalize(dbColumn);
}

const TRANSFORM_COLORS: Record<string, { bg: string; text: string }> = {
  direct: { bg: 'bg-slate-100', text: 'text-slate-600' },
  cast: { bg: 'bg-blue-100', text: 'text-blue-700' },
  expression: { bg: 'bg-purple-100', text: 'text-purple-700' },
  default: { bg: 'bg-amber-100', text: 'text-amber-700' },
  rename: { bg: 'bg-green-100', text: 'text-green-700' },
};

// ── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Select Mappings' },
  { num: 2, label: 'Upload CSV' },
  { num: 3, label: 'Map Headers' },
  { num: 4, label: 'Verify Chain' },
  { num: 5, label: 'Configure' },
  { num: 6, label: 'Generate' },
];

function StepIndicator({
  current,
  completed,
}: {
  current: number;
  completed: Set<number>;
}) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const isActive = step.num === current;
        const isDone = completed.has(step.num);
        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  isActive
                    ? 'bg-purple-600 text-white ring-2 ring-purple-200'
                    : isDone
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500',
                )}
              >
                {isDone && !isActive ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  step.num
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  isActive
                    ? 'text-purple-700'
                    : isDone
                      ? 'text-green-600'
                      : 'text-slate-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-10 h-0.5 mx-0.5 mt-[-12px]',
                  completed.has(step.num) ? 'bg-green-400' : 'bg-slate-200',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DataMigration({ projectId }: { projectId: string }) {
  // ── State ────────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMappingIds, setSelectedMappingIds] = useState<Set<string>>(new Set());
  const [csvFiles, setCsvFiles] = useState<Map<string, CSVUploadResult>>(new Map());
  const [dataSheetMappings, setDataSheetMappings] = useState<Map<string, DataSheetMapping[]>>(new Map());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [loadedDSMIds, setLoadedDSMIds] = useState<Map<string, string>>(new Map());

  // Config
  const [batchSize, setBatchSize] = useState(5000);
  const [targetDialect, setTargetDialect] = useState('postgresql');
  const [disableFK, setDisableFK] = useState(true);
  const [includeTransaction, setIncludeTransaction] = useState(true);

  // Generation
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: savedMappings, isLoading: loadingMappings } = useColumnMappings(projectId);
  const { data: savedDSMs } = useDataSheetMappings(projectId);
  const uploadCSV = useUploadCSV();
  const resolveDeps = useResolveDependencies();
  const generateScript = useGenerateScript();
  const { data: genStatus } = useGenerationStatus(projectId, generationJobId, !!generationJobId);
  const createDSM = useCreateDataSheetMapping();
  const updateDSM = useUpdateDataSheetMapping();
  const deleteDSM = useDeleteDataSheetMapping();

  // File input refs
  const fileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedMappings = useMemo(() => {
    if (!savedMappings) return [];
    return savedMappings.filter((m) => selectedMappingIds.has(m.id));
  }, [savedMappings, selectedMappingIds]);

  const dependencyOrder = resolveDeps.data;

  // Order selected mappings by dependency resolution
  const orderedMappings = useMemo(() => {
    if (!dependencyOrder || selectedMappings.length === 0) return selectedMappings;

    const sorted = [...selectedMappings];
    sorted.sort((a, b) => {
      const idxA = dependencyOrder.sortedTables.indexOf(a.sourceTableName);
      const idxB = dependencyOrder.sortedTables.indexOf(b.sourceTableName);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
    return sorted;
  }, [selectedMappings, dependencyOrder]);

  const completedSteps = useMemo(() => {
    const done = new Set<number>();

    // Step 1: at least one mapping selected
    if (selectedMappingIds.size > 0) done.add(1);

    // Step 2: all selected tables have CSV uploaded
    if (selectedMappingIds.size > 0) {
      const allUploaded = orderedMappings.every((m) =>
        csvFiles.has(m.sourceTableName),
      );
      if (allUploaded) done.add(2);
    }

    // Step 3: all tables have header mappings
    if (done.has(2)) {
      const allMapped = orderedMappings.every((m) => {
        const mappings = dataSheetMappings.get(m.sourceTableName);
        return mappings && mappings.length > 0;
      });
      if (allMapped) done.add(3);
    }

    // Step 4: verify chain is always valid if step 3 is done
    if (done.has(3)) done.add(4);

    // Step 5: config is always valid
    if (done.has(4)) done.add(5);

    // Step 6: completed generation
    if (genStatus?.status === 'completed') done.add(6);

    return done;
  }, [selectedMappingIds, orderedMappings, csvFiles, dataSheetMappings, genStatus]);

  const canProceed = completedSteps.has(currentStep);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleMapping = useCallback((id: string) => {
    setSelectedMappingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleResolveOrder = useCallback(() => {
    resolveDeps.mutate({ projectId });
  }, [projectId, resolveDeps]);

  const handleCSVUpload = useCallback(
    async (sourceTableName: string, file: File) => {
      try {
        const result = await uploadCSV.mutateAsync({ projectId, file });
        setCsvFiles((prev) => new Map(prev).set(sourceTableName, result));

        // Auto-match headers
        const mapping = selectedMappings.find(
          (m) => m.sourceTableName === sourceTableName,
        );
        if (mapping) {
          const parsed = parseSavedMappings(mapping);
          const sourceColumns = parsed.map((p) => p.sourceColumn);
          const autoMappings: DataSheetMapping[] = [];

          for (const header of result.headers) {
            const match = sourceColumns.find((col) => fuzzyMatch(header, col));
            if (match) {
              autoMappings.push({ csvHeader: header, sourceColumn: match });
            }
          }

          if (autoMappings.length > 0) {
            setDataSheetMappings((prev) =>
              new Map(prev).set(sourceTableName, autoMappings),
            );
          }
        }
      } catch {
        // Error handled by mutation
      }
    },
    [projectId, uploadCSV, selectedMappings],
  );

  const handleHeaderMapping = useCallback(
    (tableName: string, csvHeader: string, sourceColumn: string) => {
      setDataSheetMappings((prev) => {
        const existing = prev.get(tableName) || [];
        const filtered = existing.filter((m) => m.csvHeader !== csvHeader);
        if (sourceColumn) {
          filtered.push({ csvHeader, sourceColumn });
        }
        return new Map(prev).set(tableName, filtered);
      });
    },
    [],
  );

  const handleAutoMatchAll = useCallback(
    (tableName: string) => {
      const csvResult = csvFiles.get(tableName);
      const mapping = selectedMappings.find(
        (m) => m.sourceTableName === tableName,
      );
      if (!csvResult || !mapping) return;

      const parsed = parseSavedMappings(mapping);
      const sourceColumns = parsed.map((p) => p.sourceColumn);
      const autoMappings: DataSheetMapping[] = [];

      for (const header of csvResult.headers) {
        const match = sourceColumns.find((col) => fuzzyMatch(header, col));
        if (match) {
          autoMappings.push({ csvHeader: header, sourceColumn: match });
        }
      }

      setDataSheetMappings((prev) =>
        new Map(prev).set(tableName, autoMappings),
      );
    },
    [csvFiles, selectedMappings],
  );

  const handleSaveDSM = useCallback(
    async (tableName: string, name: string) => {
      const mappings = dataSheetMappings.get(tableName) || [];
      const csv = csvFiles.get(tableName);
      const csvFileName = csv?.originalName || `${tableName}.csv`;

      const result = await createDSM.mutateAsync({
        projectId,
        data: {
          name,
          sourceTableName: tableName,
          csvFileName,
          mappings: JSON.stringify(mappings),
        },
      });

      setLoadedDSMIds((prev) => new Map(prev).set(tableName, result.id));
    },
    [dataSheetMappings, csvFiles, projectId, createDSM],
  );

  const handleUpdateDSM = useCallback(
    async (tableName: string) => {
      const mappingId = loadedDSMIds.get(tableName);
      if (!mappingId) return;

      const mappings = dataSheetMappings.get(tableName) || [];

      await updateDSM.mutateAsync({
        projectId,
        mappingId,
        data: {
          mappings: JSON.stringify(mappings),
        },
      });
    },
    [loadedDSMIds, dataSheetMappings, projectId, updateDSM],
  );

  const handleDeleteDSM = useCallback(
    async (tableName: string) => {
      const mappingId = loadedDSMIds.get(tableName);
      if (!mappingId) return;

      await deleteDSM.mutateAsync({ projectId, mappingId });
      setLoadedDSMIds((prev) => {
        const next = new Map(prev);
        next.delete(tableName);
        return next;
      });
    },
    [loadedDSMIds, projectId, deleteDSM],
  );

  const handleLoadDSM = useCallback(
    (tableName: string, savedId: string) => {
      const saved = savedDSMs?.find((s) => s.id === savedId);
      if (!saved) return;

      try {
        const mappings: DataSheetMapping[] = JSON.parse(saved.mappings);
        setDataSheetMappings((prev) => new Map(prev).set(tableName, mappings));
        setLoadedDSMIds((prev) => new Map(prev).set(tableName, savedId));
      } catch {
        // Invalid JSON
      }
    },
    [savedDSMs],
  );

  const handleGenerate = useCallback(async () => {
    // Build table configs
    const tables: TableMigrationConfig[] = orderedMappings.map((m) => {
      const csv = csvFiles.get(m.sourceTableName)!;
      const dsm = dataSheetMappings.get(m.sourceTableName) || [];
      const parsed = parseSavedMappings(m);

      const columnMappings: ColumnMapping[] = parsed.map((p, idx) => ({
        id: `cm-${idx}`,
        sourceColumn: p.sourceColumn,
        targetColumn: p.targetColumn,
        transformationType: (p.transformationType || 'direct') as ColumnMapping['transformationType'],
        expression: p.expression,
        castTo: p.castTo,
        defaultValue: p.defaultValue,
        nullHandling: (p.nullHandling || 'pass') as ColumnMapping['nullHandling'],
        isValid: p.isValid !== false,
      }));

      const targetColumns: TargetColumnDef[] = parsed.map((p) => ({
        name: p.targetColumn,
        dataType: p.targetDataType || p.castTo || 'VARCHAR',
      }));

      return {
        sourceTableName: m.sourceTableName,
        targetTableName: m.targetTableName,
        csvFilePath: csv.filePath,
        csvDelimiter: csv.detectedDelimiter,
        dataSheetMappings: dsm,
        columnMappings,
        targetColumns,
      };
    });

    try {
      const result = await generateScript.mutateAsync({
        projectId,
        config: {
          projectId,
          targetDialect,
          tables,
          batchSize,
          disableFKConstraints: disableFK,
          includeTransaction,
        },
      });
      setGenerationJobId(result.jobId);
      setCurrentStep(6);
    } catch {
      // Error handled by mutation
    }
  }, [orderedMappings, csvFiles, dataSheetMappings, projectId, targetDialect, batchSize, disableFK, includeTransaction, generateScript]);

  const toggleExpanded = useCallback((tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <StepIndicator current={currentStep} completed={completedSteps} />

      {/* Step Content */}
      <div className="bg-card border border-slate-200 rounded-xl p-6 min-h-[400px]">
        {currentStep === 1 && (
          <Step1SelectMappings
            savedMappings={savedMappings || []}
            loading={loadingMappings}
            selectedIds={selectedMappingIds}
            onToggle={toggleMapping}
            dependencyOrder={dependencyOrder}
            onResolveOrder={handleResolveOrder}
            resolvingDeps={resolveDeps.isPending}
          />
        )}

        {currentStep === 2 && (
          <Step2UploadCSV
            mappings={orderedMappings}
            csvFiles={csvFiles}
            onUpload={handleCSVUpload}
            uploading={uploadCSV.isPending}
            fileInputRefs={fileInputRefs}
          />
        )}

        {currentStep === 3 && (
          <Step3MapHeaders
            projectId={projectId}
            mappings={orderedMappings}
            csvFiles={csvFiles}
            dataSheetMappings={dataSheetMappings}
            onMapHeader={handleHeaderMapping}
            onAutoMatchAll={handleAutoMatchAll}
            expandedTables={expandedTables}
            onToggleExpanded={toggleExpanded}
            savedDSMs={savedDSMs || []}
            loadedDSMIds={loadedDSMIds}
            onSaveDSM={handleSaveDSM}
            onUpdateDSM={handleUpdateDSM}
            onDeleteDSM={handleDeleteDSM}
            onLoadDSM={handleLoadDSM}
            savingDSM={createDSM.isPending}
            updatingDSM={updateDSM.isPending}
            deletingDSM={deleteDSM.isPending}
          />
        )}

        {currentStep === 4 && (
          <Step4VerifyChain
            orderedMappings={orderedMappings}
            csvFiles={csvFiles}
            dataSheetMappings={dataSheetMappings}
            expandedTables={expandedTables}
            onToggleExpanded={toggleExpanded}
          />
        )}

        {currentStep === 5 && (
          <Step5Configure
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            targetDialect={targetDialect}
            setTargetDialect={setTargetDialect}
            disableFK={disableFK}
            setDisableFK={setDisableFK}
            includeTransaction={includeTransaction}
            setIncludeTransaction={setIncludeTransaction}
            orderedMappings={orderedMappings}
            csvFiles={csvFiles}
            dataSheetMappings={dataSheetMappings}
          />
        )}

        {currentStep === 6 && (
          <Step6Generate
            genStatus={genStatus}
            generationJobId={generationJobId}
            projectId={projectId}
            onGenerate={handleGenerate}
            generating={generateScript.isPending}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {currentStep < 6 && (
          <button
            onClick={() => {
              if (currentStep === 5) {
                handleGenerate();
              } else {
                setCurrentStep((s) => Math.min(6, s + 1));
              }
            }}
            disabled={!canProceed || (currentStep === 5 && generateScript.isPending)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {currentStep === 5 ? (
              <>
                <Play className="w-4 h-4" />
                Generate Script
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Step 1: Select Mappings & Dependencies
// ══════════════════════════════════════════════════════════════════════════════

function Step1SelectMappings({
  savedMappings,
  loading,
  selectedIds,
  onToggle,
  dependencyOrder,
  onResolveOrder,
  resolvingDeps,
}: {
  savedMappings: SavedColumnMapping[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  dependencyOrder: ReturnType<typeof useResolveDependencies>['data'];
  onResolveOrder: () => void;
  resolvingDeps: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <List className="w-4.5 h-4.5 text-purple-600" />
          Select Column Mappings
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Choose which saved column mappings to include in the data migration.
          Each mapping represents a source-target table pair.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      ) : savedMappings.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No saved column mappings found. Create mappings in the Column Mapping tab first.
        </div>
      ) : (
        <div className="grid gap-2">
          {savedMappings.map((m) => {
            const selected = selectedIds.has(m.id);
            const parsed = parseSavedMappings(m);
            return (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                  selected
                    ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-200'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    selected
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-slate-300',
                  )}
                >
                  {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {m.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.sourceTableName} &rarr; {m.targetTableName}{' '}
                    <span className="text-slate-400">
                      ({parsed.length} column{parsed.length !== 1 ? 's' : ''})
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                    {m.sourceDialect}
                  </span>
                  <ArrowDown className="w-3 h-3 text-slate-400 rotate-[-90deg]" />
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                    {m.targetDialect}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Dependency Resolution */}
      {selectedIds.size > 0 && (
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-purple-500" />
              Table Dependencies
            </h4>
            <button
              onClick={onResolveOrder}
              disabled={resolvingDeps}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50 transition-colors"
            >
              {resolvingDeps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              Resolve Order
            </button>
          </div>

          {dependencyOrder && (
            <div className="space-y-2">
              {dependencyOrder.sortedTables
                .filter((t) =>
                  selectedIds.size > 0
                    ? savedMappings.some(
                        (m) =>
                          selectedIds.has(m.id) &&
                          (m.sourceTableName === t || m.targetTableName === t),
                      )
                    : true,
                )
                .map((table, idx) => {
                  const deps = dependencyOrder.graph[table] || [];
                  const isSelfRef =
                    dependencyOrder.selfReferences.includes(table);
                  return (
                    <div
                      key={table}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-700 flex-1">
                        {table}
                      </span>
                      {deps.length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          depends on: {deps.join(', ')}
                        </span>
                      )}
                      {isSelfRef && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
                          self-ref
                        </span>
                      )}
                    </div>
                  );
                })}

              {dependencyOrder.circularDependencies.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-800">
                      Circular Dependencies Detected
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {dependencyOrder.circularDependencies
                        .map((c) => c.join(' <-> '))
                        .join('; ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Step 2: Upload CSV Files
// ══════════════════════════════════════════════════════════════════════════════

function Step2UploadCSV({
  mappings,
  csvFiles,
  onUpload,
  uploading,
  fileInputRefs,
}: {
  mappings: SavedColumnMapping[];
  csvFiles: Map<string, CSVUploadResult>;
  onUpload: (sourceTableName: string, file: File) => void;
  uploading: boolean;
  fileInputRefs: React.MutableRefObject<Map<string, HTMLInputElement | null>>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Upload className="w-4.5 h-4.5 text-purple-600" />
          Upload CSV Data Files
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Upload a CSV file for each source table. The file should contain the
          exported data with column headers in the first row.
        </p>
      </div>

      <div className="grid gap-3">
        {mappings.map((m) => {
          const csv = csvFiles.get(m.sourceTableName);
          const hasCSV = !!csv;

          return (
            <div
              key={m.id}
              className={cn(
                'p-4 rounded-lg border transition-colors',
                hasCSV
                  ? 'border-green-200 bg-green-50/50'
                  : 'border-slate-200 bg-white',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet
                    className={cn(
                      'w-5 h-5',
                      hasCSV ? 'text-green-600' : 'text-slate-400',
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {m.sourceTableName}
                    </p>
                    <p className="text-xs text-slate-400">
                      &rarr; {m.targetTableName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasCSV && (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {csv.rowCount.toLocaleString()} rows
                    </span>
                  )}
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    ref={(el) => fileInputRefs.current.set(m.sourceTableName, el)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(m.sourceTableName, file);
                    }}
                  />
                  <button
                    onClick={() =>
                      fileInputRefs.current.get(m.sourceTableName)?.click()
                    }
                    disabled={uploading}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      hasCSV
                        ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                        : 'text-white bg-purple-600 hover:bg-purple-700',
                    )}
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {hasCSV ? 'Replace' : 'Upload CSV'}
                  </button>
                </div>
              </div>

              {/* Sample preview */}
              {hasCSV && csv.sampleRows.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr>
                        {csv.headers.slice(0, 8).map((h) => (
                          <th
                            key={h}
                            className="px-2 py-1 text-left font-medium text-slate-600 bg-slate-100 border border-slate-200"
                          >
                            {h}
                          </th>
                        ))}
                        {csv.headers.length > 8 && (
                          <th className="px-2 py-1 text-left font-medium text-slate-400 bg-slate-100 border border-slate-200">
                            +{csv.headers.length - 8}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {csv.sampleRows.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {csv.headers.slice(0, 8).map((h) => (
                            <td
                              key={h}
                              className="px-2 py-1 text-slate-500 border border-slate-200 max-w-[120px] truncate"
                            >
                              {row[h] || ''}
                            </td>
                          ))}
                          {csv.headers.length > 8 && (
                            <td className="px-2 py-1 text-slate-300 border border-slate-200">
                              ...
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Delimiter: {csv.detectedDelimiter === '\t' ? 'TAB' : `"${csv.detectedDelimiter}"`}
                    {' | '}
                    Size: {(csv.fileSize / 1024 / 1024).toFixed(1)}MB
                    {' | '}
                    Headers: {csv.headers.length}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Step 3: Map CSV Headers → Source DB Columns (with Save/Load)
// ══════════════════════════════════════════════════════════════════════════════

interface SavedDSMType {
  id: string;
  name: string;
  sourceTableName: string;
  csvFileName: string;
  mappings: string;
}

function Step3MapHeaders({
  projectId,
  mappings,
  csvFiles,
  dataSheetMappings,
  onMapHeader,
  onAutoMatchAll,
  expandedTables,
  onToggleExpanded,
  savedDSMs,
  loadedDSMIds,
  onSaveDSM,
  onUpdateDSM,
  onDeleteDSM,
  onLoadDSM,
  savingDSM,
  updatingDSM,
  deletingDSM,
}: {
  projectId: string;
  mappings: SavedColumnMapping[];
  csvFiles: Map<string, CSVUploadResult>;
  dataSheetMappings: Map<string, DataSheetMapping[]>;
  onMapHeader: (tableName: string, csvHeader: string, sourceColumn: string) => void;
  onAutoMatchAll: (tableName: string) => void;
  expandedTables: Set<string>;
  onToggleExpanded: (tableName: string) => void;
  savedDSMs: SavedDSMType[];
  loadedDSMIds: Map<string, string>;
  onSaveDSM: (tableName: string, name: string) => void;
  onUpdateDSM: (tableName: string) => void;
  onDeleteDSM: (tableName: string) => void;
  onLoadDSM: (tableName: string, savedId: string) => void;
  savingDSM: boolean;
  updatingDSM: boolean;
  deletingDSM: boolean;
}) {
  const [saveNameInputs, setSaveNameInputs] = useState<Map<string, string>>(new Map());
  const [showSaveInput, setShowSaveInput] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Settings2 className="w-4.5 h-4.5 text-purple-600" />
          Map CSV Headers to Source Columns
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          For each table, map the CSV column headers to the corresponding source
          database columns. You can save mappings for reuse.
        </p>
      </div>

      <div className="space-y-3">
        {mappings.map((m) => {
          const csv = csvFiles.get(m.sourceTableName);
          const tableMappings = dataSheetMappings.get(m.sourceTableName) || [];
          const parsed = parseSavedMappings(m);
          const sourceColumns = parsed.map((p) => p.sourceColumn);
          const isExpanded = expandedTables.has(m.sourceTableName);
          const loadedId = loadedDSMIds.get(m.sourceTableName);
          const tableSavedDSMs = savedDSMs.filter(
            (s) => s.sourceTableName === m.sourceTableName,
          );
          const isSaveInputVisible = showSaveInput.has(m.sourceTableName);
          const saveName = saveNameInputs.get(m.sourceTableName) || '';

          if (!csv) return null;

          const mappedCount = tableMappings.length;
          const totalHeaders = csv.headers.length;

          return (
            <div
              key={m.id}
              className="border border-slate-200 rounded-lg overflow-hidden"
            >
              {/* Table header */}
              <button
                onClick={() => onToggleExpanded(m.sourceTableName)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    {m.sourceTableName}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-medium',
                      mappedCount === totalHeaders
                        ? 'bg-green-100 text-green-700'
                        : mappedCount > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700',
                    )}
                  >
                    {mappedCount}/{totalHeaders} mapped
                  </span>
                  {loadedId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                      saved
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAutoMatchAll(m.sourceTableName);
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded hover:bg-purple-50"
                >
                  Auto-match
                </button>
              </button>

              {/* Save/Load Toolbar */}
              {isExpanded && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/50 border-b border-slate-100">
                  {/* Load Saved */}
                  {tableSavedDSMs.length > 0 && (
                    <div className="flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                      <select
                        value={loadedId || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            onLoadDSM(m.sourceTableName, e.target.value);
                          }
                        }}
                        className="text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-600"
                      >
                        <option value="">Load saved...</option>
                        {tableSavedDSMs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex-1" />

                  {/* Update button (when loaded) */}
                  {loadedId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateDSM(m.sourceTableName);
                      }}
                      disabled={updatingDSM}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50"
                    >
                      {updatingDSM ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Pencil className="w-3 h-3" />
                      )}
                      Update
                    </button>
                  )}

                  {/* Delete button (when loaded) */}
                  {loadedId && (
                    <>
                      {confirmDelete === m.sourceTableName ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-red-600">Delete?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDSM(m.sourceTableName);
                              setConfirmDelete(null);
                            }}
                            disabled={deletingDSM}
                            className="text-[10px] text-red-600 font-bold px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(null);
                            }}
                            className="text-[10px] text-slate-500 font-bold px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(m.sourceTableName);
                          }}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </>
                  )}

                  {/* Save New */}
                  {!isSaveInputVisible ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSaveInput((prev) => new Set(prev).add(m.sourceTableName));
                        setSaveNameInputs((prev) =>
                          new Map(prev).set(
                            m.sourceTableName,
                            `${m.sourceTableName} CSV Mapping`,
                          ),
                        );
                      }}
                      disabled={mappedCount === 0}
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50 disabled:opacity-40"
                    >
                      <Save className="w-3 h-3" />
                      Save As
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={saveName}
                        onChange={(e) =>
                          setSaveNameInputs((prev) =>
                            new Map(prev).set(m.sourceTableName, e.target.value),
                          )
                        }
                        placeholder="Mapping name..."
                        className="text-xs px-2 py-1 rounded border border-green-300 bg-white w-40"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (saveName.trim()) {
                            onSaveDSM(m.sourceTableName, saveName.trim());
                            setShowSaveInput((prev) => {
                              const next = new Set(prev);
                              next.delete(m.sourceTableName);
                              return next;
                            });
                          }
                        }}
                        disabled={savingDSM || !saveName.trim()}
                        className="flex items-center gap-1 text-xs text-green-700 font-bold px-2 py-1 rounded bg-green-100 hover:bg-green-200 disabled:opacity-50"
                      >
                        {savingDSM ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Save
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSaveInput((prev) => {
                            const next = new Set(prev);
                            next.delete(m.sourceTableName);
                            return next;
                          });
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 px-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mapping rows */}
              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {csv.headers.map((header) => {
                    const mapped = tableMappings.find(
                      (tm) => tm.csvHeader === header,
                    );
                    const sampleValue = csv.sampleRows[0]?.[header] || '';

                    return (
                      <div
                        key={header}
                        className="flex items-center gap-3 px-4 py-2"
                      >
                        {/* CSV Header */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">
                            {header}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            e.g. {sampleValue || '(empty)'}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ArrowDown className="w-3.5 h-3.5 text-slate-300 rotate-[-90deg] flex-shrink-0" />

                        {/* Source column dropdown */}
                        <div className="flex-1">
                          <select
                            value={mapped?.sourceColumn || ''}
                            onChange={(e) =>
                              onMapHeader(
                                m.sourceTableName,
                                header,
                                e.target.value,
                              )
                            }
                            className={cn(
                              'w-full text-xs px-2 py-1.5 rounded border bg-white transition-colors',
                              mapped
                                ? 'border-green-300 text-green-800'
                                : 'border-slate-200 text-slate-500',
                            )}
                          >
                            <option value="">-- Skip --</option>
                            {sourceColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Status icon */}
                        <div className="w-5 flex-shrink-0">
                          {mapped ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Step 4: Verify Mapping Chain (CSV Header → Source → Target)
// ══════════════════════════════════════════════════════════════════════════════

function Step4VerifyChain({
  orderedMappings,
  csvFiles,
  dataSheetMappings,
  expandedTables,
  onToggleExpanded,
}: {
  orderedMappings: SavedColumnMapping[];
  csvFiles: Map<string, CSVUploadResult>;
  dataSheetMappings: Map<string, DataSheetMapping[]>;
  expandedTables: Set<string>;
  onToggleExpanded: (tableName: string) => void;
}) {
  // Build chain data for each table
  const chainData = useMemo(() => {
    return orderedMappings.map((m) => {
      const csv = csvFiles.get(m.sourceTableName);
      const dsm = dataSheetMappings.get(m.sourceTableName) || [];
      const colMappings = parseSavedMappings(m);

      // Build rows: CSV Header → Source Col → Target Col
      const chainRows: Array<{
        csvHeader: string;
        sampleValue: string;
        sourceColumn: string;
        targetColumn: string;
        transformation: string;
        targetType: string;
        status: 'complete' | 'partial' | 'unmapped';
      }> = [];

      // For each CSV header that has a data sheet mapping
      for (const ds of dsm) {
        const colMap = colMappings.find((c) => c.sourceColumn === ds.sourceColumn);
        const sampleValue = csv?.sampleRows[0]?.[ds.csvHeader] || '';

        chainRows.push({
          csvHeader: ds.csvHeader,
          sampleValue,
          sourceColumn: ds.sourceColumn,
          targetColumn: colMap?.targetColumn || '',
          transformation: colMap?.transformationType || 'direct',
          targetType: colMap?.targetDataType || colMap?.castTo || '',
          status: colMap ? 'complete' : 'partial',
        });
      }

      // CSV headers without mapping
      const unmappedHeaders = (csv?.headers || []).filter(
        (h) => !dsm.some((d) => d.csvHeader === h),
      );
      for (const h of unmappedHeaders) {
        chainRows.push({
          csvHeader: h,
          sampleValue: csv?.sampleRows[0]?.[h] || '',
          sourceColumn: '',
          targetColumn: '',
          transformation: '',
          targetType: '',
          status: 'unmapped',
        });
      }

      // Source columns mapped in DB but not linked from CSV
      const orphanedSourceCols = colMappings.filter(
        (c) => !dsm.some((d) => d.sourceColumn === c.sourceColumn),
      );

      const totalMapped = chainRows.filter((r) => r.status === 'complete').length;
      const totalPartial = chainRows.filter((r) => r.status === 'partial').length;
      const totalUnmapped = chainRows.filter((r) => r.status === 'unmapped').length;

      return {
        mapping: m,
        chainRows,
        orphanedSourceCols,
        totalMapped,
        totalPartial,
        totalUnmapped,
        csvFileName: csv?.originalName || '',
        rowCount: csv?.rowCount || 0,
      };
    });
  }, [orderedMappings, csvFiles, dataSheetMappings]);

  // Summary stats
  const totalTables = chainData.length;
  const totalComplete = chainData.reduce((s, d) => s + d.totalMapped, 0);
  const totalWarnings = chainData.reduce(
    (s, d) => s + d.totalPartial + d.totalUnmapped + d.orphanedSourceCols.length,
    0,
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Table2 className="w-4.5 h-4.5 text-purple-600" />
          Verify Mapping Chain
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Review the complete 3-level mapping: CSV Header &rarr; Source Column &rarr; Target Column.
          Ensure all columns are correctly mapped before generating scripts.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
          <p className="text-lg font-bold text-purple-700">{totalTables}</p>
          <p className="text-[10px] text-purple-500 uppercase font-medium">Tables</p>
        </div>
        <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-center">
          <p className="text-lg font-bold text-green-700">{totalComplete}</p>
          <p className="text-[10px] text-green-500 uppercase font-medium">Fully Mapped</p>
        </div>
        <div className={cn(
          'p-3 rounded-lg border text-center',
          totalWarnings > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100',
        )}>
          <p className={cn('text-lg font-bold', totalWarnings > 0 ? 'text-amber-700' : 'text-slate-500')}>
            {totalWarnings}
          </p>
          <p className={cn('text-[10px] uppercase font-medium', totalWarnings > 0 ? 'text-amber-500' : 'text-slate-400')}>
            Warnings
          </p>
        </div>
      </div>

      {/* Per-table chain tables */}
      <div className="space-y-3">
        {chainData.map((data) => {
          const isExpanded = expandedTables.has(`chain-${data.mapping.sourceTableName}`);

          return (
            <div
              key={data.mapping.id}
              className="border border-slate-200 rounded-lg overflow-hidden"
            >
              {/* Table header */}
              <button
                onClick={() => onToggleExpanded(`chain-${data.mapping.sourceTableName}`)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    {data.mapping.sourceTableName}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {data.mapping.targetTableName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({data.csvFileName}, {data.rowCount.toLocaleString()} rows)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    data.totalUnmapped === 0 && data.orphanedSourceCols.length === 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700',
                  )}>
                    {data.totalMapped}/{data.chainRows.length} mapped
                  </span>
                </div>
              </button>

              {/* Chain table */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-50 via-purple-50 to-green-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 w-8">
                          #
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-blue-700 border-b border-slate-200">
                          CSV Header
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">
                          Sample
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-400 border-b border-slate-200 w-8">
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-purple-700 border-b border-slate-200">
                          Source Column
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-400 border-b border-slate-200 w-24">
                          Transform
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-green-700 border-b border-slate-200">
                          Target Column
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.chainRows.map((row, idx) => {
                        const tc = TRANSFORM_COLORS[row.transformation] || TRANSFORM_COLORS.direct;

                        return (
                          <tr
                            key={idx}
                            className={cn(
                              'transition-colors',
                              row.status === 'unmapped'
                                ? 'bg-amber-50/50'
                                : row.status === 'partial'
                                  ? 'bg-yellow-50/30'
                                  : 'hover:bg-slate-50/50',
                            )}
                          >
                            <td className="px-3 py-2 text-slate-400 border-b border-slate-100">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium text-[11px]">
                                {row.csvHeader}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-400 border-b border-slate-100 max-w-[100px] truncate">
                              {row.sampleValue || '-'}
                            </td>
                            <td className="px-3 py-2 text-center border-b border-slate-100">
                              {row.sourceColumn ? (
                                <ArrowRight className="w-3.5 h-3.5 text-purple-400 mx-auto" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-amber-300 mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100">
                              {row.sourceColumn ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium text-[11px]">
                                  {row.sourceColumn}
                                </span>
                              ) : (
                                <span className="text-amber-500 italic">unmapped</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center border-b border-slate-100">
                              {row.transformation && (
                                <span className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 rounded font-medium text-[10px]',
                                  tc.bg,
                                  tc.text,
                                )}>
                                  {row.transformation}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100">
                              {row.targetColumn ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium text-[11px]">
                                  {row.targetColumn}
                                </span>
                              ) : row.sourceColumn ? (
                                <span className="text-amber-500 italic">no DB mapping</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-slate-400 border-b border-slate-100 text-[10px] uppercase">
                              {row.targetType}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Orphaned source columns (mapped in DB but not linked from CSV) */}
                      {data.orphanedSourceCols.map((oc, idx) => (
                        <tr key={`orphan-${idx}`} className="bg-red-50/30">
                          <td className="px-3 py-2 text-slate-400 border-b border-slate-100">
                            -
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100">
                            <span className="text-red-400 italic text-[11px]">no CSV header</span>
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100" />
                          <td className="px-3 py-2 text-center border-b border-slate-100">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-300 mx-auto" />
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium text-[11px]">
                              {oc.sourceColumn}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center border-b border-slate-100">
                            <span className={cn(
                              'inline-flex items-center px-1.5 py-0.5 rounded font-medium text-[10px]',
                              TRANSFORM_COLORS[oc.transformationType]?.bg || TRANSFORM_COLORS.direct.bg,
                              TRANSFORM_COLORS[oc.transformationType]?.text || TRANSFORM_COLORS.direct.text,
                            )}>
                              {oc.transformationType || 'direct'}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium text-[11px]">
                              {oc.targetColumn}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-400 border-b border-slate-100 text-[10px] uppercase">
                            {oc.targetDataType}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Warnings */}
                  {(data.totalUnmapped > 0 || data.orphanedSourceCols.length > 0) && (
                    <div className="p-3 bg-amber-50 border-t border-amber-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-700 space-y-0.5">
                          {data.totalUnmapped > 0 && (
                            <p>
                              {data.totalUnmapped} CSV header{data.totalUnmapped !== 1 ? 's' : ''} not mapped to source columns (will be skipped)
                            </p>
                          )}
                          {data.orphanedSourceCols.length > 0 && (
                            <p>
                              {data.orphanedSourceCols.length} source column{data.orphanedSourceCols.length !== 1 ? 's have' : ' has'} DB mapping but no CSV data
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Step 5: Configure & Preview
// ══════════════════════════════════════════════════════════════════════════════

function Step5Configure({
  batchSize,
  setBatchSize,
  targetDialect,
  setTargetDialect,
  disableFK,
  setDisableFK,
  includeTransaction,
  setIncludeTransaction,
  orderedMappings,
  csvFiles,
  dataSheetMappings,
}: {
  batchSize: number;
  setBatchSize: (v: number) => void;
  targetDialect: string;
  setTargetDialect: (v: string) => void;
  disableFK: boolean;
  setDisableFK: (v: boolean) => void;
  includeTransaction: boolean;
  setIncludeTransaction: (v: boolean) => void;
  orderedMappings: SavedColumnMapping[];
  csvFiles: Map<string, CSVUploadResult>;
  dataSheetMappings: Map<string, DataSheetMapping[]>;
}) {
  const totalRows = orderedMappings.reduce((sum, m) => {
    const csv = csvFiles.get(m.sourceTableName);
    return sum + (csv?.rowCount || 0);
  }, 0);

  const totalBatches = Math.ceil(totalRows / batchSize);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Settings2 className="w-4.5 h-4.5 text-purple-600" />
          Configure Script Generation
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Set batch size, target dialect, and other options before generating
          the migration script.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Target Dialect */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Target Dialect
          </label>
          <select
            value={targetDialect}
            onChange={(e) => setTargetDialect(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white"
          >
            {DATABASE_DIALECTS.filter((d) =>
              ['postgresql', 'mysql', 'oracle', 'sqlserver', 'mariadb'].includes(
                d.value,
              ),
            ).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Batch Size */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Batch Size
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={500}
              max={50000}
              step={500}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="flex-1 accent-purple-600"
            />
            <input
              type="number"
              min={100}
              max={100000}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(100, Number(e.target.value)))}
              className="w-24 text-sm px-2 py-1.5 rounded border border-slate-200 text-center"
            />
          </div>
        </div>

        {/* FK Constraints */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={disableFK}
            onChange={(e) => setDisableFK(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-purple-600 accent-purple-600"
          />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Disable FK Constraints
            </p>
            <p className="text-xs text-slate-400">
              Wraps script with FK disable/enable statements for faster inserts
            </p>
          </div>
        </label>

        {/* Transaction */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeTransaction}
            onChange={(e) => setIncludeTransaction(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-purple-600 accent-purple-600"
          />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Wrap Batches in Transactions
            </p>
            <p className="text-xs text-slate-400">
              Each batch will be wrapped in BEGIN/COMMIT for atomicity
            </p>
          </div>
        </label>
      </div>

      {/* Summary */}
      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-purple-500" />
          Migration Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Tables',
              value: orderedMappings.length,
              color: 'text-purple-600',
            },
            {
              label: 'Total Rows',
              value: `~${totalRows.toLocaleString()}`,
              color: 'text-blue-600',
            },
            {
              label: 'Batches',
              value: `~${totalBatches.toLocaleString()}`,
              color: 'text-amber-600',
            },
            {
              label: 'Dialect',
              value:
                DATABASE_DIALECTS.find((d) => d.value === targetDialect)
                  ?.label || targetDialect,
              color: 'text-green-600',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <p className={cn('text-lg font-bold', item.color)}>
                {item.value}
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Per-table breakdown */}
        <div className="mt-3 space-y-1">
          {orderedMappings.map((m, idx) => {
            const csv = csvFiles.get(m.sourceTableName);
            const dsm = dataSheetMappings.get(m.sourceTableName) || [];
            return (
              <div
                key={m.id}
                className="flex items-center gap-2 text-xs text-slate-600 py-1"
              >
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-medium">
                  {m.sourceTableName} &rarr; {m.targetTableName}
                </span>
                <span className="text-slate-400">
                  {csv?.rowCount.toLocaleString() || '?'} rows,{' '}
                  {dsm.length} header mappings
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Step 6: Generate & Download
// ══════════════════════════════════════════════════════════════════════════════

function Step6Generate({
  genStatus,
  generationJobId,
  projectId,
  onGenerate,
  generating,
}: {
  genStatus: ReturnType<typeof useGenerationStatus>['data'];
  generationJobId: string | null;
  projectId: string;
  onGenerate: () => void;
  generating: boolean;
}) {
  const isProcessing = genStatus?.status === 'processing';
  const isCompleted = genStatus?.status === 'completed';
  const isFailed = genStatus?.status === 'failed';

  const progressPercent =
    genStatus && genStatus.totalRowsEstimated > 0
      ? Math.round(
          (genStatus.rowsProcessed / genStatus.totalRowsEstimated) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Play className="w-4.5 h-4.5 text-purple-600" />
          Generate Migration Script
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Generate the batched INSERT script from your CSV data files.
        </p>
      </div>

      {!generationJobId && (
        <div className="text-center py-12">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-lg disabled:opacity-50 transition-all"
          >
            {generating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            Generate Migration Script
          </button>
        </div>
      )}

      {/* Processing */}
      {isProcessing && genStatus && (
        <div className="space-y-4 p-6 bg-purple-50 rounded-xl border border-purple-200">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <div>
              <p className="text-sm font-semibold text-purple-800">
                Generating Script...
              </p>
              <p className="text-xs text-purple-600">
                Processing table: {genStatus.currentTable || '...'} (
                {genStatus.tablesCompleted}/{genStatus.totalTables} tables)
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="w-full h-3 bg-purple-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-purple-600">
              <span>
                {genStatus.rowsProcessed.toLocaleString()} /{' '}
                {genStatus.totalRowsEstimated.toLocaleString()} rows
              </span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Completed */}
      {isCompleted && genStatus && (
        <div className="space-y-4">
          <div className="p-6 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Script Generated Successfully
                </p>
                <p className="text-xs text-green-600">
                  {genStatus.rowsProcessed.toLocaleString()} rows processed in{' '}
                  {((genStatus.generationTimeMs || 0) / 1000).toFixed(1)}s
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-2 bg-white rounded-lg text-center">
                <p className="text-lg font-bold text-green-700">
                  {genStatus.totalTables}
                </p>
                <p className="text-[10px] text-slate-500 uppercase">Tables</p>
              </div>
              <div className="p-2 bg-white rounded-lg text-center">
                <p className="text-lg font-bold text-green-700">
                  {genStatus.rowsProcessed.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 uppercase">Rows</p>
              </div>
              <div className="p-2 bg-white rounded-lg text-center">
                <p className="text-lg font-bold text-green-700">
                  {genStatus.fileSize
                    ? `${(genStatus.fileSize / 1024 / 1024).toFixed(1)}MB`
                    : '--'}
                </p>
                <p className="text-[10px] text-slate-500 uppercase">
                  File Size
                </p>
              </div>
            </div>

            {/* Per-table stats */}
            {genStatus.tableStats && genStatus.tableStats.length > 0 && (
              <div className="space-y-1 mb-4">
                {genStatus.tableStats.map((ts) => (
                  <div
                    key={ts.tableName}
                    className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded"
                  >
                    <span className="font-medium text-slate-700">
                      {ts.tableName}
                    </span>
                    <span className="text-slate-500">
                      {ts.rowCount.toLocaleString()} rows ({ts.batchCount}{' '}
                      batch{ts.batchCount !== 1 ? 'es' : ''})
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Download button */}
            {genStatus.outputFileName && (
              <a
                href={getDownloadURL(projectId, genStatus.outputFileName)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Migration Script
              </a>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Review the generated script carefully before executing it against
              your production database. Run it in a test environment first.
            </p>
          </div>
        </div>
      )}

      {/* Failed */}
      {isFailed && genStatus && (
        <div className="p-6 bg-red-50 rounded-xl border border-red-200">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="w-6 h-6 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Generation Failed
              </p>
              <p className="text-xs text-red-600">
                {genStatus.error || 'An unknown error occurred'}
              </p>
            </div>
          </div>
          <button
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default DataMigration;
