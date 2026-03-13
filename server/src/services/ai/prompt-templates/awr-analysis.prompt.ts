/**
 * AI Prompt Template for AWR / Database Performance Report Analysis
 * Generates structured root-cause analysis, SQL insights, and recommendations.
 */

import type { AIChatParams } from '../ai-provider.interface.js';
import type { ParsedReportMetrics } from '../../awr/report-parser.service.js';

const SYSTEM_PROMPT = `You are an expert database performance engineer with 20+ years of experience in Oracle, PostgreSQL, and MySQL. You specialize in analyzing AWR reports, slow query logs, and database performance metrics.

Your expertise includes:
- Oracle: AWR/ASH/ADDM analysis, wait events, execution plans, SGA/PGA tuning
- PostgreSQL: pg_stat_statements, shared_buffers, work_mem, vacuum analysis
- MySQL: slow query log analysis, InnoDB tuning, query optimization
- Cross-platform: index strategies, query optimization, partitioning, connection pooling

When analyzing performance metrics, you:
1. Identify the root cause of performance issues with evidence
2. Detect slow/problematic SQL queries and explain WHY they are slow
3. Identify resource bottlenecks (CPU, I/O, memory, locking)
4. Provide specific, actionable tuning recommendations with SQL code
5. Suggest index creation with exact CREATE INDEX statements
6. Rate overall database health on a 0-100 scale

You MUST respond with a valid JSON object. Do NOT include any text outside the JSON.`;

const RESPONSE_SCHEMA = `{
  "summary": {
    "healthScore": 75,
    "healthRating": "healthy|degraded|critical",
    "headline": "One-line summary of the database health",
    "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
    "timeRange": "10:00 - 11:00 (60 min)"
  },
  "rootCause": [
    {
      "primaryCause": "Short title of the root cause",
      "explanation": "Detailed explanation with evidence from the metrics",
      "evidence": ["Metric 1 shows X", "Wait event Y at Z%"],
      "severity": "critical|high|medium|low",
      "affectedArea": "cpu|io|memory|locking|network|sql|config"
    }
  ],
  "sqlAnalysis": [
    {
      "sqlId": "abc123",
      "sqlText": "SELECT ... (abbreviated)",
      "problem": "Why this query is slow",
      "currentTime": "4.5s avg",
      "recommendation": "What to change",
      "suggestedRewrite": "Optimized SQL if applicable",
      "indexRecommendation": "CREATE INDEX ... if applicable",
      "estimatedImprovement": "Expected improvement"
    }
  ],
  "waitEventAnalysis": [
    {
      "event": "db file sequential read",
      "interpretation": "What this wait event means and why it's occurring",
      "severity": "critical|high|medium|low",
      "recommendation": "How to address this wait event"
    }
  ],
  "recommendations": [
    {
      "category": "index|sql|config|partition|memory|io|architecture",
      "priority": "immediate|short-term|long-term",
      "title": "Recommendation title",
      "description": "Detailed description",
      "implementation": "Exact SQL or config change to apply",
      "estimatedImpact": "Expected improvement"
    }
  ],
  "indexRecommendations": [
    {
      "table": "table_name",
      "columns": ["col1", "col2"],
      "reason": "Why this index would help",
      "createStatement": "CREATE INDEX idx_name ON table(col1, col2);",
      "estimatedImprovement": "Expected query time reduction"
    }
  ]
}`;

