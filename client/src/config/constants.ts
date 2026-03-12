export const APP_NAME = 'Aqua DB Copilot';
export const APP_TAGLINE = 'Your Intelligent Database Engineering Partner';

export interface DatabaseDialect {
  value: string;
  label: string;
  color: string;
}

export const DATABASE_DIALECTS: DatabaseDialect[] = [
  { value: 'postgresql', label: 'PostgreSQL', color: '#336791' },
  { value: 'mysql', label: 'MySQL', color: '#4479A1' },
  { value: 'oracle', label: 'Oracle', color: '#F80000' },
  { value: 'sqlserver', label: 'MS SQL Server', color: '#CC2927' },
  { value: 'mariadb', label: 'MariaDB', color: '#003545' },
  { value: 'snowflake', label: 'Snowflake', color: '#29B5E8' },
  { value: 'bigquery', label: 'BigQuery', color: '#4285F4' },
  { value: 'mongodb', label: 'MongoDB', color: '#47A248' },
];

export function getDialect(value: string): DatabaseDialect | undefined {
  return DATABASE_DIALECTS.find((d) => d.value === value);
}

// ---------------------------------------------------------------------------
// Dialect-specific data types for create/edit table dropdowns
// ---------------------------------------------------------------------------

const DIALECT_DATA_TYPES: Record<string, string[]> = {
  postgresql: [
    'SMALLINT', 'INTEGER', 'BIGINT', 'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
    'DECIMAL(10,2)', 'NUMERIC', 'REAL', 'DOUBLE PRECISION', 'MONEY',
    'CHAR(1)', 'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)', 'TEXT',
    'BYTEA',
    'DATE', 'TIME', 'TIME WITH TIME ZONE', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL',
    'BOOLEAN',
    'UUID',
    'JSON', 'JSONB',
    'INET', 'CIDR', 'MACADDR',
    'POINT', 'LINE', 'POLYGON', 'CIRCLE',
    'ARRAY', 'ENUM', 'XML', 'TSVECTOR', 'TSQUERY',
  ],
  mysql: [
    'TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT',
    'DECIMAL(10,2)', 'FLOAT', 'DOUBLE',
    'CHAR(1)', 'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)',
    'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
    'BINARY', 'VARBINARY(255)', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB',
    'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
    'BOOLEAN', 'TINYINT(1)',
    'JSON',
    'ENUM', 'SET',
  ],
  oracle: [
    'NUMBER', 'NUMBER(10)', 'NUMBER(10,2)', 'BINARY_FLOAT', 'BINARY_DOUBLE', 'FLOAT',
    'CHAR(1)', 'VARCHAR2(50)', 'VARCHAR2(100)', 'VARCHAR2(255)',
    'NCHAR(1)', 'NVARCHAR2(255)', 'CLOB', 'NCLOB',
    'BLOB', 'RAW(255)', 'LONG RAW',
    'DATE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE',
    'TIMESTAMP WITH LOCAL TIME ZONE', 'INTERVAL YEAR TO MONTH', 'INTERVAL DAY TO SECOND',
    'BOOLEAN',
    'ROWID', 'UROWID', 'XMLTYPE', 'JSON',
  ],
  sqlserver: [
    'BIT', 'TINYINT', 'SMALLINT', 'INT', 'BIGINT',
    'DECIMAL(10,2)', 'NUMERIC(10,2)', 'FLOAT', 'REAL', 'MONEY', 'SMALLMONEY',
    'CHAR(1)', 'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)', 'VARCHAR(MAX)',
    'NCHAR(1)', 'NVARCHAR(50)', 'NVARCHAR(255)', 'NVARCHAR(MAX)',
    'TEXT', 'NTEXT',
    'BINARY(50)', 'VARBINARY(255)', 'VARBINARY(MAX)', 'IMAGE',
    'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'SMALLDATETIME', 'DATETIMEOFFSET',
    'UNIQUEIDENTIFIER', 'XML', 'SQL_VARIANT', 'GEOGRAPHY', 'GEOMETRY',
  ],
  mariadb: [
    'TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT',
    'DECIMAL(10,2)', 'FLOAT', 'DOUBLE',
    'CHAR(1)', 'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)',
    'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
    'BINARY', 'VARBINARY(255)', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB',
    'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
    'BOOLEAN', 'TINYINT(1)',
    'JSON',
    'INET4', 'INET6',
    'UUID', 'ENUM', 'SET',
  ],
  snowflake: [
    'NUMBER', 'NUMBER(10,2)', 'DECIMAL(10,2)', 'INT', 'INTEGER', 'BIGINT',
    'SMALLINT', 'TINYINT', 'BYTEINT', 'FLOAT', 'FLOAT4', 'FLOAT8',
    'DOUBLE', 'DOUBLE PRECISION', 'REAL',
    'VARCHAR(50)', 'VARCHAR(255)', 'VARCHAR(16777216)', 'CHAR(1)', 'STRING', 'TEXT',
    'BINARY', 'VARBINARY',
    'BOOLEAN',
    'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMP_NTZ', 'TIMESTAMP_LTZ', 'TIMESTAMP_TZ',
    'VARIANT', 'OBJECT', 'ARRAY',
    'GEOGRAPHY', 'GEOMETRY',
  ],
  bigquery: [
    'INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC',
    'BOOL',
    'STRING', 'STRING(255)',
    'BYTES',
    'DATE', 'TIME', 'DATETIME', 'TIMESTAMP',
    'ARRAY', 'STRUCT', 'JSON',
    'GEOGRAPHY',
    'INTERVAL',
  ],
  mongodb: [
    'String', 'Number', 'Boolean', 'Date', 'ObjectId',
    'Array', 'Object', 'Binary', 'Decimal128',
    'Int32', 'Int64', 'Double',
    'Timestamp', 'RegExp', 'UUID',
  ],
};

/**
 * Get the data types for a given dialect string (lowercase).
 * Falls back to PostgreSQL if dialect is unknown.
 */
export function getDialectDataTypes(dialect: string): string[] {
  return DIALECT_DATA_TYPES[dialect] ?? DIALECT_DATA_TYPES['postgresql'];
}
