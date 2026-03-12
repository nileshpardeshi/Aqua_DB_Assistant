import { prisma } from '../../config/prisma.js';
import { logger } from '../../config/logger.js';

export interface SchemaContextOptions {
  /** Maximum character length for the context (approximate) */
  maxTokens?: number;
  /** Only include these schemas */
  schemas?: string[];
  /** Only include these tables (schema.table or just table) */
  tables?: string[];
}

export class AIContextBuilder {
  /**
   * Build a full schema context string for a project.
   * Formats tables, columns, indexes, and relationships as compact DDL.
   */
  static async buildSchemaContext(
    projectId: string,
    opts?: SchemaContextOptions,
  ): Promise<string> {
    const tables = await prisma.tableMetadata.findMany({
      where: {
        projectId,
        ...(opts?.schemas?.length
          ? { schemaName: { in: opts.schemas } }
          : {}),
        ...(opts?.tables?.length
          ? { tableName: { in: opts.tables } }
          : {}),
      },
      include: {
        columns: { orderBy: { ordinalPosition: 'asc' } },
        indexes: true,
        outgoingRelationships: {
          include: { targetTable: true },
        },
        incomingRelationships: {
          include: { sourceTable: true },
        },
      },
      orderBy: [{ schemaName: 'asc' }, { tableName: 'asc' }],
    });

    if (tables.length === 0) {
      return '-- No tables found in this project';
    }

    const parts: string[] = [];

    for (const table of tables) {
      const lines: string[] = [];

      // Table header
      lines.push(
        `TABLE ${table.schemaName}.${table.tableName} (`,
      );

      // Columns
      for (const col of table.columns) {
        const attrs: string[] = [];
        if (col.isPrimaryKey) attrs.push('PRIMARY KEY');
        if (col.isUnique) attrs.push('UNIQUE');
        if (!col.isNullable) attrs.push('NOT NULL');
        if (col.defaultValue) attrs.push(`DEFAULT ${col.defaultValue}`);

        const typeStr = col.characterMaxLength
          ? `${col.dataType}(${col.characterMaxLength})`
          : col.numericPrecision && col.numericScale
            ? `${col.dataType}(${col.numericPrecision},${col.numericScale})`
            : col.dataType;

        const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
        lines.push(`  ${col.columnName} ${typeStr}${attrStr}`);
      }

      lines.push(')');

      // Indexes
      const nonPrimaryIndexes = table.indexes.filter((idx) => !idx.isPrimary);
      if (nonPrimaryIndexes.length > 0) {
        const indexStrs = nonPrimaryIndexes.map((idx) => {
          const uniqueLabel = idx.isUnique ? ' UNIQUE' : '';
          return `${idx.indexName} (${idx.columns})${uniqueLabel}`;
        });
        lines.push(`INDEXES: ${indexStrs.join(', ')}`);
      }

      // Foreign keys (outgoing relationships)
      for (const rel of table.outgoingRelationships) {
        lines.push(
          `FK: ${table.tableName}.${rel.sourceColumns} -> ${rel.targetTable.tableName}.${rel.targetColumns} (${rel.relationshipType})`,
        );
      }

      // Incoming relationships
      for (const rel of table.incomingRelationships) {
        lines.push(
          `FK: ${rel.sourceTable.tableName}.${rel.sourceColumns} -> ${table.tableName}.${rel.targetColumns} (${rel.relationshipType})`,
        );
      }

      parts.push(lines.join('\n'));
    }

    let context = parts.join('\n\n');

    // Truncate if exceeds maxTokens (approximate 4 chars per token)
    const maxChars = (opts?.maxTokens ?? 8000) * 4;
    if (context.length > maxChars) {
      context = context.slice(0, maxChars);
      context +=
        '\n\n-- [Schema context truncated due to size limits. ' +
        `${tables.length} tables total, showing partial schema.]`;
      logger.debug('Schema context truncated', {
        projectId,
        originalLength: parts.join('\n\n').length,
        truncatedTo: maxChars,
      });
    }

    return context;
  }

  /**
   * Build schema context for only the tables referenced in a SQL query.
   * Parses the SQL to find table names and loads context for just those tables.
   */
  static async buildQueryContext(
    projectId: string,
    sql: string,
  ): Promise<string> {
    // Extract table names from SQL using regex-based heuristic parsing.
    // Covers FROM, JOIN, INTO, UPDATE, TABLE references.
    const tableNamePattern =
      /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?/gi;
    const referencedTables = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = tableNamePattern.exec(sql)) !== null) {
      const tableName = match[1];
      if (tableName && !SQL_KEYWORDS.has(tableName.toUpperCase())) {
        referencedTables.add(tableName.toLowerCase());
      }
    }

    if (referencedTables.size === 0) {
      return '-- No table references found in the provided SQL';
    }

    // Load only the referenced tables
    const allTables = await prisma.tableMetadata.findMany({
      where: { projectId },
      select: { tableName: true },
    });

    // Match case-insensitively
    const matchedTableNames = allTables
      .filter((t) => referencedTables.has(t.tableName.toLowerCase()))
      .map((t) => t.tableName);

    if (matchedTableNames.length === 0) {
      return (
        '-- Referenced tables not found in project schema: ' +
        Array.from(referencedTables).join(', ')
      );
    }

    return AIContextBuilder.buildSchemaContext(projectId, {
      tables: matchedTableNames,
    });
  }
}

/** Common SQL keywords to exclude from table name extraction */
const SQL_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'IN',
  'EXISTS',
  'BETWEEN',
  'LIKE',
  'IS',
  'NULL',
  'TRUE',
  'FALSE',
  'AS',
  'ON',
  'USING',
  'SET',
  'VALUES',
  'INSERT',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'INDEX',
  'VIEW',
  'TRIGGER',
  'FUNCTION',
  'PROCEDURE',
  'BEGIN',
  'END',
  'IF',
  'ELSE',
  'THEN',
  'CASE',
  'WHEN',
  'GROUP',
  'ORDER',
  'BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION',
  'ALL',
  'DISTINCT',
  'TOP',
  'INTO',
  'INNER',
  'LEFT',
  'RIGHT',
  'OUTER',
  'CROSS',
  'FULL',
  'NATURAL',
  'CASCADE',
  'RESTRICT',
  'CONSTRAINT',
  'PRIMARY',
  'FOREIGN',
  'KEY',
  'REFERENCES',
  'CHECK',
  'DEFAULT',
  'UNIQUE',
  'TEMPORARY',
  'TEMP',
  'WITH',
  'RECURSIVE',
  'LATERAL',
]);
