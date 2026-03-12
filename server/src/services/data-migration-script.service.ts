import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { createCSVReadStream, countCSVRows } from './csv-parser.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataSheetMapping {
  csvHeader: string;
  sourceColumn: string;
}

export interface ColumnMapping {
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

export interface TargetColumnDef {
  name: string;
  dataType: string;
}

export interface TableMigrationConfig {
  sourceTableName: string;
  targetTableName: string;
  csvFilePath: string;
  csvDelimiter?: string;
  dataSheetMappings: DataSheetMapping[];
  columnMappings: ColumnMapping[];
  targetColumns: TargetColumnDef[];
}

export interface ScriptGenerationConfig {
  projectId: string;
  targetDialect: string;
  tables: TableMigrationConfig[];
  batchSize: number;
  disableFKConstraints: boolean;
  includeTransaction: boolean;
}

export interface GenerationProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentTable: string;
  tablesCompleted: number;
  totalTables: number;
  rowsProcessed: number;
  totalRowsEstimated: number;
  outputFilePath?: string;
  outputFileName?: string;
  fileSize?: number;
  error?: string;
  generationTimeMs?: number;
  tableStats?: Array<{
    tableName: string;
    rowCount: number;
    batchCount: number;
  }>;
}

export interface ScriptGenerationResult {
  outputFilePath: string;
  outputFileName: string;
  fileSize: number;
  totalRows: number;
  totalTables: number;
  generationTimeMs: number;
  tableStats: Array<{
    tableName: string;
    rowCount: number;
    batchCount: number;
  }>;
}

// ── Progress Map ─────────────────────────────────────────────────────────────

export const progressMap = new Map<string, GenerationProgress>();

// ── SQL Escaping ─────────────────────────────────────────────────────────────

export function escapeSQLString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

// ── Quote Identifier ─────────────────────────────────────────────────────────

function quoteIdentifier(name: string, dialect: string): string {
  switch (dialect) {
    case 'mysql':
    case 'mariadb':
      return `\`${name}\``;
    case 'sqlserver':
      return `[${name}]`;
    default:
      return `"${name}"`;
  }
}

// ── SQL Value Formatting ─────────────────────────────────────────────────────

const NUMERIC_TYPES = new Set([
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'SERIAL', 'BIGSERIAL', 'SMALLSERIAL', 'NUMBER', 'FLOAT', 'DOUBLE',
  'REAL', 'DECIMAL', 'NUMERIC', 'MONEY', 'SMALLMONEY', 'BIT',
  'INT64', 'FLOAT64', 'FLOAT4', 'FLOAT8', 'BYTEINT',
  'BINARY_FLOAT', 'BINARY_DOUBLE', 'BIGNUMERIC', 'DOUBLE PRECISION',
]);

const BOOLEAN_TYPES = new Set(['BOOLEAN', 'BOOL']);

export function formatSQLValue(
  value: string | null | undefined,
  dataType: string,
  _dialect: string,
): string {
  if (value === null || value === undefined || value === '') return 'NULL';

  const normalizedType = dataType.toUpperCase().replace(/\([^)]*\)/g, '').trim();

  if (NUMERIC_TYPES.has(normalizedType)) {
    const trimmed = value.trim();
    if (trimmed === '') return 'NULL';
    const num = Number(trimmed);
    if (isNaN(num)) return 'NULL';
    return trimmed; // preserve original precision
  }

  if (BOOLEAN_TYPES.has(normalizedType)) {
    const lower = value.toLowerCase().trim();
    if (['true', '1', 'yes', 't', 'y'].includes(lower)) return 'TRUE';
    if (['false', '0', 'no', 'f', 'n'].includes(lower)) return 'FALSE';
    return 'NULL';
  }

  // BIT type for SQL Server
  if (normalizedType === 'BIT') {
    const lower = value.toLowerCase().trim();
    if (['true', '1', 'yes', 't', 'y'].includes(lower)) return '1';
    if (['false', '0', 'no', 'f', 'n'].includes(lower)) return '0';
    return 'NULL';
  }

  // String, date, and everything else: escape and quote
  return `'${escapeSQLString(value)}'`;
}

// ── Apply Transformation ─────────────────────────────────────────────────────

