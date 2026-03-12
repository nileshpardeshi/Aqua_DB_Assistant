import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a database statistics expert specializing in data distribution analysis, cardinality estimation, and query optimizer statistics. You understand how real-world data distributes across columns and can accurately simulate pg_stats, INFORMATION_SCHEMA statistics, and histogram data.

When simulating data distributions, you:
- Estimate realistic cardinality (distinct values) based on column type, name semantics, and table size
- Detect data skew patterns (status columns, categorical data, temporal patterns)
- Generate realistic histogram buckets showing value frequency distribution
- Calculate selectivity ratios for query optimizer planning
- Identify columns with poor selectivity that won't benefit from B-tree indexes
- Detect NULL distribution patterns
- Consider domain-specific patterns (email domains cluster, timestamps have temporal patterns, status columns are highly skewed)

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "distributions": [
    {
      "tableName": "orders",
      "columnName": "status",
      "dataType": "VARCHAR(20)",
      "estimatedCardinality": 5,
      "totalRows": 1000000,
      "selectivity": 0.000005,
      "distributionType": "skewed",
      "skewFactor": 0.85,
      "histogram": [
        { "bucket": "active", "frequency": 450000, "cumulativePercent": 45.0 },
        { "bucket": "completed", "frequency": 350000, "cumulativePercent": 80.0 },
        { "bucket": "cancelled", "frequency": 100000, "cumulativePercent": 90.0 },
        { "bucket": "pending", "frequency": 80000, "cumulativePercent": 98.0 },
        { "bucket": "refunded", "frequency": 20000, "cumulativePercent": 100.0 }
      ],
      "topNValues": [
        { "value": "active", "frequency": 450000, "percentage": 45.0 },
        { "value": "completed", "frequency": 350000, "percentage": 35.0 }
      ],
      "nullPercentage": 0.0,
      "statistics": {
        "min": "active",
        "max": "refunded",
        "avg": "N/A",
        "stddev": "N/A",
        "median": "completed"
      }
    }
  ],
  "skewAlerts": [
    {
      "tableName": "orders",
      "columnName": "status",
      "severity": "high",
      "message": "Heavy skew: 45% of values are 'active'",
      "impact": "B-tree index on this column will have poor selectivity for 'active' status queries",
      "recommendation": "Consider partial index: CREATE INDEX idx_orders_pending ON orders(id) WHERE status = 'pending'"
    }
  ],
  "cardinalityMatrix": {
    "orders.status": { "uniqueValues": 5, "totalRows": 1000000, "ratio": 0.000005 },
    "orders.customer_id": { "uniqueValues": 45000, "totalRows": 1000000, "ratio": 0.045 }
  },
  "summary": "Analyzed 8 columns across 2 tables. Found 2 high-skew columns (status, type) and 1 column with excessive NULLs (notes: 78%). Cardinality ranges from 5 (status) to 950000 (id)."
}`;

export function buildDataDistributionPrompt(
  tableSchema: string,
  selectedTables: string[],
  estimatedRowCounts: Record<string, number>,
  dialect: string,
): AIChatParams['messages'] {
  let userContent = `Simulate the data distribution statistics for the following tables.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**Selected tables:** ${selectedTables.join(', ')}\n\n`;

  userContent += `**Estimated row counts per table:**\n`;
  for (const [table, count] of Object.entries(estimatedRowCounts)) {
    userContent += `- ${table}: ${count.toLocaleString()} rows\n`;
  }
  userContent += '\n';

  userContent += `**Table schema:**\n\`\`\`sql\n${tableSchema}\n\`\`\`\n\n`;
  userContent += `**Instructions:**\n`;
  userContent += `- Analyze each column in the selected tables\n`;
  userContent += `- Estimate realistic cardinality based on column semantics and data types\n`;
  userContent += `- Generate histogram buckets (5-10 buckets per column)\n`;
  userContent += `- Identify skewed columns and provide actionable recommendations\n`;
  userContent += `- Calculate selectivity ratios for query planning\n`;
  userContent += `- Consider real-world data patterns (e.g., status columns are typically skewed)\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
