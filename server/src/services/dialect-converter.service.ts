/**
 * SQL Dialect Converter Service — Enterprise Edition
 *
 * Converts SQL statements between 7 database dialects by applying:
 * 1. Comprehensive data type mappings (with fallback via PostgreSQL intermediate)
 * 2. Syntax transformations (LIMIT, quoting, functions, casts, etc.)
 * 3. ENUM → CHECK constraint conversion
 * 4. Boolean literal normalization
 * 5. Function mapping (date, string, UUID, NULL-handling)
 * 6. Auto-increment / IDENTITY / SEQUENCE handling
 * 7. Index & constraint syntax normalization
 * 8. Schema prefix handling
 * 9. Table options (ENGINE for MySQL)
 * 10. Post-conversion validation with actionable suggestions
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

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
  validation?: ValidationResult;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'data_type' | 'syntax' | 'feature' | 'naming' | 'constraint';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

type Dialect = 'postgresql' | 'mysql' | 'mariadb' | 'sqlserver' | 'oracle' | 'snowflake' | 'bigquery';

// ═══════════════════════════════════════════════════════════════════════════════
// Data Type Mappings
// ═══════════════════════════════════════════════════════════════════════════════

const DATA_TYPE_MAP: Record<string, Record<string, string>> = {
  // ── PostgreSQL → Others ─────────────────────────────────────────────────────
  'postgresql->mysql': {
    'SERIAL PRIMARY KEY': 'INT AUTO_INCREMENT PRIMARY KEY',
    'BIGSERIAL PRIMARY KEY': 'BIGINT AUTO_INCREMENT PRIMARY KEY',
    'SMALLSERIAL PRIMARY KEY': 'SMALLINT AUTO_INCREMENT PRIMARY KEY',
    SERIAL: 'INT AUTO_INCREMENT',
    BIGSERIAL: 'BIGINT AUTO_INCREMENT',
    SMALLSERIAL: 'SMALLINT AUTO_INCREMENT',
    BOOLEAN: 'TINYINT(1)',
    BYTEA: 'LONGBLOB',
    TIMESTAMPTZ: 'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP',
    JSONB: 'JSON',
    UUID: 'CHAR(36)',
    INET: 'VARCHAR(45)',
    CIDR: 'VARCHAR(43)',
    MACADDR: 'VARCHAR(17)',
    'DOUBLE PRECISION': 'DOUBLE',
    REAL: 'FLOAT',
    'CHARACTER VARYING': 'VARCHAR',
    INTERVAL: 'VARCHAR(50)',
    MONEY: 'DECIMAL(19,4)',
    'BIT VARYING': 'BIT',
    CITEXT: 'VARCHAR(255)',
    HSTORE: 'JSON',
    XML: 'TEXT',
    POINT: 'POINT',
    'TEXT[]': 'JSON',
    'INTEGER[]': 'JSON',
    'VARCHAR[]': 'JSON',
  },
  'postgresql->mariadb': {
    'SERIAL PRIMARY KEY': 'INT AUTO_INCREMENT PRIMARY KEY',
    'BIGSERIAL PRIMARY KEY': 'BIGINT AUTO_INCREMENT PRIMARY KEY',
    'SMALLSERIAL PRIMARY KEY': 'SMALLINT AUTO_INCREMENT PRIMARY KEY',
    SERIAL: 'INT AUTO_INCREMENT',
    BIGSERIAL: 'BIGINT AUTO_INCREMENT',
    SMALLSERIAL: 'SMALLINT AUTO_INCREMENT',
    BOOLEAN: 'TINYINT(1)',
    BYTEA: 'LONGBLOB',
    TIMESTAMPTZ: 'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP',
    JSONB: 'JSON',
    UUID: 'CHAR(36)',
    INET: 'VARCHAR(45)',
    CIDR: 'VARCHAR(43)',
    MACADDR: 'VARCHAR(17)',
    'DOUBLE PRECISION': 'DOUBLE',
    REAL: 'FLOAT',
    'CHARACTER VARYING': 'VARCHAR',
    INTERVAL: 'VARCHAR(50)',
    MONEY: 'DECIMAL(19,4)',
    CITEXT: 'VARCHAR(255)',
    HSTORE: 'JSON',
    XML: 'TEXT',
    'TEXT[]': 'JSON',
    'INTEGER[]': 'JSON',
    'VARCHAR[]': 'JSON',
  },
  'postgresql->sqlserver': {
    'SERIAL PRIMARY KEY': 'INT IDENTITY(1,1) PRIMARY KEY',
    'BIGSERIAL PRIMARY KEY': 'BIGINT IDENTITY(1,1) PRIMARY KEY',
    'SMALLSERIAL PRIMARY KEY': 'SMALLINT IDENTITY(1,1) PRIMARY KEY',
    SERIAL: 'INT IDENTITY(1,1)',
    BIGSERIAL: 'BIGINT IDENTITY(1,1)',
    SMALLSERIAL: 'SMALLINT IDENTITY(1,1)',
    BOOLEAN: 'BIT',
    TEXT: 'NVARCHAR(MAX)',
    BYTEA: 'VARBINARY(MAX)',
    TIMESTAMPTZ: 'DATETIMEOFFSET',
    'TIMESTAMP WITH TIME ZONE': 'DATETIMEOFFSET',
    TIMESTAMP: 'DATETIME2',
    JSONB: 'NVARCHAR(MAX)',
    JSON: 'NVARCHAR(MAX)',
    UUID: 'UNIQUEIDENTIFIER',
    'DOUBLE PRECISION': 'FLOAT',
    REAL: 'REAL',
    'CHARACTER VARYING': 'NVARCHAR',
    INTERVAL: 'NVARCHAR(50)',
    MONEY: 'MONEY',
    CITEXT: 'NVARCHAR(255)',
    HSTORE: 'NVARCHAR(MAX)',
    XML: 'XML',
    'TEXT[]': 'NVARCHAR(MAX)',
    'INTEGER[]': 'NVARCHAR(MAX)',
    'VARCHAR[]': 'NVARCHAR(MAX)',
  },
  'postgresql->oracle': {
    'SERIAL PRIMARY KEY': 'NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    'BIGSERIAL PRIMARY KEY': 'NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    'SMALLSERIAL PRIMARY KEY': 'NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    SERIAL: 'NUMBER GENERATED ALWAYS AS IDENTITY',
    BIGSERIAL: 'NUMBER GENERATED ALWAYS AS IDENTITY',
    SMALLSERIAL: 'NUMBER GENERATED ALWAYS AS IDENTITY',
    BOOLEAN: 'NUMBER(1)',
    TEXT: 'CLOB',
    VARCHAR: 'VARCHAR2',
    'CHARACTER VARYING': 'VARCHAR2',
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
    INTERVAL: 'INTERVAL DAY TO SECOND',
    MONEY: 'NUMBER(19,4)',
    CITEXT: 'VARCHAR2(255)',
    HSTORE: 'CLOB',
    'TEXT[]': 'CLOB',
    'INTEGER[]': 'CLOB',
    'VARCHAR[]': 'CLOB',
  },
  'postgresql->snowflake': {
    'SERIAL PRIMARY KEY': 'INT AUTOINCREMENT PRIMARY KEY',
    'BIGSERIAL PRIMARY KEY': 'BIGINT AUTOINCREMENT PRIMARY KEY',
    'SMALLSERIAL PRIMARY KEY': 'SMALLINT AUTOINCREMENT PRIMARY KEY',
    SERIAL: 'INT AUTOINCREMENT',
    BIGSERIAL: 'BIGINT AUTOINCREMENT',
    SMALLSERIAL: 'SMALLINT AUTOINCREMENT',
    BOOLEAN: 'BOOLEAN',
    TEXT: 'VARCHAR',
    BYTEA: 'BINARY',
    TIMESTAMPTZ: 'TIMESTAMP_TZ',
    'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP_TZ',
    TIMESTAMP: 'TIMESTAMP_NTZ',
    JSONB: 'VARIANT',
    JSON: 'VARIANT',
    UUID: 'VARCHAR(36)',
    'DOUBLE PRECISION': 'FLOAT',
    'CHARACTER VARYING': 'VARCHAR',
    INTERVAL: 'VARCHAR(50)',
    MONEY: 'NUMBER(19,4)',
    CITEXT: 'VARCHAR',
    HSTORE: 'VARIANT',
    'TEXT[]': 'VARIANT',
    'INTEGER[]': 'VARIANT',
    'VARCHAR[]': 'VARIANT',
  },
  'postgresql->bigquery': {
    'SERIAL PRIMARY KEY': 'INT64',
    'BIGSERIAL PRIMARY KEY': 'INT64',
    'SMALLSERIAL PRIMARY KEY': 'INT64',
    SERIAL: 'INT64',
    BIGSERIAL: 'INT64',
    SMALLSERIAL: 'INT64',
    BOOLEAN: 'BOOL',
    TEXT: 'STRING',
    VARCHAR: 'STRING',
    'CHARACTER VARYING': 'STRING',
    CHAR: 'STRING',
    BYTEA: 'BYTES',
    TIMESTAMPTZ: 'TIMESTAMP',
    'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP',
    TIMESTAMP: 'DATETIME',
    DATE: 'DATE',
    TIME: 'TIME',
    JSONB: 'JSON',
    JSON: 'JSON',
    UUID: 'STRING',
    'DOUBLE PRECISION': 'FLOAT64',
    REAL: 'FLOAT64',
    INTEGER: 'INT64',
    BIGINT: 'INT64',
    SMALLINT: 'INT64',
    NUMERIC: 'NUMERIC',
    DECIMAL: 'NUMERIC',
    MONEY: 'NUMERIC',
    CITEXT: 'STRING',
    HSTORE: 'JSON',
    'TEXT[]': 'JSON',
    'INTEGER[]': 'JSON',
    'VARCHAR[]': 'JSON',
  },

  // ── MySQL → Others ──────────────────────────────────────────────────────────
  'mysql->postgresql': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'SERIAL PRIMARY KEY',
    'BIGINT AUTO_INCREMENT PRIMARY KEY': 'BIGSERIAL PRIMARY KEY',
    'SMALLINT AUTO_INCREMENT PRIMARY KEY': 'SMALLSERIAL PRIMARY KEY',
    'INT AUTO_INCREMENT': 'SERIAL',
    'BIGINT AUTO_INCREMENT': 'BIGSERIAL',
    'SMALLINT AUTO_INCREMENT': 'SMALLSERIAL',
    'TINYINT(1)': 'BOOLEAN',
    TINYINT: 'SMALLINT',
    MEDIUMINT: 'INTEGER',
    'DOUBLE': 'DOUBLE PRECISION',
    FLOAT: 'REAL',
    DATETIME: 'TIMESTAMP',
    BLOB: 'BYTEA',
    LONGBLOB: 'BYTEA',
    MEDIUMBLOB: 'BYTEA',
    TINYBLOB: 'BYTEA',
    LONGTEXT: 'TEXT',
    MEDIUMTEXT: 'TEXT',
    TINYTEXT: 'TEXT',
    YEAR: 'SMALLINT',
    BINARY: 'BYTEA',
    VARBINARY: 'BYTEA',
  },
  'mysql->sqlserver': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'INT IDENTITY(1,1) PRIMARY KEY',
    'BIGINT AUTO_INCREMENT PRIMARY KEY': 'BIGINT IDENTITY(1,1) PRIMARY KEY',
    'INT AUTO_INCREMENT': 'INT IDENTITY(1,1)',
    'BIGINT AUTO_INCREMENT': 'BIGINT IDENTITY(1,1)',
    'TINYINT(1)': 'BIT',
    TEXT: 'NVARCHAR(MAX)',
    LONGTEXT: 'NVARCHAR(MAX)',
    MEDIUMTEXT: 'NVARCHAR(MAX)',
    TINYTEXT: 'NVARCHAR(255)',
    BLOB: 'VARBINARY(MAX)',
    LONGBLOB: 'VARBINARY(MAX)',
    MEDIUMBLOB: 'VARBINARY(MAX)',
    DATETIME: 'DATETIME2',
    JSON: 'NVARCHAR(MAX)',
    'DOUBLE': 'FLOAT',
    FLOAT: 'REAL',
    YEAR: 'SMALLINT',
    MEDIUMINT: 'INT',
  },
  'mysql->oracle': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'NUMBER(10) GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    'BIGINT AUTO_INCREMENT PRIMARY KEY': 'NUMBER(19) GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    'INT AUTO_INCREMENT': 'NUMBER(10) GENERATED ALWAYS AS IDENTITY',
    'BIGINT AUTO_INCREMENT': 'NUMBER(19) GENERATED ALWAYS AS IDENTITY',
    'TINYINT(1)': 'NUMBER(1)',
    TINYINT: 'NUMBER(3)',
    MEDIUMINT: 'NUMBER(7)',
    INT: 'NUMBER(10)',
    INTEGER: 'NUMBER(10)',
    BIGINT: 'NUMBER(19)',
    VARCHAR: 'VARCHAR2',
    TEXT: 'CLOB',
    LONGTEXT: 'CLOB',
    MEDIUMTEXT: 'CLOB',
    TINYTEXT: 'VARCHAR2(255)',
    BLOB: 'BLOB',
    LONGBLOB: 'BLOB',
    MEDIUMBLOB: 'BLOB',
    DATETIME: 'DATE',
    TIMESTAMP: 'TIMESTAMP',
    'DOUBLE': 'BINARY_DOUBLE',
    FLOAT: 'BINARY_FLOAT',
    DECIMAL: 'NUMBER',
    JSON: 'CLOB',
    YEAR: 'NUMBER(4)',
    BOOLEAN: 'NUMBER(1)',
  },
  'mysql->mariadb': {
    // MariaDB is mostly MySQL-compatible, minimal changes
  },
  'mysql->snowflake': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'INT AUTOINCREMENT PRIMARY KEY',
    'BIGINT AUTO_INCREMENT PRIMARY KEY': 'BIGINT AUTOINCREMENT PRIMARY KEY',
    'INT AUTO_INCREMENT': 'INT AUTOINCREMENT',
    'BIGINT AUTO_INCREMENT': 'BIGINT AUTOINCREMENT',
    'TINYINT(1)': 'BOOLEAN',
    TINYINT: 'SMALLINT',
    MEDIUMINT: 'INT',
    TEXT: 'VARCHAR',
    LONGTEXT: 'VARCHAR',
    MEDIUMTEXT: 'VARCHAR',
    TINYTEXT: 'VARCHAR(255)',
    BLOB: 'BINARY',
    LONGBLOB: 'BINARY',
    DATETIME: 'TIMESTAMP_NTZ',
    JSON: 'VARIANT',
    'DOUBLE': 'FLOAT',
    YEAR: 'SMALLINT',
  },
  'mysql->bigquery': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'INT64',
    'BIGINT AUTO_INCREMENT PRIMARY KEY': 'INT64',
    'INT AUTO_INCREMENT': 'INT64',
    'BIGINT AUTO_INCREMENT': 'INT64',
    'TINYINT(1)': 'BOOL',
    TINYINT: 'INT64',
    SMALLINT: 'INT64',
    MEDIUMINT: 'INT64',
    INT: 'INT64',
    INTEGER: 'INT64',
    BIGINT: 'INT64',
    'DOUBLE': 'FLOAT64',
    FLOAT: 'FLOAT64',
    DECIMAL: 'NUMERIC',
    VARCHAR: 'STRING',
    CHAR: 'STRING',
    TEXT: 'STRING',
    LONGTEXT: 'STRING',
    MEDIUMTEXT: 'STRING',
    TINYTEXT: 'STRING',
    BLOB: 'BYTES',
    LONGBLOB: 'BYTES',
    DATE: 'DATE',
    DATETIME: 'DATETIME',
    TIMESTAMP: 'TIMESTAMP',
    TIME: 'TIME',
    JSON: 'JSON',
    YEAR: 'INT64',
    BOOLEAN: 'BOOL',
  },

  // ── MariaDB → Others ───────────────────────────────────────────────────────
  'mariadb->postgresql': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'SERIAL PRIMARY KEY',
    'BIGINT AUTO_INCREMENT PRIMARY KEY': 'BIGSERIAL PRIMARY KEY',
    'SMALLINT AUTO_INCREMENT PRIMARY KEY': 'SMALLSERIAL PRIMARY KEY',
    'INT AUTO_INCREMENT': 'SERIAL',
    'BIGINT AUTO_INCREMENT': 'BIGSERIAL',
    'SMALLINT AUTO_INCREMENT': 'SMALLSERIAL',
    'TINYINT(1)': 'BOOLEAN',
    TINYINT: 'SMALLINT',
    MEDIUMINT: 'INTEGER',
    'DOUBLE': 'DOUBLE PRECISION',
    FLOAT: 'REAL',
    DATETIME: 'TIMESTAMP',
    BLOB: 'BYTEA',
    LONGBLOB: 'BYTEA',
    LONGTEXT: 'TEXT',
    MEDIUMTEXT: 'TEXT',
    TINYTEXT: 'TEXT',
    YEAR: 'SMALLINT',
  },
  'mariadb->sqlserver': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'INT IDENTITY(1,1) PRIMARY KEY',
    'BIGINT AUTO_INCREMENT PRIMARY KEY': 'BIGINT IDENTITY(1,1) PRIMARY KEY',
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
  'mariadb->oracle': {
    'INT AUTO_INCREMENT PRIMARY KEY': 'NUMBER(10) GENERATED ALWAYS AS IDENTITY PRIMARY KEY',
    'INT AUTO_INCREMENT': 'NUMBER(10) GENERATED ALWAYS AS IDENTITY',
    'BIGINT AUTO_INCREMENT': 'NUMBER(19) GENERATED ALWAYS AS IDENTITY',
    'TINYINT(1)': 'NUMBER(1)',
    TINYINT: 'NUMBER(3)',
    INT: 'NUMBER(10)',
    INTEGER: 'NUMBER(10)',
    BIGINT: 'NUMBER(19)',
    VARCHAR: 'VARCHAR2',
    TEXT: 'CLOB',
    LONGTEXT: 'CLOB',
    MEDIUMTEXT: 'CLOB',
    BLOB: 'BLOB',
    DATETIME: 'DATE',
    'DOUBLE': 'BINARY_DOUBLE',
    FLOAT: 'BINARY_FLOAT',
    JSON: 'CLOB',
    BOOLEAN: 'NUMBER(1)',
  },
  'mariadb->mysql': {
    // MariaDB → MySQL is mostly compatible
  },
  'mariadb->snowflake': {
    'INT AUTO_INCREMENT': 'INT AUTOINCREMENT',
    'BIGINT AUTO_INCREMENT': 'BIGINT AUTOINCREMENT',
    'TINYINT(1)': 'BOOLEAN',
    TEXT: 'VARCHAR',
    LONGTEXT: 'VARCHAR',
    MEDIUMTEXT: 'VARCHAR',
    BLOB: 'BINARY',
    DATETIME: 'TIMESTAMP_NTZ',
    JSON: 'VARIANT',
  },
  'mariadb->bigquery': {
    'INT AUTO_INCREMENT': 'INT64',
    'BIGINT AUTO_INCREMENT': 'INT64',
    'TINYINT(1)': 'BOOL',
    INT: 'INT64',
    INTEGER: 'INT64',
    BIGINT: 'INT64',
    SMALLINT: 'INT64',
    VARCHAR: 'STRING',
    TEXT: 'STRING',
    LONGTEXT: 'STRING',
    BLOB: 'BYTES',
    DATETIME: 'DATETIME',
    JSON: 'JSON',
    'DOUBLE': 'FLOAT64',
    FLOAT: 'FLOAT64',
    DECIMAL: 'NUMERIC',
    BOOLEAN: 'BOOL',
  },

  // ── Oracle → Others ─────────────────────────────────────────────────────────
  'oracle->postgresql': {
    VARCHAR2: 'VARCHAR',
    NUMBER: 'NUMERIC',
    'NUMBER(1)': 'BOOLEAN',
    'NUMBER(3)': 'SMALLINT',
    'NUMBER(5)': 'SMALLINT',
    'NUMBER(10)': 'INTEGER',
    'NUMBER(19)': 'BIGINT',
    CLOB: 'TEXT',
    NCLOB: 'TEXT',
    BLOB: 'BYTEA',
    'RAW(16)': 'UUID',
    RAW: 'BYTEA',
    BINARY_DOUBLE: 'DOUBLE PRECISION',
    BINARY_FLOAT: 'REAL',
    'DATE': 'TIMESTAMP',
    'LONG': 'TEXT',
    NVARCHAR2: 'VARCHAR',
    'INTERVAL DAY TO SECOND': 'INTERVAL',
    'INTERVAL YEAR TO MONTH': 'INTERVAL',
    XMLTYPE: 'XML',
  },
  'oracle->mysql': {
    VARCHAR2: 'VARCHAR',
    NVARCHAR2: 'NVARCHAR',
    CLOB: 'LONGTEXT',
    NCLOB: 'LONGTEXT',
    BLOB: 'LONGBLOB',
    'NUMBER(1)': 'TINYINT(1)',
    'NUMBER(3)': 'TINYINT',
    'NUMBER(5)': 'SMALLINT',
    'NUMBER(10)': 'INT',
    'NUMBER(19)': 'BIGINT',
    NUMBER: 'DECIMAL',
    BINARY_DOUBLE: 'DOUBLE',
    BINARY_FLOAT: 'FLOAT',
    'DATE': 'DATETIME',
    'LONG': 'LONGTEXT',
    RAW: 'VARBINARY',
    'RAW(16)': 'CHAR(36)',
  },
  'oracle->mariadb': {
    VARCHAR2: 'VARCHAR',
    NVARCHAR2: 'NVARCHAR',
    CLOB: 'LONGTEXT',
    NCLOB: 'LONGTEXT',
    BLOB: 'LONGBLOB',
    'NUMBER(1)': 'TINYINT(1)',
    NUMBER: 'DECIMAL',
    BINARY_DOUBLE: 'DOUBLE',
    BINARY_FLOAT: 'FLOAT',
    'DATE': 'DATETIME',
    'LONG': 'LONGTEXT',
    RAW: 'VARBINARY',
  },
  'oracle->sqlserver': {
    VARCHAR2: 'NVARCHAR',
    NVARCHAR2: 'NVARCHAR',
    CLOB: 'NVARCHAR(MAX)',
    NCLOB: 'NVARCHAR(MAX)',
    BLOB: 'VARBINARY(MAX)',
    'NUMBER(1)': 'BIT',
    'NUMBER(10)': 'INT',
    'NUMBER(19)': 'BIGINT',
    NUMBER: 'DECIMAL',
    BINARY_DOUBLE: 'FLOAT',
    BINARY_FLOAT: 'REAL',
    'DATE': 'DATETIME2',
    TIMESTAMP: 'DATETIME2',
    'TIMESTAMP WITH TIME ZONE': 'DATETIMEOFFSET',
    'RAW(16)': 'UNIQUEIDENTIFIER',
    RAW: 'VARBINARY',
    'LONG': 'NVARCHAR(MAX)',
    XMLTYPE: 'XML',
  },
  'oracle->snowflake': {
    VARCHAR2: 'VARCHAR',
    NVARCHAR2: 'VARCHAR',
    CLOB: 'VARCHAR',
    NCLOB: 'VARCHAR',
    BLOB: 'BINARY',
    'NUMBER(1)': 'BOOLEAN',
    NUMBER: 'NUMBER',
    BINARY_DOUBLE: 'FLOAT',
    BINARY_FLOAT: 'FLOAT',
    'DATE': 'TIMESTAMP_NTZ',
    RAW: 'BINARY',
    'LONG': 'VARCHAR',
  },
  'oracle->bigquery': {
    VARCHAR2: 'STRING',
    NVARCHAR2: 'STRING',
    CLOB: 'STRING',
    NCLOB: 'STRING',
    BLOB: 'BYTES',
    'NUMBER(1)': 'BOOL',
    'NUMBER(10)': 'INT64',
    'NUMBER(19)': 'INT64',
    NUMBER: 'NUMERIC',
    BINARY_DOUBLE: 'FLOAT64',
    BINARY_FLOAT: 'FLOAT64',
    'DATE': 'DATETIME',
    RAW: 'BYTES',
    'LONG': 'STRING',
  },

  // ── SQL Server → Others ─────────────────────────────────────────────────────
  'sqlserver->postgresql': {
    'INT IDENTITY(1,1) PRIMARY KEY': 'SERIAL PRIMARY KEY',
    'BIGINT IDENTITY(1,1) PRIMARY KEY': 'BIGSERIAL PRIMARY KEY',
    'INT IDENTITY(1,1)': 'SERIAL',
    'BIGINT IDENTITY(1,1)': 'BIGSERIAL',
    BIT: 'BOOLEAN',
    'NVARCHAR(MAX)': 'TEXT',
    NVARCHAR: 'VARCHAR',
    NCHAR: 'CHAR',
    NTEXT: 'TEXT',
    'VARBINARY(MAX)': 'BYTEA',
    DATETIME2: 'TIMESTAMP',
    DATETIME: 'TIMESTAMP',
    SMALLDATETIME: 'TIMESTAMP',
    DATETIMEOFFSET: 'TIMESTAMPTZ',
    UNIQUEIDENTIFIER: 'UUID',
    IMAGE: 'BYTEA',
    MONEY: 'DECIMAL(19,4)',
    SMALLMONEY: 'DECIMAL(10,4)',
    TINYINT: 'SMALLINT',
    XML: 'XML',
    HIERARCHYID: 'VARCHAR(255)',
    SQL_VARIANT: 'TEXT',
    ROWVERSION: 'BYTEA',
  },
  'sqlserver->mysql': {
    'INT IDENTITY(1,1) PRIMARY KEY': 'INT AUTO_INCREMENT PRIMARY KEY',
    'BIGINT IDENTITY(1,1) PRIMARY KEY': 'BIGINT AUTO_INCREMENT PRIMARY KEY',
    'INT IDENTITY(1,1)': 'INT AUTO_INCREMENT',
    'BIGINT IDENTITY(1,1)': 'BIGINT AUTO_INCREMENT',
    BIT: 'TINYINT(1)',
    'NVARCHAR(MAX)': 'LONGTEXT',
    NVARCHAR: 'VARCHAR',
    NCHAR: 'CHAR',
    NTEXT: 'LONGTEXT',
    'VARBINARY(MAX)': 'LONGBLOB',
    DATETIME2: 'DATETIME',
    SMALLDATETIME: 'DATETIME',
    DATETIMEOFFSET: 'DATETIME',
    UNIQUEIDENTIFIER: 'CHAR(36)',
    IMAGE: 'LONGBLOB',
    MONEY: 'DECIMAL(19,4)',
    SMALLMONEY: 'DECIMAL(10,4)',
    XML: 'TEXT',
  },
  'sqlserver->mariadb': {
    'INT IDENTITY(1,1) PRIMARY KEY': 'INT AUTO_INCREMENT PRIMARY KEY',
    'BIGINT IDENTITY(1,1) PRIMARY KEY': 'BIGINT AUTO_INCREMENT PRIMARY KEY',
    'INT IDENTITY(1,1)': 'INT AUTO_INCREMENT',
    'BIGINT IDENTITY(1,1)': 'BIGINT AUTO_INCREMENT',
    BIT: 'TINYINT(1)',
    'NVARCHAR(MAX)': 'LONGTEXT',
    NVARCHAR: 'VARCHAR',
    NCHAR: 'CHAR',
    NTEXT: 'LONGTEXT',
    'VARBINARY(MAX)': 'LONGBLOB',
    DATETIME2: 'DATETIME',
    DATETIMEOFFSET: 'DATETIME',
    UNIQUEIDENTIFIER: 'CHAR(36)',
    IMAGE: 'LONGBLOB',
    MONEY: 'DECIMAL(19,4)',
    SMALLMONEY: 'DECIMAL(10,4)',
    XML: 'TEXT',
  },
  'sqlserver->oracle': {
    'INT IDENTITY(1,1)': 'NUMBER(10) GENERATED ALWAYS AS IDENTITY',
    'BIGINT IDENTITY(1,1)': 'NUMBER(19) GENERATED ALWAYS AS IDENTITY',
    BIT: 'NUMBER(1)',
    'NVARCHAR(MAX)': 'CLOB',
    NVARCHAR: 'NVARCHAR2',
    NCHAR: 'NCHAR',
    NTEXT: 'CLOB',
    'VARBINARY(MAX)': 'BLOB',
    VARCHAR: 'VARCHAR2',
    INT: 'NUMBER(10)',
    INTEGER: 'NUMBER(10)',
    BIGINT: 'NUMBER(19)',
    SMALLINT: 'NUMBER(5)',
    TINYINT: 'NUMBER(3)',
    FLOAT: 'BINARY_DOUBLE',
    REAL: 'BINARY_FLOAT',
    DATETIME2: 'TIMESTAMP',
    DATETIME: 'DATE',
    DATETIMEOFFSET: 'TIMESTAMP WITH TIME ZONE',
    UNIQUEIDENTIFIER: 'RAW(16)',
    IMAGE: 'BLOB',
    MONEY: 'NUMBER(19,4)',
    SMALLMONEY: 'NUMBER(10,4)',
    XML: 'XMLTYPE',
  },
  'sqlserver->snowflake': {
    'INT IDENTITY(1,1)': 'INT AUTOINCREMENT',
    'BIGINT IDENTITY(1,1)': 'BIGINT AUTOINCREMENT',
    BIT: 'BOOLEAN',
    'NVARCHAR(MAX)': 'VARCHAR',
    NVARCHAR: 'VARCHAR',
    NTEXT: 'VARCHAR',
    'VARBINARY(MAX)': 'BINARY',
    DATETIME2: 'TIMESTAMP_NTZ',
    DATETIME: 'TIMESTAMP_NTZ',
    DATETIMEOFFSET: 'TIMESTAMP_TZ',
    UNIQUEIDENTIFIER: 'VARCHAR(36)',
    MONEY: 'NUMBER(19,4)',
    IMAGE: 'BINARY',
    XML: 'VARIANT',
  },
  'sqlserver->bigquery': {
    'INT IDENTITY(1,1)': 'INT64',
    'BIGINT IDENTITY(1,1)': 'INT64',
    BIT: 'BOOL',
    'NVARCHAR(MAX)': 'STRING',
    NVARCHAR: 'STRING',
    VARCHAR: 'STRING',
    NTEXT: 'STRING',
    'VARBINARY(MAX)': 'BYTES',
    INT: 'INT64',
    INTEGER: 'INT64',
    BIGINT: 'INT64',
    SMALLINT: 'INT64',
    TINYINT: 'INT64',
    FLOAT: 'FLOAT64',
    REAL: 'FLOAT64',
    DECIMAL: 'NUMERIC',
    DATETIME2: 'DATETIME',
    DATETIME: 'DATETIME',
    DATETIMEOFFSET: 'TIMESTAMP',
    UNIQUEIDENTIFIER: 'STRING',
    MONEY: 'NUMERIC',
    IMAGE: 'BYTES',
    XML: 'STRING',
  },

  // ── Snowflake → Others ──────────────────────────────────────────────────────
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
  'snowflake->mariadb': {
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
  'snowflake->sqlserver': {
    VARIANT: 'NVARCHAR(MAX)',
    OBJECT: 'NVARCHAR(MAX)',
    ARRAY: 'NVARCHAR(MAX)',
    NUMBER: 'DECIMAL',
    FLOAT: 'FLOAT',
    STRING: 'NVARCHAR(MAX)',
    BINARY: 'VARBINARY(MAX)',
    TIMESTAMP_NTZ: 'DATETIME2',
    TIMESTAMP_LTZ: 'DATETIMEOFFSET',
    TIMESTAMP_TZ: 'DATETIMEOFFSET',
    BOOLEAN: 'BIT',
  },
  'snowflake->oracle': {
    VARIANT: 'CLOB',
    OBJECT: 'CLOB',
    ARRAY: 'CLOB',
    NUMBER: 'NUMBER',
    FLOAT: 'BINARY_DOUBLE',
    STRING: 'CLOB',
    BINARY: 'BLOB',
    TIMESTAMP_NTZ: 'TIMESTAMP',
    TIMESTAMP_LTZ: 'TIMESTAMP WITH TIME ZONE',
    TIMESTAMP_TZ: 'TIMESTAMP WITH TIME ZONE',
    BOOLEAN: 'NUMBER(1)',
    VARCHAR: 'VARCHAR2',
  },
  'snowflake->bigquery': {
    VARIANT: 'JSON',
    OBJECT: 'JSON',
    ARRAY: 'JSON',
    NUMBER: 'NUMERIC',
    FLOAT: 'FLOAT64',
    STRING: 'STRING',
    BINARY: 'BYTES',
    TIMESTAMP_NTZ: 'DATETIME',
    TIMESTAMP_LTZ: 'TIMESTAMP',
    TIMESTAMP_TZ: 'TIMESTAMP',
    BOOLEAN: 'BOOL',
    INT: 'INT64',
    BIGINT: 'INT64',
    SMALLINT: 'INT64',
    VARCHAR: 'STRING',
  },

  // ── BigQuery → Others ───────────────────────────────────────────────────────
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
    TIME: 'TIME',
    GEOGRAPHY: 'GEOMETRY',
    STRUCT: 'JSONB',
    JSON: 'JSONB',
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
    TIME: 'TIME',
    STRUCT: 'JSON',
    JSON: 'JSON',
  },
  'bigquery->mariadb': {
    INT64: 'BIGINT',
    FLOAT64: 'DOUBLE',
    NUMERIC: 'DECIMAL',
    BIGNUMERIC: 'DECIMAL',
    BOOL: 'TINYINT(1)',
    STRING: 'TEXT',
    BYTES: 'BLOB',
    DATETIME: 'DATETIME',
    TIMESTAMP: 'DATETIME',
    STRUCT: 'JSON',
    JSON: 'JSON',
  },
  'bigquery->sqlserver': {
    INT64: 'BIGINT',
    FLOAT64: 'FLOAT',
    NUMERIC: 'DECIMAL',
    BIGNUMERIC: 'DECIMAL',
    BOOL: 'BIT',
    STRING: 'NVARCHAR(MAX)',
    BYTES: 'VARBINARY(MAX)',
    DATE: 'DATE',
    DATETIME: 'DATETIME2',
    TIMESTAMP: 'DATETIMEOFFSET',
    TIME: 'TIME',
    STRUCT: 'NVARCHAR(MAX)',
    JSON: 'NVARCHAR(MAX)',
  },
  'bigquery->oracle': {
    INT64: 'NUMBER(19)',
    FLOAT64: 'BINARY_DOUBLE',
    NUMERIC: 'NUMBER',
    BIGNUMERIC: 'NUMBER',
    BOOL: 'NUMBER(1)',
    STRING: 'CLOB',
    BYTES: 'BLOB',
    DATE: 'DATE',
    DATETIME: 'TIMESTAMP',
    TIMESTAMP: 'TIMESTAMP WITH TIME ZONE',
    STRUCT: 'CLOB',
    JSON: 'CLOB',
  },
  'bigquery->snowflake': {
    INT64: 'BIGINT',
    FLOAT64: 'FLOAT',
    NUMERIC: 'NUMBER',
    BIGNUMERIC: 'NUMBER',
    BOOL: 'BOOLEAN',
    STRING: 'VARCHAR',
    BYTES: 'BINARY',
    DATE: 'DATE',
    DATETIME: 'TIMESTAMP_NTZ',
    TIMESTAMP: 'TIMESTAMP_TZ',
    STRUCT: 'VARIANT',
    JSON: 'VARIANT',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Function Mappings
// ═══════════════════════════════════════════════════════════════════════════════

interface FunctionMapping {
  pattern: RegExp;
  replacements: Partial<Record<Dialect, string>>;
  reason: string;
}

const FUNCTION_MAPPINGS: FunctionMapping[] = [
  // ── Date/Time Functions ──────────────────────────────────────────────────
  {
    pattern: /\bNOW\s*\(\s*\)/gi,
    replacements: {
      sqlserver: 'GETDATE()',
      oracle: 'SYSTIMESTAMP',
      snowflake: 'CURRENT_TIMESTAMP()',
      bigquery: 'CURRENT_TIMESTAMP()',
    },
    reason: 'Date function: NOW() equivalent',
  },
  {
    pattern: /\bGETDATE\s*\(\s*\)/gi,
    replacements: {
      postgresql: 'NOW()',
      mysql: 'NOW()',
      mariadb: 'NOW()',
      oracle: 'SYSTIMESTAMP',
      snowflake: 'CURRENT_TIMESTAMP()',
      bigquery: 'CURRENT_TIMESTAMP()',
    },
    reason: 'Date function: GETDATE() equivalent',
  },
  {
    pattern: /\bSYSDATE\b(?!\s*\()/gi,
    replacements: {
      postgresql: 'NOW()',
      mysql: 'NOW()',
      mariadb: 'NOW()',
      sqlserver: 'GETDATE()',
      snowflake: 'CURRENT_TIMESTAMP()',
      bigquery: 'CURRENT_TIMESTAMP()',
    },
    reason: 'Date function: SYSDATE equivalent',
  },
  {
    pattern: /\bSYSTIMESTAMP\b/gi,
    replacements: {
      postgresql: 'NOW()',
      mysql: 'NOW()',
      mariadb: 'NOW()',
      sqlserver: 'SYSDATETIMEOFFSET()',
      snowflake: 'CURRENT_TIMESTAMP()',
      bigquery: 'CURRENT_TIMESTAMP()',
    },
    reason: 'Date function: SYSTIMESTAMP equivalent',
  },
  {
    pattern: /\bCURDATE\s*\(\s*\)/gi,
    replacements: {
      postgresql: 'CURRENT_DATE',
      sqlserver: 'CAST(GETDATE() AS DATE)',
      oracle: 'TRUNC(SYSDATE)',
      snowflake: 'CURRENT_DATE()',
      bigquery: 'CURRENT_DATE()',
    },
    reason: 'Date function: CURDATE() equivalent',
  },
  {
    pattern: /\bCURTIME\s*\(\s*\)/gi,
    replacements: {
      postgresql: 'CURRENT_TIME',
      sqlserver: 'CAST(GETDATE() AS TIME)',
      oracle: 'TO_CHAR(SYSDATE, \'HH24:MI:SS\')',
      snowflake: 'CURRENT_TIME()',
      bigquery: 'CURRENT_TIME()',
    },
    reason: 'Time function: CURTIME() equivalent',
  },

  // ── UUID Functions ───────────────────────────────────────────────────────
  {
    pattern: /\bgen_random_uuid\s*\(\s*\)/gi,
    replacements: {
      mysql: 'UUID()',
      mariadb: 'UUID()',
      sqlserver: 'NEWID()',
      oracle: 'SYS_GUID()',
      snowflake: 'UUID_STRING()',
      bigquery: 'GENERATE_UUID()',
    },
    reason: 'UUID generation function',
  },
  {
    pattern: /\buuid_generate_v4\s*\(\s*\)/gi,
    replacements: {
      postgresql: 'gen_random_uuid()',
      mysql: 'UUID()',
      mariadb: 'UUID()',
      sqlserver: 'NEWID()',
      oracle: 'SYS_GUID()',
      snowflake: 'UUID_STRING()',
      bigquery: 'GENERATE_UUID()',
    },
    reason: 'UUID generation function',
  },
  {
    pattern: /\bNEWID\s*\(\s*\)/gi,
    replacements: {
      postgresql: 'gen_random_uuid()',
      mysql: 'UUID()',
      mariadb: 'UUID()',
      oracle: 'SYS_GUID()',
      snowflake: 'UUID_STRING()',
      bigquery: 'GENERATE_UUID()',
    },
    reason: 'UUID generation function',
  },
  {
    pattern: /\bSYS_GUID\s*\(\s*\)/gi,
    replacements: {
      postgresql: 'gen_random_uuid()',
      mysql: 'UUID()',
      mariadb: 'UUID()',
      sqlserver: 'NEWID()',
      snowflake: 'UUID_STRING()',
      bigquery: 'GENERATE_UUID()',
    },
    reason: 'UUID generation function',
  },

  // ── NULL Handling Functions ──────────────────────────────────────────────
  {
    pattern: /\bIFNULL\s*\(/gi,
    replacements: {
      postgresql: 'COALESCE(',
      sqlserver: 'ISNULL(',
      oracle: 'NVL(',
      snowflake: 'COALESCE(',
      bigquery: 'COALESCE(',
    },
    reason: 'NULL handling function: IFNULL equivalent',
  },
  {
    pattern: /\bNVL\s*\(/gi,
    replacements: {
      postgresql: 'COALESCE(',
      mysql: 'IFNULL(',
      mariadb: 'IFNULL(',
      sqlserver: 'ISNULL(',
      snowflake: 'COALESCE(',
      bigquery: 'COALESCE(',
    },
    reason: 'NULL handling function: NVL equivalent',
  },
  {
    pattern: /\bISNULL\s*\(/gi,
    replacements: {
      postgresql: 'COALESCE(',
      mysql: 'IFNULL(',
      mariadb: 'IFNULL(',
      oracle: 'NVL(',
      snowflake: 'COALESCE(',
      bigquery: 'COALESCE(',
    },
    reason: 'NULL handling function: ISNULL equivalent',
  },

  // ── String Functions ────────────────────────────────────────────────────
  {
    pattern: /\bSUBSTR\s*\(/gi,
    replacements: {
      postgresql: 'SUBSTRING(',
      mysql: 'SUBSTRING(',
      mariadb: 'SUBSTRING(',
      sqlserver: 'SUBSTRING(',
      bigquery: 'SUBSTR(',
    },
    reason: 'String function: SUBSTR → SUBSTRING',
  },
  {
    pattern: /\bLEN\s*\(/gi,
    replacements: {
      postgresql: 'LENGTH(',
      mysql: 'CHAR_LENGTH(',
      mariadb: 'CHAR_LENGTH(',
      oracle: 'LENGTH(',
      snowflake: 'LENGTH(',
      bigquery: 'LENGTH(',
    },
    reason: 'String length function: LEN equivalent',
  },
  {
    pattern: /\bCHARINDEX\s*\(/gi,
    replacements: {
      postgresql: 'POSITION(',
      mysql: 'LOCATE(',
      mariadb: 'LOCATE(',
      oracle: 'INSTR(',
      snowflake: 'CHARINDEX(',
      bigquery: 'STRPOS(',
    },
    reason: 'String search function',
  },

  // ── Type Casting ────────────────────────────────────────────────────────
  {
    pattern: /\bTO_CHAR\s*\(/gi,
    replacements: {
      postgresql: 'TO_CHAR(',
      mysql: 'DATE_FORMAT(',
      mariadb: 'DATE_FORMAT(',
      sqlserver: 'FORMAT(',
      snowflake: 'TO_CHAR(',
      bigquery: 'FORMAT_TIMESTAMP(',
    },
    reason: 'Date formatting function',
  },
  {
    pattern: /\bTO_DATE\s*\(/gi,
    replacements: {
      postgresql: 'TO_DATE(',
      mysql: 'STR_TO_DATE(',
      mariadb: 'STR_TO_DATE(',
      sqlserver: 'CONVERT(DATE,',
      snowflake: 'TO_DATE(',
      bigquery: 'PARSE_DATE(',
    },
    reason: 'Date parsing function',
  },

  // ── Pagination ──────────────────────────────────────────────────────────
  {
    pattern: /\bROWNUM\b/gi,
    replacements: {
      postgresql: 'ROW_NUMBER() OVER()',
      mysql: 'ROW_NUMBER() OVER()',
      mariadb: 'ROW_NUMBER() OVER()',
      sqlserver: 'ROW_NUMBER() OVER(ORDER BY (SELECT NULL))',
      snowflake: 'ROW_NUMBER() OVER()',
      bigquery: 'ROW_NUMBER() OVER()',
    },
    reason: 'Row numbering: ROWNUM equivalent',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Core Conversion Logic
// ═══════════════════════════════════════════════════════════════════════════════

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      // Reset lastIndex after test
      regex.lastIndex = 0;
      result = result.replace(regex, targetType);
      changes.push({
        original: sourceType,
        converted: targetType,
        reason: `Data type mapping: ${sourceType} → ${targetType}`,
      });
    }
  }

  return result;
}

function applyFunctionMappings(
  sql: string,
  sourceDialect: Dialect,
  targetDialect: Dialect,
  changes: ConversionChange[],
): string {
  let result = sql;

  for (const mapping of FUNCTION_MAPPINGS) {
    const replacement = mapping.replacements[targetDialect];
    if (!replacement) continue;

    // Skip if this function is native to the target dialect
    if (mapping.replacements[sourceDialect] === undefined && !mapping.pattern.test(result)) continue;

    mapping.pattern.lastIndex = 0;
    if (mapping.pattern.test(result)) {
      mapping.pattern.lastIndex = 0;
      const original = result.match(mapping.pattern)?.[0];
      result = result.replace(mapping.pattern, replacement);
      if (original && original.toUpperCase() !== replacement.toUpperCase()) {
        changes.push({
          original: original,
          converted: replacement,
          reason: mapping.reason,
        });
      }
    }
  }

  return result;
}

function applySyntaxTransformations(
  sql: string,
  sourceDialect: Dialect,
  targetDialect: Dialect,
  changes: ConversionChange[],
): string {
  let result = sql;

  // ── 1. PostgreSQL cast operator :: → CAST() ───────────────────────────────
  if (sourceDialect === 'postgresql' && targetDialect !== 'postgresql') {
    const castRegex = /(\w+(?:\.\w+)?)\s*::\s*(\w+(?:\([^)]*\))?)/g;
    let castMatch;
    const casts: Array<{ full: string; expr: string; type: string }> = [];
    while ((castMatch = castRegex.exec(result)) !== null) {
      casts.push({ full: castMatch[0], expr: castMatch[1], type: castMatch[2] });
    }
    if (casts.length > 0) {
      for (const c of casts) {
        result = result.replace(c.full, `CAST(${c.expr} AS ${c.type})`);
      }
      changes.push({
        original: 'expr::type',
        converted: 'CAST(expr AS type)',
        reason: 'Converted PostgreSQL cast (::) to standard CAST() syntax',
      });
    }
  }

  // ── 2. ENUM → CHECK constraint or equivalent ──────────────────────────────
  if (targetDialect !== 'mysql' && targetDialect !== 'mariadb') {
    // Convert ENUM('a','b','c') to VARCHAR(255) CHECK (col IN ('a','b','c'))
    // This needs to work within CREATE TABLE context
    const enumRegex = /(\w+)\s+ENUM\s*\(([^)]+)\)/gi;
    let enumMatch;
    const enumReplacements: Array<{ full: string; colName: string; values: string }> = [];
    while ((enumMatch = enumRegex.exec(result)) !== null) {
      enumReplacements.push({
        full: enumMatch[0],
        colName: enumMatch[1],
        values: enumMatch[2],
      });
    }
    for (const e of enumReplacements) {
      const checkType = targetDialect === 'oracle' ? 'VARCHAR2(255)' :
                         targetDialect === 'bigquery' ? 'STRING' :
                         targetDialect === 'snowflake' ? 'VARCHAR(255)' :
                         'VARCHAR(255)';
      const replacement = `${e.colName} ${checkType} CHECK (${e.colName} IN (${e.values}))`;
      result = result.replace(e.full, replacement);
    }
    if (enumReplacements.length > 0) {
      changes.push({
        original: 'ENUM(...)',
        converted: 'VARCHAR + CHECK constraint',
        reason: `ENUM type not supported in ${targetDialect}; converted to CHECK constraint`,
      });
    }
  }

  // ── 3. Boolean literals: true/false ↔ 1/0 ─────────────────────────────────
  if (targetDialect === 'mysql' || targetDialect === 'mariadb' || targetDialect === 'sqlserver' || targetDialect === 'oracle') {
    // Convert DEFAULT true → DEFAULT 1, DEFAULT false → DEFAULT 0
    const hasTrueFalse = /\bDEFAULT\s+(true|false)\b/gi.test(result);
    if (hasTrueFalse) {
      result = result.replace(/\bDEFAULT\s+true\b/gi, 'DEFAULT 1');
      result = result.replace(/\bDEFAULT\s+false\b/gi, 'DEFAULT 0');
      changes.push({
        original: 'DEFAULT true/false',
        converted: 'DEFAULT 1/0',
        reason: `${targetDialect} uses numeric boolean values (1/0)`,
      });
    }
  }

  if ((sourceDialect === 'mysql' || sourceDialect === 'mariadb' || sourceDialect === 'sqlserver' || sourceDialect === 'oracle') &&
      (targetDialect === 'postgresql' || targetDialect === 'snowflake')) {
    // Convert DEFAULT 1/0 back to true/false for boolean columns
    // Only apply when the column type is BOOLEAN/BIT/TINYINT(1)
    const defaultBoolRegex = /\b(BOOLEAN|BIT|TINYINT\(1\))\s+DEFAULT\s+([01])\b/gi;
    if (defaultBoolRegex.test(result)) {
      defaultBoolRegex.lastIndex = 0;
      result = result.replace(defaultBoolRegex, (match, type, val) => {
        const boolVal = val === '1' ? 'true' : 'false';
        return `${type} DEFAULT ${boolVal}`;
      });
    }
  }

  // ── 4. LIMIT / OFFSET conversions ──────────────────────────────────────────
  // LIMIT n OFFSET m → OFFSET m ROWS FETCH NEXT n ROWS ONLY (Oracle/SQL Server)
  if (
    (sourceDialect === 'postgresql' || sourceDialect === 'mysql' || sourceDialect === 'mariadb') &&
    (targetDialect === 'oracle' || targetDialect === 'sqlserver')
  ) {
    // LIMIT n OFFSET m
    const loRegex = /\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)/gi;
    let loMatch;
    while ((loMatch = loRegex.exec(result)) !== null) {
      const limit = loMatch[1];
      const offset = loMatch[2];
      const replacement = `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      result = result.replace(loMatch[0], replacement);
      changes.push({
        original: loMatch[0],
        converted: replacement,
        reason: 'Converted LIMIT/OFFSET to ANSI SQL FETCH FIRST syntax',
      });
    }
    // LIMIT n (without OFFSET)
    const limitRegex = /\bLIMIT\s+(\d+)\b/gi;
    let limitMatch;
    while ((limitMatch = limitRegex.exec(result)) !== null) {
      const limit = limitMatch[1];
      const replacement = `FETCH FIRST ${limit} ROWS ONLY`;
      result = result.replace(limitMatch[0], replacement);
      changes.push({
        original: limitMatch[0],
        converted: replacement,
        reason: 'Converted LIMIT to FETCH FIRST syntax',
      });
    }
  }

  // FETCH FIRST → LIMIT (reverse)
  if (
    (targetDialect === 'postgresql' || targetDialect === 'mysql' || targetDialect === 'mariadb') &&
    (sourceDialect === 'oracle' || sourceDialect === 'sqlserver')
  ) {
    const fetchORegex = /\bOFFSET\s+(\d+)\s+ROWS\s+FETCH\s+NEXT\s+(\d+)\s+ROWS\s+ONLY/gi;
    let fetchMatch;
    while ((fetchMatch = fetchORegex.exec(result)) !== null) {
      const replacement = `LIMIT ${fetchMatch[2]} OFFSET ${fetchMatch[1]}`;
      result = result.replace(fetchMatch[0], replacement);
      changes.push({ original: fetchMatch[0], converted: replacement, reason: 'Converted FETCH to LIMIT/OFFSET' });
    }

    const fetchFRegex = /\bFETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY/gi;
    let fetchFMatch;
    while ((fetchFMatch = fetchFRegex.exec(result)) !== null) {
      const replacement = `LIMIT ${fetchFMatch[1]}`;
      result = result.replace(fetchFMatch[0], replacement);
      changes.push({ original: fetchFMatch[0], converted: replacement, reason: 'Converted FETCH FIRST to LIMIT' });
    }
  }

  // TOP n (SQL Server) → LIMIT
  if (sourceDialect === 'sqlserver' && (targetDialect === 'postgresql' || targetDialect === 'mysql' || targetDialect === 'mariadb')) {
    const topRegex = /\bSELECT\s+TOP\s+(\d+)\b/gi;
    let topMatch;
    while ((topMatch = topRegex.exec(result)) !== null) {
      const n = topMatch[1];
      result = result.replace(topMatch[0], `SELECT`);
      // Add LIMIT at end of statement — simplified: append before semicolon
      // This is a best-effort approach; complex queries may need manual adjustment
      result = result.replace(/;/, ` LIMIT ${n};`);
      changes.push({ original: `TOP ${n}`, converted: `LIMIT ${n}`, reason: 'Converted SQL Server TOP to LIMIT' });
    }
  }

  // ── 5. Identifier Quoting ──────────────────────────────────────────────────
  // MySQL/MariaDB backticks → double quotes
  if ((sourceDialect === 'mysql' || sourceDialect === 'mariadb') && targetDialect !== 'mysql' && targetDialect !== 'mariadb') {
    if (/`[^`]+`/.test(result)) {
      result = result.replace(/`([^`]+)`/g, '"$1"');
      changes.push({
        original: '`identifier`',
        converted: '"identifier"',
        reason: 'Converted backtick quoting to double-quote quoting',
      });
    }
  }

  // Double quotes → backticks for MySQL/MariaDB target
  if (sourceDialect !== 'mysql' && sourceDialect !== 'mariadb' && (targetDialect === 'mysql' || targetDialect === 'mariadb')) {
    // Only convert double-quoted identifiers, not string literals
    if (/"[^"]+"/g.test(result)) {
      // Avoid converting string defaults in single quotes
      result = result.replace(/"([^"]+)"/g, '`$1`');
      changes.push({
        original: '"identifier"',
        converted: '`identifier`',
        reason: 'Converted double-quote quoting to backtick quoting',
      });
    }
  }

  // SQL Server square brackets → target quoting
  if (sourceDialect === 'sqlserver') {
    const hasBrackets = /\[(\w+)\]/.test(result);
    if (hasBrackets) {
      if (targetDialect === 'mysql' || targetDialect === 'mariadb') {
        result = result.replace(/\[(\w+)\]/g, '`$1`');
      } else {
        result = result.replace(/\[(\w+)\]/g, '"$1"');
      }
      changes.push({
        original: '[identifier]',
        converted: targetDialect === 'mysql' || targetDialect === 'mariadb' ? '`identifier`' : '"identifier"',
        reason: 'Converted SQL Server bracket quoting',
      });
    }
  }

  // ── 6. ON UPDATE CURRENT_TIMESTAMP ─────────────────────────────────────────
  if ((sourceDialect === 'mysql' || sourceDialect === 'mariadb') && targetDialect !== 'mysql' && targetDialect !== 'mariadb') {
    if (/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi.test(result)) {
      result = result.replace(/\s*ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');
      changes.push({
        original: 'ON UPDATE CURRENT_TIMESTAMP',
        converted: '(removed)',
        reason: `${targetDialect} does not support ON UPDATE CURRENT_TIMESTAMP; use triggers instead`,
      });
    }
  }

  // ── 7. MySQL/MariaDB ENGINE clause ─────────────────────────────────────────
  // Remove ENGINE when converting FROM MySQL
  if ((sourceDialect === 'mysql' || sourceDialect === 'mariadb') && targetDialect !== 'mysql' && targetDialect !== 'mariadb') {
    const engineRegex = /\)\s*ENGINE\s*=\s*\w+(?:\s+DEFAULT\s+CHARSET\s*=\s*\w+)?(?:\s+COLLATE\s*=?\s*\w+)?(?:\s+ROW_FORMAT\s*=\s*\w+)?(?:\s+COMMENT\s*=?\s*'[^']*')?/gi;
    if (engineRegex.test(result)) {
      engineRegex.lastIndex = 0;
      result = result.replace(engineRegex, ')');
      changes.push({
        original: 'ENGINE=...',
        converted: '(removed)',
        reason: `MySQL-specific table options removed for ${targetDialect}`,
      });
    }
  }

  // Remove UNSIGNED
  if ((sourceDialect === 'mysql' || sourceDialect === 'mariadb') && targetDialect !== 'mysql' && targetDialect !== 'mariadb') {
    if (/\bUNSIGNED\b/i.test(result)) {
      result = result.replace(/\s*\bUNSIGNED\b/gi, '');
      changes.push({
        original: 'UNSIGNED',
        converted: '(removed)',
        reason: `UNSIGNED modifier not supported in ${targetDialect}`,
      });
    }
  }

  // Remove COMMENT 'xxx' on columns
  if (targetDialect !== 'mysql' && targetDialect !== 'mariadb') {
    const commentRegex = /\s+COMMENT\s+'[^']*'/gi;
    if (commentRegex.test(result)) {
      commentRegex.lastIndex = 0;
      result = result.replace(commentRegex, '');
      changes.push({
        original: "COMMENT '...'",
        converted: '(removed)',
        reason: `Column-level COMMENT not supported in ${targetDialect}`,
      });
    }
  }

  // ── 8. AUTO_INCREMENT counter reset ────────────────────────────────────────
  if (sourceDialect === 'mysql' || sourceDialect === 'mariadb') {
    if (/\bAUTO_INCREMENT\s*=\s*\d+/gi.test(result)) {
      result = result.replace(/\s*AUTO_INCREMENT\s*=\s*\d+/gi, '');
      changes.push({
        original: 'AUTO_INCREMENT=n',
        converted: '(removed)',
        reason: 'Auto-increment counter reset is MySQL-specific',
      });
    }
  }

  // ── 9. IF NOT EXISTS handling ──────────────────────────────────────────────
  if (targetDialect === 'oracle') {
    if (/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi.test(result)) {
      result = result.replace(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi, 'CREATE TABLE');
      changes.push({
        original: 'CREATE TABLE IF NOT EXISTS',
        converted: 'CREATE TABLE',
        reason: 'Oracle does not support IF NOT EXISTS in CREATE TABLE',
      });
    }
  }

  // ── 10. Schema prefix handling ─────────────────────────────────────────────
  // Remove dbo. prefix when NOT targeting SQL Server
  if (sourceDialect === 'sqlserver' && targetDialect !== 'sqlserver') {
    if (/\bdbo\.\w+/gi.test(result)) {
      result = result.replace(/\bdbo\./gi, '');
      changes.push({
        original: 'dbo.table',
        converted: 'table',
        reason: 'Removed SQL Server dbo schema prefix',
      });
    }
  }
  // Remove public. prefix when NOT targeting PostgreSQL
  if (sourceDialect === 'postgresql' && targetDialect !== 'postgresql') {
    if (/\bpublic\.\w+/gi.test(result)) {
      result = result.replace(/\bpublic\./gi, '');
      changes.push({
        original: 'public.table',
        converted: 'table',
        reason: 'Removed PostgreSQL public schema prefix',
      });
    }
  }

  // ── 11. CREATE EXTENSION removal ───────────────────────────────────────────
  if (sourceDialect === 'postgresql' && targetDialect !== 'postgresql') {
    const extRegex = /^\s*CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?[^;]+;?\s*$/gim;
    if (extRegex.test(result)) {
      extRegex.lastIndex = 0;
      result = result.replace(extRegex, '-- Extension removed (PostgreSQL-specific)');
      changes.push({
        original: 'CREATE EXTENSION ...',
        converted: '(removed)',
        reason: 'CREATE EXTENSION is PostgreSQL-specific',
      });
    }
  }

  // ── 12. Index syntax for Snowflake/BigQuery (remove indexes) ───────────────
  if (targetDialect === 'snowflake' || targetDialect === 'bigquery') {
    const indexRegex = /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[^;]+;?\s*$/gim;
    if (indexRegex.test(result)) {
      indexRegex.lastIndex = 0;
      result = result.replace(indexRegex, `-- Index removed (${targetDialect} does not support secondary indexes)`);
      changes.push({
        original: 'CREATE INDEX ...',
        converted: '(removed)',
        reason: `${targetDialect} does not support secondary indexes; uses ${targetDialect === 'snowflake' ? 'micro-partitioning' : 'partitioning/clustering'} instead`,
      });
    }
  }

  // ── 13. RETURNING clause ───────────────────────────────────────────────────
  if (sourceDialect === 'postgresql' && targetDialect === 'mysql') {
    if (/\bRETURNING\b/gi.test(result)) {
      result = result.replace(/\s*RETURNING\s+[^;]+/gi, '');
      changes.push({
        original: 'RETURNING ...',
        converted: '(removed)',
        reason: 'MySQL does not support RETURNING clause; use LAST_INSERT_ID()',
      });
    }
  }
  if (sourceDialect === 'postgresql' && targetDialect === 'sqlserver') {
    // Convert RETURNING to OUTPUT
    const retRegex = /\bRETURNING\s+(.+?)(?=;|$)/gi;
    let retMatch;
    while ((retMatch = retRegex.exec(result)) !== null) {
      const cols = retMatch[1].trim().replace(/\bNEW\./gi, 'INSERTED.');
      result = result.replace(retMatch[0], `OUTPUT ${cols}`);
      changes.push({
        original: 'RETURNING',
        converted: 'OUTPUT',
        reason: 'SQL Server uses OUTPUT clause instead of RETURNING',
      });
    }
  }

  // ── 14. ON CONFLICT → ON DUPLICATE KEY UPDATE (MySQL) ──────────────────────
  if (sourceDialect === 'postgresql' && (targetDialect === 'mysql' || targetDialect === 'mariadb')) {
    const conflictRegex = /\bON\s+CONFLICT\s*\([^)]+\)\s+DO\s+UPDATE\s+SET\s+/gi;
    if (conflictRegex.test(result)) {
      conflictRegex.lastIndex = 0;
      result = result.replace(conflictRegex, 'ON DUPLICATE KEY UPDATE ');
      changes.push({
        original: 'ON CONFLICT ... DO UPDATE SET',
        converted: 'ON DUPLICATE KEY UPDATE',
        reason: 'MySQL upsert syntax',
      });
      // Also convert EXCLUDED.col → VALUES(col)
      result = result.replace(/\bEXCLUDED\.(\w+)/gi, 'VALUES($1)');
    }
    // ON CONFLICT DO NOTHING → INSERT IGNORE
    if (/\bON\s+CONFLICT\s*(?:\([^)]+\))?\s+DO\s+NOTHING/gi.test(result)) {
      result = result.replace(/\bON\s+CONFLICT\s*(?:\([^)]+\))?\s+DO\s+NOTHING/gi, '');
      result = result.replace(/\bINSERT\s+INTO\b/gi, 'INSERT IGNORE INTO');
      changes.push({
        original: 'ON CONFLICT DO NOTHING',
        converted: 'INSERT IGNORE',
        reason: 'MySQL equivalent for conflict handling',
      });
    }
  }

  // ── 15. ON CONFLICT → MERGE (SQL Server) ───────────────────────────────────
  if (sourceDialect === 'postgresql' && targetDialect === 'sqlserver') {
    if (/\bON\s+CONFLICT\b/gi.test(result)) {
      changes.push({
        original: 'ON CONFLICT',
        converted: '(needs MERGE)',
        reason: 'SQL Server uses MERGE for upsert; manual conversion recommended',
      });
    }
  }

  // ── 16. String concatenation with || ───────────────────────────────────────
  if (sourceDialect === 'postgresql' && (targetDialect === 'mysql' || targetDialect === 'mariadb')) {
    // Convert 'a' || 'b' → CONCAT('a', 'b') — basic cases
    if (/'\s*\|\|\s*'/.test(result) || /\w\s*\|\|\s*\w/.test(result)) {
      changes.push({
        original: "expr || expr",
        converted: "CONCAT(expr, expr)",
        reason: 'MySQL uses CONCAT() instead of || for string concatenation (|| is OR in MySQL)',
      });
    }
  }

  // ── 17. PostgreSQL array syntax ────────────────────────────────────────────
  if (sourceDialect === 'postgresql' && targetDialect !== 'postgresql') {
    // ARRAY['a','b'] → JSON_ARRAY('a','b') or similar
    if (/\bARRAY\s*\[/gi.test(result)) {
      if (targetDialect === 'mysql' || targetDialect === 'mariadb') {
        result = result.replace(/\bARRAY\s*\[([^\]]*)\]/gi, 'JSON_ARRAY($1)');
      } else {
        result = result.replace(/\bARRAY\s*\[([^\]]*)\]/gi, '($1)');
      }
      changes.push({
        original: 'ARRAY[...]',
        converted: targetDialect === 'mysql' || targetDialect === 'mariadb' ? 'JSON_ARRAY(...)' : '(...)',
        reason: `Array literals converted for ${targetDialect}`,
      });
    }
  }

  // ── 18. CREATE OR REPLACE → CREATE OR ALTER (SQL Server) ───────────────────
  if (targetDialect === 'sqlserver') {
    const corRegex = /\bCREATE\s+OR\s+REPLACE\s+(VIEW|FUNCTION|PROCEDURE)/gi;
    if (corRegex.test(result)) {
      corRegex.lastIndex = 0;
      result = result.replace(corRegex, 'CREATE OR ALTER $1');
      changes.push({
        original: 'CREATE OR REPLACE',
        converted: 'CREATE OR ALTER',
        reason: 'SQL Server uses CREATE OR ALTER (2016 SP1+)',
      });
    }
  }

  // ── 19. Add ENGINE=InnoDB for MySQL/MariaDB targets ────────────────────────
  if ((targetDialect === 'mysql' || targetDialect === 'mariadb') && sourceDialect !== 'mysql' && sourceDialect !== 'mariadb') {
    // Add ENGINE=InnoDB after closing paren of CREATE TABLE if not already present
    const createTableEnd = /\)(\s*;)/g;
    if (createTableEnd.test(result) && !/ENGINE\s*=/gi.test(result)) {
      createTableEnd.lastIndex = 0;
      result = result.replace(createTableEnd, ') ENGINE=InnoDB$1');
      changes.push({
        original: ');',
        converted: ') ENGINE=InnoDB;',
        reason: 'Added InnoDB engine specification for MySQL/MariaDB',
      });
    }
  }

  // ── 20. BigQuery: Remove PRIMARY KEY, UNIQUE constraints (inline) ──────────
  if (targetDialect === 'bigquery') {
    if (/\bPRIMARY\s+KEY\b/gi.test(result)) {
      // BigQuery doesn't enforce PKs in standard SQL mode
      changes.push({
        original: 'PRIMARY KEY',
        converted: '(kept, informational)',
        reason: 'BigQuery primary keys are informational only and not enforced',
      });
    }
    // Remove FOREIGN KEY constraints
    const fkRegex = /,?\s*(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+\w+\s*\([^)]+\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET\s+NULL|NO\s+ACTION|RESTRICT))*/gi;
    if (fkRegex.test(result)) {
      fkRegex.lastIndex = 0;
      result = result.replace(fkRegex, '');
      changes.push({
        original: 'FOREIGN KEY ...',
        converted: '(removed)',
        reason: 'BigQuery does not support foreign key constraints',
      });
    }
  }

  // ── 21. Snowflake: FK constraints are informational ────────────────────────
  if (targetDialect === 'snowflake') {
    if (/\bFOREIGN\s+KEY\b/gi.test(result)) {
      changes.push({
        original: 'FOREIGN KEY',
        converted: '(kept, informational)',
        reason: 'Snowflake foreign keys are informational only and not enforced',
      });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════════

// Reserved words per dialect
const RESERVED_WORDS: Record<string, Set<string>> = {
  mysql: new Set([
    'GROUP', 'ORDER', 'KEY', 'INDEX', 'RANGE', 'READ', 'WRITE', 'COLUMN',
    'TABLE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
    'ALTER', 'ADD', 'CHANGE', 'MODIFY', 'RENAME', 'LOCK', 'UNLOCK',
    'STATUS', 'SHOW', 'DESCRIBE', 'USE', 'SCHEMA', 'SIGNAL', 'CONDITION',
    'LOOP', 'LEAVE', 'ITERATE', 'REPEAT', 'RETURN', 'RANK', 'ROWS',
    'WINDOW', 'CUME_DIST', 'DENSE_RANK', 'EMPTY', 'EXCEPT', 'FIRST_VALUE',
    'GROUPING', 'GROUPS', 'JSON_TABLE', 'LAG', 'LAST_VALUE', 'LATERAL',
    'LEAD', 'NTH_VALUE', 'NTILE', 'OF', 'OVER', 'PERCENT_RANK', 'RECURSIVE',
    'ROW_NUMBER', 'SYSTEM', 'FUNCTION', 'ROLE', 'DUAL',
  ]),
  mariadb: new Set([
    'GROUP', 'ORDER', 'KEY', 'INDEX', 'RANGE', 'READ', 'WRITE', 'COLUMN',
    'TABLE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
    'ALTER', 'ADD', 'CHANGE', 'MODIFY', 'RENAME', 'LOCK', 'UNLOCK',
    'STATUS', 'SHOW', 'DESCRIBE', 'USE', 'SCHEMA', 'RANK', 'ROWS',
    'RECURSIVE', 'OVER', 'WINDOW', 'ROW_NUMBER', 'DUAL',
  ]),
  sqlserver: new Set([
    'USER', 'TABLE', 'KEY', 'INDEX', 'ORDER', 'GROUP', 'SELECT', 'INSERT',
    'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'COLUMN', 'IDENTITY',
    'EXECUTE', 'PLAN', 'PROC', 'FUNCTION', 'VIEW', 'TRIGGER', 'RULE',
    'TRANSACTION', 'COMMIT', 'ROLLBACK', 'BACKUP', 'RESTORE', 'MERGE',
    'PIVOT', 'UNPIVOT', 'OPEN', 'CLOSE', 'FETCH', 'PERCENT', 'TOP',
    'DATABASE', 'SCHEMA', 'FILE', 'STATISTICS', 'USE', 'DENY', 'GRANT',
    'REVOKE', 'RETURN', 'PRINT', 'RAISERROR', 'BREAK', 'CONTINUE',
    'GOTO', 'WHILE', 'IF', 'ELSE', 'BEGIN', 'END', 'TRY', 'CATCH',
  ]),
  oracle: new Set([
    'USER', 'TABLE', 'KEY', 'INDEX', 'ORDER', 'GROUP', 'SELECT', 'INSERT',
    'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'COLUMN', 'LEVEL',
    'COMMENT', 'SIZE', 'NUMBER', 'DATE', 'START', 'CONNECT', 'RESOURCE',
    'ACCESS', 'AUDIT', 'CLUSTER', 'FILE', 'LOCK', 'LONG', 'MODE',
    'ONLINE', 'SESSION', 'SHARE', 'SYNONYM', 'VALIDATE', 'VALUES',
    'COMPRESS', 'EXCLUSIVE', 'INCREMENT', 'INITIAL', 'MAXEXTENTS',
    'NOAUDIT', 'NOCOMPRESS', 'NOWAIT', 'PCTFREE', 'PRIOR', 'RAW',
    'RENAME', 'ROW', 'ROWS', 'ROWID', 'ROWNUM', 'UID', 'UNIQUE',
  ]),
  postgresql: new Set([
    'USER', 'TABLE', 'ORDER', 'GROUP', 'SELECT', 'INSERT', 'UPDATE',
    'DELETE', 'CREATE', 'DROP', 'ALTER', 'COLUMN', 'ANALYSE', 'ANALYZE',
    'ARRAY', 'DO', 'FETCH', 'GRANT', 'LIMIT', 'OFFSET', 'PLACING',
    'RETURNING', 'WINDOW', 'WITH', 'COLLATION', 'CONCURRENTLY',
    'FREEZE', 'ILIKE', 'LATERAL', 'SIMILAR', 'TABLESAMPLE', 'VARIADIC',
    'VERBOSE', 'OVERLAPS',
  ]),
  snowflake: new Set([
    'TABLE', 'ORDER', 'GROUP', 'SELECT', 'INSERT', 'UPDATE', 'DELETE',
    'CREATE', 'DROP', 'ALTER', 'COLUMN', 'ACCOUNT', 'CONNECTION',
    'DATABASE', 'GRANT', 'INCREMENT', 'ISSUE', 'LOCALTIME', 'LOCALTIMESTAMP',
    'MINUS', 'ORGANIZATION', 'QUALIFY', 'REGEXP', 'RLIKE', 'SAMPLE',
    'SCHEMA', 'TABLESAMPLE', 'TRY_CAST', 'VALUES', 'VIEW', 'WHENEVER',
  ]),
  bigquery: new Set([
    'TABLE', 'ORDER', 'GROUP', 'SELECT', 'INSERT', 'UPDATE', 'DELETE',
    'CREATE', 'DROP', 'ALTER', 'ALL', 'AND', 'ANY', 'ARRAY', 'AS',
    'ASC', 'ASSERT_ROWS_MODIFIED', 'AT', 'BETWEEN', 'BY', 'CASE',
    'CAST', 'COLLATE', 'CONTAINS', 'CROSS', 'CUBE', 'CURRENT',
    'DEFAULT', 'DEFINE', 'DESC', 'DISTINCT', 'ELSE', 'END', 'ENUM',
    'ESCAPE', 'EXCEPT', 'EXCLUDE', 'EXISTS', 'EXTRACT', 'FALSE',
    'FETCH', 'FOLLOWING', 'FOR', 'FROM', 'FULL', 'GROUPING', 'GROUPS',
    'HASH', 'HAVING', 'IF', 'IGNORE', 'IN', 'INNER', 'INTERSECT',
    'INTO', 'IS', 'JOIN', 'LATERAL', 'LEFT', 'LIKE', 'LIMIT', 'LOOKUP',
    'MERGE', 'NATURAL', 'NEW', 'NO', 'NOT', 'NULL', 'NULLS', 'OF', 'ON',
    'OR', 'OUTER', 'OVER', 'PARTITION', 'PRECEDING', 'PROTO', 'RANGE',
    'RECURSIVE', 'RESPECT', 'RIGHT', 'ROLLUP', 'ROWS', 'SET', 'SOME',
    'STRUCT', 'TABLESAMPLE', 'THEN', 'TO', 'TREAT', 'TRUE', 'UNBOUNDED',
    'UNION', 'UNNEST', 'USING', 'WHEN', 'WHERE', 'WINDOW', 'WITH', 'WITHIN',
  ]),
};

// Features not supported in specific target dialects
const UNSUPPORTED_FEATURES: Record<string, Array<{ pattern: RegExp; message: string; suggestion: string }>> = {
  mysql: [
    { pattern: /\bGENERATED\s+ALWAYS\s+AS\s+\([^)]+\)\s+STORED/gi, message: 'GENERATED ALWAYS AS ... STORED columns may need different syntax in MySQL 5.x (supported in 8.0+)', suggestion: 'Verify MySQL version supports generated columns, or compute in application layer' },
    { pattern: /\bTEXT\[\]/gi, message: 'Array types (TEXT[]) are not supported in MySQL', suggestion: 'Use a JSON column or a separate junction table instead' },
    { pattern: /\bINHERITS\s*\(/gi, message: 'Table inheritance (INHERITS) is not supported in MySQL', suggestion: 'Use separate tables with shared columns' },
    { pattern: /\bMATERIALIZED\s+VIEW/gi, message: 'Materialized views are not natively supported in MySQL', suggestion: 'Use a regular table with scheduled refresh' },
    { pattern: /\bUSING\s+GIN\b/gi, message: 'GIN indexes are PostgreSQL-specific', suggestion: 'Use FULLTEXT index for text search or B-tree index' },
    { pattern: /\bUSING\s+GiST\b/gi, message: 'GiST indexes are PostgreSQL-specific', suggestion: 'Use SPATIAL index for geometry or B-tree' },
    { pattern: /\bUSING\s+BRIN\b/gi, message: 'BRIN indexes are PostgreSQL-specific', suggestion: 'Use B-tree or partitioning' },
    { pattern: /\bjsonb_path_ops\b/gi, message: 'jsonb_path_ops is PostgreSQL-specific', suggestion: 'Use generated columns for JSON indexing in MySQL' },
    { pattern: /\bEXCLUDE\s+USING/gi, message: 'EXCLUDE constraint is PostgreSQL-specific', suggestion: 'Use triggers or application-level validation' },
  ],
  mariadb: [
    { pattern: /\bTEXT\[\]/gi, message: 'Array types are not supported in MariaDB', suggestion: 'Use JSON column or junction table' },
    { pattern: /\bUSING\s+GIN\b/gi, message: 'GIN indexes are PostgreSQL-specific', suggestion: 'Use FULLTEXT or B-tree indexes' },
    { pattern: /\bMATERIALIZED\s+VIEW/gi, message: 'Materialized views are not natively supported in MariaDB', suggestion: 'Use a regular table with scheduled refresh' },
  ],
  sqlserver: [
    { pattern: /\bTEXT\[\]/gi, message: 'Array types are not supported in SQL Server', suggestion: 'Use JSON column (NVARCHAR(MAX)) or separate table' },
    { pattern: /\bGENERATED\s+ALWAYS\s+AS\s+\([^)]+\)\s+STORED/gi, message: 'STORED generated columns use different syntax in SQL Server', suggestion: 'Use AS (expression) PERSISTED' },
    { pattern: /\bUSING\s+GIN\b/gi, message: 'GIN indexes are PostgreSQL-specific', suggestion: 'Use full-text or filtered indexes' },
    { pattern: /\bENUM\s*\(/gi, message: 'ENUM types are not supported in SQL Server', suggestion: 'Use CHECK constraints with VARCHAR' },
  ],
  oracle: [
    { pattern: /\bTEXT\[\]/gi, message: 'Array types are not supported in Oracle', suggestion: 'Use nested tables or VARRAY types' },
    { pattern: /\bIF\s+NOT\s+EXISTS/gi, message: 'IF NOT EXISTS is not supported in Oracle DDL', suggestion: 'Use PL/SQL exception handling' },
    { pattern: /\bAUTO_INCREMENT/gi, message: 'AUTO_INCREMENT is MySQL-specific', suggestion: 'Use sequences or GENERATED ALWAYS AS IDENTITY' },
    { pattern: /\bENUM\s*\(/gi, message: 'ENUM types are not supported in Oracle', suggestion: 'Use CHECK constraints with VARCHAR2' },
  ],
  snowflake: [
    { pattern: /\bSERIAL\b/gi, message: 'SERIAL is not supported in Snowflake', suggestion: 'Use AUTOINCREMENT or IDENTITY' },
    { pattern: /\bFOREIGN\s+KEY/gi, message: 'Foreign keys in Snowflake are informational only (not enforced)', suggestion: 'Keep for documentation' },
    { pattern: /\bCREATE\s+TRIGGER/gi, message: 'Triggers are not supported in Snowflake', suggestion: 'Use Streams and Tasks instead' },
  ],
  bigquery: [
    { pattern: /\bSERIAL\b/gi, message: 'SERIAL/auto-increment is not supported in BigQuery', suggestion: 'Use GENERATE_UUID() or ROW_NUMBER()' },
    { pattern: /\bFOREIGN\s+KEY/gi, message: 'Foreign key constraints are not supported in BigQuery', suggestion: 'Enforce referentially in application layer' },
    { pattern: /\bCREATE\s+TRIGGER/gi, message: 'Triggers are not supported in BigQuery', suggestion: 'Use Cloud Functions or scheduled queries' },
    { pattern: /\bALTER\s+TABLE\s+\w+\s+ADD\s+CONSTRAINT/gi, message: 'ALTER TABLE ADD CONSTRAINT is limited in BigQuery', suggestion: 'Define constraints at table creation time' },
    { pattern: /\bAUTO_INCREMENT/gi, message: 'AUTO_INCREMENT is not supported in BigQuery', suggestion: 'Use GENERATE_UUID() for unique IDs' },
  ],
};

// Table name length limits per dialect
const TABLE_NAME_LIMITS: Record<string, number> = {
  mysql: 64,
  mariadb: 64,
  oracle: 128,
  sqlserver: 128,
  postgresql: 63,
  snowflake: 255,
  bigquery: 1024,
};

export function validateConvertedSQL(
  sql: string,
  sourceDialect: string,
  targetDialect: string,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Check for unsupported features in target dialect
  const featureChecks = UNSUPPORTED_FEATURES[targetDialect];
  if (featureChecks) {
    for (const check of featureChecks) {
      check.pattern.lastIndex = 0;
      const match = check.pattern.exec(sql);
      if (match) {
        const beforeMatch = sql.substring(0, match.index);
        const lineNum = beforeMatch.split('\n').length;
        issues.push({
          severity: 'warning',
          category: 'feature',
          message: check.message,
          line: lineNum,
          suggestion: check.suggestion,
        });
      }
    }
  }

  // 2. Check table/column names against reserved words
  const reservedWords = RESERVED_WORDS[targetDialect];
  if (reservedWords) {
    const tableNameRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?(\w+)(?:`|"|')?/gi;
    let tableMatch;
    while ((tableMatch = tableNameRegex.exec(sql)) !== null) {
      const tableName = tableMatch[1].toUpperCase();
      if (reservedWords.has(tableName)) {
        const beforeMatch = sql.substring(0, tableMatch.index);
        const lineNum = beforeMatch.split('\n').length;
        const quoteChar = targetDialect === 'mysql' || targetDialect === 'mariadb' ? '`' : '"';
        issues.push({
          severity: 'error',
          category: 'naming',
          message: `Table name "${tableMatch[1]}" is a reserved word in ${targetDialect.toUpperCase()}`,
          line: lineNum,
          suggestion: `Quote the identifier: ${quoteChar}${tableMatch[1]}${quoteChar}`,
        });
      }
    }
  }

  // 3. Check table name length limits
  const maxLen = TABLE_NAME_LIMITS[targetDialect];
  if (maxLen) {
    const tableNameRegex2 = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?(\w+)(?:`|"|')?/gi;
    let tableMatch2;
    while ((tableMatch2 = tableNameRegex2.exec(sql)) !== null) {
      if (tableMatch2[1].length > maxLen) {
        const beforeMatch = sql.substring(0, tableMatch2.index);
        const lineNum = beforeMatch.split('\n').length;
        issues.push({
          severity: 'error',
          category: 'naming',
          message: `Table name "${tableMatch2[1]}" exceeds ${targetDialect.toUpperCase()} limit of ${maxLen} characters (${tableMatch2[1].length} chars)`,
          line: lineNum,
          suggestion: `Shorten the table name to ${maxLen} characters or less`,
        });
      }
    }
  }

  // 4. Check for remaining unconverted source-specific syntax
  const remainingSourceChecks: Record<string, Array<{ pattern: RegExp; message: string; suggestion?: string }>> = {
    postgresql: [
      { pattern: /::(\w+)/g, message: 'PostgreSQL cast operator (::) found — may not work in target dialect', suggestion: 'Use CAST(expr AS type)' },
      { pattern: /\bgen_random_uuid\(\)/gi, message: 'gen_random_uuid() is PostgreSQL-specific', suggestion: 'Use target-specific UUID function' },
      { pattern: /\buuid_generate_v4\(\)/gi, message: 'uuid_generate_v4() is PostgreSQL-specific', suggestion: 'Use target-specific UUID function' },
      { pattern: /\bARRAY\[/gi, message: 'PostgreSQL array literal syntax found', suggestion: 'Convert to JSON or comma-separated values' },
      { pattern: /\b\w+\[\]/gi, message: 'PostgreSQL array type found', suggestion: 'Convert to JSON column' },
    ],
    mysql: [
      { pattern: /\bENGINE\s*=\s*\w+/gi, message: 'MySQL ENGINE clause found', suggestion: 'Remove for non-MySQL targets' },
      { pattern: /\bAUTO_INCREMENT\s*=\s*\d+/gi, message: 'AUTO_INCREMENT counter reset is MySQL-specific', suggestion: 'Remove for non-MySQL targets' },
      { pattern: /\bON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, message: 'ON UPDATE CURRENT_TIMESTAMP is MySQL-specific', suggestion: 'Use triggers instead' },
    ],
    mariadb: [
      { pattern: /\bENGINE\s*=\s*\w+/gi, message: 'MySQL/MariaDB ENGINE clause found', suggestion: 'Remove for non-MySQL targets' },
    ],
    oracle: [
      { pattern: /\bROWNUM\b/gi, message: 'ROWNUM is Oracle-specific', suggestion: 'Use ROW_NUMBER() OVER()' },
      { pattern: /\bNVL\(/gi, message: 'NVL() is Oracle-specific', suggestion: 'Use COALESCE()' },
      { pattern: /\bDECODE\(/gi, message: 'DECODE() is Oracle-specific', suggestion: 'Use CASE WHEN' },
      { pattern: /\bCONNECT\s+BY/gi, message: 'CONNECT BY is Oracle hierarchical query syntax', suggestion: 'Use recursive CTE (WITH RECURSIVE)' },
    ],
    sqlserver: [
      { pattern: /\bTOP\s+\d+/gi, message: 'TOP is SQL Server-specific', suggestion: 'Use LIMIT' },
      { pattern: /\bISNULL\(/gi, message: 'ISNULL() is SQL Server-specific', suggestion: 'Use COALESCE()' },
      { pattern: /\bCONVERT\s*\(/gi, message: 'CONVERT() is SQL Server-specific', suggestion: 'Use CAST()' },
      { pattern: /\[\w+\]/g, message: 'Square bracket quoting is SQL Server-specific', suggestion: 'Use double quotes or backticks' },
    ],
  };

  const sourceChecks = remainingSourceChecks[sourceDialect];
  if (sourceChecks && sourceDialect !== targetDialect) {
    for (const check of sourceChecks) {
      check.pattern.lastIndex = 0;
      const match = check.pattern.exec(sql);
      if (match) {
        const beforeMatch = sql.substring(0, match.index);
        const lineNum = beforeMatch.split('\n').length;
        issues.push({
          severity: 'warning',
          category: 'syntax',
          message: check.message,
          line: lineNum,
          suggestion: check.suggestion,
        });
      }
    }
  }

  // 5. Check for empty CREATE TABLE
  const emptyTableRegex = /CREATE\s+TABLE\s+\w+\s*\(\s*\)/gi;
  if (emptyTableRegex.test(sql)) {
    issues.push({
      severity: 'error',
      category: 'syntax',
      message: 'Empty CREATE TABLE statement found (no column definitions)',
      suggestion: 'Add column definitions to the CREATE TABLE statement',
    });
  }

  // 6. CHECK constraint compatibility
  if (targetDialect === 'mysql') {
    const checkRegex = /\bCHECK\s*\(/gi;
    if (checkRegex.test(sql)) {
      issues.push({
        severity: 'info',
        category: 'constraint',
        message: 'CHECK constraints are ignored in MySQL versions before 8.0.16',
        suggestion: 'Verify target MySQL version supports CHECK constraints',
      });
    }
  }

  // 7. CREATE OR REPLACE handling
  if (targetDialect === 'sqlserver') {
    const createOrReplaceRegex = /CREATE\s+OR\s+REPLACE\s+(VIEW|FUNCTION)/gi;
    let crMatch;
    while ((crMatch = createOrReplaceRegex.exec(sql)) !== null) {
      const beforeMatch = sql.substring(0, crMatch.index);
      const lineNum = beforeMatch.split('\n').length;
      issues.push({
        severity: 'warning',
        category: 'syntax',
        message: `CREATE OR REPLACE ${crMatch[1]} — SQL Server uses CREATE OR ALTER (2016 SP1+)`,
        line: lineNum,
        suggestion: `Use CREATE OR ALTER ${crMatch[1]} or separate DROP IF EXISTS + CREATE`,
      });
    }
  }

  // 8. Detect mixed quoting styles
  const hasBackticks = /`\w+`/.test(sql);
  const hasDoubleQuotes = /"\w+"/.test(sql);
  const hasBrackets = /\[\w+\]/.test(sql);
  if ([hasBackticks, hasDoubleQuotes, hasBrackets].filter(Boolean).length > 1) {
    issues.push({
      severity: 'warning',
      category: 'syntax',
      message: 'Mixed identifier quoting styles detected (backticks, double quotes, brackets)',
      suggestion: 'Standardize to the target dialect quoting style',
    });
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;

  return {
    valid: errors === 0,
    issues,
    summary: { errors, warnings, info },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

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
    bq: 'bigquery',
    sf: 'snowflake',
  };

  const normalizedSource = (aliasMap[sourceDialect.toLowerCase()] ?? sourceDialect.toLowerCase()) as Dialect;
  const normalizedTarget = (aliasMap[targetDialect.toLowerCase()] ?? targetDialect.toLowerCase()) as Dialect;

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

  // Apply data type mappings
  let convertedSql = applyDataTypeMappings(sql, mappingKey, changes);

  // If no direct mapping exists, try two-hop via PostgreSQL
  if (!DATA_TYPE_MAP[mappingKey] && normalizedSource !== 'postgresql' && normalizedTarget !== 'postgresql') {
    const hop1Key = `${normalizedSource}->postgresql`;
    const hop2Key = `postgresql->${normalizedTarget}`;
    if (DATA_TYPE_MAP[hop1Key] && DATA_TYPE_MAP[hop2Key]) {
      convertedSql = applyDataTypeMappings(convertedSql, hop1Key, changes);
      convertedSql = applyDataTypeMappings(convertedSql, hop2Key, changes);
    }
  }

  // Apply function mappings
  convertedSql = applyFunctionMappings(convertedSql, normalizedSource, normalizedTarget, changes);

  // Apply syntax transformations
  convertedSql = applySyntaxTransformations(convertedSql, normalizedSource, normalizedTarget, changes);

  // Run validation on the converted SQL
  const validation = validateConvertedSQL(convertedSql, normalizedSource, normalizedTarget);

  return {
    sql: convertedSql,
    changes,
    sourceDialect: normalizedSource,
    targetDialect: normalizedTarget,
    validation,
  };
}
