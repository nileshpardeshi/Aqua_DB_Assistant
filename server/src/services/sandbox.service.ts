import { prisma } from '../config/prisma.js';
import { BadRequestError } from '../middleware/error-handler.js';

const SANDBOX_SCHEMA = '_datagen_sandbox';

// ---------- Ensure Sandbox Schema Exists ----------

async function ensureSandboxSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${SANDBOX_SCHEMA}`);
}

// ---------- Execute SQL in Sandbox ----------

interface TableResult {
  tableName: string;
  rowCount: number;
  durationMs: number;
  status: 'success' | 'error';
  error?: string;
}

interface SandboxColumnDef {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
}

interface SandboxTableDef {
  tableName: string;
  columns: SandboxColumnDef[];
}

// Map high-level column types to PostgreSQL types
function mapColumnType(colType: string): string {
  const t = colType.toUpperCase();
  if (t.includes('INT') || t === 'SERIAL' || t === 'BIGSERIAL') return 'BIGINT';
  if (t.includes('VARCHAR') || t.includes('CHARACTER VARYING')) return colType; // preserve length
  if (t.includes('TEXT') || t.includes('CHAR')) return 'TEXT';
  if (t.includes('BOOL')) return 'BOOLEAN';
  if (t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('REAL')) return 'DOUBLE PRECISION';
  if (t.includes('NUMERIC') || t.includes('DECIMAL')) return colType; // preserve precision
  if (t.includes('UUID')) return 'UUID';
  if (t.includes('DATE') && !t.includes('TIME')) return 'DATE';
  if (t.includes('TIMESTAMP')) return 'TIMESTAMP';
  if (t.includes('TIME')) return 'TIME';
  if (t.includes('JSON')) return 'JSONB';
  if (t.includes('BYTEA') || t.includes('BLOB')) return 'BYTEA';
  return 'TEXT'; // fallback
}

export async function executeSandbox(data: {
  projectId: string;
  sql: string;
  tableNames: string[];
  tableColumns?: SandboxTableDef[];
}): Promise<{ tables: TableResult[]; totalDurationMs: number }> {
  const { sql, tableNames, tableColumns } = data;

  if (!sql || !sql.trim()) {
    throw new BadRequestError('SQL script is required');
  }

  await ensureSandboxSchema();

  const results: TableResult[] = [];
  const totalStart = Date.now();

  // Step 1: Create sandbox tables from column definitions (or try mirroring from public)
  for (const tableName of tableNames) {
    try {
      // Drop existing sandbox table
      await prisma.$executeRawUnsafe(
        `DROP TABLE IF EXISTS ${SANDBOX_SCHEMA}.${tableName} CASCADE`
      );

      // Find column definitions for this table
      const tableDef = tableColumns?.find(t => t.tableName === tableName);

      if (tableDef && tableDef.columns.length > 0) {
        // Create table from provided column definitions
        const colDefs = tableDef.columns.map(col => {
          const pgType = mapColumnType(col.type);
          return `  "${col.name}" ${pgType}`;
        }).join(',\n');

        await prisma.$executeRawUnsafe(
          `CREATE TABLE ${SANDBOX_SCHEMA}.${tableName} (\n${colDefs}\n)`
        );
      } else {
        // Fallback: try mirroring from aqua_db schema (or public as last resort)
        try {
          await prisma.$executeRawUnsafe(
            `CREATE TABLE ${SANDBOX_SCHEMA}.${tableName} (LIKE aqua_db."${tableName}" INCLUDING ALL)`
          );
        } catch {
          await prisma.$executeRawUnsafe(
            `CREATE TABLE ${SANDBOX_SCHEMA}.${tableName} (LIKE public."${tableName}" INCLUDING ALL)`
          );
        }

        // Remove FK constraints from sandbox table
        const fks: Array<{ constraint_name: string }> = await prisma.$queryRawUnsafe(`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_schema = '${SANDBOX_SCHEMA}'
            AND table_name = '${tableName}'
            AND constraint_type = 'FOREIGN KEY'
        `);

        for (const fk of fks) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE ${SANDBOX_SCHEMA}.${tableName} DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`
          );
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        tableName,
        rowCount: 0,
        durationMs: 0,
        status: 'error',
        error: `Failed to create sandbox table: ${message}`,
      });
    }
  }

  // Step 2: Rewrite SQL to target sandbox schema
  let sandboxSQL = sql;
  for (const tableName of tableNames) {
    // Replace CREATE TABLE tablename
    const createRegex = new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\b`, 'gi');
    sandboxSQL = sandboxSQL.replace(createRegex, (match) => {
      const ifNotExists = /IF\s+NOT\s+EXISTS/i.test(match) ? 'IF NOT EXISTS ' : '';
      return `CREATE TABLE ${ifNotExists}${SANDBOX_SCHEMA}.${tableName}`;
    });

    // Replace INSERT INTO tablename
    const insertRegex = new RegExp(`\\bINSERT\\s+INTO\\s+${tableName}\\b`, 'gi');
    sandboxSQL = sandboxSQL.replace(insertRegex, `INSERT INTO ${SANDBOX_SCHEMA}.${tableName}`);

    // Replace FROM clauses for FK references (SELECT ... FROM tableName)
    const fromRegex = new RegExp(`\\bFROM\\s+${tableName}\\b`, 'gi');
    sandboxSQL = sandboxSQL.replace(fromRegex, `FROM ${SANDBOX_SCHEMA}.${tableName}`);

    // Replace CREATE INDEX ... ON tablename
    const indexRegex = new RegExp(`\\bON\\s+${tableName}\\b`, 'gi');
    sandboxSQL = sandboxSQL.replace(indexRegex, `ON ${SANDBOX_SCHEMA}.${tableName}`);

    // Replace ALTER TABLE tablename
    const alterRegex = new RegExp(`\\bALTER\\s+TABLE\\s+${tableName}\\b`, 'gi');
    sandboxSQL = sandboxSQL.replace(alterRegex, `ALTER TABLE ${SANDBOX_SCHEMA}.${tableName}`);

    // Replace ANALYZE statements
    const analyzeRegex = new RegExp(`\\bANALYZE\\s+${tableName}\\b`, 'gi');
    sandboxSQL = sandboxSQL.replace(analyzeRegex, `ANALYZE ${SANDBOX_SCHEMA}.${tableName}`);
  }

  // Step 3: Execute the rewritten SQL
  // Split by semicolons, strip comment-only lines from each block, then execute
  const statements = sandboxSQL
    .split(';')
    .map(s => {
      // Strip leading comment lines from each statement block
      const lines = s.split('\n');
      const meaningful = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });
      return meaningful.join('\n').trim();
    })
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    // Skip BEGIN/COMMIT — handle them separately
    const upper = stmt.toUpperCase().trim();
    if (upper === 'BEGIN' || upper === 'COMMIT') continue;

    // Find which table this INSERT targets
    const insertMatch = stmt.match(/INSERT\s+INTO\s+(?:_datagen_sandbox\.)?(\w+)/i);
    const targetTable = insertMatch ? insertMatch[1] : null;

    const stmtStart = Date.now();
    try {
      await prisma.$executeRawUnsafe(stmt);
      // If this was an INSERT, record the result
      if (targetTable && !results.find(r => r.tableName === targetTable && r.status === 'error')) {
        const existing = results.find(r => r.tableName === targetTable);
        if (existing) {
          existing.durationMs += Date.now() - stmtStart;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (targetTable) {
        const existing = results.find(r => r.tableName === targetTable);
        if (existing) {
          existing.status = 'error';
          existing.error = message;
        } else {
          results.push({
            tableName: targetTable,
            rowCount: 0,
            durationMs: Date.now() - stmtStart,
            status: 'error',
            error: message,
          });
        }
      } else {
        // Log non-INSERT errors for debugging
        console.error(`Sandbox SQL error (no target table): ${message}\nStatement: ${stmt.substring(0, 200)}`);
      }
    }
  }

  // Step 4: Count rows in each sandbox table
  for (const tableName of tableNames) {
    const existingResult = results.find(r => r.tableName === tableName);
    if (existingResult && existingResult.status === 'error') continue;

    try {
      const countResult: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint as count FROM ${SANDBOX_SCHEMA}.${tableName}`
      );
      const count = Number(countResult[0]?.count ?? 0);

      if (existingResult) {
        existingResult.rowCount = count;
        existingResult.status = 'success';
      } else {
        results.push({
          tableName,
          rowCount: count,
          durationMs: 0,
          status: 'success',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!existingResult) {
        results.push({
          tableName,
          rowCount: 0,
          durationMs: 0,
          status: 'error',
          error: message,
        });
      }
    }
  }

  return {
    tables: results,
    totalDurationMs: Date.now() - totalStart,
  };
}

