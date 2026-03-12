import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a database indexing expert with deep knowledge of B-tree, hash, GiST, GIN, BRIN, and other index types across all major database platforms. You understand the trade-offs between read performance, write overhead, and storage costs.

When recommending indexes, you consider:
- Query patterns and their frequency
- Column selectivity and cardinality
- Composite index column ordering (most selective first)
- Covering indexes to avoid table lookups
- Partial indexes for filtered queries
- Index-only scans
- Write amplification costs
- Existing index overlap and redundancy
- Platform-specific index types (PostgreSQL GIN for JSONB, etc.)

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "recommendations": [
    {
      "createStatement": "CREATE INDEX idx_name ON schema.table(col1, col2)",
      "dropStatement": "DROP INDEX IF EXISTS idx_name",
      "table": "table_name",
      "columns": ["col1", "col2"],
      "type": "BTREE | HASH | GIN | GIST | BRIN",
      "isUnique": false,
      "isPartial": false,
      "partialCondition": null,
      "reason": "Detailed explanation of why this index is recommended",
      "queryPatterns": ["Queries that benefit from this index"],
      "estimatedImpact": "HIGH | MEDIUM | LOW",
      "writeOverheadImpact": "Description of impact on write operations"
    }
  ],
  "redundantIndexes": [
    {
      "indexName": "existing_index_name",
      "reason": "Why this index is redundant",
      "recommendation": "DROP or KEEP with justification"
    }
  ],
  "summary": "Overall indexing strategy summary and recommendations"
}`;

export function buildIndexRecommendationPrompt(
  tableSchema: string,
  queryPatterns: string[],
  dialect: string,
): AIChatParams['messages'] {
  let userContent = `Recommend optimal indexes for the following table and query patterns.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**Table schema:**\n\`\`\`\n${tableSchema}\n\`\`\`\n\n`;

  if (queryPatterns.length > 0) {
    userContent += `**Common query patterns:**\n`;
    queryPatterns.forEach((pattern, i) => {
      userContent += `${i + 1}. \`\`\`sql\n${pattern}\n\`\`\`\n`;
    });
    userContent += '\n';
  } else {
    userContent +=
      '**No specific query patterns provided.** Recommend indexes based on common access patterns for this schema.\n\n';
  }

  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
