import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a database test data engineering expert specializing in generating realistic synthetic data for enterprise databases. You understand referential integrity, data distributions, and dialect-specific INSERT syntax across all major database platforms.

When generating synthetic data, you:
- Determine correct insert order based on foreign key dependencies (parent tables first)
- Generate realistic, domain-appropriate values (names, emails, dates, amounts, etc.)
- Maintain referential integrity — child table FK values reference existing parent PKs
- Use dialect-specific INSERT syntax (PostgreSQL multi-row VALUES, Oracle INSERT ALL, MySQL batch INSERT, etc.)
- For large volumes, provide a representative batch of 50-100 sample rows PLUS a procedural generation script/pattern
- Apply the specified data distribution (uniform, gaussian, zipf, realistic)
- Handle edge cases: NULLable columns, UNIQUE constraints, CHECK constraints, ENUM types, auto-increment/SERIAL columns

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "scripts": [
    {
      "tableName": "table_name",
      "insertOrder": 1,
      "rowCount": 1000000,
      "batchSize": 1000,
      "sqlScript": "-- Full INSERT statements with sample rows (50-100 rows)\\nINSERT INTO table_name (col1, col2) VALUES\\n('val1', 'val2'),\\n('val3', 'val4');\\n\\n-- For large volumes, include a procedural generation pattern/loop",
      "sampleRows": [["val1", "val2"], ["val3", "val4"]],
      "columnsUsed": ["col1", "col2"],
      "generatorStrategies": {
        "col1": "Sequential ID (1 to N)",
        "col2": "Faker: realistic full names with gaussian distribution"
      },
      "estimatedSizeBytes": 52428800,
      "referentialIntegrityNotes": "References parent_table.id via foreign key"
    }
  ],
  "insertOrder": ["parent_table", "child_table"],
  "totalEstimatedSize": "500 MB",
  "dialectNotes": "PostgreSQL-specific notes about batch INSERT performance, COPY command alternative, etc.",
  "summary": "Generated synthetic data for 3 tables with referential integrity. Total: 3M rows across all tables."
}`;

export function buildSyntheticDataPrompt(
  tableSchema: string,
  selectedTables: string[],
  rowCount: number,
  dialect: string,
  distributionConfig?: {
    type: 'uniform' | 'gaussian' | 'zipf' | 'realistic';
    params?: Record<string, unknown>;
  },
): AIChatParams['messages'] {
  let userContent = `Generate synthetic INSERT scripts for the following tables.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n`;
  userContent += `**Target row count per table:** ${rowCount.toLocaleString()}\n`;
  userContent += `**Data distribution:** ${distributionConfig?.type ?? 'realistic'}\n`;
  if (distributionConfig?.params) {
    userContent += `**Distribution parameters:** ${JSON.stringify(distributionConfig.params)}\n`;
  }
  userContent += `\n**Selected tables:** ${selectedTables.join(', ')}\n\n`;
  userContent += `**Full schema (for referential integrity resolution):**\n\`\`\`sql\n${tableSchema}\n\`\`\`\n\n`;
  userContent += `**Important instructions:**\n`;
  userContent += `- Determine the correct insert order based on FK dependencies\n`;
  userContent += `- Generate 50-100 representative sample rows per table with realistic data\n`;
  userContent += `- For the full volume (${rowCount.toLocaleString()} rows), provide a procedural script pattern (loop/generate_series/CTE-based)\n`;
  userContent += `- Skip auto-increment/SERIAL/IDENTITY columns in INSERT column lists\n`;
  userContent += `- Ensure FK values in child tables reference valid parent PKs\n`;
  userContent += `- Use dialect-appropriate syntax\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
