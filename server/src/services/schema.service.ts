// ---------------------------------------------------------------------------
// Schema Service – Persistence, querying, ER diagram data, snapshots
// ---------------------------------------------------------------------------

import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import {
  NotFoundError,
  BadRequestError,
} from '../middleware/error-handler.js';
import type { SQLParseResult } from './sql-parser/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableFilter {
  search?: string;
  schemaName?: string;
  tableType?: string;
}

export interface ERNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    tableId: string;
    schemaName: string;
    tableName: string;
    tableType: string;
    columns: Array<{
      name: string;
      dataType: string;
      isPrimaryKey: boolean;
      isNullable: boolean;
      isForeignKey: boolean;
    }>;
  };
}

export interface EREdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: string;
  animated: boolean;
  label: string;
  data: {
    relationshipId: string;
    sourceColumns: string[];
    targetColumns: string[];
    constraintName: string | null;
    isInferred: boolean;
    relationshipType: string;
    onDelete: string | null;
    onUpdate: string | null;
  };
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
    },
    orderBy: [{ schemaName: 'asc' }, { tableName: 'asc' }],
  });

  return tables;
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

  return table;
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

  return relationships;
}

// ---------------------------------------------------------------------------
// getERDiagramData – Build ERNode[] and EREdge[] for React Flow
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

  // Fetch tables with columns
  const tables = await prisma.tableMetadata.findMany({
    where: tableWhere,
    include: {
      columns: {
        orderBy: { ordinalPosition: 'asc' },
      },
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
    include: {
      sourceTable: {
        select: { id: true, schemaName: true, tableName: true },
      },
      targetTable: {
        select: { id: true, schemaName: true, tableName: true },
      },
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

  // ── Build nodes ─────────────────────────────────────────────────────
  const nodes: ERNode[] = tables.map((table) => {
    const fkCols = fkColumnsPerTable.get(table.id) ?? new Set<string>();

    return {
      id: table.id,
      type: 'erTable',
      position: { x: 0, y: 0 }, // Client will apply layout
      data: {
        tableId: table.id,
        schemaName: table.schemaName,
        tableName: table.tableName,
        tableType: table.tableType,
        columns: table.columns.map((col) => ({
          name: col.columnName,
          dataType: col.dataType,
          isPrimaryKey: col.isPrimaryKey,
          isNullable: col.isNullable,
          isForeignKey: fkCols.has(col.columnName.toLowerCase()),
        })),
      },
    };
  });

  // ── Build edges ─────────────────────────────────────────────────────
  const edges: EREdge[] = relationships.map((rel) => {
    const srcCols: string[] = safeParseJSON(rel.sourceColumns, []);
    const tgtCols: string[] = safeParseJSON(rel.targetColumns, []);

    return {
      id: rel.id,
      source: rel.sourceTableId,
      target: rel.targetTableId,
      sourceHandle: `${rel.sourceTableId}-${srcCols.join('-')}`,
      targetHandle: `${rel.targetTableId}-${tgtCols.join('-')}`,
      type: 'smoothstep',
      animated: rel.isInferred,
      label: rel.relationshipType,
      data: {
        relationshipId: rel.id,
        sourceColumns: srcCols,
        targetColumns: tgtCols,
        constraintName: rel.constraintName,
        isInferred: rel.isInferred,
        relationshipType: rel.relationshipType,
        onDelete: rel.onDelete,
        onUpdate: rel.onUpdate,
      },
    };
  });

  return { nodes, edges };
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
