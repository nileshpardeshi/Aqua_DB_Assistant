// ---------------------------------------------------------------------------
// Schema Service – Persistence, querying, ER diagram data, snapshots
// ---------------------------------------------------------------------------

import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import {
  NotFoundError,
  BadRequestError,
} from '../middleware/error-handler.js';
import * as auditService from './audit.service.js';
import type { SQLParseResult } from './sql-parser/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableFilter {
  search?: string;
  schemaName?: string;
  tableType?: string;
}


// ---------------------------------------------------------------------------
// persistParseResult – Upsert tables, columns, indexes, constraints, rels
// ---------------------------------------------------------------------------

export async function persistParseResult(
  projectId: string,
  fileId: string,
  result: SQLParseResult,
): Promise<{ tablesUpserted: number; relationshipsCreated: number }> {
  const startTime = Date.now();

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  // Verify file exists and belongs to this project
  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId },
  });
  if (!file) throw new NotFoundError('File');

  let tablesUpserted = 0;
  let relationshipsCreated = 0;

  await prisma.$transaction(async (tx) => {
    // Map of "schema.table" → tableId for relationship linking
    const tableIdMap = new Map<string, string>();

    // ── Upsert tables, columns, indexes, constraints ────────────────────
    for (const parsedTable of result.tables) {
      const schemaName = parsedTable.schemaName || 'public';
      const tableName = parsedTable.tableName;

      // Upsert table
      const existingTable = await tx.tableMetadata.findUnique({
        where: {
          projectId_schemaName_tableName: {
            projectId,
            schemaName,
            tableName,
          },
        },
      });

      let tableId: string;

      if (existingTable) {
        await tx.tableMetadata.update({
          where: { id: existingTable.id },
          data: {
            tableType: parsedTable.tableType,
            originalDDL: parsedTable.originalDDL || existingTable.originalDDL,
          },
        });
        tableId = existingTable.id;

        // Delete existing children so we can recreate them
        await tx.columnMetadata.deleteMany({ where: { tableId } });
        await tx.indexMetadata.deleteMany({ where: { tableId } });
        await tx.constraintMetadata.deleteMany({ where: { tableId } });
      } else {
        const newTable = await tx.tableMetadata.create({
          data: {
            projectId,
            schemaName,
            tableName,
            tableType: parsedTable.tableType,
            originalDDL: parsedTable.originalDDL || null,
          },
        });
        tableId = newTable.id;
      }

      tableIdMap.set(`${schemaName.toLowerCase()}.${tableName.toLowerCase()}`, tableId);
      // Also map by tableName alone for convenience
      tableIdMap.set(tableName.toLowerCase(), tableId);
      tablesUpserted++;

      // ── Create columns ────────────────────────────────────────────────
      for (const col of parsedTable.columns) {
        await tx.columnMetadata.create({
          data: {
            tableId,
            columnName: col.name,
            dataType: col.dataType,
            normalizedType: col.normalizedType,
            ordinalPosition: col.ordinalPosition,
            isNullable: col.isNullable,
            isPrimaryKey: col.isPrimaryKey,
            isUnique: col.isUnique,
            defaultValue: col.defaultValue,
            characterMaxLength: col.characterMaxLength,
            numericPrecision: col.numericPrecision,
            numericScale: col.numericScale,
          },
        });
      }

      // ── Create indexes ────────────────────────────────────────────────
      for (const idx of parsedTable.indexes) {
        // Avoid duplicate index names within the same table
        const existingIdx = await tx.indexMetadata.findUnique({
          where: {
            tableId_indexName: { tableId, indexName: idx.indexName },
          },
        });
        if (existingIdx) continue;

        await tx.indexMetadata.create({
          data: {
            tableId,
            indexName: idx.indexName,
            indexType: idx.indexType,
            isUnique: idx.isUnique,
            isPrimary: idx.isPrimary,
            columns: JSON.stringify(idx.columns),
          },
        });
      }

      // ── Create constraints ────────────────────────────────────────────
      for (const con of parsedTable.constraints) {
        const existingCon = await tx.constraintMetadata.findUnique({
          where: {
            tableId_constraintName: {
              tableId,
              constraintName: con.constraintName,
            },
          },
        });
        if (existingCon) continue;

        await tx.constraintMetadata.create({
          data: {
            tableId,
            constraintName: con.constraintName,
            constraintType: con.constraintType,
            definition: con.definition,
            columns: JSON.stringify(con.columns),
          },
        });
      }
    }

    // ── Create relationships ────────────────────────────────────────────
    // First, delete existing relationships for this project's tables
    // that were created from this file (we re-derive them each parse)
    const tableIds = Array.from(tableIdMap.values());
    if (tableIds.length > 0) {
      await tx.relationshipMetadata.deleteMany({
        where: {
          OR: [
            { sourceTableId: { in: tableIds } },
            { targetTableId: { in: tableIds } },
          ],
        },
      });
    }

    for (const rel of result.relationships) {
      const sourceKey =
        tableIdMap.get(
          `${rel.sourceSchema.toLowerCase()}.${rel.sourceTable.toLowerCase()}`,
        ) ?? tableIdMap.get(rel.sourceTable.toLowerCase());

      const targetKey =
        tableIdMap.get(
          `${rel.targetSchema.toLowerCase()}.${rel.targetTable.toLowerCase()}`,
        ) ?? tableIdMap.get(rel.targetTable.toLowerCase());

      if (!sourceKey || !targetKey) {
        logger.warn(
          `Skipping relationship: could not resolve table IDs for ${rel.sourceTable} -> ${rel.targetTable}`,
        );
        continue;
      }

      // Determine relationship type heuristic (one-to-many, one-to-one, many-to-many)
      const relType = inferRelationshipType(rel.sourceColumns, result.tables, rel);

      await tx.relationshipMetadata.create({
        data: {
          sourceTableId: sourceKey,
          targetTableId: targetKey,
          relationshipType: relType,
          sourceColumns: JSON.stringify(rel.sourceColumns),
          targetColumns: JSON.stringify(rel.targetColumns),
          constraintName: rel.constraintName,
          isInferred: rel.isInferred,
          onDelete: rel.onDelete,
          onUpdate: rel.onUpdate,
        },
      });

      relationshipsCreated++;
    }

    // ── Update FileParseResult ──────────────────────────────────────────
    await tx.fileParseResult.upsert({
      where: { fileId },
      update: {
        status: result.errors.some((e) => e.severity === 'error')
          ? 'completed_with_errors'
          : 'completed',
        statementCount: result.statistics.totalStatements,
        tableCount: result.tables.length,
        errorCount: result.errors.length,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        parsedAt: new Date(),
        duration: result.statistics.parseTimeMs,
      },
      create: {
        fileId,
        status: result.errors.some((e) => e.severity === 'error')
          ? 'completed_with_errors'
          : 'completed',
        statementCount: result.statistics.totalStatements,
        tableCount: result.tables.length,
        errorCount: result.errors.length,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        parsedAt: new Date(),
        duration: result.statistics.parseTimeMs,
      },
    });
  });

  const duration = Date.now() - startTime;
  logger.info(
    `Persisted parse result for project ${projectId}: ` +
      `${tablesUpserted} tables, ${relationshipsCreated} relationships in ${duration}ms`,
  );

  auditService.logAction({
    projectId,
    action: 'schema.parse',
    entity: 'Schema',
    entityId: fileId,
    details: `Parsed ${tablesUpserted} tables, ${relationshipsCreated} relationships in ${duration}ms`,
  }).catch(() => {});

  return { tablesUpserted, relationshipsCreated };
}

