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
  { value: 'sqlserver', label: 'SQL Server', color: '#CC2927' },
  { value: 'mariadb', label: 'MariaDB', color: '#003545' },
  { value: 'snowflake', label: 'Snowflake', color: '#29B5E8' },
  { value: 'bigquery', label: 'BigQuery', color: '#4285F4' },
  { value: 'mongodb', label: 'MongoDB', color: '#47A248' },
];

export function getDialect(value: string): DatabaseDialect | undefined {
  return DATABASE_DIALECTS.find((d) => d.value === value);
}
