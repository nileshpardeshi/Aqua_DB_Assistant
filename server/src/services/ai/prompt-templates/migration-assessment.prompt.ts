import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an expert database migration architect with deep experience migrating enterprise databases across all major platforms (PostgreSQL, MySQL, Oracle, SQL Server, MariaDB, Snowflake, BigQuery). You specialize in large-scale migrations involving millions of rows.

When assessing migrations, you consider:
- Data type compatibility and automatic mapping coverage
- Function, trigger, and stored procedure portability
- Constraint and index conversion requirements
- Data volume estimation and batch processing strategies
- Sequence/identity column handling across platforms
- Character encoding and collation differences
- Transaction isolation and locking behavior differences
- Optimal chunk sizes for million-row table migrations

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "overallRisk": "LOW | MEDIUM | HIGH | CRITICAL",
  "estimatedEffort": "Brief time estimate, e.g. '2 hours', '1 day', '3 days'",
  "summary": "2-3 sentence overall assessment",
  "dataVolumeAnalysis": [
    {
      "table": "table_name",
      "estimatedRows": "5M",
      "batchSize": 50000,
      "estimatedBatches": 100,
      "estimatedTime": "30 min",
      "notes": "Has LOB columns, consider streaming"
    }
  ],
  "incompatibilities": [
    {
      "type": "DATA_TYPE | FUNCTION | TRIGGER | CONSTRAINT | SEQUENCE | SYNTAX",
      "source": "Source element description",
      "target": "Target equivalent or N/A",
      "severity": "HIGH | MEDIUM | LOW",
      "resolution": "How to resolve this incompatibility"
    }
  ],
  "migrationSteps": [
    {
      "phase": 1,
      "title": "Step title",
      "description": "What this step does",
      "estimatedTime": "5 min"
    }
  ],
  "batchStrategy": {
    "recommendedChunkSize": 50000,
    "parallelism": 4,
    "estimatedTotalTime": "2 hours",
    "notes": "Additional batch processing notes"
  },
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

export function buildMigrationAssessmentPrompt(
  schemaContext: string,
  sourceDialect: string,
  targetDialect: string,
): AIChatParams['messages'] {
  let userContent = `Assess the migration complexity and risk for converting a database from **${sourceDialect}** to **${targetDialect}**.\n\n`;
  userContent += `Analyze the schema below and provide a comprehensive migration assessment including risk level, data volume handling strategy, type incompatibilities, step-by-step migration plan, and batch processing recommendations for tables that may have millions of rows.\n\n`;
  userContent += `**Source Schema (${sourceDialect}):**\n\`\`\`\n${schemaContext}\n\`\`\`\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