// ---------------------------------------------------------------------------
// getTables – List tables with columns for a project
// ---------------------------------------------------------------------------

export async function getTables(
  projectId: string,
  filters?: TableFilter,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  const where: any = { projectId };

  if (filters?.search) {
    where.tableName = { contains: filters.search };
  }
  if (filters?.schemaName) {
    where.schemaName = filters.schemaName;
  }
  if (filters?.tableType) {
    where.tableType = filters.tableType;
  }

  const tables = await prisma.tableMetadata.findMany({
    where,
    include: {
      columns: {
        orderBy: { ordinalPosition: 'asc' },
      },
      indexes: true,
      constraints: true,
    },
    orderBy: [{ schemaName: 'asc' }, { tableName: 'asc' }],
  });

  return tables.map((table) => mapTable(table));
}

// ---------------------------------------------------------------------------
// getTableById – Single table with all relations
// ---------------------------------------------------------------------------

export async function getTableById(tableId: string) {
  const table = await prisma.tableMetadata.findUnique({
    where: { id: tableId },
    include: {
      columns: {
        orderBy: { ordinalPosition: 'asc' },
      },
      indexes: true,
      constraints: true,
      outgoingRelationships: {
        include: {
          targetTable: {
            select: { id: true, schemaName: true, tableName: true },
          },
        },
      },
      incomingRelationships: {
        include: {
          sourceTable: {
            select: { id: true, schemaName: true, tableName: true },
          },
        },
      },
    },
  });

  if (!table) throw new NotFoundError('Table');

  // Build FK columns set from outgoing relationships
  const fkCols = new Set<string>();
  for (const rel of table.outgoingRelationships) {
    const srcCols: string[] = safeParseJSON(rel.sourceColumns, []);
    for (const col of srcCols) {
      fkCols.add(col.toLowerCase());
    }
  }

  return {
    ...mapTable(table, fkCols),
    outgoingRelationships: table.outgoingRelationships.map((rel) => {
      const srcCols: string[] = safeParseJSON(rel.sourceColumns, []);
      const tgtCols: string[] = safeParseJSON(rel.targetColumns, []);
      return {
        id: rel.id,
        name: rel.constraintName || rel.relationshipType,
        sourceTable: rel.sourceTableId,
        sourceColumn: srcCols[0] || '',
        targetTable: rel.targetTableId,
        targetTableName: rel.targetTable.tableName,
        targetColumn: tgtCols[0] || '',
        type: rel.relationshipType,
        isInferred: rel.isInferred,
      };
    }),
    incomingRelationships: table.incomingRelationships.map((rel) => {
      const srcCols: string[] = safeParseJSON(rel.sourceColumns, []);
      const tgtCols: string[] = safeParseJSON(rel.targetColumns, []);
      return {
        id: rel.id,
        name: rel.constraintName || rel.relationshipType,
        sourceTable: rel.sourceTableId,
        sourceTableName: rel.sourceTable.tableName,
        sourceColumn: srcCols[0] || '',
        targetTable: rel.targetTableId,
        targetColumn: tgtCols[0] || '',
        type: rel.relationshipType,
        isInferred: rel.isInferred,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// getRelationships – All relationships for a project
// ---------------------------------------------------------------------------

export async function getRelationships(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  const relationships = await prisma.relationshipMetadata.findMany({
    where: {
      sourceTable: { projectId },
    },
    include: {
      sourceTable: {
        select: { id: true, schemaName: true, tableName: true },
      },
      targetTable: {
        select: { id: true, schemaName: true, tableName: true },
      },
    },
  });

  return relationships.map((rel) => {
    const srcCols: string[] = safeParseJSON(rel.sourceColumns, []);
    const tgtCols: string[] = safeParseJSON(rel.targetColumns, []);
    return {
      id: rel.id,
      name: rel.constraintName || rel.relationshipType,
      sourceTable: rel.sourceTableId,
      sourceTableName: rel.sourceTable.tableName,
      sourceColumn: srcCols[0] || '',
      targetTable: rel.targetTableId,
      targetTableName: rel.targetTable.tableName,
      targetColumn: tgtCols[0] || '',
      type: rel.relationshipType,
      isInferred: rel.isInferred,
    };
  });
}

// ---------------------------------------------------------------------------
// getERDiagramData – Return tables + relationships for client-side rendering
// ---------------------------------------------------------------------------

export async function getERDiagramData(
  projectId: string,
  filters?: TableFilter,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  // Build table filter
  const tableWhere: any = { projectId };
  if (filters?.search) {
    tableWhere.tableName = { contains: filters.search };
  }
  if (filters?.schemaName) {
    tableWhere.schemaName = filters.schemaName;
  }
  if (filters?.tableType) {
    tableWhere.tableType = filters.tableType;
  }

  // Fetch tables with columns, indexes, constraints
  const tables = await prisma.tableMetadata.findMany({
    where: tableWhere,
    include: {
      columns: {
        orderBy: { ordinalPosition: 'asc' },
      },
      indexes: true,
      constraints: true,
    },
    orderBy: [{ schemaName: 'asc' }, { tableName: 'asc' }],
  });

  const tableIds = tables.map((t) => t.id);

  // Fetch relationships that involve the filtered tables
  const relationships = await prisma.relationshipMetadata.findMany({
    where: {
      AND: [
        { sourceTableId: { in: tableIds } },
        { targetTableId: { in: tableIds } },
      ],
    },
  });

  // Build a set of FK column names per table for display
  const fkColumnsPerTable = new Map<string, Set<string>>();
  for (const rel of relationships) {
    const srcCols: string[] = safeParseJSON(rel.sourceColumns, []);
    if (!fkColumnsPerTable.has(rel.sourceTableId)) {
      fkColumnsPerTable.set(rel.sourceTableId, new Set());
    }
    for (const col of srcCols) {
      fkColumnsPerTable.get(rel.sourceTableId)!.add(col.toLowerCase());
    }
  }

  // ── Map to client-expected format ─────────────────────────────────────
  const mappedTables = tables.map((table) => {
    const fkCols = fkColumnsPerTable.get(table.id) ?? new Set<string>();

    return {
      id: table.id,
      name: table.tableName,
      schema: table.schemaName,
      type: table.tableType,
      description: table.description ?? null,
      estimatedRows: table.estimatedRows != null ? Number(table.estimatedRows) : null,
      columns: table.columns.map((col) => ({
        id: col.id,
        name: col.columnName,
        dataType: col.dataType,
        nullable: col.isNullable,
        isPrimaryKey: col.isPrimaryKey,
        isForeignKey: fkCols.has(col.columnName.toLowerCase()),
        isUnique: col.isUnique,
        defaultValue: col.defaultValue,
        comment: null,
        ordinalPosition: col.ordinalPosition,
        referencesTable: null,
        referencesColumn: null,
      })),
      indexes: table.indexes.map((idx) => ({
        id: idx.id,
        name: idx.indexName,
        type: idx.indexType,
        columns: safeParseJSON<string[]>(idx.columns, []),
        isUnique: idx.isUnique,
      })),
      constraints: table.constraints.map((con) => ({
        id: con.id,
        name: con.constraintName,
        type: con.constraintType,
        columns: safeParseJSON<string[]>(con.columns, []),
        referencesTable: null,
        referencesColumns: null,
      })),
    };
  });

  const mappedRelationships = relationships.map((rel) => {
    const srcCols: string[] = safeParseJSON(rel.sourceColumns, []);
    const tgtCols: string[] = safeParseJSON(rel.targetColumns, []);

    return {
      id: rel.id,
      name: rel.constraintName || rel.relationshipType,
      sourceTable: rel.sourceTableId,
      sourceColumn: srcCols[0] || '',
      targetTable: rel.targetTableId,
      targetColumn: tgtCols[0] || '',
      type: rel.relationshipType,
      isInferred: rel.isInferred,
    };
  });

  return { tables: mappedTables, relationships: mappedRelationships };
}

// ---------------------------------------------------------------------------
// getSchemaSnapshots – List snapshots for a project
// ---------------------------------------------------------------------------

export async function getSchemaSnapshots(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  const snapshots = await prisma.schemaSnapshot.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      label: true,
      createdAt: true,
    },
  });

  return snapshots;
}

// ---------------------------------------------------------------------------
// createSchemaSnapshot – Snapshot current schema state as JSON
// ---------------------------------------------------------------------------

export async function createSchemaSnapshot(
  projectId: string,
  label?: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  // Get current schema data
  const tables = await prisma.tableMetadata.findMany({
    where: { projectId },
    include: {
      columns: { orderBy: { ordinalPosition: 'asc' } },
      indexes: true,
      constraints: true,
    },
    orderBy: [{ schemaName: 'asc' }, { tableName: 'asc' }],
  });

  const relationships = await prisma.relationshipMetadata.findMany({
    where: {
      sourceTable: { projectId },
    },
    include: {
      sourceTable: {
        select: { schemaName: true, tableName: true },
      },
      targetTable: {
        select: { schemaName: true, tableName: true },
      },
    },
  });

  // Determine next version number
  const latestSnapshot = await prisma.schemaSnapshot.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latestSnapshot?.version ?? 0) + 1;

  // Build snapshot data
  const snapshotData = {
    tables: tables.map((t) => ({
      schemaName: t.schemaName,
      tableName: t.tableName,
      tableType: t.tableType,
      columns: t.columns.map((c) => ({
        columnName: c.columnName,
        dataType: c.dataType,
        normalizedType: c.normalizedType,
        ordinalPosition: c.ordinalPosition,
        isNullable: c.isNullable,
        isPrimaryKey: c.isPrimaryKey,
        isUnique: c.isUnique,
        defaultValue: c.defaultValue,
      })),
      indexes: t.indexes.map((i) => ({
        indexName: i.indexName,
        indexType: i.indexType,
        isUnique: i.isUnique,
        isPrimary: i.isPrimary,
        columns: safeParseJSON(i.columns, []),
      })),
      constraints: t.constraints.map((c) => ({
        constraintName: c.constraintName,
        constraintType: c.constraintType,
        definition: c.definition,
        columns: safeParseJSON(c.columns, []),
      })),
    })),
    relationships: relationships.map((r) => ({
      sourceTable: `${r.sourceTable.schemaName}.${r.sourceTable.tableName}`,
      targetTable: `${r.targetTable.schemaName}.${r.targetTable.tableName}`,
      sourceColumns: safeParseJSON(r.sourceColumns, []),
      targetColumns: safeParseJSON(r.targetColumns, []),
      relationshipType: r.relationshipType,
      constraintName: r.constraintName,
      isInferred: r.isInferred,
    })),
    metadata: {
      dialect: project.dialect,
      tableCount: tables.length,
      snapshotAt: new Date().toISOString(),
    },
  };

  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      projectId,
      version: nextVersion,
      label: label || `Snapshot v${nextVersion}`,
      snapshotData: JSON.stringify(snapshotData),
    },
  });

  return snapshot;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Prisma table (with columns, indexes, constraints) to the client API format.
 */
