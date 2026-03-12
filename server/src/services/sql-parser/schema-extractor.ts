// ---------------------------------------------------------------------------
// Schema Extractor – Parses CREATE TABLE / INDEX / ALTER TABLE statements
// Uses node-sql-parser with regex fallback for unsupported dialects
// ---------------------------------------------------------------------------

import pkg from 'node-sql-parser';
const { Parser } = pkg;
import type {
  SQLDialect,
  ParsedTable,
  ParsedColumn,
  ParsedIndex,
  ParsedConstraint,
  ParsedStatement,
  ParseError,
} from './parser.interface.js';

// Re-export for convenience
export type { ParseError };

// ---------------------------------------------------------------------------
// Dialect → node-sql-parser database type mapping
// ---------------------------------------------------------------------------

function dialectToParserDb(dialect: SQLDialect): string | null {
  const map: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql:      'MySQL',
    mariadb:    'MariaDB',
    sqlserver:  'TransactSQL',
  };
  return map[dialect] ?? null;
}

// ---------------------------------------------------------------------------
// Normalized type mapping
// ---------------------------------------------------------------------------

function normalizeDataType(raw: string): string {
  const upper = raw.toUpperCase().trim();

  // Integer types
  if (/^(INT|INTEGER|INT4)$/.test(upper)) return 'integer';
  if (/^(BIGINT|INT8|BIGSERIAL)$/.test(upper)) return 'bigint';
  if (/^(SMALLINT|INT2|SMALLSERIAL)$/.test(upper)) return 'smallint';
  if (/^(TINYINT)$/.test(upper)) return 'tinyint';
  if (/^(MEDIUMINT)$/.test(upper)) return 'mediumint';
  if (/^(SERIAL)$/.test(upper)) return 'integer'; // PG serial

  // Decimal / numeric
  if (/^(DECIMAL|NUMERIC|NUMBER|DEC|FIXED)/.test(upper)) return 'decimal';
  if (/^(REAL|FLOAT4)$/.test(upper)) return 'real';
  if (/^(DOUBLE|DOUBLE\s+PRECISION|FLOAT8|FLOAT64)$/.test(upper)) return 'double';
  if (/^FLOAT/.test(upper)) return 'float';
  if (/^(MONEY|SMALLMONEY)$/.test(upper)) return 'decimal';

  // String types
  if (/^(VARCHAR|CHARACTER\s+VARYING|NVARCHAR|VARCHAR2|NVARCHAR2|STRING)/.test(upper)) return 'varchar';
  if (/^(CHAR|CHARACTER|NCHAR|BPCHAR)/.test(upper)) return 'char';
  if (/^(TEXT|MEDIUMTEXT|LONGTEXT|TINYTEXT|NTEXT|CLOB|NCLOB)$/.test(upper)) return 'text';

  // Boolean
  if (/^(BOOLEAN|BOOL)$/.test(upper)) return 'boolean';
  if (/^BIT$/.test(upper)) return 'bit';

  // Date / time
  if (/^(DATE)$/.test(upper)) return 'date';
  if (/^(TIME)/.test(upper)) return 'time';
  if (/^(TIMESTAMP|TIMESTAMPTZ|DATETIME|DATETIME2|SMALLDATETIME|DATETIMEOFFSET)/.test(upper)) return 'timestamp';
  if (/^(INTERVAL)/.test(upper)) return 'interval';

  // Binary
  if (/^(BYTEA|BINARY|VARBINARY|BLOB|MEDIUMBLOB|LONGBLOB|TINYBLOB|IMAGE|RAW)/.test(upper)) return 'binary';

  // JSON
  if (/^(JSON|JSONB)$/.test(upper)) return 'json';

  // UUID
  if (/^(UUID|UNIQUEIDENTIFIER)$/.test(upper)) return 'uuid';

  // XML
  if (/^XML$/.test(upper)) return 'xml';

  // Array / struct (BigQuery / Snowflake)
  if (/^ARRAY/.test(upper)) return 'array';
  if (/^(STRUCT|RECORD|OBJECT)/.test(upper)) return 'object';
  if (/^VARIANT$/.test(upper)) return 'variant';

  // Integer aliases (INT64 for BigQuery)
  if (/^INT64$/.test(upper)) return 'bigint';

  // Fallback: lowercase the raw type
  return raw.toLowerCase().replace(/\s+/g, '_');
}

// ---------------------------------------------------------------------------
// Build data type string from node-sql-parser definition
// ---------------------------------------------------------------------------

