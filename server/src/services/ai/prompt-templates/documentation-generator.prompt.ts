import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a database documentation expert who creates comprehensive, enterprise-grade documentation for database schemas. You generate clear, professional documentation that database administrators, developers, and architects can use as a reference.

When generating documentation, you:
- Write clear, business-oriented descriptions for each table explaining its purpose and role in the system
- Describe each column's purpose, not just repeat the data type
- Explain relationships and their business meaning (not just FK names)
- Identify patterns, naming conventions, and design decisions
- Note potential concerns (missing indexes, normalization issues, etc.)
- Include usage examples where helpful
- Adapt terminology to the specific database dialect

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "projectOverview": {
    "title": "Database Schema Documentation",
    "description": "High-level description of what this database schema represents and its purpose",
    "dialect": "PostgreSQL",
    "totalTables": 12,
    "totalRelationships": 15,
    "designPatterns": ["Normalized to 3NF", "Soft deletes via is_deleted flag", "Audit trail pattern"],
    "namingConventions": "snake_case for tables and columns, pk_ prefix for primary keys"
  },
  "tables": [
    {
      "name": "table_name",
      "schema": "public",
      "description": "Business-oriented description of the table's purpose and role",
      "category": "Core | Reference | Junction | Audit | Configuration",
      "estimatedVolume": "High (millions of rows expected)",
      "columns": [
        {
          "name": "column_name",
          "dataType": "VARCHAR(255)",
          "nullable": false,
          "isPrimaryKey": true,
          "isForeignKey": false,
          "defaultValue": null,
          "description": "Clear description of what this column stores and its business meaning",
          "sensitivity": "none | pii | financial | confidential",
          "example": "john.doe@example.com"
        }
      ],
      "indexes": [
        {
          "name": "idx_name",
          "columns": ["col1", "col2"],
          "type": "BTREE",
          "isUnique": true,
          "purpose": "Ensures unique email addresses and speeds up login lookups"
        }
      ],
      "constraints": [
        {
          "name": "constraint_name",
          "type": "CHECK | UNIQUE | FOREIGN KEY",
          "columns": ["col1"],
          "description": "Business rule this constraint enforces"
        }
      ],
      "usageNotes": "Important notes about how this table should be used, queried, or maintained"
    }
  ],
  "relationships": [
    {
      "name": "fk_name",
      "sourceTable": "orders",
      "sourceColumn": "customer_id",
      "targetTable": "customers",
      "targetColumn": "id",
      "type": "many-to-one",
      "description": "Each order belongs to exactly one customer. A customer can have many orders.",
      "cascadeRule": "ON DELETE RESTRICT — prevent deleting customers with existing orders",
      "businessRule": "Orders must always reference a valid customer"
    }
  ],
  "dataFlowDiagram": "Textual description of how data flows through the schema: User registers → creates orders → order contains line items → payment is processed",
  "securityNotes": [
    "PII data in customers table (email, phone) requires encryption at rest",
    "Financial data in payments table requires audit logging"
  ],
  "maintenanceNotes": [
    "Consider partitioning orders table by created_at after 10M rows",
    "Regular VACUUM on high-write tables (orders, audit_logs)"
  ],
  "glossary": [
    {
      "term": "SKU",
      "definition": "Stock Keeping Unit — unique identifier for each product variant"
    }
  ]
}`;

export function buildDocumentationPrompt(
  tableSchema: string,
  dialect: string,
  projectName: string,
  additionalContext?: string,
): AIChatParams['messages'] {
  let userContent = `Generate comprehensive database documentation for the following schema.\n\n`;
  userContent += `**Project name:** ${projectName}\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**Full schema:**\n\`\`\`sql\n${tableSchema}\n\`\`\`\n\n`;

  if (additionalContext) {
    userContent += `**Additional context:** ${additionalContext}\n\n`;
  }

  userContent += `**Instructions:**\n`;
  userContent += `- Generate business-oriented descriptions for every table and column\n`;
  userContent += `- Identify the category of each table (Core, Reference, Junction, Audit, Config)\n`;
  userContent += `- Explain every relationship in business terms\n`;
  userContent += `- Identify data sensitivity levels (PII, financial, confidential)\n`;
  userContent += `- Provide realistic example values for columns\n`;
  userContent += `- Note design patterns and naming conventions used\n`;
  userContent += `- Include security and maintenance recommendations\n`;
  userContent += `- Create a glossary of domain-specific terms\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
