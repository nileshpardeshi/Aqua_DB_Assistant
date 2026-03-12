// ---------------------------------------------------------------------------
// SQL Parser Service – Orchestrates the full parsing pipeline
// ---------------------------------------------------------------------------

import { detectDialect } from './dialect-detector.js';
import { splitStatements } from './statement-splitter.js';
import { extractFromStatements } from './schema-extractor.js';
import { resolveRelationships } from './relationship-resolver.js';
import type {
  SQLDialect,
  SQLParseResult,
  ParseStatistics,
  ParseError,
  ParsedRelationship,
} from './parser.interface.js';

// Re-export interfaces for consumers
export type {
  SQLDialect,
  SQLParseResult,
  ParsedTable,
  ParsedColumn,
  ParsedIndex,
  ParsedConstraint,
  ParsedRelationship,
  ParsedStatement,
  ParseError,
  ParseStatistics,
  ParseErrorSeverity,
} from './parser.interface.js';

/**
 * SQLParserService – stateless service that orchestrates the full SQL
 * parsing pipeline:
 *
 *   1. Detect dialect
 *   2. Split into individual statements
 *   3. Extract schema objects (tables, columns, indexes, constraints)
 *   4. Resolve relationships (explicit + inferred)
 *   5. Return a unified `SQLParseResult`
 *
 * The service is **fault-tolerant**: a single malformed statement does not
 * abort the entire parse. Errors are collected and returned alongside
 * the successfully parsed objects.
 */
export class SQLParserService {
  /**
   * Parse a SQL string and return structured schema information.
   *
   * @param sql      The SQL text to parse (may contain multiple statements)
   * @param dialect  Optional dialect hint. If omitted, dialect is auto-detected.
   * @returns A complete parse result including tables, relationships, and errors
   */
  parseSQL(sql: string, dialect?: string): SQLParseResult {
    const startTime = Date.now();
    const errors: ParseError[] = [];

    // ── Step 1: Detect dialect ──────────────────────────────────────────
    let detectedDialect: SQLDialect;
    try {
      detectedDialect = detectDialect(sql, dialect);
    } catch (err: any) {
      // If detection itself fails, default to PostgreSQL
      detectedDialect = 'postgresql';
      errors.push({
        line: 0,
        message: `Dialect detection failed, defaulting to postgresql: ${err.message}`,
        statement: '',
        severity: 'warning',
      });
    }

    // ── Step 2: Split into statements ───────────────────────────────────
    let statements;
    try {
      statements = splitStatements(sql, detectedDialect);
    } catch (err: any) {
      // If the splitter fails entirely, wrap the whole thing as one statement
      errors.push({
        line: 0,
        message: `Statement splitting failed: ${err.message}`,
        statement: '',
        severity: 'warning',
      });
      statements = [
        {
          type: 'UNKNOWN',
          raw: sql,
          lineStart: 1,
          lineEnd: sql.split('\n').length,
        },
      ];
    }

    // ── Step 3: Extract schema from statements ──────────────────────────
    const extraction = extractFromStatements(statements, detectedDialect);
    errors.push(...extraction.errors);

    // ── Step 4: Resolve relationships ───────────────────────────────────
    let relationships: ParsedRelationship[];
    try {
      relationships = resolveRelationships(extraction.tables, detectedDialect);
    } catch (err: any) {
      relationships = [];
      errors.push({
        line: 0,
        message: `Relationship resolution failed: ${err.message}`,
        statement: '',
        severity: 'warning',
      });
    }

    // ── Step 5: Compute statistics ──────────────────────────────────────
    const parseTimeMs = Date.now() - startTime;

    const statistics: ParseStatistics = {
      totalStatements: statements.length,
      createTableStatements: statements.filter((s) => s.type === 'CREATE TABLE').length,
      createIndexStatements: statements.filter((s) => s.type === 'CREATE INDEX').length,
      alterTableStatements: statements.filter((s) => s.type === 'ALTER TABLE').length,
      otherStatements: statements.filter(
        (s) =>
          s.type !== 'CREATE TABLE' &&
          s.type !== 'CREATE INDEX' &&
          s.type !== 'ALTER TABLE',
      ).length,
      parseTimeMs,
    };

    return {
      dialect: detectedDialect,
      tables: extraction.tables,
      relationships,
      errors,
      statistics,
    };
  }
}

/** Singleton instance for convenience */
export const sqlParserService = new SQLParserService();
