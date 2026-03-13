import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Database,
  Play,
  Columns3,
  Shuffle,
  TrendingUp,
  Hash,
  Coffee,
  Copy,
  Download,
  Check,
  AlertTriangle,
  Link2,
  ChevronDown,
  ChevronRight,
  Layers,
  Table2,
  Lock,
  FileText,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTables, useRelationships, type Table, type Column } from '@/hooks/use-schema';
import { DatagenTestPanel } from './datagen-test-panel';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParamFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  width?: string;
}

interface GeneratorDef {
  name: string;
  javaExpression?: string;
  params?: ParamFieldDef[];
}

interface GeneratorCategory {
  label: string;
  generators: GeneratorDef[];
}

interface ColumnConfig {
  name: string;
  type: string;
  generator: string;
  params: Record<string, string>;
  isConstant?: boolean;
  constantValue?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

interface TableConfig {
  tableName: string;
  tableId?: string;
  rowCount: number;
  columns: ColumnConfig[];
  expanded: boolean;
}

type Distribution = 'random' | 'sequential' | 'realistic';
type GenerationMode = 'single' | 'multi';
type ScriptStyle = 'bulk' | 'individual';

// ── Constants ────────────────────────────────────────────────────────────────

const ROW_COUNT_PRESETS = [
  { label: '100', value: 100 },
  { label: '1K', value: 1000 },
  { label: '10K', value: 10000 },
  { label: '100K', value: 100000 },
  { label: '1M', value: 1000000 },
];

const DISTRIBUTION_OPTIONS: { value: Distribution; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: 'random', label: 'Random', icon: Shuffle, description: 'Uniformly random values' },
  { value: 'sequential', label: 'Sequential', icon: TrendingUp, description: 'Ordered / incremental' },
  { value: 'realistic', label: 'Realistic', icon: Database, description: 'Natural-looking data' },
];

// ── Generator Registry ───────────────────────────────────────────────────────

const GENERATOR_CATEGORIES: GeneratorCategory[] = [
  {
    label: 'Core',
    generators: [
      { name: 'Auto Detect' },
      { name: 'Static Value', params: [
        { key: 'value', label: 'Value', type: 'text', placeholder: 'Enter fixed value...' },
      ]},
      { name: 'Null' },
      { name: 'Sequence', params: [
        { key: 'start', label: 'Start', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-16' },
        { key: 'step', label: 'Step', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-16' },
      ]},
      { name: 'Boolean' },
    ],
  },
  {
    label: 'FK Reference',
    generators: [
      // FK Reference has NO static params — rendered via custom dropdown UI
      { name: 'FK Reference' },
    ],
  },
  {
    label: 'Identity',
    generators: [
      { name: 'UUID', javaExpression: 'UUID.randomUUID().toString()' },
      { name: 'Incremental ID' },
      { name: 'ULID' },
    ],
  },
  {
    label: 'Numbers',
    generators: [
      { name: 'Random Integer', javaExpression: 'ThreadLocalRandom.current().nextInt(min, max + 1)', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0', defaultValue: '0', width: 'w-20' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '100', defaultValue: '100', width: 'w-20' },
      ]},
      { name: 'Random Float', javaExpression: 'ThreadLocalRandom.current().nextFloat()', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0.0', defaultValue: '0', width: 'w-16' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '1.0', defaultValue: '1', width: 'w-16' },
        { key: 'precision', label: 'Decimals', type: 'number', placeholder: '2', defaultValue: '2', width: 'w-14' },
      ]},
      { name: 'Gaussian', javaExpression: 'new Random().nextGaussian() * stdDev + mean', params: [
        { key: 'mean', label: 'Mean', type: 'number', placeholder: '0', defaultValue: '0', width: 'w-16' },
        { key: 'stddev', label: 'StdDev', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-16' },
      ]},
      { name: 'Currency', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-20' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '999', defaultValue: '999', width: 'w-20' },
        { key: 'symbol', label: 'Symbol', type: 'text', placeholder: '$', defaultValue: '$', width: 'w-12' },
      ]},
      { name: 'BigDecimal', javaExpression: 'BigDecimal.valueOf(random * max).setScale(scale)', params: [
        { key: 'max', label: 'Max', type: 'number', placeholder: '10000', defaultValue: '10000', width: 'w-20' },
        { key: 'scale', label: 'Scale', type: 'number', placeholder: '2', defaultValue: '2', width: 'w-14' },
      ]},
    ],
  },
  {
    label: 'Strings',
    generators: [
      { name: 'Random String', params: [
        { key: 'length', label: 'Length', type: 'number', placeholder: '10', defaultValue: '10', width: 'w-16' },
        { key: 'charset', label: 'Charset', type: 'select', defaultValue: 'alphanumeric',
          options: ['alphanumeric', 'alpha', 'numeric', 'hex'] },
      ]},
      { name: 'Regex Pattern', params: [
        { key: 'pattern', label: 'Regex', type: 'text', placeholder: '[A-Z]{3}-\\d{4}', width: 'w-40' },
      ]},
      { name: 'Enum Values', params: [
        { key: 'values', label: 'Values (comma-sep)', type: 'text', placeholder: 'active,inactive,pending', width: 'w-48' },
      ]},
      { name: 'Weighted Random', params: [
        { key: 'values', label: 'Values', type: 'text', placeholder: 'active,inactive,pending', width: 'w-36' },
        { key: 'weights', label: 'Weights', type: 'text', placeholder: '70,20,10', width: 'w-24' },
      ]},
      { name: 'Formatted String', javaExpression: 'String.format(format, id)', params: [
        { key: 'format', label: 'Format', type: 'text', placeholder: 'ORD-%05d', width: 'w-36' },
      ]},
    ],
  },
  {
    label: 'Personal',
    generators: [
      { name: 'First Name', javaExpression: 'faker.name().firstName()' },
      { name: 'Last Name', javaExpression: 'faker.name().lastName()' },
      { name: 'Full Name', javaExpression: 'faker.name().fullName()' },
      { name: 'Email', javaExpression: 'faker.internet().emailAddress()' },
      { name: 'Phone', javaExpression: 'faker.phoneNumber().phoneNumber()' },
      { name: 'Username', javaExpression: 'faker.name().username()' },
    ],
  },
  {
    label: 'Location',
    generators: [
      { name: 'Address', javaExpression: 'faker.address().streetAddress()' },
      { name: 'City', javaExpression: 'faker.address().city()' },
      { name: 'State', javaExpression: 'faker.address().state()' },
      { name: 'Country', javaExpression: 'faker.address().country()' },
      { name: 'Zip Code', javaExpression: 'faker.address().zipCode()' },
    ],
  },
  {
    label: 'Date & Time',
    generators: [
      { name: 'Date', javaExpression: 'LocalDate.now().minusDays(random.nextInt(365))' },
      { name: 'Timestamp', javaExpression: 'LocalDateTime.now().minusHours(random.nextLong(8760))' },
      { name: 'Date Range', params: [
        { key: 'from', label: 'From', type: 'text', placeholder: '2020-01-01', defaultValue: '2020-01-01', width: 'w-28' },
        { key: 'to', label: 'To', type: 'text', placeholder: '2026-12-31', defaultValue: '2026-12-31', width: 'w-28' },
      ]},
      { name: 'ISO DateTime', javaExpression: 'Instant.now().toString()' },
    ],
  },
  {
    label: 'Internet',
    generators: [
      { name: 'URL', javaExpression: 'faker.internet().url()' },
      { name: 'IP Address', javaExpression: 'faker.internet().ipV4Address()' },
      { name: 'Domain', javaExpression: 'faker.internet().domainName()' },
    ],
  },
  {
    label: 'Text',
    generators: [
      { name: 'Word', javaExpression: 'faker.lorem().word()' },
      { name: 'Sentence', javaExpression: 'faker.lorem().sentence()' },
      { name: 'Paragraph', javaExpression: 'faker.lorem().paragraph()' },
    ],
  },
  {
    label: 'Business',
    generators: [
      { name: 'Company', javaExpression: 'faker.company().name()' },
      { name: 'Department' },
      { name: 'Job Title', javaExpression: 'faker.job().title()' },
    ],
  },
  {
    label: 'Custom',
    generators: [
      { name: 'Custom Expression', params: [
        { key: 'expression', label: 'SQL Expression', type: 'text', placeholder: "gen_random_uuid() or custom SQL", width: 'w-64' },
      ]},
    ],
  },
];

const GENERATOR_DEF_MAP = new Map<string, GeneratorDef>(
  GENERATOR_CATEGORIES.flatMap(cat => cat.generators.map(g => [g.name, g] as const))
);

// ── FK Type Compatibility Check ──────────────────────────────────────────────