// ---------- Query Sandbox Table Data ----------

export async function querySandboxTable(data: {
  tableName: string;
  page: number;
  limit: number;
}): Promise<{ rows: Record<string, unknown>[]; totalCount: number; columns: string[] }> {
  const { tableName, page, limit } = data;
  const offset = (page - 1) * limit;

  // Get column names
  const colResult: Array<{ column_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = '${SANDBOX_SCHEMA}'
      AND table_name = '${tableName}'
    ORDER BY ordinal_position
  `);
  const columns = colResult.map(c => c.column_name);

  if (columns.length === 0) {
    throw new BadRequestError(`Sandbox table "${tableName}" does not exist`);
  }

  // Get total count
  const countResult: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint as count FROM ${SANDBOX_SCHEMA}.${tableName}`
  );
  const totalCount = Number(countResult[0]?.count ?? 0);

  // Get rows
  const rows: Record<string, unknown>[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM ${SANDBOX_SCHEMA}.${tableName} LIMIT ${limit} OFFSET ${offset}`
  );

  // Convert BigInt values to numbers for JSON serialization
  const serializedRows = rows.map(row => {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      converted[key] = typeof value === 'bigint' ? Number(value) : value;
    }
    return converted;
  });

  return { rows: serializedRows, totalCount, columns };
}

// ---------- Get Sandbox Status ----------

export async function getSandboxStatus(): Promise<{
  exists: boolean;
  tables: Array<{ tableName: string; rowCount: number }>;
}> {
  try {
    const tables: Array<{ tablename: string }> = await prisma.$queryRawUnsafe(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = '${SANDBOX_SCHEMA}'
      ORDER BY tablename
    `);

    if (tables.length === 0) {
      return { exists: false, tables: [] };
    }

    const result: Array<{ tableName: string; rowCount: number }> = [];
    for (const t of tables) {
      try {
        const countResult: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::bigint as count FROM ${SANDBOX_SCHEMA}.${t.tablename}`
        );
        result.push({
          tableName: t.tablename,
          rowCount: Number(countResult[0]?.count ?? 0),
        });
      } catch {
        result.push({ tableName: t.tablename, rowCount: 0 });
      }
    }

    return { exists: true, tables: result };
  } catch {
    return { exists: false, tables: [] };
  }
}

// ---------- Cleanup Sandbox ----------

export async function cleanupSandbox(): Promise<{ dropped: boolean }> {
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SANDBOX_SCHEMA} CASCADE`);
    return { dropped: true };
  } catch {
    return { dropped: false };
  }
}

