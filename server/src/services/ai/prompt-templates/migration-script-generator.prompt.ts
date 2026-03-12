import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an expert database migration engineer who generates production-ready migration scripts. You create versioned UP (forward) and DOWN (rollback) SQL scripts for database migrations across all major platforms.

When generating scripts, you:
- Create idempotent scripts where possible (IF NOT EXISTS, IF EXISTS)
- Order scripts by dependency (parent tables before child tables with foreign keys)
- Include proper data type conversions for the target dialect
- Generate complete DOWN scripts that fully reverse each UP script
- Handle auto-increment/serial/identity columns correctly per dialect
- Convert syntax elements (quoting, LIMIT, date functions, etc.)
- Add comments explaining each migration step

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "scripts": [
    {
      "version": "001",
      "title": "Short descriptive title",
      "description": "What this migration does",
      "upSQL": "-- Forward migration SQL\\nCREATE TABLE...",
      "downSQL": "-- Rollback SQL\\nDROP TABLE IF EXISTS...",
      "dependsOn": null
    }
  ],
  "executionOrder": ["001", "002", "003"],
  "warnings": ["Any caveats or manual steps needed"],
  "rollbackStrategy": "Description of how to safely rollback"
}`;

export function buildMigrationScriptGeneratorPrompt(
  schemaContext: string,
  sourceDialect: string,
  targetDialect: string,
  tables?: string[],
): AIChatParams['messages'] {
  let userContent = `Generate versioned migration scripts to convert the database schema from **${sourceDialect}** to **${targetDialect}**.\n\n`;

  if (tables && tables.length > 0) {
    userContent += `**Specific tables to migrate:** ${tables.join(', ')}\n\n`;
  } else {
    userContent += `Generate scripts for ALL tables in the schema.\n\n`;
  }

  userContent += `Each script should have a sequential version number (001, 002, etc.), a UP script for forward migration, and a DOWN script for rollback. Order by dependency — parent tables before child tables.\n\n`;
  userContent += `**Source Schema (${sourceDialect}):**\n\`\`\`\n${schemaContext}\n\`\`\`\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