function mapTable(
  table: {
    id: string;
    schemaName: string;
    tableName: string;
    tableType: string;
    description?: string | null;
    estimatedRows?: bigint | number | null;
    columns: Array<{
      id: string;
      columnName: string;
      dataType: string;
      isNullable: boolean;
      isPrimaryKey: boolean;
      isUnique: boolean;
      defaultValue: string | null;
      description?: string | null;
      ordinalPosition: number;
    }>;
    indexes?: Array<{
      id: string;
      indexName: string;
      indexType: string;
      columns: string;
      isUnique: boolean;
    }>;
    constraints?: Array<{
      id: string;
      constraintName: string;
      constraintType: string;
      columns: string;
    }>;
  },
  fkCols?: Set<string>,
) {
  return {
    id: table.id,
    name: table.tableName,
    schema: table.schemaName,
    type: table.tableType,
    description: table.description ?? null,
    estimatedRows: table.estimatedRows != null ? Number(table.estimatedRows) : null,
    columns: table.columns.map((col) => ({
      id: col.id,
      name: col.columnName,
      dataType: col.dataType,
      nullable: col.isNullable,
      isPrimaryKey: col.isPrimaryKey,
      isForeignKey: fkCols ? fkCols.has(col.columnName.toLowerCase()) : false,
      isUnique: col.isUnique,
      defaultValue: col.defaultValue,
      comment: col.description ?? null,
      ordinalPosition: col.ordinalPosition,
      referencesTable: null,
      referencesColumn: null,
    })),
    indexes: (table.indexes ?? []).map((idx) => ({
      id: idx.id,
      name: idx.indexName,
      type: idx.indexType,
      columns: safeParseJSON<string[]>(idx.columns, []),
      isUnique: idx.isUnique,
    })),
    constraints: (table.constraints ?? []).map((con) => ({
      id: con.id,
      name: con.constraintName,
      type: con.constraintType,
      columns: safeParseJSON<string[]>(con.columns, []),
      referencesTable: null,
      referencesColumns: null,
    })),
  };
}