function normalizeTypeFamily(dataType: string): string {
  const t = dataType.toUpperCase().trim();
  if (t.includes('UUID')) return 'uuid';
  if (t.includes('SERIAL') || t.includes('INT') || t.includes('BIGINT') || t.includes('SMALLINT')) return 'integer';
  if (t.includes('NUMERIC') || t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('REAL')) return 'numeric';
  if (t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR')) return 'text';
  if (t.includes('BOOL')) return 'boolean';
  if (t.includes('TIMESTAMP')) return 'timestamp';
  if (t.includes('DATE')) return 'date';
  if (t.includes('TIME')) return 'time';
  if (t.includes('JSON')) return 'json';
  if (t.includes('BYTEA') || t.includes('BLOB')) return 'binary';
  return 'other';
}

function checkFKTypeCompatibility(fkColType: string, parentColType: string): { compatible: boolean; message: string } {
  const fkFamily = normalizeTypeFamily(fkColType);
  const parentFamily = normalizeTypeFamily(parentColType);

  if (fkFamily === parentFamily) {
    return { compatible: true, message: '' };
  }

  // Allow integer ↔ numeric compatibility
  if ((fkFamily === 'integer' && parentFamily === 'numeric') || (fkFamily === 'numeric' && parentFamily === 'integer')) {
    return { compatible: true, message: '' };
  }

  return {
    compatible: false,
    message: `Type mismatch: FK column is ${fkColType} (${fkFamily}) but parent column is ${parentColType} (${parentFamily})`,
  };
}

// ── Auto-detect Generator from Column Metadata ──────────────────────────────

function autoDetectGenerator(col: Column): { generator: string; params: Record<string, string> } {
  const name = col.name.toLowerCase();
  const type = col.dataType.toLowerCase();

  if (col.isForeignKey && col.referencesTable && col.referencesColumn) {
    return { generator: 'FK Reference', params: { refTable: col.referencesTable, refColumn: col.referencesColumn } };
  }

  if (col.isPrimaryKey) {
    if (type.includes('uuid')) return { generator: 'UUID', params: {} };
    if (type.includes('serial') || type.includes('int')) return { generator: 'Sequence', params: { start: '1', step: '1' } };
    return { generator: 'UUID', params: {} };
  }

  if (name === 'email' || name.endsWith('_email')) return { generator: 'Email', params: {} };
  if (name === 'phone' || name.includes('phone') || name.includes('mobile')) return { generator: 'Phone', params: {} };
  if (name === 'first_name' || name === 'firstname') return { generator: 'First Name', params: {} };
  if (name === 'last_name' || name === 'lastname') return { generator: 'Last Name', params: {} };
  if (name === 'name' || name === 'full_name' || name === 'fullname' || name === 'customer_name') return { generator: 'Full Name', params: {} };
  if (name === 'username' || name === 'user_name' || name === 'login') return { generator: 'Username', params: {} };
  if (name === 'city') return { generator: 'City', params: {} };
  if (name === 'state' || name === 'province') return { generator: 'State', params: {} };
  if (name === 'country') return { generator: 'Country', params: {} };
  if (name === 'zip' || name === 'zip_code' || name === 'postal_code') return { generator: 'Zip Code', params: {} };
  if (name === 'address' || name.includes('street')) return { generator: 'Address', params: {} };
  if (name === 'company' || name === 'company_name') return { generator: 'Company', params: {} };
  if (name === 'department') return { generator: 'Department', params: {} };
  if (name === 'title' || name === 'job_title') return { generator: 'Job Title', params: {} };
  if (name === 'url' || name === 'website') return { generator: 'URL', params: {} };
  if (name === 'ip' || name === 'ip_address') return { generator: 'IP Address', params: {} };

  if (name === 'status' || name.endsWith('_status') || name === 'type' || name.endsWith('_type')) {
    return { generator: 'Enum Values', params: { values: 'active,inactive,pending,suspended' } };
  }

  if (name.startsWith('is_') || name.startsWith('has_') || type === 'boolean' || type === 'bool') {
    return { generator: 'Boolean', params: {} };
  }

  if (name.includes('created') || name.includes('updated') || name.includes('deleted') || name.includes('_at') || name.includes('_date')) {
    if (type.includes('timestamp') || type.includes('timestamptz')) return { generator: 'Timestamp', params: {} };
    return { generator: 'Date', params: {} };
  }
  if (type.includes('timestamp') || type.includes('timestamptz')) return { generator: 'Timestamp', params: {} };
  if (type === 'date') return { generator: 'Date', params: {} };

  if (name.includes('amount') || name.includes('price') || name.includes('balance') || name.includes('salary') || name.includes('total') || name.includes('fee')) {
    return { generator: 'BigDecimal', params: { max: '50000', scale: '2' } };
  }
  if (name.includes('rate') || name.includes('percentage') || name.includes('ratio')) {
    return { generator: 'Random Float', params: { min: '0', max: '100', precision: '2' } };
  }
  if (name.includes('count') || name.includes('quantity') || name.includes('age')) {
    return { generator: 'Random Integer', params: { min: '1', max: '1000' } };
  }
  if (type.includes('int') || type.includes('serial')) return { generator: 'Random Integer', params: { min: '1', max: '100000' } };
  if (type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double') || type.includes('real')) {
    return { generator: 'BigDecimal', params: { max: '10000', scale: '2' } };
  }

  if (type.includes('uuid')) return { generator: 'UUID', params: {} };

  if (name.includes('description') || name.includes('notes') || name.includes('comment') || name.includes('remarks')) {
    return { generator: 'Sentence', params: {} };
  }

  return { generator: 'Random String', params: { length: '10', charset: 'alphanumeric' } };
}

// ── Topological Sort for FK Dependencies ────────────────────────────────────

function resolveInsertOrder(tables: TableConfig[]): TableConfig[] {
  const tableNames = new Set(tables.map(t => t.tableName));
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const t of tables) {
    graph.set(t.tableName, new Set());
    inDegree.set(t.tableName, 0);
  }

  for (const t of tables) {
    for (const col of t.columns) {
      if (col.generator === 'FK Reference' && col.params.refTable && tableNames.has(col.params.refTable) && col.params.refTable !== t.tableName) {
        graph.get(col.params.refTable)!.add(t.tableName);
        inDegree.set(t.tableName, (inDegree.get(t.tableName) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [name, deg] of inDegree) {
    if (deg === 0) queue.push(name);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const dep of graph.get(current) || []) {
      const newDeg = (inDegree.get(dep) || 1) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  for (const t of tables) {
    if (!sorted.includes(t.tableName)) sorted.push(t.tableName);
  }

  const tableMap = new Map(tables.map(t => [t.tableName, t]));
  return sorted.map(name => tableMap.get(name)!);
}

// ── Find parent table's PK generator type ────────────────────────────────────

function getParentPKGenerator(tables: TableConfig[], parentTableName: string, parentColumn: string): string {
  const parentTable = tables.find(t => t.tableName === parentTableName);
  if (!parentTable) return 'unknown';
  const pkCol = parentTable.columns.find(c => c.name === parentColumn);
  if (!pkCol) return 'unknown';
  return pkCol.generator;
}

// ── SQL Script Generator (Bulk — generate_series) ────────────────────────────

function generateBulkSQL(tables: TableConfig[], distribution: Distribution): string {
  const ordered = resolveInsertOrder(tables);
  const lines: string[] = [
    '-- ============================================================================',
    '-- Aqua DB Copilot — Synthetic Data Generation Script (Bulk)',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Style: Bulk INSERT ... SELECT FROM generate_series()`,
    `-- Distribution: ${distribution}`,
    `-- Tables: ${ordered.map(t => `${t.tableName} (${t.rowCount.toLocaleString()})`).join(', ')}`,
    '-- ============================================================================',
    '',
    'BEGIN;',
    '',
  ];

  for (const table of ordered) {
    const cols = table.columns.filter(c => c.generator !== 'Null');
    if (cols.length === 0) continue;

    // Check if any FK columns reference a parent in the generation chain
    const fkCols = cols.filter(c => c.generator === 'FK Reference' && c.params.refTable);
    const needsParentArrays = fkCols.filter(c => {
      const parentGen = getParentPKGenerator(ordered, c.params.refTable, c.params.refColumn || 'id');
      return parentGen === 'UUID' || parentGen === 'ULID';
    });

    lines.push(`-- ── ${table.tableName}: ${table.rowCount.toLocaleString()} rows ──`);

    // If we need to reference UUID parent keys, pre-fetch them into arrays
    if (needsParentArrays.length > 0) {
      for (const fkCol of needsParentArrays) {
        const refTable = fkCol.params.refTable;
        const refCol = fkCol.params.refColumn || 'id';
        const alias = `_${refTable}_${refCol}_ids`;
        lines.push(`-- Pre-fetch parent keys for FK: ${fkCol.name} → ${refTable}.${refCol}`);
        lines.push(`WITH ${alias} AS (`);
        lines.push(`  SELECT ARRAY(SELECT ${refCol} FROM ${refTable} ORDER BY ${refCol}) AS ids`);
        lines.push(`)`)
      }
    }

    lines.push(`INSERT INTO ${table.tableName} (${cols.map(c => c.name).join(', ')})`);
    lines.push('SELECT');

    const selectParts: string[] = [];
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const comma = i < cols.length - 1 ? ',' : '';
      const expr = generateColumnExpression(col, table.rowCount, ordered);
      selectParts.push(`  ${expr}${comma}  -- ${col.name}`);
    }
    lines.push(...selectParts);

    // Add FROM clause — join with parent ID arrays if needed
    if (needsParentArrays.length > 0) {
      const crossJoins = needsParentArrays.map(fkCol => {
        const alias = `_${fkCol.params.refTable}_${fkCol.params.refColumn || 'id'}_ids`;
        return alias;
      });
      lines.push(`FROM generate_series(1, ${table.rowCount}) AS s(i), ${crossJoins.join(', ')};`);
    } else {
      lines.push(`FROM generate_series(1, ${table.rowCount}) AS s(i);`);
    }
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');
  lines.push('-- Analyze tables for updated statistics');
  for (const table of ordered) {
    lines.push(`ANALYZE ${table.tableName};`);
  }
  lines.push('');

  return lines.join('\n');
}

// ── SQL Script Generator (Individual INSERTs) ────────────────────────────────

function generateIndividualSQL(tables: TableConfig[], distribution: Distribution): string {
  const ordered = resolveInsertOrder(tables);
  const lines: string[] = [
    '-- ============================================================================',
    '-- Aqua DB Copilot — Synthetic Data Generation Script (Individual INSERTs)',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Style: Individual INSERT statements`,
    `-- Distribution: ${distribution}`,
    `-- Tables: ${ordered.map(t => `${t.tableName} (${t.rowCount.toLocaleString()})`).join(', ')}`,
    '-- ============================================================================',
    '',
    'BEGIN;',
    '',
  ];

  for (const table of ordered) {
    const cols = table.columns.filter(c => c.generator !== 'Null');
    if (cols.length === 0) continue;

    const effectiveCount = Math.min(table.rowCount, 10000); // Cap at 10K for individual INSERTs
    const wasCapped = table.rowCount > 10000;

    lines.push(`-- ── ${table.tableName}: ${effectiveCount.toLocaleString()} rows${wasCapped ? ` (capped from ${table.rowCount.toLocaleString()})` : ''} ──`);

    // Generate batched VALUES (100 rows per INSERT for performance)
    const batchSize = 100;
    for (let batchStart = 0; batchStart < effectiveCount; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, effectiveCount);
      lines.push(`INSERT INTO ${table.tableName} (${cols.map(c => c.name).join(', ')}) VALUES`);

      for (let row = batchStart; row < batchEnd; row++) {
        const values = cols.map(col => generateIndividualValue(col, row + 1, table.rowCount, ordered));
        const comma = row < batchEnd - 1 ? ',' : ';';
        lines.push(`  (${values.join(', ')})${comma}`);
      }
      lines.push('');
    }
  }

  lines.push('COMMIT;');
  lines.push('');
  lines.push('-- Analyze tables for updated statistics');
  for (const table of ordered) {
    lines.push(`ANALYZE ${table.tableName};`);
  }
  lines.push('');

  return lines.join('\n');
}

function generateIndividualValue(col: ColumnConfig, rowNum: number, _totalRows: number, allTables: TableConfig[]): string {
  if (col.isConstant && col.constantValue !== undefined) {
    const val = col.constantValue;
    if (val === '' || val.toLowerCase() === 'null') return 'NULL';
    if (/^\d+$/.test(val)) return val;
    if (/^\d+\.\d+$/.test(val)) return val;
    if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') return val.toUpperCase();
    return `'${val.replace(/'/g, "''")}'`;
  }

  const p = col.params;
  const frac = pseudoRandom(rowNum);

  switch (col.generator) {
    case 'UUID': return `gen_random_uuid()`;
    case 'Incremental ID':
    case 'Sequence': {
      const start = parseInt(p.start || '1', 10);
      const step = parseInt(p.step || '1', 10);
      return String(start + (rowNum - 1) * step);
    }
    case 'ULID': return `encode(gen_random_bytes(16), 'hex')`;
    case 'Null': return 'NULL';
    case 'Static Value': return `'${(p.value || '').replace(/'/g, "''")}'`;
    case 'Boolean': return frac > 0.5 ? 'TRUE' : 'FALSE';
    case 'FK Reference': {
      // For individual inserts, reference parent data that was already inserted
      const refTable = p.refTable || 'parent';
      const refCol = p.refColumn || 'id';
      const parentTable = allTables.find(t => t.tableName === refTable);
      if (parentTable) {
        const parentPKGen = getParentPKGenerator(allTables, refTable, refCol);
        if (parentPKGen === 'Sequence' || parentPKGen === 'Incremental ID') {
          const parentCount = parentTable.rowCount;
          const refId = Math.floor(frac * parentCount) + 1;
          return String(refId);
        }
        if (parentPKGen === 'UUID' || parentPKGen === 'ULID') {
          // UUID parent in generation set — use subquery from already-inserted data
          return `(SELECT ${refCol} FROM ${refTable} OFFSET ${Math.floor(frac * 1000) % Math.max(parentTable.rowCount, 1)} LIMIT 1)`;
        }
      }
      // Parent not in generation set — generate standalone value based on column type
      const colType = col.type.toUpperCase();
      if (colType.includes('UUID')) {
        return `'${crypto.randomUUID()}'`;
      }
      return String(Math.floor(frac * 1000) + 1);
    }
    case 'Random Integer': {
      const min = parseInt(p.min || '0', 10);
      const max = parseInt(p.max || '100', 10);
      return String(Math.floor(min + frac * (max - min)));
    }
    case 'Random Float':
    case 'BigDecimal': {
      const min = parseFloat(p.min || '0');
      const max = parseFloat(p.max || '1');
      const prec = parseInt(p.precision || p.scale || '2', 10);
      return (min + frac * (max - min)).toFixed(prec);
    }
    case 'Gaussian': {
      const mean = parseFloat(p.mean || '0');
      const stddev = parseFloat(p.stddev || '1');
      const offsets = [-0.5, 1.2, -1.8, 0.3, 0.9, -0.7, 1.5, -1.1, 0.6, -0.2];
      return (mean + offsets[rowNum % 10] * stddev).toFixed(2);
    }
    case 'Currency': {
      const min = parseFloat(p.min || '1');
      const max = parseFloat(p.max || '999');
      return (min + frac * (max - min)).toFixed(2);
    }
    case 'Random String': {
      const len = parseInt(p.length || '10', 10);
      return `substr(md5('${rowNum}'), 1, ${len})`;
    }
    case 'Enum Values':
    case 'Weighted Random': {
      const values = (p.values || 'A,B,C').split(',').map(v => v.trim()).filter(Boolean);
      const picked = values[(rowNum - 1) % values.length];
      return `'${picked.replace(/'/g, "''")}'`;
    }
    case 'Formatted String': {
      const fmt = p.format || 'ITEM-%05d';
      const num = String(rowNum).padStart(5, '0');
      const result = fmt.replace(/%0?\d*d/, num);
      return `'${result.replace(/'/g, "''")}'`;
    }
    case 'First Name': {
      const names = ['Alice','Bob','Carol','David','Eve','Frank','Grace','Hank','Iris','Jack','Kate','Leo','Mia','Nick','Olivia','Paul','Quinn','Rose','Sam','Tina'];
      return `'${names[(rowNum - 1) % names.length]}'`;
    }
    case 'Last Name': {
      const names = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Anderson','Taylor','Thomas','Jackson','White','Harris','Martin','Thompson','Moore','Clark'];
      return `'${names[(rowNum - 1) % names.length]}'`;
    }
    case 'Full Name': {
      const first = ['Alice','Bob','Carol','David','Eve','Frank','Grace','Hank','Iris','Jack'];
      const last = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez'];
      return `'${first[(rowNum - 1) % first.length]} ${last[Math.floor(frac * last.length)]}'`;
    }
    case 'Email': return `'user${rowNum}@${['gmail.com','yahoo.com','outlook.com','company.com','test.org'][(rowNum - 1) % 5]}'`;
    case 'Phone': return `'+1-555-${String(rowNum % 10000).padStart(4, '0')}'`;
    case 'Username': return `'user_${rowNum}'`;
    case 'City': {
      const cities = ['New York','San Francisco','London','Tokyo','Berlin','Paris','Mumbai','Sydney','Toronto','Dubai'];
      return `'${cities[(rowNum - 1) % cities.length]}'`;
    }
    case 'State': {
      const states = ['California','New York','Texas','Florida','Illinois','Ohio','Pennsylvania','Georgia','Michigan','Virginia'];
      return `'${states[(rowNum - 1) % states.length]}'`;
    }
    case 'Country': {
      const countries = ['United States','Canada','United Kingdom','Germany','France','Japan','India','Australia','Brazil','Mexico'];
      return `'${countries[(rowNum - 1) % countries.length]}'`;
    }
    case 'Zip Code': return `'${String(rowNum % 100000).padStart(5, '0')}'`;
    case 'Address': {
      const streets = ['Main St','Oak Ave','Pine Rd','Elm Dr','Maple Ln','Cedar Way','Park Blvd','Hill Rd'];
      return `'${rowNum % 9999 + 1} ${streets[(rowNum - 1) % streets.length]}'`;
    }
    case 'Company': {
      const companies = ['Acme Corp','TechStart Inc','GlobalServ Ltd','DataFlow Co','CloudBase LLC','NexGen Systems','BluePeak Solutions','GreenLeaf Tech'];
      return `'${companies[(rowNum - 1) % companies.length]}'`;
    }
    case 'Department': {
      const depts = ['Engineering','Marketing','Sales','HR','Finance','Operations','Legal','Support'];
      return `'${depts[(rowNum - 1) % depts.length]}'`;
    }
    case 'Job Title': {
      const titles = ['Software Engineer','Product Manager','Designer','Data Analyst','VP Engineering','Director','Architect','Team Lead'];
      return `'${titles[(rowNum - 1) % titles.length]}'`;
    }
    case 'Date': {
      const base = new Date('2022-01-01');
      base.setDate(base.getDate() + Math.floor(frac * 1095));
      return `'${base.toISOString().split('T')[0]}'`;
    }
    case 'Timestamp': {
      const base = new Date('2022-01-01T00:00:00Z');
      base.setHours(base.getHours() + Math.floor(frac * 26280));
      return `'${base.toISOString().replace('T', ' ').replace('Z', '')}'`;
    }
    case 'Date Range': {
      const from = new Date(p.from || '2020-01-01');
      const to = new Date(p.to || '2026-12-31');
      const diff = to.getTime() - from.getTime();
      const d = new Date(from.getTime() + frac * diff);
      return `'${d.toISOString().split('T')[0]}'`;
    }
    case 'ISO DateTime': {
      const base = new Date('2022-01-01T00:00:00Z');
      base.setHours(base.getHours() + Math.floor(frac * 26280));
      return `'${base.toISOString()}'`;
    }
    case 'URL': {
      const domains = ['example.com','test.io','demo.org','app.co'];
      return `'https://${domains[(rowNum - 1) % domains.length]}/${rowNum}'`;
    }
    case 'IP Address': {
      const a = (rowNum % 223) + 1, b = (rowNum * 3) % 256, c = (rowNum * 7) % 256, d = (rowNum * 11) % 256;
      return `'${a}.${b}.${c}.${d}'`;
    }
    case 'Domain': {
      const domains = ['example.com','test.io','demo.org','app.co','site.dev'];
      return `'${domains[(rowNum - 1) % domains.length]}'`;
    }
    case 'Word': {
      const words = ['lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit'];
      return `'${words[(rowNum - 1) % words.length]}'`;
    }
    case 'Sentence': {
      const adj = ['quick','lazy','smart','brave','calm'];
      const noun = ['fox','dog','cat','bird','fish'];
      const verb = ['runs','sleeps','jumps','plays','swims'];
      return `'The ${adj[(rowNum - 1) % 5]} ${noun[Math.floor(frac * 5)]} ${verb[(rowNum + 2) % 5]}.'`;
    }
    case 'Paragraph': return `'Lorem ipsum dolor sit amet, row ${rowNum}.'`;
    case 'Regex Pattern': return `substr(md5('${rowNum}'), 1, 10)`;
    case 'Custom Expression': return p.expression || 'NULL';
    default: return `'value_${rowNum}'`;
  }
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ── Bulk SQL: Column Expression Generator ────────────────────────────────────

function generateColumnExpression(col: ColumnConfig, _rowCount: number, allTables: TableConfig[]): string {
  if (col.isConstant && col.constantValue !== undefined) {
    const val = col.constantValue;
    if (val === '' || val.toLowerCase() === 'null') return 'NULL';
    if (/^\d+$/.test(val)) return val;
    if (/^\d+\.\d+$/.test(val)) return val;
    if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') return val.toUpperCase();
    return `'${val.replace(/'/g, "''")}'`;
  }

  const p = col.params;

  switch (col.generator) {
    case 'UUID':
      return 'gen_random_uuid()';
    case 'Incremental ID':
    case 'Sequence': {
      const start = parseInt(p.start || '1', 10);
      const step = parseInt(p.step || '1', 10);
      if (start === 1 && step === 1) return 's.i';
      return `${start} + (s.i - 1) * ${step}`;
    }
    case 'ULID':
      return "encode(gen_random_bytes(16), 'hex')";
    case 'Null':
      return 'NULL';
    case 'Static Value':
      return `'${(p.value || '').replace(/'/g, "''")}'`;
    case 'Boolean':
      return '(random() > 0.5)';
    case 'FK Reference': {
      const refTable = p.refTable || 'parent';
      const refCol = p.refColumn || 'id';
      const parentPKGen = getParentPKGenerator(allTables, refTable, refCol);

      // If parent PK is sequential integer, directly calculate the FK value
      if (parentPKGen === 'Sequence' || parentPKGen === 'Incremental ID') {
        const parentTable = allTables.find(t => t.tableName === refTable);
        const parentCount = parentTable?.rowCount || 1000;
        return `floor(random() * ${parentCount} + 1)::int`;
      }

      // If parent is in generation set with UUID/ULID, use the pre-fetched ARRAY from CTE
      if (parentPKGen === 'UUID' || parentPKGen === 'ULID') {
        const alias = `_${refTable}_${refCol}_ids`;
        return `${alias}.ids[floor(random() * array_length(${alias}.ids, 1) + 1)::int]`;
      }

      // Parent table not in generation set — generate standalone value based on column type
      const colType = col.type.toUpperCase();
      if (colType.includes('UUID')) {
        return 'gen_random_uuid()';
      }
      if (colType.includes('INT') || colType.includes('SERIAL')) {
        return `floor(random() * 1000 + 1)::int`;
      }
      // Fallback: random integer
      return `floor(random() * 1000 + 1)::int`;
    }
    case 'Random Integer': {
      const min = p.min || '0';
      const max = p.max || '100';
      return `floor(random() * (${max} - ${min} + 1) + ${min})::int`;
    }
    case 'Random Float':
    case 'BigDecimal': {
      const min = p.min || '0';
      const max = p.max || '1';
      const prec = p.precision || p.scale || '2';
      return `round((random() * (${max} - ${min}) + ${min})::numeric, ${prec})`;
    }
    case 'Gaussian': {
      const mean = p.mean || '0';
      const stddev = p.stddev || '1';
      return `round((${mean} + ${stddev} * (random() + random() + random() - 1.5) / 0.7071)::numeric, 2)`;
    }
    case 'Currency': {
      const min = p.min || '1';
      const max = p.max || '999';
      return `round((random() * (${max} - ${min}) + ${min})::numeric, 2)`;
    }
    case 'Random String': {
      const len = p.length || '10';
      return `substr(md5(random()::text || s.i::text), 1, ${len})`;
    }
    case 'Enum Values': {
      const values = (p.values || 'A,B,C').split(',').map(v => v.trim()).filter(Boolean);
      const arr = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
      return `(ARRAY[${arr}])[floor(random() * ${values.length} + 1)::int]`;
    }
    case 'Weighted Random': {
      const values = (p.values || 'A,B,C').split(',').map(v => v.trim()).filter(Boolean);
      const arr = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
      return `(ARRAY[${arr}])[floor(random() * ${values.length} + 1)::int]`;
    }
    case 'Formatted String': {
      const fmt = p.format || 'ITEM-%05d';
      if (fmt.includes('%')) {
        return `'${fmt.replace(/%0?(\d*)d/, "' || lpad(s.i::text, ${fmt.match(/%0?(\d+)d/)?.[1] || '5'}, '0') || '")}'`;
      }
      return `'${fmt.replace(/'/g, "''")}' || s.i::text`;
    }
    case 'First Name': {
      const names = "'Alice','Bob','Carol','David','Eve','Frank','Grace','Hank','Iris','Jack','Kate','Leo','Mia','Nick','Olivia','Paul','Quinn','Rose','Sam','Tina'";
      return `(ARRAY[${names}])[floor(random() * 20 + 1)::int]`;
    }
    case 'Last Name': {
      const names = "'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Anderson','Taylor','Thomas','Jackson','White','Harris','Martin','Thompson','Moore','Clark'";
      return `(ARRAY[${names}])[floor(random() * 20 + 1)::int]`;
    }
    case 'Full Name': {
      const first = "'Alice','Bob','Carol','David','Eve','Frank','Grace','Hank','Iris','Jack'";
      const last = "'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez'";
      return `(ARRAY[${first}])[floor(random() * 10 + 1)::int] || ' ' || (ARRAY[${last}])[floor(random() * 10 + 1)::int]`;
    }
    case 'Email':
      return `'user' || s.i || '@' || (ARRAY['gmail.com','yahoo.com','outlook.com','company.com','test.org'])[floor(random() * 5 + 1)::int]`;
    case 'Phone':
      return `'+1-555-' || lpad(floor(random() * 10000)::text, 4, '0')`;
    case 'Username':
      return `'user_' || substr(md5(s.i::text), 1, 8)`;
    case 'City': {
      const cities = "'New York','San Francisco','London','Tokyo','Berlin','Paris','Mumbai','Sydney','Toronto','Dubai'";
      return `(ARRAY[${cities}])[floor(random() * 10 + 1)::int]`;
    }
    case 'State': {
      const states = "'California','New York','Texas','Florida','Illinois','Ohio','Pennsylvania','Georgia','Michigan','Virginia'";
      return `(ARRAY[${states}])[floor(random() * 10 + 1)::int]`;
    }
    case 'Country': {
      const countries = "'United States','Canada','United Kingdom','Germany','France','Japan','India','Australia','Brazil','Mexico'";
      return `(ARRAY[${countries}])[floor(random() * 10 + 1)::int]`;
    }
    case 'Zip Code':
      return `lpad(floor(random() * 100000)::text, 5, '0')`;
    case 'Address':
      return `floor(random() * 9999 + 1)::text || ' ' || (ARRAY['Main St','Oak Ave','Pine Rd','Elm Dr','Maple Ln','Cedar Way','Park Blvd','Hill Rd'])[floor(random() * 8 + 1)::int]`;
    case 'Company': {
      const companies = "'Acme Corp','TechStart Inc','GlobalServ Ltd','DataFlow Co','CloudBase LLC','NexGen Systems','BluePeak Solutions','GreenLeaf Tech'";
      return `(ARRAY[${companies}])[floor(random() * 8 + 1)::int]`;
    }
    case 'Department': {
      const depts = "'Engineering','Marketing','Sales','HR','Finance','Operations','Legal','Support'";
      return `(ARRAY[${depts}])[floor(random() * 8 + 1)::int]`;
    }
    case 'Job Title': {
      const titles = "'Software Engineer','Product Manager','Designer','Data Analyst','VP Engineering','Director','Architect','Team Lead'";
      return `(ARRAY[${titles}])[floor(random() * 8 + 1)::int]`;
    }
    case 'Date':
      return `CURRENT_DATE - floor(random() * 365 * 3)::int`;
    case 'Timestamp':
      return `NOW() - (random() * interval '1095 days')`;
    case 'Date Range': {
      const from = p.from || '2020-01-01';
      const to = p.to || '2026-12-31';
      return `'${from}'::date + floor(random() * ('${to}'::date - '${from}'::date))::int`;
    }
    case 'ISO DateTime':
      return `to_char(NOW() - (random() * interval '1095 days'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
    case 'URL':
      return `'https://' || (ARRAY['example.com','test.io','demo.org','app.co'])[floor(random() * 4 + 1)::int] || '/' || substr(md5(s.i::text), 1, 8)`;
    case 'IP Address':
      return `floor(random() * 223 + 1)::text || '.' || floor(random() * 256)::text || '.' || floor(random() * 256)::text || '.' || floor(random() * 256)::text`;
    case 'Domain':
      return `(ARRAY['example.com','test.io','demo.org','app.co','site.dev'])[floor(random() * 5 + 1)::int]`;
    case 'Word':
      return `(ARRAY['lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit'])[floor(random() * 8 + 1)::int]`;
    case 'Sentence':
      return `'The ' || (ARRAY['quick','lazy','smart','brave','calm'])[floor(random() * 5 + 1)::int] || ' ' || (ARRAY['fox','dog','cat','bird','fish'])[floor(random() * 5 + 1)::int] || ' ' || (ARRAY['runs','sleeps','jumps','plays','swims'])[floor(random() * 5 + 1)::int] || '.'`;
    case 'Paragraph':
      return `'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' || md5(s.i::text)`;
    case 'Regex Pattern':
      return `substr(md5(random()::text), 1, 10)`;
    case 'Custom Expression':
      return p.expression || 'NULL';
    default:
      return `'value_' || s.i`;
  }
}

// ── Sample Value Generator ───────────────────────────────────────────────────

const SAMPLE_FRACTIONS = [0.42, 0.17, 0.88, 0.03, 0.65];

function generateSampleValue(generator: string, params: Record<string, string>, rowIndex: number, isConstant?: boolean, constantValue?: string): string {
  if (isConstant && constantValue !== undefined) return constantValue || 'NULL';

  const frac = SAMPLE_FRACTIONS[rowIndex % 5];

  switch (generator) {
    case 'Static Value': return params.value || '(empty)';
    case 'Null': return 'NULL';
    case 'Sequence': {
      const start = parseInt(params.start || '1', 10);
      const step = parseInt(params.step || '1', 10);
      return String(start + rowIndex * step);
    }
    case 'FK Reference': return `→ ${params.refTable || 'parent'}.${params.refColumn || 'id'}[${rowIndex + 1}]`;
    case 'Random Integer': {
      const min = parseInt(params.min || '0', 10);
      const max = parseInt(params.max || '100', 10);
      return String(Math.floor(min + frac * (max - min)));
    }
    case 'Random Float':
    case 'BigDecimal': {
      const min = parseFloat(params.min || '0');
      const max = parseFloat(params.max || '1');
      const prec = parseInt(params.precision || params.scale || '2', 10);
      return (min + frac * (max - min)).toFixed(prec);
    }
    case 'Currency': {
      const sym = params.symbol || '$';
      const min = parseFloat(params.min || '1');
      const max = parseFloat(params.max || '999');
      return `${sym}${(min + frac * (max - min)).toFixed(2)}`;
    }
    case 'Enum Values':
    case 'Weighted Random': {
      const values = (params.values || 'A,B,C').split(',').map(v => v.trim()).filter(Boolean);
      return values.length > 0 ? values[rowIndex % values.length] : '(empty)';
    }
    case 'Formatted String': {
      const format = params.format || 'ITEM-%05d';
      const num = String(rowIndex + 1).padStart(5, '0');
      return format.replace(/%0?\d*d/, num);
    }
    case 'Date Range': {
      const dates = ['2021-03-15', '2022-07-22', '2023-01-10', '2024-09-05', '2025-06-18'];
      return dates[rowIndex % 5];
    }
    case 'Custom Expression': return params.expression ? `eval(${params.expression.slice(0, 30)})` : 'custom_value';
    default: break;
  }

  const samples: Record<string, string[]> = {
    'Incremental ID': ['1', '2', '3', '4', '5'],
    'UUID': ['a1b2c3d4-e5f6-..', 'b2c3d4e5-f6a7-..', 'c3d4e5f6-a7b8-..', 'd4e5f6a7-b8c9-..', 'e5f6a7b8-c9d0-..'],
    'ULID': ['01ARZ3NDEKTSV4RR', '01BX5ZZKBKACTAV9', '01CDF8RYZNGXJ5HF', '01DRVS55FXNG6V1P', '01EWMPB1K7T4YNVK'],
    'Full Name': ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eve Davis'],
    'First Name': ['Alice', 'Bob', 'Carol', 'David', 'Eve'],
    'Last Name': ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis'],
    'Username': ['alice_j', 'bob.smith', 'carol42', 'dave_b', 'eve_d'],
    'Email': ['alice@example.com', 'bob@corp.io', 'carol@test.org', 'david@mail.com', 'eve@acme.co'],
    'Phone': ['+1-555-0101', '+1-555-0102', '+1-555-0103', '+1-555-0104', '+1-555-0105'],
    'Timestamp': ['2025-01-15 08:30:00', '2025-02-20 14:22:00', '2025-03-10 09:45:00', '2025-04-05 16:10:00', '2025-05-12 11:05:00'],
    'Date': ['2025-01-15', '2025-02-20', '2025-03-10', '2025-04-05', '2025-05-12'],
    'ISO DateTime': ['2025-01-15T08:30:00Z', '2025-02-20T14:22:00Z', '2025-03-10T09:45:00Z', '2025-04-05T16:10:00Z', '2025-05-12T11:05:00Z'],
    'Boolean': ['true', 'false', 'true', 'true', 'false'],
    'Company': ['Acme Corp', 'TechStart Inc', 'GlobalServ Ltd', 'DataFlow Co', 'CloudBase LLC'],
    'Department': ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'],
    'Job Title': ['Software Engineer', 'Product Manager', 'Designer', 'Data Analyst', 'VP Engineering'],
    'City': ['New York', 'San Francisco', 'London', 'Tokyo', 'Berlin'],
    'State': ['California', 'New York', 'Texas', 'Florida', 'Illinois'],
    'Country': ['United States', 'Canada', 'United Kingdom', 'Japan', 'Germany'],
    'Zip Code': ['10001', '94102', 'SW1A 1AA', '100-0001', '10115'],
    'Address': ['123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm Dr', '654 Maple Ln'],
    'Paragraph': ['Lorem ipsum dolor sit amet...', 'Sed do eiusmod tempor...', 'Ut enim ad minim veniam...', 'Duis aute irure dolor...', 'Excepteur sint occaecat...'],
    'Sentence': ['The quick brown fox.', 'A lazy dog sleeps.', 'Hello world again.', 'Testing data here.', 'Sample text value.'],
    'Word': ['lorem', 'ipsum', 'dolor', 'sit', 'amet'],
    'URL': ['https://example.com/a', 'https://test.io/b', 'https://demo.org/c', 'https://app.co/d', 'https://site.dev/e'],
    'IP Address': ['192.168.1.1', '10.0.0.42', '172.16.0.100', '192.168.0.55', '10.10.10.10'],
    'Domain': ['example.com', 'test.io', 'demo.org', 'app.co', 'site.dev'],
    'Random String': ['abc123def4', 'xyz789ghi0', 'mno456pqr1', 'stu234vwx5', 'jkl678abc9'],
    'Regex Pattern': ['ABC-1234', 'XYZ-5678', 'DEF-9012', 'GHI-3456', 'JKL-7890'],
    'Gaussian': ['0.35', '-1.22', '0.88', '-0.15', '1.67'],
    'Auto Detect': ['value_1', 'value_2', 'value_3', 'value_4', 'value_5'],
  };

  return (samples[generator] || samples['Auto Detect'])[rowIndex % 5];
}

// ── Component ────────────────────────────────────────────────────────────────

export function SyntheticDataGenerator() {
  const { projectId } = useParams();
  const { data: schemaTables, isLoading: tablesLoading } = useTables(projectId);
  const { data: relationships } = useRelationships(projectId);

  // Mode & Style
  const [mode, setMode] = useState<GenerationMode>('single');
  const [scriptStyle, setScriptStyle] = useState<ScriptStyle>('bulk');
  const [distribution, setDistribution] = useState<Distribution>('realistic');

  // Single table state
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [tableName, setTableName] = useState('');
  const [rowCount, setRowCount] = useState(1000);
  const [customRowCount, setCustomRowCount] = useState('');
  const [columns, setColumns] = useState<ColumnConfig[]>([]);

  // Multi-table state
  const [multiTables, setMultiTables] = useState<TableConfig[]>([]);

  // Output
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect FK columns in single mode
  const hasFKColumns = useMemo(() => columns.some(c => c.isForeignKey), [columns]);

  // ── Table Selection Handler ──────────────────────────────────────────────

  const handleSelectTable = useCallback((tableId: string) => {
    setSelectedTableId(tableId);
    const table = schemaTables?.find((t: Table) => t.id === tableId);
    if (!table) {
      setTableName('');
      setColumns([]);
      return;
    }
    setTableName(table.name);
    const detectedCols: ColumnConfig[] = table.columns.map((col: Column) => {
      const detected = autoDetectGenerator(col);
      return {
        name: col.name,
        type: col.dataType,
        generator: detected.generator,
        params: detected.params,
        isPrimaryKey: col.isPrimaryKey,
        isForeignKey: col.isForeignKey,
        referencesTable: col.referencesTable || undefined,
        referencesColumn: col.referencesColumn || undefined,
      };
    });
    setColumns(detectedCols);
    setShowPreview(true);
    setGeneratedSQL('');
  }, [schemaTables]);

  // ── Multi-table: Add table ───────────────────────────────────────────────

  const handleAddMultiTable = useCallback((tableId: string) => {
    const table = schemaTables?.find((t: Table) => t.id === tableId);
    if (!table) return;
    if (multiTables.some(mt => mt.tableName === table.name)) return;

    const detectedCols: ColumnConfig[] = table.columns.map((col: Column) => {
      const detected = autoDetectGenerator(col);
      return {
        name: col.name,
        type: col.dataType,
        generator: detected.generator,
        params: detected.params,
        isPrimaryKey: col.isPrimaryKey,
        isForeignKey: col.isForeignKey,
        referencesTable: col.referencesTable || undefined,
        referencesColumn: col.referencesColumn || undefined,
      };
    });

    setMultiTables(prev => [...prev, {
      tableName: table.name,
      tableId: table.id,
      rowCount: 1000,
      columns: detectedCols,
      expanded: true,
    }]);
    setGeneratedSQL('');
  }, [schemaTables, multiTables]);

  const handleRemoveMultiTable = useCallback((index: number) => {
    setMultiTables(prev => prev.filter((_, i) => i !== index));
    setGeneratedSQL('');
  }, []);

  const handleToggleMultiTable = useCallback((index: number) => {
    setMultiTables(prev => prev.map((t, i) => i === index ? { ...t, expanded: !t.expanded } : t));
  }, []);

  const handleUpdateMultiTableRows = useCallback((index: number, count: number) => {
    setMultiTables(prev => prev.map((t, i) => i === index ? { ...t, rowCount: count } : t));
  }, []);

  // ── Column Update Handlers ───────────────────────────────────────────────

  const handleUpdateGenerator = useCallback((index: number, generator: string, multiTableIndex?: number) => {
    const genDef = GENERATOR_DEF_MAP.get(generator);
    const defaultParams: Record<string, string> = {};
    if (genDef?.params) {
      for (const p of genDef.params) {
        if (p.defaultValue !== undefined) defaultParams[p.key] = p.defaultValue;
      }
    }
    if (multiTableIndex !== undefined) {
      setMultiTables(prev => prev.map((t, ti) =>
        ti === multiTableIndex
          ? { ...t, columns: t.columns.map((c, ci) => ci === index ? { ...c, generator, params: defaultParams } : c) }
          : t
      ));
    } else {
      setColumns(prev => prev.map((c, i) => i === index ? { ...c, generator, params: defaultParams } : c));
    }
    setGeneratedSQL('');
  }, []);

  const handleUpdateParam = useCallback((index: number, key: string, value: string, multiTableIndex?: number) => {
    if (multiTableIndex !== undefined) {
      setMultiTables(prev => prev.map((t, ti) =>
        ti === multiTableIndex
          ? { ...t, columns: t.columns.map((c, ci) => ci === index ? { ...c, params: { ...c.params, [key]: value } } : c) }
          : t
      ));
    } else {
      setColumns(prev => prev.map((c, i) => i === index ? { ...c, params: { ...c.params, [key]: value } } : c));
    }
    setGeneratedSQL('');
  }, []);

  const handleToggleConstant = useCallback((index: number, multiTableIndex?: number) => {
    if (multiTableIndex !== undefined) {
      setMultiTables(prev => prev.map((t, ti) =>
        ti === multiTableIndex
          ? { ...t, columns: t.columns.map((c, ci) => ci === index ? { ...c, isConstant: !c.isConstant } : c) }
          : t
      ));
    } else {
      setColumns(prev => prev.map((c, i) => i === index ? { ...c, isConstant: !c.isConstant } : c));
    }
    setGeneratedSQL('');
  }, []);

  const handleSetConstantValue = useCallback((index: number, value: string, multiTableIndex?: number) => {
    if (multiTableIndex !== undefined) {
      setMultiTables(prev => prev.map((t, ti) =>
        ti === multiTableIndex
          ? { ...t, columns: t.columns.map((c, ci) => ci === index ? { ...c, constantValue: value } : c) }
          : t
      ));
    } else {
      setColumns(prev => prev.map((c, i) => i === index ? { ...c, constantValue: value } : c));
    }
    setGeneratedSQL('');
  }, []);

  // ── Generate SQL ─────────────────────────────────────────────────────────

  const effectiveRowCount = customRowCount ? parseInt(customRowCount, 10) || rowCount : rowCount;

  // ── FK Type Mismatch Detection ───────────────────────────────────────────

  const fkTypeMismatches = useMemo(() => {
    const errors: Array<{ table: string; column: string; message: string }> = [];
    const tablesToCheck = mode === 'single'
      ? [{ tableName, columns }]
      : multiTables;

    for (const t of tablesToCheck) {
      for (const col of t.columns) {
        if (col.generator !== 'FK Reference' || !col.params.refTable || !col.params.refColumn) continue;
        const parentTable = schemaTables?.find((st: Table) => st.name === col.params.refTable);
        const parentCol = parentTable?.columns.find((c: Column) => c.name === col.params.refColumn);
        if (parentCol) {
          const check = checkFKTypeCompatibility(col.type, parentCol.dataType);
          if (!check.compatible) {
            errors.push({ table: t.tableName, column: col.name, message: check.message });
          }
        }
      }
    }
    return errors;
  }, [mode, tableName, columns, multiTables, schemaTables]);

  const handleGenerate = useCallback(() => {
    if (fkTypeMismatches.length > 0) return; // Block generation on type mismatches

    const tables: TableConfig[] = mode === 'single'
      ? [{ tableName, rowCount: effectiveRowCount, columns, expanded: true }]
      : multiTables;

    if (tables.length === 0 || (mode === 'single' && !tableName.trim())) return;

    const sql = scriptStyle === 'bulk'
      ? generateBulkSQL(tables, distribution)
      : generateIndividualSQL(tables, distribution);
    setGeneratedSQL(sql);
    setShowPreview(false);
  }, [mode, tableName, effectiveRowCount, columns, multiTables, distribution, scriptStyle, fkTypeMismatches]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(generatedSQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedSQL]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([generatedSQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthetic-data-${mode === 'single' ? tableName : 'multi-table'}-${scriptStyle}-${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedSQL, mode, tableName, scriptStyle]);

  // ── Auto-detect from related tables for multi-mode ───────────────────────

  const handleAutoDetectFKChain = useCallback(() => {
    if (!schemaTables || !relationships) return;

    const tablesWithFKs = new Set<string>();
    for (const rel of relationships) {
      const srcName = rel.sourceTableName || schemaTables.find((t: Table) => t.id === rel.sourceTable)?.name;
      const tgtName = rel.targetTableName || schemaTables.find((t: Table) => t.id === rel.targetTable)?.name;
      if (srcName) tablesWithFKs.add(srcName);
      if (tgtName) tablesWithFKs.add(tgtName);
    }

    const toAdd: Table[] = schemaTables.filter((t: Table) => tablesWithFKs.has(t.name));
    const newTables: TableConfig[] = toAdd.map((table: Table) => ({
      tableName: table.name,
      tableId: table.id,
      rowCount: 1000,
      columns: table.columns.map((col: Column) => {
        const detected = autoDetectGenerator(col);
        return {
          name: col.name,
          type: col.dataType,
          generator: detected.generator,
          params: detected.params,
          isPrimaryKey: col.isPrimaryKey,
          isForeignKey: col.isForeignKey,
          referencesTable: col.referencesTable || undefined,
          referencesColumn: col.referencesColumn || undefined,
        };
      }),
      expanded: false,
    }));

    setMultiTables(newTables);
    setGeneratedSQL('');
  }, [schemaTables, relationships]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => { setMode('single'); setGeneratedSQL(''); }}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all',
            mode === 'single'
              ? 'bg-aqua-50 dark:bg-aqua-950/30 border-aqua-300 dark:border-aqua-700 text-aqua-700 dark:text-aqua-300 shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
          )}
        >
          <Table2 className="w-4 h-4" />
          Single Table
        </button>
        <button
          onClick={() => { setMode('multi'); setGeneratedSQL(''); }}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all',
            mode === 'multi'
              ? 'bg-aqua-50 dark:bg-aqua-950/30 border-aqua-300 dark:border-aqua-700 text-aqua-700 dark:text-aqua-300 shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
          )}
        >
          <Layers className="w-4 h-4" />
          Multi-Table (FK Chain)
        </button>

        {/* Script Style Toggle */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Script Style:</span>
          <button
            onClick={() => { setScriptStyle('bulk'); setGeneratedSQL(''); }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
              scriptStyle === 'bulk'
                ? 'bg-aqua-50 dark:bg-aqua-950/30 border-aqua-300 dark:border-aqua-700 text-aqua-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
            )}
            title="Bulk INSERT ... SELECT FROM generate_series() — fast for large datasets"
          >
            <Zap className="w-3 h-3" />
            Bulk
          </button>
          <button
            onClick={() => { setScriptStyle('individual'); setGeneratedSQL(''); }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
              scriptStyle === 'individual'
                ? 'bg-aqua-50 dark:bg-aqua-950/30 border-aqua-300 dark:border-aqua-700 text-aqua-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
            )}
            title="Individual INSERT VALUES — readable, max 10K rows"
          >
            <FileText className="w-3 h-3" />
            Individual
          </button>
        </div>
      </div>

      {/* Individual INSERT warning */}
      {scriptStyle === 'individual' && (
        <div className="flex items-start gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Individual mode</strong> generates separate INSERT VALUES statements (batched 100/INSERT). Capped at 10,000 rows per table for script size.
            Use <strong>Bulk</strong> mode for larger datasets.
          </p>
        </div>
      )}

      {/* FK Warning Banner for Single Mode */}
      {mode === 'single' && hasFKColumns && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Foreign Key Columns Detected</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              This table has FK references. For correct referential integrity, consider using <strong>Multi-Table (FK Chain)</strong> mode to generate parent data first.
              In single-table mode, FK columns will reference existing data in the parent table.
            </p>
          </div>
        </div>
      )}

      {/* Distribution */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Data Distribution</label>
        <div className="grid grid-cols-3 gap-3">
          {DISTRIBUTION_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setDistribution(opt.value)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left',
                  distribution === opt.value
                    ? 'bg-aqua-50 dark:bg-aqua-950/30 border-aqua-300 dark:border-aqua-700 shadow-sm'
                    : 'bg-card border-border hover:bg-muted/50'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', distribution === opt.value ? 'text-aqua-600' : 'text-muted-foreground')} />
                <div>
                  <p className={cn('text-sm font-medium', distribution === opt.value ? 'text-aqua-700 dark:text-aqua-300' : 'text-foreground')}>{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════ SINGLE TABLE MODE ════════════════════ */}
      {mode === 'single' && (
        <>
          {/* Table Selection & Row Count */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Select Table</label>
              <select
                value={selectedTableId}
                onChange={e => handleSelectTable(e.target.value)}
                disabled={tablesLoading}
                className="w-full text-sm border border-border rounded-lg px-3 py-2.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
              >
                <option value="">-- Select a table from schema --</option>
                {schemaTables?.map((t: Table) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.columns.length} cols{t.estimatedRows ? `, ~${t.estimatedRows.toLocaleString()} rows` : ''})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Number of Rows</label>
              <div className="flex gap-2 items-center">
                {ROW_COUNT_PRESETS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setRowCount(opt.value); setCustomRowCount(''); }}
                    className={cn(
                      'px-3 py-2 text-xs font-medium rounded-lg border transition-all',
                      rowCount === opt.value && !customRowCount
                        ? 'bg-aqua-50 dark:bg-aqua-950/30 border-aqua-300 dark:border-aqua-700 text-aqua-700 dark:text-aqua-300 shadow-sm'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
                <input
                  type="number"
                  value={customRowCount}
                  onChange={e => setCustomRowCount(e.target.value)}
                  placeholder="Custom"
                  min={1}
                  className={cn(
                    'w-24 text-xs border rounded-lg px-2 py-2 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30',
                    customRowCount ? 'border-aqua-300' : 'border-border'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Column Configuration */}
          {columns.length > 0 && (
            <ColumnConfigTable
              columns={columns}
              schemaTables={schemaTables}
              onUpdateGenerator={(idx, gen) => handleUpdateGenerator(idx, gen)}
              onUpdateParam={(idx, key, val) => handleUpdateParam(idx, key, val)}
              onToggleConstant={(idx) => handleToggleConstant(idx)}
              onSetConstantValue={(idx, val) => handleSetConstantValue(idx, val)}
            />
          )}

          {/* Preview */}
          {showPreview && columns.length > 0 && (
            <PreviewTable columns={columns} />
          )}
        </>
      )}

      {/* ════════════════════ MULTI-TABLE MODE ════════════════════ */}
      {mode === 'multi' && (
        <>
          {/* Add Tables */}
          <div className="flex items-center gap-3">
            <select
              onChange={e => { handleAddMultiTable(e.target.value); e.target.value = ''; }}
              value=""
              disabled={tablesLoading}
              className="flex-1 text-sm border border-border rounded-lg px-3 py-2.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-aqua-500/30"
            >
              <option value="">+ Add table to generation chain...</option>
              {schemaTables?.filter((t: Table) => !multiTables.some(mt => mt.tableName === t.name)).map((t: Table) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.columns.length} cols)
                </option>
              ))}
            </select>
            <button
              onClick={handleAutoDetectFKChain}
              disabled={!schemaTables || !relationships}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              Auto-Detect FK Chain
            </button>
          </div>

          {/* Multi-table Insert Order Info */}
          {multiTables.length > 1 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Link2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Insert Order (Topologically Sorted)</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  {resolveInsertOrder(multiTables).map((t, i) => (
                    <span key={t.tableName}>
                      {i > 0 && ' → '}
                      <strong>{t.tableName}</strong>
                      <span className="text-blue-500"> ({t.rowCount.toLocaleString()})</span>
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )}

          {/* Table Cards */}
          {multiTables.map((tbl, tblIdx) => (
            <div key={tbl.tableName} className="border border-border rounded-lg overflow-hidden bg-card">
              {/* Table Header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border cursor-pointer"
                onClick={() => handleToggleMultiTable(tblIdx)}
              >
                <div className="flex items-center gap-3">
                  {tbl.expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <Database className="w-4 h-4 text-aqua-600" />
                  <span className="text-sm font-semibold text-foreground">{tbl.tableName}</span>
                  <span className="text-xs text-muted-foreground">{tbl.columns.length} columns</span>
                  {tbl.columns.some(c => c.isForeignKey) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:text-amber-300 rounded-full">
                      <Link2 className="w-3 h-3" /> FK refs
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Rows:</label>
                    <input
                      type="number"
                      value={tbl.rowCount}
                      onChange={e => handleUpdateMultiTableRows(tblIdx, parseInt(e.target.value) || 100)}
                      min={1}
                      className="w-24 text-xs border border-border rounded px-2 py-1 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveMultiTable(tblIdx)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Table Body */}
              {tbl.expanded && (
                <div className="p-4">
                  <ColumnConfigTable
                    columns={tbl.columns}
                    schemaTables={schemaTables}
                    onUpdateGenerator={(idx, gen) => handleUpdateGenerator(idx, gen, tblIdx)}
                    onUpdateParam={(idx, key, val) => handleUpdateParam(idx, key, val, tblIdx)}
                    onToggleConstant={(idx) => handleToggleConstant(idx, tblIdx)}
                    onSetConstantValue={(idx, val) => handleSetConstantValue(idx, val, tblIdx)}
                  />
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ════════════════════ FK TYPE MISMATCH WARNINGS ════════════════════ */}
      {fkTypeMismatches.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="w-4 h-4" />
            FK Type Mismatch — Fix before generating
          </div>
          {fkTypeMismatches.map((err, i) => (
            <p key={i} className="text-xs text-red-700 ml-6">
              <span className="font-mono font-medium">{err.table}.{err.column}</span>: {err.message}
            </p>
          ))}
        </div>
      )}

      {/* ════════════════════ ACTION BUTTONS ════════════════════ */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={(mode === 'single' ? !tableName.trim() : multiTables.length === 0) || fkTypeMismatches.length > 0}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            (mode === 'single' && !tableName.trim()) || (mode === 'multi' && multiTables.length === 0) || fkTypeMismatches.length > 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          <Play className="w-4 h-4" />
          Generate {scriptStyle === 'bulk' ? 'Bulk' : 'Individual'} SQL
        </button>

        {mode === 'single' && columns.length > 0 && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Hash className="w-3.5 h-3.5" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
        )}

        {generatedSQL && (
          <>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy SQL'}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download .sql
            </button>
          </>
        )}
      </div>

      {/* ════════════════════ GENERATED SQL + EXECUTION PLAN ════════════════════ */}
      {generatedSQL && (() => {
        const activeTables = mode === 'single'
          ? (tableName ? [{ tableName, rowCount: effectiveRowCount, columns, expanded: true }] : [])
          : multiTables;
        const ordered = resolveInsertOrder(activeTables);
        // Collect FK edges: { from: parentTable, to: childTable, fkCol, refCol }
        const fkEdges: Array<{ from: string; to: string; fkCol: string; refCol: string }> = [];
        for (const t of activeTables) {
          for (const col of t.columns) {
            if (col.generator === 'FK Reference' && col.params.refTable && col.params.refColumn) {
              fkEdges.push({
                from: col.params.refTable,
                to: t.tableName,
                fkCol: col.name,
                refCol: col.params.refColumn,
              });
            }
          }
        }
        const hasFKs = fkEdges.length > 0;

        return (
        <div className={cn(
          'grid gap-6',
          hasFKs ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'
        )}>
          {/* SQL Output */}
          <div className={hasFKs ? 'lg:col-span-2' : ''}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-foreground">
                Generated PostgreSQL Script ({scriptStyle === 'bulk' ? 'Bulk' : 'Individual'})
              </h4>
              <span className="text-[10px] text-muted-foreground">{generatedSQL.split('\n').length} lines</span>
            </div>
            <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
              <pre className="p-4 text-xs text-green-400 font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre leading-relaxed">
                {generatedSQL}
              </pre>
            </div>
          </div>

          {/* Execution Plan & FK Diagram */}
          {hasFKs && (
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-foreground">Execution Plan</h4>
                <span className="text-[10px] text-muted-foreground">{ordered.length} tables</span>
              </div>
              <div className="border border-border rounded-lg bg-card overflow-hidden">
                {/* Execution Order */}
                <div className="px-4 py-3 bg-muted/50 border-b border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Execution Order (Topological Sort)
                  </p>
                  <div className="space-y-0">
                    {ordered.map((t, idx) => {
                      const tableEdges = fkEdges.filter(e => e.to === t.tableName);
                      const isParent = fkEdges.some(e => e.from === t.tableName);
                      const isChild = tableEdges.length > 0;
                      return (
                        <div key={t.tableName}>
                          <div className="flex items-center gap-2 py-1.5">
                            {/* Step Number */}
                            <span className={cn(
                              'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                              isParent && !isChild
                                ? 'bg-blue-100 text-blue-700 dark:text-blue-300'
                                : isChild
                                  ? 'bg-amber-100 text-amber-700 dark:text-amber-300'
                                  : 'bg-muted text-muted-foreground'
                            )}>
                              {idx + 1}
                            </span>
                            {/* Table Name */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Database className={cn(
                                  'w-3 h-3 flex-shrink-0',
                                  isParent && !isChild ? 'text-blue-500' : isChild ? 'text-amber-500' : 'text-muted-foreground'
                                )} />
                                <span className="text-xs font-semibold text-foreground truncate">{t.tableName}</span>
                              </div>
                              <div className="flex items-center gap-2 ml-4.5 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {t.rowCount.toLocaleString()} rows
                                </span>
                                {isParent && !isChild && (
                                  <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    Parent
                                  </span>
                                )}
                                {isChild && isParent && (
                                  <span className="text-[9px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                    Parent + Child
                                  </span>
                                )}
                                {isChild && !isParent && (
                                  <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                    Child
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Arrow between steps */}
                          {idx < ordered.length - 1 && (
                            <div className="flex items-center ml-2 py-0.5">
                              <div className="w-0.5 h-3 bg-muted-foreground/40 ml-[9px]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* FK Relationships */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    FK Relationships
                  </p>
                  <div className="space-y-2">
                    {fkEdges.map((edge, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                        {/* Parent */}
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300 font-mono">
                          <Lock className="w-2.5 h-2.5" />
                          <span className="font-semibold">{edge.from}</span>
                          <span className="text-blue-500">.{edge.refCol}</span>
                        </div>
                        {/* Arrow */}
                        <div className="flex items-center text-muted-foreground">
                          <div className="w-3 h-px bg-muted-foreground/40" />
                          <svg className="w-2.5 h-2.5 text-muted-foreground -ml-px" fill="none" viewBox="0 0 8 8">
                            <path d="M1 1l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        {/* Child */}
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-300 font-mono">
                          <Link2 className="w-2.5 h-2.5" />
                          <span className="font-semibold">{edge.to}</span>
                          <span className="text-amber-500">.{edge.fkCol}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="px-4 py-2.5 bg-muted/50 border-t border-border">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{ordered.length} tables · {fkEdges.length} FK reference{fkEdges.length !== 1 ? 's' : ''}</span>
                    <span>
                      Total: {ordered.reduce((sum, t) => sum + t.rowCount, 0).toLocaleString()} rows
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* ════════════════════ TEST & PREVIEW PANEL ════════════════════ */}
      <DatagenTestPanel
        generatedSQL={generatedSQL}
        tables={
          mode === 'single'
            ? (tableName ? [{ tableName, rowCount: effectiveRowCount, columns, expanded: true }] : [])
            : multiTables
        }
        generateSampleValue={generateSampleValue}
      />
    </div>
  );
}

// ── Column Config Table Sub-Component ────────────────────────────────────────

function ColumnConfigTable({
  columns,
  schemaTables,
  onUpdateGenerator,
  onUpdateParam,
  onToggleConstant,
  onSetConstantValue,
}: {
  columns: ColumnConfig[];
  schemaTables?: Table[];
  onUpdateGenerator: (index: number, generator: string) => void;
  onUpdateParam: (index: number, key: string, value: string) => void;
  onToggleConstant: (index: number) => void;
  onSetConstantValue: (index: number, value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Columns3 className="w-3.5 h-3.5" />
          Column Configuration
        </label>
        <span className="text-[10px] text-muted-foreground">
          {columns.length} column{columns.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">Column</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-4">Generator</div>
          <div className="col-span-2">Constant</div>
          <div className="col-span-2">Badges</div>
        </div>

        {/* Rows */}
        {columns.map((colCfg, idx) => {
          const genDef = GENERATOR_DEF_MAP.get(colCfg.generator);
          const isFKRef = colCfg.generator === 'FK Reference';
          const hasParams = !isFKRef && genDef?.params && genDef.params.length > 0;
          const hasJava = !!genDef?.javaExpression;

          return (
            <div key={idx} className="border-b border-border/50 last:border-b-0">
              {/* Main Row */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-muted/30">
                <div className="col-span-2">
                  <span className="text-sm font-mono text-foreground">{colCfg.name}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded truncate block">
                    {colCfg.type}
                  </span>
                </div>
                <div className="col-span-4">
                  <select
                    value={colCfg.generator}
                    onChange={e => onUpdateGenerator(idx, e.target.value)}
                    disabled={colCfg.isConstant}
                    className={cn(
                      'w-full text-xs border border-border rounded px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30',
                      colCfg.isConstant && 'opacity-50'
                    )}
                  >
                    {GENERATOR_CATEGORIES.map(cat => (
                      <optgroup key={cat.label} label={cat.label}>
                        {cat.generators.map(gen => (
                          <option key={gen.name} value={gen.name}>{gen.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleConstant(idx)}
                      className={cn(
                        'w-8 h-4 rounded-full transition-colors relative',
                        colCfg.isConstant ? 'bg-aqua-500' : 'bg-muted-foreground/40'
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all',
                        colCfg.isConstant ? 'left-4' : 'left-0.5'
                      )} />
                    </button>
                    {colCfg.isConstant && (
                      <input
                        type="text"
                        value={colCfg.constantValue || ''}
                        onChange={e => onSetConstantValue(idx, e.target.value)}
                        placeholder="Value"
                        className="w-20 text-[11px] border border-border rounded px-1.5 py-0.5 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                      />
                    )}
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-1 flex-wrap">
                  {colCfg.isPrimaryKey && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 dark:text-blue-300 rounded">
                      <Lock className="w-2.5 h-2.5" /> PK
                    </span>
                  )}
                  {colCfg.isForeignKey && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 dark:text-amber-300 rounded">
                      <Link2 className="w-2.5 h-2.5" /> FK
                    </span>
                  )}
                </div>
              </div>

              {/* FK Reference Custom Dropdown UI */}
              {!colCfg.isConstant && isFKRef && (() => {
                // Type compatibility check
                const selectedParentTable = schemaTables?.find((t: Table) => t.name === colCfg.params.refTable);
                const selectedParentCol = selectedParentTable?.columns.find((c: Column) => c.name === colCfg.params.refColumn);
                const typeCheck = selectedParentCol
                  ? checkFKTypeCompatibility(colCfg.type, selectedParentCol.dataType)
                  : null;

                return (
                <div className="px-4 pb-2.5 pt-0">
                  <div className={cn(
                    'ml-[16.67%] pl-3 border-l-2 flex items-center gap-3 flex-wrap',
                    typeCheck && !typeCheck.compatible ? 'border-red-400' : 'border-amber-300'
                  )}>
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                        Parent Table:
                      </label>
                      <select
                        value={colCfg.params.refTable || ''}
                        onChange={e => {
                          onUpdateParam(idx, 'refTable', e.target.value);
                          // Auto-select first type-compatible PK column of selected table
                          const selTable = schemaTables?.find((t: Table) => t.name === e.target.value);
                          if (selTable) {
                            // Try to find a compatible PK column first
                            const compatiblePK = selTable.columns.find((c: Column) =>
                              c.isPrimaryKey && checkFKTypeCompatibility(colCfg.type, c.dataType).compatible
                            );
                            if (compatiblePK) {
                              onUpdateParam(idx, 'refColumn', compatiblePK.name);
                            } else {
                              // Fall back to any PK
                              const pkCol = selTable.columns.find((c: Column) => c.isPrimaryKey);
                              if (pkCol) onUpdateParam(idx, 'refColumn', pkCol.name);
                            }
                          }
                        }}
                        className="text-[11px] border border-amber-200 rounded px-1.5 py-1 bg-amber-50 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-400/50 min-w-[140px]"
                      >
                        <option value="">-- Select parent table --</option>
                        {schemaTables?.map((t: Table) => (
                          <option key={t.id} value={t.name}>
                            {t.name} ({t.columns.length} cols)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                        Parent Column:
                      </label>
                      <select
                        value={colCfg.params.refColumn || ''}
                        onChange={e => onUpdateParam(idx, 'refColumn', e.target.value)}
                        className={cn(
                          'text-[11px] border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 min-w-[120px]',
                          typeCheck && !typeCheck.compatible
                            ? 'border-red-300 bg-red-50 focus:ring-red-400/50'
                            : 'border-amber-200 bg-amber-50 focus:ring-amber-400/50'
                        )}
                        disabled={!colCfg.params.refTable}
                      >
                        <option value="">-- Select column --</option>
                        {schemaTables
                          ?.find((t: Table) => t.name === colCfg.params.refTable)
                          ?.columns.map((c: Column) => {
                            const compat = checkFKTypeCompatibility(colCfg.type, c.dataType);
                            return (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.dataType}){c.isPrimaryKey ? ' [PK]' : ''}{c.isUnique ? ' [UQ]' : ''}{!compat.compatible ? ' ⚠ type mismatch' : ''}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    {colCfg.params.refTable && colCfg.params.refColumn && typeCheck && (
                      typeCheck.compatible ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded border border-green-200">
                          <Link2 className="w-3 h-3" />
                          {colCfg.name} → {colCfg.params.refTable}.{colCfg.params.refColumn}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded border border-red-200">
                          <AlertTriangle className="w-3 h-3" />
                          {typeCheck.message}
                        </span>
                      )
                    )}
                  </div>
                </div>
                );
              })()}

              {/* Standard Parameter Sub-Row */}
              {!colCfg.isConstant && !isFKRef && (hasParams || hasJava) && (
                <div className="px-4 pb-2.5 pt-0">
                  <div className="ml-[16.67%] pl-3 border-l-2 border-aqua-200 flex items-center gap-2.5 flex-wrap">
                    {genDef?.params?.map(paramDef => (
                      <div key={paramDef.key} className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                          {paramDef.label}:
                        </label>
                        {paramDef.type === 'select' ? (
                          <select
                            value={colCfg.params[paramDef.key] ?? paramDef.defaultValue ?? ''}
                            onChange={e => onUpdateParam(idx, paramDef.key, e.target.value)}
                            className="text-[11px] border border-border rounded px-1.5 py-0.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                          >
                            {paramDef.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={paramDef.type}
                            value={colCfg.params[paramDef.key] ?? paramDef.defaultValue ?? ''}
                            onChange={e => onUpdateParam(idx, paramDef.key, e.target.value)}
                            placeholder={paramDef.placeholder}
                            className={cn(
                              'text-[11px] font-mono border border-border rounded px-1.5 py-0.5 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aqua-500/30',
                              paramDef.width || 'w-24',
                            )}
                          />
                        )}
                      </div>
                    ))}
                    {hasJava && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 dark:text-amber-300 rounded font-mono max-w-[280px] truncate border border-amber-200">
                        <Coffee className="w-3 h-3 flex-shrink-0" />
                        {genDef!.javaExpression}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Preview Table Sub-Component ──────────────────────────────────────────────

function PreviewTable({ columns }: { columns: ColumnConfig[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Sample Preview (5 rows)</h4>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              {columns.map((c, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                  {c.name}
                  {c.isPrimaryKey && <Lock className="w-2.5 h-2.5 inline ml-1 text-blue-500" />}
                  {c.isForeignKey && <Link2 className="w-2.5 h-2.5 inline ml-1 text-amber-500" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border/50 last:border-b-0 hover:bg-muted/30">
                {columns.map((c, colIdx) => (
                  <td key={colIdx} className="px-3 py-2 text-foreground font-mono whitespace-nowrap">
                    {generateSampleValue(c.generator, c.params, rowIdx, c.isConstant, c.constantValue)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SyntheticDataGenerator;
