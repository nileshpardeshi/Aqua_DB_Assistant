import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an expert database migration architect specializing in column mapping between heterogeneous database schemas. You understand naming conventions, data type compatibility, semantic meaning of column names, and common transformation patterns.

When suggesting column mappings, you consider:
- Exact name matches (case-insensitive)
- Semantic similarity (e.g., "fname" maps to "first_name", "dob" maps to "date_of_birth")
- Naming convention translation (camelCase ↔ snake_case ↔ PascalCase)
- Data type compatibility and required casts between dialects
- Composite column mappings (e.g., first_name + last_name → full_name via CONCAT)
- Common abbreviation patterns (qty → quantity, desc → description, amt → amount, addr → address)
- Primary key and foreign key alignment
- Nullable constraints and default value requirements
- Column ordinal position patterns (IDs first, timestamps last)

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "mappings": [
    {
      "sourceColumn": "column_name_in_source",
      "targetColumn": "column_name_in_target",
      "confidence": 0.95,
      "transformationType": "direct | cast | expression | default",
      "expression": "SQL expression if transformationType is expression, e.g. CONCAT(first_name, ' ', last_name)",
      "castTo": "target data type if transformationType is cast, e.g. VARCHAR(255)",
      "reasoning": "Brief explanation of why this mapping was suggested"
    }
  ],
  "unmappedSource": ["columns in source with no suitable target match"],
  "unmappedTarget": ["columns in target with no suitable source match"],
  "warnings": ["Any warnings about potential data loss, truncation, precision issues, or encoding differences"],
  "summary": "Brief overall assessment of the mapping quality, coverage percentage, and any manual intervention needed"
}`;

export function buildColumnMappingPrompt(
  sourceTable: {
    name: string;
    columns: Array<{
      name: string;
      dataType: string;
      nullable: boolean;
      isPrimaryKey: boolean;
    }>;
  },
  targetTable: {
    name: string;
    columns: Array<{
      name: string;
      dataType: string;
      nullable: boolean;
      isPrimaryKey: boolean;
    }>;
  },
  sourceDialect: string,
  targetDialect: string,
  schemaContext?: string,
): AIChatParams['messages'] {
  let userContent = `Suggest intelligent column mappings from the source table to the target table.\n\n`;
  userContent += `**Source Dialect:** ${sourceDialect}\n`;
  userContent += `**Target Dialect:** ${targetDialect}\n\n`;

  userContent += `**Source Table: ${sourceTable.name}**\n`;
  userContent += `| Column | Type | Nullable | PK |\n|--------|------|----------|----|\n`;
  for (const col of sourceTable.columns) {
    userContent += `| ${col.name} | ${col.dataType} | ${col.nullable ? 'YES' : 'NO'} | ${col.isPrimaryKey ? 'YES' : ''} |\n`;
  }

  userContent += `\n**Target Table: ${targetTable.name}**\n`;
  userContent += `| Column | Type | Nullable | PK |\n|--------|------|----------|----|\n`;
  for (const col of targetTable.columns) {
    userContent += `| ${col.name} | ${col.dataType} | ${col.nullable ? 'YES' : 'NO'} | ${col.isPrimaryKey ? 'YES' : ''} |\n`;
  }

  if (schemaContext) {
    userContent += `\n**Additional Schema Context (for understanding relationships and naming patterns):**\n\`\`\`\n${schemaContext}\n\`\`\`\n`;
  }

  userContent += `\n${RESPONSE_FORMAT}`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
