import fs from 'node:fs';
import { parse } from 'csv-parse';
import { logger } from '../config/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CSVAnalysis {
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  detectedDelimiter: string;
  fileSizeBytes: number;
}

// ── Delimiter Detection ──────────────────────────────────────────────────────

const DELIMITERS = [',', '\t', '|', ';'] as const;

export function detectDelimiter(sample: string): string {
  const lines = sample.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ',';

  // Count occurrences of each delimiter per line
  const counts: Record<string, number[]> = {};
  for (const d of DELIMITERS) {
    counts[d] = lines.map((line) => {
      let count = 0;
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === d && !inQuotes) count++;
      }
      return count;
    });
  }

  // Pick delimiter with highest consistent count across lines
  let bestDelimiter = ',';
  let bestScore = 0;

  for (const d of DELIMITERS) {
    const perLine = counts[d];
    const nonZero = perLine.filter((c) => c > 0);
    if (nonZero.length === 0) continue;

    // Consistency: all lines should have similar count
    const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    const variance =
      nonZero.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) /
      nonZero.length;
    const consistency = avg > 0 ? avg / (1 + Math.sqrt(variance)) : 0;
    const coverage = nonZero.length / lines.length;
    const score = consistency * coverage * avg;

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = d;
    }
  }

  return bestDelimiter;
}

// ── Analyze CSV ──────────────────────────────────────────────────────────────

export async function analyzeCSV(filePath: string): Promise<CSVAnalysis> {
  const stat = fs.statSync(filePath);

  // Read first 4KB for delimiter detection
  const fd = fs.openSync(filePath, 'r');
  const sampleBuffer = Buffer.alloc(Math.min(4096, stat.size));
  fs.readSync(fd, sampleBuffer, 0, sampleBuffer.length, 0);
  fs.closeSync(fd);

  const sampleText = sampleBuffer.toString('utf-8');
  const delimiter = detectDelimiter(sampleText);

  // Parse headers and sample rows
  const headers: string[] = [];
  const sampleRows: Record<string, string>[] = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    const parser = fs
      .createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(
        parse({
          columns: true,
          delimiter,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }),
      );

    parser.on('data', (row: Record<string, string>) => {
      if (rowCount === 0) {
        headers.push(...Object.keys(row));
      }
      if (rowCount < 5) {
        sampleRows.push(row);
      }
      rowCount++;
    });

    parser.on('end', () => {
      resolve({
        headers,
        rowCount,
        sampleRows,
        detectedDelimiter: delimiter,
        fileSizeBytes: stat.size,
      });
    });

    parser.on('error', (err) => {
      logger.error(`CSV analysis failed: ${err.message}`);
      reject(err);
    });
  });
}

// ── Create CSV Read Stream ───────────────────────────────────────────────────

export function createCSVReadStream(
  filePath: string,
  opts?: { delimiter?: string },
): NodeJS.ReadableStream {
  const delimiter = opts?.delimiter || ',';

  return fs.createReadStream(filePath, { encoding: 'utf-8' }).pipe(
    parse({
      columns: true,
      delimiter,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }),
  );
}

// ── Count CSV Rows ───────────────────────────────────────────────────────────

export async function countCSVRows(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;

    const parser = fs
      .createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(
        parse({
          columns: true,
          delimiter: detectDelimiterFromFile(filePath),
          skip_empty_lines: true,
          relax_column_count: true,
        }),
      );

    parser.on('data', () => {
      count++;
    });

    parser.on('end', () => resolve(count));
    parser.on('error', reject);
  });
}

// ── Helper: detect delimiter from file ───────────────────────────────────────

function detectDelimiterFromFile(filePath: string): string {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(Math.min(4096, fs.statSync(filePath).size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return detectDelimiter(buf.toString('utf-8'));
  } catch {
    return ',';
  }
}
