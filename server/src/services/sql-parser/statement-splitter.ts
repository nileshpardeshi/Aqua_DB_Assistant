// ---------------------------------------------------------------------------
// Statement Splitter – State-machine based SQL statement splitter
// ---------------------------------------------------------------------------

import type { ParsedStatement, SQLDialect } from './parser.interface.js';

/**
 * State machine states while scanning through SQL text.
 */
const enum ScanState {
  /** Normal SQL code */
  Normal,
  /** Inside a single-quoted string literal */
  SingleQuote,
  /** Inside a double-quoted identifier / string */
  DoubleQuote,
  /** Inside a single-line comment (--) */
  LineComment,
  /** Inside a block comment */
  BlockComment,
  /** Inside a PostgreSQL dollar-quoted string $tag$...$tag$ */
  DollarQuote,
  /** Inside a backtick-quoted identifier (MySQL) */
  BacktickQuote,
  /** Inside a bracket-quoted identifier [name] (SQL Server) */
  BracketQuote,
}

/**
 * Split a SQL string into individual statements.
 *
 * Handles:
 *  - Semicolons as statement terminators
 *  - Single-quoted string literals (with '' escape)
 *  - Double-quoted identifiers
 *  - Backtick identifiers (MySQL)
 *  - Bracket identifiers [name] (SQL Server)
 *  - Single-line comments (--)
 *  - Block comments (/* ... *​/)
 *  - Dollar-quoted strings $tag$...$tag$ (PostgreSQL)
 *  - GO batch separator (SQL Server)
 *
 * @param sql     Full SQL text
 * @param dialect Detected or user-supplied dialect
 * @returns Array of parsed statements with line tracking
 */
