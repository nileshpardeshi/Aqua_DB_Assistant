/**
 * Master Report Parser Service
 * Detects report type and delegates to format-specific parsers.
 * Includes LRU cache for parsed results (SHA-256 keyed, 1-hour TTL).
 */

import { createHash } from 'crypto';
import { parseOracleAWR, type OracleAWRMetrics } from './parsers/oracle-awr.parser.js';
import { parseMySQLSlowLog, type MySQLSlowLogMetrics } from './parsers/mysql-slowlog.parser.js';
import { parsePGStats, type PGStatsMetrics } from './parsers/pg-stats.parser.js';
import { logger } from '../../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type ReportType = 'awr' | 'ash' | 'addm' | 'mysql_slowlog' | 'pg_stats' | 'generic';
export type DatabaseType = 'oracle' | 'mysql' | 'postgresql' | 'unknown';

export interface GenericReportMetrics {
  reportType: 'generic' | 'ash' | 'addm';
  database: DatabaseType;
  content: string; // Truncated to ~8000 chars for AI
  sectionsFound: string[];
  rawSections: Record<string, string>;
  detectedPatterns: string[];
}

export type ParsedReportMetrics = OracleAWRMetrics | MySQLSlowLogMetrics | PGStatsMetrics | GenericReportMetrics;

export interface ParseResult {
  metrics: ParsedReportMetrics;
  reportType: ReportType;
  database: DatabaseType;
  fileSizeKB: number;
  parseTimeMs: number;
  fromCache: boolean;
}

// ── Parse Cache (LRU, 1-hour TTL, max 50 entries) ──────────────────────────

interface CacheEntry {
  result: ParseResult;
  timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 50;
const parseCache = new Map<string, CacheEntry>();

function getCacheKey(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function getFromCache(key: string): ParseResult | null {
  const entry = parseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    parseCache.delete(key);
    return null;
  }
  // Move to end (LRU)
  parseCache.delete(key);
  parseCache.set(key, entry);
  return { ...entry.result, fromCache: true };
}

function setCache(key: string, result: ParseResult): void {
  // Evict oldest if at capacity
  if (parseCache.size >= CACHE_MAX) {
    const firstKey = parseCache.keys().next().value;
    if (firstKey) parseCache.delete(firstKey);
  }
  parseCache.set(key, { result, timestamp: Date.now() });
}

// ── Report Type Detection ───────────────────────────────────────────────────

export function detectReportType(content: string, fileName?: string): { type: ReportType; database: DatabaseType } {
  const lower = content.toLowerCase();
  const ext = fileName?.toLowerCase() ?? '';

  // Oracle AWR
  if (
    /workload\s+repository/i.test(content) ||
    /awr\s+report/i.test(content) ||
    (/load\s+profile/i.test(content) && /wait\s+events/i.test(content)) ||
    (/snap\s+id/i.test(content) && /db\s+name/i.test(content))
  ) {
    return { type: 'awr', database: 'oracle' };
  }

  // Oracle ASH
  if (/active\s+session\s+history/i.test(content) || /ash\s+report/i.test(content)) {
    return { type: 'ash', database: 'oracle' };
  }

  // Oracle ADDM
  if (/addm\s+report/i.test(content) || /automatic\s+database\s+diagnostic/i.test(content)) {
    return { type: 'addm', database: 'oracle' };
  }

  // MySQL Slow Query Log
  if (
    /Query_time:/i.test(content) ||
    /Tcp\s+port:\s+3306/i.test(content) ||
    (/Lock_time:/i.test(content) && /Rows_examined:/i.test(content)) ||
    ext.endsWith('.log')
  ) {
    return { type: 'mysql_slowlog', database: 'mysql' };
  }

  // PostgreSQL pg_stat_statements
  if (
    /pg_stat_statements/i.test(content) ||
    /shared_blks_hit/i.test(content) ||
    (/total_exec_time|total_time/i.test(content) && /calls/i.test(content) && /mean_exec_time|mean_time/i.test(content)) ||
    ext.endsWith('.csv')
  ) {
    return { type: 'pg_stats', database: 'postgresql' };
  }

  // Generic — try to detect database type at least
  let database: DatabaseType = 'unknown';
  if (/oracle|ora-\d|v\$|dba_/i.test(content)) database = 'oracle';
  else if (/mysql|innodb|myisam/i.test(content)) database = 'mysql';
  else if (/postgresql|postgres|pg_/i.test(content)) database = 'postgresql';

  return { type: 'generic', database };
}

// ── Main Parse Function ─────────────────────────────────────────────────────

export function parseReport(content: string, fileName?: string, forceType?: ReportType): ParseResult {
  const cacheKey = getCacheKey(content);
  const cached = getFromCache(cacheKey);
  if (cached) {
    logger.info('Report parse cache hit', { fileName, cacheKey: cacheKey.slice(0, 12) });
    return cached;
  }

  const startTime = performance.now();
  const { type, database } = forceType
    ? { type: forceType, database: detectReportType(content, fileName).database }
    : detectReportType(content, fileName);

  let metrics: ParsedReportMetrics;

  switch (type) {
    case 'awr':
      metrics = parseOracleAWR(content);
      break;
    case 'mysql_slowlog':
      metrics = parseMySQLSlowLog(content);
      break;
    case 'pg_stats':
      metrics = parsePGStats(content);
      break;
    case 'ash':
    case 'addm':
    case 'generic':
    default:
      metrics = parseGenericReport(content, type, database);
      break;
  }

  const parseTimeMs = Math.round(performance.now() - startTime);
  const fileSizeKB = Math.round(Buffer.byteLength(content, 'utf8') / 1024);

  const result: ParseResult = {
    metrics,
    reportType: type,
    database,
    fileSizeKB,
    parseTimeMs,
    fromCache: false,
  };

  setCache(cacheKey, result);
  logger.info('Report parsed', { fileName, type, database, fileSizeKB, parseTimeMs, sectionsFound: metrics.sectionsFound });

  return result;
}

// ── Generic / ASH / ADDM parser ─────────────────────────────────────────────

function parseGenericReport(content: string, type: ReportType, database: DatabaseType): GenericReportMetrics {
  // Strip HTML if present
  let text = content;
  if (/<html|<table/i.test(content)) {
    text = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\r\n/g, '\n');
  }

