/**
 * Oracle AWR Report Parser
 * Extracts key performance sections from AWR HTML/TXT reports.
 * Reduces a 50–200 page report to ~3–8KB of structured metrics.
 */

export interface AWRLoadProfile {
  dbTimePerSec: number;
  cpuTimePerSec: number;
  logicalReadsPerSec: number;
  physicalReadsPerSec: number;
  hardParsesPerSec: number;
  parsesPerSec: number;
  transactionsPerSec: number;
  redoSizePerSec: number;
  blockChangesPerSec: number;
  userCallsPerSec: number;
}

export interface AWRWaitEvent {
  event: string;
  waits: number;
  timeSeconds: number;
  avgWaitMs: number;
  percentDbTime: number;
  waitClass: string;
}

export interface AWRTopSQL {
  sqlId: string;
  sqlText: string;
  elapsedTimeSec: number;
  cpuTimeSec: number;
  executions: number;
  avgElapsedMs: number;
  bufferGets: number;
  diskReads: number;
  rowsProcessed: number;
  percentDbTime: number;
}

export interface AWRInstanceEfficiency {
  bufferCacheHitRatio: number;
  libraryCacheHitRatio: number;
  softParseRatio: number;
  executeToParseRatio: number;
  inMemorySortRatio: number;
  latchHitRatio: number;
}

export interface AWRIOStat {
  tablespace: string;
  reads: number;
  avgReadMs: number;
  writes: number;
  avgWriteMs: number;
  readMBps: number;
  writeMBps: number;
}

export interface AWRMemory {
  sgaTotalMB: number;
  pgaAllocatedMB: number;
  bufferCacheMB: number;
  sharedPoolMB: number;
  largePoolMB: number;
  javaPoolMB: number;
}

export interface OracleAWRMetrics {
  reportType: 'awr';
  database: 'oracle';
  instanceName: string;
  dbName: string;
  dbVersion: string;
  hostName: string;
  timeRange: { start: string; end: string };
  elapsedMinutes: number;
  dbTimeMinutes: number;

  loadProfile: AWRLoadProfile | null;
  waitEvents: AWRWaitEvent[];
  topSQLByElapsed: AWRTopSQL[];
  topSQLByCPU: AWRTopSQL[];
  instanceEfficiency: AWRInstanceEfficiency | null;
  ioStats: AWRIOStat[];
  memory: AWRMemory | null;

  // Supplementary
  topSegmentsByLogicalReads: { segment: string; logicalReads: number; tablespace: string }[];
  topSegmentsByPhysicalReads: { segment: string; physicalReads: number; tablespace: string }[];

  rawSections: Record<string, string>;
  sectionsFound: string[];
}

// ── Number parsing helpers ──────────────────────────────────────────────────

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/,/g, '').trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parsePercent(s: string | undefined): number {
  if (!s) return 0;
  return parseNum(s.replace(/%/g, ''));
}

// ── Section extraction ──────────────────────────────────────────────────────

function extractSection(text: string, startPattern: RegExp, endPattern: RegExp): string {
  const startMatch = startPattern.exec(text);
  if (!startMatch) return '';
  const startIdx = startMatch.index;
  const afterStart = text.slice(startIdx);
  const endMatch = endPattern.exec(afterStart.slice(startMatch[0].length));
  if (!endMatch) return afterStart.slice(0, 5000); // Take up to 5KB if no end found
  return afterStart.slice(0, startMatch[0].length + endMatch.index);
}

// ── Strip HTML tags ─────────────────────────────────────────────────────────

function stripHTML(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<\/th>/gi, '\t')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, '\n');
}

// ── Main parser ─────────────────────────────────────────────────────────────