export function splitStatements(
  sql: string,
  dialect: SQLDialect,
): ParsedStatement[] {
  const results: ParsedStatement[] = [];
  const len = sql.length;

  let state: ScanState = ScanState.Normal;
  let statementStart = 0;        // char index where current statement started
  let lineStart = 1;             // 1-based line number of current statement start
  let currentLine = 1;           // current line counter
  let dollarTag = '';            // current $tag$ for PG dollar-quoting
  let dollarTagBuffer = '';      // buffer while reading a potential $tag$
  let inDollarTagRead = false;   // true while we're scanning characters inside $...$

  const usesGO = dialect === 'sqlserver';

  for (let i = 0; i < len; i++) {
    const ch = sql[i];
    const next = i + 1 < len ? sql[i + 1] : '';

    // Track line numbers
    if (ch === '\n') {
      currentLine++;
    }

    switch (state) {
      // ── Normal SQL code ──────────────────────────────────────────────
      case ScanState.Normal: {
        // Semicolon → statement boundary
        if (ch === ';') {
          emitStatement(sql, statementStart, i, lineStart, currentLine, results);
          statementStart = i + 1;
          lineStart = currentLine;
          break;
        }

        // Single-line comment
        if (ch === '-' && next === '-') {
          state = ScanState.LineComment;
          i++; // skip second '-'
          break;
        }

        // Block comment
        if (ch === '/' && next === '*') {
          state = ScanState.BlockComment;
          i++; // skip '*'
          break;
        }

        // Single-quoted string
        if (ch === "'") {
          state = ScanState.SingleQuote;
          break;
        }

        // Double-quoted identifier
        if (ch === '"') {
          state = ScanState.DoubleQuote;
          break;
        }

        // Backtick-quoted identifier (MySQL / BigQuery)
        if (ch === '`') {
          state = ScanState.BacktickQuote;
          break;
        }

        // Bracket-quoted identifier (SQL Server)
        if (ch === '[') {
          state = ScanState.BracketQuote;
          break;
        }

        // Dollar-quoting (PostgreSQL): $$ or $tag$
        if (ch === '$' && (dialect === 'postgresql' || dialect === 'mariadb')) {
          const tagResult = readDollarTag(sql, i);
          if (tagResult) {
            dollarTag = tagResult.tag;
            i = tagResult.endIndex; // skip past the opening $tag$
            state = ScanState.DollarQuote;
          }
          break;
        }

        // GO batch separator for SQL Server (must be on its own line)
        if (usesGO && isGOSeparator(sql, i, len)) {
          emitStatement(sql, statementStart, i - 1, lineStart, currentLine, results);
          // skip "GO" + optional whitespace to end of line
          i = skipToEndOfLine(sql, i + 2, len);
          statementStart = i + 1;
          lineStart = currentLine + 1;
          break;
        }

        break;
      }

      // ── Inside single-quoted string ──────────────────────────────────
      case ScanState.SingleQuote: {
        if (ch === "'" && next === "'") {
          i++; // escaped single quote
        } else if (ch === "'") {
          state = ScanState.Normal;
        }
        // Backslash escape for MySQL
        if (ch === '\\' && (dialect === 'mysql' || dialect === 'mariadb')) {
          i++; // skip escaped character
        }
        break;
      }

      // ── Inside double-quoted identifier ──────────────────────────────
      case ScanState.DoubleQuote: {
        if (ch === '"' && next === '"') {
          i++; // escaped double quote
        } else if (ch === '"') {
          state = ScanState.Normal;
        }
        break;
      }

      // ── Inside backtick-quoted identifier ─────────────────────────────
      case ScanState.BacktickQuote: {
        if (ch === '`') {
          state = ScanState.Normal;
        }
        break;
      }

      // ── Inside bracket-quoted identifier ──────────────────────────────
      case ScanState.BracketQuote: {
        if (ch === ']') {
          state = ScanState.Normal;
        }
        break;
      }

      // ── Inside single-line comment ────────────────────────────────────
      case ScanState.LineComment: {
        if (ch === '\n') {
          state = ScanState.Normal;
        }
        break;
      }

      // ── Inside block comment ──────────────────────────────────────────
      case ScanState.BlockComment: {
        if (ch === '*' && next === '/') {
          i++; // skip '/'
          state = ScanState.Normal;
        }
        break;
      }

      // ── Inside dollar-quoted string ───────────────────────────────────
      case ScanState.DollarQuote: {
        // Look for matching closing $tag$
        if (ch === '$') {
          const closeResult = readDollarTag(sql, i);
          if (closeResult && closeResult.tag === dollarTag) {
            i = closeResult.endIndex;
            state = ScanState.Normal;
            dollarTag = '';
          }
        }
        break;
      }
    }
  }

  // Emit any remaining text as the last statement
  if (statementStart < len) {
    emitStatement(sql, statementStart, len - 1, lineStart, currentLine, results);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to read a dollar-tag starting at position `pos`.
 * A dollar tag is $<identifier>$ or just $$.
 * Returns the tag string (between the dollars) and the index of the last '$'.
 */
function readDollarTag(
  sql: string,
  pos: number,
): { tag: string; endIndex: number } | null {
  if (sql[pos] !== '$') return null;

  let i = pos + 1;
  const len = sql.length;

  // Immediate $$ (empty tag)
  if (i < len && sql[i] === '$') {
    return { tag: '', endIndex: i };
  }

  // Read identifier characters
  let tag = '';
  while (i < len && /[\w]/.test(sql[i])) {
    tag += sql[i];
    i++;
  }

  // Must close with $
  if (i < len && sql[i] === '$' && tag.length > 0) {
    return { tag, endIndex: i };
  }

  return null;
}

/**
 * Check if position `pos` is the start of a "GO" batch separator.
 * GO must appear at the start of a line (only whitespace before it on the line),
 * followed by end of line or end of string.
 */
function isGOSeparator(sql: string, pos: number, len: number): boolean {
  // Check that we have "GO" (case-insensitive)
  if (pos + 1 >= len) return false;
  const two = sql.substring(pos, pos + 2).toUpperCase();
  if (two !== 'GO') return false;

  // Next character must be whitespace, newline, or end of string
  const afterGO = pos + 2 < len ? sql[pos + 2] : '\n';
  if (!/[\s;]/.test(afterGO) && pos + 2 < len) return false;

  // Check that GO is at the start of its line (only whitespace before)
  let j = pos - 1;
  while (j >= 0 && sql[j] !== '\n' && /\s/.test(sql[j])) {
    j--;
  }
  return j < 0 || sql[j] === '\n';
}

/**
 * Skip forward to the end of the current line.
 */
function skipToEndOfLine(sql: string, pos: number, len: number): number {
  while (pos < len && sql[pos] !== '\n') {
    pos++;
  }
  return pos;
}

/**
 * Emit a statement if the trimmed text is non-empty.
 */
function emitStatement(
  sql: string,
  startIdx: number,
  endIdx: number,
  lineStart: number,
  lineEnd: number,
  results: ParsedStatement[],
): void {
  const raw = sql.substring(startIdx, endIdx + 1).trim();
  if (raw.length === 0) return;

  // Skip pure comment-only blocks
  if (isOnlyComments(raw)) return;

  const type = detectStatementType(raw);

  // Recalculate accurate lineStart (first non-blank line)
  let adjustedLineStart = lineStart;
  const prefix = sql.substring(startIdx, startIdx + raw.indexOf(raw.trimStart().charAt(0)));
  const prefixLines = prefix.split('\n').length - 1;
  adjustedLineStart = lineStart + prefixLines;

  results.push({
    type,
    raw,
    lineStart: adjustedLineStart,
    lineEnd,
  });
}

/**
 * Detect the high-level type of a SQL statement from its first keywords.
 */
function detectStatementType(raw: string): string {
  // Strip leading comments to get to the actual keyword
  const stripped = raw
    .replace(/^(\s*--[^\n]*\n)*/g, '')
    .replace(/^(\s*\/\*[\s\S]*?\*\/\s*)*/g, '')
    .trim();

  const upper = stripped.toUpperCase();

  if (upper.startsWith('CREATE')) {
    if (/^CREATE\s+(OR\s+REPLACE\s+)?TABLE/i.test(stripped)) return 'CREATE TABLE';
    if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(stripped)) return 'CREATE INDEX';
    if (/^CREATE\s+(OR\s+REPLACE\s+)?(MATERIALIZED\s+)?VIEW/i.test(stripped)) return 'CREATE VIEW';
    if (/^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i.test(stripped)) return 'CREATE FUNCTION';
    if (/^CREATE\s+(OR\s+REPLACE\s+)?PROCEDURE/i.test(stripped)) return 'CREATE PROCEDURE';
    if (/^CREATE\s+(OR\s+REPLACE\s+)?TRIGGER/i.test(stripped)) return 'CREATE TRIGGER';
    if (/^CREATE\s+SCHEMA/i.test(stripped)) return 'CREATE SCHEMA';
    if (/^CREATE\s+DATABASE/i.test(stripped)) return 'CREATE DATABASE';
    if (/^CREATE\s+TYPE/i.test(stripped)) return 'CREATE TYPE';
    if (/^CREATE\s+EXTENSION/i.test(stripped)) return 'CREATE EXTENSION';
    if (/^CREATE\s+SEQUENCE/i.test(stripped)) return 'CREATE SEQUENCE';
    return 'CREATE OTHER';
  }

  if (upper.startsWith('ALTER')) {
    if (/^ALTER\s+TABLE/i.test(stripped)) return 'ALTER TABLE';
    return 'ALTER OTHER';
  }

  if (upper.startsWith('DROP')) return 'DROP';
  if (upper.startsWith('INSERT')) return 'INSERT';
  if (upper.startsWith('UPDATE')) return 'UPDATE';
  if (upper.startsWith('DELETE')) return 'DELETE';
  if (upper.startsWith('SELECT')) return 'SELECT';
  if (upper.startsWith('GRANT')) return 'GRANT';
  if (upper.startsWith('REVOKE')) return 'REVOKE';
  if (upper.startsWith('COMMENT')) return 'COMMENT';
  if (upper.startsWith('SET')) return 'SET';
  if (upper.startsWith('USE')) return 'USE';
  if (upper.startsWith('BEGIN')) return 'BEGIN';
  if (upper.startsWith('COMMIT')) return 'COMMIT';
  if (upper.startsWith('ROLLBACK')) return 'ROLLBACK';

  return 'OTHER';
}

/**
 * Check if a string consists entirely of SQL comments (no executable code).
 */
function isOnlyComments(text: string): boolean {
  const stripped = text
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  return stripped.length === 0;
}
