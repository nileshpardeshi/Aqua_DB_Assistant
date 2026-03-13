/**
 * Incident Timeline Service
 *
 * Extracts timestamped events from multiple parsed reports,
 * builds a unified chronological timeline, and compresses
 * it for AI analysis within token budgets.
 *
 * Token optimization strategy:
 *  1. Local parsing — extract only timestamped events (85-95% reduction)
 *  2. Event deduplication — collapse repeated events with counts
 *  3. Time-window focus — discard events outside incident window ±30min
 *  4. Smart truncation — top-N events per category
 *  5. Priority-based compression — keep root-cause-likely events first
 */

import type { ParseResult } from './report-parser.service.js';
import type { OracleAWRMetrics } from './parsers/oracle-awr.parser.js';
import type { MySQLSlowLogMetrics } from './parsers/mysql-slowlog.parser.js';
import type { PGStatsMetrics } from './parsers/pg-stats.parser.js';
import type { GenericReportMetrics } from './report-parser.service.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type EventCategory =
  | 'deployment'
  | 'schema_change'
  | 'performance'
  | 'query'
  | 'wait_event'
  | 'resource'
  | 'config_change'
  | 'error'
  | 'metric';

export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TimelineEvent {
  id: string;
  timestamp: string;       // ISO string or original timestamp
  sortKey: number;         // Unix ms for sorting
  category: EventCategory;
  severity: EventSeverity;
  title: string;
  description: string;
  source: string;          // File name that produced this event
  sourceType: string;      // Report type (awr, mysql_slowlog, etc.)
  metadata?: Record<string, unknown>;
}

export interface IncidentTimeline {
  events: TimelineEvent[];
  sources: Array<{
    fileName: string;
    reportType: string;
    database: string;
    eventCount: number;
    fileSizeKB: number;
  }>;
  timeRange: { earliest: string; latest: string } | null;
  totalEventsBeforeDedup: number;
  totalEventsAfterDedup: number;
  compressionRatio: number;
}

export interface IncidentWindow {
  start?: string; // ISO date-time
  end?: string;   // ISO date-time
}

// ── Helpers ─────────────────────────────────────────────────────────────────

let eventCounter = 0;
function nextEventId(): string {
  return `evt-${++eventCounter}-${Date.now().toString(36)}`;
}

function inferSeverity(value: number, thresholds: { critical: number; high: number; medium: number }): EventSeverity {
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.high) return 'high';
  if (value >= thresholds.medium) return 'medium';
  return 'low';
}

