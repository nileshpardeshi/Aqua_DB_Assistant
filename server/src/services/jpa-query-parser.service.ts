/**
 * JPA Query Parser — extracts JPQL/HQL/native queries from Java source files.
 *
 * Detects:
 *  - @Query("...") annotations (Spring Data JPA)
 *  - em.createQuery("...") / em.createNamedQuery("...") calls (EntityManager)
 *  - @NamedQuery(query = "...") annotations
 *  - Criteria API patterns (flagged but not extractable as JPQL)
 *  - Multi-line string concatenation with +
 */

import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { logger } from '../config/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedJPAQuery {
  id: string;
  query: string;
  type: 'jpql' | 'hql' | 'native' | 'criteria';
  methodName: string;
  className: string;
  fileName: string;
  lineNumber: number;
  annotations: string[];
  hasNPlusOne: boolean;
  hasFetchJoin: boolean;
  hasAggregation: boolean;
  hasSubquery: boolean;
  hasPagination: boolean;
  complexity: 'simple' | 'moderate' | 'complex' | 'critical';
}

export interface JPAParseResult {
  fileName: string;
  className: string;
  packageName: string;
  queries: ExtractedJPAQuery[];
  entityImports: string[];
  sourcePreview: string;
}

// ── Regex Patterns ───────────────────────────────────────────────────────────

// Match @Query("...") — handles multi-line with string concatenation
const QUERY_ANNOTATION_RE =
  /@Query\s*\(\s*(?:value\s*=\s*)?("(?:[^"\\]|\\.)*"(?:\s*\+\s*"(?:[^"\\]|\\.)*")*)\s*(?:,\s*nativeQuery\s*=\s*(true|false))?\s*\)/gs;

// Match em.createQuery("...") and em.createNamedQuery("...")
const EM_CREATE_QUERY_RE =
  /em\.create(?:Named)?Query\s*\(\s*\n?\s*("(?:[^"\\]|\\.)*"(?:\s*\+\s*\n?\s*"(?:[^"\\]|\\.)*")*)/gs;

