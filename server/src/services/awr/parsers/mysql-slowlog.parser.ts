/**
 * MySQL Slow Query Log Parser
 * Extracts query performance metrics from MySQL slow query logs.
 */

export interface MySQLSlowQuery {
  sqlText: string;
  queryTime: number;
  lockTime: number;
  rowsSent: number;
  rowsExamined: number;
  timestamp?: string;
  user?: string;
  database?: string;
}

export interface MySQLSlowLogMetrics {
  reportType: 'mysql_slowlog';
  database: 'mysql';
  totalQueries: number;
  timeRange: { start: string; end: string };
  avgQueryTime: number;
  maxQueryTime: number;
  totalQueryTime: number;

  topSlowQueries: MySQLSlowQuery[];

  queryPatterns: {
    pattern: string;
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    avgRowsExamined: number;
  }[];

  statistics: {
    queriesOver1s: number;
    queriesOver5s: number;
    queriesOver10s: number;
    avgRowsExamined: number;
    avgLockTime: number;
  };

  sectionsFound: string[];
  rawSections: Record<string, string>;
}

function normalizeSQL(sql: string): string {
  return sql
    .replace(/\b\d+\b/g, 'N')
    .replace(/'[^']*'/g, "'S'")
    .replace(/"[^"]*"/g, '"S"')
    .replace(/\bIN\s*\([^)]+\)/gi, 'IN (...)')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function parseMySQLSlowLog(content: string): MySQLSlowLogMetrics {
  const lines = content.split('\n');
  const queries: MySQLSlowQuery[] = [];
  let currentQuery: Partial<MySQLSlowQuery> = {};
  let sqlLines: string[] = [];
  let firstTimestamp = '';
  let lastTimestamp = '';

  for (const line of lines) {
    // Skip comment headers
    if (line.startsWith('/usr') || line.startsWith('Tcp port') || line.startsWith('Time')) continue;

    // Timestamp line: # Time: 2024-01-15T10:30:45
    const timeMatch = line.match(/^#\s*Time:\s*(.+)/);
    if (timeMatch) {
      if (!firstTimestamp) firstTimestamp = timeMatch[1].trim();
      lastTimestamp = timeMatch[1].trim();
      continue;
    }

    // User/Host line: # User@Host: root[root] @ localhost []
    const userMatch = line.match(/^#\s*User@Host:\s*(\S+)/);
    if (userMatch) {
      // Save previous query if exists
      if (sqlLines.length > 0 && currentQuery.queryTime !== undefined) {
        currentQuery.sqlText = sqlLines.join(' ').trim().slice(0, 500);
        queries.push(currentQuery as MySQLSlowQuery);
      }
      currentQuery = { user: userMatch[1] };
      sqlLines = [];
      continue;
    }

    // Schema/Database line
    const schemaMatch = line.match(/^(?:use|#\s*Schema:)\s+(\S+)/i);
    if (schemaMatch) {
      currentQuery.database = schemaMatch[1].replace(/;$/, '');
      continue;
    }

    // Query_time line: # Query_time: 4.123  Lock_time: 0.001 Rows_sent: 100 Rows_examined: 50000
    const metricsMatch = line.match(/^#\s*Query_time:\s*([\d.]+)\s+Lock_time:\s*([\d.]+)\s+Rows_sent:\s*(\d+)\s+Rows_examined:\s*(\d+)/);
    if (metricsMatch) {
      currentQuery.queryTime = parseFloat(metricsMatch[1]);
      currentQuery.lockTime = parseFloat(metricsMatch[2]);
      currentQuery.rowsSent = parseInt(metricsMatch[3]);
      currentQuery.rowsExamined = parseInt(metricsMatch[4]);
      currentQuery.timestamp = lastTimestamp;
      continue;
    }

    // SQL lines (not comments, not empty)
    if (!line.startsWith('#') && line.trim() && !line.startsWith('SET timestamp')) {
      sqlLines.push(line.replace(/;$/, '').trim());
    }
  }

  // Push last query
  if (sqlLines.length > 0 && currentQuery.queryTime !== undefined) {
    currentQuery.sqlText = sqlLines.join(' ').trim().slice(0, 500);
    queries.push(currentQuery as MySQLSlowQuery);
  }

  // Sort by query time descending
  queries.sort((a, b) => b.queryTime - a.queryTime);

  // Build query patterns
  const patternMap = new Map<string, { count: number; totalTime: number; maxTime: number; totalRows: number }>();
  for (const q of queries) {
    const pattern = normalizeSQL(q.sqlText);
    const existing = patternMap.get(pattern) || { count: 0, totalTime: 0, maxTime: 0, totalRows: 0 };
    existing.count++;
    existing.totalTime += q.queryTime;
    existing.maxTime = Math.max(existing.maxTime, q.queryTime);
    existing.totalRows += q.rowsExamined;
    patternMap.set(pattern, existing);
  }

  const queryPatterns = Array.from(patternMap.entries())
    .map(([pattern, stats]) => ({
      pattern,
      count: stats.count,
      totalTime: Math.round(stats.totalTime * 1000) / 1000,
      avgTime: Math.round((stats.totalTime / stats.count) * 1000) / 1000,
      maxTime: Math.round(stats.maxTime * 1000) / 1000,
      avgRowsExamined: Math.round(stats.totalRows / stats.count),
    }))
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 15);

  const totalTime = queries.reduce((s, q) => s + q.queryTime, 0);
  const totalRowsExamined = queries.reduce((s, q) => s + q.rowsExamined, 0);
  const totalLockTime = queries.reduce((s, q) => s + q.lockTime, 0);

  return {
    reportType: 'mysql_slowlog',
    database: 'mysql',
    totalQueries: queries.length,
    timeRange: { start: firstTimestamp, end: lastTimestamp },
    avgQueryTime: queries.length > 0 ? Math.round((totalTime / queries.length) * 1000) / 1000 : 0,
    maxQueryTime: queries.length > 0 ? Math.round(queries[0].queryTime * 1000) / 1000 : 0,
    totalQueryTime: Math.round(totalTime * 1000) / 1000,
    topSlowQueries: queries.slice(0, 15),
    queryPatterns,
    statistics: {
      queriesOver1s: queries.filter(q => q.queryTime > 1).length,
      queriesOver5s: queries.filter(q => q.queryTime > 5).length,
      queriesOver10s: queries.filter(q => q.queryTime > 10).length,
      avgRowsExamined: queries.length > 0 ? Math.round(totalRowsExamined / queries.length) : 0,
      avgLockTime: queries.length > 0 ? Math.round((totalLockTime / queries.length) * 1000) / 1000 : 0,
    },
    sectionsFound: ['Slow Query Log'],
    rawSections: { 'Sample Queries': queries.slice(0, 5).map(q => q.sqlText).join('\n\n') },
  };
}
