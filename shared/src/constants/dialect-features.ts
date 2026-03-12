import { DatabaseDialect } from '../types/enums';

export interface DialectInfo {
  id: DatabaseDialect;
  name: string;
  icon: string;
  color: string;
  supportsTransactions: boolean;
  supportsViews: boolean;
  supportsMaterializedViews: boolean;
  supportsStoredProcedures: boolean;
  supportsTriggers: boolean;
  supportsPartitioning: boolean;
  supportsSequences: boolean;
  identifierQuote: string;
  stringQuote: string;
  defaultPort: number | null;
}

export const DIALECT_INFO: Record<DatabaseDialect, DialectInfo> = {
  [DatabaseDialect.POSTGRESQL]: {
    id: DatabaseDialect.POSTGRESQL,
    name: 'PostgreSQL',
    icon: 'postgresql',
    color: '#336791',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: true,
    supportsStoredProcedures: true,
    supportsTriggers: true,
    supportsPartitioning: true,
    supportsSequences: true,
    identifierQuote: '"',
    stringQuote: "'",
    defaultPort: 5432,
  },
  [DatabaseDialect.MYSQL]: {
    id: DatabaseDialect.MYSQL,
    name: 'MySQL',
    icon: 'mysql',
    color: '#4479A1',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: false,
    supportsStoredProcedures: true,
    supportsTriggers: true,
    supportsPartitioning: true,
    supportsSequences: false,
    identifierQuote: '`',
    stringQuote: "'",
    defaultPort: 3306,
  },
  [DatabaseDialect.ORACLE]: {
    id: DatabaseDialect.ORACLE,
    name: 'Oracle',
    icon: 'oracle',
    color: '#F80000',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: true,
    supportsStoredProcedures: true,
    supportsTriggers: true,
    supportsPartitioning: true,
    supportsSequences: true,
    identifierQuote: '"',
    stringQuote: "'",
    defaultPort: 1521,
  },
  [DatabaseDialect.SQLSERVER]: {
    id: DatabaseDialect.SQLSERVER,
    name: 'SQL Server',
    icon: 'sqlserver',
    color: '#CC2927',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: false,
    supportsStoredProcedures: true,
    supportsTriggers: true,
    supportsPartitioning: true,
    supportsSequences: true,
    identifierQuote: '[',
    stringQuote: "'",
    defaultPort: 1433,
  },
  [DatabaseDialect.MARIADB]: {
    id: DatabaseDialect.MARIADB,
    name: 'MariaDB',
    icon: 'mariadb',
    color: '#003545',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: false,
    supportsStoredProcedures: true,
    supportsTriggers: true,
    supportsPartitioning: true,
    supportsSequences: true,
    identifierQuote: '`',
    stringQuote: "'",
    defaultPort: 3306,
  },
  [DatabaseDialect.SNOWFLAKE]: {
    id: DatabaseDialect.SNOWFLAKE,
    name: 'Snowflake',
    icon: 'snowflake',
    color: '#29B5E8',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: true,
    supportsStoredProcedures: true,
    supportsTriggers: false,
    supportsPartitioning: false,
    supportsSequences: true,
    identifierQuote: '"',
    stringQuote: "'",
    defaultPort: null,
  },
  [DatabaseDialect.BIGQUERY]: {
    id: DatabaseDialect.BIGQUERY,
    name: 'BigQuery',
    icon: 'bigquery',
    color: '#4285F4',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: true,
    supportsStoredProcedures: true,
    supportsTriggers: false,
    supportsPartitioning: true,
    supportsSequences: false,
    identifierQuote: '`',
    stringQuote: "'",
    defaultPort: null,
  },
  [DatabaseDialect.MONGODB]: {
    id: DatabaseDialect.MONGODB,
    name: 'MongoDB',
    icon: 'mongodb',
    color: '#47A248',
    supportsTransactions: true,
    supportsViews: true,
    supportsMaterializedViews: false,
    supportsStoredProcedures: false,
    supportsTriggers: false,
    supportsPartitioning: true,
    supportsSequences: false,
    identifierQuote: '',
    stringQuote: "'",
    defaultPort: 27017,
  },
};
