/**
 * SQL Dialect Converter Service
 *
 * Converts SQL statements between database dialects by applying
 * data type mappings and syntax transformations.
 */

interface ConversionChange {
  original: string;
  converted: string;
  reason: string;
}

interface ConversionResult {
  sql: string;
  changes: ConversionChange[];
  sourceDialect: string;
  targetDialect: string;
}

// ---------- Data Type Mappings ----------

const DATA_TYPE_MAP: Record<string, Record<string, string>> = {
  // PostgreSQL source types
  'postgresql->mysql': {
    SERIAL: 'INT AUTO_INCREMENT',
    BIGSERIAL: 'BIGINT AUTO_INCREMENT',
    SMALLSERIAL: 'SMALLINT AUTO_INCREMENT',
    BOOLEAN: 'TINYINT(1)',
    TEXT: 'TEXT',
    BYTEA: 'BLOB',
    TIMESTAMPTZ: 'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP',
    JSONB: 'JSON',
    UUID: 'CHAR(36)',
    INET: 'VARCHAR(45)',
    CIDR: 'VARCHAR(43)',
    MACADDR: 'VARCHAR(17)',
    'DOUBLE PRECISION': 'DOUBLE',
    REAL: 'FLOAT',
  },
  'postgresql->sqlserver': {
    SERIAL: 'INT IDENTITY(1,1)',
    BIGSERIAL: 'BIGINT IDENTITY(1,1)',
    SMALLSERIAL: 'SMALLINT IDENTITY(1,1)',
    BOOLEAN: 'BIT',
    TEXT: 'NVARCHAR(MAX)',
    BYTEA: 'VARBINARY(MAX)',
    TIMESTAMPTZ: 'DATETIMEOFFSET',
    'TIMESTAMP WITH TIME ZONE': 'DATETIMEOFFSET',
    JSONB: 'NVARCHAR(MAX)',
    JSON: 'NVARCHAR(MAX)',
    UUID: 'UNIQUEIDENTIFIER',
    'DOUBLE PRECISION': 'FLOAT',
    REAL: 'REAL',
  },
  'postgresql->oracle': {
    SERIAL: 'NUMBER GENERATED ALWAYS AS IDENTITY',
    BIGSERIAL: 'NUMBER GENERATED ALWAYS AS IDENTITY',
    SMALLSERIAL: 'NUMBER GENERATED ALWAYS AS IDENTITY',
    BOOLEAN: 'NUMBER(1)',
    TEXT: 'CLOB',
    VARCHAR: 'VARCHAR2',
    BYTEA: 'BLOB',
    TIMESTAMPTZ: 'TIMESTAMP WITH TIME ZONE',
    JSONB: 'CLOB',
    JSON: 'CLOB',
    UUID: 'RAW(16)',
    'DOUBLE PRECISION': 'BINARY_DOUBLE',
    REAL: 'BINARY_FLOAT',
    INTEGER: 'NUMBER(10)',
    BIGINT: 'NUMBER(19)',
    SMALLINT: 'NUMBER(5)',
  },

  // MySQL source types
  'mysql->postgresql': {
    'INT AUTO_INCREMENT': 'SERIAL',
    'BIGINT AUTO_INCREMENT': 'BIGSERIAL',
    'SMALLINT AUTO_INCREMENT': 'SMALLSERIAL',
    'TINYINT(1)': 'BOOLEAN',
    TINYINT: 'SMALLINT',
    'DOUBLE': 'DOUBLE PRECISION',
    FLOAT: 'REAL',
    DATETIME: 'TIMESTAMP',
    BLOB: 'BYTEA',
    LONGBLOB: 'BYTEA',
    LONGTEXT: 'TEXT',
    MEDIUMTEXT: 'TEXT',
    'ENUM': 'VARCHAR(255)',
  },
  'mysql->sqlserver': {
    'INT AUTO_INCREMENT': 'INT IDENTITY(1,1)',
    'BIGINT AUTO_INCREMENT': 'BIGINT IDENTITY(1,1)',
    'TINYINT(1)': 'BIT',
    TEXT: 'NVARCHAR(MAX)',
    LONGTEXT: 'NVARCHAR(MAX)',
    MEDIUMTEXT: 'NVARCHAR(MAX)',
    BLOB: 'VARBINARY(MAX)',
    LONGBLOB: 'VARBINARY(MAX)',
    DATETIME: 'DATETIME2',
    JSON: 'NVARCHAR(MAX)',
    'DOUBLE': 'FLOAT',
  },

  // Oracle source types
  'oracle->postgresql': {
    VARCHAR2: 'VARCHAR',
    NUMBER: 'NUMERIC',
    'NUMBER(1)': 'BOOLEAN',
    CLOB: 'TEXT',
    BLOB: 'BYTEA',
    'RAW(16)': 'UUID',
    BINARY_DOUBLE: 'DOUBLE PRECISION',
    BINARY_FLOAT: 'REAL',
    'DATE': 'TIMESTAMP',
    'NUMBER(10)': 'INTEGER',
    'NUMBER(19)': 'BIGINT',
    'NUMBER(5)': 'SMALLINT',
  },
  'oracle->mysql': {
    VARCHAR2: 'VARCHAR',
    CLOB: 'LONGTEXT',
    BLOB: 'LONGBLOB',
    'NUMBER(1)': 'TINYINT(1)',
    NUMBER: 'DECIMAL',
    BINARY_DOUBLE: 'DOUBLE',
    BINARY_FLOAT: 'FLOAT',
    'DATE': 'DATETIME',
  },

  // MariaDB source types (MariaDB is mostly MySQL-compatible)
  'mariadb->postgresql': {
    'INT AUTO_INCREMENT': 'SERIAL',
    'BIGINT AUTO_INCREMENT': 'BIGSERIAL',
    'SMALLINT AUTO_INCREMENT': 'SMALLSERIAL',
    'TINYINT(1)': 'BOOLEAN',
    TINYINT: 'SMALLINT',
    'DOUBLE': 'DOUBLE PRECISION',
    FLOAT: 'REAL',
    DATETIME: 'TIMESTAMP',
    BLOB: 'BYTEA',
    LONGBLOB: 'BYTEA',
    LONGTEXT: 'TEXT',
    MEDIUMTEXT: 'TEXT',
    'ENUM': 'VARCHAR(255)',
  },
  'mariadb->sqlserver': {
    'INT AUTO_INCREMENT': 'INT IDENTITY(1,1)',
    'BIGINT AUTO_INCREMENT': 'BIGINT IDENTITY(1,1)',
    'TINYINT(1)': 'BIT',
    TEXT: 'NVARCHAR(MAX)',
    LONGTEXT: 'NVARCHAR(MAX)',
    MEDIUMTEXT: 'NVARCHAR(MAX)',
    BLOB: 'VARBINARY(MAX)',
    LONGBLOB: 'VARBINARY(MAX)',
    DATETIME: 'DATETIME2',
    JSON: 'NVARCHAR(MAX)',
    'DOUBLE': 'FLOAT',
  },

  // SQL Server source types
  'sqlserver->postgresql': {
    'INT IDENTITY(1,1)': 'SERIAL',
    'BIGINT IDENTITY(1,1)': 'BIGSERIAL',
    BIT: 'BOOLEAN',
    'NVARCHAR(MAX)': 'TEXT',
    NVARCHAR: 'VARCHAR',
    NCHAR: 'CHAR',
    'VARBINARY(MAX)': 'BYTEA',
    DATETIME2: 'TIMESTAMP',
    DATETIMEOFFSET: 'TIMESTAMPTZ',
    UNIQUEIDENTIFIER: 'UUID',
    IMAGE: 'BYTEA',
    MONEY: 'DECIMAL(19,4)',
    SMALLMONEY: 'DECIMAL(10,4)',
  },
  'sqlserver->mysql': {
    'INT IDENTITY(1,1)': 'INT AUTO_INCREMENT',
    'BIGINT IDENTITY(1,1)': 'BIGINT AUTO_INCREMENT',
    BIT: 'TINYINT(1)',
    'NVARCHAR(MAX)': 'LONGTEXT',
    NVARCHAR: 'VARCHAR',
    NCHAR: 'CHAR',
    'VARBINARY(MAX)': 'LONGBLOB',
    DATETIME2: 'DATETIME',
    DATETIMEOFFSET: 'DATETIME',
    UNIQUEIDENTIFIER: 'CHAR(36)',
    IMAGE: 'LONGBLOB',
    MONEY: 'DECIMAL(19,4)',
    SMALLMONEY: 'DECIMAL(10,4)',
  },

  // Snowflake source types
  'snowflake->postgresql': {
    VARIANT: 'JSONB',
    OBJECT: 'JSONB',
    ARRAY: 'JSONB',
    NUMBER: 'NUMERIC',
    FLOAT: 'DOUBLE PRECISION',
    STRING: 'TEXT',
    BINARY: 'BYTEA',
    TIMESTAMP_NTZ: 'TIMESTAMP',
    TIMESTAMP_LTZ: 'TIMESTAMPTZ',
    TIMESTAMP_TZ: 'TIMESTAMPTZ',
  },
  'snowflake->mysql': {
    VARIANT: 'JSON',
    OBJECT: 'JSON',
    ARRAY: 'JSON',
    NUMBER: 'DECIMAL',
    FLOAT: 'DOUBLE',
    STRING: 'TEXT',
    BINARY: 'BLOB',
    TIMESTAMP_NTZ: 'DATETIME',
    TIMESTAMP_LTZ: 'DATETIME',
    TIMESTAMP_TZ: 'DATETIME',
  },

  // BigQuery source types
  'bigquery->postgresql': {
    INT64: 'BIGINT',
    FLOAT64: 'DOUBLE PRECISION',
    NUMERIC: 'NUMERIC',
    BIGNUMERIC: 'NUMERIC',
    BOOL: 'BOOLEAN',
    STRING: 'TEXT',
    BYTES: 'BYTEA',
    DATE: 'DATE',
    DATETIME: 'TIMESTAMP',
    TIMESTAMP: 'TIMESTAMPTZ',
    GEOGRAPHY: 'GEOMETRY',
    STRUCT: 'JSONB',
  },
  'bigquery->mysql': {
    INT64: 'BIGINT',
    FLOAT64: 'DOUBLE',
    NUMERIC: 'DECIMAL',
    BIGNUMERIC: 'DECIMAL',
    BOOL: 'TINYINT(1)',
    STRING: 'TEXT',
    BYTES: 'BLOB',
    DATE: 'DATE',
    DATETIME: 'DATETIME',
    TIMESTAMP: 'DATETIME',
    STRUCT: 'JSON',
  },
};

