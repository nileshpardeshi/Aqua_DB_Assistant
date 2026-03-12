// ---------------------------------------------------------------------------
// Schema Export Service – Generates DDL from stored schema metadata
// ---------------------------------------------------------------------------

import { prisma } from '../config/prisma.js';

interface ExportOptions {
  dialect: string;
  includeIndexes?: boolean;
  includeForeignKeys?: boolean;
  includeComments?: boolean;
}

/**
 * Generate a complete DDL script for all tables in a project.
 */
export async function generateDDL(
  projectId: string,
  options: ExportOptions,
): Promise<string> {
  const { dialect, includeIndexes = true, includeForeignKeys = true } = options;

  const tables = await prisma.tableMetadata.findMany({
    where: { projectId },
    include: {
      columns: { orderBy: { ordinalPosition: 'asc' } },
      indexes: true,
      outgoingRelationships: {
        include: { targetTable: true },
      },
    },
    orderBy: [{ schemaName: 'asc' }, { tableName: 'asc' }],
  });

  if (tables.length === 0) {
    return '-- No tables found in this project\n';
  }

  const parts: string[] = [];
  const fkStatements: string[] = [];

  parts.push(`-- DDL Export for project`);
  parts.push(`-- Dialect: ${dialect}`);
  parts.push(`-- Generated: ${new Date().toISOString()}`);
  parts.push(`-- Tables: ${tables.length}`);
  parts.push('');

  for (const table of tables) {
    const qualifiedName = table.schemaName && table.schemaName !== 'public'
      ? `${quoteIdentifier(table.schemaName, dialect)}.${quoteIdentifier(table.tableName, dialect)}`
      : quoteIdentifier(table.tableName, dialect);

    const lines: string[] = [];
    lines.push(`CREATE TABLE ${qualifiedName} (`);

    const columnDefs: string[] = [];
    const pkColumns: string[] = [];

    for (const col of table.columns) {
      const parts: string[] = [];
      parts.push(`  ${quoteIdentifier(col.columnName, dialect)}`);
      parts.push(formatDataType(col, dialect));

      if (!col.isNullable) parts.push('NOT NULL');
      if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);

      if (col.isPrimaryKey) {
        pkColumns.push(col.columnName);
      }

      columnDefs.push(parts.join(' '));
    }

    // Add primary key constraint
    if (pkColumns.length > 0) {
      const pkCols = pkColumns.map(c => quoteIdentifier(c, dialect)).join(', ');
      columnDefs.push(`  CONSTRAINT pk_${table.tableName} PRIMARY KEY (${pkCols})`);
    }

    lines.push(columnDefs.join(',\n'));
    lines.push(');');
    parts.push(lines.join('\n'));

    // Indexes
    if (includeIndexes) {
      const nonPkIndexes = table.indexes.filter(idx => !idx.isPrimary);
      for (const idx of nonPkIndexes) {
        const uniqueStr = idx.isUnique ? 'UNIQUE ' : '';
        const cols = idx.columns; // stored as comma-separated string
        parts.push(
          `CREATE ${uniqueStr}INDEX ${quoteIdentifier(idx.indexName, dialect)} ON ${qualifiedName} (${cols});`
        );
      }
    }

    // Foreign keys (collected for ALTER TABLE statements at the end)
    if (includeForeignKeys) {
      for (const rel of table.outgoingRelationships) {
        const targetName = rel.targetTable.schemaName && rel.targetTable.schemaName !== 'public'
          ? `${quoteIdentifier(rel.targetTable.schemaName, dialect)}.${quoteIdentifier(rel.targetTable.tableName, dialect)}`
          : quoteIdentifier(rel.targetTable.tableName, dialect);

        const fkName = `fk_${table.tableName}_${rel.sourceColumns.replace(/,\s*/g, '_')}`;
        fkStatements.push(
          `ALTER TABLE ${qualifiedName} ADD CONSTRAINT ${quoteIdentifier(fkName, dialect)} ` +
          `FOREIGN KEY (${rel.sourceColumns}) REFERENCES ${targetName} (${rel.targetColumns});`
        );
      }
    }

    parts.push('');
  }

  // Append FK statements at the end to avoid dependency ordering issues
  if (fkStatements.length > 0) {
    parts.push('-- Foreign Key Constraints');
    parts.push(...fkStatements);
    parts.push('');
  }

  return parts.join('\n');
}

function quoteIdentifier(name: string, dialect: string): string {
  const d = dialect.toLowerCase();
  if (d === 'mysql' || d === 'mariadb') return `\`${name}\``;
  if (d === 'sqlserver' || d === 'mssql') return `[${name}]`;
  return `"${name}"`; // PostgreSQL, Oracle, Snowflake, etc.
}

function formatDataType(
  col: {
    dataType: string;
    characterMaxLength: number | null;
    numericPrecision: number | null;
    numericScale: number | null;
  },
  _dialect: string,
): string {
  if (col.characterMaxLength) {
    return `${col.dataType}(${col.characterMaxLength})`;
  }
  if (col.numericPrecision != null && col.numericScale != null) {
    return `${col.dataType}(${col.numericPrecision}, ${col.numericScale})`;
  }
  return col.dataType;
}