export function applyTransformation(
  rawValue: string | null | undefined,
  mapping: ColumnMapping,
  targetDataType: string,
  dialect: string,
): string {
  // Null handling
  const isEmpty = rawValue === null || rawValue === undefined || rawValue === '';

  if (isEmpty) {
    if (mapping.nullHandling === 'default' && mapping.defaultValue) {
      return formatSQLValue(mapping.defaultValue, targetDataType, dialect);
    }
    if (mapping.nullHandling === 'skip') {
      return '__SKIP_ROW__';
    }
    return 'NULL';
  }

  switch (mapping.transformationType) {
    case 'direct':
    case 'rename':
      return formatSQLValue(rawValue, targetDataType, dialect);

    case 'cast': {
      const castType = mapping.castTo || targetDataType;
      const formatted = formatSQLValue(rawValue, targetDataType, dialect);
      if (formatted === 'NULL') return 'NULL';
      return `CAST(${formatted} AS ${castType})`;
    }

    case 'expression': {
      if (!mapping.expression) {
        return formatSQLValue(rawValue, targetDataType, dialect);
      }
      // Replace column reference in expression with the actual value
      const formatted = formatSQLValue(rawValue, targetDataType, dialect);
      return mapping.expression.replace(
        new RegExp(`\\b${mapping.sourceColumn}\\b`, 'g'),
        formatted,
      );
    }

    case 'default':
      return formatSQLValue(
        mapping.defaultValue ?? rawValue ?? '',
        targetDataType,
        dialect,
      );

    default:
      return formatSQLValue(rawValue, targetDataType, dialect);
  }
}

// ── FK Constraint SQL ────────────────────────────────────────────────────────

export function getDisableFKSQL(dialect: string, tables: string[]): string {
  const lines: string[] = [];

  switch (dialect) {
    case 'mysql':
    case 'mariadb':
      lines.push('SET FOREIGN_KEY_CHECKS = 0;');
      break;
    case 'postgresql':
      for (const t of tables) {
        lines.push(`ALTER TABLE ${quoteIdentifier(t, dialect)} DISABLE TRIGGER ALL;`);
      }
      break;
    case 'sqlserver':
      for (const t of tables) {
        lines.push(`ALTER TABLE ${quoteIdentifier(t, dialect)} NOCHECK CONSTRAINT ALL;`);
      }
      break;
    case 'oracle':
      lines.push('-- Oracle: Disable FK constraints');
      lines.push('BEGIN');
      lines.push("  FOR c IN (SELECT constraint_name, table_name FROM user_constraints WHERE constraint_type = 'R') LOOP");
      lines.push("    EXECUTE IMMEDIATE 'ALTER TABLE ' || c.table_name || ' DISABLE CONSTRAINT ' || c.constraint_name;");
      lines.push('  END LOOP;');
      lines.push('END;');
      lines.push('/');
      break;
    default:
      lines.push(`-- FK constraint disable not implemented for dialect: ${dialect}`);
  }

  return lines.join('\n');
}

export function getEnableFKSQL(dialect: string, tables: string[]): string {
  const lines: string[] = [];

  switch (dialect) {
    case 'mysql':
    case 'mariadb':
      lines.push('SET FOREIGN_KEY_CHECKS = 1;');
      break;
    case 'postgresql':
      for (const t of tables) {
        lines.push(`ALTER TABLE ${quoteIdentifier(t, dialect)} ENABLE TRIGGER ALL;`);
      }
      break;
    case 'sqlserver':
      for (const t of tables) {
        lines.push(`ALTER TABLE ${quoteIdentifier(t, dialect)} CHECK CONSTRAINT ALL;`);
      }
      break;
    case 'oracle':
      lines.push('-- Oracle: Re-enable FK constraints');
      lines.push('BEGIN');
      lines.push("  FOR c IN (SELECT constraint_name, table_name FROM user_constraints WHERE constraint_type = 'R') LOOP");
      lines.push("    EXECUTE IMMEDIATE 'ALTER TABLE ' || c.table_name || ' ENABLE CONSTRAINT ' || c.constraint_name;");
      lines.push('  END LOOP;');
      lines.push('END;');
      lines.push('/');
      break;
    default:
      lines.push(`-- FK constraint enable not implemented for dialect: ${dialect}`);
  }

  return lines.join('\n');
}

// ── Ensure Output Directory ──────────────────────────────────────────────────

