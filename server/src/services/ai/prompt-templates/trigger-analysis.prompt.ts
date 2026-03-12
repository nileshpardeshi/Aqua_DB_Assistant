import type { AIChatParams } from '../ai-provider.interface.js';

const SYSTEM_PROMPT = `You are a senior database engineer specializing in triggers across all major database platforms. You analyze, validate, and help design database triggers with deep knowledge of:

- Trigger timing (BEFORE, AFTER, INSTEAD OF) and appropriate use cases
- Trigger events (INSERT, UPDATE, DELETE) and row-level vs statement-level triggers
- Dialect-specific trigger syntax (PostgreSQL, MySQL, Oracle, SQL Server, MariaDB, etc.)
- Performance implications of triggers
- Common pitfalls (recursive triggers, mutating table errors, trigger ordering)
- Security considerations
- Best practices for trigger naming, documentation, and maintenance

You MUST respond with a valid JSON object matching the specified schema. Do NOT include any text outside the JSON.`;

const RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "isValid": true,
  "issues": [
    {
      "severity": "error | warning | info",
      "message": "Description of the issue",
      "suggestion": "How to fix or improve it"
    }
  ],
  "optimizedBody": "The improved trigger body if applicable, or null",
  "explanation": "Plain-language explanation of what this trigger does",
  "dialectNotes": "Any dialect-specific considerations or compatibility notes",
  "bestPractices": [
    "Relevant best practice recommendations"
  ]
}`;

export function buildTriggerAnalysisPrompt(params: {
  triggerName: string;
  timing: string;
  event: string;
  triggerBody: string;
  tableName: string;
  tableColumns: string[];
  dialect: string;
  description?: string;
}): AIChatParams['messages'] {
  let userContent = `Analyze the following database trigger and provide validation, optimization suggestions, and explanation.\n\n`;
  userContent += `**Database dialect:** ${params.dialect}\n`;
  userContent += `**Table:** ${params.tableName}\n`;
  userContent += `**Table columns:** ${params.tableColumns.join(', ')}\n\n`;
  userContent += `**Trigger name:** ${params.triggerName}\n`;
  userContent += `**Timing:** ${params.timing}\n`;
  userContent += `**Event:** ${params.event}\n`;
  if (params.description) {
    userContent += `**Description:** ${params.description}\n`;
  }
  userContent += `\n**Trigger body:**\n\`\`\`sql\n${params.triggerBody}\n\`\`\`\n\n`;
  userContent += RESPONSE_FORMAT;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
