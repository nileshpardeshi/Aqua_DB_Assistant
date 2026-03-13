import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  columnMappingNodeTypes,
  columnMappingEdgeTypes,
  type ColumnMappingNodeData,
  type MappingEdgeData,
} from './column-mapping-nodes';

import { useTables, type Column } from '@/hooks/use-schema';
import {
  useSuggestColumnMapping,
  type AIColumnMappingSuggestion,
} from '@/hooks/use-column-mapping';
import {
  useColumnMappings,
  useCreateColumnMapping,
  useUpdateColumnMapping,
  useDeleteColumnMapping,
  type SavedColumnMapping,
} from '@/hooks/use-column-mappings';

import { cn } from '@/lib/utils';
import { downloadTextFile } from '@/lib/export-utils';
import { DATABASE_DIALECTS, getDialectDataTypes } from '@/config/constants';

import {
  Columns3,
  Wand2,
  Sparkles,
  Play,
  Download,
  Upload,
  Trash2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Copy,
  Check,
  Loader2,
  Database,
  FileCode2,
  Settings2,
  Zap,
  Plus,
  Save,
  FileUp,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ColumnMapping {
  id: string;
  sourceColumn: string;
  targetColumn: string;
  transformationType: 'direct' | 'cast' | 'expression' | 'default' | 'rename';
  expression?: string;
  castTo?: string;
  defaultValue?: string;
  nullHandling: 'pass' | 'default' | 'skip';
  isValid: boolean;
}

interface MappingConfiguration {
  sourceTable: string;
  targetTable: string;
  sourceDialect: string;
  targetDialect: string;
  mappings: ColumnMapping[];
  createdAt: string;
  version: string;
}

interface SavedMappingData {
  columnMappings: ColumnMapping[];
  sourceColumns: Column[];
  targetColumns: Column[];
}

interface ParsedTable {
  name: string;
  columns: Column[];
}

type SourceMode = 'project' | 'paste' | 'file';

// ── Constants ────────────────────────────────────────────────────────────────

const AI_STEPS = [
  'Analyzing columns',
  'Matching semantics',
  'Checking compatibility',
  'Building mappings',
];

const DIALECT_PATTERNS = [
  { pattern: /\bSERIAL\b|\bJSONB\b|\bBYTEA\b/i, dialect: 'postgresql' },
  { pattern: /\bAUTO_INCREMENT\b|\bENGINE\s*=/i, dialect: 'mysql' },
  { pattern: /\bIDENTITY\s*\(|\bNVARCHAR\s*\(\s*MAX\b/i, dialect: 'sqlserver' },
  { pattern: /\bVARCHAR2\b|\bNUMBER\s*\(/i, dialect: 'oracle' },
];

// ── DDL Parser (single table) ────────────────────────────────────────────────

function parseDDL(
  ddl: string
): ParsedTable | null {
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi;

  const match = tableRegex.exec(ddl);
  if (!match) return null;

  const tableName = match[1];
  const body = match[2];
  const columns: Column[] = [];
  const primaryKeyColumns = new Set<string>();

  const pkConstraintRegex =
    /(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/gi;
  let pkMatch: RegExpExecArray | null;
  while ((pkMatch = pkConstraintRegex.exec(body)) !== null) {
    const pkCols = pkMatch[1]
      .split(',')
      .map((c) => c.trim().replace(/["`]/g, ''));
    pkCols.forEach((col) => primaryKeyColumns.add(col.toLowerCase()));
  }

  const lines = body
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);

  let ordinal = 1;
  for (const line of lines) {
    if (
      /^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|INDEX|KEY|CONSTRAINT)\s/i.test(
        line
      )
    ) {
      continue;
    }

    const colRegex =
      /^["`]?(\w+)["`]?\s+([\w]+(?:\s*\([^)]*\))?(?:\s+(?:UNSIGNED|SIGNED|VARYING|PRECISION|WITHOUT\s+TIME\s+ZONE|WITH\s+TIME\s+ZONE))*)(.*)/i;
    const colMatch = colRegex.exec(line);
    if (!colMatch) continue;

    const colName = colMatch[1];
    const colType = colMatch[2].trim().toUpperCase();
    const rest = colMatch[3] || '';

    const isNotNull = /NOT\s+NULL/i.test(rest);
    const isInlinePK = /PRIMARY\s+KEY/i.test(rest);
    const isPK =
      isInlinePK || primaryKeyColumns.has(colName.toLowerCase());

    columns.push({
      id: `parsed-${tableName}-${colName}-${ordinal}`,
      name: colName,
      dataType: colType,
      nullable: !isNotNull && !isPK,
      isPrimaryKey: isPK,
      isForeignKey: false,
      isUnique: false,
      ordinalPosition: ordinal,
    });
    ordinal++;
  }

  for (const col of columns) {
    if (primaryKeyColumns.has(col.name.toLowerCase())) {
      col.isPrimaryKey = true;
      col.nullable = false;
    }
  }

  return columns.length > 0 ? { name: tableName, columns } : null;
}

// ── DDL Parser (all tables from SQL file) ────────────────────────────────────

function parseAllDDL(ddl: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi;

  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(ddl)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: Column[] = [];
    const primaryKeyColumns = new Set<string>();

    const pkConstraintRegex =
      /(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/gi;
    let pkMatch: RegExpExecArray | null;
    while ((pkMatch = pkConstraintRegex.exec(body)) !== null) {
      const pkCols = pkMatch[1].split(',').map((c) => c.trim().replace(/["`]/g, ''));
      pkCols.forEach((col) => primaryKeyColumns.add(col.toLowerCase()));
    }

    const lines = body.split(',').map((line) => line.trim()).filter(Boolean);
    let ordinal = 1;

    for (const line of lines) {
      if (/^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|INDEX|KEY|CONSTRAINT)\s/i.test(line)) continue;

      const colRegex =
        /^["`]?(\w+)["`]?\s+([\w]+(?:\s*\([^)]*\))?(?:\s+(?:UNSIGNED|SIGNED|VARYING|PRECISION|WITHOUT\s+TIME\s+ZONE|WITH\s+TIME\s+ZONE))*)(.*)/i;
      const colMatch = colRegex.exec(line);
      if (!colMatch) continue;

      const colName = colMatch[1];
      const colType = colMatch[2].trim().toUpperCase();
      const rest = colMatch[3] || '';

      const isNotNull = /NOT\s+NULL/i.test(rest);
      const isInlinePK = /PRIMARY\s+KEY/i.test(rest);
      const isPK = isInlinePK || primaryKeyColumns.has(colName.toLowerCase());

      columns.push({
        id: `parsed-${tableName}-${colName}-${ordinal}`,
        name: colName,
        dataType: colType,
        nullable: !isNotNull && !isPK,
        isPrimaryKey: isPK,
        isForeignKey: false,
        isUnique: false,
        ordinalPosition: ordinal,
      });
      ordinal++;
    }

    for (const col of columns) {
      if (primaryKeyColumns.has(col.name.toLowerCase())) {
        col.isPrimaryKey = true;
        col.nullable = false;
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
    }
  }

  return tables;
}

// ── Dialect Detection ────────────────────────────────────────────────────────

function detectDialectFromSQL(sql: string): string | null {
  for (const { pattern, dialect } of DIALECT_PATTERNS) {
    if (pattern.test(sql)) return dialect;
  }
  return null;
}

// ── Type Compatibility Checker ───────────────────────────────────────────────

function checkTypeCompatibility(
  sourceType: string,
  targetType: string
): boolean {
  const normalize = (t: string) =>
    t
      .toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .trim();

  const src = normalize(sourceType);
  const tgt = normalize(targetType);

  if (src === tgt) return true;

  const families: Record<string, string[]> = {
    numeric: [
      'int', 'integer', 'bigint', 'smallint', 'tinyint', 'mediumint',
      'serial', 'bigserial', 'smallserial', 'number', 'float', 'double',
      'real', 'decimal', 'numeric', 'money', 'smallmoney', 'bit',
      'int64', 'float64', 'float4', 'float8', 'byteint',
      'binary_float', 'binary_double', 'bignumeric', 'double precision',
    ],
    string: [
      'char', 'varchar', 'varchar2', 'nvarchar', 'nvarchar2', 'nchar',
      'text', 'tinytext', 'mediumtext', 'longtext', 'ntext', 'clob',
      'nclob', 'string',
    ],
    temporal: [
      'date', 'time', 'datetime', 'datetime2', 'timestamp', 'timestamptz',
      'smalldatetime', 'datetimeoffset', 'interval', 'year',
      'timestamp_ntz', 'timestamp_ltz', 'timestamp_tz',
    ],
    boolean: ['boolean', 'bool'],
    binary: [
      'binary', 'varbinary', 'blob', 'tinyblob', 'mediumblob',
      'longblob', 'bytea', 'raw', 'image', 'bytes',
    ],
    json: ['json', 'jsonb'],
    uuid: ['uuid', 'uniqueidentifier'],
  };

  const getFamily = (type: string): string | null => {
    for (const [family, types] of Object.entries(families)) {
      if (types.includes(type)) return family;
    }
    return null;
  };

  const srcFamily = getFamily(src);
  const tgtFamily = getFamily(tgt);

  if (srcFamily && tgtFamily && srcFamily === tgtFamily) return true;

  return false;
}

// ── Helper: parse saved mapping count ────────────────────────────────────────

function getSavedMappingCount(saved: SavedColumnMapping): number {
  try {
    const parsed = JSON.parse(saved.mappings);
    if (Array.isArray(parsed)) return parsed.length;
    return parsed.columnMappings?.length ?? 0;
  } catch {
    return 0;
  }
}

// ── Mode Button Component ────────────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
        active
          ? 'bg-purple-600 text-white border-purple-600'
          : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ── Inner Component ──────────────────────────────────────────────────────────

function ColumnMappingInner({ projectId }: { projectId: string }) {
  // ── Data selection state ─────────────────────────────────────────────────
  const { data: projectTables, isLoading: tablesLoading } =
    useTables(projectId);

  const [sourceMode, setSourceMode] = useState<SourceMode>('project');
  const [targetMode, setTargetMode] = useState<SourceMode>('project');

  const [sourceTableId, setSourceTableId] = useState('');
  const [targetTableId, setTargetTableId] = useState('');
  const [sourcePasteDDL, setSourcePasteDDL] = useState('');
  const [targetPasteDDL, setTargetPasteDDL] = useState('');
  const [sourceDialect, setSourceDialect] = useState('postgresql');
  const [targetDialect, setTargetDialect] = useState('mysql');

  // ── File upload state ──────────────────────────────────────────────────
  const [sourceFileTables, setSourceFileTables] = useState<ParsedTable[]>([]);
  const [targetFileTables, setTargetFileTables] = useState<ParsedTable[]>([]);
  const [sourceFileTableName, setSourceFileTableName] = useState('');
  const [targetFileTableName, setTargetFileTableName] = useState('');
  const sourceFileRef = useRef<HTMLInputElement>(null);
  const targetFileRef = useRef<HTMLInputElement>(null);

  // ── Mapping state ──────────────────────────────────────────────────────
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [sourceTable, setSourceTable] = useState<ParsedTable | null>(null);
  const [targetTable, setTargetTable] = useState<ParsedTable | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  // ── React Flow ─────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── UI state ───────────────────────────────────────────────────────────
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showTransformPanel, setShowTransformPanel] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [showSQLPanel, setShowSQLPanel] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ── Persistence state ──────────────────────────────────────────────────
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
  const [mappingName, setMappingName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // ── AI ─────────────────────────────────────────────────────────────────
  const suggestMapping = useSuggestColumnMapping();
  const [aiProgress, setAiProgress] = useState(-1);

  // ── Import ref ─────────────────────────────────────────────────────────
  const configFileRef = useRef<HTMLInputElement>(null);

  // ── Saved mappings hooks ───────────────────────────────────────────────
  const { data: savedMappings, isLoading: savedLoading } =
    useColumnMappings(projectId);
  const createMapping = useCreateColumnMapping();
  const updateMapping = useUpdateColumnMapping();
  const deleteMapping = useDeleteColumnMapping();

  // ── Copy handler ───────────────────────────────────────────────────────
  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  // ── File Upload Handlers ───────────────────────────────────────────────

  const handleSourceFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const sql = ev.target?.result as string;
        const tables = parseAllDDL(sql);
        setSourceFileTables(tables);
        setSourceFileTableName('');
        const detected = detectDialectFromSQL(sql);
        if (detected) setSourceDialect(detected);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    []
  );

  const handleTargetFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const sql = ev.target?.result as string;
        const tables = parseAllDDL(sql);
        setTargetFileTables(tables);
        setTargetFileTableName('');
        const detected = detectDialectFromSQL(sql);
        if (detected) setTargetDialect(detected);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    []
  );

  // ── Build Canvas ───────────────────────────────────────────────────────

  const buildCanvas = useCallback(() => {
    let resolvedSource: ParsedTable | null = null;
    let resolvedTarget: ParsedTable | null = null;

    // Resolve source
    if (sourceMode === 'project') {
      if (!projectTables) return;
      const srcT = projectTables.find((t) => t.id === sourceTableId);
      if (!srcT) return;
      resolvedSource = { name: srcT.name, columns: srcT.columns };
    } else if (sourceMode === 'paste') {
      resolvedSource = parseDDL(sourcePasteDDL);
    } else if (sourceMode === 'file') {
      resolvedSource =
        sourceFileTables.find((t) => t.name === sourceFileTableName) || null;
    }

    // Resolve target
    if (targetMode === 'project') {
      if (!projectTables) return;
      const tgtT = projectTables.find((t) => t.id === targetTableId);
      if (!tgtT) return;
      resolvedTarget = { name: tgtT.name, columns: tgtT.columns };
    } else if (targetMode === 'paste') {
      resolvedTarget = parseDDL(targetPasteDDL);
    } else if (targetMode === 'file') {
      resolvedTarget =
        targetFileTables.find((t) => t.name === targetFileTableName) || null;
    }

    if (!resolvedSource || !resolvedTarget) return;

    setSourceTable(resolvedSource);
    setTargetTable(resolvedTarget);

    const sourceNode: Node<ColumnMappingNodeData> = {
      id: 'source-table',
      type: 'sourceTable',
      position: { x: 50, y: 50 },
      data: {
        tableId: sourceTableId || 'source',
        tableName: resolvedSource.name,
        columns: resolvedSource.columns,
        mappedColumnNames: new Set<string>(),
      },
      draggable: false,
    };

    const targetNode: Node<ColumnMappingNodeData> = {
      id: 'target-table',
      type: 'targetTable',
      position: { x: 700, y: 50 },
      data: {
        tableId: targetTableId || 'target',
        tableName: resolvedTarget.name,
        columns: resolvedTarget.columns,
        mappedColumnNames: new Set<string>(),
      },
      draggable: false,
    };

    setNodes([sourceNode, targetNode]);
    setEdges([]);
    setMappings([]);
    setSelectedEdgeId(null);
    setShowTransformPanel(false);
    setCanvasReady(true);
  }, [
    sourceMode,
    targetMode,
    projectTables,
    sourceTableId,
    targetTableId,
    sourcePasteDDL,
    targetPasteDDL,
    sourceFileTables,
    targetFileTables,
    sourceFileTableName,
    targetFileTableName,
    setNodes,
    setEdges,
  ]);

  // ── Edge Building from Mappings ────────────────────────────────────────

  useEffect(() => {
    if (!sourceTable || !targetTable) return;

    const mappedSourceNames = new Set<string>();
    const mappedTargetNames = new Set<string>();

    const newEdges: Edge<MappingEdgeData>[] = mappings.map((mapping) => {
      mappedSourceNames.add(mapping.sourceColumn);
      mappedTargetNames.add(mapping.targetColumn);

      const srcCol = sourceTable.columns.find(
        (c) => c.name === mapping.sourceColumn
      );
      const tgtCol = targetTable.columns.find(
        (c) => c.name === mapping.targetColumn
      );

      return {
        id: mapping.id,
        source: 'source-table',
        target: 'target-table',
        sourceHandle: `source-${mapping.sourceColumn}`,
        targetHandle: `target-${mapping.targetColumn}`,
        type: 'mapping',
        data: {
          transformationType: mapping.transformationType,
          expression: mapping.expression,
          castTo: mapping.castTo,
          defaultValue: mapping.defaultValue,
          nullHandling: mapping.nullHandling,
          isValid: mapping.isValid,
          sourceType: srcCol?.dataType || '',
          targetType: tgtCol?.dataType || '',
          sourceColumn: mapping.sourceColumn,
          targetColumn: mapping.targetColumn,
          onEdgeClick: (edgeId: string) => {
            setSelectedEdgeId(edgeId);
            setShowTransformPanel(true);
          },
        },
      };
    });

    setEdges(newEdges);

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id === 'source-table') {
          return {
            ...node,
            data: {
              ...node.data,
              mappedColumnNames: new Set(mappedSourceNames),
            },
          };
        }
        if (node.id === 'target-table') {
          return {
            ...node,
            data: {
              ...node.data,
              mappedColumnNames: new Set(mappedTargetNames),
            },
          };
        }
        return node;
      })
    );
  }, [mappings, sourceTable, targetTable, setEdges, setNodes]);

  // ── onConnect Handler ──────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.sourceHandle ||
        !connection.targetHandle ||
        !sourceTable ||
        !targetTable
      )
        return;

      const srcColName = connection.sourceHandle.replace('source-', '');
      const tgtColName = connection.targetHandle.replace('target-', '');

      if (
        mappings.some(
          (m) =>
            m.sourceColumn === srcColName && m.targetColumn === tgtColName
        )
      )
        return;

      const filtered = mappings.filter(
        (m) => m.targetColumn !== tgtColName
      );

      const srcCol = sourceTable.columns.find(
        (c) => c.name === srcColName
      );
      const tgtCol = targetTable.columns.find(
        (c) => c.name === tgtColName
      );
      const isCompatible = checkTypeCompatibility(
        srcCol?.dataType || '',
        tgtCol?.dataType || ''
      );

      setMappings([
        ...filtered,
        {
          id: `${srcColName}->${tgtColName}`,
          sourceColumn: srcColName,
          targetColumn: tgtColName,
          transformationType: isCompatible ? 'direct' : 'cast',
          castTo: isCompatible ? undefined : tgtCol?.dataType,
          nullHandling: 'pass',
          isValid: isCompatible,
        },
      ]);
    },
    [mappings, sourceTable, targetTable]
  );

  // ── Auto-Map ───────────────────────────────────────────────────────────

  const handleAutoMap = useCallback(() => {
    if (!sourceTable || !targetTable) return;

    const newMappings: ColumnMapping[] = [];
    const usedTargets = new Set<string>();

    const normalizeName = (n: string) =>
      n.toLowerCase().replace(/_/g, '');

    for (const srcCol of sourceTable.columns) {
      let matchedTarget = targetTable.columns.find(
        (tc) =>
          tc.name.toLowerCase() === srcCol.name.toLowerCase() &&
          !usedTargets.has(tc.name)
      );

      if (!matchedTarget) {
        matchedTarget = targetTable.columns.find(
          (tc) =>
            normalizeName(tc.name) === normalizeName(srcCol.name) &&
            !usedTargets.has(tc.name)
        );
      }

      if (matchedTarget) {
        usedTargets.add(matchedTarget.name);
        const isCompatible = checkTypeCompatibility(
          srcCol.dataType,
          matchedTarget.dataType
        );
        const isRenamed =
          srcCol.name.toLowerCase() !== matchedTarget.name.toLowerCase();

        newMappings.push({
          id: `${srcCol.name}->${matchedTarget.name}`,
          sourceColumn: srcCol.name,
          targetColumn: matchedTarget.name,
          transformationType: isRenamed
            ? 'rename'
            : isCompatible
              ? 'direct'
              : 'cast',
          castTo:
            !isCompatible && !isRenamed ? matchedTarget.dataType : undefined,
          nullHandling: 'pass',
          isValid: isCompatible,
        });
      }
    }

    setMappings(newMappings);
  }, [sourceTable, targetTable]);

  // ── AI Suggest ─────────────────────────────────────────────────────────

  const handleAISuggest = useCallback(async () => {
    if (!sourceTable || !targetTable) return;

    setAiProgress(0);

    const interval = setInterval(() => {
      setAiProgress((prev) => {
        if (prev >= AI_STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 1200);

    try {
      const result = await suggestMapping.mutateAsync({
        projectId,
        sourceTable: {
          name: sourceTable.name,
          columns: sourceTable.columns.map((c) => ({
            name: c.name,
            dataType: c.dataType,
            nullable: c.nullable,
            isPrimaryKey: c.isPrimaryKey,
          })),
        },
        targetTable: {
          name: targetTable.name,
          columns: targetTable.columns.map((c) => ({
            name: c.name,
            dataType: c.dataType,
            nullable: c.nullable,
            isPrimaryKey: c.isPrimaryKey,
          })),
        },
        sourceDialect,
        targetDialect,
      });

      const aiMappings: ColumnMapping[] = result.mappings.map(
        (suggestion: AIColumnMappingSuggestion) => {
          const srcCol = sourceTable.columns.find(
            (c) => c.name === suggestion.sourceColumn
          );
          const tgtCol = targetTable.columns.find(
            (c) => c.name === suggestion.targetColumn
          );
          const isCompatible = checkTypeCompatibility(
            srcCol?.dataType || '',
            tgtCol?.dataType || ''
          );

          return {
            id: `${suggestion.sourceColumn}->${suggestion.targetColumn}`,
            sourceColumn: suggestion.sourceColumn,
            targetColumn: suggestion.targetColumn,
            transformationType: suggestion.transformationType as ColumnMapping['transformationType'],
            expression: suggestion.expression,
            castTo: suggestion.castTo,
            nullHandling: 'pass' as const,
            isValid: isCompatible,
          };
        }
      );

      setMappings(aiMappings);
    } catch {
      // Error handled by mutation state
    } finally {
      clearInterval(interval);
      setAiProgress(-1);
    }
  }, [
    sourceTable,
    targetTable,
    projectId,
    sourceDialect,
    targetDialect,
    suggestMapping,
  ]);

  // ── SQL Generation ─────────────────────────────────────────────────────

  const generateMigrationSQL = useCallback(() => {
    if (!sourceTable || !targetTable || mappings.length === 0) return;

    const targetCols: string[] = [];
    const selectExprs: string[] = [];
    const skipNullCols: string[] = [];

    for (const mapping of mappings) {
      targetCols.push(mapping.targetColumn);

      let expr: string;
      switch (mapping.transformationType) {
        case 'direct':
          expr =
            mapping.sourceColumn !== mapping.targetColumn
              ? `${mapping.sourceColumn} AS ${mapping.targetColumn}`
              : mapping.sourceColumn;
          break;
        case 'cast':
          expr = `CAST(${mapping.sourceColumn} AS ${mapping.castTo || 'TEXT'}) AS ${mapping.targetColumn}`;
          break;
        case 'expression':
          expr = mapping.expression
            ? `(${mapping.expression}) AS ${mapping.targetColumn}`
            : `${mapping.sourceColumn} AS ${mapping.targetColumn}`;
          break;
        case 'default':
          expr = `${mapping.defaultValue ?? 'NULL'} AS ${mapping.targetColumn}`;
          break;
        case 'rename':
          expr = `${mapping.sourceColumn} AS ${mapping.targetColumn}`;
          break;
        default:
          expr = mapping.sourceColumn;
      }

      if (
        mapping.nullHandling === 'default' &&
        mapping.defaultValue &&
        mapping.transformationType !== 'default'
      ) {
        expr = `COALESCE(${mapping.sourceColumn}, ${mapping.defaultValue}) AS ${mapping.targetColumn}`;
      } else if (mapping.nullHandling === 'skip') {
        skipNullCols.push(mapping.sourceColumn);
      }

      selectExprs.push(expr);
    }

    const timestamp = new Date().toISOString();
    const whereClause =
      skipNullCols.length > 0
        ? `WHERE ${skipNullCols.map((c) => `${c} IS NOT NULL`).join('\n  AND ')}`
        : '';

    const sql = [
      '-- Column Mapping Migration Script',
      '-- Generated by Aqua DB Copilot',
      `-- Source: ${sourceTable.name} (${sourceDialect}) -> Target: ${targetTable.name} (${targetDialect})`,
      `-- ${timestamp}`,
      '',
      `INSERT INTO ${targetTable.name} (`,
      targetCols.map((c) => `  ${c}`).join(',\n'),
      ')',
      'SELECT',
      selectExprs.map((e) => `  ${e}`).join(',\n'),
      `FROM ${sourceTable.name}`,
      whereClause,
    ]
      .filter(Boolean)
      .join('\n')
      .concat(';');

    setGeneratedSQL(sql);
    setShowSQLPanel(true);
  }, [mappings, sourceTable, targetTable, sourceDialect, targetDialect]);

  // ── Export / Import (JSON config) ──────────────────────────────────────

  const handleExport = useCallback(() => {
    if (!sourceTable || !targetTable) return;

    const config: MappingConfiguration = {
      sourceTable: sourceTable.name,
      targetTable: targetTable.name,
      sourceDialect,
      targetDialect,
      mappings,
      createdAt: new Date().toISOString(),
      version: '1.0',
    };

    downloadTextFile(
      JSON.stringify(config, null, 2),
      `column-mapping-${sourceTable.name}-${targetTable.name}.json`
    );
  }, [sourceTable, targetTable, sourceDialect, targetDialect, mappings]);

  const handleImportConfig = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(
            e.target?.result as string
          ) as MappingConfiguration;

          if (
            !config.mappings ||
            !Array.isArray(config.mappings) ||
            !config.sourceTable ||
            !config.targetTable
          ) {
            return;
          }

          const validMappings = config.mappings.filter(
            (m) =>
              m.id &&
              m.sourceColumn &&
              m.targetColumn &&
              m.transformationType &&
              m.nullHandling
          );

          if (validMappings.length > 0) {
            setMappings(validMappings);
            if (config.sourceDialect) setSourceDialect(config.sourceDialect);
            if (config.targetDialect) setTargetDialect(config.targetDialect);
          }
        } catch {
          // Invalid JSON
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    []
  );

  // ── Save / Load / Delete Mapping ───────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!sourceTable || !targetTable || mappings.length === 0) return;

    if (activeMappingId) {
      // Update existing
      const data: SavedMappingData = {
        columnMappings: mappings,
        sourceColumns: sourceTable.columns,
        targetColumns: targetTable.columns,
      };
      await updateMapping.mutateAsync({
        projectId,
        mappingId: activeMappingId,
        data: {
          name: mappingName || `${sourceTable.name} → ${targetTable.name}`,
          sourceTableName: sourceTable.name,
          targetTableName: targetTable.name,
          sourceDialect,
          targetDialect,
          mappings: JSON.stringify(data),
        },
      });
    } else {
      // Need a name — show dialog
      setShowSaveDialog(true);
    }
  }, [
    activeMappingId,
    sourceTable,
    targetTable,
    mappings,
    mappingName,
    sourceDialect,
    targetDialect,
    projectId,
    updateMapping,
  ]);

  const handleSaveWithName = useCallback(async () => {
    if (!mappingName.trim() || !sourceTable || !targetTable) return;

    const data: SavedMappingData = {
      columnMappings: mappings,
      sourceColumns: sourceTable.columns,
      targetColumns: targetTable.columns,
    };

    const result = await createMapping.mutateAsync({
      projectId,
      data: {
        name: mappingName,
        sourceTableName: sourceTable.name,
        targetTableName: targetTable.name,
        sourceDialect,
        targetDialect,
        mappings: JSON.stringify(data),
      },
    });

    setActiveMappingId(result.id);
    setShowSaveDialog(false);
  }, [
    mappingName,
    sourceTable,
    targetTable,
    mappings,
    sourceDialect,
    targetDialect,
    projectId,
    createMapping,
  ]);

  const loadSavedMapping = useCallback(
    (saved: SavedColumnMapping) => {
      setActiveMappingId(saved.id);
      setMappingName(saved.name);
      setSourceDialect(saved.sourceDialect);
      setTargetDialect(saved.targetDialect);

      let parsedData: SavedMappingData;
      try {
        const raw = JSON.parse(saved.mappings);
        if (Array.isArray(raw)) {
          // Legacy format — just column mappings, no column definitions
          parsedData = {
            columnMappings: raw,
            sourceColumns: [],
            targetColumns: [],
          };
        } else {
          parsedData = raw as SavedMappingData;
        }
      } catch {
        return;
      }

      // Try project tables first, fall back to saved column definitions
      let srcColumns = parsedData.sourceColumns;
      let tgtColumns = parsedData.targetColumns;

      if (projectTables) {
        const projSrc = projectTables.find(
          (t) => t.name === saved.sourceTableName
        );
        if (projSrc && projSrc.columns.length > 0) {
          srcColumns = projSrc.columns;
        }
        const projTgt = projectTables.find(
          (t) => t.name === saved.targetTableName
        );
        if (projTgt && projTgt.columns.length > 0) {
          tgtColumns = projTgt.columns;
        }
      }

      // If we still have no columns, reconstruct from mappings
      if (srcColumns.length === 0) {
        srcColumns = parsedData.columnMappings.map((m, i) => ({
          id: `saved-src-${m.sourceColumn}-${i}`,
          name: m.sourceColumn,
          dataType: 'UNKNOWN',
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
          ordinalPosition: i + 1,
        }));
      }
      if (tgtColumns.length === 0) {
        tgtColumns = parsedData.columnMappings.map((m, i) => ({
          id: `saved-tgt-${m.targetColumn}-${i}`,
          name: m.targetColumn,
          dataType: 'UNKNOWN',
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: false,
          ordinalPosition: i + 1,
        }));
      }

      const src: ParsedTable = {
        name: saved.sourceTableName,
        columns: srcColumns,
      };
      const tgt: ParsedTable = {
        name: saved.targetTableName,
        columns: tgtColumns,
      };

      setSourceTable(src);
      setTargetTable(tgt);

      const sourceNode: Node<ColumnMappingNodeData> = {
        id: 'source-table',
        type: 'sourceTable',
        position: { x: 50, y: 50 },
        data: {
          tableId: 'source',
          tableName: src.name,
          columns: src.columns,
          mappedColumnNames: new Set<string>(),
        },
        draggable: false,
      };

      const targetNode: Node<ColumnMappingNodeData> = {
        id: 'target-table',
        type: 'targetTable',
        position: { x: 700, y: 50 },
        data: {
          tableId: 'target',
          tableName: tgt.name,
          columns: tgt.columns,
          mappedColumnNames: new Set<string>(),
        },
        draggable: false,
      };

      setNodes([sourceNode, targetNode]);
      setMappings(parsedData.columnMappings);
      setSelectedEdgeId(null);
      setShowTransformPanel(false);
      setGeneratedSQL('');
      setShowSQLPanel(false);
      setCanvasReady(true);
    },
    [projectTables, setNodes]
  );

  const handleDeleteMapping = useCallback(
    async (id: string) => {
      await deleteMapping.mutateAsync({ projectId, mappingId: id });
      if (activeMappingId === id) {
        setActiveMappingId(null);
        setMappingName('');
        setCanvasReady(false);
        setMappings([]);
        setSourceTable(null);
        setTargetTable(null);
        setNodes([]);
        setEdges([]);
        setSelectedEdgeId(null);
        setShowTransformPanel(false);
        setGeneratedSQL('');
        setShowSQLPanel(false);
      }
    },
    [activeMappingId, projectId, deleteMapping, setNodes, setEdges]
  );

  const handleNewMapping = useCallback(() => {
    setActiveMappingId(null);
    setMappingName('');
    setCanvasReady(false);
    setMappings([]);
    setSourceTable(null);
    setTargetTable(null);
    setNodes([]);
    setEdges([]);
    setSelectedEdgeId(null);
    setShowTransformPanel(false);
    setGeneratedSQL('');
    setShowSQLPanel(false);
  }, [setNodes, setEdges]);

  // ── Clear all mappings (keep tables) ───────────────────────────────────

  const handleClearAll = useCallback(() => {
    setMappings([]);
    setSelectedEdgeId(null);
    setShowTransformPanel(false);
    setGeneratedSQL('');
    setShowSQLPanel(false);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────

  const unmappedSourceCount = useMemo(() => {
    if (!sourceTable) return 0;
    const mappedSources = new Set(mappings.map((m) => m.sourceColumn));
    return sourceTable.columns.filter((c) => !mappedSources.has(c.name))
      .length;
  }, [sourceTable, mappings]);

  const unmappedTargetCount = useMemo(() => {
    if (!targetTable) return 0;
    const mappedTargets = new Set(mappings.map((m) => m.targetColumn));
    return targetTable.columns.filter((c) => !mappedTargets.has(c.name))
      .length;
  }, [targetTable, mappings]);

  const selectedMapping = useMemo(
    () => mappings.find((m) => m.id === selectedEdgeId) ?? null,
    [mappings, selectedEdgeId]
  );

  const canLoadSource =
    (sourceMode === 'project' && !!sourceTableId) ||
    (sourceMode === 'paste' && !!sourcePasteDDL.trim()) ||
    (sourceMode === 'file' && !!sourceFileTableName);

  const canLoadTarget =
    (targetMode === 'project' && !!targetTableId) ||
    (targetMode === 'paste' && !!targetPasteDDL.trim()) ||
    (targetMode === 'file' && !!targetFileTableName);

  const canLoad = canLoadSource && canLoadTarget;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-4">
      {/* ── Saved Mappings Sidebar ── */}
      <aside
        className="w-72 shrink-0 bg-card border border-border rounded-xl overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-foreground">
              Saved Mappings
            </h3>
            <button
              onClick={handleNewMapping}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Save and manage multiple table-pair mappings
          </p>
        </div>

        <div className="p-3 space-y-2">
          {savedLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : !savedMappings || savedMappings.length === 0 ? (
            <div className="text-center py-8 px-2">
              <Columns3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No saved mappings yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Create a mapping and save it to see it here
              </p>
            </div>
          ) : (
            savedMappings.map((sm) => (
              <div
                key={sm.id}
                onClick={() => loadSavedMapping(sm)}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-colors group',
                  activeMappingId === sm.id
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {sm.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMapping(sm.id);
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span className="truncate max-w-[80px]">
                    {sm.sourceTableName}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate max-w-[80px]">
                    {sm.targetTableName}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                    {sm.sourceDialect}
                  </span>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                    {sm.targetDialect}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {getSavedMappingCount(sm)} cols
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(sm.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Columns3 className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-foreground">
              Column Mapping
            </h2>
            {activeMappingId && mappingName && (
              <span className="text-sm text-purple-600 font-medium ml-2">
                — {mappingName}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Visually map columns between source and target tables with
            drag-to-connect. Upload SQL files, use project tables, or paste
            DDL. Save mappings for reuse.
          </p>
        </div>

        {/* Table Selection Section */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Source Side ── */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Source
              </h4>
              <div className="flex items-center gap-1 flex-wrap">
                <ModeButton
                  active={sourceMode === 'project'}
                  onClick={() => setSourceMode('project')}
                  icon={Database}
                  label="Project"
                />
                <ModeButton
                  active={sourceMode === 'paste'}
                  onClick={() => setSourceMode('paste')}
                  icon={FileCode2}
                  label="Paste DDL"
                />
                <ModeButton
                  active={sourceMode === 'file'}
                  onClick={() => setSourceMode('file')}
                  icon={FileUp}
                  label="Upload File"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Source Dialect
                </label>
                <select
                  value={sourceDialect}
                  onChange={(e) => setSourceDialect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {DATABASE_DIALECTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {sourceMode === 'project' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Source Table
                  </label>
                  <select
                    value={sourceTableId}
                    onChange={(e) => setSourceTableId(e.target.value)}
                    disabled={tablesLoading}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">
                      {tablesLoading
                        ? 'Loading tables...'
                        : 'Select source table'}
                    </option>
                    {projectTables?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.schema ? `${t.schema}.` : ''}
                        {t.name} ({t.columns.length} cols)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sourceMode === 'paste' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Source DDL
                  </label>
                  <textarea
                    value={sourcePasteDDL}
                    onChange={(e) => setSourcePasteDDL(e.target.value)}
                    placeholder={`CREATE TABLE users (\n  id INT NOT NULL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255)\n);`}
                    className="w-full h-32 px-3 py-2.5 bg-[#1e293b] text-slate-100 font-mono text-sm rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y placeholder:text-muted-foreground"
                    spellCheck={false}
                  />
                </div>
              )}

              {sourceMode === 'file' && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".sql,.txt,.ddl"
                    onChange={handleSourceFileUpload}
                    ref={sourceFileRef}
                    className="hidden"
                  />
                  <button
                    onClick={() => sourceFileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors w-full justify-center"
                  >
                    <Upload className="w-4 h-4" />
                    {sourceFileTables.length > 0
                      ? `${sourceFileTables.length} tables found — click to re-upload`
                      : 'Upload SQL file'}
                  </button>
                  {sourceFileTables.length > 0 && (
                    <select
                      value={sourceFileTableName}
                      onChange={(e) =>
                        setSourceFileTableName(e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select table from file...</option>
                      {sourceFileTables.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.columns.length} cols)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* ── Target Side ── */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Target
              </h4>
              <div className="flex items-center gap-1 flex-wrap">
                <ModeButton
                  active={targetMode === 'project'}
                  onClick={() => setTargetMode('project')}
                  icon={Database}
                  label="Project"
                />
                <ModeButton
                  active={targetMode === 'paste'}
                  onClick={() => setTargetMode('paste')}
                  icon={FileCode2}
                  label="Paste DDL"
                />
                <ModeButton
                  active={targetMode === 'file'}
                  onClick={() => setTargetMode('file')}
                  icon={FileUp}
                  label="Upload File"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Target Dialect
                </label>
                <select
                  value={targetDialect}
                  onChange={(e) => setTargetDialect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {DATABASE_DIALECTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {targetMode === 'project' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Target Table
                  </label>
                  <select
                    value={targetTableId}
                    onChange={(e) => setTargetTableId(e.target.value)}
                    disabled={tablesLoading}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">
                      {tablesLoading
                        ? 'Loading tables...'
                        : 'Select target table'}
                    </option>
                    {projectTables?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.schema ? `${t.schema}.` : ''}
                        {t.name} ({t.columns.length} cols)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetMode === 'paste' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Target DDL
                  </label>
                  <textarea
                    value={targetPasteDDL}
                    onChange={(e) => setTargetPasteDDL(e.target.value)}
                    placeholder={`CREATE TABLE customers (\n  customer_id BIGINT NOT NULL PRIMARY KEY,\n  full_name VARCHAR(500) NOT NULL,\n  email_address VARCHAR(320)\n);`}
                    className="w-full h-32 px-3 py-2.5 bg-[#1e293b] text-slate-100 font-mono text-sm rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y placeholder:text-muted-foreground"
                    spellCheck={false}
                  />
                </div>
              )}

              {targetMode === 'file' && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".sql,.txt,.ddl"
                    onChange={handleTargetFileUpload}
                    ref={targetFileRef}
                    className="hidden"
                  />
                  <button
                    onClick={() => targetFileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors w-full justify-center"
                  >
                    <Upload className="w-4 h-4" />
                    {targetFileTables.length > 0
                      ? `${targetFileTables.length} tables found — click to re-upload`
                      : 'Upload SQL file'}
                  </button>
                  {targetFileTables.length > 0 && (
                    <select
                      value={targetFileTableName}
                      onChange={(e) =>
                        setTargetFileTableName(e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select table from file...</option>
                      {targetFileTables.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.columns.length} cols)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Load Tables Button */}
          <button
            onClick={buildCanvas}
            disabled={!canLoad}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              canLoad
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Zap className="w-4 h-4" />
            Load Tables
          </button>
        </div>

        {/* Action Toolbar */}
        {canvasReady && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAutoMap}
              className="inline-flex items-center gap-1.5 border border-border hover:bg-muted/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Auto-Map
            </button>
            <button
              onClick={handleAISuggest}
              disabled={aiProgress >= 0}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                aiProgress >= 0
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white'
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Suggest
            </button>

            <div className="w-px h-6 bg-border" />

            <button
              onClick={generateMigrationSQL}
              disabled={mappings.length === 0}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                mappings.length > 0
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Play className="w-3.5 h-3.5" />
              Generate SQL
            </button>

            <button
              onClick={handleSave}
              disabled={
                mappings.length === 0 ||
                createMapping.isPending ||
                updateMapping.isPending
              }
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                mappings.length > 0
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {createMapping.isPending || updateMapping.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {activeMappingId ? 'Update' : 'Save'}
            </button>

            <div className="w-px h-6 bg-border" />

            <button
              onClick={handleExport}
              disabled={mappings.length === 0}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                mappings.length > 0
                  ? 'border border-border hover:bg-muted/50 text-foreground'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => configFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 border border-border hover:bg-muted/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <input
              ref={configFileRef}
              type="file"
              accept=".json"
              onChange={handleImportConfig}
              className="hidden"
            />

            <div className="w-px h-6 bg-border" />

            <button
              onClick={handleClearAll}
              disabled={mappings.length === 0}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                mappings.length > 0
                  ? 'border border-red-200 hover:bg-red-50 text-red-600'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>

            <div className="ml-auto">
              <span className="text-sm text-muted-foreground">
                Mapped: {mappings.length} /{' '}
                {targetTable?.columns.length ?? 0}
              </span>
            </div>
          </div>
        )}

        {/* AI Progress Stepper */}
        {aiProgress >= 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
              <span className="text-sm font-medium">AI Column Mapping</span>
            </div>
            <div className="flex items-center gap-2">
              {AI_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                      i < aiProgress
                        ? 'bg-purple-100 text-purple-700'
                        : i === aiProgress
                          ? 'bg-purple-600 text-white animate-pulse'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {i < aiProgress ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs',
                      i === aiProgress
                        ? 'text-purple-700 font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step}
                  </span>
                  {i < AI_STEPS.length - 1 && (
                    <div className="w-6 h-px bg-border" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        {canvasReady && (
          <div
            className="relative border border-border rounded-xl overflow-hidden"
            style={{ height: 'calc(100vh - 420px)', minHeight: '500px' }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setShowTransformPanel(true);
              }}
              nodeTypes={columnMappingNodeTypes}
              edgeTypes={columnMappingEdgeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.3}
              maxZoom={1.5}
              connectionLineStyle={{
                stroke: '#8b5cf6',
                strokeWidth: 2,
              }}
              connectionLineType={ConnectionLineType.SmoothStep}
              defaultEdgeOptions={{ type: 'mapping' }}
              proOptions={{ hideAttribution: true }}
              snapToGrid
              snapGrid={[10, 10]}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="#e2e8f0"
              />
              <Controls
                showInteractive={false}
                className="!shadow-md !rounded-lg !border !border-border"
              />
            </ReactFlow>

            {/* Transformation Panel */}
            {showTransformPanel && selectedEdgeId && selectedMapping && (
              <TransformPanel
                mapping={selectedMapping}
                sourceTable={sourceTable}
                targetTable={targetTable}
                targetDialect={targetDialect}
                onClose={() => {
                  setSelectedEdgeId(null);
                  setShowTransformPanel(false);
                }}
                onUpdate={(updated) => {
                  setMappings((prev) =>
                    prev.map((m) =>
                      m.id === selectedEdgeId ? updated : m
                    )
                  );
                }}
                onRemove={() => {
                  setMappings((prev) =>
                    prev.filter((m) => m.id !== selectedEdgeId)
                  );
                  setSelectedEdgeId(null);
                  setShowTransformPanel(false);
                }}
              />
            )}

            {/* Unmapped columns summary */}
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-sm">
              <div className="flex items-center gap-3 text-xs">
                {unmappedSourceCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    {unmappedSourceCount} unmapped source
                  </span>
                )}
                {unmappedTargetCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    {unmappedTargetCount} unmapped target
                  </span>
                )}
                {unmappedSourceCount === 0 && unmappedTargetCount === 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    All columns mapped
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Not loaded state */}
        {!canvasReady && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <Columns3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              Select source and target tables to start mapping columns
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Choose tables from your project schema, paste DDL, or upload
              SQL files, then click "Load Tables"
            </p>
          </div>
        )}

        {/* SQL Output Panel */}
        {showSQLPanel && generatedSQL && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-purple-600" />
                Generated Migration SQL
              </h3>
              <button
                onClick={() => setShowSQLPanel(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <pre className="bg-[#1e293b] text-slate-100 font-mono text-sm p-4 rounded-lg overflow-auto max-h-[300px] whitespace-pre-wrap">
              {generatedSQL}
            </pre>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(generatedSQL, 'sql')}
                className="inline-flex items-center gap-1.5 border border-border hover:bg-muted/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                {copiedField === 'sql' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={() =>
                  downloadTextFile(
                    generatedSQL,
                    `migration-${sourceTable?.name ?? 'source'}-to-${targetTable?.name ?? 'target'}.sql`
                  )
                }
                className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download .sql
              </button>
              <button
                onClick={() => setShowSQLPanel(false)}
                className="inline-flex items-center gap-1.5 border border-border hover:bg-muted/50 text-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-foreground">
              Save Column Mapping
            </h3>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Mapping Name
              </label>
              <input
                type="text"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder={`e.g., ${sourceTable?.name ?? 'source'} → ${targetTable?.name ?? 'target'} migration`}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mappingName.trim()) {
                    handleSaveWithName();
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWithName}
                disabled={
                  !mappingName.trim() || createMapping.isPending
                }
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors',
                  mappingName.trim()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                {createMapping.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transformation Panel Component ───────────────────────────────────────────

interface TransformPanelProps {
  mapping: ColumnMapping;
  sourceTable: ParsedTable | null;
  targetTable: ParsedTable | null;
  targetDialect: string;
  onClose: () => void;
  onUpdate: (mapping: ColumnMapping) => void;
  onRemove: () => void;
}

function TransformPanel({
  mapping,
  sourceTable,
  targetTable,
  targetDialect,
  onClose,
  onUpdate,
  onRemove,
}: TransformPanelProps) {
  const [localMapping, setLocalMapping] = useState<ColumnMapping>(mapping);

  useEffect(() => {
    setLocalMapping(mapping);
  }, [mapping]);

  const srcCol = sourceTable?.columns.find(
    (c) => c.name === mapping.sourceColumn
  );
  const tgtCol = targetTable?.columns.find(
    (c) => c.name === mapping.targetColumn
  );

  const targetDataTypes = getDialectDataTypes(targetDialect);

  const transformTypes: {
    value: ColumnMapping['transformationType'];
    label: string;
  }[] = [
    { value: 'direct', label: 'Direct' },
    { value: 'cast', label: 'Cast' },
    { value: 'expression', label: 'Expr' },
    { value: 'default', label: 'Default' },
    { value: 'rename', label: 'Rename' },
  ];

  const handleApply = () => {
    const isValid = checkTypeCompatibility(
      srcCol?.dataType || '',
      localMapping.castTo || tgtCol?.dataType || ''
    );
    onUpdate({
      ...localMapping,
      isValid:
        localMapping.transformationType === 'direct'
          ? checkTypeCompatibility(
              srcCol?.dataType || '',
              tgtCol?.dataType || ''
            )
          : localMapping.transformationType === 'cast'
            ? true
            : localMapping.transformationType === 'expression'
              ? !!localMapping.expression
              : localMapping.transformationType === 'default'
                ? true
                : isValid,
    });
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-xl z-10 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-foreground">
            Configure Mapping
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Source column badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
            {mapping.sourceColumn}
            <span className="text-purple-500 font-mono text-[10px]">
              {srcCol?.dataType ?? ''}
            </span>
          </span>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-cyan-100 text-cyan-700 rounded-full">
            {mapping.targetColumn}
            <span className="text-cyan-500 font-mono text-[10px]">
              {tgtCol?.dataType ?? ''}
            </span>
          </span>
        </div>

        <hr className="border-border" />

        {/* Transformation Type */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">
            Transformation Type
          </label>
          <div className="flex flex-wrap gap-1">
            {transformTypes.map((tt) => (
              <button
                key={tt.value}
                onClick={() =>
                  setLocalMapping((prev) => ({
                    ...prev,
                    transformationType: tt.value,
                  }))
                }
                className={cn(
                  'px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors',
                  localMapping.transformationType === tt.value
                    ? 'bg-purple-600 text-white'
                    : 'border border-border text-muted-foreground hover:bg-muted/50'
                )}
              >
                {tt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional fields based on transformationType */}
        {localMapping.transformationType === 'cast' && (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Cast To
            </label>
            <select
              value={localMapping.castTo || ''}
              onChange={(e) =>
                setLocalMapping((prev) => ({
                  ...prev,
                  castTo: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select data type</option>
              {targetDataTypes.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
        )}

        {localMapping.transformationType === 'expression' && (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              SQL Expression
            </label>
            <textarea
              value={localMapping.expression || ''}
              onChange={(e) =>
                setLocalMapping((prev) => ({
                  ...prev,
                  expression: e.target.value,
                }))
              }
              placeholder={`e.g., UPPER(${mapping.sourceColumn})`}
              className="w-full h-24 px-3 py-2.5 bg-[#1e293b] text-slate-100 font-mono text-sm rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y placeholder:text-muted-foreground"
              spellCheck={false}
            />
          </div>
        )}

        {localMapping.transformationType === 'default' && (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Default Value
            </label>
            <input
              type="text"
              value={localMapping.defaultValue || ''}
              onChange={(e) =>
                setLocalMapping((prev) => ({
                  ...prev,
                  defaultValue: e.target.value,
                }))
              }
              placeholder="e.g., 'unknown' or 0"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}

        {localMapping.transformationType === 'rename' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Column renamed from{' '}
              <strong className="font-mono">
                {mapping.sourceColumn}
              </strong>{' '}
              to{' '}
              <strong className="font-mono">
                {mapping.targetColumn}
              </strong>
            </span>
          </div>
        )}

        <hr className="border-border" />

        {/* Null Handling */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">
            Null Handling
          </label>
          <div className="space-y-2">
            {(
              [
                { value: 'pass', label: 'Pass through' },
                { value: 'default', label: 'Use default' },
                { value: 'skip', label: 'Skip row' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="null-handling"
                  value={opt.value}
                  checked={localMapping.nullHandling === opt.value}
                  onChange={() =>
                    setLocalMapping((prev) => ({
                      ...prev,
                      nullHandling: opt.value,
                    }))
                  }
                  className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs text-foreground">{opt.label}</span>
              </label>
            ))}
          </div>

          {localMapping.nullHandling === 'default' && (
            <div className="mt-2">
              <input
                type="text"
                value={localMapping.defaultValue || ''}
                onChange={(e) =>
                  setLocalMapping((prev) => ({
                    ...prev,
                    defaultValue: e.target.value,
                  }))
                }
                placeholder="Default value for NULLs"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* Validation indicator */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">
            Validation
          </label>
          {checkTypeCompatibility(
            srcCol?.dataType || '',
            tgtCol?.dataType || ''
          ) ? (
            <div className="flex items-center gap-2 text-green-600 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">Compatible</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600 text-xs">
              <XCircle className="w-4 h-4" />
              <span className="font-medium">
                Type mismatch &mdash; cast recommended
              </span>
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* Footer buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Apply
          </button>
          <button
            onClick={onRemove}
            className="inline-flex items-center justify-center gap-1.5 border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Wrapper Component (exported) ─────────────────────────────────────────────

export function ColumnMapping({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <ColumnMappingInner projectId={projectId} />
    </ReactFlowProvider>
  );
}
