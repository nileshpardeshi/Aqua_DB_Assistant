// ---------------------------------------------------------------------------
// Relationship Resolver
// Phase 1: Explicit FK constraints
// Phase 2: Naming convention inference (_id / Id columns)
// Phase 3: Junction table detection (many-to-many)
// ---------------------------------------------------------------------------

import type {
  ParsedTable,
  ParsedRelationship,
  SQLDialect,
} from './parser.interface.js';

/**
 * Resolve relationships between tables using three phases:
 *
 *  1. **Explicit FK constraints** – parsed from the DDL  (isInferred = false)
 *  2. **Naming conventions** – columns ending in `_id` / `Id` that match table
 *     names  (isInferred = true)
 *  3. **Junction table detection** – tables with exactly 2 FK columns and no
 *     other non-PK columns get flagged  (relationships already created in
 *     phases 1/2, but this documents the pattern)
 *
 * @param tables  All parsed tables
 * @param dialect The SQL dialect (used for schema defaults)
 * @returns Array of resolved relationships
 */
export function resolveRelationships(
  tables: ParsedTable[],
  dialect: SQLDialect,
): ParsedRelationship[] {
  const relationships: ParsedRelationship[] = [];

  // Build a lookup for quick table name resolution
  const tableMap = new Map<string, ParsedTable>();
  for (const t of tables) {
    // Store by lowercase fully-qualified and table-only
    tableMap.set(`${t.schemaName.toLowerCase()}.${t.tableName.toLowerCase()}`, t);
    tableMap.set(t.tableName.toLowerCase(), t);
  }

  // ── Phase 1: Explicit FK constraints ─────────────────────────────────────
  for (const table of tables) {
    for (const constraint of table.constraints) {
      if (constraint.constraintType !== 'FOREIGN KEY') continue;

      const fkInfo = parseFKDefinition(constraint.definition);
      if (!fkInfo) continue;

      // Avoid duplicates
      const key = buildRelKey(
        table.schemaName,
        table.tableName,
        constraint.columns,
        fkInfo.targetSchema || fkInfo.targetTable,
        fkInfo.targetTable,
        fkInfo.targetColumns,
      );

      if (relationships.some((r) => buildRelKey(
        r.sourceSchema, r.sourceTable, r.sourceColumns,
        r.targetSchema, r.targetTable, r.targetColumns,
      ) === key)) {
        continue;
      }

      relationships.push({
        sourceSchema: table.schemaName,
        sourceTable: table.tableName,
        sourceColumns: constraint.columns,
        targetSchema: fkInfo.targetSchema || resolveSchemaForTable(fkInfo.targetTable, tableMap),
        targetTable: fkInfo.targetTable,
        targetColumns: fkInfo.targetColumns,
        constraintName: constraint.constraintName,
        onDelete: fkInfo.onDelete || null,
        onUpdate: fkInfo.onUpdate || null,
        isInferred: false,
      });
    }
  }

  // ── Phase 2: Naming convention inference ──────────────────────────────────
  const existingFKs = new Set(
    relationships.map((r) =>
      `${r.sourceTable.toLowerCase()}.${r.sourceColumns.map((c) => c.toLowerCase()).join(',')}`,
    ),
  );

  for (const table of tables) {
    for (const col of table.columns) {
      // Skip if already covered by an explicit FK
      const colKey = `${table.tableName.toLowerCase()}.${col.name.toLowerCase()}`;
      if (existingFKs.has(colKey)) continue;

      // Check naming patterns: ends with _id, Id, _ID, _fk
      const inferredTable = inferTargetTable(col.name, table.tableName, tableMap);
      if (!inferredTable) continue;

      // Determine the target column (assume PK of target table)
      const targetPK = findPrimaryKeyColumns(inferredTable);
      if (targetPK.length === 0) continue; // can't infer without a PK

      const relKey = buildRelKey(
        table.schemaName,
        table.tableName,
        [col.name],
        inferredTable.schemaName,
        inferredTable.tableName,
        targetPK,
      );

      if (relationships.some((r) => buildRelKey(
        r.sourceSchema, r.sourceTable, r.sourceColumns,
        r.targetSchema, r.targetTable, r.targetColumns,
      ) === relKey)) {
        continue;
      }

      relationships.push({
        sourceSchema: table.schemaName,
        sourceTable: table.tableName,
        sourceColumns: [col.name],
        targetSchema: inferredTable.schemaName,
        targetTable: inferredTable.tableName,
        targetColumns: targetPK,
        constraintName: null,
        onDelete: null,
        onUpdate: null,
        isInferred: true,
      });

      existingFKs.add(colKey);
    }
  }

  // ── Phase 3: Junction table detection ─────────────────────────────────────
  // A junction table is one that has exactly 2 FK columns (possibly composite)
  // and no other columns besides PKs or audit columns.
  // We don't create new relationships here – they were already created in
  // phases 1/2. But we could annotate them as many-to-many in the future.
  // For now, this phase serves as documentation of the pattern.
  detectJunctionTables(tables, relationships);

  return relationships;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a FK constraint definition string to extract target table/columns and
 * ON DELETE/ON UPDATE actions.
 */
function parseFKDefinition(definition: string): {
  targetSchema: string;
  targetTable: string;
  targetColumns: string[];
  onDelete: string;
  onUpdate: string;
} | null {
  const match = definition.match(
    /REFERENCES\s+(?:["'`\[]?(\w+)["'`\]]?\.)?["'`\[]?(\w+)["'`\]]?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+([\w\s]+?))?(?:\s+ON\s+UPDATE\s+([\w\s]+?))?$/i,
  );

  if (!match) return null;

  return {
    targetSchema: match[1] ?? '',
    targetTable: match[2],
    targetColumns: match[3].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, '')),
    onDelete: (match[4] ?? '').trim(),
    onUpdate: (match[5] ?? '').trim(),
  };
}