/**
 * Safely parse a JSON string, returning a fallback on failure.
 */
function safeParseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Infer relationship type: one-to-one, one-to-many, many-to-many.
 */
function inferRelationshipType(
  sourceColumns: string[],
  tables: { tableName: string; columns: { name: string; isPrimaryKey: boolean; isUnique: boolean }[] }[],
  rel: { sourceTable: string },
): string {
  // Check if the source columns form a unique/PK constraint on the source table
  const sourceTable = tables.find(
    (t) => t.tableName.toLowerCase() === rel.sourceTable.toLowerCase(),
  );

  if (!sourceTable) return 'one-to-many';

  // If the FK columns are the PK or have a unique constraint, it's one-to-one
  const allPKOrUnique = sourceColumns.every((col) => {
    const colMeta = sourceTable.columns.find(
      (c) => c.name.toLowerCase() === col.toLowerCase(),
    );
    return colMeta && (colMeta.isPrimaryKey || colMeta.isUnique);
  });

  if (allPKOrUnique && sourceColumns.length > 0) {
    return 'one-to-one';
  }

  return 'one-to-many';
}

// ---------------------------------------------------------------------------
// createTable – Create a table manually (not from parse)
// ---------------------------------------------------------------------------

export async function createTable(
  projectId: string,
  input: {
    tableName: string;
    schemaName?: string;
    tableType?: string;
    description?: string;
    columns: Array<{
      columnName: string;
      dataType: string;
      isNullable?: boolean;
      isPrimaryKey?: boolean;
      isUnique?: boolean;
      defaultValue?: string;
      comment?: string;
      description?: string;
      ordinalPosition?: number;
    }>;
    indexes?: Array<{
      indexName: string;
      indexType?: string;
      isUnique?: boolean;
      columns: string[];
    }>;
    constraints?: Array<{
      constraintName: string;
      constraintType: string;
      columns: string[];
      definition?: string;
    }>;
  },
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  const schemaName = input.schemaName || 'public';

  // Check for duplicate
  const existing = await prisma.tableMetadata.findUnique({
    where: {
      projectId_schemaName_tableName: {
        projectId,
        schemaName,
        tableName: input.tableName,
      },
    },
  });
  if (existing) {
    throw new BadRequestError(
      `Table "${schemaName}.${input.tableName}" already exists`,
    );
  }

  const table = await prisma.$transaction(async (tx) => {
    const newTable = await tx.tableMetadata.create({
      data: {
        projectId,
        schemaName,
        tableName: input.tableName,
        tableType: input.tableType || 'TABLE',
        description: input.description || null,
      },
    });

    // Create columns
    for (let i = 0; i < input.columns.length; i++) {
      const col = input.columns[i];
      await tx.columnMetadata.create({
        data: {
          tableId: newTable.id,
          columnName: col.columnName,
          dataType: col.dataType,
          normalizedType: col.dataType.toUpperCase(),
          ordinalPosition: col.ordinalPosition ?? i + 1,
          isNullable: col.isNullable ?? true,
          isPrimaryKey: col.isPrimaryKey ?? false,
          isUnique: col.isUnique ?? false,
          defaultValue: col.defaultValue ?? null,
          description: col.description ?? col.comment ?? null,
        },
      });
    }

    // Create indexes
    if (input.indexes) {
      for (const idx of input.indexes) {
        await tx.indexMetadata.create({
          data: {
            tableId: newTable.id,
            indexName: idx.indexName,
            indexType: idx.indexType || 'BTREE',
            isUnique: idx.isUnique ?? false,
            isPrimary: false,
            columns: JSON.stringify(idx.columns),
          },
        });
      }
    }

    // Create constraints
    if (input.constraints) {
      for (const con of input.constraints) {
        await tx.constraintMetadata.create({
          data: {
            tableId: newTable.id,
            constraintName: con.constraintName,
            constraintType: con.constraintType,
            definition: con.definition ?? null,
            columns: JSON.stringify(con.columns),
          },
        });
      }
    }

    return newTable;
  });

  // Return full table with relations
  const fullTable = await getTableById(table.id);

  auditService.logAction({
    projectId,
    action: 'schema.createTable',
    entity: 'Table',
    entityId: table.id,
    details: `Manually created table "${input.tableName}" with ${input.columns.length} columns`,
  }).catch(() => {});

  return fullTable;
}

