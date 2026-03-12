// ---------------------------------------------------------------------------
// SQL Parser – Type definitions
// ---------------------------------------------------------------------------

/** Supported SQL dialects */
export type SQLDialect =
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'oracle'
  | 'sqlserver'
  | 'snowflake'
  | 'bigquery';

// ---------------------------------------------------------------------------
// Parsed statement
// ---------------------------------------------------------------------------

export interface ParsedStatement {
  /** Statement type: CREATE TABLE, CREATE INDEX, ALTER TABLE, etc. */
  type: string;
  /** Raw SQL text of the statement */
  raw: string;
  /** 1-based line number where the statement starts */
  lineStart: number;
  /** 1-based line number where the statement ends */
  lineEnd: number;
}

// ---------------------------------------------------------------------------
// Table / Column / Index / Constraint
// ---------------------------------------------------------------------------

export interface ParsedColumn {
  name: string;
  dataType: string;
  /** Simplified / normalized type: integer, varchar, boolean, etc. */
  normalizedType: string;
  /** 1-based ordinal position within the table */
  ordinalPosition: number;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  characterMaxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
}

export interface ParsedIndex {
  indexName: string;
  /** e.g. BTREE, HASH, GIN, GIST */
  indexType: string;
  isUnique: boolean;
  isPrimary: boolean;
  columns: string[];
}

export interface ParsedConstraint {
  constraintName: string;
  /** PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK */
  constraintType: string;
  /** Free-form text describing the constraint (e.g. full FK clause) */
  definition: string;
  columns: string[];
}

export interface ParsedTable {
  schemaName: string;
  tableName: string;
  /** 'table' | 'view' */
  tableType: string;
  columns: ParsedColumn[];
  indexes: ParsedIndex[];
  constraints: ParsedConstraint[];
  /** The raw DDL statement that created this table */
  originalDDL: string;
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export interface ParsedRelationship {
  sourceSchema: string;
  sourceTable: string;
  sourceColumns: string[];
  targetSchema: string;
  targetTable: string;
  targetColumns: string[];
  constraintName: string | null;
  onDelete: string | null;
  onUpdate: string | null;
  /** true = inferred from naming conventions, false = explicit FK constraint */
  isInferred: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ParseErrorSeverity = 'error' | 'warning' | 'info';

export interface ParseError {
  /** 1-based line number where the error occurred (0 if unknown) */
  line: number;
  message: string;
  /** The SQL text that caused the error (may be truncated) */
  statement: string;
  severity: ParseErrorSeverity;
}

// ---------------------------------------------------------------------------
// Overall result
// ---------------------------------------------------------------------------

export interface ParseStatistics {
  totalStatements: number;
  createTableStatements: number;
  createIndexStatements: number;
  alterTableStatements: number;
  otherStatements: number;
  parseTimeMs: number;
}

export interface SQLParseResult {
  dialect: SQLDialect;
  tables: ParsedTable[];
  relationships: ParsedRelationship[];
  errors: ParseError[];
  statistics: ParseStatistics;
}
