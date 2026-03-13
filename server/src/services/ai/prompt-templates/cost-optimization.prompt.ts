import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an enterprise database cost optimization consultant with deep expertise in:
- Cloud database pricing models (AWS RDS, Aurora, Snowflake, BigQuery, Azure SQL, GCP Cloud SQL)
- Query cost analysis and optimization (full table scans, expensive JOINs, compute-intensive aggregations)
- Storage optimization (archival strategies, compression, tiered storage, partitioning)
- Index efficiency analysis (unused indexes costing write overhead, duplicate indexes, missing indexes causing scans)
- Instance right-sizing (over-provisioned compute, reserved instance savings, read replica optimization)
- Data lifecycle cost management (cold data archival, log rotation, retention policy optimization)
- I/O cost reduction (read/write IOPS optimization, caching strategies, connection pooling)

You analyze database infrastructure costs and generate actionable optimization recommendations with concrete dollar savings estimates. You prioritize quick wins (low effort, high savings) over long-term projects.

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "executiveSummary": {
    "currentMonthlyCost": 20000,
    "estimatedMonthlySavings": 7200,
    "savingsPercentage": 36,
    "annualSavingsProjection": 86400,
    "headline": "One-line cost optimization summary",
    "topCostDrivers": [
      { "driver": "What is expensive", "monthlyCost": 8000, "percentage": 40, "category": "compute|storage|io|network|backup" }
    ],
    "quickWins": [
      { "action": "Quick action to save money", "monthlySavings": 2000, "effort": "LOW", "timeframe": "1-2 days" }
    ]
  },
  "costBreakdown": {
    "categories": [
      { "name": "Compute|Storage|I/O|Network|Backup|Licensing", "currentCost": 8000, "optimizedCost": 5500, "savings": 2500, "percentage": 40 }
    ],
    "byTable": [
      { "tableName": "table_name", "estimatedCost": 3000, "costDrivers": ["full table scans", "large storage"], "savingsPotential": 1200 }
    ],
    "wasteIdentification": [
      { "type": "unused_table|redundant_index|over_provisioned|stale_data", "description": "What is wasted", "monthlyCost": 500, "recommendation": "How to fix" }
    ]
  },
  "queryCostAnalysis": {
    "expensiveQueries": [
      {
        "description": "What the query does",
        "estimatedMonthlyCost": 3000,
        "frequency": "1000/day",
        "issue": "full_table_scan|missing_index|expensive_join|cartesian_product",
        "currentBehavior": "What it does now",
        "optimization": "How to fix it",
        "estimatedSavings": 2000,
        "sqlHint": "CREATE INDEX ... or query rewrite suggestion"
      }
    ],
    "fullTableScans": [
      { "table": "table_name", "queryPattern": "What causes the scan", "estimatedCost": 1500, "fix": "Add index or partition" }
    ]
  },
  "storageOptimization": {
    "currentStorageGB": 2400,
    "optimizedStorageGB": 1600,
    "storageSavings": 800,
    "recommendations": [
      {
        "type": "archive|compress|partition|delete|tier",
        "target": "What to optimize",
        "currentSizeGB": 500,
        "savingGB": 400,
        "monthlySavings": 200,
        "implementation": "How to do it",
        "risk": "LOW|MEDIUM|HIGH"
      }
    ],
    "unusedTables": [
      { "tableName": "table_name", "sizeGB": 50, "lastAccessed": "2024-01-15", "monthlyCost": 25, "recommendation": "archive|drop" }
    ]
  },
  "indexOptimization": {
    "unusedIndexes": [
      { "indexName": "idx_name", "tableName": "table", "sizeGB": 2, "writeOverhead": "15% slower writes", "recommendation": "DROP INDEX idx_name", "monthlySavings": 50 }
    ],
    "duplicateIndexes": [
      { "indexes": ["idx_a", "idx_b"], "tableName": "table", "recommendation": "Keep idx_a, drop idx_b", "monthlySavings": 30 }
    ],
    "missingIndexes": [
      { "tableName": "table", "columns": ["col1", "col2"], "reason": "Full table scan on WHERE clause", "createStatement": "CREATE INDEX idx_name ON table(col1, col2)", "estimatedSavings": 500 }
    ]
  },
  "rightSizing": {
    "compute": {
      "currentInstance": "db.r6g.2xlarge",
      "recommendedInstance": "db.r6g.xlarge",
      "currentCost": 3000,
      "recommendedCost": 1500,
      "monthlySavings": 1500,
      "justification": "Average CPU utilization is 25%, peak is 55% — xlarge handles this comfortably",
      "risk": "LOW"
    },
    "reservedInstances": {
      "currentCommitment": "On-Demand",
      "recommendedCommitment": "1-year Reserved",
      "monthlySavings": 900,
      "upfrontCost": 12000,
      "breakEvenMonths": 4,
      "justification": "Stable workload with 95%+ uptime makes RI cost-effective"
    },
    "storageTier": {
      "currentTier": "gp3 SSD",
      "recommendation": "Move cold data to sc1/archive",
      "monthlySavings": 400,
      "details": "60% of data is older than 1 year and rarely accessed"
    },
    "readReplicas": {
      "current": 2,
      "recommended": 1,
      "monthlySavings": 800,
      "justification": "Second read replica has < 5% query traffic — consolidate to one"
    }
  },
  "actionPlan": [
    {
      "priority": 1,
      "category": "QUICK_WIN|SHORT_TERM|LONG_TERM",
      "title": "Action title",
      "description": "Detailed description",
      "monthlySavings": 2000,
      "effort": "LOW|MEDIUM|HIGH",
      "risk": "LOW|MEDIUM|HIGH",
      "timeline": "1-2 days",
      "implementation": "Step-by-step implementation guide"
    }
  ]
}`;

export function buildCostOptimizationPrompt(
  assessmentInput: {
    cloudConfig: Record<string, unknown>;
    queryPatterns: Record<string, unknown>;
    storageProfile: Record<string, unknown>;
    indexProfile: Record<string, unknown>;
    schemaStats?: { tableCount: number; totalSizeGB: number };
  },
): AIChatParams['messages'] {
  const userContent = `Analyze the following database infrastructure and generate a comprehensive cost optimization report with concrete dollar savings estimates.

**Cloud Infrastructure & Cost Profile:**
\`\`\`json
${JSON.stringify(assessmentInput.cloudConfig, null, 2)}
\`\`\`

**Query Patterns & Compute Usage:**
\`\`\`json
${JSON.stringify(assessmentInput.queryPatterns, null, 2)}
\`\`\`

**Storage Profile:**
\`\`\`json
${JSON.stringify(assessmentInput.storageProfile, null, 2)}
\`\`\`

**Index Profile:**
\`\`\`json
${JSON.stringify(assessmentInput.indexProfile, null, 2)}
\`\`\`

${assessmentInput.schemaStats ? `**Schema Statistics:**
\`\`\`json
${JSON.stringify(assessmentInput.schemaStats, null, 2)}
\`\`\`
` : ''}
${RESPONSE_FORMAT}`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
