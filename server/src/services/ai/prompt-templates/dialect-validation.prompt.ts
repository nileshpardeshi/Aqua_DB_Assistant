import type { AIChatParams } from '../ai-provider.interface.js';

/**
 * Compressed prompt — ~40% fewer tokens than the original verbose version.
 * Same semantic meaning, same JSON schema, same CRITICAL requirements.
 */

const SYSTEM_PROMPT = `Expert SQL engineer. Validate dialect-converted SQL. Respond ONLY with JSON, no other text.`;

const RESPONSE_SCHEMA = `JSON format:
{"valid":bool,"issues":[{"severity":"error|warning|info","category":"data_type|syntax|feature|naming|constraint","message":"...","line":N,"suggestion":"..."}],"overallAssessment":"1-2 sentences","compatibilityScore":0-100,"correctedSql":"FULL corrected SQL"}

severity: error=fails execution, warning=version-dependent, info=cosmetic.
Only list real issues. Empty issues array + score 100 if no problems.

CRITICAL: correctedSql is MANDATORY. Output the COMPLETE script with ALL fixes applied. No truncation, no "...", no abbreviation. Must be directly executable on target DB.`;

export function buildDialectValidationPrompt(
  convertedSql: string,
  sourceDialect: string,
  targetDialect: string,
  options?: { insertsWereTruncated?: boolean; truncatedInsertCount?: number },
): AIChatParams['messages'] {
  const src = sourceDialect.toUpperCase();
  const tgt = targetDialect.toUpperCase();

  // If INSERTs were truncated by the optimizer, tell the AI to only validate DDL
  const insertNote = options?.insertsWereTruncated
    ? `\nNote: INSERT data was truncated to save tokens (${options.truncatedInsertCount} INSERT statements). Validate DDL structure only. In correctedSql, include only the DDL statements (CREATE/ALTER/DROP/INDEX), NOT the INSERT data.`
    : '';

  return [
    {
      role: 'system' as const,
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user' as const,
      content: `Validate SQL converted from ${src} → ${tgt}.

Check: data types, functions/syntax, reserved words, constraints, indexes, defaults, generated columns — all for ${tgt} compatibility.${insertNote}

${RESPONSE_SCHEMA}

--- SQL (${src}→${tgt}) ---
${convertedSql}
--- END ---`,
    },
  ];
}
