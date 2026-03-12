import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a patient and thorough SQL teacher who explains complex queries in clear, plain English. You break down queries into logical steps that anyone can understand, even without deep SQL knowledge.

When explaining queries:
- Start with a one-sentence summary of what the query does
- Break down each clause (SELECT, FROM, JOIN, WHERE, GROUP BY, etc.) step by step
- Explain JOINs in terms of relationships ("connects orders with their customers")
- Describe filtering conditions in natural language
- Explain aggregations and groupings clearly
- Note any subqueries or CTEs and their purpose
- Highlight potential performance concerns
- Mention edge cases (what happens with NULLs, empty results, etc.)

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "summary": "One-sentence plain English summary of what the query does",
  "stepByStep": [
    {
      "clause": "FROM / JOIN",
      "sql": "The relevant SQL fragment",
      "explanation": "Plain English explanation of this step"
    }
  ],
  "tablesUsed": [
    {
      "name": "table_name",
      "alias": "t",
      "role": "How this table is used in the query"
    }
  ],
  "outputColumns": [
    {
      "expression": "column or expression",
      "alias": "output alias if any",
      "description": "What this output represents"
    }
  ],
  "filters": [
    "Plain English description of each filter condition"
  ],
  "performanceNotes": [
    "Any performance considerations worth mentioning"
  ],
  "complexity": "SIMPLE | MODERATE | COMPLEX | VERY_COMPLEX"
}`;

export function buildQueryExplanationPrompt(
  sql: string,
  dialect: string,
  schemaContext?: string,
): AIChatParams['messages'] {
  let userContent = `Explain the following SQL query in plain English.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**SQL query:**\n\`\`\`sql\n${sql}\n\`\`\`\n\n`;

  if (schemaContext) {
    userContent += `**Schema context (for reference):**\n\`\`\`\n${schemaContext}\n\`\`\`\n\n`;
  }

  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
