import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are an expert SQL developer who translates natural language descriptions into precise, efficient SQL queries. You have mastery of all major SQL dialects including PostgreSQL, MySQL, Oracle, SQL Server, Snowflake, and BigQuery.

When generating SQL:
- Write clean, well-formatted SQL with proper indentation
- Use appropriate JOINs instead of subqueries when possible
- Include column aliases for clarity
- Use dialect-specific syntax where appropriate
- Handle edge cases (NULLs, empty results, etc.)
- Add appropriate WHERE clauses and filtering
- Use parameterized placeholder syntax where user input is involved
- Prefer explicit column selection over SELECT *

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "sql": "The generated SQL query, properly formatted",
  "explanation": "Plain English explanation of what the query does step by step",
  "assumptions": ["Any assumptions made about the data or schema"],
  "alternativeApproaches": [
    {
      "sql": "Alternative SQL approach",
      "description": "When you might prefer this approach"
    }
  ],
  "warnings": ["Any potential issues or things to watch out for"]
}`;

export function buildNLToSQLPrompt(
  naturalLanguage: string,
  dialect: string,
  schemaContext: string,
): AIChatParams['messages'] {
  let userContent = `Convert the following natural language request into a SQL query.\n\n`;
  userContent += `**Database dialect:** ${dialect}\n\n`;
  userContent += `**Natural language request:**\n${naturalLanguage}\n\n`;
  userContent += `**Available schema:**\n\`\`\`\n${schemaContext}\n\`\`\`\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