export function buildAWRAnalysisPrompt(
  metrics: ParsedReportMetrics,
  focusAreas?: string[],
): AIChatParams['messages'] {
  let userContent = '';

  // Identify report type
  const reportTypeLabels: Record<string, string> = {
    awr: 'Oracle AWR (Automatic Workload Repository)',
    ash: 'Oracle ASH (Active Session History)',
    addm: 'Oracle ADDM (Automatic Database Diagnostic Monitor)',
    mysql_slowlog: 'MySQL Slow Query Log',
    pg_stats: 'PostgreSQL pg_stat_statements',
    generic: 'Database Performance Report',
  };

  userContent += `## Report Type\n${reportTypeLabels[metrics.reportType] || 'Unknown'}\n\n`;
  userContent += `## Database: ${metrics.database.toUpperCase()}\n\n`;

  // Build context based on report type
  if (metrics.reportType === 'awr') {
    userContent += buildOracleAWRContext(metrics as import('../../awr/parsers/oracle-awr.parser.js').OracleAWRMetrics);
  } else if (metrics.reportType === 'mysql_slowlog') {
    userContent += buildMySQLContext(metrics as import('../../awr/parsers/mysql-slowlog.parser.js').MySQLSlowLogMetrics);
  } else if (metrics.reportType === 'pg_stats') {
    userContent += buildPGContext(metrics as import('../../awr/parsers/pg-stats.parser.js').PGStatsMetrics);
  } else {
    // Generic — send raw content
    const generic = metrics as import('../../awr/report-parser.service.js').GenericReportMetrics;
    userContent += `## Report Content\n${generic.content}\n\n`;
    if (generic.detectedPatterns.length > 0) {
      userContent += `## Detected Patterns\n${generic.detectedPatterns.join(', ')}\n\n`;
    }
    for (const [name, content] of Object.entries(generic.rawSections)) {
      userContent += `### ${name}\n${content}\n\n`;
    }
  }

  if (focusAreas && focusAreas.length > 0) {
    userContent += `\n## Focus Areas\nPay special attention to: ${focusAreas.join(', ')}\n\n`;
  }

  userContent += `\n## Response Format\nRespond with a JSON object in this exact structure:\n${RESPONSE_SCHEMA}`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}

// ── Oracle AWR context builder ──────────────────────────────────────────────

function buildOracleAWRContext(m: import('../../awr/parsers/oracle-awr.parser.js').OracleAWRMetrics): string {
  let ctx = '';

  ctx += `## Instance: ${m.instanceName || 'N/A'} | DB: ${m.dbName || 'N/A'} | Version: ${m.dbVersion || 'N/A'} | Host: ${m.hostName || 'N/A'}\n`;
  ctx += `## Time Range: ${m.timeRange.start} → ${m.timeRange.end} | Elapsed: ${m.elapsedMinutes} min | DB Time: ${m.dbTimeMinutes} min\n\n`;

  if (m.loadProfile) {
    ctx += `## Load Profile (per second)\n`;
    ctx += `DB Time: ${m.loadProfile.dbTimePerSec}s | CPU: ${m.loadProfile.cpuTimePerSec}s | `;
    ctx += `Logical Reads: ${m.loadProfile.logicalReadsPerSec} | Physical Reads: ${m.loadProfile.physicalReadsPerSec}\n`;
    ctx += `Parses: ${m.loadProfile.parsesPerSec} | Hard Parses: ${m.loadProfile.hardParsesPerSec} | `;
    ctx += `Transactions: ${m.loadProfile.transactionsPerSec} | Redo: ${m.loadProfile.redoSizePerSec}\n\n`;
  }

  if (m.waitEvents.length > 0) {
    ctx += `## Top Wait Events\n`;
    for (const w of m.waitEvents) {
      ctx += `- ${w.event} | ${w.percentDbTime}% DB Time | ${w.timeSeconds}s total | ${w.avgWaitMs}ms avg | Class: ${w.waitClass}\n`;
    }
    ctx += '\n';
  }

  if (m.topSQLByElapsed.length > 0) {
    ctx += `## Top SQL by Elapsed Time\n`;
    for (const s of m.topSQLByElapsed) {
      ctx += `- SQL ID: ${s.sqlId} | Elapsed: ${s.elapsedTimeSec}s | CPU: ${s.cpuTimeSec}s | `;
      ctx += `Execs: ${s.executions} | Avg: ${s.avgElapsedMs.toFixed(1)}ms | `;
      ctx += `Buffer Gets: ${s.bufferGets} | Disk Reads: ${s.diskReads} | %DB: ${s.percentDbTime}%\n`;
      if (s.sqlText) ctx += `  SQL: ${s.sqlText.slice(0, 150)}\n`;
    }
    ctx += '\n';
  }

  if (m.instanceEfficiency) {
    ctx += `## Instance Efficiency\n`;
    ctx += `Buffer Cache Hit: ${m.instanceEfficiency.bufferCacheHitRatio}% | `;
    ctx += `Library Cache Hit: ${m.instanceEfficiency.libraryCacheHitRatio}% | `;
    ctx += `Soft Parse: ${m.instanceEfficiency.softParseRatio}% | `;
    ctx += `Execute to Parse: ${m.instanceEfficiency.executeToParseRatio}%\n\n`;
  }

  if (m.ioStats.length > 0) {
    ctx += `## I/O Statistics\n`;
    for (const io of m.ioStats.slice(0, 5)) {
      ctx += `- ${io.tablespace} | Reads: ${io.reads} (${io.avgReadMs}ms avg) | Writes: ${io.writes} (${io.avgWriteMs}ms avg)\n`;
    }
    ctx += '\n';
  }

  if (m.memory) {
    ctx += `## Memory\n`;
    ctx += `SGA: ${m.memory.sgaTotalMB}MB | PGA: ${m.memory.pgaAllocatedMB}MB | `;
    ctx += `Buffer Cache: ${m.memory.bufferCacheMB}MB | Shared Pool: ${m.memory.sharedPoolMB}MB\n\n`;
  }

  return ctx;
}