export function parseOracleAWR(content: string): OracleAWRMetrics {
  const isHTML = /<html|<table|<tr/i.test(content);
  const text = isHTML ? stripHTML(content) : content;
  const rawContent = content; // Keep original for raw section extraction

  const sectionsFound: string[] = [];
  const rawSections: Record<string, string> = {};

  // ── Instance Info ──
  let instanceName = '', dbName = '', dbVersion = '', hostName = '';
  const instMatch = text.match(/(?:Instance\s+Name|Inst\s+Name)\s*[:\t]\s*(\S+)/i);
  if (instMatch) instanceName = instMatch[1];
  const dbMatch = text.match(/(?:DB\s+Name|Database\s+Name)\s*[:\t]\s*(\S+)/i);
  if (dbMatch) dbName = dbMatch[1];
  const verMatch = text.match(/(?:Release|Version)\s*[:\t]\s*([\d.]+)/i);
  if (verMatch) dbVersion = verMatch[1];
  const hostMatch = text.match(/Host\s*(?:Name)?\s*[:\t]\s*(\S+)/i);
  if (hostMatch) hostName = hostMatch[1];

  // ── Time Range ──
  let startTime = '', endTime = '';
  const snapMatch = text.match(/(?:Begin\s+Snap|Snap\s+Begin)[:\s]*\d*\s*([\d\-\/: ]+)/i);
  if (snapMatch) startTime = snapMatch[1].trim();
  const snapEndMatch = text.match(/(?:End\s+Snap|Snap\s+End)[:\s]*\d*\s*([\d\-\/: ]+)/i);
  if (snapEndMatch) endTime = snapEndMatch[1].trim();

  let elapsedMinutes = 0;
  const elapsedMatch = text.match(/Elapsed[:\s]*([\d.,]+)\s*(?:\(mins\)|min)/i);
  if (elapsedMatch) elapsedMinutes = parseNum(elapsedMatch[1]);

  let dbTimeMinutes = 0;
  const dbTimeMatch = text.match(/DB\s*Time[:\s]*([\d.,]+)\s*(?:\(mins\)|min)/i);
  if (dbTimeMatch) dbTimeMinutes = parseNum(dbTimeMatch[1]);

  // ── Load Profile ──
  let loadProfile: AWRLoadProfile | null = null;
  const loadSection = extractSection(text, /Load\s*Profile/i, /(?:Instance\s+Efficiency|Top\s+\d|Wait\s+Events)/i);
  if (loadSection) {
    sectionsFound.push('Load Profile');
    rawSections['Load Profile'] = loadSection.slice(0, 2000);

    const extractMetric = (pattern: RegExp): number => {
      const m = loadSection.match(pattern);
      return m ? parseNum(m[1]) : 0;
    };

    loadProfile = {
      dbTimePerSec: extractMetric(/DB\s*Time\s*\(s\)\s*[:\t]\s*([\d.,]+)/i) || extractMetric(/DB\s*Time.*?Per\s*Second\s*[:\t]\s*([\d.,]+)/i),
      cpuTimePerSec: extractMetric(/CPU.*?per\s*Second\s*[:\t]?\s*([\d.,]+)/i) || extractMetric(/DB\s*CPU\s*\(s\)\s*[:\t]\s*([\d.,]+)/i),
      logicalReadsPerSec: extractMetric(/Logical\s*[Rr]eads.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
      physicalReadsPerSec: extractMetric(/Physical\s*[Rr]eads.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
      hardParsesPerSec: extractMetric(/Hard\s*[Pp]arses.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
      parsesPerSec: extractMetric(/Parses.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
      transactionsPerSec: extractMetric(/(?:User\s+)?Transactions.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
      redoSizePerSec: extractMetric(/Redo\s*[Ss]ize.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
      blockChangesPerSec: extractMetric(/Block\s*[Cc]hanges.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
      userCallsPerSec: extractMetric(/User\s*[Cc]alls.*?Per\s*Second\s*[:\t]?\s*([\d.,]+)/i),
    };
  }

  // ── Top Wait Events ──
  const waitEvents: AWRWaitEvent[] = [];
  const waitSection = extractSection(text, /Top\s+\d+\s+(?:Timed\s+)?(?:Foreground\s+)?Events/i, /(?:SQL\s+ordered|Host\s+CPU|Wait\s+Classes|Background)/i);
  if (waitSection) {
    sectionsFound.push('Top Wait Events');
    rawSections['Top Wait Events'] = waitSection.slice(0, 3000);

    const lines = waitSection.split('\n').filter(l => l.trim());
    for (const line of lines) {
      // Match lines with event data: event_name  waits  time  avg  %db  class
      const wm = line.match(/^(.{20,60}?)\s+([\d,]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d.]+)\s+(\w[\w ]*\w)\s*$/);
      if (wm) {
        waitEvents.push({
          event: wm[1].trim(),
          waits: parseNum(wm[2]),
          timeSeconds: parseNum(wm[3]),
          avgWaitMs: parseNum(wm[4]),
          percentDbTime: parseNum(wm[5]),
          waitClass: wm[6].trim(),
        });
      }
      // Simpler tab-delimited format
      const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 5 && !wm && /\d/.test(cols[1])) {
        waitEvents.push({
          event: cols[0],
          waits: parseNum(cols[1]),
          timeSeconds: parseNum(cols[2]),
          avgWaitMs: parseNum(cols[3]),
          percentDbTime: parseNum(cols[4]),
          waitClass: cols[5] || 'Other',
        });
      }
    }
  }

  // ── Top SQL by Elapsed Time ──
  const topSQLByElapsed: AWRTopSQL[] = [];
  const sqlElapsedSection = extractSection(text, /SQL\s+ordered\s+by\s+Elapsed\s+Time/i, /(?:SQL\s+ordered\s+by\s+CPU|SQL\s+ordered\s+by\s+Gets|End\s+of\s+Report)/i);
  if (sqlElapsedSection) {
    sectionsFound.push('SQL ordered by Elapsed Time');
    rawSections['SQL ordered by Elapsed Time'] = sqlElapsedSection.slice(0, 4000);
    parseTopSQL(sqlElapsedSection, topSQLByElapsed);
  }

  // ── Top SQL by CPU Time ──
  const topSQLByCPU: AWRTopSQL[] = [];
  const sqlCPUSection = extractSection(text, /SQL\s+ordered\s+by\s+CPU\s+Time/i, /(?:SQL\s+ordered\s+by\s+(?!CPU)|End\s+of\s+Report)/i);
  if (sqlCPUSection) {
    sectionsFound.push('SQL ordered by CPU Time');
    rawSections['SQL ordered by CPU Time'] = sqlCPUSection.slice(0, 4000);
    parseTopSQL(sqlCPUSection, topSQLByCPU);
  }

  // ── Instance Efficiency ──
  let instanceEfficiency: AWRInstanceEfficiency | null = null;
  const effSection = extractSection(text, /Instance\s+Efficiency/i, /(?:Top\s+\d|Shared\s+Pool|Wait)/i);
  if (effSection) {
    sectionsFound.push('Instance Efficiency');
    rawSections['Instance Efficiency'] = effSection.slice(0, 1500);

    const extractEff = (pattern: RegExp): number => {
      const m = effSection.match(pattern);
      return m ? parsePercent(m[1]) : 0;
    };

    instanceEfficiency = {
      bufferCacheHitRatio: extractEff(/Buffer.*?Hit\s*[:\t%]\s*([\d.]+)/i),
      libraryCacheHitRatio: extractEff(/Library.*?Hit\s*[:\t%]\s*([\d.]+)/i),
      softParseRatio: extractEff(/Soft\s*Parse\s*[:\t%]\s*([\d.]+)/i),
      executeToParseRatio: extractEff(/Execute\s*to\s*Parse\s*[:\t%]\s*([\d.]+)/i),
      inMemorySortRatio: extractEff(/In-memory\s*Sort\s*[:\t%]\s*([\d.]+)/i),
      latchHitRatio: extractEff(/Latch\s*Hit\s*[:\t%]\s*([\d.]+)/i),
    };
  }

  // ── I/O Statistics ──
  const ioStats: AWRIOStat[] = [];
  const ioSection = extractSection(text, /(?:Tablespace\s+IO|IO\s+Stat)/i, /(?:Buffer\s+Pool|Advisory|Memory)/i);
  if (ioSection) {
    sectionsFound.push('I/O Statistics');
    rawSections['I/O Statistics'] = ioSection.slice(0, 3000);

    const lines = ioSection.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const cols = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4 && !/tablespace|name/i.test(cols[0]) && /\d/.test(cols[1])) {
        ioStats.push({
          tablespace: cols[0],
          reads: parseNum(cols[1]),
          avgReadMs: parseNum(cols[2]),
          writes: parseNum(cols[3]),
          avgWriteMs: parseNum(cols[4]),
          readMBps: parseNum(cols[5]),
          writeMBps: parseNum(cols[6]),
        });
      }
    }
  }

  // ── Memory Statistics ──
  let memory: AWRMemory | null = null;
  const memSection = extractSection(text, /(?:SGA\s+(?:Memory|Summary|Target)|Memory\s+Statistics)/i, /(?:SQL\s+ordered|Wait|Top\s+\d|Latch)/i);
  if (memSection) {
    sectionsFound.push('Memory Statistics');
    rawSections['Memory Statistics'] = memSection.slice(0, 1500);

    const extractMem = (pattern: RegExp): number => {
      const m = memSection.match(pattern);
      if (!m) return 0;
      let val = parseNum(m[1]);
      // Convert to MB if in bytes or KB
      if (val > 1_000_000_000) val = val / (1024 * 1024);
      else if (val > 1_000_000) val = val / 1024;
      return Math.round(val);
    };

    memory = {
      sgaTotalMB: extractMem(/SGA\s+(?:Total|Size|Target)\s*[:\t]\s*([\d.,]+)/i),
      pgaAllocatedMB: extractMem(/PGA.*?(?:Alloc|Target)\s*[:\t]\s*([\d.,]+)/i),
      bufferCacheMB: extractMem(/Buffer\s+Cache\s*[:\t]\s*([\d.,]+)/i),
      sharedPoolMB: extractMem(/Shared\s+Pool\s*(?:Size)?\s*[:\t]\s*([\d.,]+)/i),
      largePoolMB: extractMem(/Large\s+Pool\s*[:\t]\s*([\d.,]+)/i),
      javaPoolMB: extractMem(/Java\s+Pool\s*[:\t]\s*([\d.,]+)/i),
    };
  }

  // ── Top Segments ──
  const topSegmentsByLogicalReads: { segment: string; logicalReads: number; tablespace: string }[] = [];
  const topSegmentsByPhysicalReads: { segment: string; physicalReads: number; tablespace: string }[] = [];

  const segLogSection = extractSection(text, /Segments\s+by\s+Logical\s+Reads/i, /(?:Segments\s+by\s+Physical|SQL\s+ordered|End)/i);
  if (segLogSection) {
    sectionsFound.push('Segments by Logical Reads');
    const lines = segLogSection.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const cols = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3 && /\d/.test(cols[cols.length - 1]) && !/segment|owner|tablespace/i.test(cols[0])) {
        topSegmentsByLogicalReads.push({
          tablespace: cols[0],
          segment: cols.length > 3 ? `${cols[1]}.${cols[2]}` : cols[1],
          logicalReads: parseNum(cols[cols.length - 1]),
        });
      }
    }
  }

  return {
    reportType: 'awr',
    database: 'oracle',
    instanceName,
    dbName,
    dbVersion,
    hostName,
    timeRange: { start: startTime, end: endTime },
    elapsedMinutes,
    dbTimeMinutes,
    loadProfile,
    waitEvents: waitEvents.slice(0, 15),
    topSQLByElapsed: topSQLByElapsed.slice(0, 10),
    topSQLByCPU: topSQLByCPU.slice(0, 10),
    instanceEfficiency,
    ioStats: ioStats.slice(0, 10),
    memory,
    topSegmentsByLogicalReads: topSegmentsByLogicalReads.slice(0, 10),
    topSegmentsByPhysicalReads: topSegmentsByPhysicalReads.slice(0, 10),
    rawSections,
    sectionsFound,
  };
}

// ── SQL section parser ──────────────────────────────────────────────────────

function parseTopSQL(section: string, results: AWRTopSQL[]): void {
  const lines = section.split('\n').filter(l => l.trim());

  for (let i = 0; i < lines.length && results.length < 10; i++) {
    const line = lines[i];
    // Try to match SQL summary lines (elapsed, cpu, exec, gets, reads, rows, sql_id)
    const sqlMatch = line.match(/([\d,.]+)\s+([\d,.]+)\s+([\d,]+)\s+([\d,.]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\w{10,13})/);
    if (sqlMatch) {
      // Look ahead for SQL text
      let sqlText = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !/^[\d,.]+\s/.test(nextLine) && !/^-+$/.test(nextLine) && !/^\s*(Elapsed|CPU|Exec|Buffer|Disk|Rows)/i.test(nextLine)) {
          sqlText = nextLine.slice(0, 200);
          break;
        }
      }

      const elapsed = parseNum(sqlMatch[1]);
      const executions = parseNum(sqlMatch[3]);
      results.push({
        sqlId: sqlMatch[8],
        sqlText,
        elapsedTimeSec: elapsed,
        cpuTimeSec: parseNum(sqlMatch[2]),
        executions,
        avgElapsedMs: executions > 0 ? (elapsed / executions) * 1000 : 0,
        bufferGets: parseNum(sqlMatch[5]),
        diskReads: parseNum(sqlMatch[6]),
        rowsProcessed: parseNum(sqlMatch[7]),
        percentDbTime: parseNum(sqlMatch[4]),
      });
    }

    // Tab-delimited format
    const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 6 && /\d/.test(cols[0]) && /\w{10,13}/.test(cols[cols.length - 1]) && !sqlMatch) {
      const elapsed = parseNum(cols[0]);
      const executions = parseNum(cols[2]);
      results.push({
        sqlId: cols[cols.length - 1],
        sqlText: '',
        elapsedTimeSec: elapsed,
        cpuTimeSec: parseNum(cols[1]),
        executions,
        avgElapsedMs: executions > 0 ? (elapsed / executions) * 1000 : 0,
        bufferGets: parseNum(cols[3]),
        diskReads: parseNum(cols[4]),
        rowsProcessed: parseNum(cols[5]),
        percentDbTime: parseNum(cols[6]),
      });
    }
  }
}
