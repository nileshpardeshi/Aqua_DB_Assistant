import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a database query optimizer expert with deep knowledge of execution plan internals across all major database platforms (PostgreSQL, MySQL, Oracle, SQL Server, Snowflake, BigQuery). You can accurately simulate EXPLAIN ANALYZE output based on schema structure and estimated data volumes.

When simulating query plans, you:
- Build a realistic execution plan tree with accurate node types (Seq Scan, Index Scan, Hash Join, Nested Loop, Sort, Aggregate, etc.)
- Estimate costs based on table sizes, index availability, join selectivity, and filter predicates
- Identify performance bottlenecks (full table scans, missing indexes, expensive sorts, hash spills)
- Provide dialect-specific plan output format (PostgreSQL EXPLAIN style, MySQL EXPLAIN FORMAT=TREE, etc.)
- Consider buffer cache hits vs disk reads
- Analyze join ordering and recommend optimal join strategies
- Estimate memory usage and detect potential spill-to-disk scenarios

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "executionPlan": {
    "planTree": [
      {
        "nodeType": "Hash Join",
        "relation": null,
        "alias": null,
        "startupCost": 100.00,
        "totalCost": 2345.67,
        "estimatedRows": 50000,
        "actualRows": 48732,
        "estimatedWidth": 64,
        "executionTimeMs": 45.2,
        "filter": "o.customer_id = c.id",
        "indexUsed": null,
        "bufferHits": 1500,
        "bufferReads": 200,
        "children": [
          {
            "nodeType": "Seq Scan",
            "relation": "orders",
            "alias": "o",
            "startupCost": 0.00,
            "totalCost": 1234.56,
            "estimatedRows": 100000,
            "actualRows": 99845,
            "estimatedWidth": 48,
            "executionTimeMs": 32.1,
            "filter": "o.status = 'active'",
            "indexUsed": null,
            "bufferHits": 800,
            "bufferReads": 150,
            "children": []
          }
        ]
      }
    ],
    "totalExecutionTimeMs": 123.45,
    "planningTimeMs": 0.5,
    "peakMemoryKB": 2048,
    "rowsReturned": 100
  },
  "bottlenecks": [
    {
      "severity": "critical",
      "nodeIndex": 0,
      "issue": "Full table scan on orders (100K rows)",
      "impact": "60% of total query time",
      "recommendation": "Create index on orders(status, customer_id)"
    }
  ],
  "indexRecommendations": [
    {
      "createStatement": "CREATE INDEX idx_orders_status ON orders(status, customer_id)",
      "estimatedImprovement": "85% reduction in scan rows",
      "reason": "Filter on status column with high selectivity"
    }
  ],
  "joinAnalysis": {
    "joinCount": 2,
    "joinTypes": ["Hash Join", "Nested Loop"],
    "costliestJoin": "Hash Join on orders.customer_id = customers.id (45.2ms)",
    "recommendation": "Consider adding index on orders.customer_id for Nested Loop join"
  },
  "memoryAnalysis": {
    "estimatedWorkMem": "4 MB",
    "sortSpillToDisk": false,
    "hashBuckets": 1024
  },
  "dialectSpecificNotes": "PostgreSQL-specific notes...",
  "summary": "Query performs 2 joins with a full table scan bottleneck on orders table. Adding an index on orders(status, customer_id) would reduce execution time by ~85%."
}`;

export function buildQueryPlannerPrompt(
  sql: string,
  tableSchema: string,
  dialect: string,
  estimatedRowCounts?: Record<string, number>,
): AIChatParams['messages'] {
  let userContent = `Simulate the EXPLAIN ANALYZE output for the following SQL query.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**SQL Query:**\n\`\`\`sql\n${sql}\n\`\`\`\n\n`;
  userContent += `**Table schema:**\n\`\`\`sql\n${tableSchema}\n\`\`\`\n\n`;

  if (estimatedRowCounts && Object.keys(estimatedRowCounts).length > 0) {
    userContent += `**Estimated row counts per table:**\n`;
    for (const [table, count] of Object.entries(estimatedRowCounts)) {
      userContent += `- ${table}: ${count.toLocaleString()} rows\n`;
    }
    userContent += '\n';
  }

  userContent += `**Instructions:**\n`;
  userContent += `- Build a realistic execution plan tree with accurate cost estimates\n`;
  userContent += `- Consider existing indexes from the schema\n`;
  userContent += `- Identify the top bottlenecks and their percentage impact\n`;
  userContent += `- Recommend specific index creation statements to improve performance\n`;
  userContent += `- Analyze join strategies and memory usage\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