// Match @NamedQuery annotations
const NAMED_QUERY_RE =
  /@NamedQuery\s*\(\s*(?:name\s*=\s*"[^"]*"\s*,\s*)?query\s*=\s*("(?:[^"\\]|\\.)*"(?:\s*\+\s*"(?:[^"\\]|\\.)*")*)/gs;

// Match method declarations (for associating queries with method names)
// Supports interface methods (no access modifier) and class methods (with modifier)
const METHOD_RE =
  /(?:(?:public|private|protected)\s+)?(?:(?:static|default|abstract)\s+)?[\w<>\[\],\s]+\s+(\w+)\s*\(/g;

// Criteria API detection
const CRITERIA_RE = /CriteriaBuilder|CriteriaQuery|cb\.createQuery|cq\.from/;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanConcatenatedString(raw: string): string {
  // Remove string concatenation: "foo" + "bar" → "foobar"
  return raw
    .replace(/"\s*\+\s*\n?\s*"/g, '')
    .replace(/^"/, '')
    .replace(/"$/, '')
    .replace(/\\"/g, '"')
    .trim();
}

function getLineNumber(source: string, charIndex: number): number {
  return source.substring(0, charIndex).split('\n').length;
}

function assessComplexity(query: string): ExtractedJPAQuery['complexity'] {
  let score = 0;
  const upper = query.toUpperCase();

  if (/\bJOIN\b/i.test(query)) score += 1;
  if (/\bLEFT\s+JOIN\b/i.test(query)) score += 1;
  if (/\bSUBSELECT\b|\bIN\s*\(\s*SELECT\b/i.test(query)) score += 2;
  if (/\bGROUP\s+BY\b/i.test(query)) score += 1;
  if (/\bHAVING\b/i.test(query)) score += 1;
  if (/\bFUNCTION\s*\(/i.test(query)) score += 1;
  if (/\bCASE\s+WHEN\b/i.test(query)) score += 1;
  if ((upper.match(/\bJOIN\b/g) || []).length >= 3) score += 2;
  if (/\bAVG\b.*\bSELECT\b/i.test(query)) score += 2; // correlated subquery

  if (score <= 1) return 'simple';
  if (score <= 3) return 'moderate';
  if (score <= 5) return 'complex';
  return 'critical';
}

function detectQueryTraits(query: string) {
  const upper = query.toUpperCase();
  return {
    hasNPlusOne:
      !upper.includes('JOIN FETCH') &&
      !upper.includes('ENTITY_GRAPH') &&
      /\bFROM\s+\w+\s+\w+\s+WHERE\b/i.test(query) &&
      !upper.includes('JOIN'),
    hasFetchJoin: upper.includes('JOIN FETCH'),
    hasAggregation: /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(query),
    hasSubquery: /\bIN\s*\(\s*SELECT\b/i.test(query) || /\(\s*SELECT\b/i.test(query),
    hasPagination:
      upper.includes('LIMIT') ||
      upper.includes('SETMAXRESULTS') ||
      upper.includes('SETFIRSTRESULT'),
  };
}

// ── Core Parser ──────────────────────────────────────────────────────────────

export function parseJavaSource(source: string, fileName: string): JPAParseResult {
  const queries: ExtractedJPAQuery[] = [];
  let queryCounter = 0;

  // Extract class name and package
  const pkgMatch = source.match(/^package\s+([\w.]+);/m);
  const classMatch = source.match(/(?:public\s+)?(?:interface|class)\s+(\w+)/m);
  const packageName = pkgMatch?.[1] ?? '';
  const className = classMatch?.[1] ?? basename(fileName, '.java');

  // Extract entity imports
  const entityImports = Array.from(
    source.matchAll(/import\s+([\w.]+\.entity\.(\w+));/g),
  ).map((m) => m[2]);

  // Preview (first 500 chars)
  const sourcePreview = source.substring(0, 500);

  // Find method names with line numbers for association
  const methods: { name: string; line: number }[] = [];
  let mMatch: RegExpExecArray | null;
  METHOD_RE.lastIndex = 0;
  while ((mMatch = METHOD_RE.exec(source)) !== null) {
    methods.push({
      name: mMatch[1],
      line: getLineNumber(source, mMatch.index),
    });
  }

  function findMethodForLine(line: number): string {
    let best = 'unknown';
    for (const m of methods) {
      if (m.line <= line) best = m.name;
      else break;
    }
    return best;
  }

  // ── 1. @Query annotations ──────────────────────────────────────────────
  QUERY_ANNOTATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = QUERY_ANNOTATION_RE.exec(source)) !== null) {
    const rawQuery = cleanConcatenatedString(match[1]);
    const isNative = match[2] === 'true';
    const line = getLineNumber(source, match.index);
    const traits = detectQueryTraits(rawQuery);

    queries.push({
      id: `${className}_q${++queryCounter}`,
      query: rawQuery,
      type: isNative ? 'native' : 'jpql',
      methodName: findMethodForLine(line),
      className,
      fileName,
      lineNumber: line,
      annotations: ['@Query'],
      ...traits,
      complexity: assessComplexity(rawQuery),
    });
  }

  // ── 2. EntityManager createQuery ───────────────────────────────────────
  EM_CREATE_QUERY_RE.lastIndex = 0;
  while ((match = EM_CREATE_QUERY_RE.exec(source)) !== null) {
    const rawQuery = cleanConcatenatedString(match[1]);
    const line = getLineNumber(source, match.index);
    const traits = detectQueryTraits(rawQuery);

    queries.push({
      id: `${className}_q${++queryCounter}`,
      query: rawQuery,
      type: 'jpql',
      methodName: findMethodForLine(line),
      className,
      fileName,
      lineNumber: line,
      annotations: ['EntityManager'],
      ...traits,
      complexity: assessComplexity(rawQuery),
    });
  }

  // ── 3. @NamedQuery ─────────────────────────────────────────────────────
  NAMED_QUERY_RE.lastIndex = 0;
  while ((match = NAMED_QUERY_RE.exec(source)) !== null) {
    const rawQuery = cleanConcatenatedString(match[1]);
    const line = getLineNumber(source, match.index);
    const traits = detectQueryTraits(rawQuery);

    queries.push({
      id: `${className}_q${++queryCounter}`,
      query: rawQuery,
      type: 'jpql',
      methodName: className,
      className,
      fileName,
      lineNumber: line,
      annotations: ['@NamedQuery'],
      ...traits,
      complexity: assessComplexity(rawQuery),
    });
  }

  // ── 4. Criteria API detection (non-extractable) ────────────────────────
  if (CRITERIA_RE.test(source)) {
    const criteriaLine = getLineNumber(
      source,
      source.search(CRITERIA_RE),
    );
    queries.push({
      id: `${className}_q${++queryCounter}`,
      query: '[Criteria API — requires runtime analysis for SQL extraction]',
      type: 'criteria',
      methodName: findMethodForLine(criteriaLine),
      className,
      fileName,
      lineNumber: criteriaLine,
      annotations: ['CriteriaAPI'],
      hasNPlusOne: false,
      hasFetchJoin: false,
      hasAggregation: false,
      hasSubquery: false,
      hasPagination: false,
      complexity: 'moderate',
    });
  }

  return {
    fileName,
    className,
    packageName,
    queries,
    entityImports,
    sourcePreview,
  };
}

// ── Batch Parse (for uploaded files) ─────────────────────────────────────────

export function parseMultipleFiles(
  files: { name: string; content: string }[],
): JPAParseResult[] {
  return files.map((f) => parseJavaSource(f.content, f.name));
}

// ── Load Built-in Samples ────────────────────────────────────────────────────

export async function loadSampleFiles(): Promise<
  { name: string; content: string }[]
> {
  const samplesDir = join(
    import.meta.dirname ?? new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
    '../sample-jpa-files',
  );

  try {
    const entries = await readdir(samplesDir);
    const javaFiles = entries.filter((e) => e.endsWith('.java'));
    const results: { name: string; content: string }[] = [];

    for (const file of javaFiles) {
      const content = await readFile(join(samplesDir, file), 'utf-8');
      results.push({ name: file, content });
    }

    return results;
  } catch (err) {
    logger.warn('Failed to load sample JPA files', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
