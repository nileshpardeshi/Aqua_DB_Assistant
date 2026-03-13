import pg from 'pg';
import mysql from 'mysql2/promise';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

// ---------- Create Connection ----------

export async function createConnection(data: {
  projectId: string;
  name: string;
  dialect: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled?: boolean;
  sslConfig?: string;
}) {
  const passwordEncrypted = encrypt(data.password);

  const connection = await prisma.databaseConnection.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      dialect: data.dialect,
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      passwordEncrypted,
      sslEnabled: data.sslEnabled ?? false,
      sslConfig: data.sslConfig ?? null,
    },
  });

  return maskConnection(connection);
}

// ---------- List Connections ----------

export async function listConnections(projectId: string) {
  const connections = await prisma.databaseConnection.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return connections.map(maskConnection);
}

// ---------- Get Connection ----------

export async function getConnection(id: string) {
  const connection = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!connection) {
    throw new NotFoundError('DatabaseConnection');
  }

  return maskConnection(connection);
}

// ---------- Update Connection ----------

export async function updateConnection(
  id: string,
  data: {
    name?: string;
    dialect?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    sslEnabled?: boolean;
    sslConfig?: string;
    isActive?: boolean;
  },
) {
  const existing = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('DatabaseConnection');
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.dialect !== undefined) updateData.dialect = data.dialect;
  if (data.host !== undefined) updateData.host = data.host;
  if (data.port !== undefined) updateData.port = data.port;
  if (data.database !== undefined) updateData.database = data.database;
  if (data.username !== undefined) updateData.username = data.username;
  if (data.sslEnabled !== undefined) updateData.sslEnabled = data.sslEnabled;
  if (data.sslConfig !== undefined) updateData.sslConfig = data.sslConfig;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (data.password !== undefined) {
    updateData.passwordEncrypted = encrypt(data.password);
  }

  const connection = await prisma.databaseConnection.update({
    where: { id },
    data: updateData,
  });

  return maskConnection(connection);
}

// ---------- Delete Connection ----------

export async function deleteConnection(id: string) {
  const existing = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('DatabaseConnection');
  }

  await prisma.databaseConnection.delete({ where: { id } });

  return maskConnection(existing);
}

// ---------- Test Connection (REAL) ----------

export async function testConnection(id: string) {
  const connection = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!connection) {
    throw new NotFoundError('DatabaseConnection');
  }

  let password: string;
  try {
    password = decrypt(connection.passwordEncrypted);
  } catch {
    return {
      success: false,
      message: 'Failed to decrypt stored password',
      testedAt: new Date().toISOString(),
    };
  }

  const startTime = Date.now();

  try {
    const info = await connectAndPing({
      dialect: connection.dialect,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password,
      sslEnabled: connection.sslEnabled,
    });

    const latencyMs = Date.now() - startTime;

    await prisma.databaseConnection.update({
      where: { id },
      data: { lastTestedAt: new Date(), isActive: true },
    });

    logger.info('Connection test succeeded', {
      connectionId: id,
      dialect: connection.dialect,
      host: connection.host,
      latencyMs,
    });

    return {
      success: true,
      message: `Connected successfully to ${connection.dialect}://${connection.host}:${connection.port}/${connection.database}`,
      latencyMs,
      serverVersion: info.serverVersion,
      testedAt: new Date().toISOString(),
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.warn('Connection test failed', {
      connectionId: id,
      dialect: connection.dialect,
      host: connection.host,
      error: errorMessage,
    });

    await prisma.databaseConnection.update({
      where: { id },
      data: { lastTestedAt: new Date(), isActive: false },
    }).catch(() => {});

    return {
      success: false,
      message: formatConnectionError(errorMessage, connection.dialect),
      latencyMs,
      testedAt: new Date().toISOString(),
    };
  }
}

// ---------- Run Query via Connection ----------

export async function runQuery(id: string, sql: string, maxRows: number = 500) {
  const connection = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!connection) {
    throw new NotFoundError('DatabaseConnection');
  }

  let password: string;
  try {
    password = decrypt(connection.passwordEncrypted);
  } catch {
    throw new Error('Failed to decrypt stored password');
  }

  const startTime = Date.now();

  try {
    const result = await executeQuery({
      dialect: connection.dialect,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password,
      sslEnabled: connection.sslEnabled,
      sql,
      maxRows,
    });

    const durationMs = Date.now() - startTime;

    logger.info('Query executed via connection', {
      connectionId: id,
      dialect: connection.dialect,
      rowCount: result.rowCount,
      durationMs,
    });

    return {
      success: true,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      success: false,
      error: errorMessage,
      durationMs,
      columns: [],
      rows: [],
      rowCount: 0,
    };
  }
}

// ---------- Introspect: List Schemas ----------

export async function introspectSchemas(id: string) {
  const connection = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!connection) {
    throw new NotFoundError('DatabaseConnection');
  }

  let password: string;
  try {
    password = decrypt(connection.passwordEncrypted);
  } catch {
    throw new Error('Failed to decrypt stored password');
  }

  const config = {
    dialect: connection.dialect,
    host: connection.host,
    port: connection.port,
    database: connection.database,
    username: connection.username,
    password,
    sslEnabled: connection.sslEnabled,
  };

  if (connection.dialect === 'postgresql' || connection.dialect === 'mariadb') {
    return introspectPostgres(config);
  } else if (connection.dialect === 'mysql') {
    return introspectMySQL(config);
  }

  throw new Error(`Introspection not supported for dialect: ${connection.dialect}`);
}

// ============================================================
// Internal: Database Driver Helpers
// ============================================================

interface ConnConfig {
  dialect: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled: boolean;
}