// ---------- Syntax Transformations ----------

function applyDataTypeMappings(
  sql: string,
  mappingKey: string,
  changes: ConversionChange[],
): string {
  const mappings = DATA_TYPE_MAP[mappingKey];
  if (!mappings) return sql;

  let result = sql;

  // Sort by length descending so longer matches are applied first
  const sortedKeys = Object.keys(mappings).sort((a, b) => b.length - a.length);

  for (const sourceType of sortedKeys) {
    const targetType = mappings[sourceType];
    const regex = new RegExp(`\\b${escapeRegex(sourceType)}\\b`, 'gi');

    if (regex.test(result)) {
      result = result.replace(regex, targetType);
      changes.push({
        original: sourceType,
        converted: targetType,
        reason: `Data type mapping: ${sourceType} -> ${targetType}`,
      });
    }
  }

  return result;
}

function applySyntaxTransformations(
  sql: string,
  sourceDialect: string,
  targetDialect: string,
  changes: ConversionChange[],
): string {
  let result = sql;

  // IF NOT EXISTS handling
  if (sourceDialect === 'postgresql' && targetDialect === 'oracle') {
    const ifNotExistsRegex = /CREATE TABLE IF NOT EXISTS/gi;
    if (ifNotExistsRegex.test(result)) {
      result = result.replace(ifNotExistsRegex, 'CREATE TABLE');
      changes.push({
        original: 'CREATE TABLE IF NOT EXISTS',
        converted: 'CREATE TABLE',
        reason: 'Oracle does not support IF NOT EXISTS for CREATE TABLE',
      });
    }
  }

  // String concatenation
  if ((sourceDialect === 'mysql' || sourceDialect === 'mariadb') && (targetDialect === 'postgresql' || targetDialect === 'oracle')) {
    // CONCAT() is universal, but || is preferred in PG/Oracle
    // Leave CONCAT as-is since it works in both
  }

  // LIMIT / OFFSET -> FETCH FIRST (Oracle / SQL Server)
  if (
    (sourceDialect === 'postgresql' || sourceDialect === 'mysql' || sourceDialect === 'mariadb') &&
    (targetDialect === 'oracle' || targetDialect === 'sqlserver')
  ) {
    const limitOffsetRegex = /LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/gi;
    const match = limitOffsetRegex.exec(result);
    if (match) {
      const limit = match[1];
      const offset = match[2];
      let replacement = '';
      if (offset) {
        replacement = `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      } else {
        replacement = `FETCH FIRST ${limit} ROWS ONLY`;
      }
      result = result.replace(match[0], replacement);
      changes.push({
        original: match[0],
        converted: replacement,
        reason: 'Converted LIMIT/OFFSET to ANSI SQL FETCH FIRST syntax',
      });
    }
  }

  // FETCH FIRST -> LIMIT (reverse)
  if (
    (targetDialect === 'postgresql' || targetDialect === 'mysql' || targetDialect === 'mariadb') &&
    (sourceDialect === 'oracle' || sourceDialect === 'sqlserver')
  ) {
    const fetchRegex = /OFFSET\s+(\d+)\s+ROWS\s+FETCH\s+NEXT\s+(\d+)\s+ROWS\s+ONLY/gi;
    const fetchMatch = fetchRegex.exec(result);
    if (fetchMatch) {
      const offset = fetchMatch[1];
      const limit = fetchMatch[2];
      const replacement = `LIMIT ${limit} OFFSET ${offset}`;
      result = result.replace(fetchMatch[0], replacement);
      changes.push({
        original: fetchMatch[0],
        converted: replacement,
        reason: 'Converted FETCH FIRST to LIMIT/OFFSET syntax',
      });
    }

    const fetchFirstRegex = /FETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY/gi;
    const fetchFirstMatch = fetchFirstRegex.exec(result);
    if (fetchFirstMatch) {
      const limit = fetchFirstMatch[1];
      const replacement = `LIMIT ${limit}`;
      result = result.replace(fetchFirstMatch[0], replacement);
      changes.push({
        original: fetchFirstMatch[0],
        converted: replacement,
        reason: 'Converted FETCH FIRST to LIMIT syntax',
      });
    }
  }

  // Backtick quoting (MySQL/MariaDB) vs double-quote quoting (PostgreSQL/Oracle)
  if ((sourceDialect === 'mysql' || sourceDialect === 'mariadb') && targetDialect !== 'mysql' && targetDialect !== 'mariadb') {
    const backtickRegex = /`([^`]+)`/g;
    if (backtickRegex.test(result)) {
      result = result.replace(/`([^`]+)`/g, '"$1"');
      changes.push({
        original: '`identifier`',
        converted: '"identifier"',
        reason: 'Converted backtick quoting to double-quote quoting',
      });
    }
  }

  if (sourceDialect !== 'mysql' && sourceDialect !== 'mariadb' && (targetDialect === 'mysql' || targetDialect === 'mariadb')) {
    const doubleQuoteRegex = /"([^"]+)"/g;
    if (doubleQuoteRegex.test(result)) {
      result = result.replace(/"([^"]+)"/g, '`$1`');
      changes.push({
        original: '"identifier"',
        converted: '`identifier`',
        reason: 'Converted double-quote quoting to backtick quoting',
      });
    }
  }

  // AUTO_INCREMENT placement (MySQL) vs IDENTITY (SQL Server) vs SERIAL (PostgreSQL)
  // These are handled by data type mappings above

  // NOW() vs GETDATE() vs SYSDATE vs CURRENT_TIMESTAMP
  if (targetDialect === 'sqlserver') {
    if (/\bNOW\(\)/gi.test(result)) {
      result = result.replace(/\bNOW\(\)/gi, 'GETDATE()');
      changes.push({
        original: 'NOW()',
        converted: 'GETDATE()',
        reason: 'SQL Server uses GETDATE() instead of NOW()',
      });
    }
    if (/\bCURRENT_TIMESTAMP\b/gi.test(result)) {
      // CURRENT_TIMESTAMP works in SQL Server, no change needed
    }
  }

  if (targetDialect === 'oracle') {
    if (/\bNOW\(\)/gi.test(result)) {
      result = result.replace(/\bNOW\(\)/gi, 'SYSDATE');
      changes.push({
        original: 'NOW()',
        converted: 'SYSDATE',
        reason: 'Oracle uses SYSDATE instead of NOW()',
      });
    }
  }

  if (targetDialect === 'postgresql' || targetDialect === 'mysql' || targetDialect === 'mariadb') {
    if (/\bGETDATE\(\)/gi.test(result)) {
      result = result.replace(/\bGETDATE\(\)/gi, 'NOW()');
      changes.push({
        original: 'GETDATE()',
        converted: 'NOW()',
        reason: 'Converted GETDATE() to NOW()',
      });
    }
    if (/\bSYSDATE\b/gi.test(result)) {
      result = result.replace(/\bSYSDATE\b/gi, 'NOW()');
      changes.push({
        original: 'SYSDATE',
        converted: 'NOW()',
        reason: 'Converted SYSDATE to NOW()',
      });
    }
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- Public API ----------

export function convertDialect(
  sql: string,
  sourceDialect: string,
  targetDialect: string,
): ConversionResult {
  // Normalize aliases
  const aliasMap: Record<string, string> = {
    mssql: 'sqlserver',
    'sql server': 'sqlserver',
    postgres: 'postgresql',
    pg: 'postgresql',
    maria: 'mariadb',
  };

  const normalizedSource = aliasMap[sourceDialect.toLowerCase()] ?? sourceDialect.toLowerCase();
  const normalizedTarget = aliasMap[targetDialect.toLowerCase()] ?? targetDialect.toLowerCase();

  if (normalizedSource === normalizedTarget) {
    return {
      sql,
      changes: [],
      sourceDialect: normalizedSource,
      targetDialect: normalizedTarget,
    };
  }

  const changes: ConversionChange[] = [];
  const mappingKey = `${normalizedSource}->${normalizedTarget}`;

  let convertedSql = applyDataTypeMappings(sql, mappingKey, changes);
  convertedSql = applySyntaxTransformations(
    convertedSql,
    normalizedSource,
    normalizedTarget,
    changes,
  );

  return {
    sql: convertedSql,
    changes,
    sourceDialect: normalizedSource,
    targetDialect: normalizedTarget,
  };
}
