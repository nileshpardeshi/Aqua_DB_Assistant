// ---------------------------------------------------------------------------
// SQL Dialect Detector – Score-based heuristic detection
// ---------------------------------------------------------------------------

import type { SQLDialect } from './parser.interface.js';

interface DialectScore {
  dialect: SQLDialect;
  score: number;
}

/**
 * Keyword/pattern rules that contribute to a dialect's score.
 * Each rule has a regex pattern and the weight it adds.
 */
interface DetectionRule {
  pattern: RegExp;
  dialect: SQLDialect;
  weight: number;
}

const DETECTION_RULES: DetectionRule[] = [
  // ── PostgreSQL ──
  { pattern: /\bSERIAL\b/i,                       dialect: 'postgresql', weight: 3 },
  { pattern: /\bBIGSERIAL\b/i,                    dialect: 'postgresql', weight: 4 },
  { pattern: /\bSMALLSERIAL\b/i,                  dialect: 'postgresql', weight: 4 },
  { pattern: /::/,                                  dialect: 'postgresql', weight: 3 },
  { pattern: /\bRETURNING\b/i,                    dialect: 'postgresql', weight: 1 },
  { pattern: /\bINHERITS\b\s*\(/i,                dialect: 'postgresql', weight: 4 },
  { pattern: /\$\$.*\$\$/s,                        dialect: 'postgresql', weight: 3 },
  { pattern: /\bCREATE\s+EXTENSION\b/i,           dialect: 'postgresql', weight: 5 },
  { pattern: /\bWITH\s*\(\s*OIDS\b/i,             dialect: 'postgresql', weight: 5 },
  { pattern: /\bTEXT\b/i,                          dialect: 'postgresql', weight: 1 },
  { pattern: /\bBOOLEAN\b/i,                      dialect: 'postgresql', weight: 1 },
  { pattern: /\bUUID\b/i,                          dialect: 'postgresql', weight: 2 },
  { pattern: /\bJSONB?\b/i,                        dialect: 'postgresql', weight: 2 },
  { pattern: /\bBYTEA\b/i,                         dialect: 'postgresql', weight: 4 },
  { pattern: /\bTIMESTAMPTZ\b/i,                  dialect: 'postgresql', weight: 5 },
  { pattern: /\bIF\s+NOT\s+EXISTS\b/i,            dialect: 'postgresql', weight: 1 },

  // ── MySQL / MariaDB ──
  { pattern: /\bAUTO_INCREMENT\b/i,               dialect: 'mysql', weight: 5 },
  { pattern: /\bENGINE\s*=/i,                      dialect: 'mysql', weight: 5 },
  { pattern: /\bDEFAULT\s+CHARSET\b/i,            dialect: 'mysql', weight: 4 },
  { pattern: /\bUNSIGNED\b/i,                     dialect: 'mysql', weight: 2 },
  { pattern: /\bTINYINT\b/i,                       dialect: 'mysql', weight: 2 },
  { pattern: /\bMEDIUMINT\b/i,                     dialect: 'mysql', weight: 3 },
  { pattern: /\bMEDIUMTEXT\b/i,                    dialect: 'mysql', weight: 3 },
  { pattern: /\bLONGTEXT\b/i,                      dialect: 'mysql', weight: 3 },
  { pattern: /\bENUM\s*\(/i,                        dialect: 'mysql', weight: 2 },
  { pattern: /`\w+`/,                               dialect: 'mysql', weight: 1 },
  { pattern: /\bCOMMENT\s+'/i,                     dialect: 'mysql', weight: 2 },

  // ── Oracle ──
  { pattern: /\bVARCHAR2\b/i,                     dialect: 'oracle', weight: 5 },
  { pattern: /\bNUMBER\b\s*\(/i,                  dialect: 'oracle', weight: 3 },
  { pattern: /\bNUMBER\b/i,                        dialect: 'oracle', weight: 1 },
  { pattern: /\bCONNECT\s+BY\b/i,                 dialect: 'oracle', weight: 5 },
  { pattern: /\bSTART\s+WITH\b/i,                 dialect: 'oracle', weight: 3 },
  { pattern: /\bNVARCHAR2\b/i,                    dialect: 'oracle', weight: 5 },
  { pattern: /\bSYSDATE\b/i,                       dialect: 'oracle', weight: 4 },
  { pattern: /\bCLOB\b/i,                          dialect: 'oracle', weight: 2 },
  { pattern: /\bBLOB\b/i,                          dialect: 'oracle', weight: 1 },
  { pattern: /\bROWID\b/i,                         dialect: 'oracle', weight: 5 },
  { pattern: /\bROWNUM\b/i,                        dialect: 'oracle', weight: 5 },
  { pattern: /\bPLS_INTEGER\b/i,                   dialect: 'oracle', weight: 5 },

  // ── SQL Server (T-SQL) ──
  { pattern: /\bIDENTITY\s*\(\d/i,                dialect: 'sqlserver', weight: 5 },
  { pattern: /\bNVARCHAR\b/i,                     dialect: 'sqlserver', weight: 3 },
  { pattern: /\bNCHAR\b/i,                         dialect: 'sqlserver', weight: 3 },
  { pattern: /\bGO\b\s*$/im,                       dialect: 'sqlserver', weight: 4 },
  { pattern: /\bDATETIME2\b/i,                    dialect: 'sqlserver', weight: 5 },
  { pattern: /\bDATETIMEOFFSET\b/i,               dialect: 'sqlserver', weight: 5 },
  { pattern: /\bSMALLDATETIME\b/i,                dialect: 'sqlserver', weight: 4 },
  { pattern: /\bUNIQUEIDENTIFIER\b/i,             dialect: 'sqlserver', weight: 5 },
  { pattern: /\[\w+\]/,                             dialect: 'sqlserver', weight: 2 },
  { pattern: /\bTOP\s+\d+\b/i,                    dialect: 'sqlserver', weight: 3 },
  { pattern: /\bWITH\s*\(\s*NOLOCK\b/i,           dialect: 'sqlserver', weight: 5 },
  { pattern: /\bCLUSTERED\b/i,                    dialect: 'sqlserver', weight: 3 },
  { pattern: /\bNONCLUSTERED\b/i,                 dialect: 'sqlserver', weight: 3 },

  // ── Snowflake ──
  { pattern: /\bVARIANT\b/i,                      dialect: 'snowflake', weight: 4 },
  { pattern: /\bCLUSTER\s+BY\b/i,                 dialect: 'snowflake', weight: 4 },
  { pattern: /\bSTAGE\b/i,                         dialect: 'snowflake', weight: 2 },
  { pattern: /\bSTREAM\b/i,                        dialect: 'snowflake', weight: 2 },
  { pattern: /\bTASK\b/i,                          dialect: 'snowflake', weight: 1 },
  { pattern: /\bPIPE\b/i,                          dialect: 'snowflake', weight: 2 },
  { pattern: /\bCOPY\s+INTO\b/i,                  dialect: 'snowflake', weight: 3 },
  { pattern: /\bFLATTEN\s*\(/i,                    dialect: 'snowflake', weight: 5 },
  { pattern: /\bOBJECT\b/i,                        dialect: 'snowflake', weight: 1 },
  { pattern: /\bARRAY\b/i,                         dialect: 'snowflake', weight: 1 },

  // ── BigQuery ──
  { pattern: /\bSTRUCT\s*</i,                      dialect: 'bigquery', weight: 5 },
  { pattern: /\bARRAY\s*</i,                       dialect: 'bigquery', weight: 4 },
  { pattern: /`[\w-]+\.[\w-]+\.[\w-]+`/,            dialect: 'bigquery', weight: 5 },
  { pattern: /`[\w-]+\.[\w-]+`/,                    dialect: 'bigquery', weight: 3 },
  { pattern: /\bINT64\b/i,                         dialect: 'bigquery', weight: 5 },
  { pattern: /\bFLOAT64\b/i,                       dialect: 'bigquery', weight: 5 },
  { pattern: /\bBOOL\b/i,                          dialect: 'bigquery', weight: 2 },
  { pattern: /\bBYTES\b/i,                         dialect: 'bigquery', weight: 3 },
  { pattern: /\bSTRING\b/i,                        dialect: 'bigquery', weight: 2 },
  { pattern: /\bGEOGRAPHY\b/i,                    dialect: 'bigquery', weight: 4 },
];

/**
 * Detect the SQL dialect of a given SQL string using a score-based heuristic.
 *
 * @param sql       The SQL text to analyze
 * @param hintDialect  Optional hint – if provided and the score for that
 *                     dialect is non-negative, it wins automatically.
 * @returns The best-matching dialect
 */
export function detectDialect(
  sql: string,
  hintDialect?: string,
): SQLDialect {
  const allDialects: SQLDialect[] = [
    'postgresql',
    'mysql',
    'mariadb',
    'oracle',
    'sqlserver',
    'snowflake',
    'bigquery',
  ];

  // Normalize hint
  const normalizedHint = hintDialect?.toLowerCase().trim() as SQLDialect | undefined;

  // If a valid hint is given, try to honour it
  if (normalizedHint && allDialects.includes(normalizedHint)) {
    // Only override if the SQL doesn't strongly contradict the hint.
    // We still run detection to see whether it's plausible.
    const scores = computeScores(sql);
    const hintScore = scores.find((s) => s.dialect === normalizedHint);
    if (hintScore && hintScore.score >= 0) {
      return normalizedHint;
    }
  }

  const scores = computeScores(sql);

  // MariaDB piggybacks on MySQL rules – if MySQL wins, check for MariaDB
  // specific markers; otherwise just return MySQL.
  if (scores[0].dialect === 'mysql') {
    if (/\bSEQUENCE\b/i.test(sql) || /\bROWNUM\b/i.test(sql)) {
      return 'mariadb';
    }
  }

  return scores[0].dialect;
}

/**
 * Compute dialect scores from detection rules.
 * Returns an array sorted descending by score.
 */
function computeScores(sql: string): DialectScore[] {
  const scoreMap = new Map<SQLDialect, number>();

  for (const rule of DETECTION_RULES) {
    if (rule.pattern.test(sql)) {
      scoreMap.set(rule.dialect, (scoreMap.get(rule.dialect) ?? 0) + rule.weight);
    }
  }

  // Build sorted list – all dialects get an entry (default 0)
  const allDialects: SQLDialect[] = [
    'postgresql',
    'mysql',
    'mariadb',
    'oracle',
    'sqlserver',
    'snowflake',
    'bigquery',
  ];

  const scores: DialectScore[] = allDialects.map((d) => ({
    dialect: d,
    score: scoreMap.get(d) ?? 0,
  }));

  // MariaDB inherits MySQL score when there are no MariaDB-specific signals
  const mysql = scores.find((s) => s.dialect === 'mysql')!;
  const mariadb = scores.find((s) => s.dialect === 'mariadb')!;
  if (mariadb.score === 0 && mysql.score > 0) {
    // Don't auto-promote to mariadb; let MySQL win
  }

  scores.sort((a, b) => b.score - a.score);

  // Default to postgresql when all scores are zero
  if (scores[0].score === 0) {
    return [{ dialect: 'postgresql', score: 0 }, ...scores.filter((s) => s.dialect !== 'postgresql')];
  }

  return scores;
}