/**
 * Look up a table's schema name given its name.
 */
function resolveSchemaForTable(
  tableName: string,
  tableMap: Map<string, ParsedTable>,
): string {
  const table = tableMap.get(tableName.toLowerCase());
  return table?.schemaName ?? 'public';
}

/**
 * Try to infer a target table from a column name that follows naming conventions.
 *
 * Patterns checked:
 *  - user_id       → table "users" or "user"
 *  - userId        → table "users" or "user"
 *  - category_fk   → table "categories" or "category"
 *  - order_item_id → table "order_items" or "order_item"
 */
function inferTargetTable(
  columnName: string,
  ownerTable: string,
  tableMap: Map<string, ParsedTable>,
): ParsedTable | null {
  let baseName: string | null = null;

  // Pattern: xxx_id
  if (/_id$/i.test(columnName)) {
    baseName = columnName.replace(/_id$/i, '');
  }
  // Pattern: xxxId (camelCase)
  else if (/[a-z]Id$/.test(columnName)) {
    baseName = columnName.replace(/Id$/, '');
    // Convert camelCase to snake_case for lookup
    baseName = baseName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
  // Pattern: xxx_fk
  else if (/_fk$/i.test(columnName)) {
    baseName = columnName.replace(/_fk$/i, '');
  }
  // Special case: "id" column itself – skip
  else if (columnName.toLowerCase() === 'id') {
    return null;
  }

  if (!baseName) return null;

  // Don't self-reference unless the column clearly points elsewhere
  // (e.g. parent_id in the same table IS a self-reference, and we allow it)
  const lowerBase = baseName.toLowerCase();

  // Try direct match
  let target = tableMap.get(lowerBase);
  if (target) return target;

  // Try pluralized forms
  target = tableMap.get(lowerBase + 's');
  if (target) return target;

  target = tableMap.get(lowerBase + 'es');
  if (target) return target;

  // Try singular from plural base
  if (lowerBase.endsWith('s')) {
    target = tableMap.get(lowerBase.slice(0, -1));
    if (target) return target;
  }

  // Try with underscores replaced by nothing (for multi-word table names)
  target = tableMap.get(lowerBase.replace(/_/g, ''));
  if (target) return target;

  return null;
}

/**
 * Find primary key column names for a table.
 */
function findPrimaryKeyColumns(table: ParsedTable): string[] {
  const pkCols = table.columns
    .filter((c) => c.isPrimaryKey)
    .map((c) => c.name);

  if (pkCols.length > 0) return pkCols;

  // Fallback: look for a column named 'id'
  const idCol = table.columns.find(
    (c) => c.name.toLowerCase() === 'id',
  );
  if (idCol) return [idCol.name];

  return [];
}

/**
 * Build a unique key for a relationship to detect duplicates.
 */
function buildRelKey(
  srcSchema: string,
  srcTable: string,
  srcCols: string[],
  tgtSchema: string,
  tgtTable: string,
  tgtCols: string[],
): string {
  return [
    srcSchema.toLowerCase(),
    srcTable.toLowerCase(),
    srcCols.map((c) => c.toLowerCase()).sort().join(','),
    tgtSchema.toLowerCase(),
    tgtTable.toLowerCase(),
    tgtCols.map((c) => c.toLowerCase()).sort().join(','),
  ].join('|');
}

/**
 * Detect junction tables (many-to-many linking tables).
 *
 * A junction table typically:
 *  - Has exactly 2 foreign key relationships
 *  - Its columns are primarily FK columns + optional PKs + audit columns
 *
 * This function currently doesn't produce new relationships but could be
 * extended to annotate existing ones with a "many-to-many" flag.
 */
function detectJunctionTables(
  tables: ParsedTable[],
  relationships: ParsedRelationship[],
): void {
  const auditColumnPatterns = /^(id|created_at|updated_at|created_by|updated_by|deleted_at|version)$/i;

  for (const table of tables) {
    // Get FK relationships where this table is the source
    const outgoing = relationships.filter(
      (r) => r.sourceTable.toLowerCase() === table.tableName.toLowerCase(),
    );

    if (outgoing.length !== 2) continue;

    // Check if all non-FK, non-audit columns are just PKs
    const fkColumns = new Set(
      outgoing.flatMap((r) => r.sourceColumns.map((c) => c.toLowerCase())),
    );

    const nonFKColumns = table.columns.filter(
      (c) =>
        !fkColumns.has(c.name.toLowerCase()) &&
        !auditColumnPatterns.test(c.name) &&
        !c.isPrimaryKey,
    );

    if (nonFKColumns.length <= 1) {
      // This looks like a junction table
      // Mark the outgoing relationships (could add a flag in the future)
      // For now, this is a no-op detection pass
    }
  }
}