function tryParseTimestamp(raw: string): number {
  // Try ISO parse
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getTime();

  // Try common patterns: "10:05 AM", "2024-03-14 10:05:00"
  const timeOnly = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (timeOnly) {
    let h = parseInt(timeOnly[1]);
    const m = parseInt(timeOnly[2]);
    const s = parseInt(timeOnly[3] || '0');
    const ampm = timeOnly[4];
    if (ampm?.toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;
    const today = new Date();
    today.setHours(h, m, s, 0);
    return today.getTime();
  }

  // Fallback: use current time
  return Date.now();
}

// ── Event Extractors (per report type) ──────────────────────────────────────

function extractOracleAWREvents(metrics: OracleAWRMetrics, fileName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const src = fileName || 'Oracle AWR';
  const snapRange = metrics.timeRange ? `${metrics.timeRange.start} - ${metrics.timeRange.end}` : '';
  const snapStart = metrics.timeRange?.start || '';

  // Snapshot time range as deployment/baseline event
  if (snapRange) {
    events.push({
      id: nextEventId(),
      timestamp: snapRange,
      sortKey: tryParseTimestamp(snapStart),
      category: 'metric',
      severity: 'info',
      title: `AWR Snapshot: ${snapRange}`,
      description: `Instance: ${metrics.instanceName || 'N/A'}, DB: ${metrics.dbName || 'N/A'}, Elapsed: ${metrics.elapsedMinutes || 'N/A'} min, DB Time: ${metrics.dbTimeMinutes || 'N/A'} min`,
      source: src,
      sourceType: 'awr',
      metadata: { instanceName: metrics.instanceName, dbName: metrics.dbName },
    });
  }

  // Load profile metrics as resource events
  if (metrics.loadProfile) {
    const lp = metrics.loadProfile;
    const dbTimePerSec = parseFloat(String(lp.dbTimePerSec || '0'));
    if (dbTimePerSec > 0) {
      events.push({
        id: nextEventId(),
        timestamp: snapStart || new Date().toISOString(),
        sortKey: tryParseTimestamp(snapStart || ''),
        category: 'resource',
        severity: inferSeverity(dbTimePerSec, { critical: 10, high: 5, medium: 2 }),
        title: `DB Time: ${dbTimePerSec}s/sec`,
        description: `Logical Reads: ${lp.logicalReadsPerSec || 'N/A'}/sec, Physical Reads: ${lp.physicalReadsPerSec || 'N/A'}/sec, Redo: ${lp.redoSizePerSec || 'N/A'}/sec, Parses: ${lp.parsesPerSec || 'N/A'}/sec`,
        source: src,
        sourceType: 'awr',
        metadata: { loadProfile: lp },
      });
    }
  }

  // Top wait events as performance events
  if (metrics.waitEvents && Array.isArray(metrics.waitEvents)) {
    for (const wait of metrics.waitEvents.slice(0, 10)) {
      const pctDbTime = parseFloat(String(wait.percentDbTime || '0'));
      events.push({
        id: nextEventId(),
        timestamp: snapStart || new Date().toISOString(),
        sortKey: tryParseTimestamp(snapStart || '') + events.length,
        category: 'wait_event',
        severity: inferSeverity(pctDbTime, { critical: 30, high: 15, medium: 5 }),
        title: `Wait: ${wait.event || 'Unknown'} (${pctDbTime}% DB Time)`,
        description: `Time: ${wait.timeSeconds || 'N/A'}s, Avg: ${wait.avgWaitMs || 'N/A'}ms, Class: ${wait.waitClass || 'N/A'}`,
        source: src,
        sourceType: 'awr',
        metadata: wait as unknown as Record<string, unknown>,
      });
    }
  }

  // Top SQL as query events
  if (metrics.topSQLByElapsed && Array.isArray(metrics.topSQLByElapsed)) {
    for (const sql of metrics.topSQLByElapsed.slice(0, 10)) {
      const elapsed = parseFloat(String(sql.elapsedTimeSec || '0'));
      events.push({
        id: nextEventId(),
        timestamp: snapStart || new Date().toISOString(),
        sortKey: tryParseTimestamp(snapStart || '') + events.length,
        category: 'query',
        severity: inferSeverity(elapsed, { critical: 60, high: 20, medium: 5 }),
        title: `Slow SQL: ${(sql.sqlId || 'N/A')} — ${elapsed}s elapsed`,
        description: `Executions: ${sql.executions || 'N/A'}, CPU: ${sql.cpuTimeSec || 'N/A'}s, Buffer Gets: ${sql.bufferGets || 'N/A'}, SQL: ${(sql.sqlText || '').slice(0, 200)}`,
        source: src,
        sourceType: 'awr',
        metadata: sql as unknown as Record<string, unknown>,
      });
    }
  }

  // Instance efficiency issues
  if (metrics.instanceEfficiency) {
    const eff = metrics.instanceEfficiency;
    const bufferHit = parseFloat(String(eff.bufferCacheHitRatio || '100'));
    if (bufferHit < 95) {
      events.push({
        id: nextEventId(),
        timestamp: snapStart || new Date().toISOString(),
        sortKey: tryParseTimestamp(snapStart || '') + events.length,
        category: 'performance',
        severity: inferSeverity(100 - bufferHit, { critical: 20, high: 10, medium: 5 }),
        title: `Buffer Cache Hit Ratio: ${bufferHit}%`,
        description: `Library Hit: ${eff.libraryCacheHitRatio || 'N/A'}%, Soft Parse: ${eff.softParseRatio || 'N/A'}%, Latch Hit: ${eff.latchHitRatio || 'N/A'}%`,
        source: src,
        sourceType: 'awr',
        metadata: { instanceEfficiency: eff },
      });
    }
  }

  return events;
}

function extractMySQLSlowLogEvents(metrics: MySQLSlowLogMetrics, fileName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const src = fileName || 'MySQL Slow Log';
  const timeRangeStr = metrics.timeRange ? `${metrics.timeRange.start} - ${metrics.timeRange.end}` : '';

  // Overall summary
  events.push({
    id: nextEventId(),
    timestamp: metrics.timeRange?.start || new Date().toISOString(),
    sortKey: tryParseTimestamp(metrics.timeRange?.start || ''),
    category: 'metric',
    severity: 'info',
    title: `MySQL Slow Log: ${metrics.totalQueries || 0} slow queries`,
    description: `Time range: ${timeRangeStr || 'N/A'}, Avg query time: ${metrics.avgQueryTime || 'N/A'}s, Max: ${metrics.maxQueryTime || 'N/A'}s`,
    source: src,
    sourceType: 'mysql_slowlog',
    metadata: { totalQueries: metrics.totalQueries, avgQueryTime: metrics.avgQueryTime },
  });

  // Individual slow queries as events
  if (metrics.topSlowQueries && Array.isArray(metrics.topSlowQueries)) {
    for (const q of metrics.topSlowQueries.slice(0, 20)) {
      const queryTime = parseFloat(String(q.queryTime || '0'));
      events.push({
        id: nextEventId(),
        timestamp: q.timestamp || new Date().toISOString(),
        sortKey: tryParseTimestamp(q.timestamp || ''),
        category: 'query',
        severity: inferSeverity(queryTime, { critical: 30, high: 10, medium: 3 }),
        title: `Slow Query: ${queryTime}s — ${(q.sqlText || '').slice(0, 80)}...`,
        description: `Lock Time: ${q.lockTime || 'N/A'}s, Rows Sent: ${q.rowsSent || 'N/A'}, Rows Examined: ${q.rowsExamined || 'N/A'}, User: ${q.user || 'N/A'}`,
        source: src,
        sourceType: 'mysql_slowlog',
        metadata: q as unknown as Record<string, unknown>,
      });
    }
  }

  return events;
}

function extractPGStatsEvents(metrics: PGStatsMetrics, fileName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const src = fileName || 'PostgreSQL pg_stat_statements';

  // Summary
  const hitRatio = parseFloat(String(metrics.statistics?.overallCacheHitRatio || '100'));
  events.push({
    id: nextEventId(),
    timestamp: new Date().toISOString(),
    sortKey: Date.now(),
    category: 'metric',
    severity: hitRatio < 90 ? 'high' : hitRatio < 95 ? 'medium' : 'info',
    title: `PG Stats: ${metrics.totalQueries || 0} queries, Cache Hit: ${hitRatio}%`,
    description: `Queries >100ms: ${metrics.statistics?.queriesOver100ms || 0}, Total exec time: ${metrics.totalTimeSec || 'N/A'}s`,
    source: src,
    sourceType: 'pg_stats',
    metadata: { statistics: metrics.statistics },
  });

  // Top queries by total time
  if (metrics.topByTotalTime && Array.isArray(metrics.topByTotalTime)) {
    for (const q of metrics.topByTotalTime.slice(0, 10)) {
      const totalTime = parseFloat(String(q.totalTimeSec || '0'));
      events.push({
        id: nextEventId(),
        timestamp: new Date().toISOString(),
        sortKey: Date.now() + events.length,
        category: 'query',
        severity: inferSeverity(totalTime, { critical: 60, high: 20, medium: 5 }),
        title: `Heavy Query: ${totalTime.toFixed(1)}s total — ${(q.query || '').slice(0, 80)}`,
        description: `Calls: ${q.calls || 'N/A'}, Mean: ${q.meanTimeMs || 'N/A'}ms, Rows: ${q.rows || 'N/A'}, Shared Hit: ${q.sharedBlksHit || 'N/A'}`,
        source: src,
        sourceType: 'pg_stats',
        metadata: q as unknown as Record<string, unknown>,
      });
    }
  }

  return events;
}

function extractGenericEvents(metrics: GenericReportMetrics, fileName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const src = fileName || 'Generic Report';

  // Parse line-by-line for timestamped entries
  const lines = (metrics.content || '').split('\n');
  const tsPattern = /^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}(?::\d{2})?|\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–:|]\s*(.+)/i;
  const deployPattern = /deploy|release|migration|rollout|restart|upgrade/i;
  const schemaPattern = /alter\s+table|drop\s+(?:table|index|column)|create\s+(?:index|table)|add\s+column|rename/i;
  const errorPattern = /error|fail|crash|timeout|deadlock|ORA-|ERROR\s+\d/i;
  const perfPattern = /latency|spike|slow|degrad|cpu|memory|disk|io\s|iops/i;

  for (const line of lines.slice(0, 500)) { // Limit to 500 lines
    const match = line.match(tsPattern);
    if (match) {
      const ts = match[1];
      const desc = match[2].trim();
      let category: EventCategory = 'metric';
      let severity: EventSeverity = 'info';

      if (deployPattern.test(desc)) { category = 'deployment'; severity = 'medium'; }
      else if (schemaPattern.test(desc)) { category = 'schema_change'; severity = 'high'; }
      else if (errorPattern.test(desc)) { category = 'error'; severity = 'high'; }
      else if (perfPattern.test(desc)) { category = 'performance'; severity = 'medium'; }

      events.push({
        id: nextEventId(),
        timestamp: ts,
        sortKey: tryParseTimestamp(ts),
        category,
        severity,
        title: desc.slice(0, 120),
        description: desc,
        source: src,
        sourceType: metrics.reportType,
        metadata: {},
      });
    }
  }

  // Detected patterns as events
  if (metrics.detectedPatterns && metrics.detectedPatterns.length > 0) {
    for (const pattern of metrics.detectedPatterns.slice(0, 10)) {
      events.push({
        id: nextEventId(),
        timestamp: new Date().toISOString(),
        sortKey: Date.now() + events.length,
        category: 'performance',
        severity: 'medium',
        title: `Detected: ${pattern}`,
        description: pattern,
        source: src,
        sourceType: metrics.reportType,
      });
    }
  }

  return events;
}