async function connectAndPing(config: ConnConfig): Promise<{ serverVersion: string }> {
  if (config.dialect === 'postgresql' || config.dialect === 'mariadb') {
    return pingPostgres(config);
  } else if (config.dialect === 'mysql') {
    return pingMySQL(config);
  }

  throw new Error(
    `Live connection testing is supported for PostgreSQL and MySQL. ` +
    `For ${config.dialect}, connection details have been saved.`
  );
}

async function pingPostgres(config: ConnConfig): Promise<{ serverVersion: string }> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    const fullVersion = (res.rows[0]?.version as string) ?? 'Unknown';
    // Extract just "PostgreSQL 16.2" from the full version string
    const serverVersion = fullVersion.split(',')[0] || fullVersion;
    return { serverVersion };
  } finally {
    await client.end().catch(() => {});
  }
}

async function pingMySQL(config: ConnConfig): Promise<{ serverVersion: string }> {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10_000,
  });

  try {
    const [rows] = await conn.query('SELECT VERSION() as version');
    const serverVersion = `MySQL ${(rows as Array<{ version: string }>)[0]?.version ?? 'Unknown'}`;
    return { serverVersion };
  } finally {
    await conn.end().catch(() => {});
  }
}

interface QueryConfig extends ConnConfig {
  sql: string;
  maxRows: number;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

async function executeQuery(config: QueryConfig): Promise<QueryResult> {
  if (config.dialect === 'postgresql' || config.dialect === 'mariadb') {
    return executePostgresQuery(config);
  } else if (config.dialect === 'mysql') {
    return executeMySQLQuery(config);
  }

  throw new Error(`Query execution not supported for dialect: ${config.dialect}`);
}

async function executePostgresQuery(config: QueryConfig): Promise<QueryResult> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  });

  try {
    await client.connect();
    const res = await client.query(config.sql);

    const columns = res.fields?.map((f) => f.name) ?? [];
    const rows = (res.rows ?? []).slice(0, config.maxRows) as Record<string, unknown>[];

    return {
      columns,
      rows,
      rowCount: res.rowCount ?? rows.length,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function executeMySQLQuery(config: QueryConfig): Promise<QueryResult> {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10_000,
  });

  try {
    const [rows, fields] = await conn.query(config.sql);

    const columns = (fields as Array<{ name: string }>)?.map((f) => f.name) ?? [];
    const dataRows = (Array.isArray(rows) ? rows : []).slice(0, config.maxRows) as Record<string, unknown>[];

    return {
      columns,
      rows: dataRows,
      rowCount: dataRows.length,
    };
  } finally {
    await conn.end().catch(() => {});
  }
}

// ---------- Introspection ----------

async function introspectPostgres(config: ConnConfig) {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();

    // Get schemas
    const schemaRes = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);

    // Get tables with row counts
    const tableRes = await client.query(`
      SELECT
        t.table_schema AS schema,
        t.table_name AS name,
        t.table_type AS type,
        pg_stat_user_tables.n_live_tup AS estimated_rows
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables
        ON pg_stat_user_tables.schemaname = t.table_schema
        AND pg_stat_user_tables.relname = t.table_name
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY t.table_schema, t.table_name
    `);

    return {
      schemas: schemaRes.rows.map((r) => (r as { schema_name: string }).schema_name),
      tables: tableRes.rows as Array<{ schema: string; name: string; type: string; estimated_rows: number | null }>,
      totalTables: tableRes.rowCount ?? 0,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function introspectMySQL(config: ConnConfig) {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10_000,
  });

  try {
    // Get databases (schemas in MySQL)
    const [schemaRows] = await conn.query(`
      SELECT SCHEMA_NAME as schema_name
      FROM information_schema.SCHEMATA
      WHERE SCHEMA_NAME NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
      ORDER BY SCHEMA_NAME
    `);

    // Get tables for current database
    const [tableRows] = await conn.query(`
      SELECT
        TABLE_SCHEMA AS \`schema\`,
        TABLE_NAME AS name,
        TABLE_TYPE AS type,
        TABLE_ROWS AS estimated_rows
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [config.database]);

    const schemas = (schemaRows as Array<{ schema_name: string }>).map((r) => r.schema_name);
    const tables = tableRows as Array<{ schema: string; name: string; type: string; estimated_rows: number | null }>;

    return {
      schemas,
      tables,
      totalTables: tables.length,
    };
  } finally {
    await conn.end().catch(() => {});
  }
}

// ---------- Helpers ----------

function maskConnection(
  connection: Record<string, unknown> & { passwordEncrypted: string },
) {
  const { passwordEncrypted, ...rest } = connection;
  return {
    ...rest,
    passwordMasked: '********',
  };
}

function formatConnectionError(error: string, dialect: string): string {
  // Friendly error messages for common issues
  if (error.includes('ECONNREFUSED')) {
    return `Connection refused — is the ${dialect} server running on the specified host and port?`;
  }
  if (error.includes('ENOTFOUND') || error.includes('getaddrinfo')) {
    return `Host not found — check the hostname or IP address.`;
  }
  if (error.includes('ETIMEDOUT') || error.includes('timeout')) {
    return `Connection timed out — the server may be unreachable or a firewall is blocking the connection.`;
  }
  if (error.includes('password authentication failed') || error.includes('Access denied')) {
    return `Authentication failed — check your username and password.`;
  }
  if (error.includes('does not exist') || error.includes('Unknown database')) {
    return `Database not found — verify the database name.`;
  }
  if (error.includes('SSL') || error.includes('ssl')) {
    return `SSL error — try toggling the SSL setting or check your SSL configuration.`;
  }
  return error;
}
