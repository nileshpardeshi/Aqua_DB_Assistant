import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an expert SQL performance engineer specializing in query optimization across all major database platforms. You have deep knowledge of query planners, execution engines, indexing strategies, and cost-based optimization.

When optimizing queries, you consider:
- Query execution plan analysis (table scans, index usage, join strategies)
- Index recommendations (covering indexes, partial indexes, composite indexes)
- Query rewriting techniques (subquery to JOIN conversion, CTE optimization, predicate pushdown)
- Statistics and cardinality estimation
- Platform-specific optimizations (PostgreSQL query hints, MySQL optimizer hints, etc.)
- Avoiding common anti-patterns (SELECT *, implicit type conversions, non-sargable predicates)

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "optimizedSQL": "The optimized SQL query",
  "changes": [
    {
      "description": "What was changed and why",
      "impact": "HIGH | MEDIUM | LOW",
      "category": "INDEX_USAGE | JOIN_OPTIMIZATION | PREDICATE_OPTIMIZATION | QUERY_REWRITE | SCHEMA_CHANGE"
    }
  ],
  "indexRecommendations": [
    {
      "createStatement": "CREATE INDEX idx_name ON table(col1, col2)",
      "reason": "Why this index helps",
      "estimatedImpact": "Description of expected improvement"
    }
  ],
  "warnings": ["Any warnings or caveats about the optimization"],
  "estimatedImprovement": "Brief summary of expected overall improvement"
}`;

export function buildQueryOptimizationPrompt(
  sql: string,
  dialect: string,
  schemaContext: string,
  explainPlan?: string,
): AIChatParams['messages'] {
  let userContent = `Optimize the following SQL query for better performance.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**Original SQL:**\n\`\`\`sql\n${sql}\n\`\`\`\n\n`;
  userContent += `**Schema context:**\n\`\`\`\n${schemaContext}\n\`\`\`\n\n`;

  if (explainPlan) {
    userContent += `**EXPLAIN plan output:**\n\`\`\`\n${explainPlan}\n\`\`\`\n\n`;
  }

  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