function buildDataTypeString(def: any): string {
  if (!def) return 'unknown';
  let dt = def.dataType || 'unknown';
  if (def.length != null && def.scale != null) {
    dt += `(${def.length},${def.scale})`;
  } else if (def.length != null) {
    dt += `(${def.length})`;
  }
  if (def.suffix) {
    if (Array.isArray(def.suffix)) {
      dt += ' ' + def.suffix.join(' ');
    }
  }
  return dt;
}

// ---------------------------------------------------------------------------
// Extract column name from various AST shapes
// ---------------------------------------------------------------------------

function extractColumnName(col: any): string {
  if (!col) return 'unknown';
  if (typeof col === 'string') return col;
  if (col.column) {
    if (typeof col.column === 'string') return col.column;
    if (col.column.expr && col.column.expr.value) return col.column.expr.value;
    if (col.column.value) return col.column.value;
  }
  if (col.value) return col.value;
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Main extraction: using node-sql-parser AST
// ---------------------------------------------------------------------------

interface ExtractionResult {
  tables: ParsedTable[];
  errors: ParseError[];
}

/**
 * Extract schema information from an array of parsed statements.
 *
 * @param statements Array of ParsedStatement (from the splitter)
 * @param dialect    The detected SQL dialect
 * @returns Extracted tables and any parse errors encountered
 */
export function extractFromStatements(
  statements: ParsedStatement[],
  dialect: SQLDialect,
): ExtractionResult {
  const tables: ParsedTable[] = [];
  const errors: ParseError[] = [];
  const parserDb = dialectToParserDb(dialect);

  // Collect CREATE TABLE / CREATE INDEX / ALTER TABLE statements
  for (const stmt of statements) {
    if (
      stmt.type !== 'CREATE TABLE' &&
      stmt.type !== 'CREATE INDEX' &&
      stmt.type !== 'ALTER TABLE' &&
      stmt.type !== 'CREATE VIEW'
    ) {
      continue;
    }

    try {
      if (parserDb) {
        extractWithParser(stmt, parserDb, dialect, tables, errors);
      } else {
        extractWithRegex(stmt, dialect, tables, errors);
      }
    } catch (err: any) {
      // Parser failed – fall back to regex
      try {
        extractWithRegex(stmt, dialect, tables, errors);
      } catch {
        errors.push({
          line: stmt.lineStart,
          message: `Failed to parse: ${err.message ?? 'Unknown error'}`,
          statement: stmt.raw.substring(0, 200),
          severity: 'warning',
        });
      }
    }
  }

  return { tables, errors };
}

// ---------------------------------------------------------------------------
// AST-based extraction (node-sql-parser)
// ---------------------------------------------------------------------------

function extractWithParser(
  stmt: ParsedStatement,
  parserDb: string,
  dialect: SQLDialect,
  tables: ParsedTable[],
  errors: ParseError[],
): void {
  const parser = new Parser();
  let sql = stmt.raw;

  // Remove trailing semicolons for the parser
  sql = sql.replace(/;\s*$/, '');

  const result = parser.parse(sql, { database: parserDb });
  const asts = Array.isArray(result.ast) ? result.ast : [result.ast];

  for (const ast of asts) {
    if (!ast) continue;

    if (ast.type === 'create' && ast.keyword === 'table') {
      processCreateTable(ast as any, stmt, dialect, tables);
    } else if (ast.type === 'create' && ast.keyword === 'index') {
      processCreateIndex(ast as any, stmt, tables);
    } else if (ast.type === 'alter') {
      processAlterTable(ast as any, stmt, dialect, tables, errors);
    } else if (ast.type === 'create' && ast.keyword === 'view') {
      processCreateView(ast as any, stmt, tables);
    }
  }
}

// ---------------------------------------------------------------------------
// Process CREATE TABLE from AST
// ---------------------------------------------------------------------------

function processCreateTable(
  ast: any,
  stmt: ParsedStatement,
  dialect: SQLDialect,
  tables: ParsedTable[],
): void {
  const tableInfo = extractTableName(ast.table);
  const columns: ParsedColumn[] = [];
  const indexes: ParsedIndex[] = [];
  const constraints: ParsedConstraint[] = [];

  const defs = ast.create_definitions ?? [];
  let ordinal = 0;

  // First pass: identify PK columns from constraints
  const pkColumns = new Set<string>();
  const uniqueColumns = new Set<string>();

  for (const def of defs) {
    if (def.resource === 'constraint') {
      if (def.constraint_type === 'primary key') {
        for (const col of def.definition ?? []) {
          pkColumns.add(extractColumnName(col));
        }
      } else if (
        def.constraint_type === 'unique key' ||
        def.constraint_type === 'unique' ||
        def.constraint_type === 'unique index'
      ) {
        for (const col of def.definition ?? []) {
          uniqueColumns.add(extractColumnName(col));
        }
      }
    }
  }

  // Second pass: process all definitions
  for (const def of defs) {
    if (def.resource === 'column') {
      ordinal++;
      const colName = extractColumnName(def.column);
      const dataType = buildDataTypeString(def.definition);
      const isPK =
        pkColumns.has(colName) || def.primary === 'key' || def.primary === 'primary key';
      const isUniq =
        uniqueColumns.has(colName) || def.unique === 'unique' || def.unique === 'unique key';

      // Handle nullable
      let isNullable = true;
      if (def.nullable) {
        if (def.nullable.type === 'not null') isNullable = false;
      }
      if (isPK) isNullable = false;

      // Handle default value
      let defaultValue: string | null = null;
      if (def.default_val) {
        const dv = def.default_val.value;
        if (dv !== undefined && dv !== null) {
          if (typeof dv === 'object' && dv.value !== undefined) {
            defaultValue = String(dv.value);
          } else {
            defaultValue = String(dv);
          }
        }
      }

      // Handle auto_increment → mark as serial-like default
      if (def.auto_increment) {
        defaultValue = defaultValue ?? 'auto_increment';
      }

      const col: ParsedColumn = {
        name: colName,
        dataType,
        normalizedType: normalizeDataType(def.definition?.dataType ?? dataType),
        ordinalPosition: ordinal,
        isNullable,
        isPrimaryKey: isPK,
        isUnique: isUniq,
        defaultValue,
        characterMaxLength: def.definition?.length ?? null,
        numericPrecision:
          def.definition?.length != null && def.definition?.scale != null
            ? def.definition.length
            : null,
        numericScale: def.definition?.scale ?? null,
      };
      columns.push(col);

      // If this column was declared PK inline, record the constraint
      if (isPK && !pkColumns.has(colName)) {
        pkColumns.add(colName);
      }
    } else if (def.resource === 'constraint') {
      processConstraint(def, constraints, indexes);
    } else if (def.resource === 'index') {
      processIndex(def, indexes);
    }
  }

  // If PK columns were identified from constraints, add a PK index
  if (pkColumns.size > 0 && !indexes.some((idx) => idx.isPrimary)) {
    indexes.push({
      indexName: `pk_${tableInfo.tableName}`,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: true,
      columns: Array.from(pkColumns),
    });
  }

  // Ensure PK flags are set on columns
  for (const col of columns) {
    if (pkColumns.has(col.name)) {
      col.isPrimaryKey = true;
      col.isNullable = false;
    }
  }

  tables.push({
    schemaName: tableInfo.schemaName,
    tableName: tableInfo.tableName,
    tableType: 'table',
    columns,
    indexes,
    constraints,
    originalDDL: stmt.raw,
  });
}

// ---------------------------------------------------------------------------
// Process CREATE VIEW from AST
// ---------------------------------------------------------------------------

function processCreateView(
  ast: any,
  stmt: ParsedStatement,
  tables: ParsedTable[],
): void {
  const tableRef = ast.table?.[0] ?? ast.table;
  const schemaName = tableRef?.db ?? 'public';
  const tableName = tableRef?.table ?? 'unknown_view';

  tables.push({
    schemaName,
    tableName,
    tableType: 'view',
    columns: [],
    indexes: [],
    constraints: [],
    originalDDL: stmt.raw,
  });
}

// ---------------------------------------------------------------------------
// Process CREATE INDEX from AST
// ---------------------------------------------------------------------------

function processCreateIndex(
  ast: any,
  stmt: ParsedStatement,
  tables: ParsedTable[],
): void {
  const tableRef = ast.table?.[0] ?? ast.table;
  if (!tableRef) return;

  const schemaName = tableRef.db ?? 'public';
  const tableName = tableRef.table ?? 'unknown';
  const indexName =
    typeof ast.index === 'string'
      ? ast.index
      : ast.index?.name ?? 'unnamed_index';

  const columns: string[] = (ast.index_columns ?? []).map((col: any) =>
    extractColumnName(col),
  );

  const isUnique = ast.index_type === 'unique';
  const indexType =
    ast.index_using?.type?.toUpperCase() ?? 'BTREE';

  // Find or create the table
  let table = tables.find(
    (t) =>
      t.tableName.toLowerCase() === tableName.toLowerCase() &&
      t.schemaName.toLowerCase() === schemaName.toLowerCase(),
  );

  if (!table) {
    table = {
      schemaName,
      tableName,
      tableType: 'table',
      columns: [],
      indexes: [],
      constraints: [],
      originalDDL: '',
    };
    tables.push(table);
  }

  table.indexes.push({
    indexName,
    indexType,
    isUnique,
    isPrimary: false,
    columns,
  });
}

// ---------------------------------------------------------------------------
// Process ALTER TABLE from AST
// ---------------------------------------------------------------------------

function processAlterTable(
  ast: any,
  stmt: ParsedStatement,
  dialect: SQLDialect,
  tables: ParsedTable[],
  errors: ParseError[],
): void {
  const tableRef = ast.table?.[0] ?? ast.table;
  if (!tableRef) return;

  const schemaName = tableRef.db ?? 'public';
  const tableName = tableRef.table ?? 'unknown';

  // Find or create the table entry
  let table = tables.find(
    (t) =>
      t.tableName.toLowerCase() === tableName.toLowerCase() &&
      t.schemaName.toLowerCase() === schemaName.toLowerCase(),
  );

  if (!table) {
    table = {
      schemaName,
      tableName,
      tableType: 'table',
      columns: [],
      indexes: [],
      constraints: [],
      originalDDL: '',
    };
    tables.push(table);
  }

  // Process ALTER expressions
  const exprs = Array.isArray(ast.expr) ? ast.expr : ast.expr ? [ast.expr] : [];
  for (const expr of exprs) {
    if (!expr) continue;

    // ADD CONSTRAINT
    if (expr.resource === 'constraint') {
      processConstraint(expr, table.constraints, table.indexes);
    }
  }
}

// ---------------------------------------------------------------------------
// Process a constraint definition
// ---------------------------------------------------------------------------

function processConstraint(
  def: any,
  constraints: ParsedConstraint[],
  indexes: ParsedIndex[],
): void {
  const constraintName = def.constraint ?? `unnamed_${def.constraint_type}`;
  const colRefs = def.definition ?? [];
  const columns = colRefs.map((c: any) => extractColumnName(c));

  const constraintType = (def.constraint_type ?? '').toUpperCase();

  let definition = '';

  if (constraintType.includes('FOREIGN KEY') || constraintType === 'FOREIGN KEY') {
    // Build FK definition string
    const refDef = def.reference_definition;
    if (refDef) {
      const refTable = refDef.table?.[0] ?? refDef.table;
      const refTableName = refTable?.table ?? 'unknown';
      const refSchema = refTable?.db ?? '';
      const refCols = (refDef.definition ?? []).map((c: any) => extractColumnName(c));
      const onDelete = refDef.on_delete?.toUpperCase() ?? '';
      const onUpdate = refDef.on_update?.toUpperCase() ?? '';

      definition = `FOREIGN KEY (${columns.join(', ')}) REFERENCES ${refSchema ? refSchema + '.' : ''}${refTableName}(${refCols.join(', ')})`;
      if (onDelete) definition += ` ON DELETE ${onDelete}`;
      if (onUpdate) definition += ` ON UPDATE ${onUpdate}`;
    } else {
      definition = `FOREIGN KEY (${columns.join(', ')})`;
    }

    constraints.push({
      constraintName,
      constraintType: 'FOREIGN KEY',
      definition,
      columns,
    });
    return;
  }

  if (constraintType.includes('PRIMARY KEY') || constraintType === 'PRIMARY KEY') {
    definition = `PRIMARY KEY (${columns.join(', ')})`;
    constraints.push({
      constraintName,
      constraintType: 'PRIMARY KEY',
      definition,
      columns,
    });

    indexes.push({
      indexName: constraintName,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: true,
      columns,
    });
    return;
  }

  if (constraintType.includes('UNIQUE')) {
    definition = `UNIQUE (${columns.join(', ')})`;
    constraints.push({
      constraintName,
      constraintType: 'UNIQUE',
      definition,
      columns,
    });

    indexes.push({
      indexName: constraintName,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: false,
      columns,
    });
    return;
  }

  if (constraintType.includes('CHECK')) {
    definition = `CHECK (${JSON.stringify(def.definition)})`;
    constraints.push({
      constraintName,
      constraintType: 'CHECK',
      definition,
      columns: [],
    });
    return;
  }

  // Generic constraint
  constraints.push({
    constraintName,
    constraintType: constraintType || 'UNKNOWN',
    definition: definition || JSON.stringify(def),
    columns,
  });
}

// ---------------------------------------------------------------------------
// Process an index definition
// ---------------------------------------------------------------------------

function processIndex(def: any, indexes: ParsedIndex[]): void {
  const indexName =
    def.index ?? `idx_${(def.definition ?? []).map((c: any) => extractColumnName(c)).join('_')}`;
  const columns = (def.definition ?? []).map((c: any) => extractColumnName(c));
  const indexType = def.index_type?.type?.toUpperCase() ?? 'BTREE';
  const isUnique = /unique/i.test(def.keyword ?? '');

  indexes.push({
    indexName,
    indexType,
    isUnique,
    isPrimary: false,
    columns,
  });
}

// ---------------------------------------------------------------------------
// Extract schema.table from AST table references
// ---------------------------------------------------------------------------

function extractTableName(tableRef: any): {
  schemaName: string;
  tableName: string;
} {
  if (!tableRef) return { schemaName: 'public', tableName: 'unknown' };

  // Array form: [{ db, table }]
  if (Array.isArray(tableRef)) {
    const first = tableRef[0];
    return {
      schemaName: first?.db ?? 'public',
      tableName: first?.table ?? 'unknown',
    };
  }

  return {
    schemaName: tableRef.db ?? 'public',
    tableName: tableRef.table ?? 'unknown',
  };
}

// ---------------------------------------------------------------------------
// Regex fallback parser
// ---------------------------------------------------------------------------

function extractWithRegex(
  stmt: ParsedStatement,
  dialect: SQLDialect,
  tables: ParsedTable[],
  errors: ParseError[],
): void {
  if (stmt.type === 'CREATE TABLE') {
    extractCreateTableRegex(stmt, dialect, tables, errors);
  } else if (stmt.type === 'CREATE INDEX') {
    extractCreateIndexRegex(stmt, tables, errors);
  } else if (stmt.type === 'ALTER TABLE') {
    extractAlterTableRegex(stmt, tables, errors);
  }
}

// ---------------------------------------------------------------------------
// Regex: CREATE TABLE
// ---------------------------------------------------------------------------

function extractCreateTableRegex(
  stmt: ParsedStatement,
  dialect: SQLDialect,
  tables: ParsedTable[],
  errors: ParseError[],
): void {
  const sql = stmt.raw;

  // Match: CREATE [TEMP|TEMPORARY] TABLE [IF NOT EXISTS] [schema.]table_name
  const tableMatch = sql.match(
    /CREATE\s+(?:(?:TEMP|TEMPORARY|GLOBAL\s+TEMPORARY|LOCAL\s+TEMPORARY)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:["'`\[]?(\w+)["'`\]]?)\.)?["'`\[]?(\w+)["'`\]]?\s*\(/i,
  );

  if (!tableMatch) {
    errors.push({
      line: stmt.lineStart,
      message: 'Could not extract table name from CREATE TABLE statement',
      statement: sql.substring(0, 200),
      severity: 'warning',
    });
    return;
  }

  const schemaName = tableMatch[1] ?? 'public';
  const tableName = tableMatch[2];

  // Extract the content inside the parentheses
  const bodyMatch = extractParenthesizedBody(sql);
  if (!bodyMatch) {
    tables.push({
      schemaName,
      tableName,
      tableType: 'table',
      columns: [],
      indexes: [],
      constraints: [],
      originalDDL: sql,
    });
    return;
  }

  const columns: ParsedColumn[] = [];
  const indexes: ParsedIndex[] = [];
  const constraints: ParsedConstraint[] = [];

  // Split the body by commas at the top level (respecting parentheses)
  const parts = splitTopLevelCommas(bodyMatch);
  let ordinal = 0;

  const pkColumns = new Set<string>();

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check if this is a constraint
    if (/^\s*(CONSTRAINT\s+|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK\s*\()/i.test(trimmed)) {
      parseConstraintRegex(trimmed, constraints, indexes, pkColumns);
      continue;
    }

    // Check if this is an index definition
    if (/^\s*(INDEX|KEY)\s+/i.test(trimmed)) {
      parseIndexRegex(trimmed, indexes);
      continue;
    }

    // Otherwise it's a column definition
    ordinal++;
    const col = parseColumnRegex(trimmed, ordinal, dialect);
    if (col) {
      columns.push(col);
      if (col.isPrimaryKey) {
        pkColumns.add(col.name);
      }
    }
  }

  // Mark PK columns from table-level PK constraints
  for (const col of columns) {
    if (pkColumns.has(col.name)) {
      col.isPrimaryKey = true;
      col.isNullable = false;
    }
  }

  // Add PK index if needed
  if (pkColumns.size > 0 && !indexes.some((idx) => idx.isPrimary)) {
    indexes.push({
      indexName: `pk_${tableName}`,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: true,
      columns: Array.from(pkColumns),
    });
  }

  tables.push({
    schemaName,
    tableName,
    tableType: 'table',
    columns,
    indexes,
    constraints,
    originalDDL: sql,
  });
}

// ---------------------------------------------------------------------------
// Regex: CREATE INDEX
// ---------------------------------------------------------------------------

function extractCreateIndexRegex(
  stmt: ParsedStatement,
  tables: ParsedTable[],
  errors: ParseError[],
): void {
  const sql = stmt.raw;

  const match = sql.match(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:(?:IF\s+NOT\s+EXISTS\s+)?(?:CONCURRENTLY\s+)?)?["'`\[]?(\w+)["'`\]]?\s+ON\s+(?:["'`\[]?(\w+)["'`\]]?\.)?["'`\[]?(\w+)["'`\]]?\s*\(([^)]+)\)/i,
  );

  if (!match) return;

  const isUnique = !!match[1];
  const indexName = match[2];
  const schemaName = match[3] ?? 'public';
  const tableName = match[4];
  const columnsRaw = match[5];

  const columns = columnsRaw
    .split(',')
    .map((c) => c.trim().replace(/["'`\[\]]/g, '').split(/\s+/)[0])
    .filter(Boolean);

  let table = tables.find(
    (t) =>
      t.tableName.toLowerCase() === tableName.toLowerCase() &&
      t.schemaName.toLowerCase() === schemaName.toLowerCase(),
  );

  if (!table) {
    table = {
      schemaName,
      tableName,
      tableType: 'table',
      columns: [],
      indexes: [],
      constraints: [],
      originalDDL: '',
    };
    tables.push(table);
  }

  table.indexes.push({
    indexName,
    indexType: 'BTREE',
    isUnique,
    isPrimary: false,
    columns,
  });
}

// ---------------------------------------------------------------------------
// Regex: ALTER TABLE ADD CONSTRAINT
// ---------------------------------------------------------------------------

function extractAlterTableRegex(
  stmt: ParsedStatement,
  tables: ParsedTable[],
  errors: ParseError[],
): void {
  const sql = stmt.raw;

  const tableMatch = sql.match(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:["'`\[]?(\w+)["'`\]]?\.)?["'`\[]?(\w+)["'`\]]?/i,
  );

  if (!tableMatch) return;

  const schemaName = tableMatch[1] ?? 'public';
  const tableName = tableMatch[2];

  let table = tables.find(
    (t) =>
      t.tableName.toLowerCase() === tableName.toLowerCase() &&
      t.schemaName.toLowerCase() === schemaName.toLowerCase(),
  );

  if (!table) {
    table = {
      schemaName,
      tableName,
      tableType: 'table',
      columns: [],
      indexes: [],
      constraints: [],
      originalDDL: '',
    };
    tables.push(table);
  }

  // Check for ADD CONSTRAINT ... FOREIGN KEY
  const fkMatch = sql.match(
    /ADD\s+CONSTRAINT\s+["'`\[]?(\w+)["'`\]]?\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:["'`\[]?(\w+)["'`\]]?\.)?["'`\[]?(\w+)["'`\]]?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(\w+(?:\s+\w+)?))?(?:\s+ON\s+UPDATE\s+(\w+(?:\s+\w+)?))?/i,
  );

  if (fkMatch) {
    const constraintName = fkMatch[1];
    const srcCols = fkMatch[2].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));
    const refSchema = fkMatch[3] ?? 'public';
    const refTable = fkMatch[4];
    const refCols = fkMatch[5].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));
    const onDelete = fkMatch[6] ?? null;
    const onUpdate = fkMatch[7] ?? null;

    const definition = `FOREIGN KEY (${srcCols.join(', ')}) REFERENCES ${refSchema !== 'public' ? refSchema + '.' : ''}${refTable}(${refCols.join(', ')})${onDelete ? ' ON DELETE ' + onDelete : ''}${onUpdate ? ' ON UPDATE ' + onUpdate : ''}`;

    table.constraints.push({
      constraintName,
      constraintType: 'FOREIGN KEY',
      definition,
      columns: srcCols,
    });
    return;
  }

  // Check for ADD PRIMARY KEY
  const pkMatch = sql.match(
    /ADD\s+(?:CONSTRAINT\s+["'`\[]?(\w+)["'`\]]?\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i,
  );

  if (pkMatch) {
    const constraintName = pkMatch[1] ?? `pk_${tableName}`;
    const columns = pkMatch[2].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));

    table.constraints.push({
      constraintName,
      constraintType: 'PRIMARY KEY',
      definition: `PRIMARY KEY (${columns.join(', ')})`,
      columns,
    });

    table.indexes.push({
      indexName: constraintName,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: true,
      columns,
    });
    return;
  }

  // Check for ADD UNIQUE
  const uniqMatch = sql.match(
    /ADD\s+(?:CONSTRAINT\s+["'`\[]?(\w+)["'`\]]?\s+)?UNIQUE\s*\(([^)]+)\)/i,
  );

  if (uniqMatch) {
    const constraintName = uniqMatch[1] ?? `uq_${tableName}`;
    const columns = uniqMatch[2].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));

    table.constraints.push({
      constraintName,
      constraintType: 'UNIQUE',
      definition: `UNIQUE (${columns.join(', ')})`,
      columns,
    });

    table.indexes.push({
      indexName: constraintName,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: false,
      columns,
    });
  }
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/**
 * Extract the body inside the outermost parentheses of a CREATE TABLE statement.
 */