function ensureGeneratedDir(): string {
  const dir = path.resolve(env.UPLOAD_DIR, 'generated');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Generate Migration Script ────────────────────────────────────────────────

export async function generateMigrationScript(
  config: ScriptGenerationConfig,
  jobId: string,
): Promise<ScriptGenerationResult> {
  const startTime = Date.now();
  const { targetDialect, tables, batchSize, disableFKConstraints, includeTransaction } = config;

  // Initialize progress
  progressMap.set(jobId, {
    status: 'processing',
    currentTable: '',
    tablesCompleted: 0,
    totalTables: tables.length,
    rowsProcessed: 0,
    totalRowsEstimated: 0,
  });

  // Count total rows across all tables
  let totalRowsEstimated = 0;
  for (const table of tables) {
    try {
      const count = await countCSVRows(table.csvFilePath);
      totalRowsEstimated += count;
    } catch {
      // If count fails, estimate from file size
      try {
        const stat = fs.statSync(table.csvFilePath);
        totalRowsEstimated += Math.max(1, Math.floor(stat.size / 100));
      } catch {
        totalRowsEstimated += 0;
      }
    }
  }

  progressMap.set(jobId, {
    ...progressMap.get(jobId)!,
    totalRowsEstimated,
  });

  // Prepare output file
  const outputDir = ensureGeneratedDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFileName = `data-migration-${timestamp}.sql`;
  const outputFilePath = path.join(outputDir, outputFileName);
  const writeStream = fs.createWriteStream(outputFilePath, { encoding: 'utf-8' });

  const tableStats: Array<{ tableName: string; rowCount: number; batchCount: number }> = [];
  let totalRowsProcessed = 0;

  try {
    // ── Write header ─────────────────────────────────────────────────────
    const allTargetTables = tables.map((t) => t.targetTableName);

    writeStream.write('-- ============================================================================\n');
    writeStream.write('-- DATA MIGRATION SCRIPT\n');
    writeStream.write('-- Generated by Aqua DB Copilot\n');
    writeStream.write(`-- Date: ${new Date().toISOString()}\n`);
    writeStream.write(`-- Target Dialect: ${targetDialect}\n`);
    writeStream.write(`-- Tables: ${tables.length} | Estimated Rows: ~${totalRowsEstimated.toLocaleString()} | Batch Size: ${batchSize.toLocaleString()}\n`);
    writeStream.write('-- ============================================================================\n\n');

    // ── Write migration order ────────────────────────────────────────────
    writeStream.write('-- Migration Order:\n');
    tables.forEach((t, i) => {
      writeStream.write(`--   ${i + 1}. ${t.targetTableName} (source: ${t.sourceTableName})\n`);
    });
    writeStream.write('\n');

    // ── Disable FK constraints ───────────────────────────────────────────
    if (disableFKConstraints) {
      writeStream.write('-- ============================================================================\n');
      writeStream.write('-- DISABLE FOREIGN KEY CONSTRAINTS\n');
      writeStream.write('-- ============================================================================\n');
      writeStream.write(getDisableFKSQL(targetDialect, allTargetTables));
      writeStream.write('\n\n');
    }

    // ── Process each table ───────────────────────────────────────────────
    for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
      const tableConfig = tables[tableIdx];

      progressMap.set(jobId, {
        ...progressMap.get(jobId)!,
        currentTable: tableConfig.targetTableName,
        tablesCompleted: tableIdx,
      });

      // Build CSV header → source column lookup
      const csvToSource = new Map<string, string>();
      for (const dsm of tableConfig.dataSheetMappings) {
        csvToSource.set(dsm.csvHeader, dsm.sourceColumn);
      }

      // Build source column → column mapping lookup
      const sourceToMapping = new Map<string, ColumnMapping>();
      for (const cm of tableConfig.columnMappings) {
        sourceToMapping.set(cm.sourceColumn, cm);
      }

      // Build target column data types lookup
      const targetDataTypes = new Map<string, string>();
      for (const tc of tableConfig.targetColumns) {
        targetDataTypes.set(tc.name, tc.dataType);
      }

      // Determine ordered target columns from mappings
      const orderedMappings = tableConfig.columnMappings.filter((cm) => {
        // Only include mappings that have a CSV header mapped to their source column
        const hasCsvMapping = Array.from(csvToSource.values()).includes(cm.sourceColumn);
        return hasCsvMapping || cm.transformationType === 'default';
      });

      const targetColNames = orderedMappings.map((cm) => cm.targetColumn);
      const quotedTargetCols = targetColNames.map((c) => quoteIdentifier(c, targetDialect));

      // Write table header
      writeStream.write('-- ============================================================================\n');
      writeStream.write(`-- TABLE: ${tableConfig.targetTableName}\n`);
      writeStream.write(`-- Source: ${tableConfig.sourceTableName} (CSV)\n`);
      writeStream.write('-- ============================================================================\n\n');

      // Stream CSV rows and generate INSERT statements
      const delimiter = tableConfig.csvDelimiter || ',';
      const stream = createCSVReadStream(tableConfig.csvFilePath, { delimiter });

      let tableRowCount = 0;
      let batchCount = 0;
      let batchRows: string[] = [];

      const flushBatch = () => {
        if (batchRows.length === 0) return;
        batchCount++;

        const totalBatches = Math.ceil(totalRowsEstimated / batchSize) || 1;

        writeStream.write(`-- Batch ${batchCount} (${batchRows.length} rows)\n`);
        if (includeTransaction) {
          writeStream.write('BEGIN;\n');
        }
        writeStream.write(`INSERT INTO ${quoteIdentifier(tableConfig.targetTableName, targetDialect)} (${quotedTargetCols.join(', ')}) VALUES\n`);
        writeStream.write(batchRows.join(',\n'));
        writeStream.write(';\n');
        if (includeTransaction) {
          writeStream.write('COMMIT;\n');
        }
        writeStream.write('\n');
        batchRows = [];
      };

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (csvRow: Record<string, string>) => {
          // Transform each row through the two-level mapping chain
          const values: string[] = [];
          let skipRow = false;

          for (const cm of orderedMappings) {
            // Find the CSV header that maps to this source column
            let csvValue: string | undefined;

            if (cm.transformationType === 'default') {
              // Default transformation doesn't need CSV data
              csvValue = undefined;
            } else {
              // Find CSV header → source column
              for (const [header, srcCol] of csvToSource) {
                if (srcCol === cm.sourceColumn) {
                  csvValue = csvRow[header];
                  break;
                }
              }
            }

            const targetType = targetDataTypes.get(cm.targetColumn) || 'VARCHAR';
            const transformed = applyTransformation(csvValue, cm, targetType, targetDialect);

            if (transformed === '__SKIP_ROW__') {
              skipRow = true;
              break;
            }

            values.push(transformed);
          }

          if (skipRow) return;

          batchRows.push(`  (${values.join(', ')})`);
          tableRowCount++;
          totalRowsProcessed++;

          // Update progress every 1000 rows
          if (tableRowCount % 1000 === 0) {
            progressMap.set(jobId, {
              ...progressMap.get(jobId)!,
              rowsProcessed: totalRowsProcessed,
            });
          }

          if (batchRows.length >= batchSize) {
            flushBatch();
          }
        });

        stream.on('end', () => {
          flushBatch(); // flush remaining rows
          resolve();
        });

        stream.on('error', reject);
      });

      tableStats.push({
        tableName: tableConfig.targetTableName,
        rowCount: tableRowCount,
        batchCount,
      });

      writeStream.write(`-- ${tableConfig.targetTableName}: ${tableRowCount.toLocaleString()} rows in ${batchCount} batch(es)\n\n`);
    }

    // ── Re-enable FK constraints ─────────────────────────────────────────
    if (disableFKConstraints) {
      writeStream.write('-- ============================================================================\n');
      writeStream.write('-- RE-ENABLE FOREIGN KEY CONSTRAINTS\n');
      writeStream.write('-- ============================================================================\n');
      writeStream.write(getEnableFKSQL(targetDialect, tables.map((t) => t.targetTableName)));
      writeStream.write('\n\n');
    }

    // ── Write summary ────────────────────────────────────────────────────
    const generationTimeMs = Date.now() - startTime;
    const totalBatches = tableStats.reduce((sum, s) => sum + s.batchCount, 0);

    writeStream.write('-- ============================================================================\n');
    writeStream.write('-- MIGRATION SUMMARY\n');
    writeStream.write('-- ============================================================================\n');
    for (const stat of tableStats) {
      writeStream.write(`-- ${stat.tableName}: ${stat.rowCount.toLocaleString()} rows (${stat.batchCount} batches)\n`);
    }
    writeStream.write(`-- Total: ${totalRowsProcessed.toLocaleString()} rows | ${totalBatches} batches | Generated in ${(generationTimeMs / 1000).toFixed(1)}s\n`);
    writeStream.write('-- ============================================================================\n');

    // Close the write stream
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    const fileStat = fs.statSync(outputFilePath);

    const result: ScriptGenerationResult = {
      outputFilePath,
      outputFileName,
      fileSize: fileStat.size,
      totalRows: totalRowsProcessed,
      totalTables: tables.length,
      generationTimeMs,
      tableStats,
    };

    // Update progress to completed
    progressMap.set(jobId, {
      status: 'completed',
      currentTable: '',
      tablesCompleted: tables.length,
      totalTables: tables.length,
      rowsProcessed: totalRowsProcessed,
      totalRowsEstimated,
      outputFilePath,
      outputFileName,
      fileSize: fileStat.size,
      generationTimeMs,
      tableStats,
    });

    logger.info(`Data migration script generated: ${outputFileName}, ${totalRowsProcessed} rows, ${(generationTimeMs / 1000).toFixed(1)}s`);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Data migration script generation failed: ${errorMsg}`);

    progressMap.set(jobId, {
      ...progressMap.get(jobId)!,
      status: 'failed',
      error: errorMsg,
    });

    // Clean up partial file
    writeStream.end();
    try {
      if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
    } catch { /* ignore cleanup errors */ }

    throw error;
  }
}