// ── Main API ────────────────────────────────────────────────────────────────

/**
 * Extract timeline events from a single parsed report.
 */
export function extractTimelineEvents(parseResult: ParseResult, fileName: string): TimelineEvent[] {
  const m = parseResult.metrics;

  switch (parseResult.reportType) {
    case 'awr':
      return extractOracleAWREvents(m as OracleAWRMetrics, fileName);
    case 'mysql_slowlog':
      return extractMySQLSlowLogEvents(m as MySQLSlowLogMetrics, fileName);
    case 'pg_stats':
      return extractPGStatsEvents(m as PGStatsMetrics, fileName);
    case 'ash':
    case 'addm':
    case 'generic':
    default:
      return extractGenericEvents(m as GenericReportMetrics, fileName);
  }
}

/**
 * Build a unified timeline from multiple parsed reports.
 * Merges, sorts chronologically, deduplicates.
 */
export function buildUnifiedTimeline(
  parsedSources: Array<{ parseResult: ParseResult; fileName: string }>,
  incidentWindow?: IncidentWindow,
): IncidentTimeline {
  let allEvents: TimelineEvent[] = [];
  const sources: IncidentTimeline['sources'] = [];

  // 1. Extract events from each source
  for (const { parseResult, fileName } of parsedSources) {
    const events = extractTimelineEvents(parseResult, fileName);
    sources.push({
      fileName,
      reportType: parseResult.reportType,
      database: parseResult.database,
      eventCount: events.length,
      fileSizeKB: parseResult.fileSizeKB,
    });
    allEvents.push(...events);
  }

  const totalBeforeDedup = allEvents.length;

  // 2. Sort chronologically
  allEvents.sort((a, b) => a.sortKey - b.sortKey);

  // 3. Apply incident window filter (±30 min buffer)
  if (incidentWindow?.start || incidentWindow?.end) {
    const bufferMs = 30 * 60 * 1000;
    const winStart = incidentWindow.start ? new Date(incidentWindow.start).getTime() - bufferMs : -Infinity;
    const winEnd = incidentWindow.end ? new Date(incidentWindow.end).getTime() + bufferMs : Infinity;
    allEvents = allEvents.filter((e) => e.sortKey >= winStart && e.sortKey <= winEnd);
  }

  // 4. Deduplicate — collapse events with same title + category within 60s window
  const deduped: TimelineEvent[] = [];
  const seen = new Map<string, { event: TimelineEvent; count: number }>();

  for (const evt of allEvents) {
    const key = `${evt.category}::${evt.title}`;
    const existing = seen.get(key);
    if (existing && Math.abs(evt.sortKey - existing.event.sortKey) < 60_000) {
      existing.count++;
      // Keep the higher severity
      const sevOrder: EventSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
      if (sevOrder.indexOf(evt.severity) > sevOrder.indexOf(existing.event.severity)) {
        existing.event.severity = evt.severity;
      }
      existing.event.description = `${existing.event.description} (×${existing.count})`;
    } else {
      const entry = { event: evt, count: 1 };
      seen.set(key, entry);
      deduped.push(evt);
    }
  }

  // 5. Compute time range
  let timeRange: IncidentTimeline['timeRange'] = null;
  if (deduped.length > 0) {
    timeRange = {
      earliest: deduped[0].timestamp,
      latest: deduped[deduped.length - 1].timestamp,
    };
  }

  const totalInputKB = sources.reduce((s, src) => s + src.fileSizeKB, 0);
  const compressedKB = JSON.stringify(deduped).length / 1024;

  return {
    events: deduped,
    sources,
    timeRange,
    totalEventsBeforeDedup: totalBeforeDedup,
    totalEventsAfterDedup: deduped.length,
    compressionRatio: totalInputKB > 0 ? Math.round((1 - compressedKB / totalInputKB) * 100) : 0,
  };
}

