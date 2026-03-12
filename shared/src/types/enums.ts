export enum DatabaseDialect {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  ORACLE = 'oracle',
  SQLSERVER = 'sqlserver',
  MARIADB = 'mariadb',
  SNOWFLAKE = 'snowflake',
  BIGQUERY = 'bigquery',
  MONGODB = 'mongodb',
}

export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum FileType {
  SQL_DDL = 'sql_ddl',
  SQL_DML = 'sql_dml',
  SQL_QUERY = 'sql_query',
  ENTITY_CLASS = 'entity_class',
  CSV = 'csv',
  JSON = 'json',
}

export enum ParseStatus {
  PENDING = 'pending',
  PARSING = 'parsing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RelationshipType {
  ONE_TO_ONE = 'one_to_one',
  ONE_TO_MANY = 'one_to_many',
  MANY_TO_MANY = 'many_to_many',
}

export enum TableType {
  TABLE = 'table',
  VIEW = 'view',
  MATERIALIZED_VIEW = 'materialized_view',
}

export enum QueryExecutionStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum MigrationStatus {
  DRAFT = 'draft',
  REVIEWED = 'reviewed',
  APPLIED = 'applied',
  ROLLED_BACK = 'rolled_back',
}

export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
}

export enum AIContext {
  SCHEMA_DESIGN = 'schema_design',
  QUERY_OPTIMIZATION = 'query_optimization',
  PERFORMANCE = 'performance',
  MIGRATION = 'migration',
  GENERAL = 'general',
}

export enum UserRole {
  ADMIN = 'admin',
  ENGINEER = 'engineer',
  ANALYST = 'analyst',
  VIEWER = 'viewer',
}

export enum SensitivityTag {
  PII = 'pii',
  PHI = 'phi',
  FINANCIAL = 'financial',
  PUBLIC = 'public',
}
