/**
 * PostgreSQL pg_stat_statements Parser
 * Extracts query performance metrics from pg_stat_statements CSV/text exports.
 */

export interface PGStatQuery {
  queryId: string;
  query: string;
  calls: number;
  totalTimeSec: number;
  meanTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  stddevTimeMs: number;
  rows: number;
  sharedBlksHit: number;
  sharedBlksRead: number;
  sharedBlksDirtied: number;
  sharedBlksWritten: number;
  tempBlksRead: number;
  tempBlksWritten: number;
  cacheHitRatio: number;
}

export interface PGStatsMetrics {
  reportType: 'pg_stats';
  database: 'postgresql';
  totalQueries: number;
  totalCalls: number;
  totalTimeSec: number;

  topByTotalTime: PGStatQuery[];
  topByMeanTime: PGStatQuery[];
  topByCalls: PGStatQuery[];
  topByTempBlks: PGStatQuery[];

  statistics: {
    avgMeanTimeMs: number;
    maxMeanTimeMs: number;
    totalSharedBlksHit: number;
    totalSharedBlksRead: number;
    overallCacheHitRatio: number;
    queriesOver100ms: number;
    queriesOver1s: number;
    queriesUsingTempBlks: number;
  };

  sectionsFound: string[];
  rawSections: Record<string, string>;
}

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  const val = parseFloat(s.replace(/,/g, '').trim());
  return isNaN(val) ? 0 : val;
}

function detectDelimiter(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes('|')) return '|';
  return ',';
}

function parseCSVLine(line: string, delimiter: string): string[] {
  if (delimiter === ',') {
    // Handle quoted CSV fields
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
  return line.split(delimiter).map(c => c.trim());
}

export function parsePGStats(content: string): PGStatsMetrics {
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('--'));
  if (lines.length < 2) {
    return emptyPGStats();
  }

  const headerLine = lines[0];
  const delimiter = detectDelimiter(headerLine);
  const headers = parseCSVLine(headerLine, delimiter).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));

  // Map column positions
  const colIdx = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const queryIdx = colIdx(['query']);
  const callsIdx = colIdx(['calls']);
  const totalTimeIdx = colIdx(['total_exec_time', 'total_time']);
  const meanTimeIdx = colIdx(['mean_exec_time', 'mean_time']);
  const minTimeIdx = colIdx(['min_exec_time', 'min_time']);
  const maxTimeIdx = colIdx(['max_exec_time', 'max_time']);
  const stddevIdx = colIdx(['stddev_exec_time', 'stddev_time']);
  const rowsIdx = colIdx(['rows']);
  const blksHitIdx = colIdx(['shared_blks_hit']);
  const blksReadIdx = colIdx(['shared_blks_read']);
  const blksDirtiedIdx = colIdx(['shared_blks_dirtied']);
  const blksWrittenIdx = colIdx(['shared_blks_written']);
  const tempReadIdx = colIdx(['temp_blks_read']);
  const tempWrittenIdx = colIdx(['temp_blks_written']);
  const queryIdIdx = colIdx(['queryid', 'query_id']);

  const queries: PGStatQuery[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Skip separator lines
    if (/^[-+|=]+$/.test(lines[i].trim())) continue;

    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length < 3) continue;

    const get = (idx: number): string => idx >= 0 && idx < cols.length ? cols[idx] : '';

    const calls = parseNum(get(callsIdx));
    if (calls === 0 && !get(queryIdx)) continue;

    const blksHit = parseNum(get(blksHitIdx));
    const blksRead = parseNum(get(blksReadIdx));
    const totalBlks = blksHit + blksRead;

    queries.push({
      queryId: get(queryIdIdx) || `q${i}`,
      query: get(queryIdx).slice(0, 500),
      calls,
      totalTimeSec: parseNum(get(totalTimeIdx)) / 1000, // ms → sec
      meanTimeMs: parseNum(get(meanTimeIdx)),
      minTimeMs: parseNum(get(minTimeIdx)),
      maxTimeMs: parseNum(get(maxTimeIdx)),
      stddevTimeMs: parseNum(get(stddevIdx)),
      rows: parseNum(get(rowsIdx)),
      sharedBlksHit: blksHit,
      sharedBlksRead: blksRead,
      sharedBlksDirtied: parseNum(get(blksDirtiedIdx)),
      sharedBlksWritten: parseNum(get(blksWrittenIdx)),
      tempBlksRead: parseNum(get(tempReadIdx)),
      tempBlksWritten: parseNum(get(tempWrittenIdx)),
      cacheHitRatio: totalBlks > 0 ? Math.round((blksHit / totalBlks) * 10000) / 100 : 100,
    });
  }

  // Sort variants
  const byTotalTime = [...queries].sort((a, b) => b.totalTimeSec - a.totalTimeSec).slice(0, 10);
  const byMeanTime = [...queries].sort((a, b) => b.meanTimeMs - a.meanTimeMs).slice(0, 10);
  const byCalls = [...queries].sort((a, b) => b.calls - a.calls).slice(0, 10);
  const byTempBlks = [...queries].filter(q => q.tempBlksRead + q.tempBlksWritten > 0)
    .sort((a, b) => (b.tempBlksRead + b.tempBlksWritten) - (a.tempBlksRead + a.tempBlksWritten)).slice(0, 10);

  const totalCalls = queries.reduce((s, q) => s + q.calls, 0);
  const totalTime = queries.reduce((s, q) => s + q.totalTimeSec, 0);
  const totalHit = queries.reduce((s, q) => s + q.sharedBlksHit, 0);
  const totalRead = queries.reduce((s, q) => s + q.sharedBlksRead, 0);

  return {
    reportType: 'pg_stats',
    database: 'postgresql',
    totalQueries: queries.length,
    totalCalls,
    totalTimeSec: Math.round(totalTime * 100) / 100,
    topByTotalTime: byTotalTime,
    topByMeanTime: byMeanTime,
    topByCalls: byCalls,
    topByTempBlks: byTempBlks,
    statistics: {
      avgMeanTimeMs: queries.length > 0 ? Math.round(queries.reduce((s, q) => s + q.meanTimeMs, 0) / queries.length * 100) / 100 : 0,
      maxMeanTimeMs: queries.length > 0 ? Math.max(...queries.map(q => q.meanTimeMs)) : 0,
      totalSharedBlksHit: totalHit,
      totalSharedBlksRead: totalRead,
      overallCacheHitRatio: totalHit + totalRead > 0 ? Math.round((totalHit / (totalHit + totalRead)) * 10000) / 100 : 100,
      queriesOver100ms: queries.filter(q => q.meanTimeMs > 100).length,
      queriesOver1s: queries.filter(q => q.meanTimeMs > 1000).length,
      queriesUsingTempBlks: queries.filter(q => q.tempBlksRead + q.tempBlksWritten > 0).length,
    },
    sectionsFound: ['pg_stat_statements'],
    rawSections: {},
  };
}

function emptyPGStats(): PGStatsMetrics {
  return {
    reportType: 'pg_stats',
    database: 'postgresql',
    totalQueries: 0,
    totalCalls: 0,
    totalTimeSec: 0,
    topByTotalTime: [],
    topByMeanTime: [],
    topByCalls: [],
    topByTempBlks: [],
    statistics: {
      avgMeanTimeMs: 0,
      maxMeanTimeMs: 0,
      totalSharedBlksHit: 0,
      totalSharedBlksRead: 0,
      overallCacheHitRatio: 0,
      queriesOver100ms: 0,
      queriesOver1s: 0,
      queriesUsingTempBlks: 0,
    },
    sectionsFound: [],
    rawSections: {},
  };
}