// ---------------------------------------------------------------------------
// updateTable – Update a table's metadata and columns
// ---------------------------------------------------------------------------

export async function updateTable(
  tableId: string,
  input: {
    tableName?: string;
    description?: string;
    columns?: Array<{
      columnName: string;
      dataType: string;
      isNullable?: boolean;
      isPrimaryKey?: boolean;
      isUnique?: boolean;
      defaultValue?: string;
      comment?: string;
      ordinalPosition?: number;
    }>;
    indexes?: Array<{
      indexName: string;
      indexType?: string;
      isUnique?: boolean;
      columns: string[];
    }>;
    constraints?: Array<{
      constraintName: string;
      constraintType: string;
      columns: string[];
      definition?: string;
    }>;
  },
) {
  const existing = await prisma.tableMetadata.findUnique({
    where: { id: tableId },
  });
  if (!existing) throw new NotFoundError('Table');

  await prisma.$transaction(async (tx) => {
    // Update table metadata
    const updateData: any = {};
    if (input.tableName) updateData.tableName = input.tableName;
    if (input.description !== undefined) updateData.description = input.description;

    if (Object.keys(updateData).length > 0) {
      await tx.tableMetadata.update({
        where: { id: tableId },
        data: updateData,
      });
    }

    // Replace columns if provided
    if (input.columns) {
      await tx.columnMetadata.deleteMany({ where: { tableId } });
      for (let i = 0; i < input.columns.length; i++) {
        const col = input.columns[i];
        await tx.columnMetadata.create({
          data: {
            tableId,
            columnName: col.columnName,
            dataType: col.dataType,
            normalizedType: col.dataType.toUpperCase(),
            ordinalPosition: col.ordinalPosition ?? i + 1,
            isNullable: col.isNullable ?? true,
            isPrimaryKey: col.isPrimaryKey ?? false,
            isUnique: col.isUnique ?? false,
            defaultValue: col.defaultValue ?? null,
            description: col.comment ?? null,
          },
        });
      }
    }

    // Replace indexes if provided
    if (input.indexes) {
      await tx.indexMetadata.deleteMany({ where: { tableId } });
      for (const idx of input.indexes) {
        await tx.indexMetadata.create({
          data: {
            tableId,
            indexName: idx.indexName,
            indexType: idx.indexType || 'BTREE',
            isUnique: idx.isUnique ?? false,
            isPrimary: false,
            columns: JSON.stringify(idx.columns),
          },
        });
      }
    }

    // Replace constraints if provided
    if (input.constraints) {
      await tx.constraintMetadata.deleteMany({ where: { tableId } });
      for (const con of input.constraints) {
        await tx.constraintMetadata.create({
          data: {
            tableId,
            constraintName: con.constraintName,
            constraintType: con.constraintType,
            definition: con.definition ?? null,
            columns: JSON.stringify(con.columns),
          },
        });
      }
    }
  });

  const fullTable = await getTableById(tableId);

  auditService.logAction({
    projectId: existing.projectId,
    action: 'schema.updateTable',
    entity: 'Table',
    entityId: tableId,
    details: `Updated table "${existing.tableName}"`,
  }).catch(() => {});

  return fullTable;
}

