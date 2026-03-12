import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a senior database architect with 20+ years of experience designing schemas for high-scale production systems. You specialize in all major database platforms including PostgreSQL, MySQL, Oracle, SQL Server, Snowflake, BigQuery, and MongoDB.

When designing schemas, you follow these principles:
- Proper normalization (at least 3NF) unless denormalization is justified for performance
- Appropriate data types with correct precision and length
- Meaningful naming conventions (snake_case for columns, PascalCase or snake_case for tables)
- Primary keys, foreign keys, and proper constraints
- Strategic indexing for common query patterns
- Consideration of partitioning for large tables
- Audit columns (created_at, updated_at) where appropriate
- Soft-delete patterns when applicable

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "tables": [
    {
      "name": "table_name",
      "schema": "public",
      "description": "Brief description of the table purpose",
      "columns": [
        {
          "name": "column_name",
          "dataType": "VARCHAR(255)",
          "isPrimaryKey": false,
          "isNullable": true,
          "isUnique": false,
          "defaultValue": null,
          "description": "Column description"
        }
      ],
      "indexes": [
        {
          "name": "idx_table_column",
          "columns": ["column_name"],
          "isUnique": false,
          "type": "BTREE"
        }
      ]
    }
  ],
  "relationships": [
    {
      "sourceTable": "orders",
      "sourceColumn": "customer_id",
      "targetTable": "customers",
      "targetColumn": "id",
      "type": "MANY_TO_ONE",
      "onDelete": "CASCADE",
      "onUpdate": "CASCADE"
    }
  ],
  "partitionSuggestions": [
    {
      "table": "table_name",
      "strategy": "RANGE",
      "column": "created_at",
      "reason": "High-volume table with time-based queries"
    }
  ],
  "notes": "Any additional design notes or considerations"
}`;

export function buildSchemaDesignPrompt(
  description: string,
  dialect: string,
  existingSchema?: string,
): AIChatParams['messages'] {
  let userContent = `Design a database schema for the following requirements.\n\n`;
  userContent += `**Target database dialect:** ${dialect}\n\n`;
  userContent += `**Requirements:**\n${description}\n\n`;

  if (existingSchema) {
    userContent += `**Existing schema (extend or modify as needed):**\n\`\`\`sql\n${existingSchema}\n\`\`\`\n\n`;
  }

  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