  // Detect key patterns
  const detectedPatterns: string[] = [];
  const patternChecks: [RegExp, string][] = [
    [/wait\s+event/i, 'Wait Events'],
    [/execution\s+plan/i, 'Execution Plans'],
    [/full\s+table\s+scan/i, 'Full Table Scans'],
    [/index\s+(?:scan|seek|range)/i, 'Index Usage'],
    [/(?:cpu|memory|io)\s+(?:usage|utilization|bottleneck)/i, 'Resource Metrics'],
    [/lock(?:ing|ed|_time)/i, 'Lock Contention'],
    [/buffer\s+(?:cache|pool|hit)/i, 'Buffer Cache'],
    [/(?:slow|expensive)\s+(?:query|sql)/i, 'Slow Queries'],
    [/(?:recommendation|suggestion|finding)/i, 'Recommendations'],
    [/(?:blocking|blocked)\s+session/i, 'Blocking Sessions'],
  ];

  for (const [pattern, label] of patternChecks) {
    if (pattern.test(text)) detectedPatterns.push(label);
  }

  // Extract key sections
  const rawSections: Record<string, string> = {};
  const sectionPatterns = [
    { name: 'Summary', pattern: /(?:summary|overview|findings)[:\s]*([\s\S]{50,2000}?)(?=\n\n|\n[A-Z]|$)/i },
    { name: 'Wait Events', pattern: /(?:wait\s+events?|top\s+events?)[:\s]*([\s\S]{50,3000}?)(?=\n\n[A-Z]|\n={3,}|$)/i },
    { name: 'SQL Analysis', pattern: /(?:sql\s+(?:analysis|ordered|performance))[:\s]*([\s\S]{50,3000}?)(?=\n\n[A-Z]|\n={3,}|$)/i },
    { name: 'Recommendations', pattern: /(?:recommendation|suggestion|action)[:\s]*([\s\S]{50,3000}?)(?=\n\n[A-Z]|\n={3,}|$)/i },
  ];

  for (const sp of sectionPatterns) {
    const match = sp.pattern.exec(text);
    if (match) {
      rawSections[sp.name] = match[1].trim().slice(0, 3000);
    }
  }

  // Truncate content for AI (keep most relevant parts)
  const truncated = text.slice(0, 8000);

  return {
    reportType: type as 'generic' | 'ash' | 'addm',
    database,
    content: truncated,
    sectionsFound: [...Object.keys(rawSections), ...detectedPatterns],
    rawSections,
    detectedPatterns,
  };
}