// ---------------------------------------------------------------------------
// deleteTable – Delete a table and all its children
// ---------------------------------------------------------------------------

export async function deleteTable(tableId: string) {
  const existing = await prisma.tableMetadata.findUnique({
    where: { id: tableId },
  });
  if (!existing) throw new NotFoundError('Table');

  await prisma.$transaction(async (tx) => {
    // Delete children first
    await tx.columnMetadata.deleteMany({ where: { tableId } });
    await tx.indexMetadata.deleteMany({ where: { tableId } });
    await tx.constraintMetadata.deleteMany({ where: { tableId } });
    await tx.relationshipMetadata.deleteMany({
      where: {
        OR: [
          { sourceTableId: tableId },
          { targetTableId: tableId },
        ],
      },
    });
    // Delete table
    await tx.tableMetadata.delete({ where: { id: tableId } });
  });

  auditService.logAction({
    projectId: existing.projectId,
    action: 'schema.deleteTable',
    entity: 'Table',
    entityId: tableId,
    details: `Deleted table "${existing.tableName}"`,
  }).catch(() => {});

  return { success: true };
}

// ---------------------------------------------------------------------------
// Schema Namespace Management
// ---------------------------------------------------------------------------

export async function getSchemas(projectId: string): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  const explicitSchemas: string[] = project.schemas
    ? JSON.parse(project.schemas)
    : ['public'];

  const tablesWithSchemas = await prisma.tableMetadata.findMany({
    where: { projectId },
    select: { schemaName: true },
    distinct: ['schemaName'],
  });
  const usedSchemas = tablesWithSchemas.map((t) => t.schemaName);

  return [...new Set([...explicitSchemas, ...usedSchemas])].sort();
}