function extractParenthesizedBody(sql: string): string | null {
  let depth = 0;
  let start = -1;

  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (sql[i] === ')') {
      depth--;
      if (depth === 0 && start >= 0) {
        return sql.substring(start, i);
      }
    }
  }
  return null;
}

/**
 * Split a string by commas, but only at the top level (respecting parentheses).
 */
function splitTopLevelCommas(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * Parse a column definition from a regex-based parse.
 */
function parseColumnRegex(
  text: string,
  ordinal: number,
  dialect: SQLDialect,
): ParsedColumn | null {
  // Column pattern: column_name DATA_TYPE [(len[,scale])] [constraints...]
  const match = text.match(
    /^\s*["'`\[]?(\w+)["'`\]]?\s+(\w+(?:\s+\w+)?)\s*(?:\(([^)]+)\))?\s*(.*)/is,
  );

  if (!match) return null;

  const name = match[1];
  let dataTypeBase = match[2].trim();
  const sizeStr = match[3] ?? null;
  const rest = match[4] ?? '';

  // Build full data type
  let dataType = dataTypeBase;
  if (sizeStr) {
    dataType += `(${sizeStr})`;
  }

  // Parse size info
  let charMaxLen: number | null = null;
  let numPrecision: number | null = null;
  let numScale: number | null = null;

  if (sizeStr) {
    const sizeParts = sizeStr.split(',').map((s) => s.trim());
    const first = parseInt(sizeParts[0], 10);
    if (!isNaN(first)) {
      if (sizeParts.length > 1) {
        numPrecision = first;
        numScale = parseInt(sizeParts[1], 10) || null;
      } else {
        charMaxLen = first;
      }
    }
  }

  // Parse constraints from the rest of the line
  const upperRest = rest.toUpperCase();
  const isPK =
    /\bPRIMARY\s+KEY\b/.test(upperRest) ||
    (dialect === 'mysql' && /\bAUTO_INCREMENT\b/.test(upperRest) && /\bKEY\b/.test(upperRest));
  const isUnique = /\bUNIQUE\b/.test(upperRest);
  const isNullable = !(/\bNOT\s+NULL\b/.test(upperRest) || isPK);

  // Default value
  let defaultValue: string | null = null;
  const defaultMatch = rest.match(/\bDEFAULT\s+('(?:[^']|'')*'|[^\s,]+)/i);
  if (defaultMatch) {
    defaultValue = defaultMatch[1];
  }

  // SERIAL / BIGSERIAL / AUTO_INCREMENT
  if (/\bSERIAL\b/i.test(dataTypeBase)) {
    defaultValue = defaultValue ?? 'auto_increment';
  }
  if (/\bAUTO_INCREMENT\b/i.test(rest)) {
    defaultValue = defaultValue ?? 'auto_increment';
  }
  if (/\bIDENTITY\b/i.test(rest)) {
    defaultValue = defaultValue ?? 'identity';
  }

  return {
    name,
    dataType,
    normalizedType: normalizeDataType(dataTypeBase),
    ordinalPosition: ordinal,
    isNullable,
    isPrimaryKey: isPK,
    isUnique,
    defaultValue,
    characterMaxLength: charMaxLen,
    numericPrecision: numPrecision,
    numericScale: numScale,
  };
}

/**
 * Parse a table-level constraint from regex-based parse.
 */
function parseConstraintRegex(
  text: string,
  constraints: ParsedConstraint[],
  indexes: ParsedIndex[],
  pkColumns: Set<string>,
): void {
  // CONSTRAINT name ...
  let constraintName = 'unnamed';
  let body = text;

  const namedMatch = text.match(/^\s*CONSTRAINT\s+["'`\[]?(\w+)["'`\]]?\s+(.*)/is);
  if (namedMatch) {
    constraintName = namedMatch[1];
    body = namedMatch[2];
  }

  // PRIMARY KEY
  const pkMatch = body.match(/^\s*PRIMARY\s+KEY\s*\(([^)]+)\)/i);
  if (pkMatch) {
    const cols = pkMatch[1].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));
    for (const c of cols) pkColumns.add(c);

    constraints.push({
      constraintName: constraintName === 'unnamed' ? `pk_constraint` : constraintName,
      constraintType: 'PRIMARY KEY',
      definition: `PRIMARY KEY (${cols.join(', ')})`,
      columns: cols,
    });

    indexes.push({
      indexName: constraintName === 'unnamed' ? `pk_constraint` : constraintName,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: true,
      columns: cols,
    });
    return;
  }

  // UNIQUE
  const uniqMatch = body.match(/^\s*UNIQUE\s*(?:KEY\s*)?(?:["'`\[]?\w+["'`\]]?\s*)?\(([^)]+)\)/i);
  if (uniqMatch) {
    const cols = uniqMatch[1].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));

    constraints.push({
      constraintName: constraintName === 'unnamed' ? `uq_constraint` : constraintName,
      constraintType: 'UNIQUE',
      definition: `UNIQUE (${cols.join(', ')})`,
      columns: cols,
    });

    indexes.push({
      indexName: constraintName === 'unnamed' ? `uq_constraint` : constraintName,
      indexType: 'BTREE',
      isUnique: true,
      isPrimary: false,
      columns: cols,
    });
    return;
  }

  // FOREIGN KEY
  const fkMatch = body.match(
    /^\s*FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:["'`\[]?(\w+)["'`\]]?\.)?["'`\[]?(\w+)["'`\]]?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(\w+(?:\s+\w+)?))?(?:\s+ON\s+UPDATE\s+(\w+(?:\s+\w+)?))?/i,
  );
  if (fkMatch) {
    const srcCols = fkMatch[1].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));
    const refSchema = fkMatch[2] ?? '';
    const refTable = fkMatch[3];
    const refCols = fkMatch[4].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, ''));
    const onDelete = fkMatch[5] ?? '';
    const onUpdate = fkMatch[6] ?? '';

    const definition = `FOREIGN KEY (${srcCols.join(', ')}) REFERENCES ${refSchema ? refSchema + '.' : ''}${refTable}(${refCols.join(', ')})${onDelete ? ' ON DELETE ' + onDelete : ''}${onUpdate ? ' ON UPDATE ' + onUpdate : ''}`;

    constraints.push({
      constraintName: constraintName === 'unnamed' ? `fk_constraint` : constraintName,
      constraintType: 'FOREIGN KEY',
      definition,
      columns: srcCols,
    });
    return;
  }

  // CHECK
  const checkMatch = body.match(/^\s*CHECK\s*\((.+)\)\s*$/is);
  if (checkMatch) {
    constraints.push({
      constraintName: constraintName === 'unnamed' ? `chk_constraint` : constraintName,
      constraintType: 'CHECK',
      definition: `CHECK (${checkMatch[1]})`,
      columns: [],
    });
  }
}

/**
 * Parse a table-level index definition (MySQL KEY/INDEX) from regex.
 */
function parseIndexRegex(text: string, indexes: ParsedIndex[]): void {
  const match = text.match(
    /^\s*(?:UNIQUE\s+)?(?:INDEX|KEY)\s+["'`\[]?(\w+)["'`\]]?\s*\(([^)]+)\)/i,
  );
  if (!match) return;

  const isUnique = /^\s*UNIQUE/i.test(text);
  const indexName = match[1];
  const columns = match[2].split(',').map((c) => c.trim().replace(/["'`\[\]]/g, '').split(/\s+/)[0]).filter(Boolean);

  indexes.push({
    indexName,
    indexType: 'BTREE',
    isUnique,
    isPrimary: false,
    columns,
  });
}