// ── MySQL context builder ───────────────────────────────────────────────────

function buildMySQLContext(m: import('../../awr/parsers/mysql-slowlog.parser.js').MySQLSlowLogMetrics): string {
  let ctx = '';

  ctx += `## Summary\n`;
  ctx += `Total Slow Queries: ${m.totalQueries} | Time Range: ${m.timeRange.start} → ${m.timeRange.end}\n`;
  ctx += `Total Query Time: ${m.totalQueryTime}s | Avg: ${m.avgQueryTime}s | Max: ${m.maxQueryTime}s\n`;
  ctx += `Over 1s: ${m.statistics.queriesOver1s} | Over 5s: ${m.statistics.queriesOver5s} | Over 10s: ${m.statistics.queriesOver10s}\n`;
  ctx += `Avg Rows Examined: ${m.statistics.avgRowsExamined} | Avg Lock Time: ${m.statistics.avgLockTime}s\n\n`;

  if (m.topSlowQueries.length > 0) {
    ctx += `## Top Slow Queries\n`;
    for (const q of m.topSlowQueries.slice(0, 10)) {
      ctx += `- Query Time: ${q.queryTime}s | Lock: ${q.lockTime}s | Rows Sent: ${q.rowsSent} | Rows Examined: ${q.rowsExamined}\n`;
      ctx += `  SQL: ${q.sqlText.slice(0, 200)}\n`;
    }
    ctx += '\n';
  }

  if (m.queryPatterns.length > 0) {
    ctx += `## Query Patterns (normalized)\n`;
    for (const p of m.queryPatterns.slice(0, 10)) {
      ctx += `- Pattern: ${p.pattern.slice(0, 150)}\n`;
      ctx += `  Count: ${p.count} | Total: ${p.totalTime}s | Avg: ${p.avgTime}s | Max: ${p.maxTime}s | Avg Rows: ${p.avgRowsExamined}\n`;
    }
    ctx += '\n';
  }

  return ctx;
}

// ── PostgreSQL context builder ──────────────────────────────────────────────

function buildPGContext(m: import('../../awr/parsers/pg-stats.parser.js').PGStatsMetrics): string {
  let ctx = '';

  ctx += `## Summary\n`;
  ctx += `Total Queries: ${m.totalQueries} | Total Calls: ${m.totalCalls} | Total Time: ${m.totalTimeSec}s\n`;
  ctx += `Cache Hit Ratio: ${m.statistics.overallCacheHitRatio}% | Queries >100ms: ${m.statistics.queriesOver100ms} | >1s: ${m.statistics.queriesOver1s}\n`;
  ctx += `Using Temp Blocks: ${m.statistics.queriesUsingTempBlks}\n\n`;

  if (m.topByTotalTime.length > 0) {
    ctx += `## Top Queries by Total Time\n`;
    for (const q of m.topByTotalTime.slice(0, 8)) {
      ctx += `- Total: ${q.totalTimeSec.toFixed(2)}s | Mean: ${q.meanTimeMs.toFixed(1)}ms | Calls: ${q.calls} | Rows: ${q.rows}\n`;
      ctx += `  Cache Hit: ${q.cacheHitRatio}% | Shared Read: ${q.sharedBlksRead} | Temp: ${q.tempBlksRead + q.tempBlksWritten}\n`;
      ctx += `  SQL: ${q.query.slice(0, 200)}\n`;
    }
    ctx += '\n';
  }

  if (m.topByMeanTime.length > 0) {
    ctx += `## Top Queries by Mean Time\n`;
    for (const q of m.topByMeanTime.slice(0, 5)) {
      ctx += `- Mean: ${q.meanTimeMs.toFixed(1)}ms | Max: ${q.maxTimeMs.toFixed(1)}ms | Calls: ${q.calls}\n`;
      ctx += `  SQL: ${q.query.slice(0, 200)}\n`;
    }
    ctx += '\n';
  }

  return ctx;
}