export async function createSchema(
  projectId: string,
  schemaName: string,
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  const existing: string[] = project.schemas
    ? JSON.parse(project.schemas)
    : ['public'];

  if (existing.includes(schemaName)) {
    throw new BadRequestError(`Schema "${schemaName}" already exists`);
  }

  const updated = [...existing, schemaName].sort();
  await prisma.project.update({
    where: { id: projectId },
    data: { schemas: JSON.stringify(updated) },
  });

  return updated;
}

export async function renameSchema(
  projectId: string,
  oldName: string,
  newName: string,
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  if (oldName === newName) return getSchemas(projectId);

  // Check for table name conflicts in target schema
  const tablesInOld = await prisma.tableMetadata.findMany({
    where: { projectId, schemaName: oldName },
    select: { tableName: true },
  });
  for (const t of tablesInOld) {
    const dup = await prisma.tableMetadata.findUnique({
      where: {
        projectId_schemaName_tableName: {
          projectId,
          schemaName: newName,
          tableName: t.tableName,
        },
      },
    });
    if (dup) {
      throw new BadRequestError(
        `Cannot rename: table "${t.tableName}" already exists in schema "${newName}"`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.tableMetadata.updateMany({
      where: { projectId, schemaName: oldName },
      data: { schemaName: newName },
    });

    const schemas: string[] = project.schemas
      ? JSON.parse(project.schemas)
      : ['public'];
    const idx = schemas.indexOf(oldName);
    if (idx >= 0) schemas[idx] = newName;
    if (!schemas.includes(newName)) schemas.push(newName);
    await tx.project.update({
      where: { id: projectId },
      data: { schemas: JSON.stringify([...new Set(schemas)].sort()) },
    });
  });

  return getSchemas(projectId);
}

export async function deleteSchema(
  projectId: string,
  schemaName: string,
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new NotFoundError('Project');

  if (schemaName === 'public') {
    throw new BadRequestError('Cannot delete the "public" schema');
  }

  const tables = await prisma.tableMetadata.findMany({
    where: { projectId, schemaName },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const t of tables) {
      await tx.columnMetadata.deleteMany({ where: { tableId: t.id } });
      await tx.indexMetadata.deleteMany({ where: { tableId: t.id } });
      await tx.constraintMetadata.deleteMany({ where: { tableId: t.id } });
      await tx.triggerMetadata.deleteMany({ where: { tableId: t.id } });
      await tx.relationshipMetadata.deleteMany({
        where: { OR: [{ sourceTableId: t.id }, { targetTableId: t.id }] },
      });
      await tx.tableMetadata.delete({ where: { id: t.id } });
    }

    const schemas: string[] = project.schemas
      ? JSON.parse(project.schemas)
      : ['public'];
    const filtered = schemas.filter((s) => s !== schemaName);
    await tx.project.update({
      where: { id: projectId },
      data: { schemas: JSON.stringify(filtered) },
    });
  });

  auditService.logAction({
    projectId,
    action: 'schema.deleteSchema',
    entity: 'Schema',
    details: `Deleted schema "${schemaName}" with ${tables.length} tables`,
  }).catch(() => {});

  return getSchemas(projectId);
}

