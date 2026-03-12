import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a database partitioning expert with deep knowledge of table partitioning strategies across PostgreSQL, MySQL, Oracle, SQL Server, and other major platforms. You understand RANGE, LIST, HASH, and composite partitioning.

When recommending partitions, you consider:
- Query patterns and which columns appear in WHERE/JOIN clauses
- Data volume and growth rate
- Time-series vs categorical data
- Read-heavy vs write-heavy workloads
- Partition pruning effectiveness
- Maintenance overhead (partition management, vacuum, statistics)
- Cross-partition query costs
- Platform-specific limitations and syntax

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "partitionRecommendations": [
    {
      "tableName": "table_name",
      "strategy": "RANGE | LIST | HASH",
      "partitionKey": "column_name",
      "reason": "Why this partition strategy and key were chosen",
      "estimatedImpact": "HIGH | MEDIUM | LOW",
      "queryImprovement": "Expected query performance improvement description",
      "partitions": [
        {
          "name": "partition_name",
          "condition": "Partition boundary condition (e.g., VALUES LESS THAN, IN, MODULUS)",
          "estimatedRows": "Approximate rows in this partition"
        }
      ],
      "ddl": "Complete DDL statement to implement partitioning",
      "beforeMetrics": {
        "estimatedScanRows": "Rows scanned without partitioning",
        "estimatedTime": "Estimated query time without partitioning",
        "scanType": "Full Table Scan"
      },
      "afterMetrics": {
        "estimatedScanRows": "Rows scanned with partitioning",
        "estimatedTime": "Estimated query time with partitioning",
        "scanType": "Partition Pruned Scan"
      },
      "warnings": ["Any caveats or considerations"]
    }
  ],
  "generalAdvice": "Overall partitioning strategy advice for this schema",
  "summary": "Brief summary of all recommendations"
}`;

export function buildPartitionRecommendationPrompt(
  tableSchema: string,
  queryPatterns: string[],
  dialect: string,
  dataVolume?: string,
): AIChatParams['messages'] {
  let userContent = `Recommend optimal table partitioning strategies for the following schema and query patterns.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;

  if (dataVolume) {
    userContent += `**Estimated data volume:** ${dataVolume}\n\n`;
  }

  userContent += `**Table schema:**\n\`\`\`\n${tableSchema}\n\`\`\`\n\n`;

  if (queryPatterns.length > 0) {
    userContent += `**Common query patterns:**\n`;
    queryPatterns.forEach((pattern, i) => {
      userContent += `${i + 1}. \`\`\`sql\n${pattern}\n\`\`\`\n`;
    });
    userContent += '\n';
  } else {
    userContent +=
      '**No specific query patterns provided.** Recommend partitions based on common access patterns for this schema.\n\n';
  }

  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