/**
 * Compress timeline for AI analysis.
 * Priority-based truncation to fit within token budget.
 */
export function compressTimelineForAI(timeline: IncidentTimeline, maxChars: number = 12000): string {
  const { events } = timeline;

  // Priority order: critical > high > medium > low > info
  const sevOrder: Record<EventSeverity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  // Category priority: schema_change & deployment first (likely root causes)
  const catOrder: Record<EventCategory, number> = {
    schema_change: 10, deployment: 9, error: 8, performance: 7,
    config_change: 6, query: 5, wait_event: 4, resource: 3, metric: 2,
  };

  // Sort by priority score (descending), then chronologically
  const scored = events.map((e) => ({
    event: e,
    score: (catOrder[e.category] || 0) * 10 + (sevOrder[e.severity] || 0),
  }));
  scored.sort((a, b) => b.score - a.score || a.event.sortKey - b.event.sortKey);

  // Build compressed text, stopping when budget exceeded
  const lines: string[] = [];
  lines.push(`=== INCIDENT TIMELINE (${events.length} events from ${timeline.sources.length} sources) ===`);
  lines.push(`Time Range: ${timeline.timeRange?.earliest || 'N/A'} → ${timeline.timeRange?.latest || 'N/A'}`);
  lines.push(`Sources: ${timeline.sources.map((s) => `${s.fileName} (${s.reportType}, ${s.database})`).join('; ')}`);
  lines.push('');

  // Re-sort selected events chronologically for the AI
  const selected: typeof scored = [];
  let charCount = lines.join('\n').length;

  for (const s of scored) {
    const line = `[${s.event.timestamp}] [${s.event.severity.toUpperCase()}] [${s.event.category}] ${s.event.title}\n  ${s.event.description}\n  Source: ${s.event.source}`;
    if (charCount + line.length + 2 > maxChars) break;
    selected.push(s);
    charCount += line.length + 2;
  }

  // Sort selected back to chronological order
  selected.sort((a, b) => a.event.sortKey - b.event.sortKey);

  for (const s of selected) {
    lines.push(`[${s.event.timestamp}] [${s.event.severity.toUpperCase()}] [${s.event.category}] ${s.event.title}`);
    lines.push(`  ${s.event.description}`);
    lines.push(`  Source: ${s.event.source}`);
    lines.push('');
  }

  if (selected.length < scored.length) {
    lines.push(`... ${scored.length - selected.length} additional lower-priority events omitted for token efficiency.`);
  }

  return lines.join('\n');
}