// ---------------------------------------------------------------------------
// Trigger CRUD
// ---------------------------------------------------------------------------

export async function getTriggers(tableId: string) {
  const table = await prisma.tableMetadata.findUnique({
    where: { id: tableId },
  });
  if (!table) throw new NotFoundError('Table');

  const triggers = await prisma.triggerMetadata.findMany({
    where: { tableId },
    orderBy: { triggerName: 'asc' },
  });

  return triggers.map((t) => ({
    id: t.id,
    tableId: t.tableId,
    triggerName: t.triggerName,
    timing: t.timing,
    event: t.event,
    triggerBody: t.triggerBody,
    isEnabled: t.isEnabled,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function createTrigger(
  tableId: string,
  input: {
    triggerName: string;
    timing: string;
    event: string;
    triggerBody: string;
    isEnabled?: boolean;
    description?: string;
  },
) {
  const table = await prisma.tableMetadata.findUnique({
    where: { id: tableId },
  });
  if (!table) throw new NotFoundError('Table');

  const existing = await prisma.triggerMetadata.findUnique({
    where: { tableId_triggerName: { tableId, triggerName: input.triggerName } },
  });
  if (existing) {
    throw new BadRequestError(`Trigger "${input.triggerName}" already exists on this table`);
  }

  const trigger = await prisma.triggerMetadata.create({
    data: {
      tableId,
      triggerName: input.triggerName,
      timing: input.timing,
      event: input.event,
      triggerBody: input.triggerBody,
      isEnabled: input.isEnabled ?? true,
      description: input.description ?? null,
    },
  });

  auditService.logAction({
    projectId: table.projectId,
    action: 'schema.createTrigger',
    entity: 'Trigger',
    entityId: trigger.id,
    details: `Created trigger "${input.triggerName}" on table "${table.tableName}"`,
  }).catch(() => {});

  return {
    id: trigger.id,
    tableId: trigger.tableId,
    triggerName: trigger.triggerName,
    timing: trigger.timing,
    event: trigger.event,
    triggerBody: trigger.triggerBody,
    isEnabled: trigger.isEnabled,
    description: trigger.description,
  };
}

export async function updateTrigger(
  triggerId: string,
  input: {
    triggerName?: string;
    timing?: string;
    event?: string;
    triggerBody?: string;
    isEnabled?: boolean;
    description?: string;
  },
) {
  const existing = await prisma.triggerMetadata.findUnique({
    where: { id: triggerId },
  });
  if (!existing) throw new NotFoundError('Trigger');

  const trigger = await prisma.triggerMetadata.update({
    where: { id: triggerId },
    data: {
      triggerName: input.triggerName ?? undefined,
      timing: input.timing ?? undefined,
      event: input.event ?? undefined,
      triggerBody: input.triggerBody ?? undefined,
      isEnabled: input.isEnabled ?? undefined,
      description: input.description !== undefined ? input.description : undefined,
    },
  });

  return {
    id: trigger.id,
    tableId: trigger.tableId,
    triggerName: trigger.triggerName,
    timing: trigger.timing,
    event: trigger.event,
    triggerBody: trigger.triggerBody,
    isEnabled: trigger.isEnabled,
    description: trigger.description,
  };
}

export async function deleteTrigger(triggerId: string) {
  const existing = await prisma.triggerMetadata.findUnique({
    where: { id: triggerId },
    include: { table: { select: { projectId: true, tableName: true } } },
  });
  if (!existing) throw new NotFoundError('Trigger');

  await prisma.triggerMetadata.delete({ where: { id: triggerId } });

  auditService.logAction({
    projectId: existing.table.projectId,
    action: 'schema.deleteTrigger',
    entity: 'Trigger',
    entityId: triggerId,
    details: `Deleted trigger "${existing.triggerName}" from table "${existing.table.tableName}"`,
  }).catch(() => {});

  return { success: true };
}

export async function toggleTrigger(triggerId: string) {
  const existing = await prisma.triggerMetadata.findUnique({
    where: { id: triggerId },
  });
  if (!existing) throw new NotFoundError('Trigger');

  const updated = await prisma.triggerMetadata.update({
    where: { id: triggerId },
    data: { isEnabled: !existing.isEnabled },
  });

  return {
    id: updated.id,
    tableId: updated.tableId,
    triggerName: updated.triggerName,
    timing: updated.timing,
    event: updated.event,
    triggerBody: updated.triggerBody,
    isEnabled: updated.isEnabled,
    description: updated.description,
  };
}