// ---------- Promote Sandbox to Real Tables ----------

export async function promoteSandbox(data: {
  projectId: string;
  tableNames: string[];
}): Promise<{ tables: Array<{ tableName: string; rowCount: number; status: string; error?: string }> }> {
  const results: Array<{ tableName: string; rowCount: number; status: string; error?: string }> = [];

  // Look up the project's dedicated PostgreSQL schema
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { dbSchema: true },
  });
  const targetSchema = project?.dbSchema || 'public';

  // Ensure target schema exists
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);

  for (const tableName of data.tableNames) {
    try {
      // Get sandbox row count
      const countResult: Array<{ count: bigint }> = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint as count FROM ${SANDBOX_SCHEMA}."${tableName}"`
      );
      const count = Number(countResult[0]?.count ?? 0);

      // Check if the target table already exists
      const existsResult: Array<{ exists: boolean }> = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = '${targetSchema}' AND table_name = '${tableName}'
        ) as exists
      `);
      const tableExists = existsResult[0]?.exists ?? false;

      if (tableExists) {
        // Insert sandbox data into existing table
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${targetSchema}"."${tableName}" SELECT * FROM ${SANDBOX_SCHEMA}."${tableName}"`
        );
      } else {
        // Create the table in target schema from sandbox structure, then copy data
        await prisma.$executeRawUnsafe(
          `CREATE TABLE "${targetSchema}"."${tableName}" (LIKE ${SANDBOX_SCHEMA}."${tableName}" INCLUDING ALL)`
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${targetSchema}"."${tableName}" SELECT * FROM ${SANDBOX_SCHEMA}."${tableName}"`
        );
      }

      results.push({ tableName, rowCount: count, status: 'promoted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ tableName, rowCount: 0, status: 'error', error: message });
    }
  }

  return { tables: results };
}

// ---------- Cleanup Promoted (Real) Tables ----------

export async function cleanupPromotedTables(data: {
  projectId: string;
  tableNames: string[];
}): Promise<{ tables: Array<{ tableName: string; status: string; error?: string }> }> {
  const results: Array<{ tableName: string; status: string; error?: string }> = [];

  // Look up the project's dedicated PostgreSQL schema
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: { dbSchema: true },
  });
  const targetSchema = project?.dbSchema || 'public';

  for (const tableName of data.tableNames) {
    try {
      // Check if table exists in the target schema
      const existsResult: Array<{ exists: boolean }> = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = '${targetSchema}' AND table_name = '${tableName}'
        ) as exists
      `);
      const tableExists = existsResult[0]?.exists ?? false;

      if (!tableExists) {
        results.push({ tableName, status: 'skipped', error: 'Table does not exist' });
        continue;
      }

      await prisma.$executeRawUnsafe(
        `DROP TABLE IF EXISTS "${targetSchema}"."${tableName}" CASCADE`
      );
      results.push({ tableName, status: 'dropped' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ tableName, status: 'error', error: message });
    }
  }

  return { tables: results };
}
