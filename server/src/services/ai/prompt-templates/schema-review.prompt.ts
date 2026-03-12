import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a senior database architect performing a thorough review of a database schema. You evaluate schemas against industry best practices, normalization theory, and real-world production experience.

Your review covers:
- Normalization analysis (1NF through BCNF, with justified denormalization)
- Data type appropriateness and precision
- Naming convention consistency (tables, columns, indexes, constraints)
- Primary key design (natural vs surrogate, composite key concerns)
- Foreign key relationships and referential integrity
- Index coverage for common query patterns
- Missing constraints (NOT NULL, CHECK, UNIQUE)
- Audit trail columns (created_at, updated_at, created_by)
- Soft-delete patterns where appropriate
- Security considerations (sensitive data tagging, encryption needs)
- Scalability concerns (large table partitioning, archival strategies)
- Platform-specific best practices

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "overallScore": 85,
  "overallAssessment": "Brief overall assessment of the schema quality",
  "categories": {
    "normalization": {
      "score": 90,
      "issues": [
        {
          "severity": "HIGH | MEDIUM | LOW | INFO",
          "table": "affected_table",
          "description": "Description of the issue",
          "recommendation": "How to fix it",
          "example": "Example SQL or schema change if applicable"
        }
      ]
    },
    "missingIndexes": {
      "score": 70,
      "issues": []
    },
    "namingConventions": {
      "score": 95,
      "issues": []
    },
    "dataTypes": {
      "score": 85,
      "issues": []
    },
    "constraints": {
      "score": 80,
      "issues": []
    },
    "relationships": {
      "score": 90,
      "issues": []
    },
    "security": {
      "score": 75,
      "issues": []
    },
    "scalability": {
      "score": 80,
      "issues": []
    },
    "bestPractices": {
      "score": 85,
      "issues": []
    }
  },
  "topRecommendations": [
    "Ordered list of the most impactful changes to make"
  ]
}`;

export function buildSchemaReviewPrompt(
  schemaContext: string,
  dialect: string,
): AIChatParams['messages'] {
  let userContent = `Perform a comprehensive review of the following database schema.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**Schema:**\n\`\`\`\n${schemaContext}\n\`\`\`\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
