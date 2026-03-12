import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an expert JPA/JPQL/HQL query analyst with deep knowledge of Hibernate, EclipseLink, and Spring Data JPA. You understand:
- JPQL to SQL translation patterns
- N+1 query problem detection
- Lazy loading performance implications
- Fetch join optimization
- Query execution plan analysis
- Database performance at various data volumes

When analyzing JPA queries, you:
1. Translate JPQL/HQL to the target SQL dialect
2. Identify performance issues (N+1, cartesian products, missing indexes, full table scans)
3. Estimate performance at different data volumes (1K, 100K, 1M, 10M rows)
4. Compare against standard benchmarks (<50ms good, <200ms acceptable, <500ms warning, >500ms critical)
5. Provide specific recommendations with before/after code

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "sqlTranslation": "The generated SQL for the target dialect",
  "performanceEstimates": [
    {
      "rows": "1K",
      "estimatedTimeMs": 5,
      "scanType": "Index Seek",
      "joinsUsed": 0,
      "memoryMB": 0.1,
      "rating": "good"
    }
  ],
  "issues": [
    {
      "severity": "critical | warning | info",
      "title": "Short issue title",
      "description": "Detailed description of the issue",
      "impact": "Description of the performance/correctness impact"
    }
  ],
  "recommendations": [
    {
      "title": "Short recommendation title",
      "description": "Detailed description of what to change and why",
      "before": "Original JPQL/HQL code",
      "after": "Improved JPQL/HQL code",
      "estimatedImprovement": "e.g. 60% faster, reduces N+1 from 100 to 1 query"
    }
  ],
  "summary": "A concise overall analysis summary paragraph"
}

The "performanceEstimates" array MUST contain one entry for each of the provided data volumes.
The "rating" field MUST be one of: "good" (<50ms), "acceptable" (<200ms), "warning" (<500ms), "critical" (>=500ms).
If there are no issues, return an empty array for "issues".
If there are no recommendations, return an empty array for "recommendations".`;

export function buildJPAAnalysisPrompt(
  jpql: string,
  dialect: string,
  entityContext?: string,
  dataVolumes?: number[],
): AIChatParams['messages'] {
  const volumes = dataVolumes ?? [1_000, 100_000, 1_000_000, 10_000_000];

  const volumeLabels = volumes.map((v) => {
    if (v >= 1_000_000_000) return `${v / 1_000_000_000}B`;
    if (v >= 1_000_000) return `${v / 1_000_000}M`;
    if (v >= 1_000) return `${v / 1_000}K`;
    return String(v);
  });

  let userContent = `Analyze the following JPA/JPQL/HQL query for performance, correctness, and optimization opportunities.\n\n`;
  userContent += `**Target SQL dialect:** ${dialect}\n\n`;
  userContent += `**JPQL/HQL query:**\n\`\`\`jpql\n${jpql}\n\`\`\`\n\n`;
  userContent += `**Data volumes to estimate:** ${volumeLabels.join(', ')} rows\n\n`;

  if (entityContext) {
    userContent += `**JPA Entity definitions (for context):**\n\`\`\`java\n${entityContext}\n\`\`\`\n\n`;
  }

  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
